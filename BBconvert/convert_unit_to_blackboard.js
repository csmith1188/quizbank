const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Read the 10th.json file
function loadQuizData() {
    try {
        const quizData = JSON.parse(fs.readFileSync('../quizsources/10th.json', 'utf8'));
        return quizData;
    } catch (error) {
        console.error('Error reading ../quizsources/10th.json:', error.message);
        process.exit(1);
    }
}

// Ensure exports directory exists
function ensureExportsDir() {
    const exportsDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
        console.log('Created exports directory');
    }
    return exportsDir;
}

// Get unit by section and unit IDs
function getUnit(quizData, sectionId, unitId) {
    try {
        const section = quizData.sections.find(s => s.id === sectionId);
        if (!section) {
            throw new Error(`Section with ID ${sectionId} not found`);
        }
        
        const unit = section.units.find(u => u.id === unitId);
        if (!unit) {
            throw new Error(`Unit with ID ${unitId} not found in section "${section.name}"`);
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
function createUnitBlackboardXML(unit, sectionName) {
    // Collect all questions from all tasks
    let allQuestions = [];
    let questionCounter = 1;
    
    unit.tasks.forEach((task, taskIndex) => {
        task.questions.forEach((question, qIndex) => {
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
        `    <QUESTION id="${q.uniqueId}" class="QUESTION_MULTIPLECHOICE" />`
    ).join('\n');

    // Create all questions
    const questions = allQuestions.map((q) => {
        const answers = q.answers.map((answer, aIndex) => {
            return `    <ANSWER id="${q.uniqueId}_a${aIndex + 1}" position="${aIndex + 1}">
      <DATES>
        <CREATED value="${getCurrentTimestamp()}" />
        <UPDATED value="${getCurrentTimestamp()}" />
      </DATES>
      <TEXT>${escapeXml(answer)}</TEXT>
    </ANSWER>`;
        }).join('\n');

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
        const zipPath = path.join(__dirname, 'exports', zipFilename);
        
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
async function convertUnitToBlackboard(sectionId, unitId) {
    try {
        console.log('Loading quiz data...');
        const quizData = loadQuizData();
        
        console.log('Getting unit...');
        const { section, unit } = getUnit(quizData, sectionId, unitId);
        
        console.log(`Converting unit: ${unit.name}`);
        console.log(`Section: ${section.name} (ID: ${section.id})`);
        console.log(`Unit: ${unit.name} (ID: ${unit.id})`);
        console.log(`Number of tasks: ${unit.tasks.length}`);
        
        // Count total questions across all tasks
        let totalQuestions = 0;
        let validQuestions = 0;
        
        unit.tasks.forEach((task, taskIndex) => {
            console.log(`  Task ${taskIndex + 1}: ${task.name} (${task.questions.length} questions)`);
            totalQuestions += task.questions.length;
            
            // Validate questions in this task
            const taskValidQuestions = task.questions.filter(q => 
                q.prompt && q.answers && q.answers.length > 0 && 
                q.correctAnswer && q.correctIndex !== undefined
            );
            
            validQuestions += taskValidQuestions.length;
            
            if (taskValidQuestions.length !== task.questions.length) {
                console.warn(`    Warning: ${task.questions.length - taskValidQuestions.length} questions were invalid and skipped.`);
            }
        });
        
        console.log(`Total questions across all tasks: ${totalQuestions}`);
        console.log(`Valid questions: ${validQuestions}`);
        
        if (validQuestions === 0) {
            console.error('No valid questions found in this unit.');
            process.exit(1);
        }
        
        // Create the Blackboard XML
        console.log('Creating Blackboard XML...');
        const blackboardXML = createUnitBlackboardXML(unit, section.name);
        
        // Create manifest XML
        const manifestXML = createManifestXML('blackboard_quiz.dat');
        
        // Ensure exports directory exists
        ensureExportsDir();
        
        // Create the ZIP file
        console.log('Creating Blackboard ZIP file...');
        const zipPath = await createBlackboardZIP(blackboardXML, manifestXML, section.name, unit.name);
        
        console.log('\nConversion complete!');
        console.log('Files created in exports folder:');
        console.log(`- ${path.basename(zipPath)} (Blackboard import ZIP file)`);
        console.log('');
        console.log('You can now import this ZIP file into Blackboard.');
        console.log('');
        console.log('Unit Summary:');
        console.log(`- Unit: ${unit.name} (ID: ${unit.id})`);
        console.log(`- Section: ${section.name} (ID: ${section.id})`);
        console.log(`- Tasks included: ${unit.tasks.length}`);
        console.log(`- Total questions: ${validQuestions}`);
        console.log('');
        console.log('Tasks included:');
        unit.tasks.forEach((task, index) => {
            const validTaskQuestions = task.questions.filter(q => 
                q.prompt && q.answers && q.answers.length > 0 && 
                q.correctAnswer && q.correctIndex !== undefined
            );
            console.log(`  ${index + 1}. ${task.name}: ${validTaskQuestions.length} questions`);
        });
        
    } catch (error) {
        console.error('Error during conversion:', error.message);
        process.exit(1);
    }
}

// Show available units
function showAvailableUnits() {
    console.log('Loading quiz data...');
    const quizData = loadQuizData();
    
    console.log('\nAvailable units:');
    console.log('================');
    
    quizData.sections.forEach((section) => {
        console.log(`\nSection ${section.id}: ${section.name}`);
        section.units.forEach((unit) => {
            let totalQuestions = 0;
            unit.tasks.forEach(task => {
                totalQuestions += task.questions.length;
            });
            console.log(`  Unit ${unit.id}: ${unit.name} (${unit.tasks.length} tasks, ${totalQuestions} total questions)`);
            unit.tasks.forEach((task) => {
                console.log(`    Task ${task.id}: ${task.name} (${task.questions.length} questions)`);
            });
        });
    });
    
    console.log('\nTo convert a specific unit (all tasks), use:');
    console.log('node convert_unit_to_blackboard.js <sectionId> <unitId>');
    console.log('\nExamples:');
    console.log('  node convert_unit_to_blackboard.js 2 1    # Variables and Data Types unit');
    console.log('  node convert_unit_to_blackboard.js 2 2    # Another unit');
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
