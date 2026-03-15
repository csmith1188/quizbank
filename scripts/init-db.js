const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const sql = fs.readFileSync('./db/init.sql', 'utf-8');
const db = new sqlite3.Database('./db/database.db');

db.exec(sql, (err) => {
    if (err) {
        console.error('Error initializing database:', err);
    } else {
        console.log('Database initialized successfully');
    }
    db.close();
});

