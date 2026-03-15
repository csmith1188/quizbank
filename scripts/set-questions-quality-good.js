/**
 * One-off: set quality = 'good' for all questions where quality IS NULL.
 */
const { run, get } = require('../lib/db');

async function main() {
    const r = await get('SELECT COUNT(*) as c FROM questions WHERE quality IS NULL');
    console.log('Rows with quality NULL:', r.c);
    const result = await run("UPDATE questions SET quality = 'good' WHERE quality IS NULL");
    console.log('Updated', result.changes, 'rows');
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
