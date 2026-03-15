const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.db');
const db = new sqlite3.Database(dbPath);

db.all('PRAGMA table_info(classes)', async (err, cols) => {
    if (err) {
        console.error(err);
        db.close();
        process.exit(1);
    }
    const hasSortOrder = cols && cols.some(c => c.name === 'sort_order');
    if (hasSortOrder) {
        console.log('Column sort_order already exists on classes');
        db.close();
        return;
    }
    db.run('ALTER TABLE classes ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0', (e) => {
        if (e) {
            console.error('Migration error (adding sort_order to classes):', e);
            db.close();
            return;
        }
        db.all('SELECT id FROM classes ORDER BY id', (e2, rows) => {
            if (e2) {
                console.error('Error reading classes for sort_order initialization:', e2);
                db.close();
                return;
            }
            let pending = rows.length;
            if (!pending) {
                console.log('Added sort_order to classes (no existing rows to update).');
                db.close();
                return;
            }
            rows.forEach((row, idx) => {
                db.run('UPDATE classes SET sort_order = ? WHERE id = ?', [idx, row.id], (e3) => {
                    if (e3) console.error('Error updating sort_order for class', row.id, e3);
                    pending -= 1;
                    if (!pending) {
                        console.log('Added sort_order to classes and initialized values.');
                        db.close();
                    }
                });
            });
        });
    });
});

