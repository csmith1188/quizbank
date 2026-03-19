const archiver = require('archiver');

function escapeXml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function getCurrentTimestamp() {
    return new Date().toISOString().replace('T', ' ').replace('Z', 'Z');
}

function createBlackboardXML(questions, quizTitle) {
    const timestamp = getCurrentTimestamp();

    const questionList = questions.map((q) =>
        `    <QUESTION id="q${q.id}" class="QUESTION_MULTIPLECHOICE" />`
    ).join('\n');

    const questionsXml = questions.map((q) => {
        const answers = (q.answers || []).map((answer, index) =>
            `    <ANSWER id="q${q.id}_a${index + 1}" position="${index + 1}">
      <DATES>
        <CREATED value="${timestamp}" />
        <UPDATED value="${timestamp}" />
      </DATES>
      <TEXT>${escapeXml(answer)}</TEXT>
    </ANSWER>`
        ).join('\n');

        const correctAnswerId = `q${q.id}_a${(q.correctIndex != null ? q.correctIndex : 0) + 1}`;

        return `  <QUESTION_MULTIPLECHOICE id="q${q.id}">
    <DATES>
      <CREATED value="${timestamp}" />
      <UPDATED value="${timestamp}" />
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
  <TITLE value="${escapeXml(quizTitle || 'Quiz Export')}" />
  <DESCRIPTION>
    <TEXT>${escapeXml(quizTitle || '')}</TEXT>
  </DESCRIPTION>
  <DATES>
    <CREATED value="${timestamp}" />
    <UPDATED value="${timestamp}" />
  </DATES>
  <QUESTIONLIST>
${questionList}
  </QUESTIONLIST>
${questionsXml}
</POOL>`;
}

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

function createQtiZip(questions, quizTitle) {
    return new Promise((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 9 } });
        const chunks = [];

        archive.on('data', (chunk) => chunks.push(chunk));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', reject);

        const blackboardXML = createBlackboardXML(questions, quizTitle);
        const manifestXML = createManifestXML('blackboard_quiz.dat');

        archive.append(blackboardXML, { name: 'blackboard_quiz.dat' });
        archive.append(manifestXML, { name: 'imsmanifest.xml' });

        archive.finalize();
    });
}

module.exports = { createQtiZip, escapeXml };
