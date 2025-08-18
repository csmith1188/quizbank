const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Read the JSON file
const hierarchyData = JSON.parse(fs.readFileSync(path.join(__dirname, '../quizsources/10th.json'), 'utf8'));

// Create/connect to the database
const db = new sqlite3.Database('quizbank.db');

// Create tables
db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Create courses table
    db.run(`CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
    )`);

    // Create sections table
    db.run(`CREATE TABLE IF NOT EXISTS sections (
        id INTEGER PRIMARY KEY,
        course_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY (course_id) REFERENCES courses(id)
    )`);

    // Create units table
    db.run(`CREATE TABLE IF NOT EXISTS units (
        id INTEGER PRIMARY KEY,
        section_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY (section_id) REFERENCES sections(id)
    )`);

    // Create tasks table
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY,
        unit_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY (unit_id) REFERENCES units(id)
    )`);

    // Create questions table with answers as JSON
    db.run(`CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY,
        task_id INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        correct_index INTEGER NOT NULL,
        ai BOOLEAN NOT NULL,
        answers TEXT NOT NULL, -- JSON array of answers
        FOREIGN KEY (task_id) REFERENCES tasks(id)
    )`);

    // Insert course
    db.run('INSERT INTO courses (id, name) VALUES (?, ?)',
        [hierarchyData.id, hierarchyData.name]);

    // Insert sections
    hierarchyData.sections.forEach(section => {
        db.run('INSERT INTO sections (id, course_id, name) VALUES (?, ?, ?)',
            [section.id, hierarchyData.id, section.name]);

        // Insert units
        section.units.forEach(unit => {
            db.run('INSERT INTO units (id, section_id, name) VALUES (?, ?, ?)',
                [unit.id, section.id, unit.name]);

            // Insert tasks
            unit.tasks.forEach(task => {
                db.run('INSERT INTO tasks (id, unit_id, name) VALUES (?, ?, ?)',
                    [task.id, unit.id, task.name]);

                // Insert questions with answers as JSON
                task.questions.forEach(question => {
                    db.run('INSERT INTO questions (id, task_id, prompt, correct_answer, correct_index, ai, answers) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [
                            question.id,
                            task.id,
                            question.prompt,
                            question.correctAnswer,
                            question.correctIndex,
                            question.ai,
                            JSON.stringify(question.answers) // Store answers as JSON string
                        ]);
                });
            });
        });
    });
});

// Close the database connection
db.close((err) => {
    if (err) {
        console.error('Error closing database:', err.message);
    } else {
        console.log('Database created successfully!');
    }
}); 