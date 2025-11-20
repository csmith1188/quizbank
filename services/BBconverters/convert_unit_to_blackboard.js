import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import resourceService from '../resource-service.js';
import { fileURLToPath } from 'url';

async function initialize() {
    const allContentData = await resourceService.getResource(2, '/course');
    return allContentData;
}

const quizData = await initialize(); // Await the initialization to get quiz data

// Load quiz data from the initialized variable
function loadQuizData() {
    if (!quizData) {
        process.exit(1);
    }
    return quizData;
}

// Ensure exports directory exists
async function ensureExportsDir() {
    const exportsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'exports');
    try {
        await fs.promises.access(exportsDir);
    } catch {
        await fs.promises.mkdir(exportsDir, { recursive: true });
    }
    return exportsDir;
}

// Get unit by section and unit IDs
function getUnit(quizData, sectionUid, unitUid) {
    try {
        const section = quizData.courses.flatMap(course => course.sections).find(sec => sec.uid === sectionUid);
        if (!section) {
            throw new Error(`Section with ID ${sectionUid} not found`);
        }
        
        const unit = section.units.find(u => u.uid === unitUid);
        if (!unit) {
            throw new Error(`Unit with ID ${unitUid} not found in section "${section.name}"`);
        }
        
        return { section, unit };
    } catch (error) {
        console.error('Error getting unit:', error.message);
        process.exit(1);
    }
}

// Generate current timestamp in Blackboard format
function getCurrentTimestamp() {
    return new Date().toISOString().replace('T', ' ').replace('Z', 'Z');
}

// Escape XML special characters
function escapeXml(text) {
    if (typeof text !== 'string') {
        text = String(text);
    }
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Create Blackboard XML content for all tasks in a unit
function createUnitBlackboardXML(unit) {
    // Collect all questions from all tasks
    let allQuestions = [];
    let questionCounter = 1;
    
    unit.tasks.forEach((task) => {
        task.questions.forEach((question) => {
            // Create a unique question ID that combines task and question
            const uniqueQuestionId = `task${task.id}_q${question.id}`;
            allQuestions.push({
                ...question,
                uniqueId: uniqueQuestionId,
                taskName: task.name,
                taskDescription: task.description,
                displayOrder: questionCounter++
            });
        });
    });

    // Create question list
    const questionList = allQuestions.map(q => 
        `    <QUESTION id="${q.uid}" class="QUESTION_MULTIPLECHOICE" />`
    ).join('\n');

    // Create all questions
    const questions = allQuestions.map((q) => {
        const answers = Array.isArray(q.answers) ? q.answers.map((answer, aIndex) => {
            return `    <ANSWER id="${q.uniqueId}_a${aIndex + 1}" position="${aIndex + 1}">
      <DATES>
        <CREATED value="${getCurrentTimestamp()}" />
        <UPDATED value="${getCurrentTimestamp()}" />
      </DATES>
      <TEXT>${escapeXml(answer)}</TEXT>
    </ANSWER>`;
        }).join('\n') : '';

        const correctAnswerId = `${q.uniqueId}_a${q.correctIndex + 1}`;

        return `  <QUESTION_MULTIPLECHOICE id="${q.uniqueId}">
    <DATES>
      <CREATED value="${getCurrentTimestamp()}" />
      <UPDATED value="${getCurrentTimestamp()}" />
    </DATES>
    <BODY>
      <TEXT>${escapeXml(q.prompt)}</TEXT>
      <FLAGS value="true">
        <ISHTML value="true" />
        <ISNEWLINELITERAL />
      </FLAGS>
    </BODY>
${answers}
    <GRADABLE>
      <FEEDBACK_WHEN_CORRECT>Correct! Well done.</FEEDBACK_WHEN_CORRECT>
      <FEEDBACK_WHEN_INCORRECT>That's not correct. Please review the material and try again.</FEEDBACK_WHEN_INCORRECT>
      <CORRECTANSWER answer_id="${correctAnswerId}" />
    </GRADABLE>
  </QUESTION_MULTIPLECHOICE>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<POOL>
  <COURSEID value="IMPORT" />
  <TITLE value="${escapeXml(unit.name)} - Complete Unit Quiz" />
  <DESCRIPTION>
    <TEXT>${escapeXml(unit.description)} - All questions from all tasks in this unit.</TEXT>
  </DESCRIPTION>
  <DATES>
    <CREATED value="${getCurrentTimestamp()}" />
    <UPDATED value="${getCurrentTimestamp()}" />
  </DATES>
  <QUESTIONLIST>
${questionList}
  </QUESTIONLIST>
${questions}
</POOL>`;
}

// Create manifest XML
function createManifestXML(filename) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="man00001">
  <organization default="toc00001">
    <tableofcontents identifier="toc00001"/>
  </organization>
  <resources>
    <resource baseurl="res00001" file="${filename}" identifier="res00001" type="assessment/x-bb-pool"/>
  </resources>
</manifest>`;
}

// Create Blackboard ZIP file with proper structure using archiver
async function createBlackboardZIP(blackboardXML, manifestXML, sectionName, unitName) {
    return new Promise((resolve, reject) => {
        const zipFilename = `blackboard_unit_${sectionName.replace(/\s+/g, '_')}_${unitName.replace(/\s+/g, '_')}.zip`;
        const __filename = fileURLToPath(import.meta.url);
        const zipPath = path.join(path.dirname(__filename), 'exports', zipFilename);
        
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level
        });

        output.on('close', () => {
            resolve(zipPath);
        });

        ('Setting up archive error handling...');
        archive.on('error', (err) => {
            reject(err);
        });

        ('Piping archive data to output file...');
        archive.pipe(output);

        // Add the Blackboard XML file to the root of the ZIP
        ('Adding Blackboard XML to archive...');
        archive.append(blackboardXML, { name: 'blackboard_quiz.dat' });
        
        // Add the manifest file to the root of the ZIP
        ('Adding manifest XML to archive...');
        archive.append(manifestXML, { name: 'imsmanifest.xml' });

        ('Finalizing archive...');
        archive.finalize();
    });
}

// Main conversion function
async function convertUnitToBlackboard(sectionUid, unitUid) {
    try {
        ('Loading quiz data...');
        const quizData = loadQuizData();
        ('Quiz data loaded successfully.', quizData);
        
        ('Getting unit...');
        (`Stuff, ${sectionUid}, ${unitUid}`);
        const { section, unit } = getUnit(quizData, sectionUid, unitUid);
        
        (`Converting unit: ${unit.name}`);
        (`Section: ${section.name} (ID: ${section.uid})`);
        (`Unit: ${unit.name} (ID: ${unit.uid})`);
        (`Number of tasks: ${unit.tasks.length}`);
        
        // Count total questions across all tasks
        let totalQuestions = 0;
        let validQuestions = 0;
        
        unit.tasks.forEach((task, taskIndex) => {
            (`  Task ${taskIndex + 1}: ${task.name} (${task.questions.length} questions)`);
            totalQuestions += task.questions.length;
            
            // Validate questions in this task
            const taskValidQuestions = task.questions.filter(q => 
                q.prompt && q.answers && q.answers.length > 0 && 
                q.correct_answer && q.correct_index !== undefined
            );
            
            validQuestions += taskValidQuestions.length;
            
            if (taskValidQuestions.length !== task.questions.length) {
                console.warn(`    Warning: ${task.questions.length - taskValidQuestions.length} questions were invalid and skipped.`);
            }
        });
        
        (`Total questions across all tasks: ${totalQuestions}`);
        (`Valid questions: ${validQuestions}`);
        
        if (validQuestions === 0) {
            console.error('No valid questions found in this unit.');
            process.exit(1);
        }
        
        // Create the Blackboard XML
        ('Creating Blackboard XML...');
        const blackboardXML = createUnitBlackboardXML(unit, section.name);
        
        // Create manifest XML
        ('Creating manifest XML...');
        const manifestXML = createManifestXML('blackboard_quiz.dat');
        ('Manifest XML created.', manifestXML);
        
        // Ensure exports directory exists
        ('Ensuring exports directory exists...');
        ensureExportsDir();
        
        // Create the ZIP file
        ('Creating Blackboard ZIP file...');
        const zipPath = await createBlackboardZIP(blackboardXML, manifestXML, section.name, unit.name);
        
        ('\nConversion complete!');
        ('Files created in exports folder:');
        (`- ${path.basename(zipPath)} (Blackboard import ZIP file)`);
        ('');
        ('You can now import this ZIP file into Blackboard.');
        ('');
        ('Unit Summary:');
        (`- Unit: ${unit.name} (ID: ${unit.uid})`);
        (`- Section: ${section.name} (ID: ${section.uid})`);
        (`- Tasks included: ${unit.tasks.length}`);
        (`- Total questions: ${validQuestions}`);
        ('');
        ('Tasks included:');
        unit.tasks.forEach((task, index) => {
            const validTaskQuestions = task.questions.filter(q => 
                q.prompt && q.answers && q.answers.length > 0 && 
                q.correct_answer && q.correct_index !== undefined
            );
            (`  ${index + 1}. ${task.name}: ${validTaskQuestions.length} questions`);
        });
        
    } catch (error) {
        console.error('Error during conversion:', error.message);
        process.exit(1);
    }
}

// Show available units
function showAvailableUnits() {
    ('Loading quiz data...');
    const quizData = loadQuizData();
    
    ('\nAvailable units:');
    ('================');
    
    quizData.sections.forEach((section) => {
        (`\nSection ${section.uid}: ${section.name}`);
        section.units.forEach((unit) => {
            let totalQuestions = 0;
            unit.tasks.forEach(task => {
                totalQuestions += task.questions.length;
            });
            (`  Unit ${unit.uid}: ${unit.name} (${unit.tasks.length} tasks, ${totalQuestions} total questions)`);
            unit.tasks.forEach((task) => {
                (`    Task ${task.uid}: ${task.name} (${task.questions.length} questions)`);
            });
        });
    });
    
    ('\nTo convert a specific unit (all tasks), use:');
    ('node convert_unit_to_blackboard.js <sectionId> <unitId>');
    ('\nExamples:');
    ('  node convert_unit_to_blackboard.js 2 1    # Variables and Data Types unit');
    ('  node convert_unit_to_blackboard.js 2 2    # Another unit');
}

// Main execution
if (process.argv.length === 2) {
    // No arguments provided, show available units
    showAvailableUnits();
} else if (process.argv.length === 4) {
    // Convert specific unit
    const sectionId = parseInt(process.argv[2]);
    const unitId = parseInt(process.argv[3]);
    
    if (isNaN(sectionId) || isNaN(unitId)) {
        console.error('Error: All arguments must be valid numbers.');
        process.exit(1);
    }
    
    convertUnitToBlackboard(sectionId, unitId);
} else {
    console.error('Usage: node convert_unit_to_blackboard.js [<sectionId> <unitId>]');
    console.error('If no arguments provided, shows available units with their IDs.');
    console.error('');
    console.error('Examples:');
    console.error('  node convert_unit_to_blackboard.js 2 1    # Variables and Data Types unit');
    console.error('  node convert_unit_to_blackboard.js 2 2    # Another unit');
    process.exit(1);
}
