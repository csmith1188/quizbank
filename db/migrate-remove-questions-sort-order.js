/**
 * Remove sort_order from questions table.
 * Uses table recreate for compatibility with older SQLite.
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
    const hasSortOrder = await hasColumn('questions', 'sort_order');
    if (!hasSortOrder) {
        console.log('questions: sort_order already removed');
        return;
    }
    await run(`CREATE TABLE questions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        correct_index INTEGER NOT NULL,
        answers TEXT NOT NULL,
        quality TEXT,
        quality_reason TEXT,
        ai INTEGER DEFAULT 0,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
    )`);
    await run('INSERT INTO questions_new (id, task_id, prompt, correct_answer, correct_index, answers, quality, quality_reason, ai) SELECT id, task_id, prompt, correct_answer, correct_index, answers, quality, quality_reason, ai FROM questions');
    await run('DROP TABLE questions');
    await run('ALTER TABLE questions_new RENAME TO questions');
    await run('CREATE INDEX IF NOT EXISTS idx_questions_task ON questions(task_id)');
    console.log('Removed sort_order from questions table');
}

migrate()
    .then(() => { db.close(); console.log('Done.'); })
    .catch(err => { console.error(err); db.close(); process.exit(1); });
