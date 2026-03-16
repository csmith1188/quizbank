const { db, run } = require('../lib/db');

async function migrate() {
    console.log('Adding quality_reason column to questions table if missing...');
    try {
        await run('ALTER TABLE questions ADD COLUMN quality_reason TEXT');
        console.log('Added quality_reason column to questions.');
    } catch (err) {
        if (err && /duplicate column name|already exists/i.test(err.message)) {
            console.log('quality_reason column already exists, skipping.');
        } else {
            throw err;
        }
    }
}

migrate()
    .then(() => {
        db.close();
        console.log('Done.');
    })
    .catch((err) => {
        console.error(err);
        db.close();
        process.exit(1);
    });

