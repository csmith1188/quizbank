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

// Get unit by course, section, and unit IDs
function getUnit(quizData, courseUid, sectionUid, unitUid) {
    console.log(`Getting unit with Course UID: ${courseUid}, Section UID: ${sectionUid}, Unit UID: ${unitUid}`);
    try {
        if (!quizData.courses || quizData.courses.length === 0) {
            throw new Error('No courses found in quiz data');
        }

        const course = quizData.courses.find(c => c.uid == courseUid);
        console.log(quizData.courses.map(c => c.uid));
        if (!course) {
            throw new Error(`Course with UID ${courseUid} not found`);
        }

        const section = course.sections.find(sec => sec.uid == sectionUid);
        if (!section) {
            throw new Error(`Section with UID ${sectionUid} not found in course "${course.name}"`);
        }

        const unit = section.units.find(u => u.uid == unitUid);
        if (!unit) {
            throw new Error(`Unit with UID ${unitUid} not found in section "${section.name}"`);
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
async function convertUnitToBlackboard(courseUid, sectionUid, unitUid) {
    try {
        const quizData = loadQuizData();

        const { section, unit } = getUnit(quizData, courseUid, sectionUid, unitUid);

        // Count total questions across all tasks
        let totalQuestions = 0;
        let validQuestions = 0;

        unit.tasks.forEach((task, taskIndex) => {
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

        if (validQuestions === 0) {
            console.error('No valid questions found in this unit.');
            process.exit(1);
        }

        // Create the Blackboard XML
        const blackboardXML = createUnitBlackboardXML(unit, section.name);

        // Create manifest XML
        const manifestXML = createManifestXML('blackboard_quiz.dat');

        // Ensure exports directory exists
        ensureExportsDir();

        // Create the ZIP file
        const zipPath = await createBlackboardZIP(blackboardXML, manifestXML, section.name, unit.name);

        unit.tasks.forEach((task, index) => {
            const validTaskQuestions = task.questions.filter(q =>
                q.prompt && q.answers && q.answers.length > 0 &&
                q.correct_answer && q.correct_index !== undefined
            );
        });
    } catch (error) {
        console.error('Error during conversion:', error.message);
        process.exit(1);
    }
}

// Show available units
function showAvailableUnits() {
    const quizData = loadQuizData();

    quizData.sections.forEach((section) => {
        section.units.forEach((unit) => {
            let totalQuestions = 0;
            unit.tasks.forEach(task => {
                totalQuestions += task.questions.length;
            });
        });
    });
}


// Main execution
if (process.argv.length === 2) {
    // No arguments provided, show available units
    showAvailableUnits();
} else if (process.argv.length === 5) {
    // Convert specific unit
    const courseId = process.argv[2];
    const sectionId = process.argv[3];
    const unitId = process.argv[4];

    convertUnitToBlackboard(courseId, sectionId, unitId);
} else {
    console.error('Usage: node convert_unit_to_blackboard.js <courseUid> <sectionId> <unitId>');
    console.error('If no arguments provided, shows available units with their IDs.');
    process.exit(1);
}