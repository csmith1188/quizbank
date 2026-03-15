const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../db/database.db');
const db = new sqlite3.Database(dbPath);

db.all('PRAGMA table_info(users)', (err, cols) => {
    if (err) {
        console.error(err);
        db.close();
        process.exit(1);
    }
    const hasFormbarId = cols && cols.some(c => c.name === 'formbar_id');
    if (hasFormbarId) {
        console.log('Column formbar_id already exists');
        db.close();
        return;
    }
    db.run('ALTER TABLE users ADD COLUMN formbar_id INTEGER', (err) => {
        if (err) console.error('Migration error:', err);
        else {
            console.log('Added formbar_id to users table');
            db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_formbar_id ON users(formbar_id)', (e) => {
                if (e) console.log('Note: unique index on formbar_id skipped:', e.message);
            });
        }
        db.close();
    });
});
