/**
 * Add definition column to vocab_terms for existing databases.
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
    if (await hasColumn('vocab_terms', 'definition')) {
        console.log('vocab_terms.definition already exists');
        return;
    }
    await run('ALTER TABLE vocab_terms ADD COLUMN definition TEXT');
    console.log('Added definition to vocab_terms');
}

migrate()
    .then(() => { db.close(); console.log('Done.'); })
    .catch(err => { console.error(err); db.close(); process.exit(1); });
