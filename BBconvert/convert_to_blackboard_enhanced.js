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

// Get task by section, unit, and task IDs
function getTask(quizData, sectionId, unitId, taskId) {
    try {
        const section = quizData.sections.find(s => s.id === sectionId);
        if (!section) {
            throw new Error(`Section with ID ${sectionId} not found`);
        }
        
        const unit = section.units.find(u => u.id === unitId);
        if (!unit) {
            throw new Error(`Unit with ID ${unitId} not found in section "${section.name}"`);
        }
        
        const task = unit.tasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`Task with ID ${taskId} not found in unit "${unit.name}"`);
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
function createBlackboardXML(task, sectionName, unitName) {
    const questionList = task.questions.map((q, index) => 
        `    <QUESTION id="q${q.id}" class="QUESTION_MULTIPLECHOICE" />`
    ).join('\n');

    const questions = task.questions.map((q, index) => {
        const answers = q.answers.map((answer, aIndex) => {
            return `    <ANSWER id="q${q.id}_a${aIndex + 1}" position="${aIndex + 1}">
      <DATES>
        <CREATED value="${getCurrentTimestamp()}" />
        <UPDATED value="${getCurrentTimestamp()}" />
      </DATES>
      <TEXT>${escapeXml(answer)}</TEXT>
    </ANSWER>`;
        }).join('\n');

        const correctAnswerId = `q${q.id}_a${q.correctIndex + 1}`;

        return `  <QUESTION_MULTIPLECHOICE id="q${q.id}">
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
async function convertToBlackboard(sectionId, unitId, taskId) {
    try {
        console.log('Loading quiz data...');
        const quizData = loadQuizData();
        
        console.log('Getting task...');
        const { section, unit, task } = getTask(quizData, sectionId, unitId, taskId);
        
        console.log(`Converting task: ${task.name}`);
        console.log(`Section: ${section.name} (ID: ${section.id})`);
        console.log(`Unit: ${unit.name} (ID: ${unit.id})`);
        console.log(`Task: ${task.name} (ID: ${task.id})`);
        console.log(`Description: ${task.description}`);
        console.log(`Number of questions: ${task.questions.length}`);
        
        // Validate questions
        const validQuestions = task.questions.filter(q => 
            q.prompt && q.answers && q.answers.length > 0 && 
            q.correctAnswer && q.correctIndex !== undefined
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
        const manifestXML = createManifestXML('blackboard_quiz.dat');
        
        // Ensure exports directory exists
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
    
    quizData.sections.forEach((section) => {
        console.log(`\nSection ${section.id}: ${section.name}`);
        section.units.forEach((unit) => {
            console.log(`  Unit ${unit.id}: ${unit.name}`);
            unit.tasks.forEach((task) => {
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
