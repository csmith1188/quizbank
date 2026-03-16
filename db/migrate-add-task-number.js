/**
 * Add task_number column to tasks for existing databases and backfill from sort_order.
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
    if (await hasColumn('tasks', 'task_number')) {
        console.log('tasks.task_number already exists');
        return;
    }

    console.log('Adding task_number column to tasks...');
    await run('ALTER TABLE tasks ADD COLUMN task_number INTEGER');

    // Backfill existing rows: task_number = sort_order + 1
    console.log('Backfilling task_number from sort_order...');
    await run('UPDATE tasks SET task_number = sort_order + 1 WHERE task_number IS NULL');
    console.log('Done updating task_number.');
}

migrate()
    .then(() => { db.close(); console.log('Done.'); })
    .catch(err => { console.error(err); db.close(); process.exit(1); });

