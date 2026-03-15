/**
 * Add description column to tasks for existing databases.
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'db', 'database.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function hasColumn(table, column) {
    const cols = await all('PRAGMA table_info(' + table + ')');
    return cols.some(c => c.name === column);
}

async function migrate() {
    if (await hasColumn('tasks', 'description')) {
        console.log('tasks.description already exists');
        return;
    }
    await run('ALTER TABLE tasks ADD COLUMN description TEXT');
    console.log('Added description to tasks');
}

migrate()
    .then(() => { db.close(); console.log('Done.'); })
    .catch(err => { console.error(err); db.close(); process.exit(1); });
