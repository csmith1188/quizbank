const express = require('express');
const { get, all, run } = require('../lib/db');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { syncClassesForUser } = require('../lib/formbar-classes');
const {
    getOrCreateActiveAttempt,
    getAttemptQuestions,
    gradeAttempt,
    getBreakdown,
    getCoachContext
} = require('../lib/quiz-attempts');
const { getImprovementPlan } = require('../lib/ai-coach');
const multer = require('multer');

const router = express.Router();

function isTeacher(req) {
    const token = req.session && req.session.token ? req.session.token : {};
    const perms = typeof token.permissions === 'number' ? token.permissions : null;
    return perms != null && perms >= 4;
}

function requireTeacher(req, res, next) {
    if (!isTeacher(req)) {
        return res.redirect('/classes');
    }
    next();
}

async function requireCourseOwner(req, res, next) {
    const courseId = parseInt(req.params.courseId || req.params.id);
    if (!courseId) return res.redirect('/courses');
    const course = await get('SELECT id, owner_id, name, is_public FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.redirect('/courses');
    const userId = req.session.userId;
    const importUser = await get('SELECT id FROM users WHERE username = ?', ['import-user']);
    const isImportCourse = importUser && course.owner_id === importUser.id;
    if (!userId) return res.redirect('/courses');
    if (parseInt(userId) !== course.owner_id) {
        if (isImportCourse) {
            await run('UPDATE courses SET owner_id = ? WHERE id = ?', [userId, courseId]);
            req.course = { ...course, owner_id: parseInt(userId) };
        } else return res.redirect('/courses');
    } else req.course = course;
    req.courseId = courseId;
    next();
}

function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

// All /courses routes are teacher-only (except explicit student routes added later)
router.use('/courses', (req, res, next) => {
    // Allow student mastery/progress/overall routes to pass through; they do their own checks
    if (req.method === 'GET' && /^\/\d+\/mastery$/.test(req.path)) return next();
    if (req.method === 'GET' && /^\/\d+\/mastery\/coach$/.test(req.path)) return next();
    if (req.method === 'POST' && /^\/\d+\/progress-test/.test(req.path)) return next();
    if (req.method === 'POST' && /^\/\d+\/overall-test/.test(req.path)) return next();
    return requireTeacher(req, res, next);
});

router.get('/courses', requireTeacher, async (req, res) => {
    const userId = req.session.userId;
    let courses = await all('SELECT id, name, is_public, sort_order, created_at FROM courses WHERE owner_id = ? ORDER BY sort_order, id', [userId]);
    if (courses.length === 0) {
        const importUser = await get('SELECT id FROM users WHERE username = ?', ['import-user']);
        if (importUser) {
            courses = await all('SELECT id, name, is_public, sort_order, created_at FROM courses WHERE owner_id = ? ORDER BY sort_order, id', [importUser.id]);
        }
    }
    if (courses.length > 0) {
        const courseIds = courses.map(c => c.id);
        const placeholders = courseIds.map(() => '?').join(',');
        const [taskCounts, unitCounts, vocabCounts, quizCounts] = await Promise.all([
            all('SELECT course_id, COUNT(*) as c FROM tasks WHERE course_id IN (' + placeholders + ') GROUP BY course_id', courseIds),
            all('SELECT course_id, COUNT(*) as c FROM units WHERE course_id IN (' + placeholders + ') GROUP BY course_id', courseIds),
            all('SELECT course_id, COUNT(*) as c FROM vocab_terms WHERE course_id IN (' + placeholders + ') GROUP BY course_id', courseIds),
            all('SELECT course_id, COUNT(*) as c FROM quizzes WHERE course_id IN (' + placeholders + ') GROUP BY course_id', courseIds)
        ]);
        const byCourse = (rows, key) => {
            const o = {};
            (rows || []).forEach(r => { o[r[key]] = r.c; });
            return o;
        };
        const taskBy = byCourse(taskCounts, 'course_id');
        const unitBy = byCourse(unitCounts, 'course_id');
        const vocabBy = byCourse(vocabCounts, 'course_id');
        const quizBy = byCourse(quizCounts, 'course_id');
        courses = courses.map(c => ({
            ...c,
            taskCount: taskBy[c.id] || 0,
            unitCount: unitBy[c.id] || 0,
            vocabCount: vocabBy[c.id] || 0,
            quizCount: quizBy[c.id] || 0
        }));
    }
    res.render('teacher/courses', { user: req.session.user, courses });
});

// Simple in-memory import storage keyed by a random token
const importStore = new Map();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function generateImportToken() {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

router.get('/courses/:courseId/import', requireCourseOwner, (req, res) => {
    res.render('teacher/import-form', {
        user: req.session.user,
        course: req.course,
        error: null
    });
});

router.post('/courses/:courseId/import', requireCourseOwner, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.render('teacher/import-form', {
            user: req.session.user,
            course: req.course,
            error: 'Please upload an .xlsx file using the provided template.'
        });
    }
    const filename = req.file.originalname || '';
    if (!/\.xlsx$/i.test(filename)) {
        return res.render('teacher/import-form', {
            user: req.session.user,
            course: req.course,
            error: 'Only .xlsx files generated from the template are supported right now.'
        });
    }

    let workbook;
    try {
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
    } catch (err) {
        console.error('Import parse error:', err);
        return res.render('teacher/import-form', {
            user: req.session.user,
            course: req.course,
            error: 'Could not read this Excel file. Please make sure it matches the template.'
        });
    }

    const sheets = [];

    function collectRows(sheet) {
        if (!sheet) return { headers: [], rows: [] };
        const headerRow = sheet.getRow(1);
        const headers = [];
        headerRow.eachCell((cell, colNumber) => {
            const v = (cell.value || '').toString().trim();
            headers[colNumber - 1] = v;
        });
        const rows = [];
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const values = {};
            let nonEmpty = false;
            headers.forEach((h, idx) => {
                const cell = row.getCell(idx + 1);
                let v = cell.value;
                if (v && typeof v === 'object' && v.text) v = v.text;
                if (v == null) v = '';
                v = v.toString().trim();
                if (v !== '') nonEmpty = true;
                values[h || ('col' + (idx + 1))] = v;
            });
            if (nonEmpty) {
                rows.push({ rowNumber, values });
            }
        });
        return { headers, rows };
    }

    const sheet1 = workbook.worksheets[0];
    const sheet2 = workbook.worksheets[1];
    const sheet3 = workbook.worksheets[2];

    if (sheet1) {
        const data = collectRows(sheet1);
        if (data.rows.length) {
            sheets.push({
                index: 1,
                name: sheet1.name,
                type: 'structure',
                headers: data.headers,
                rows: data.rows
            });
        }
    }
    if (sheet2) {
        const data = collectRows(sheet2);
        if (data.rows.length) {
            sheets.push({
                index: 2,
                name: sheet2.name,
                type: 'vocab',
                headers: data.headers,
                rows: data.rows
            });
        }
    }
    if (sheet3) {
        const data = collectRows(sheet3);
        if (data.rows.length) {
            sheets.push({
                index: 3,
                name: sheet3.name,
                type: 'questions',
                headers: data.headers,
                rows: data.rows
            });
        }
    }

    if (!sheets.length) {
        return res.render('teacher/import-form', {
            user: req.session.user,
            course: req.course,
            error: 'No data rows were found in any sheet. Please add data before uploading.'
        });
    }

    const token = generateImportToken();
    importStore.set(token, {
        courseId: req.courseId,
        uploadedAt: Date.now(),
        sheets
    });

    res.render('teacher/import-review', {
        user: req.session.user,
        course: req.course,
        token,
        sheets
    });
});

router.post('/courses/:courseId/import/confirm', requireCourseOwner, async (req, res) => {
    const token = (req.body && req.body.token) || '';
    const includeStructure = !!(req.body && req.body.include_structure);
    const includeVocab = !!(req.body && req.body.include_vocab);
    const includeQuestions = !!(req.body && req.body.include_questions);

    const stored = importStore.get(token);
    if (!stored || stored.courseId !== req.courseId) {
        return res.render('teacher/import-form', {
            user: req.session.user,
            course: req.course,
            error: 'Import session expired. Please upload the template again.'
        });
    }

    // Clean up the token once used
    importStore.delete(token);

    const results = [];
    const taskKeyToTaskId = new Map(); // user Task ID/Number from Course sheet -> DB task id

    function addResultForType(type, name, status, stats) {
        results.push({
            type,
            name,
            status,
            inserted: (stats && stats.inserted) || 0,
            updated: (stats && stats.updated) || 0,
            duplicates: (stats && stats.duplicates) || 0,
            total: (stats && stats.total) || 0,
            errors: (stats && stats.errors) || []
        });
    }

    function normalizeKey(s) {
        return (s || '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    function getField(values, aliases) {
        const keys = Object.keys(values || {});
        const want = aliases.map(normalizeKey);
        for (const key of keys) {
            const nk = normalizeKey(key);
            if (want.includes(nk)) {
                return values[key];
            }
        }
        return '';
    }

    async function withTransaction(fn) {
        await run('BEGIN');
        try {
            const result = await fn();
            await run('COMMIT');
            return result;
        } catch (err) {
            try {
                await run('ROLLBACK');
            } catch (e) {
                // ignore rollback errors
            }
            throw err;
        }
    }

    async function importStructureSheet(sheet) {
        const stats = {
            inserted: 0,
            updated: 0,
            duplicates: 0,
            total: sheet.rows.length,
            errors: []
        };

        if (!sheet.headers || !sheet.headers.length || !sheet.rows.length) {
            stats.errors.push({
                rowNumber: 1,
                message: 'Sheet appears to have no headers or data rows.'
            });
            return { status: 'failed', stats };
        }

        const hasTaskName = sheet.headers.some(h => normalizeKey(h) === normalizeKey('Task Name'));
        if (!hasTaskName) {
            stats.errors.push({
                rowNumber: 1,
                message: 'Required column "Task Name" is missing.'
            });
            return { status: 'failed', stats };
        }

        const rowErrors = [];
        sheet.rows.forEach(r => {
            const values = r.values || {};
            const taskName = getField(values, ['Task Name']);
            if (!taskName) {
                rowErrors.push({
                    rowNumber: r.rowNumber,
                    message: 'Task Name is required.'
                });
            }
        });

        if (rowErrors.length) {
            stats.errors = rowErrors;
            return { status: 'failed', stats };
        }

        try {
            await withTransaction(async () => {
                for (const r of sheet.rows) {
                    const values = r.values || {};
                    const taskKeyRaw = getField(values, ['Task ID', 'Task Number']);
                    const unitName = getField(values, ['Unit Name']);
                    const taskName = getField(values, ['Task Name']);
                    const taskTarget = getField(values, ['Task Target', 'Target']);

                    let unitId = null;
                    if (unitName) {
                        const existingUnit = await get(
                            'SELECT id FROM units WHERE course_id = ? AND name = ?',
                            [req.courseId, unitName]
                        );
                        if (existingUnit) {
                            unitId = existingUnit.id;
                        } else {
                            const maxOrder = await get(
                                'SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM units WHERE course_id = ?',
                                [req.courseId]
                            );
                            await run(
                                'INSERT INTO units (course_id, name, sort_order) VALUES (?, ?, ?)',
                                [req.courseId, unitName, maxOrder.n]
                            );
                            const row = await get(
                                'SELECT id FROM units WHERE course_id = ? AND name = ? ORDER BY id DESC LIMIT 1',
                                [req.courseId, unitName]
                            );
                            unitId = row ? row.id : null;
                            stats.inserted += 1;
                        }
                    }

                    const task = await get(
                        'SELECT id, name, target FROM tasks WHERE course_id = ? AND name = ? AND (target IS ? OR target = ?)',
                        [req.courseId, taskName, taskTarget || null, taskTarget || null]
                    );

                    let taskId;
                    if (task) {
                        // Treat as duplicate if identical; we do not change existing tasks here.
                        stats.duplicates += 1;
                        taskId = task.id;
                    } else {
                        const maxOrderTask = await get(
                            'SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM tasks WHERE course_id = ?',
                            [req.courseId]
                        );
                        await run(
                            'INSERT INTO tasks (course_id, name, target, sort_order) VALUES (?, ?, ?, ?)',
                            [req.courseId, taskName, taskTarget || null, maxOrderTask.n]
                        );
                        const row = await get(
                            'SELECT id FROM tasks WHERE course_id = ? AND name = ? ORDER BY id DESC LIMIT 1',
                            [req.courseId, taskName]
                        );
                        taskId = row ? row.id : null;
                        stats.inserted += 1;
                    }

                    // Record mapping from user Task ID/Number (from Course sheet) to DB task id
                    if (taskKeyRaw && taskId) {
                        const key = taskKeyRaw.toString().trim();
                        if (key) {
                            taskKeyToTaskId.set(key, taskId);
                        }
                    }

                    if (unitId && taskId) {
                        await run(
                            'INSERT OR IGNORE INTO unit_tasks (unit_id, task_id, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM unit_tasks WHERE unit_id = ?))',
                            [unitId, taskId, unitId]
                        );
                    }
                }
            });
        } catch (err) {
            console.error('Error importing structure sheet:', err);
            stats.errors.push({
                rowNumber: 1,
                message: 'Unexpected error while writing data: ' + (err.message || err.toString())
            });
            return { status: 'failed', stats };
        }

        return { status: 'ok', stats };
    }

    async function importVocabSheet(sheet) {
        const stats = {
            inserted: 0,
            updated: 0,
            duplicates: 0,
            total: sheet.rows.length,
            errors: []
        };

        if (!sheet.headers || !sheet.headers.length || !sheet.rows.length) {
            stats.errors.push({
                rowNumber: 1,
                message: 'Sheet appears to have no headers or data rows.'
            });
            return { status: 'failed', stats };
        }

        const hasTerm = sheet.headers.some(h => normalizeKey(h) === normalizeKey('Word') || normalizeKey(h) === normalizeKey('Term'));
        if (!hasTerm) {
            stats.errors.push({
                rowNumber: 1,
                message: 'Required column "Word" (or Term) is missing.'
            });
            return { status: 'failed', stats };
        }
        const hasTaskRef = sheet.headers.some(
            h => normalizeKey(h) === normalizeKey('Task ID') || normalizeKey(h) === normalizeKey('Task Number')
        );

        const rowErrors = [];
        sheet.rows.forEach(r => {
            const values = r.values || {};
            const term = getField(values, ['Word', 'Term']);
            if (!term) {
                rowErrors.push({
                    rowNumber: r.rowNumber,
                    message: 'Vocab word is required.'
                });
            }

            if (hasTaskRef) {
                const taskKeyRaw = getField(values, ['Task ID', 'Task Number']);
                const key = (taskKeyRaw || '').toString().trim();
                if (key) {
                    // When a task identifier is present on the vocab sheet, it should
                    // correspond to a Task ID defined on the Course sheet (preferred)
                    // or, if not present there, to an existing task name in the course.
                    let taskId = taskKeyToTaskId.get(key) || null;
                    if (!taskId) {
                        // Fallback: interpret the key as a task name.
                        rowErrors.push({
                            rowNumber: r.rowNumber,
                            message:
                                'Task identifier "' +
                                key +
                                '" does not match any Task ID from the Course sheet. It is treated as a label only for now.'
                        });
                    }
                }
            }
        });

        if (rowErrors.length) {
            stats.errors = rowErrors;
            return { status: 'failed', stats };
        }

        try {
            await withTransaction(async () => {
                for (const r of sheet.rows) {
                    const values = r.values || {};
                    const term = getField(values, ['Word', 'Term']);
                    let definition = getField(values, ['Definition', 'Meaning']);
                    definition = (definition || '').trim();

                    const existing = await get(
                        'SELECT id FROM vocab_terms WHERE course_id = ? AND term = ?',
                        [req.courseId, term]
                    );
                    if (existing) {
                        await run(
                            'UPDATE vocab_terms SET definition = ? WHERE id = ?',
                            [definition || null, existing.id]
                        );
                        stats.updated += 1;
                    } else {
                        const maxOrder = await get(
                            'SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM vocab_terms WHERE course_id = ?',
                            [req.courseId]
                        );
                        await run(
                            'INSERT INTO vocab_terms (course_id, term, definition, sort_order) VALUES (?, ?, ?, ?)',
                            [req.courseId, term, definition || null, maxOrder.n]
                        );
                        stats.inserted += 1;
                    }
                }
            });
        } catch (err) {
            console.error('Error importing vocab sheet:', err);
            stats.errors.push({
                rowNumber: 1,
                message: 'Unexpected error while writing data: ' + (err.message || err.toString())
            });
            return { status: 'failed', stats };
        }

        return { status: 'ok', stats };
    }

    async function importQuestionsSheet(sheet) {
        const stats = {
            inserted: 0,
            updated: 0,
            duplicates: 0,
            total: sheet.rows.length,
            errors: []
        };

        if (!sheet.headers || !sheet.headers.length || !sheet.rows.length) {
            stats.errors.push({
                rowNumber: 1,
                message: 'Sheet appears to have no headers or data rows.'
            });
            return { status: 'failed', stats };
        }

        const hasTaskId = sheet.headers.some(h => normalizeKey(h) === normalizeKey('Task ID') || normalizeKey(h) === normalizeKey('Task Number'));
        const hasPrompt = sheet.headers.some(h => normalizeKey(h) === normalizeKey('Question') || normalizeKey(h) === normalizeKey('Prompt'));
        if (!hasTaskId || !hasPrompt) {
            stats.errors.push({
                rowNumber: 1,
                message: 'Required columns "Task ID/Task Number" and "Question" (or Prompt) are missing.'
            });
            return { status: 'failed', stats };
        }

        // Resolve a task from the user-provided task identifier.
        // First, prefer Task IDs defined on the Course import sheet (taskKeyToTaskId).
        // If not found there, treat the key as either a numeric DB id/1-based number
        // or a task name within this course.
        const taskCache = new Map();

        async function resolveTaskId(taskKeyRaw) {
            const key = (taskKeyRaw || '').toString().trim();
            if (!key) return null;
            if (taskCache.has(key)) return taskCache.get(key);

            // Prefer mapping established from the Course sheet
            let mapped = taskKeyToTaskId.get(key) || null;
            if (mapped) {
                taskCache.set(key, mapped);
                return mapped;
            }

            let row = null;

            // Try numeric interpretations first: DB id or sort_order-based "task number"
            const n = parseInt(key, 10);
            if (!Number.isNaN(n)) {
                row = await get(
                    'SELECT id FROM tasks WHERE id = ? AND course_id = ?',
                    [n, req.courseId]
                );
                if (!row) {
                    // Treat n as 1-based task number mapped to sort_order
                    const sortOrder = n > 0 ? n - 1 : n;
                    row = await get(
                        'SELECT id FROM tasks WHERE sort_order = ? AND course_id = ?',
                        [sortOrder, req.courseId]
                    );
                }
            }

            // Fallback: match by task name
            if (!row) {
                row = await get(
                    'SELECT id FROM tasks WHERE name = ? AND course_id = ?',
                    [key, req.courseId]
                );
            }

            const id = row ? row.id : null;
            taskCache.set(key, id);
            return id;
        }

        const rowErrors = [];
        for (const r of sheet.rows) {
            const values = r.values || {};
            const taskIdRaw = getField(values, ['Task ID', 'Task Number']);
            const prompt = getField(values, ['Question', 'Prompt']);
            const answers = [];
            for (let i = 1; i <= 6; i++) {
                const label = i === 1 ? 'Answer 1' : 'Answer ' + i;
                const v = getField(values, [label]);
                if (v) answers.push(v);
            }

            const rowNum = r.rowNumber;
            if (!prompt) {
                rowErrors.push({
                    rowNumber: rowNum,
                    message: 'Question text is required.'
                });
                continue;
            }
            if (!answers.length) {
                rowErrors.push({
                    rowNumber: rowNum,
                    message: 'At least one answer is required.'
                });
                continue;
            }

            const taskId = await resolveTaskId(taskIdRaw);
            if (!taskId) {
                rowErrors.push({
                    rowNumber: rowNum,
                    message: 'Task identifier "' + taskIdRaw + '" does not match any task in this course.'
                });
                continue;
            }
        }

        if (rowErrors.length) {
            stats.errors = rowErrors;
            return { status: 'failed', stats };
        }

        try {
            await withTransaction(async () => {
                for (const r of sheet.rows) {
                    const values = r.values || {};
                    const taskKeyRaw = getField(values, ['Task ID', 'Task Number']);
                    const taskId = await resolveTaskId(taskKeyRaw);
                    if (!taskId) {
                        throw new Error('Task identifier "' + taskKeyRaw + '" does not match any task in this course.');
                    }
                    const prompt = getField(values, ['Question', 'Prompt']);
                    const answers = [];
                    for (let i = 1; i <= 6; i++) {
                        const label = i === 1 ? 'Answer 1' : 'Answer ' + i;
                        const v = getField(values, [label]);
                        if (v) answers.push(v);
                    }

                    let correctIndex = null;
                    const correctIndexRaw = getField(values, ['Correct Index', 'Correct Option']);
                    const correctAnswerText = getField(values, ['Correct Answer']);

                    if (correctIndexRaw) {
                        const n = parseInt(correctIndexRaw, 10);
                        if (Number.isFinite(n)) {
                            // Treat both 0-based and 1-based, but clamp.
                            const zeroBased = n > 0 ? n - 1 : n;
                            if (zeroBased >= 0 && zeroBased < answers.length) {
                                correctIndex = zeroBased;
                            }
                        }
                    }

                    if (correctIndex == null && correctAnswerText) {
                        const idx = answers.findIndex(a => a === correctAnswerText);
                        if (idx >= 0) {
                            correctIndex = idx;
                        }
                    }

                    if (correctIndex == null) {
                        throw new Error(
                            'Could not determine correct answer for row ' + r.rowNumber + ' (question: ' + prompt + ').'
                        );
                    }

                    const correctAnswer = answers[correctIndex] || '';

                    const existing = await get(
                        'SELECT id FROM questions WHERE task_id = ? AND prompt = ?',
                        [taskId, prompt]
                    );
                    if (existing) {
                        await run(
                            'UPDATE questions SET answers = ?, correct_answer = ?, correct_index = ? WHERE id = ?',
                            [JSON.stringify(answers), correctAnswer, correctIndex, existing.id]
                        );
                        stats.updated += 1;
                    } else {
                        await run(
                            'INSERT INTO questions (task_id, prompt, correct_answer, correct_index, answers) VALUES (?, ?, ?, ?, ?)',
                            [taskId, prompt, correctAnswer, correctIndex, JSON.stringify(answers)]
                        );
                        stats.inserted += 1;
                    }
                }
            });
        } catch (err) {
            console.error('Error importing questions sheet:', err);
            stats.errors.push({
                rowNumber: 1,
                message: 'Unexpected error while writing data: ' + (err.message || err.toString())
            });
            return { status: 'failed', stats };
        }

        return { status: 'ok', stats };
    }

    for (const sheet of stored.sheets) {
        const wants =
            (sheet.type === 'structure' && includeStructure) ||
            (sheet.type === 'vocab' && includeVocab) ||
            (sheet.type === 'questions' && includeQuestions);

        if (!wants) {
            addResultForType(sheet.type, sheet.name, 'skipped', null);
            continue;
        }

        if (sheet.type === 'structure') {
            const { status, stats } = await importStructureSheet(sheet);
            addResultForType(sheet.type, sheet.name, status, stats);
        } else if (sheet.type === 'vocab') {
            const { status, stats } = await importVocabSheet(sheet);
            addResultForType(sheet.type, sheet.name, status, stats);
        } else if (sheet.type === 'questions') {
            const { status, stats } = await importQuestionsSheet(sheet);
            addResultForType(sheet.type, sheet.name, status, stats);
        } else {
            addResultForType(sheet.type, sheet.name, 'skipped', null);
        }
    }

    res.render('teacher/import-result', {
        user: req.session.user,
        course: req.course,
        results
    });
});

router.get('/courses/new', (req, res) => {
    res.render('teacher/course-form', { user: req.session.user, course: null });
});

router.post('/courses', async (req, res) => {
    const userId = req.session.userId;
    const { name, is_public } = req.body || {};
    if (!name) return res.redirect('/courses/new');
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM courses WHERE owner_id = ?', [userId]);
    await run('INSERT INTO courses (owner_id, name, is_public, sort_order) VALUES (?, ?, ?, ?)', [userId, name.trim(), is_public ? 1 : 0, maxOrder.n]);
    const row = await get('SELECT id FROM courses ORDER BY id DESC LIMIT 1');
    res.redirect('/courses/' + row.id);
});

router.post('/courses/:id/delete', requireCourseOwner, async (req, res) => {
    await run('DELETE FROM courses WHERE id = ?', [req.courseId]);
    res.redirect('/courses');
});

router.get('/courses/:id/edit', requireCourseOwner, (req, res) => {
    res.render('teacher/course-form', { user: req.session.user, course: req.course });
});

router.post('/courses/:id', requireCourseOwner, async (req, res) => {
    const { name, is_public } = req.body || {};
    if (!name || !name.trim()) return res.redirect('/courses');
    await run('UPDATE courses SET name = ?, is_public = ? WHERE id = ?', [name.trim(), is_public ? 1 : 0, req.courseId]);
    res.redirect('/courses#course-' + req.courseId);
});

router.get('/courses/:id', requireCourseOwner, async (req, res) => {
    const tasks = await all('SELECT id, name, sort_order FROM tasks WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    const units = await all('SELECT id, name, sort_order FROM units WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    const vocabCount = await get('SELECT COUNT(*) as c FROM vocab_terms WHERE course_id = ?', [req.courseId]);
    const quizzes = await all('SELECT id, name, sort_order, created_at FROM quizzes WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    res.render('teacher/course-dashboard', {
        user: req.session.user,
        course: req.course,
        tasks,
        units,
        vocabCount: vocabCount.c,
        quizzes
    });
});

// AJAX endpoint: search questions in this course by prompt text (partial match).
router.get('/courses/:courseId/questions/search', requireCourseOwner, async (req, res) => {
    const courseId = req.courseId;
    const q = (req.query && req.query.q ? String(req.query.q) : '').trim();
    if (!q) return res.json([]);

    const like = '%' + q.replace(/%/g, '\\%').replace(/_/g, '\\_') + '%';
    const rows = await all(
        `SELECT q.id, q.prompt, q.task_id, t.name AS task_name
         FROM questions q
         JOIN tasks t ON q.task_id = t.id
         WHERE t.course_id = ? AND q.prompt LIKE ? ESCAPE '\\'
         ORDER BY q.id DESC
         LIMIT 50`,
        [courseId, like]
    );
    res.json(rows || []);
});

router.get('/courses/:courseId/tasks', requireCourseOwner, async (req, res) => {
    const tasks = await all('SELECT id, name, target, sort_order FROM tasks WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    if (tasks.length > 0) {
        const taskIds = tasks.map(t => t.id);
        const placeholders = taskIds.map(() => '?').join(',');
        const counts = await all('SELECT task_id, COUNT(*) as c FROM questions WHERE task_id IN (' + placeholders + ') GROUP BY task_id', taskIds);
        const countByTask = {};
        counts.forEach(r => { countByTask[r.task_id] = r.c; });
        tasks.forEach(t => { t.questionCount = countByTask[t.id] || 0; });
    }
    res.render('teacher/task-list', { user: req.session.user, course: req.course, tasks });
});

router.get('/courses/:courseId/tasks/new', requireCourseOwner, (req, res) => {
    res.render('teacher/task-form', { user: req.session.user, course: req.course, task: null });
});

router.post('/courses/:courseId/tasks', requireCourseOwner, async (req, res) => {
    const { name, target } = req.body || {};
    if (!name || !name.trim()) return res.redirect('/courses/' + req.courseId + '/tasks/new');
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM tasks WHERE course_id = ?', [req.courseId]);
    await run('INSERT INTO tasks (course_id, name, target, sort_order) VALUES (?, ?, ?, ?)', [req.courseId, name.trim(), (target || '').trim(), maxOrder.n]);
    const row = await get('SELECT id FROM tasks ORDER BY id DESC LIMIT 1');
    res.redirect('/courses/' + req.courseId + '/tasks/' + row.id);
});

router.get('/courses/:courseId/tasks/:tid', requireCourseOwner, async (req, res) => {
    const taskId = parseInt(req.params.tid);
    const task = await get('SELECT id, name, target, sort_order FROM tasks WHERE id = ? AND course_id = ?', [taskId, req.courseId]);
    if (!task) return res.redirect('/courses/' + req.courseId + '/tasks');
    const questions = await all('SELECT id, prompt, correct_answer, correct_index, answers FROM questions WHERE task_id = ? ORDER BY id', [taskId]);
    const questionsParsed = questions.map(q => ({ ...q, answers: typeof q.answers === 'string' ? JSON.parse(q.answers) : q.answers }));
    res.render('teacher/task-edit', { user: req.session.user, course: req.course, task, questions: questionsParsed });
});

router.post('/courses/:courseId/tasks/:tid', requireCourseOwner, async (req, res) => {
    const taskId = parseInt(req.params.tid);
    const task = await get('SELECT id, sort_order FROM tasks WHERE id = ? AND course_id = ?', [taskId, req.courseId]);
    if (!task) return res.redirect('/courses/' + req.courseId + '/tasks');
    const { name, target, task_number } = req.body || {};
    const currentOrder = task.sort_order != null ? task.sort_order : 0;
    const newOrder = task_number != null ? Math.max(0, parseInt(task_number, 10) - 1) : null;
    if (newOrder !== null && newOrder !== currentOrder) {
        if (newOrder < currentOrder) {
            await run('UPDATE tasks SET sort_order = sort_order + 1 WHERE course_id = ? AND id != ? AND sort_order >= ? AND sort_order < ?',
                [req.courseId, taskId, newOrder, currentOrder]);
        } else {
            await run('UPDATE tasks SET sort_order = sort_order - 1 WHERE course_id = ? AND id != ? AND sort_order > ? AND sort_order <= ?',
                [req.courseId, taskId, currentOrder, newOrder]);
        }
        await run('UPDATE tasks SET sort_order = ? WHERE id = ?', [newOrder, taskId]);
    }
    if (name !== undefined || target !== undefined) {
        await run('UPDATE tasks SET name = ?, target = ? WHERE id = ?', [(name || '').trim(), (target || '').trim(), taskId]);
    }
    const referer = req.get('Referer') || '';
    if (referer.indexOf('/tasks/' + taskId) !== -1 && referer.indexOf('/questions') === -1) {
        res.redirect('/courses/' + req.courseId + '/tasks/' + taskId);
    } else {
        res.redirect('/courses/' + req.courseId + '/tasks#task-' + taskId);
    }
});

router.post('/courses/:courseId/tasks/:tid/delete', requireCourseOwner, async (req, res) => {
    const taskId = parseInt(req.params.tid);
    const task = await get('SELECT id FROM tasks WHERE id = ? AND course_id = ?', [taskId, req.courseId]);
    if (task) {
        await run('DELETE FROM tasks WHERE id = ?', [taskId]);
    }
    res.redirect('/courses/' + req.courseId + '/tasks');
});

router.get('/courses/:courseId/tasks/:tid/questions/new', requireCourseOwner, (req, res) => {
    const taskId = parseInt(req.params.tid);
    res.render('teacher/question-form', { user: req.session.user, course: req.course, taskId, question: null });
});

router.post('/courses/:courseId/tasks/:tid/questions', requireCourseOwner, async (req, res) => {
    const taskId = parseInt(req.params.tid);
    const task = await get('SELECT id FROM tasks WHERE id = ? AND course_id = ?', [taskId, req.courseId]);
    if (!task) return res.redirect('/courses/' + req.courseId + '/tasks');
    const { prompt, correctAnswer, correctIndex, answers, quality, badReason } = req.body || {};
    const ans = typeof answers === 'string' ? (answers.trim() ? answers.split(/\n/).map(s => s.trim()).filter(Boolean) : []) : (answers || []);
    const idx = parseInt(correctIndex) || 0;

    if (quality === 'good' || quality === 'bad') {
        if (!prompt || !(prompt + '').trim()) {
            return res.status(400).json({ error: 'prompt required' });
        }
        if (quality === 'bad') {
            const badCount = await get('SELECT COUNT(*) as c FROM questions WHERE task_id = ? AND quality = ?', [taskId, 'bad']);
            if (badCount && badCount.c >= 10) {
                await run(
                    "DELETE FROM questions WHERE id = (SELECT id FROM questions WHERE task_id = ? AND quality = 'bad' ORDER BY id ASC LIMIT 1)",
                    [taskId]
                );
            }
        }
        await run(
            'INSERT INTO questions (task_id, prompt, correct_answer, correct_index, answers, quality, quality_reason, ai) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [taskId, (prompt || '').trim(), (correctAnswer || '').trim(), idx, JSON.stringify(ans), quality, (badReason || null), 1]
        );
        const row = await get('SELECT id FROM questions ORDER BY id DESC LIMIT 1');
        return res.status(201).json({ id: row.id });
    }

    await run('INSERT INTO questions (task_id, prompt, correct_answer, correct_index, answers) VALUES (?, ?, ?, ?, ?)',
        [taskId, (prompt || '').trim(), (correctAnswer || '').trim(), idx, JSON.stringify(ans)]);
    const row = await get('SELECT id FROM questions ORDER BY id DESC LIMIT 1');
    res.redirect('/courses/' + req.courseId + '/tasks/' + taskId + '#question-' + row.id);
});

router.get('/courses/:courseId/tasks/:tid/questions/:qid', requireCourseOwner, (req, res) => {
    res.redirect('/courses/' + req.courseId + '/tasks/' + req.params.tid + '#question-' + req.params.qid);
});

router.post('/courses/:courseId/tasks/:tid/questions/:qid', requireCourseOwner, async (req, res) => {
    const taskId = parseInt(req.params.tid);
    const questionId = parseInt(req.params.qid);
    const q = await get('SELECT q.id FROM questions q JOIN tasks t ON q.task_id = t.id WHERE q.id = ? AND t.course_id = ?', [questionId, req.courseId]);
    if (!q) return res.redirect('/courses/' + req.courseId + '/tasks/' + taskId);
    const { prompt, correctAnswer, correctIndex, answers } = req.body || {};
    const ans = typeof answers === 'string' ? (answers.trim() ? answers.split(/\n/).map(s => s.trim()).filter(Boolean) : []) : (answers || []);
    const idx = parseInt(correctIndex) || 0;
    await run('UPDATE questions SET prompt = ?, correct_answer = ?, correct_index = ?, answers = ? WHERE id = ?',
        [(prompt || '').trim(), (correctAnswer || '').trim(), idx, JSON.stringify(ans), questionId]);
    res.redirect('/courses/' + req.courseId + '/tasks/' + taskId + '#question-' + questionId);
});

router.post('/courses/:courseId/tasks/:tid/questions/:qid/delete', requireCourseOwner, async (req, res) => {
    const taskId = parseInt(req.params.tid);
    const questionId = parseInt(req.params.qid);
    const q = await get('SELECT q.id FROM questions q JOIN tasks t ON q.task_id = t.id WHERE q.id = ? AND t.course_id = ?', [questionId, req.courseId]);
    if (q) await run('DELETE FROM questions WHERE id = ?', [questionId]);
    res.redirect('/courses/' + req.courseId + '/tasks/' + taskId);
});

router.get('/courses/:courseId/mastery', requireLogin, async (req, res) => {
    const courseId = parseInt(req.params.courseId);
    const userId = req.session.userId;
    if (!userId || !courseId) return res.redirect('/classes');

    // Teachers do not have personal mastery; redirect them to classes.
    if (isTeacher(req)) {
        return res.redirect('/classes');
    }

    const course = await get('SELECT id, name FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.redirect('/classes');

    const rows = await all(
        `SELECT tm.task_id, tm.mastery,
                t.name as task_name, u.id as unit_id, u.name as unit_name, u.sort_order as unit_order, t.sort_order as task_order
         FROM task_mastery tm
         JOIN tasks t ON tm.task_id = t.id
         LEFT JOIN unit_tasks ut ON ut.task_id = t.id
         LEFT JOIN units u ON ut.unit_id = u.id
         WHERE tm.user_id = ? AND tm.course_id = ?
         ORDER BY unit_order, unit_id, task_order, t.id`,
        [userId, courseId]
    );

    const units = {};
    (rows || []).forEach(r => {
        const uid = r.unit_id || 0;
        if (!units[uid]) {
            units[uid] = {
                id: r.unit_id,
                name: r.unit_name || 'Ungrouped',
                tasks: []
            };
        }
        units[uid].tasks.push({
            taskId: r.task_id,
            taskName: r.task_name,
            mastery: r.mastery
        });
    });

    res.render('mastery/student', {
        user: req.session.user,
        course,
        units: Object.values(units)
    });
});

router.get('/courses/:courseId/mastery/coach', requireLogin, async (req, res) => {
    const courseId = parseInt(req.params.courseId);
    const userId = req.session.userId;
    if (!userId || !courseId) return res.redirect('/classes');

    // Teachers do not have personal mastery; redirect them to classes.
    if (isTeacher(req)) {
        return res.redirect('/classes');
    }

    const course = await get('SELECT id, name FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.redirect('/classes');

    const rows = await all(
        `SELECT tm.task_id, tm.mastery,
                t.name as task_name, t.target as task_target,
                u.id as unit_id, u.name as unit_name, u.sort_order as unit_order, t.sort_order as task_order
         FROM task_mastery tm
         JOIN tasks t ON tm.task_id = t.id
         LEFT JOIN unit_tasks ut ON ut.task_id = t.id
         LEFT JOIN units u ON ut.unit_id = u.id
         WHERE tm.user_id = ? AND tm.course_id = ?
         ORDER BY unit_order, unit_id, task_order, t.id`,
        [userId, courseId]
    );

    const unitsMap = {};
    const tasksForCoach = [];

    (rows || []).forEach(r => {
        const mastery = typeof r.mastery === 'number' ? r.mastery : 0;
        const include = mastery >= 0 && mastery <= 0.91;
        const unitId = r.unit_id || 0;
        if (!unitsMap[unitId]) {
            unitsMap[unitId] = {
                id: r.unit_id,
                name: r.unit_name || 'Ungrouped',
                masterySum: 0,
                masteryCount: 0
            };
        }
        if (include) {
            tasksForCoach.push({
                id: r.task_id,
                name: r.task_name,
                target: r.task_target || null,
                mastery
            });
        }
        // Track mastery per unit for context
        if (typeof mastery === 'number') {
            unitsMap[unitId].masterySum += mastery;
            unitsMap[unitId].masteryCount += 1;
        }
    });

    const unitsForCoach = Object.values(unitsMap)
        .map(u => {
            const avg =
                u.masteryCount > 0 ? u.masterySum / u.masteryCount : 0;
            return {
                id: u.id,
                name: u.name,
                mastery: avg
            };
        })
        // Only keep units that have at least one task in tasksForCoach
        .filter(u =>
            tasksForCoach.some(t => {
                // We don't have explicit unit id per task here; allow all units
                // but prefer to keep all so coach sees overall structure.
                return true;
            })
        );

    const plan = await getImprovementPlan({
        course,
        units: unitsForCoach,
        tasks: tasksForCoach,
        missedQuestions: []
    });

    res.render('quiz/coach', {
        user: req.session.user,
        classItem: null,
        quiz: { id: 0, name: course.name + ' - Mastery Coach' },
        attempt: null,
        course,
        plan
    });
});

router.post('/courses/:courseId/progress-test', requireLogin, async (req, res) => {
    const courseId = parseInt(req.params.courseId);
    const userId = req.session.userId;
    if (!userId || !courseId) return res.redirect('/classes');

    const classRow = await get(
        `SELECT DISTINCT c.id, c.name
         FROM classes c
         JOIN class_members cm ON cm.class_id = c.id
         JOIN class_courses cc ON cc.class_id = c.id
         WHERE cm.user_id = ? AND cc.course_id = ?
         ORDER BY c.sort_order, c.id
         LIMIT 1`,
        [userId, courseId]
    );
    if (!classRow) {
        return res.redirect('/classes');
    }

    const { createProgressAttempt } = require('../lib/progress-quiz');
    try {
        const attempt = await createProgressAttempt(userId, classRow.id, courseId);
        res.redirect('/progress/' + attempt.id + '/take/1');
    } catch (err) {
        console.error('Error creating progress test:', err.message);
        res.redirect('/courses/' + courseId + '/mastery');
    }
});

// Create an "Overall Knowledge" test attempt for the current student in the first matching class.
router.post('/courses/:courseId/overall-test', requireLogin, async (req, res) => {
    const courseId = parseInt(req.params.courseId);
    const userId = req.session.userId;
    if (!userId || !courseId) return res.redirect('/classes');

    const classRow = await get(
        `SELECT DISTINCT c.id, c.name
         FROM classes c
         JOIN class_members cm ON cm.class_id = c.id
         JOIN class_courses cc ON cc.class_id = c.id
         WHERE cm.user_id = ? AND cc.course_id = ?
         ORDER BY c.sort_order, c.id
         LIMIT 1`,
        [userId, courseId]
    );
    if (!classRow) {
        return res.redirect('/classes');
    }

    const { createOverallAttempt } = require('../lib/progress-quiz');
    try {
        const attempt = await createOverallAttempt(userId, classRow.id, courseId);
        res.redirect('/overall/' + attempt.id + '/take/1');
    } catch (err) {
        console.error('Error creating overall knowledge test:', err.message);
        res.redirect('/courses/' + courseId + '/mastery');
    }
});

router.get('/courses/:courseId/units', requireCourseOwner, async (req, res) => {
    const units = await all('SELECT id, name, sort_order FROM units WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    const allTasks = await all('SELECT id, name FROM tasks WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    const allVocab = await all('SELECT id, term, definition FROM vocab_terms WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    if (units.length === 0) {
        return res.render('teacher/unit-list', { user: req.session.user, course: req.course, units: [], allTasks, allVocab });
    }
    const unitIds = units.map(u => u.id);
    const placeholders = unitIds.map(() => '?').join(',');
    const unitTasksRows = await all(
        'SELECT ut.unit_id, ut.task_id, ut.sort_order, t.name, t.sort_order AS task_sort_order FROM unit_tasks ut JOIN tasks t ON ut.task_id = t.id WHERE ut.unit_id IN (' + placeholders + ') ORDER BY ut.unit_id, ut.sort_order',
        unitIds
    );
    const unitVocabRows = await all(
        'SELECT uv.unit_id, uv.vocab_term_id, uv.sort_order, v.term, v.definition FROM unit_vocab uv JOIN vocab_terms v ON uv.vocab_term_id = v.id WHERE uv.unit_id IN (' + placeholders + ') ORDER BY uv.unit_id, uv.sort_order',
        unitIds
    );
    const unitTasksByUnit = {};
    const unitVocabByUnit = {};
    unitIds.forEach(id => { unitTasksByUnit[id] = []; unitVocabByUnit[id] = []; });
    unitTasksRows.forEach(r => { unitTasksByUnit[r.unit_id].push({ task_id: r.task_id, sort_order: r.sort_order, name: r.name, task_sort_order: r.task_sort_order }); });
    unitVocabRows.forEach(r => { unitVocabByUnit[r.unit_id].push({ vocab_term_id: r.vocab_term_id, sort_order: r.sort_order, term: r.term, definition: r.definition }); });
    const unitsWithDetails = units.map(u => ({
        ...u,
        unitTasks: unitTasksByUnit[u.id] || [],
        unitVocab: unitVocabByUnit[u.id] || [],
        inUnitTaskIds: new Set((unitTasksByUnit[u.id] || []).map(t => t.task_id)),
        inUnitVocabIds: new Set((unitVocabByUnit[u.id] || []).map(v => v.vocab_term_id))
    }));
    const unitsWithAvailable = unitsWithDetails.map(u => ({
        ...u,
        allTasksAvailable: allTasks.filter(t => !u.inUnitTaskIds.has(t.id)),
        allVocabAvailable: allVocab.filter(v => !u.inUnitVocabIds.has(v.id))
    }));
    const unitsForView = unitsWithAvailable.map(({ inUnitTaskIds, inUnitVocabIds, ...u }) => u);
    res.render('teacher/unit-list', { user: req.session.user, course: req.course, units: unitsForView, allTasks, allVocab });
});

router.get('/courses/:courseId/units/new', requireCourseOwner, (req, res) => {
    res.render('teacher/unit-form', { user: req.session.user, course: req.course, unit: null });
});

router.post('/courses/:courseId/units', requireCourseOwner, async (req, res) => {
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.redirect('/courses/' + req.courseId + '/units/new');
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM units WHERE course_id = ?', [req.courseId]);
    await run('INSERT INTO units (course_id, name, sort_order) VALUES (?, ?, ?)', [req.courseId, name.trim(), maxOrder.n]);
    const row = await get('SELECT id FROM units ORDER BY id DESC LIMIT 1');
    res.redirect('/courses/' + req.courseId + '/units#unit-' + row.id);
});

router.get('/courses/:courseId/units/:uid', requireCourseOwner, (req, res) => {
    res.redirect('/courses/' + req.courseId + '/units#unit-' + req.params.uid);
});

router.post('/courses/:courseId/units/:uid', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.uid);
    const unit = await get('SELECT id FROM units WHERE id = ? AND course_id = ?', [unitId, req.courseId]);
    if (!unit) return res.redirect('/courses/' + req.courseId + '/units');
    const { name } = req.body || {};
    if (name !== undefined) await run('UPDATE units SET name = ? WHERE id = ?', [name.trim(), unitId]);
    res.redirect('/courses/' + req.courseId + '/units#unit-' + unitId);
});

router.post('/courses/:courseId/units/:uid/delete', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.uid);
    const unit = await get('SELECT id FROM units WHERE id = ? AND course_id = ?', [unitId, req.courseId]);
    if (unit) {
        await run('DELETE FROM units WHERE id = ?', [unitId]);
    }
    res.redirect('/courses/' + req.courseId + '/units');
});

router.post('/courses/:courseId/units/:uid/tasks', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.uid);
    const taskId = parseInt(req.body.task_id);
    const u = await get('SELECT id FROM units WHERE id = ? AND course_id = ?', [unitId, req.courseId]);
    const t = await get('SELECT id FROM tasks WHERE id = ? AND course_id = ?', [taskId, req.courseId]);
    if (u && t) {
        const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM unit_tasks WHERE unit_id = ?', [unitId]);
        await run('INSERT OR IGNORE INTO unit_tasks (unit_id, task_id, sort_order) VALUES (?, ?, ?)', [unitId, taskId, maxOrder.n]);
    }
    res.redirect('/courses/' + req.courseId + '/units#unit-' + unitId);
});

router.post('/courses/:courseId/units/:uid/tasks/:taskId/remove', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.uid);
    const taskId = parseInt(req.params.taskId);
    await run('DELETE FROM unit_tasks WHERE unit_id = ? AND task_id = ?', [unitId, taskId]);
    res.redirect('/courses/' + req.courseId + '/units#unit-' + unitId);
});

router.post('/courses/:courseId/units/:uid/vocab', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.uid);
    const vocabTermId = parseInt(req.body.vocab_term_id);
    const u = await get('SELECT id FROM units WHERE id = ? AND course_id = ?', [unitId, req.courseId]);
    const v = await get('SELECT id FROM vocab_terms WHERE id = ? AND course_id = ?', [vocabTermId, req.courseId]);
    if (u && v) {
        const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM unit_vocab WHERE unit_id = ?', [unitId]);
        await run('INSERT OR IGNORE INTO unit_vocab (unit_id, vocab_term_id, sort_order) VALUES (?, ?, ?)', [unitId, vocabTermId, maxOrder.n]);
    }
    res.redirect('/courses/' + req.courseId + '/units#unit-' + unitId);
});

router.post('/courses/:courseId/units/:uid/vocab/:vocabTermId/remove', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.uid);
    const vocabTermId = parseInt(req.params.vocabTermId);
    await run('DELETE FROM unit_vocab WHERE unit_id = ? AND vocab_term_id = ?', [unitId, vocabTermId]);
    res.redirect('/courses/' + req.courseId + '/units#unit-' + unitId);
});

router.get('/courses/:courseId/vocab', requireCourseOwner, async (req, res) => {
    const terms = await all('SELECT id, term, definition, sort_order FROM vocab_terms WHERE course_id = ? ORDER BY term COLLATE NOCASE', [req.courseId]);
    res.render('teacher/vocab-list', { user: req.session.user, course: req.course, terms });
});

router.get('/courses/:courseId/vocab/new', requireCourseOwner, (req, res) => {
    res.render('teacher/vocab-form', { user: req.session.user, course: req.course, term: null });
});

router.post('/courses/:courseId/vocab', requireCourseOwner, async (req, res) => {
    const { term, definition } = req.body || {};
    if (!term || !term.trim()) return res.redirect('/courses/' + req.courseId + '/vocab/new');
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM vocab_terms WHERE course_id = ?', [req.courseId]);
    await run('INSERT INTO vocab_terms (course_id, term, definition, sort_order) VALUES (?, ?, ?, ?)', [req.courseId, term.trim(), (definition || '').trim() || null, maxOrder.n]);
    res.redirect('/courses/' + req.courseId + '/vocab');
});

router.get('/courses/:courseId/vocab/:vid/edit', requireCourseOwner, async (req, res) => {
    const vid = parseInt(req.params.vid);
    const term = await get('SELECT id, term, definition FROM vocab_terms WHERE id = ? AND course_id = ?', [vid, req.courseId]);
    if (!term) return res.redirect('/courses/' + req.courseId + '/vocab');
    res.render('teacher/vocab-form', { user: req.session.user, course: req.course, term });
});

router.post('/courses/:courseId/vocab/:vid', requireCourseOwner, async (req, res) => {
    const vid = parseInt(req.params.vid);
    const { term, definition } = req.body || {};
    const v = await get('SELECT id FROM vocab_terms WHERE id = ? AND course_id = ?', [vid, req.courseId]);
    if (!v || !term || !term.trim()) return res.redirect('/courses/' + req.courseId + '/vocab');
    await run('UPDATE vocab_terms SET term = ?, definition = ? WHERE id = ?', [term.trim(), (definition || '').trim() || null, vid]);
    res.redirect('/courses/' + req.courseId + '/vocab#vocab-' + vid);
});

router.post('/courses/:courseId/vocab/:vid/delete', requireCourseOwner, async (req, res) => {
    const vid = parseInt(req.params.vid);
    const v = await get('SELECT id FROM vocab_terms WHERE id = ? AND course_id = ?', [vid, req.courseId]);
    if (v) await run('DELETE FROM vocab_terms WHERE id = ?', [vid]);
    res.redirect('/courses/' + req.courseId + '/vocab');
});

router.get('/courses/:courseId/questions', requireCourseOwner, async (req, res) => {
    const units = await all('SELECT id, name, sort_order FROM units WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    res.render('teacher/question-generator', { user: req.session.user, course: req.course, units });
});

router.get('/courses/:courseId/generator/tasks', requireCourseOwner, async (req, res) => {
    const unitIdParam = req.query.unitId;
    // Count ALL questions marked 'good' for this task (no limit)
    const goodCountSubquery = "(SELECT COUNT(*) FROM questions q WHERE q.task_id = t.id AND q.quality = 'good')";
    const goodCountExpr = goodCountSubquery + ' AS good_count';
    if (unitIdParam === 'all' || !unitIdParam) {
        const tasks = await all(
            'SELECT t.id, t.name, t.target, t.description, ' + goodCountExpr + ' FROM tasks t WHERE t.course_id = ? ORDER BY t.sort_order, t.id',
            [req.courseId]
        );
        return res.json(tasks.map(t => ({ ...t, good_count: Number(t.good_count) || 0 })));
    }
    const unitId = parseInt(unitIdParam, 10);
    if (!unitId) return res.json([]);
    const tasks = await all(
        'SELECT t.id, t.name, t.target, t.description, ' + goodCountExpr + ' FROM unit_tasks ut JOIN tasks t ON ut.task_id = t.id WHERE ut.unit_id = ? AND t.course_id = ? ORDER BY ut.sort_order, t.id',
        [unitId, req.courseId]
    );
    res.json(tasks.map(t => ({ ...t, good_count: Number(t.good_count) || 0 })));
});

router.post('/courses/:courseId/questions/generate', requireCourseOwner, async (req, res) => {
    const taskId = parseInt(req.body && req.body.taskId, 10);
    if (!taskId) return res.status(400).json({ error: 'taskId required' });
    const task = await get('SELECT id, name, target, description FROM tasks WHERE id = ? AND course_id = ?', [taskId, req.courseId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const goodRows = await all(
        "SELECT prompt, correct_answer, correct_index, answers FROM questions WHERE task_id = ? AND quality = 'good' ORDER BY RANDOM() LIMIT 10",
        [taskId]
    );
    const badRows = await all(
        "SELECT prompt, correct_answer, correct_index, answers, quality_reason FROM questions WHERE task_id = ? AND quality = 'bad' ORDER BY RANDOM() LIMIT 10",
        [taskId]
    );
    const goodExamples = goodRows.map(r => ({
        ...r,
        answers: typeof r.answers === 'string' ? JSON.parse(r.answers || '[]') : r.answers
    }));
    const badExamples = badRows.map(r => ({
        ...r,
        answers: typeof r.answers === 'string' ? JSON.parse(r.answers || '[]') : r.answers
    }));
    try {
        const generateQuestions = require('../lib/question-generator').generateQuestions;
        const additionalContext = (req.body && req.body.additionalContext && String(req.body.additionalContext).trim()) || undefined;
        const questions = await generateQuestions({
            task: { name: task.name, target: task.target, description: task.description },
            goodExamples,
            badExamples,
            count: 5,
            additionalContext
        });
        res.json(questions);
    } catch (err) {
        console.error('Question generate error:', err);
        res.status(500).json({ error: err.message || 'Generation failed' });
    }
});

router.get('/courses/:courseId/quizzes', requireCourseOwner, async (req, res) => {
    const quizzes = await all('SELECT id, name, sort_order, created_at FROM quizzes WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    res.render('teacher/quiz-list', { user: req.session.user, course: req.course, quizzes });
});

router.get('/courses/:courseId/quizzes/new', requireCourseOwner, (req, res) => {
    res.render('teacher/quiz-form', { user: req.session.user, course: req.course, quiz: null });
});

router.post('/courses/:courseId/quizzes', requireCourseOwner, async (req, res) => {
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.redirect('/courses/' + req.courseId + '/quizzes/new');
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM quizzes WHERE course_id = ?', [req.courseId]);
    await run('INSERT INTO quizzes (course_id, name, sort_order) VALUES (?, ?, ?)', [req.courseId, name.trim(), maxOrder.n]);
    const row = await get('SELECT id FROM quizzes ORDER BY id DESC LIMIT 1');
    res.redirect('/courses/' + req.courseId + '/quizzes/' + row.id + '/edit');
});

router.get('/courses/:courseId/quizzes/:qid/edit', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.qid);
    const quiz = await get('SELECT id, name FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (!quiz) return res.redirect('/courses/' + req.courseId + '/quizzes');
    const quizQuestions = await all(
        `SELECT qq.id, qq.question_id, qq.sort_order, q.prompt
         FROM quiz_questions qq
         JOIN questions q ON qq.question_id = q.id
         JOIN tasks t ON q.task_id = t.id
         WHERE qq.quiz_id = ? AND t.course_id = ?
         ORDER BY qq.sort_order`,
        [quizId, req.courseId]
    );
    const units = await all('SELECT id, name FROM units WHERE course_id = ? ORDER BY sort_order', [req.courseId]);
    const tasks = await all('SELECT id, name FROM tasks WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    res.render('teacher/quiz-edit', { user: req.session.user, course: req.course, quiz, quizQuestions, units, tasks });
});

router.get('/courses/:courseId/quizzes/:qid/preview', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.qid);
    const quiz = await get('SELECT id, name FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (!quiz) return res.redirect('/courses/' + req.courseId + '/quizzes');
    const resolveQuizToQuestions = require('../lib/quiz-resolve').resolveQuizToQuestions;
    const questions = await resolveQuizToQuestions(req.courseId, quizId);
    res.render('teacher/quiz-preview', { user: req.session.user, course: req.course, quiz, questions });
});

router.get('/courses/:courseId/quizzes/:qid/export', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.qid);
    const quiz = await get('SELECT id, name FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (!quiz) return res.redirect('/courses/' + req.courseId + '/quizzes');
    const { resolveQuizToQuestions } = require('../lib/quiz-resolve');
    const questions = await resolveQuizToQuestions(req.courseId, quizId);
    if (!questions.length) {
        return res.redirect('/courses/' + req.courseId + '/quizzes/' + quizId + '/edit');
    }
    const { createQtiZip } = require('../lib/qti-export');
    const zipBuffer = await createQtiZip(questions, quiz.name);
    const filename = 'quiz_' + quizId + '_' + (quiz.name || 'export').replace(/[^a-zA-Z0-9_-]/g, '_') + '.zip';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(zipBuffer);
});

router.get('/courses/:courseId/quizzes/:qid/export-kahoot', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.qid);
    const quiz = await get('SELECT id, name FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (!quiz) return res.redirect('/courses/' + req.courseId + '/quizzes');
    const { resolveQuizToQuestions } = require('../lib/quiz-resolve');
    const questions = await resolveQuizToQuestions(req.courseId, quizId);
    if (!questions.length) {
        return res.redirect('/courses/' + req.courseId + '/quizzes/' + quizId + '/edit');
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Kahoot Quiz');

    sheet.addRow([
        'Question',
        'Answer 1',
        'Answer 2',
        'Answer 3',
        'Answer 4',
        'Correct answer',
        'Time limit (sec)'
    ]);

    questions.forEach((q) => {
        const answers = q.answers || [];
        const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
        const row = [
            q.prompt || '',
            answers[0] || '',
            answers[1] || '',
            answers[2] || '',
            answers[3] || '',
            String(correctIndex + 1),
            30
        ];
        sheet.addRow(row);
    });

    const filename = 'kahoot_' + quizId + '_' + (quiz.name || 'export').replace(/[^a-zA-Z0-9_-]/g, '_') + '.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    await workbook.xlsx.write(res);
    res.end();
});

router.get('/courses/:courseId/quizzes/:qid/export-gimkit', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.qid);
    const quiz = await get('SELECT id, name FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (!quiz) return res.redirect('/courses/' + req.courseId + '/quizzes');
    const { resolveQuizToQuestions } = require('../lib/quiz-resolve');
    const questions = await resolveQuizToQuestions(req.courseId, quizId);
    if (!questions.length) {
        return res.redirect('/courses/' + req.courseId + '/quizzes/' + quizId + '/edit');
    }

    const lines = [];
    lines.push('Gimkit Spreadsheet Import Template,,,,');
    lines.push('Question,Correct Answer,Incorrect Answer 1,Incorrect Answer 2,Incorrect Answer 3');

    questions.forEach((q) => {
        const answers = q.answers || [];
        const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
        const correct = answers[correctIndex] || '';
        const incorrect = answers.filter((_, idx) => idx !== correctIndex);

        const row = [
            (q.prompt || '').replace(/"/g, '""'),
            (correct || '').replace(/"/g, '""'),
            (incorrect[0] || '').replace(/"/g, '""'),
            (incorrect[1] || '').replace(/"/g, '""'),
            (incorrect[2] || '').replace(/"/g, '""')
        ];

        lines.push(row.map((cell) => `"${cell}"`).join(','));
    });

    const csv = lines.join('\r\n');
    const filename = 'gimkit_' + quizId + '_' + (quiz.name || 'export').replace(/[^a-zA-Z0-9_-]/g, '_') + '.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(csv);
});

router.get('/courses/:courseId/quizzes/:qid/export-blooket', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.qid);
    const quiz = await get('SELECT id, name FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (!quiz) return res.redirect('/courses/' + req.courseId + '/quizzes');
    const { resolveQuizToQuestions } = require('../lib/quiz-resolve');
    const questions = await resolveQuizToQuestions(req.courseId, quizId);
    if (!questions.length) {
        return res.redirect('/courses/' + req.courseId + '/quizzes/' + quizId + '/edit');
    }

    // Load the working Blooket template CSV so we exactly match its structure
    const templatePath = path.join(__dirname, '..', 'context', 'Blooket_Working.csv');
    let headerLines = [];
    let columnCount = 8;

    function parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current);
        return result;
    }

    try {
        const raw = fs.readFileSync(templatePath, 'utf8');
        const templateLines = raw.split(/\r?\n/);
        // Find the first data row (starts with a question number like "1,")
        const dataStartIdx = templateLines.findIndex((l) => /^[0-9]+,/.test(l.trim()));
        if (dataStartIdx === -1) {
            headerLines = ['Question #,Question Text,Answer 1,Answer 2,Answer 3 (Optional),Answer 4 (Optional),Time Limit (sec),Correct Answer(s)'];
            columnCount = 8;
        } else {
            headerLines = templateLines.slice(0, dataStartIdx);
            const sampleDataLine = templateLines[dataStartIdx] || '';
            const sampleFields = sampleDataLine ? parseCsvLine(sampleDataLine) : [];
            columnCount = sampleFields.length || 8;
        }
    } catch (e) {
        // Fallback: minimal header if template not found
        headerLines = ['Question #,Question Text,Answer 1,Answer 2,Answer 3 (Optional),Answer 4 (Optional),Time Limit (sec),Correct Answer(s)'];
        columnCount = 8;
    }

    const lines = [...headerLines];

    function csvCell(val) {
        const s = String(val == null ? '' : val);
        const needsQuotes = /[",\r\n]/.test(s);
        const escaped = s.replace(/"/g, '""');
        return needsQuotes ? `"${escaped}"` : escaped;
    }

    questions.forEach((q, idx) => {
        const answers = q.answers || [];
        const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
        const correctValue = String(correctIndex + 1);

        const baseCells = [];
        baseCells[0] = String(idx + 1); // Question #
        baseCells[1] = q.prompt || ''; // Question Text
        baseCells[2] = answers[0] || '';
        baseCells[3] = answers[1] || '';
        baseCells[4] = answers[2] || '';
        baseCells[5] = answers[3] || '';
        baseCells[6] = '20'; // default time limit
        baseCells[7] = correctValue;

        // Pad out to match the template's number of columns
        const rowCells = [];
        for (let i = 0; i < columnCount; i++) {
            rowCells[i] = csvCell(baseCells[i] || '');
        }

        lines.push(rowCells.join(','));
    });

    const csv = lines.join('\r\n');
    const filename = 'blooket_' + quizId + '_' + (quiz.name || 'export').replace(/[^a-zA-Z0-9_-]/g, '_') + '.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(csv);
});

router.post('/courses/:courseId/quizzes/:qid', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.qid);
    const { name, from } = req.body || {};
    const q = await get('SELECT id FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (!q || !name || !name.trim()) return res.redirect('/courses/' + req.courseId + '/quizzes');
    await run('UPDATE quizzes SET name = ? WHERE id = ?', [name.trim(), quizId]);
    if (from === 'list') {
        res.redirect('/courses/' + req.courseId + '/quizzes#quiz-' + quizId);
    } else {
        res.redirect('/courses/' + req.courseId + '/quizzes/' + quizId + '/edit');
    }
});

router.post('/courses/:courseId/quizzes/:qid/items/:itemId/delete', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.qid);
    const itemId = parseInt(req.params.itemId);
    const row = await get('SELECT qq.id FROM quiz_questions qq JOIN quizzes q ON qq.quiz_id = q.id WHERE qq.id = ? AND q.course_id = ?', [itemId, req.courseId]);
    if (row) await run('DELETE FROM quiz_questions WHERE id = ?', [itemId]);
    res.redirect('/courses/' + req.courseId + '/quizzes/' + quizId + '/edit');
});

router.post('/courses/:courseId/quizzes/:qid/delete', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.qid);
    const q = await get('SELECT id FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (q) await run('DELETE FROM quizzes WHERE id = ?', [quizId]);
    res.redirect('/courses/' + req.courseId + '/quizzes');
});

router.get('/classes', requireLogin, async (req, res) => {
    const userId = req.session.userId;
    const token = req.session.token || {};
    const formbarId = token.id != null ? token.id : token.sub;

    try {
        await syncClassesForUser(userId, formbarId);
        const rows = await all(
            `SELECT c.id, c.name, c.sort_order, c.formbar_class_id, cm.role
             FROM classes c
             JOIN class_members cm ON cm.class_id = c.id
             WHERE cm.user_id = ?
             ORDER BY c.sort_order, c.name`,
            [userId]
        );

        const classIds = [...new Set(rows.map(r => r.id))];
        let coursesByClass = {};
        let quizzesByClass = {};
        let studentCounts = {};
        let studentAssignedByClass = {};

        if (classIds.length) {
            const placeholders = classIds.map(() => '?').join(',');

            const courseRows = await all(
                `SELECT cc.class_id, cc.course_id, co.name
                 FROM class_courses cc
                 JOIN courses co ON cc.course_id = co.id
                 WHERE cc.class_id IN (${placeholders})
                 ORDER BY cc.class_id, co.sort_order, co.id`,
                classIds
            );
            courseRows.forEach(r => {
                if (!coursesByClass[r.class_id]) coursesByClass[r.class_id] = [];
                coursesByClass[r.class_id].push({ id: r.course_id, name: r.name });
            });

            const quizRows = await all(
                `SELECT cq.class_id, q.name
                 FROM class_quizzes cq
                 JOIN quizzes q ON cq.quiz_id = q.id
                 WHERE cq.class_id IN (${placeholders})`,
                classIds
            );
            quizRows.forEach(r => {
                if (!quizzesByClass[r.class_id]) quizzesByClass[r.class_id] = [];
                quizzesByClass[r.class_id].push(r.name);
            });

            const memberRows = await all(
                `SELECT class_id, COUNT(*) as studentCount
                 FROM class_members
                 WHERE class_id IN (${placeholders}) AND role = 'student'
                 GROUP BY class_id`,
                classIds
            );
            memberRows.forEach(r => {
                studentCounts[r.class_id] = r.studentCount;
            });

            // For student views, precompute assigned quizzes with best attempts per class
            const studentClassIds = rows.filter(r => r.role !== 'teacher').map(r => r.id);
            if (studentClassIds.length) {
                const placeholders2 = studentClassIds.map(() => '?').join(',');
                const assignedRows = await all(
                    `SELECT cq.class_id, cq.id, cq.title_override,
                            q.id as quiz_id, q.name as quiz_name,
                            c.id as course_id, c.name as course_name,
                            (
                                SELECT id FROM quiz_attempts qa
                                WHERE qa.user_id = ? AND qa.class_id = cq.class_id AND qa.quiz_id = cq.quiz_id
                                ORDER BY qa.score DESC, qa.completed_at DESC, qa.id DESC
                                LIMIT 1
                            ) as best_attempt_id,
                            (
                                SELECT score FROM quiz_attempts qa
                                WHERE qa.user_id = ? AND qa.class_id = cq.class_id AND qa.quiz_id = cq.quiz_id
                                ORDER BY qa.score DESC, qa.completed_at DESC, qa.id DESC
                                LIMIT 1
                            ) as best_score
                     FROM class_quizzes cq
                     JOIN quizzes q ON cq.quiz_id = q.id
                     JOIN courses c ON q.course_id = c.id
                     WHERE cq.class_id IN (${placeholders2})
                     ORDER BY cq.class_id, cq.assigned_at DESC, q.id`,
                    [userId, userId, ...studentClassIds]
                );
                assignedRows.forEach(r => {
                    if (!studentAssignedByClass[r.class_id]) studentAssignedByClass[r.class_id] = [];
                    studentAssignedByClass[r.class_id].push(r);
                });
            }
        }

        const enriched = rows.map(r => ({
            ...r,
            courses: coursesByClass[r.id] || [],
            quizzes: quizzesByClass[r.id] || [],
            studentCount: studentCounts[r.id] || 0,
            studentAssignedQuizzes: studentAssignedByClass[r.id] || []
        }));

        const classesTeach = enriched.filter(r => r.role === 'teacher');
        const classesStudent = enriched.filter(r => r.role !== 'teacher');
        res.render('classes/index', {
            user: req.session.user,
            classesTeach,
            classesStudent
        });
    } catch (err) {
        console.error('Error loading classes:', err.message);
        res.status(500).send('Failed to load classes');
    }
});

async function requireClassTeacher(req, res, next) {
    const classId = parseInt(req.params.classId);
    const userId = req.session.userId;
    const row = await get(
        'SELECT class_id FROM class_members WHERE class_id = ? AND user_id = ? AND role = ?',
        [classId, userId, 'teacher']
    );
    if (!row) return res.redirect('/classes');
    next();
}

async function requireClassMember(req, res, next) {
    const classId = parseInt(req.params.classId);
    const userId = req.session.userId;
    const row = await get(
        'SELECT class_id FROM class_members WHERE class_id = ? AND user_id = ?',
        [classId, userId]
    );
    if (!row) return res.redirect('/classes');
    next();
}

router.get('/classes/:classId', requireLogin, requireClassTeacher, async (req, res) => {
    const classId = parseInt(req.params.classId);
    const userId = req.session.userId;
    const classItem = await get('SELECT id, name, formbar_class_id FROM classes WHERE id = ?', [classId]);
    if (!classItem) return res.redirect('/classes');

    const courses = await all(
        'SELECT id, name FROM courses WHERE owner_id = ? ORDER BY sort_order, id',
        [userId]
    );
    const assignedCourses = await all(
        'SELECT course_id FROM class_courses WHERE class_id = ?',
        [classId]
    );
    const assignedCourseIds = new Set(assignedCourses.map(r => r.course_id));

    const quizzes = await all(
        `SELECT q.id, q.name, q.course_id
         FROM quizzes q
         JOIN courses c ON q.course_id = c.id
         WHERE c.owner_id = ?
         ORDER BY q.course_id, q.sort_order, q.id`,
        [userId]
    );
    const assignedQuizzes = await all(
        'SELECT quiz_id FROM class_quizzes WHERE class_id = ?',
        [classId]
    );
    const assignedQuizIds = new Set(assignedQuizzes.map(r => r.quiz_id));

    // Build per-student mastery overview for this class (using the first assigned course, if any)
    const students = await all(
        `SELECT u.id, u.username, u.formbar_id
         FROM class_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.class_id = ? AND cm.role = 'student'
         ORDER BY u.username COLLATE NOCASE`,
        [classId]
    );

    let studentMastery = [];
    if (students.length && assignedCourseIds.size > 0) {
        const courseId = Array.from(assignedCourseIds)[0];
        const studentIds = students.map(s => s.id);
        const placeholders = studentIds.map(() => '?').join(',');

        // Get all tasks for this course so overall mastery can be based
        // on the entire course, not just tasks with mastery records.
        const allTasks = await all(
            'SELECT id FROM tasks WHERE course_id = ? ORDER BY sort_order, id',
            [courseId]
        );
        const totalTaskCount = allTasks.length;

        const masteryRows = await all(
            `SELECT tm.user_id, tm.task_id, tm.mastery,
                    t.name as task_name, u.id as unit_id, u.name as unit_name,
                    u.sort_order as unit_order, t.sort_order as task_order
             FROM task_mastery tm
             JOIN tasks t ON tm.task_id = t.id
             LEFT JOIN unit_tasks ut ON ut.task_id = t.id
             LEFT JOIN units u ON ut.unit_id = u.id
             WHERE tm.course_id = ? AND tm.user_id IN (${placeholders})
             ORDER BY tm.user_id, unit_order, unit_id, task_order, t.id`,
            [courseId, ...studentIds]
        );

        const byStudent = {};
        masteryRows.forEach(r => {
            if (!byStudent[r.user_id]) {
                byStudent[r.user_id] = {
                    units: {},
                    totalMastery: 0,
                    masteryCount: 0
                };
            }
            const s = byStudent[r.user_id];
            const unitId = r.unit_id || 0;
            const unitName = r.unit_name || 'Ungrouped';
            if (!s.units[unitId]) {
                s.units[unitId] = {
                    id: r.unit_id,
                    name: unitName,
                    tasks: []
                };
            }
            const m = r.mastery || 0;
            s.units[unitId].tasks.push({
                taskId: r.task_id,
                taskName: r.task_name,
                mastery: m,
                attempts: null,
                taskOrder: r.task_order
            });
            s.totalMastery += m;
            s.masteryCount += 1;
        });

        studentMastery = students.map(st => {
            const s = byStudent[st.id];
            const units = s ? Object.values(s.units) : [];
            const denominator = totalTaskCount > 0 ? totalTaskCount : (s ? s.masteryCount : 0);
            const overall =
                s && denominator > 0 ? s.totalMastery / denominator : 0;
            return {
                id: st.id,
                name: st.username,
                overallMastery: overall,
                units,
                formbarId: st.formbar_id
            };
        });
    } else {
        studentMastery = students.map(st => ({
            id: st.id,
            name: st.username,
            overallMastery: 0,
            units: [],
            formbarId: st.formbar_id
        }));
    }

    res.render('classes/manage', {
        user: req.session.user,
        classItem,
        courses,
        assignedCourseIds,
        quizzes,
        assignedQuizIds,
        studentMastery
    });
});

router.post('/classes/:classId/courses', requireLogin, requireClassTeacher, async (req, res) => {
    const classId = parseInt(req.params.classId);
    const userId = req.session.userId;
    const { course_id, action } = req.body || {};
    const courseId = parseInt(course_id);
    if (!courseId) return res.redirect('/classes/' + classId);

    const owns = await get('SELECT id FROM courses WHERE id = ? AND owner_id = ?', [courseId, userId]);
    if (!owns) return res.redirect('/classes/' + classId);

    if (action === 'assign') {
        await run(
            'INSERT OR IGNORE INTO class_courses (class_id, course_id, assigned_by) VALUES (?, ?, ?)',
            [classId, courseId, userId]
        );
    } else if (action === 'unassign') {
        await run('DELETE FROM class_courses WHERE class_id = ? AND course_id = ?', [classId, courseId]);
    }
    res.redirect('/classes/' + classId);
});

router.post('/classes/:classId/quizzes', requireLogin, requireClassTeacher, async (req, res) => {
    const classId = parseInt(req.params.classId);
    const userId = req.session.userId;
    const { quiz_id, action } = req.body || {};
    const quizId = parseInt(quiz_id);
    if (!quizId) return res.redirect('/classes/' + classId);

    const owns = await get(
        'SELECT q.id FROM quizzes q JOIN courses c ON q.course_id = c.id WHERE q.id = ? AND c.owner_id = ?',
        [quizId, userId]
    );
    if (!owns) return res.redirect('/classes/' + classId);

    if (action === 'assign') {
        await run(
            'INSERT OR IGNORE INTO class_quizzes (class_id, quiz_id, assigned_by) VALUES (?, ?, ?)',
            [classId, quizId, userId]
        );
    } else if (action === 'unassign') {
        await run('DELETE FROM class_quizzes WHERE class_id = ? AND quiz_id = ?', [classId, quizId]);
    }
    res.redirect('/classes/' + classId);
});

router.get('/classes/:classId/quizzes/:quizId/take', requireLogin, requireClassMember, async (req, res) => {
    const classId = parseInt(req.params.classId);
    const quizId = parseInt(req.params.quizId);
    const userId = req.session.userId;

    const classItem = await get('SELECT id, name FROM classes WHERE id = ?', [classId]);
    if (!classItem) return res.redirect('/classes');

    const assigned = await get(
        'SELECT cq.id, cq.quiz_id, q.course_id FROM class_quizzes cq JOIN quizzes q ON cq.quiz_id = q.id WHERE cq.class_id = ? AND cq.quiz_id = ?',
        [classId, quizId]
    );
    if (!assigned) return res.redirect('/classes');

    const attempt = await getOrCreateActiveAttempt(userId, classId, quizId, assigned.course_id);
    res.redirect('/classes/' + classId + '/quizzes/' + quizId + '/take/1?attemptId=' + attempt.id);
});

router.get('/classes/:classId/quizzes/:quizId/take/:index', requireLogin, requireClassMember, async (req, res) => {
    const classId = parseInt(req.params.classId);
    const quizId = parseInt(req.params.quizId);
    const index = Math.max(1, parseInt(req.params.index) || 1);
    const userId = req.session.userId;
    const attemptId = parseInt(req.query.attemptId);

    const classItem = await get('SELECT id, name FROM classes WHERE id = ?', [classId]);
    if (!classItem) return res.redirect('/classes');

    const attempt = await get(
        'SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND class_id = ? AND quiz_id = ?',
        [attemptId, userId, classId, quizId]
    );
    if (!attempt || attempt.completed_at) {
        return res.redirect('/classes');
    }

    const quiz = await get('SELECT id, name FROM quizzes WHERE id = ?', [quizId]);
    const questions = await getAttemptQuestions(attempt.id);
    if (!questions.length || index > questions.length) {
        return res.redirect('/classes/' + classId + '/quizzes/' + quizId + '/take/1?attemptId=' + attempt.id);
    }
    const q = questions[index - 1];
    const questionDots = questions.map((row, i) => ({
        index: i + 1,
        answered: row.chosenIndex != null
    }));

    res.render('quiz/take', {
        user: req.session.user,
        classItem,
        quiz,
        attempt,
        question: q,
        index,
        total: questions.length,
        questionDots
    });
});

router.post('/classes/:classId/quizzes/:quizId/take/:index', requireLogin, requireClassMember, async (req, res) => {
    const classId = parseInt(req.params.classId);
    const quizId = parseInt(req.params.quizId);
    const index = Math.max(1, parseInt(req.params.index) || 1);
    const userId = req.session.userId;
    const attemptId = parseInt(req.body.attemptId);
    const { chosen_index, nav } = req.body || {};

    const attempt = await get(
        'SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND class_id = ? AND quiz_id = ?',
        [attemptId, userId, classId, quizId]
    );
    if (!attempt || attempt.completed_at) {
        return res.redirect('/classes');
    }

    const questions = await getAttemptQuestions(attempt.id);
    if (!questions.length || index > questions.length) {
        return res.redirect('/classes/' + classId + '/quizzes/' + quizId + '/take/1?attemptId=' + attempt.id);
    }
    const q = questions[index - 1];

    if (chosen_index !== undefined && chosen_index !== null && chosen_index !== '') {
        const ci = parseInt(chosen_index);
        if (!Number.isNaN(ci)) {
            await run(
                'UPDATE quiz_attempt_answers SET chosen_index = ? WHERE id = ?',
                [ci, q.answerRowId]
            );
        }
    }

    if (nav === 'prev') {
        const prevIndex = Math.max(1, index - 1);
        return res.redirect('/classes/' + classId + '/quizzes/' + quizId + '/take/' + prevIndex + '?attemptId=' + attempt.id);
    }
    if (nav === 'next') {
        const nextIndex = Math.min(questions.length, index + 1);
        return res.redirect('/classes/' + classId + '/quizzes/' + quizId + '/take/' + nextIndex + '?attemptId=' + attempt.id);
    }
    if (nav === 'submit') {
        return res.redirect('/classes/' + classId + '/quizzes/' + quizId + '/submit?attemptId=' + attempt.id);
    }

    res.redirect('/classes/' + classId + '/quizzes/' + quizId + '/take/' + index + '?attemptId=' + attempt.id);
});

router.get('/classes/:classId/quizzes/:quizId/submit', requireLogin, requireClassMember, async (req, res) => {
    const classId = parseInt(req.params.classId);
    const quizId = parseInt(req.params.quizId);
    const userId = req.session.userId;
    const attemptId = parseInt(req.query.attemptId);

    const attempt = await get(
        'SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND class_id = ? AND quiz_id = ?',
        [attemptId, userId, classId, quizId]
    );
    if (!attempt || attempt.completed_at) {
        return res.redirect('/classes');
    }

    const graded = await gradeAttempt(attempt.id);
    if (!graded) return res.redirect('/classes');
    res.redirect('/classes/' + classId + '/quizzes/' + quizId + '/results/' + attempt.id);
});

router.get('/classes/:classId/quizzes/:quizId/results/:attemptId', requireLogin, requireClassMember, async (req, res) => {
    const classId = parseInt(req.params.classId);
    const quizId = parseInt(req.params.quizId);
    const attemptId = parseInt(req.params.attemptId);
    const userId = req.session.userId;

    const classItem = await get('SELECT id, name FROM classes WHERE id = ?', [classId]);
    if (!classItem) return res.redirect('/classes');

    const attempt = await get(
        'SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND class_id = ? AND quiz_id = ?',
        [attemptId, userId, classId, quizId]
    );
    if (!attempt || !attempt.completed_at) {
        return res.redirect('/classes');
    }

    const quizRow = await get(
        'SELECT q.id, q.name, q.course_id, c.name AS course_name FROM quizzes q JOIN courses c ON q.course_id = c.id WHERE q.id = ?',
        [quizId]
    );
    if (!quizRow) return res.redirect('/classes');
    const quiz = { id: quizRow.id, name: quizRow.name };
    const course = { id: quizRow.course_id, name: quizRow.course_name };
    const answerRows = await all(
        `SELECT qaa.id, qaa.question_id, qaa.chosen_index, qaa.is_correct,
                q.prompt, q.answers
         FROM quiz_attempt_answers qaa
         JOIN questions q ON qaa.question_id = q.id
         WHERE qaa.attempt_id = ?
         ORDER BY qaa.id`,
        [attempt.id]
    );

    const answers = (answerRows || []).map(r => ({
        ...r,
        answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers
    }));

    const statsRows = await all(
        'SELECT task_id, unit_id, is_correct FROM quiz_attempt_answers WHERE attempt_id = ?',
        [attempt.id]
    );
    const taskStats = {};
    const unitStats = {};
    (statsRows || []).forEach(a => {
        const isCorrect = !!a.is_correct;
        const tId = a.task_id;
        const uId = a.unit_id;
        if (tId != null) {
            if (!taskStats[tId]) taskStats[tId] = { total: 0, missed: 0 };
            taskStats[tId].total += 1;
            if (!isCorrect) taskStats[tId].missed += 1;
        }
        if (uId != null) {
            if (!unitStats[uId]) unitStats[uId] = { total: 0, missed: 0 };
            unitStats[uId].total += 1;
            if (!isCorrect) unitStats[uId].missed += 1;
        }
    });
    const breakdown = await getBreakdown(taskStats, unitStats);

    res.render('quiz/results', {
        user: req.session.user,
        classItem,
        quiz,
        attempt,
        answers,
        breakdown,
        course
    });
});

router.get(
    '/classes/:classId/quizzes/:quizId/results/:attemptId/coach',
    requireLogin,
    requireClassMember,
    async (req, res) => {
        const classId = parseInt(req.params.classId);
        const quizId = parseInt(req.params.quizId);
        const attemptId = parseInt(req.params.attemptId);
        const userId = req.session.userId;

        const classItem = await get('SELECT id, name FROM classes WHERE id = ?', [classId]);
        if (!classItem) return res.redirect('/classes');

        const attempt = await get(
            'SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND class_id = ? AND quiz_id = ?',
            [attemptId, userId, classId, quizId]
        );
        if (!attempt || !attempt.completed_at) {
            return res.redirect('/classes');
        }

        const quizRow = await get(
            'SELECT q.id, q.name, q.course_id, c.name AS course_name FROM quizzes q JOIN courses c ON q.course_id = c.id WHERE q.id = ?',
            [quizId]
        );
        if (!quizRow) return res.redirect('/classes');
        const quiz = { id: quizRow.id, name: quizRow.name };
        const course = { id: quizRow.course_id, name: quizRow.course_name };

        const context = await getCoachContext(attempt.id);
        if (!context) {
            return res.render('quiz/coach', {
                user: req.session.user,
                classItem,
                quiz,
                attempt,
                course,
                plan: 'There is not enough data from this attempt for the AI coach to provide suggestions.'
            });
        }

        // Prefer course from context if available, otherwise fall back
        const effectiveCourse = context.course || course || null;
        const plan = await getImprovementPlan({
            course: effectiveCourse,
            units: context.units || [],
            tasks: context.tasks || [],
            missedQuestions: context.missedQuestions || []
        });

        res.render('quiz/coach', {
            user: req.session.user,
            classItem,
            quiz,
            attempt,
            course: effectiveCourse,
            plan
        });
    }
);

router.get('/classes/:classId/mastery', requireLogin, requireClassTeacher, async (req, res) => {
    const classId = parseInt(req.params.classId);
    const classItem = await get('SELECT id, name FROM classes WHERE id = ?', [classId]);
    if (!classItem) return res.redirect('/classes');

    const students = await all(
        'SELECT user_id FROM class_members WHERE class_id = ? AND role = ?',
        [classId, 'student']
    );
    if (!students.length) {
        return res.render('mastery/teacher', {
            user: req.session.user,
            classItem,
            units: []
        });
    }
    const studentIds = students.map(s => s.user_id);

    const courseRows = await all(
        `SELECT DISTINCT cc.course_id, co.name
         FROM class_courses cc
         JOIN courses co ON cc.course_id = co.id
         WHERE cc.class_id = ?`,
        [classId]
    );
    if (!courseRows.length) {
        return res.render('mastery/teacher', {
            user: req.session.user,
            classItem,
            units: []
        });
    }

    const courseId = courseRows[0].course_id;

    const masteryRows = await all(
        `SELECT tm.task_id, tm.mastery,
                t.name as task_name, u.id as unit_id, u.name as unit_name, u.sort_order as unit_order, t.sort_order as task_order
         FROM task_mastery tm
         JOIN tasks t ON tm.task_id = t.id
         LEFT JOIN unit_tasks ut ON ut.task_id = t.id
         LEFT JOIN units u ON ut.unit_id = u.id
         WHERE tm.course_id = ? AND tm.user_id IN (` + studentIds.map(() => '?').join(',') + `)
         ORDER BY unit_order, unit_id, task_order, t.id`,
        [courseId, ...studentIds]
    );

    const byTask = {};
    masteryRows.forEach(r => {
        if (!byTask[r.task_id]) {
            byTask[r.task_id] = {
                taskId: r.task_id,
                taskName: r.task_name,
                unitId: r.unit_id,
                unitName: r.unit_name || 'Ungrouped',
                totalMastery: 0,
                minMastery: null,
                maxMastery: null,
                count: 0
            };
        }
        const t = byTask[r.task_id];
        const m = r.mastery || 0;
        t.totalMastery += m;
        t.minMastery = t.minMastery == null ? m : Math.min(t.minMastery, m);
        t.maxMastery = t.maxMastery == null ? m : Math.max(t.maxMastery, m);
        t.count += 1;
    });

    const units = {};
    let classMasterySum = 0;
    let classMasteryCount = 0;
    Object.values(byTask).forEach(t => {
        const uid = t.unitId || 0;
        if (!units[uid]) {
            units[uid] = {
                id: t.unitId,
                name: t.unitName || 'Ungrouped',
                tasks: []
            };
        }
        units[uid].tasks.push({
            taskId: t.taskId,
            taskName: t.taskName,
            avgMastery: t.count ? t.totalMastery / t.count : 0,
            minMastery: t.minMastery || 0,
            maxMastery: t.maxMastery || 0,
            studentCount: t.count
        });
        if (t.count > 0) {
            classMasterySum += t.totalMastery / t.count;
            classMasteryCount += 1;
        }
    });

    res.render('mastery/teacher', {
        user: req.session.user,
        classItem,
        units: Object.values(units),
        overallMastery: classMasteryCount > 0 ? classMasterySum / classMasteryCount : 0
    });
});

module.exports = router;
