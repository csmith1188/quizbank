const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '../db/database.db');
const jsonPath = path.join(__dirname, '../imports/NOCTI.json');

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function getOrCreateOwner() {
    let row = await get('SELECT id FROM users LIMIT 1');
    if (row) return row.id;
    await run('INSERT INTO users (username, formbar_id) VALUES (?, ?)', ['import-user', null]);
    row = await get('SELECT id FROM users WHERE username = ?', ['import-user']);
    return row.id;
}

async function import9th() {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const ownerId = await getOrCreateOwner();

    await run(
        'INSERT INTO courses (owner_id, name, is_public) VALUES (?, ?, 1)',
        [ownerId, data.name]
    );
    const courseRow = await get('SELECT id FROM courses ORDER BY id DESC LIMIT 1');
    const courseId = courseRow.id;

    const unitRows = [];
    let sortOrder = 0;
    for (const section of data.sections || []) {
        for (const unit of section.units || []) {
            await run(
                'INSERT INTO units (course_id, name, sort_order) VALUES (?, ?, ?)',
                [courseId, unit.name, sortOrder++]
            );
            const u = await get('SELECT id FROM units ORDER BY id DESC LIMIT 1');
            unitRows.push({ id: u.id, unit });
        }
    }

    const vocabSeen = new Set();
    const termToId = {};
    for (const section of data.sections || []) {
        for (const unit of section.units || []) {
            for (const task of unit.tasks || []) {
                for (const term of task.vocab || []) {
                    if (vocabSeen.has(term)) continue;
                    vocabSeen.add(term);
                    await run(
                        'INSERT INTO vocab_terms (course_id, term) VALUES (?, ?)',
                        [courseId, term]
                    );
                    const v = await get('SELECT id FROM vocab_terms ORDER BY id DESC LIMIT 1');
                    termToId[term] = v.id;
                }
            }
        }
    }

    let unitIndex = 0;
    for (const section of data.sections || []) {
        for (const unit of section.units || []) {
            const unitId = unitRows[unitIndex].id;
            let taskOrder = 0;
            for (const task of unit.tasks || []) {
                await run(
                    'INSERT INTO tasks (course_id, name, target) VALUES (?, ?, ?)',
                    [courseId, task.name, task.target || null]
                );
                const t = await get('SELECT id FROM tasks ORDER BY id DESC LIMIT 1');
                const taskId = t.id;

                for (const q of task.questions || []) {
                    await run(
                        'INSERT INTO questions (task_id, prompt, correct_answer, correct_index, answers, ai) VALUES (?, ?, ?, ?, ?, ?)',
                        [
                            taskId,
                            q.prompt,
                            q.correctAnswer || '',
                            q.correctIndex ?? 0,
                            JSON.stringify(q.answers || []),
                            q.ai ? 1 : 0
                        ]
                    );
                }

                await run(
                    'INSERT OR IGNORE INTO unit_tasks (unit_id, task_id, sort_order) VALUES (?, ?, ?)',
                    [unitId, taskId, taskOrder++]
                );
            }
            unitIndex++;
        }
    }

    unitIndex = 0;
    for (const section of data.sections || []) {
        for (const unit of section.units || []) {
            const unitId = unitRows[unitIndex].id;
            const vocabSet = new Set();
            for (const task of unit.tasks || []) {
                for (const term of task.vocab || []) vocabSet.add(term);
            }
            let vo = 0;
            for (const term of vocabSet) {
                const vid = termToId[term];
                if (vid) {
                    await run(
                        'INSERT OR IGNORE INTO unit_vocab (unit_id, vocab_term_id, sort_order) VALUES (?, ?, ?)',
                        [unitId, vid, vo++]
                    );
                }
            }
            unitIndex++;
        }
    }

    console.log('Import complete. Course id:', courseId);
}

import9th()
    .then(() => db.close())
    .catch((err) => {
        console.error(err);
        db.close();
        process.exit(1);
    });
