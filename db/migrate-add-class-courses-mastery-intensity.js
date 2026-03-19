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
    const exists = await hasColumn('class_courses', 'mastery_intensity');
    if (exists) {
      console.log('class_courses.mastery_intensity already exists');
      return;
    }
    await run("ALTER TABLE class_courses ADD COLUMN mastery_intensity TEXT NOT NULL DEFAULT 'standard'");
    console.log('Added class_courses.mastery_intensity');
  } catch (err) {
    console.error('Error adding class_courses.mastery_intensity:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

migrate();

