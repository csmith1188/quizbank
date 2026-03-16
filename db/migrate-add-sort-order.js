/**
 * Add sort_order to: courses, tasks, questions, vocab_terms, quizzes.
 * Backfill with row number so existing order is preserved.
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
    const tables = [
        { table: 'courses', orderBy: 'id' },
        { table: 'tasks', orderBy: 'id' },
        { table: 'questions', orderBy: 'id' },
        { table: 'vocab_terms', orderBy: 'id' },
        { table: 'quizzes', orderBy: 'id' }
    ];
    for (const { table, orderBy } of tables) {
        const exists = await hasColumn(table, 'sort_order');
        if (exists) {
            console.log(table + ': sort_order already exists');
            continue;
        }
        await run('ALTER TABLE ' + table + ' ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
        console.log('Added sort_order to ' + table);
        const rows = await all('SELECT id FROM ' + table + ' ORDER BY ' + orderBy);
        for (let i = 0; i < rows.length; i++) {
            await run('UPDATE ' + table + ' SET sort_order = ? WHERE id = ?', [i, rows[i].id]);
        }
        console.log('Backfilled sort_order for ' + rows.length + ' rows in ' + table);
    }
}

migrate()
    .then(() => { db.close(); console.log('Done.'); })
    .catch(err => { console.error(err); db.close(); process.exit(1); });
