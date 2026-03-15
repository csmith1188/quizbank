const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.db');
const db = new sqlite3.Database(dbPath);

const schemaSql = `
CREATE TABLE IF NOT EXISTS task_mastery (
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

CREATE INDEX IF NOT EXISTS idx_task_mastery_user_course_task ON task_mastery(user_id, course_id, task_id);
`;

db.exec(schemaSql, (err) => {
    if (err) {
        console.error('Error running task_mastery migration:', err);
    } else {
        console.log('task_mastery migration applied successfully.');
    }
    db.close();
});

