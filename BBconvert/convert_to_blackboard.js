const fs = require('fs');

// Read the 10th.json file
const quizData = JSON.parse(fs.readFileSync('quizsources/10th.json', 'utf8'));

// Get the first task (Documentation)
const firstSection = quizData.sections[0];
const firstUnit = firstSection.units[0];
const firstTask = firstUnit.tasks[0]; // Documentation task

console.log(`Converting task: ${firstTask.name}`);
console.log(`Number of questions: ${firstTask.questions.length}`);

// Generate current timestamp in Blackboard format
const now = new Date().toISOString().replace('T', ' ').replace('Z', 'Z');

// Create Blackboard XML content
function createBlackboardXML(task) {
    const questionList = task.questions.map((q, index) => 
        `    <QUESTION id="q${q.id}" class="QUESTION_MULTIPLECHOICE" />`
    ).join('\n');

    const questions = task.questions.map((q, index) => {
        const answers = q.answers.map((answer, aIndex) => {
            const isCorrect = answer === q.correctAnswer;
            return `    <ANSWER id="q${q.id}_a${aIndex + 1}" position="${aIndex + 1}">
      <DATES>
        <CREATED value="${now}" />
        <UPDATED value="${now}" />
      </DATES>
      <TEXT>${escapeXml(answer)}</TEXT>
    </ANSWER>`;
        }).join('\n');

        const correctAnswerId = `q${q.id}_a${q.correctIndex + 1}`;

        return `  <QUESTION_MULTIPLECHOICE id="q${q.id}">
    <DATES>
      <CREATED value="${now}" />
      <UPDATED value="${now}" />
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
    <CREATED value="${now}" />
    <UPDATED value="${now}" />
  </DATES>
  <QUESTIONLIST>
${questionList}
  </QUESTIONLIST>
${questions}
</POOL>`;
}

// Helper function to escape XML special characters
function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Create the Blackboard XML
const blackboardXML = createBlackboardXML(firstTask);

// Write to file
fs.writeFileSync('blackboard_test.dat', blackboardXML);

// Also create the manifest file
const manifestXML = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="man00001">
  <organization default="toc00001">
    <tableofcontents identifier="toc00001"/>
  </organization>
  <resources>
    <resource baseurl="res00001" file="blackboard_test.dat" identifier="res00001" type="assessment/x-bb-pool"/>
  </resources>
</manifest>`;

fs.writeFileSync('imsmanifest.xml', manifestXML);

console.log('Conversion complete!');
console.log('Files created:');
console.log('- blackboard_test.dat (main test file)');
console.log('- imsmanifest.xml (manifest file)');
console.log('');
console.log('You can now import these files into Blackboard.');