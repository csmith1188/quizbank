const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbPath = './db/database.db';

const schemaSql = `
CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    formbar_class_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    section VARCHAR(255),
    term VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS class_members (
    class_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL,
    PRIMARY KEY (class_id, user_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS class_courses (
    class_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    assigned_by INTEGER,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, course_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS class_quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    quiz_id INTEGER NOT NULL,
    assigned_by INTEGER,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_at DATETIME,
    title_override VARCHAR(255),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_class_members_user ON class_members(user_id);
CREATE INDEX IF NOT EXISTS idx_class_courses_class ON class_courses(class_id);
CREATE INDEX IF NOT EXISTS idx_class_quizzes_class ON class_quizzes(class_id);
CREATE INDEX IF NOT EXISTS idx_class_quizzes_quiz ON class_quizzes(quiz_id);
`;

if (!fs.existsSync(dbPath)) {
    console.error('Database file not found at', dbPath, '- run scripts/init-db.js first.');
    process.exit(1);
}

const db = new sqlite3.Database(dbPath);

db.exec(schemaSql, (err) => {
    if (err) {
        console.error('Error running classes migration:', err);
    } else {
        console.log('Classes migration applied successfully.');
    }
    db.close();
});

