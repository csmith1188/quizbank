const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.db');
const db = new sqlite3.Database(dbPath);

const migrationSql = `
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS task_mastery_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    mastery REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    UNIQUE(user_id, course_id, task_id)
);

INSERT INTO task_mastery_new (id, user_id, course_id, task_id, mastery)
SELECT id, user_id, course_id, task_id, mastery
FROM task_mastery;

DROP TABLE task_mastery;
ALTER TABLE task_mastery_new RENAME TO task_mastery;

CREATE INDEX IF NOT EXISTS idx_task_mastery_user_course_task ON task_mastery(user_id, course_id, task_id);

COMMIT;
`;

db.exec(migrationSql, (err) => {
    if (err) {
        console.error('Error running drop task_mastery attempts/correct migration:', err);
    } else {
        console.log('task_mastery attempts/correct columns dropped successfully.');
    }
    db.close();
});

