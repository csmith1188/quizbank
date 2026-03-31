const { db, run } = require('../lib/db');

async function migrate() {
    console.log('Adding time column to questions table if missing...');
    try {
        await run('ALTER TABLE questions ADD COLUMN time INTEGER NOT NULL DEFAULT 30');
        console.log('Added time column to questions.');
    } catch (err) {
        if (err && /duplicate column name|already exists/i.test(err.message)) {
            console.log('time column already exists, skipping.');
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

