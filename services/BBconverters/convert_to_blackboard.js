import fs from 'fs';
import resourceService from '../resource-service.js';

async function main() {
  // Initialize and fetch quiz data
  const allContentData = await resourceService.getResource(2, '/course');
  console.log('Quiz data loaded.');

  if (!allContentData?.courses?.length) {
    throw new Error('No courses found in data.');
  }

  const firstCourse = allContentData.courses[0];
  if (!firstCourse.sections?.length) throw new Error('No sections found in course.');

  const firstSection = firstCourse.sections[0];
  if (!firstSection.units?.length) throw new Error('No units found in section.');

  const firstUnit = firstSection.units[0];
  if (!firstUnit.tasks?.length) throw new Error('No tasks found in unit.');

  const firstTask = firstUnit.tasks[0];
  console.log(`Processing: ${firstCourse.name ?? 'COURSE'} > ${firstSection.name ?? 'SECTION'} > ${firstUnit.name ?? 'UNIT'} > ${firstTask.name ?? 'TASK'}`);
  console.log(`Number of questions: ${firstTask.questions?.length ?? 0}`);

  // Generate timestamp
  const now = new Date().toISOString().replace('T', ' ').replace('Z', 'Z');

  // Helper to escape XML
  const escapeXml = (text = '') =>
    String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  // Create Blackboard XML (robust)
  function createBlackboardXML(task) {
    const questionsArray = Array.isArray(task.questions) ? task.questions : (task.questions ? Object.values(task.questions) : []);
    // create question list entries
    const questionList = questionsArray
      .map((q, qi) => {
        const qId = q?.id ?? q?.uid ?? `auto_${qi + 1}`;
        return `    <QUESTION id="q${qId}" class="QUESTION_MULTIPLECHOICE" />`;
      })
      .join('\n');

    const questionsXml = questionsArray
      .map((q, qi) => {
        try {
          const qId = q?.id ?? q?.uid ?? `auto_${qi + 1}`;
          const qPrompt = q?.prompt ?? q?.text ?? q?.question ?? '';
          const qDescription = q?.description ?? '';

          // Normalize answers: array | object -> array of values
          let answersArray;
          if (Array.isArray(q.answers)) {
            answersArray = q.answers;
          } else if (q.answers && typeof q.answers === 'object') {
            // If it's an object map like { a: 'text', b: 'text' } or { id: { text: '...' } }
            // try to extract sensible values:
            const vals = Object.values(q.answers);
            // If values are primitives, use them directly; if objects, try to extract text property
            answersArray = vals.map(v => {
              if (v == null) return '';
              if (typeof v === 'string' || typeof v === 'number') return String(v);
              // If object, prefer `text`, `label`, or `value`
              return (v.text ?? v.label ?? v.value ?? '').toString();
            });
          } else {
            // missing or not usable
            console.warn(`Warning: question q${qId} has no usable answers. Creating an empty answer slot.`);
            answersArray = ['']; // minimal placeholder to avoid crashes
          }

          // Determine correct answer index robustly
          let correctIndex = null;
          if (typeof q.correctIndex === 'number') {
            correctIndex = q.correctIndex;
          } else if (typeof q.correctAnswer === 'number') {
            correctIndex = q.correctAnswer;
          } else if (typeof q.correctAnswer === 'string') {
            // Try to find by matching id-like string or exact text
            const idxById = answersArray.findIndex((ans, ai) => {
              // If answers were objects with ids earlier we converted them to text, so match exact text
              return ans === q.correctAnswer;
            });
            if (idxById >= 0) correctIndex = idxById;
            else {
              // maybe correctAnswer contains 'a1' style id
              const m = q.correctAnswer.match(/a?(\d+)/);
              if (m) {
                const parsed = parseInt(m[1], 10) - 1;
                if (!Number.isNaN(parsed) && parsed >= 0 && parsed < answersArray.length) correctIndex = parsed;
              }
            }
          }

          // Fallback: if no correctIndex, choose 0
          if (correctIndex == null || correctIndex < 0 || correctIndex >= answersArray.length) {
            correctIndex = 0;
          }

          // build answers XML
          const answersXml = answersArray
            .map((answerText, aIndex) => {
              const answerId = `q${qId}_a${aIndex + 1}`;
              return `    <ANSWER id="${answerId}" position="${aIndex + 1}">
      <DATES>
        <CREATED value="${now}" />
        <UPDATED value="${now}" />
      </DATES>
      <TEXT>${escapeXml(answerText ?? '')}</TEXT>
    </ANSWER>`;
            })
            .join('\n');

          const correctAnswerId = `q${qId}_a${correctIndex + 1}`;

          return `  <QUESTION_MULTIPLECHOICE id="q${qId}">
    <DATES>
      <CREATED value="${now}" />
      <UPDATED value="${now}" />
    </DATES>
    <BODY>
      <TEXT>${escapeXml(qPrompt)}</TEXT>
      <FLAGS value="true">
        <ISHTML value="true" />
        <ISNEWLINELITERAL />
      </FLAGS>
    </BODY>
${answersXml}
    <GRADABLE>
      <FEEDBACK_WHEN_CORRECT>Correct! Well done.</FEEDBACK_WHEN_CORRECT>
      <FEEDBACK_WHEN_INCORRECT>That's not correct. Please review the material and try again.</FEEDBACK_WHEN_INCORRECT>
      <CORRECTANSWER answer_id="${correctAnswerId}" />
    </GRADABLE>
  </QUESTION_MULTIPLECHOICE>`;
        } catch (qErr) {
          console.error(`Error processing question at index ${qi}:`, qErr);
          // Return a minimal question element so the export remains valid
          const fallbackId = q?.id ?? `failed_${qi + 1}`;
          return `  <QUESTION_MULTIPLECHOICE id="q${fallbackId}">
    <BODY><TEXT>QUESTION COULD NOT BE PROCESSED</TEXT></BODY>
  </QUESTION_MULTIPLECHOICE>`;
        }
      })
      .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<POOL>
  <COURSEID value="IMPORT" />
  <TITLE value="${escapeXml(task.name ?? 'Unnamed Task')}" />
  <DESCRIPTION>
    <TEXT>${escapeXml(task.description ?? '')}</TEXT>
  </DESCRIPTION>
  <DATES>
    <CREATED value="${now}" />
    <UPDATED value="${now}" />
  </DATES>
  <QUESTIONLIST>
${questionList}
  </QUESTIONLIST>
${questionsXml}
</POOL>`;
  }

  // Write Blackboard files
  const blackboardXML = createBlackboardXML(firstTask);
  fs.writeFileSync('blackboard_test.dat', blackboardXML);

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

  console.log('✅ Conversion complete!');
  console.log('Created:');
  console.log('- blackboard_test.dat');
  console.log('- imsmanifest.xml');
}

main().catch((err) => {
  console.error('❌ Error:', err.stack ?? err.message ?? err);
});