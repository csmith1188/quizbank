import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import resourceService from '../resource-service.js';
import { fileURLToPath } from 'url';

// Initialize and fetch quiz data
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

// Ensure the exports directory exists for saving files
function ensureExportsDir() {
    const exportsDir = path.join(path.resolve(), 'exports');
    if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
    }
    return exportsDir;
}

// Get task by section, unit, and task IDs
function getTask(quizData, sectionUid, unitUid, taskUid) {
    try {
        if (!quizData || !quizData.courses || !quizData.courses.length) {
            throw new Error('Quiz data is not properly structured or courses are missing');
        }
        
        const section = quizData.courses.flatMap(course => course.sections).find(sec => sec.uid === sectionUid);
        if (!section) {
            throw new Error(`Section with uid ${sectionUid} not found`);
        }
        
        if (!section.units) {
            throw new Error(`No units found in section "${section.name}"`);
        }
        
        const unit = section.units.find(unit => unit.uid === unitUid);
        if (!unit) {
            throw new Error(`Unit with uid ${unitUid} not found in section "${section.name}"`);
        }
        
        if (!unit.tasks) {
            throw new Error(`No tasks found in unit "${unit.name}"`);
        }
        
        const task = unit.tasks.find(t => t.uid === taskUid);
        if (!task) {
            throw new Error(`Task with uid ${taskUid} not found in unit "${unit.name}"`);
        }
        
        return { section, unit, task };
    } catch (error) {
        process.exit(1);
    }
}

// Generate current timestamp in Blackboard format
function getCurrentTimestamp() {
    return new Date().toISOString().replace('T', ' ').replace('Z', 'Z');
}

// Escape XML special characters for safe XML output
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

// Create Blackboard XML content for the task
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

// Create manifest XML for the ZIP file
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
        const __filename = fileURLToPath(import.meta.url);
        const zipPath = path.join(path.dirname(__filename), 'exports', zipFilename);
        
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level
        });

        output.on('close', () => {
            resolve(zipPath);
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);
        archive.append(blackboardXML, { name: 'blackboard_quiz.dat' });
        archive.append(manifestXML, { name: 'imsmanifest.xml' });
        archive.finalize();
    });
}

// Main conversion function
async function convertToBlackboard(sectionId, unitId, taskId) {
    try {
        const quizData = loadQuizData();
        const { section, unit, task } = getTask(quizData, sectionId, unitId, taskId);
        
        const validQuestions = task.questions.filter(q => 
            q.prompt && q.answers && q.answers.length > 0 && 
            q.correct_answer && q.correct_index !== undefined
        );
        
        if (validQuestions.length === 0) {
            process.exit(1);
        }
        
        const cleanTask = { ...task, questions: validQuestions };
        const blackboardXML = createBlackboardXML(cleanTask);
        const manifestXML = createManifestXML('blackboard_quiz.dat');
        ensureExportsDir();
        const zipPath = await createBlackboardZIP(blackboardXML, manifestXML, section.name, unit.name, task.name);
        
    } catch (error) {
        process.exit(1);
    }
}

// Show available tasks
function showAvailableTasks() {
    const quizData = loadQuizData();
    
    const sections = quizData.courses.flatMap(course => course.sections) || [];
    const courses = quizData.courses || [];
    courses.forEach((course) => {
        course.sections.forEach((section) => {
            section.units.forEach((unit) => {
                unit.tasks.forEach((task) => {
                });
            });
        });
    });
}

// Main execution
if (process.argv.length === 2) {
    showAvailableTasks();
} else if (process.argv.length === 5) {
    const sectionId = parseInt(process.argv[2]);
    const unitId = parseInt(process.argv[3]);
    const taskId = parseInt(process.argv[4]);
    
    if (isNaN(sectionId) || isNaN(unitId) || isNaN(taskId)) {
        process.exit(1);
    }
    
    convertToBlackboard(sectionId, unitId, taskId);
} else {
    process.exit(1);
}