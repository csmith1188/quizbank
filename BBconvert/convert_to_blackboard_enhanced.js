import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import resourceService from '../services/resource-service.js';

async function initialize() {
    const allContentData = await resourceService.getResource(2, '/course');
    console.log('hello', allContentData);
    console.log('Initialization complete.');
    return allContentData;
}

const quizData = await initialize(); // Await the initialization to get quiz data

function loadQuizData() {
    // Use the quizData obtained from the database instead of reading from a file
    if (!quizData) {
        console.error('Error: Quiz data is not available.');
        process.exit(1);
    }
    
    console.log(quizData, "quizData");
    return quizData;
}

// Ensure exports directory exists
function ensureExportsDir() {
    const exportsDir = path.join(path.resolve(), 'exports');
    console.log(exportsDir, "exportsDir");
    if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
        console.log('Created exports directory');
    }
    return exportsDir;
}

// Get task by section, unit, and task IDs
function getTask(quizData, sectionUid, unitUid, taskUid) {
    try {
        if (!quizData || !quizData.courses || !quizData.courses.length) {
            throw new Error('Quiz data is not properly structured or courses are missing');
        }
        
        const section = quizData.courses.flatMap(course => course.sections).find(s => s.uid === sectionUid);
        if (!section) {
            throw new Error(`Section with UID ${sectionUid} not found`);
        }
        
        if (!section.units) {
            throw new Error(`No units found in section "${section.name}"`);
        }
        
        const unit = section.units.find(u => u.uid === unitUid);
        if (!unit) {
            throw new Error(`Unit with UID ${unitUid} not found in section "${section.name}"`);
        }
        
        if (!unit.tasks) {
            throw new Error(`No tasks found in unit "${unit.name}"`);
        }
        
        const task = unit.tasks.find(t => t.uid === taskUid);
        if (!task) {
            throw new Error(`Task with UID ${taskUid} not found in unit "${unit.name}"`);
        }
        
        return { section, unit, task };
    } catch (error) {
        console.error('Error getting task:', error.message);
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

// Create Blackboard XML content
function createBlackboardXML(task) {
    const questionList = task.questions.map((q) => 
        `    <QUESTION id="q${q.index}" class="QUESTION_MULTIPLECHOICE" />`
    ).join('\n');

    const questions = task.questions.map((q) => {
        const answers = Array.isArray(q.answers) ? q.answers.map((answer, aIndex) => {
            return `    <ANSWER id="q${q.index}_a${aIndex + 1}" position="${aIndex + 1}">
              <DATES>
                <CREATED value="${getCurrentTimestamp()}" />
                <UPDATED value="${getCurrentTimestamp()}" />
              </DATES>
              <TEXT>${escapeXml(answer)}</TEXT>
            </ANSWER>`;
        }).join('\n') : '';

        const correctAnswerId = `q${q.index}_a${q.correctIndex + 1}`;

        return `  <QUESTION_MULTIPLECHOICE id="q${q.index}">
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
  <TITLE value="${escapeXml(task.name)}" />
  <DESCRIPTION>
    <TEXT>${escapeXml(task.description)}</TEXT>
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

// Create Blackboard ZIP file with proper structure
async function createBlackboardZIP(blackboardXML, manifestXML, sectionName, unitName, taskName) {
    return new Promise((resolve, reject) => {
        const zipFilename = `blackboard_${sectionName.replace(/\s+/g, '_')}_${unitName.replace(/\s+/g, '_')}_${taskName.replace(/\s+/g, '_')}.zip`;
        const zipPath = path.join(path.dirname(import.meta.url), 'exports', zipFilename);
        
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level
        });

        output.on('close', () => {
            console.log(`ZIP file created: ${zipFilename}`);
            console.log(`Total size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
            resolve(zipPath);
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        // Add the Blackboard XML file to the root of the ZIP
        archive.append(blackboardXML, { name: 'blackboard_quiz.dat' });
        
        // Add the manifest file to the root of the ZIP
        archive.append(manifestXML, { name: 'imsmanifest.xml' });

        archive.finalize();
    });
}

// Main conversion function
async function convertToBlackboard(sectionId, unitId, taskId) {
    try {
        console.log('Loading quiz data...');
        const quizData = loadQuizData();
        
        console.log('Getting task...');
        const { section, unit, task } = getTask(quizData, sectionId, unitId, taskId);
        
        console.log(`Converting task: ${task.name}`);
        console.log(`Section: ${section.name} (ID: ${section.index})`);
        console.log(`Unit: ${unit.name} (ID: ${unit.index})`);
        console.log(`Task: ${task.name} (ID: ${task.index})`);
        console.log(`Description: ${task.description}`);
        console.log(`Number of questions: ${task.questions.length}`);
        
        // Validate questions
        const validQuestions = task.questions.filter(q => 
            q.prompt && q.answers && q.answers.length > 0 && 
            q.correct_answer && q.correct_index !== undefined
        );
        
        if (validQuestions.length !== task.questions.length) {
            console.warn(`Warning: ${task.questions.length - validQuestions.length} questions were invalid and skipped.`);
        }
        
        if (validQuestions.length === 0) {
            console.error('No valid questions found in this task.');
            process.exit(1);
        }
        
        // Create a clean task object with only valid questions
        const cleanTask = { ...task, questions: validQuestions };
        
        // Create the Blackboard XML
        console.log('Creating Blackboard XML...');
        const blackboardXML = createBlackboardXML(cleanTask, section.name, unit.name);
        
        // Create manifest XML
        console.log('Creating manifest XML...');
        const manifestXML = createManifestXML('blackboard_quiz.dat');
        
        // Ensure exports directory exists
        console.log('Ensuring exports directory exists...');
        ensureExportsDir();
        
        // Create the ZIP file
        console.log('Creating Blackboard ZIP file...');
        const zipPath = await createBlackboardZIP(blackboardXML, manifestXML, section.name, unit.name, task.name);
        
        console.log('\nConversion complete!');
        console.log('Files created in exports folder:');
        console.log(`- ${path.basename(zipPath)} (Blackboard import ZIP file)`);
        console.log('');
        console.log('You can now import this ZIP file into Blackboard.');
        console.log('');
        console.log('Task Summary:');
        console.log(`- Task: ${task.name} (ID: ${task.id})`);
        console.log(`- Questions converted: ${validQuestions.length}`);
        console.log(`- Section: ${section.name} (ID: ${section.id})`);
        console.log(`- Unit: ${unit.name} (ID: ${unit.id})`);
        
    } catch (error) {
        console.error('Error during conversion:', error.message);
        process.exit(1);
    }
}
// Show available tasks
function showAvailableTasks() {
    console.log('Loading quiz data...');
    const quizData = loadQuizData();
    
    console.log('\nAvailable tasks:');
    console.log('================');

    const sections = quizData.courses.flatMap(course => course.sections) || [];
    console.log(`Total sections: ${sections.length}`);
    console.log(sections);
    const courses = quizData.courses || [];
    console.log(`Total courses: ${courses.length}`);
    courses.forEach((course, courseIndex) => {
        console.log(`Course ${course.id}: ${course.name}`);
        course.sections.forEach((section, sectionIndex) => {
            console.log(`  Section ${section.id}: ${section.name}`);
            section.units.forEach((unit, unitIndex) => {
                console.log(`    Unit ${unit.id}: ${unit.name}`);
                unit.tasks.forEach((task, taskIndex) => {
                    console.log(`      Task ${task.id}: ${task.name} (${task.questions.length} questions)`);
                });
            });
        });
    });
    
    sections.forEach((section, sectionIndex) => {
        console.log(`\nSection ${section.id}: ${section.name}`);
        section.units.forEach((unit, unitIndex) => {
            console.log(`  Unit ${unit.id}: ${unit.name}`);
            unit.tasks.forEach((task, taskIndex) => {
                console.log(`    Task ${task.id}: ${task.name} (${task.questions.length} questions)`);
            });
        });
    });
    
    console.log('\nTo convert a specific task, use:');
    console.log('node convert_to_blackboard_enhanced.js <sectionId> <unitId> <taskId>');
    console.log('\nExamples:');
    console.log('  node convert_to_blackboard_enhanced.js 2 2 1    # Documentation task');
    console.log('  node convert_to_blackboard_enhanced.js 2 2 2    # Datatypes task');
    console.log('  node convert_to_blackboard_enhanced.js 2 2 3    # Assignment task');
}

// Main execution
if (process.argv.length === 2) {
    // No arguments provided, show available tasks
    showAvailableTasks();
} else if (process.argv.length === 5) {
    // Convert specific task
    const sectionId = parseInt(process.argv[2]);
    const unitId = parseInt(process.argv[3]);
    const taskId = parseInt(process.argv[4]);
    
    if (isNaN(sectionId) || isNaN(unitId) || isNaN(taskId)) {
        console.error('Error: All arguments must be valid numbers.');
        process.exit(1);
    }
    
    convertToBlackboard(sectionId, unitId, taskId);
} else {
    console.error('Usage: node convert_to_blackboard_enhanced.js [<sectionId> <unitId> <taskId>]');
    console.error('If no arguments provided, shows available tasks with their IDs.');
    console.error('');
    console.error('Examples:');
    console.error('  node convert_to_blackboard_enhanced.js 2 2 1    # Documentation task');
    console.error('  node convert_to_blackboard_enhanced.js 2 2 2    # Datatypes task');
    process.exit(1);
}
