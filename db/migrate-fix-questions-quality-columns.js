const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function hasColumn(table, column) {
  const cols = await all('PRAGMA table_info(' + table + ')');
  return cols.some((c) => c.name === column);
}

async function migrate() {
  try {
    if (!(await hasColumn('questions', 'quality'))) {
      await run('ALTER TABLE questions ADD COLUMN quality TEXT');
      console.log('Added questions.quality');
    } else {
      console.log('questions.quality already exists');
    }

    if (!(await hasColumn('questions', 'quality_reason'))) {
      await run('ALTER TABLE questions ADD COLUMN quality_reason TEXT');
      console.log('Added questions.quality_reason');
    } else {
      console.log('questions.quality_reason already exists');
    }
  } catch (err) {
    console.error('Error fixing questions quality columns:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

migrate();

