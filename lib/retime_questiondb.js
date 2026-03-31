const { all, run, db } = require('../lib/db');
const { getQuestionTime } = require('../lib/question-time-limit');

async function main() {
  try {
    await run('BEGIN TRANSACTION');

    const rows = await all('SELECT id, prompt, answers FROM questions');
    for (const row of rows) {
      const answers = typeof row.answers === 'string'
        ? JSON.parse(row.answers || '[]')
        : (row.answers || []);
      const time = getQuestionTime(row.prompt || '', answers);
      await run('UPDATE questions SET time = ? WHERE id = ?', [time, row.id]);
    }

    await run('COMMIT');
    console.log(`Updated ${rows.length} questions.`);
  } catch (err) {
    await run('ROLLBACK');
    console.error('Failed, rolled back:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();