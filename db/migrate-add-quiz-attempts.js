const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.db');
const db = new sqlite3.Database(dbPath);

db.all('PRAGMA table_info(quiz_attempts)', (err, cols) => {
    if (err) {
        console.error('Error reading quiz_attempts schema:', err);
        db.close();
        process.exit(1);
    }
    const hasIsProgress = cols && cols.some(c => c.name === 'is_progress_quiz');
    const hasMetadata = cols && cols.some(c => c.name === 'metadata');
    const alterStmts = [];
    if (!hasIsProgress) {
        alterStmts.push('ALTER TABLE quiz_attempts ADD COLUMN is_progress_quiz INTEGER NOT NULL DEFAULT 0');
    }
    if (!hasMetadata) {
        alterStmts.push('ALTER TABLE quiz_attempts ADD COLUMN metadata TEXT');
    }
    const runNext = () => {
        const stmt = alterStmts.shift();
        if (!stmt) {
            console.log('quiz_attempts migration applied successfully.');
            db.close();
            return;
        }
        db.run(stmt, (e) => {
            if (e) console.error('Error running quiz_attempts ALTER:', e);
            runNext();
        });
    };
    runNext();
});

