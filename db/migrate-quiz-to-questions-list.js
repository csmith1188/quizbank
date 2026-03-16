/**
 * Migrate quizzes from quiz_items (source rules + random at runtime) to quiz_questions (fixed list).
 * Resolves each quiz once using OLD quiz_items logic and stores the resulting question IDs. Then drops quiz_items.
 * Run this once before or after deploying the new quiz_questions-based code. Uses inline old resolve logic.
 */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
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

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function tableExists(name) {
    const rows = await all("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [name]);
    return rows.length > 0;
}

function getRandomItems(arr, count) {
    const n = Math.min(count, arr.length);
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

async function getQuestionsForUnit(unitId, courseId) {
    const taskIds = await all('SELECT task_id FROM unit_tasks WHERE unit_id = ? ORDER BY sort_order', [unitId]);
    const ids = taskIds.map(r => r.task_id);
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = await all(
        `SELECT q.id FROM questions q JOIN tasks t ON q.task_id = t.id WHERE q.task_id IN (${placeholders}) AND t.course_id = ?`,
        [...ids, courseId]
    );
    return rows.map(r => r.id);
}

async function getQuestionsForTask(taskId, courseId) {
    const rows = await all(
        'SELECT q.id FROM questions q JOIN tasks t ON q.task_id = t.id WHERE q.task_id = ? AND t.course_id = ?',
        [taskId, courseId]
    );
    return rows.map(r => r.id);
}

async function resolveQuizItemsToQuestionIds(quizId, courseId) {
    const items = await all('SELECT source_type, source_id, pick_mode, count, question_ids FROM quiz_items WHERE quiz_id = ? ORDER BY sort_order', [quizId]);
    const result = [];
    for (const item of items) {
        let ids = [];
        if (item.source_type === 'unit') {
            ids = await getQuestionsForUnit(item.source_id, courseId);
        } else if (item.source_type === 'task') {
            ids = await getQuestionsForTask(item.source_id, courseId);
        } else if (item.source_type === 'question') {
            const q = await get('SELECT q.id FROM questions q JOIN tasks t ON q.task_id = t.id WHERE q.id = ? AND t.course_id = ?', [item.source_id, courseId]);
            if (q) ids = [q.id];
        }
        const qids = item.question_ids ? (typeof item.question_ids === 'string' ? JSON.parse(item.question_ids) : item.question_ids) : null;
        if (item.pick_mode === 'all') {
            result.push(...ids);
        } else if (item.pick_mode === 'random' && item.count) {
            result.push(...getRandomItems(ids, parseInt(item.count)));
        } else if (item.pick_mode === 'specific' && Array.isArray(qids) && qids.length) {
            for (const qid of qids) {
                const q = await get('SELECT id FROM questions q JOIN tasks t ON q.task_id = t.id WHERE q.id = ? AND t.course_id = ?', [qid, courseId]);
                if (q) result.push(q.id);
            }
        } else {
            result.push(...ids);
        }
    }
    return result;
}

async function migrate() {
    const hasItems = await tableExists('quiz_items');
    if (!hasItems) {
        console.log('quiz_items table does not exist; nothing to migrate.');
        return;
    }

    await run(`
        CREATE TABLE IF NOT EXISTS quiz_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES questions(id)
        )
    `);
    await run('CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id)');
    console.log('quiz_questions table ready.');

    const quizzes = await all('SELECT id, course_id FROM quizzes');
    for (const quiz of quizzes) {
        const questionIds = await resolveQuizItemsToQuestionIds(quiz.id, quiz.course_id);
        for (let i = 0; i < questionIds.length; i++) {
            await run('INSERT INTO quiz_questions (quiz_id, question_id, sort_order) VALUES (?, ?, ?)',
                [quiz.id, questionIds[i], i]);
        }
        if (questionIds.length) console.log('Migrated quiz ' + quiz.id + ': ' + questionIds.length + ' questions.');
    }

    await run('DROP TABLE IF EXISTS quiz_items');
    console.log('Dropped quiz_items.');
}

migrate()
    .then(() => { db.close(); console.log('Done.'); })
    .catch(err => { console.error(err); db.close(); process.exit(1); });
