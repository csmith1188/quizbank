const express = require('express');
const { get, all, run } = require('../lib/db');
const { generateQuestions } = require('../lib/question-generator');
const { createRateLimiter } = require('../lib/rate-limit');
const config = require('../lib/config');

const router = express.Router();

const MAX_PICK = config.apiPickMax;
const MAX_GENERATE = config.apiGenerateMax;
const questionGenerateLimiter = createRateLimiter({
    windowMs: config.questionGenerateRateLimitWindowMs,
    max: config.questionGenerateRateLimitMax,
    message: 'Too many question generation requests, please wait a minute'
});

async function resolveUserIdFromParam(studentParam) {
    if (!studentParam) return null;
    const n = parseInt(studentParam, 10);
    if (!Number.isFinite(n)) return null;
    // Try matching by formbar_id first, then by local id as fallback
    const row =
        (await get('SELECT id FROM users WHERE formbar_id = ?', [n])) ||
        (await get('SELECT id FROM users WHERE id = ?', [n]));
    return row ? row.id : null;
}

async function resolveClassIdFromParam(classParam) {
    if (!classParam) return null;
    const n = parseInt(classParam, 10);
    if (!Number.isFinite(n)) return null;
    // formbar-backed classes use formbar_class_id as their external identifier
    const row =
        (await get('SELECT id FROM classes WHERE formbar_class_id = ?', [n])) ||
        (await get('SELECT id FROM classes WHERE id = ?', [n]));
    return row ? row.id : null;
}

function rowToQuestion(row, hierarchy = null) {
    const q = {
        id: row.id,
        ai: row.ai != null ? !!row.ai : false,
        prompt: row.prompt,
        correctAnswer: row.correct_answer,
        correctIndex: row.correct_index,
        answers: typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers
    };
    if (hierarchy) q.hierarchy = hierarchy;
    return q;
}

function getRandomItems(arr, count) {
    const n = Math.min(count, MAX_PICK, arr.length);
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

async function canReadCourse(courseId, req) {
    const course = await get('SELECT id, name, owner_id, is_public FROM courses WHERE id = ?', [courseId]);
    if (!course) return { allowed: false, course: null };
    if (course.is_public) return { allowed: true, course };
    const userId = req.session && req.session.userId;
    const apiKey = req.query.api_key || (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, ''));
    if (userId && parseInt(userId) === course.owner_id) return { allowed: true, course };
    if (apiKey && process.env.API_KEY && apiKey === process.env.API_KEY) return { allowed: true, course };
    return { allowed: false, course };
}

async function canReadUnit(unitId, req) {
    const unit = await get('SELECT id, course_id, name, sort_order FROM units WHERE id = ?', [unitId]);
    if (!unit) return { allowed: false, unit: null, course: null };
    const { allowed, course } = await canReadCourse(unit.course_id, req);
    return { allowed, unit, course };
}

async function canReadTask(taskId, req) {
    const task = await get('SELECT id, course_id, name, target, description FROM tasks WHERE id = ?', [taskId]);
    if (!task) return { allowed: false, task: null, course: null };
    const { allowed, course } = await canReadCourse(task.course_id, req);
    return { allowed, task, course };
}

async function canReadQuestion(questionId, req) {
    const row = await get(
        `SELECT q.id, q.task_id, t.course_id
         FROM questions q
         JOIN tasks t ON q.task_id = t.id
         WHERE q.id = ?`,
        [questionId]
    );
    if (!row) return { allowed: false, question: null, course: null };
    const { allowed, course } = await canReadCourse(row.course_id, req);
    return { allowed, question: row, course };
}

// List all public courses with id, name, and sort_order
router.get('/course', async (req, res) => {
    try {
        const rows = await all(
            'SELECT id, name, sort_order, is_public FROM courses WHERE is_public = 1 ORDER BY sort_order, id'
        );
        res.json(rows.map(r => ({
            id: r.id,
            name: r.name,
            sort_order: r.sort_order,
            is_public: !!r.is_public
        })));
    } catch (err) {
        console.error('Error listing courses via API:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Course details, or pick questions from a course when ?pick=X is present
router.get('/course/:courseId', async (req, res) => {
    const courseId = parseInt(req.params.courseId);
    const { allowed, course } = await canReadCourse(courseId, req);
    if (!allowed || !course) {
        return res
            .status(course ? 403 : 404)
            .json({ error: course ? 'Forbidden' : 'Course not found' });
    }

    // Question picking: /api/course/:courseId?pick=X[&student=formbarId][&class=formbarClassId]
    const pickParam = req.query.pick != null ? parseInt(req.query.pick, 10) : null;
    if (pickParam && pickParam > 0) {
        const count = Math.min(MAX_PICK, Math.max(0, pickParam));
        const studentId = await resolveUserIdFromParam(req.query.student);
        const classId = await resolveClassIdFromParam(req.query.class);

        if (classId != null) {
            return res
                .status(400)
                .json({ error: 'Class-weighted picking is not implemented yet for this endpoint' });
        }

        try {
            let questions;
            if (studentId != null) {
                // Use the same algorithm as Progress Test for a single student
                const { pickProgressQuestions } = require('../lib/progress-quiz');
                const ids = await pickProgressQuestions(studentId, courseId, count);
                if (!ids.length) return res.json([]);
                const placeholders = ids.map(() => '?').join(',');
                const rows = await all(
                    `SELECT q.id, q.prompt, q.correct_answer, q.correct_index, q.answers, q.ai,
                            q.task_id, t.name as task_name,
                            c.id as course_id, c.name as course_name
                     FROM questions q
                     JOIN tasks t ON q.task_id = t.id
                     JOIN courses c ON t.course_id = c.id
                     WHERE q.id IN (${placeholders})
                       AND c.id = ?
                       AND COALESCE(q.quality, '') != 'bad'`,
                    [...ids, courseId]
                );
                questions = rows.map(r =>
                    rowToQuestion(r, {
                        course: { id: r.course_id, name: r.course_name },
                        task: { id: r.task_id, name: r.task_name }
                    })
                );
            } else {
                const allQuestions = await getAllQuestionsForCourse(courseId);
                questions = getRandomItems(allQuestions, count);
            }
            return res.json(questions);
        } catch (err) {
            console.error('Error picking questions for course via API:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Question generation: /api/course/:courseId?generate[=X][&task=taskId][&context=...]
    // Only used when "pick" is not present.
    if (req.query.pick == null && req.query.generate != null) {
        let generationLimited = false;
        await new Promise((resolve) => {
            questionGenerateLimiter(req, res, () => {
                generationLimited = true;
                resolve();
            });
            if (!generationLimited && res.headersSent) resolve();
        });
        if (!generationLimited) return;

        const requestedGenerate = parseInt(req.query.generate, 10);
        const count = Number.isFinite(requestedGenerate) && requestedGenerate > 0
            ? Math.min(MAX_GENERATE, requestedGenerate)
            : MAX_GENERATE;
        const taskParam = parseInt(req.query.task || req.query.taskId, 10);
        const additionalContext = req.query.context != null ? String(req.query.context).trim() : '';

        try {
            let task;
            if (Number.isFinite(taskParam) && taskParam > 0) {
                task = await get(
                    'SELECT id, name, target, description FROM tasks WHERE id = ? AND course_id = ?',
                    [taskParam, courseId]
                );
            } else {
                task = await get(
                    'SELECT id, name, target, description FROM tasks WHERE course_id = ? ORDER BY sort_order, id LIMIT 1',
                    [courseId]
                );
            }
            if (!task) {
                return res.status(404).json({ error: 'Task not found for generation' });
            }

            const exampleRows = await all(
                'SELECT prompt, correct_answer, correct_index, answers, quality, quality_reason FROM questions WHERE task_id = ? AND quality IN (\'good\', \'bad\') ORDER BY RANDOM() LIMIT 20',
                [task.id]
            );
            const parsedExamples = exampleRows.map(r => ({
                ...r,
                answers: typeof r.answers === 'string' ? JSON.parse(r.answers || '[]') : r.answers
            }));
            const goodExamples = parsedExamples.filter(r => r.quality === 'good');
            const badExamples = parsedExamples.filter(r => r.quality === 'bad');

            const questions = await generateQuestions({
                task: { name: task.name, target: task.target, description: task.description },
                goodExamples,
                badExamples,
                count,
                additionalContext: additionalContext || undefined
            });
            return res.json(questions);
        } catch (err) {
            console.error('Error generating questions for course via API:', err);
            return res.status(500).json({ error: err.message || 'Generation failed' });
        }
    }

    // Standard course details
    const units = await all(
        'SELECT id, name, sort_order FROM units WHERE course_id = ? ORDER BY sort_order, id',
        [courseId]
    );
    const tasks = await all(
        'SELECT id, name, target, description, sort_order FROM tasks WHERE course_id = ? ORDER BY sort_order, id',
        [courseId]
    );
    const quizzes = await all(
        'SELECT id, name, sort_order FROM quizzes WHERE course_id = ? ORDER BY sort_order, id',
        [courseId]
    );

    res.json({
        id: course.id,
        name: course.name,
        sort_order: course.sort_order || null,
        is_public: !!course.is_public,
        units: units.map(u => ({ id: u.id, name: u.name, sort_order: u.sort_order })),
        tasks: tasks.map(t => ({
            id: t.id,
            name: t.name,
            target: t.target,
            description: t.description || null,
            sort_order: t.sort_order
        })),
        quizzes: quizzes.map(q => ({ id: q.id, name: q.name, sort_order: q.sort_order }))
    });
});

// Public course vocab: all vocab terms in a course
router.get('/course/:courseId/vocab', async (req, res) => {
    const courseId = parseInt(req.params.courseId);
    const { allowed } = await canReadCourse(courseId, req);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    try {
        const rows = await all(
            'SELECT id, term, definition, sort_order FROM vocab_terms WHERE course_id = ? ORDER BY sort_order, id',
            [courseId]
        );
        const vocab = rows.map(r => ({
            id: r.id,
            term: r.term,
            definition: r.definition || null,
            sort_order: r.sort_order
        }));
        const pickParam = req.query.pick != null ? parseInt(req.query.pick, 10) : null;
        if (pickParam && pickParam > 0) {
            return res.json(getRandomItems(vocab, pickParam));
        }
        res.json(vocab);
    } catch (err) {
        console.error('Error fetching course vocab via API:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Public course units list
router.get('/course/:courseId/unit', async (req, res) => {
    const courseId = parseInt(req.params.courseId);
    const { allowed } = await canReadCourse(courseId, req);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    try {
        const rows = await all(
            'SELECT id, name, sort_order FROM units WHERE course_id = ? ORDER BY sort_order, id',
            [courseId]
        );
        res.json(rows.map(r => ({ id: r.id, name: r.name, sort_order: r.sort_order })));
    } catch (err) {
        console.error('Error fetching course units via API:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Public course quizzes list
router.get('/course/:courseId/quiz', async (req, res) => {
    const courseId = parseInt(req.params.courseId);
    const { allowed } = await canReadCourse(courseId, req);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    try {
        const rows = await all(
            'SELECT id, name, sort_order FROM quizzes WHERE course_id = ? ORDER BY sort_order, id',
            [courseId]
        );
        res.json(rows.map(r => ({ id: r.id, name: r.name, sort_order: r.sort_order })));
    } catch (err) {
        console.error('Error fetching course quizzes via API:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/unit/:unitId', async (req, res) => {
    const unitId = parseInt(req.params.unitId);
    const { allowed, unit } = await canReadUnit(unitId, req);
    if (!allowed) return res.status(unit ? 403 : 404).json({ error: unit ? 'Forbidden' : 'Unit not found' });
    const taskRefs = await all('SELECT task_id, sort_order FROM unit_tasks WHERE unit_id = ? ORDER BY sort_order', [unitId]);
    const vocabRefs = await all('SELECT vocab_term_id, sort_order FROM unit_vocab WHERE unit_id = ? ORDER BY sort_order', [unitId]);
    const taskIds = taskRefs.map(r => r.task_id);
    const tasks = taskIds.length ? await all('SELECT id, name, target, description FROM tasks WHERE id IN (' + taskIds.map(() => '?').join(',') + ')', taskIds) : [];
    const vocabIds = vocabRefs.map(r => r.vocab_term_id);
    const vocab = vocabIds.length ? await all('SELECT id, term, definition FROM vocab_terms WHERE id IN (' + vocabIds.map(() => '?').join(',') + ')', vocabIds) : [];
    res.json({
        id: unit.id,
        name: unit.name,
        sort_order: unit.sort_order,
        tasks: tasks.map(t => ({ id: t.id, name: t.name, target: t.target, description: t.description || null })),
        vocab: vocab.map(v => ({ id: v.id, term: v.term, definition: v.definition || null }))
    });
});

router.get('/task/:taskId', async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    const { allowed, task, course } = await canReadTask(taskId, req);
    if (!allowed) return res.status(task ? 403 : 404).json({ error: task ? 'Forbidden' : 'Task not found' });
    res.json({
        id: task.id,
        name: task.name,
        target: task.target,
        hierarchy: { course: { id: course.id, name: course.name } }
    });
});

router.get('/question/:questionId', async (req, res) => {
    const questionId = parseInt(req.params.questionId);
    const { allowed, question } = await canReadQuestion(questionId, req);
    if (!allowed) return res.status(question ? 403 : 404).json({ error: question ? 'Forbidden' : 'Question not found' });
    const row = await get(
        `SELECT q.id, q.prompt, q.correct_answer, q.correct_index, q.answers, q.ai,
                q.task_id, t.name AS task_name,
                c.id AS course_id, c.name AS course_name
         FROM questions q
         JOIN tasks t ON q.task_id = t.id
         JOIN courses c ON t.course_id = c.id
         WHERE q.id = ?
           AND COALESCE(q.quality, '') != 'bad'`,
        [questionId]
    );
    if (!row) return res.status(404).json({ error: 'Question not found' });
    const hierarchy = {
        course: { id: row.course_id, name: row.course_name },
        task: { id: row.task_id, name: row.task_name }
    };
    res.json(rowToQuestion(row, hierarchy));
});

async function getQuestionsForUnit(unitId) {
    const rows = await all(
        `SELECT q.id, q.prompt, q.correct_answer, q.correct_index, q.answers, q.ai,
                q.task_id, t.name as task_name,
                u.id as unit_id, u.name as unit_name,
                c.id as course_id, c.name as course_name
         FROM questions q
         JOIN tasks t ON q.task_id = t.id
         JOIN unit_tasks ut ON ut.task_id = t.id
         JOIN units u ON ut.unit_id = u.id
         JOIN courses c ON t.course_id = c.id
         WHERE u.id = ?
           AND COALESCE(q.quality, '') != 'bad'`,
        [unitId]
    );
    return rows.map(r =>
        rowToQuestion(r, {
            course: { id: r.course_id, name: r.course_name },
            unit: { id: r.unit_id, name: r.unit_name },
            task: { id: r.task_id, name: r.task_name }
        })
    );
}

async function getQuestionsForTask(taskId) {
    const rows = await all(
        `SELECT q.id, q.prompt, q.correct_answer, q.correct_index, q.answers, q.ai,
                q.task_id, t.name as task_name,
                c.id as course_id, c.name as course_name
         FROM questions q
         JOIN tasks t ON q.task_id = t.id
         JOIN courses c ON t.course_id = c.id
         WHERE q.task_id = ?
           AND COALESCE(q.quality, '') != 'bad'`,
        [taskId]
    );
    return rows.map(r =>
        rowToQuestion(r, {
            course: { id: r.course_id, name: r.course_name },
            task: { id: r.task_id, name: r.task_name }
        })
    );
}

async function getAllQuestionsForCourse(courseId) {
    const rows = await all(
        `SELECT q.id, q.prompt, q.correct_answer, q.correct_index, q.answers, q.ai,
                q.task_id, t.name as task_name,
                c.id as course_id, c.name as course_name
         FROM questions q
         JOIN tasks t ON q.task_id = t.id
         JOIN courses c ON t.course_id = c.id
         WHERE c.id = ?
           AND COALESCE(q.quality, '') != 'bad'`,
        [courseId]
    );
    return rows.map(r =>
        rowToQuestion(r, {
            course: { id: r.course_id, name: r.course_name },
            task: { id: r.task_id, name: r.task_name }
        })
    );
}

router.get('/unit/:unitId/questions', async (req, res) => {
    const unitId = parseInt(req.params.unitId);
    const { allowed, unit } = await canReadUnit(unitId, req);
    if (!allowed) return res.status(unit ? 403 : 404).json({ error: unit ? 'Forbidden' : 'Unit not found' });
    const questions = await getQuestionsForUnit(unitId);
    res.json(questions);
});

router.get('/task/:taskId/questions', async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    const { allowed, task } = await canReadTask(taskId, req);
    if (!allowed) return res.status(task ? 403 : 404).json({ error: task ? 'Forbidden' : 'Task not found' });
    const questions = await getQuestionsForTask(taskId);
    res.json(questions);
});

router.get('/unit/:unitId/vocab', async (req, res) => {
    const unitId = parseInt(req.params.unitId);
    const { allowed, unit } = await canReadUnit(unitId, req);
    if (!allowed) return res.status(unit ? 403 : 404).json({ error: unit ? 'Forbidden' : 'Unit not found' });
    try {
        const rows = await all(
            `SELECT v.id, v.term, v.definition, uv.sort_order
             FROM unit_vocab uv
             JOIN vocab_terms v ON uv.vocab_term_id = v.id
             WHERE uv.unit_id = ?
             ORDER BY uv.sort_order, v.id`,
            [unitId]
        );
        const vocab = rows.map(r => ({
            id: r.id,
            term: r.term,
            definition: r.definition || null,
            sort_order: r.sort_order
        }));
        const pickParam = req.query.pick != null ? parseInt(req.query.pick, 10) : null;
        if (pickParam && pickParam > 0) {
            return res.json(getRandomItems(vocab, pickParam));
        }
        res.json(vocab);
    } catch (err) {
        console.error('Error fetching unit vocab via API:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function requireCourseOwner(req, res, next) {
    const courseId = parseInt(req.params.courseId || req.params.id || req.body.course_id);
    if (!courseId) return res.status(400).json({ error: 'Course id required' });
    const course = await get('SELECT owner_id FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const userId = req.session && req.session.userId;
    if (!userId || parseInt(userId) !== course.owner_id) return res.status(403).json({ error: 'Forbidden' });
    req.courseId = courseId;
    next();
}

router.post('/courses', async (req, res) => {
    const userId = req.session && req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name, is_public } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM courses WHERE owner_id = ?', [userId]);
    await run('INSERT INTO courses (owner_id, name, is_public, sort_order) VALUES (?, ?, ?, ?)', [userId, name, is_public ? 1 : 0, maxOrder.n]);
    const row = await get('SELECT id, name, is_public, sort_order, created_at FROM courses ORDER BY id DESC LIMIT 1');
    res.status(201).json(row);
});

router.get('/courses', async (req, res) => {
    const userId = req.session && req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await all('SELECT id, name, is_public, sort_order, created_at FROM courses WHERE owner_id = ? ORDER BY sort_order, id', [userId]);
    res.json(rows);
});

router.patch('/courses/:id', requireCourseOwner, async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, is_public, sort_order } = req.body || {};
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (is_public !== undefined) { updates.push('is_public = ?'); params.push(is_public ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(parseInt(sort_order)); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(id);
    await run('UPDATE courses SET ' + updates.join(', ') + ' WHERE id = ?', params);
    const row = await get('SELECT id, name, is_public, sort_order, created_at FROM courses WHERE id = ?', [id]);
    res.json(row);
});

router.delete('/courses/:id', requireCourseOwner, async (req, res) => {
    const courseId = req.courseId;

    try {
        // 1) Remove mastery for this course for any students in any class
        //    that had the course assigned.
        const classRows = await all(
            'SELECT DISTINCT class_id FROM class_courses WHERE course_id = ?',
            [courseId]
        );
        if (classRows && classRows.length) {
            const classIds = classRows.map(r => r.class_id);
            const placeholders = classIds.map(() => '?').join(',');
            const studentRows = await all(
                `SELECT DISTINCT user_id
                 FROM class_members
                 WHERE class_id IN (${placeholders}) AND role = 'student'`,
                classIds
            );
            const studentIds = (studentRows || []).map(r => r.user_id);
            if (studentIds.length) {
                const studentPlaceholders = studentIds.map(() => '?').join(',');
                await run(
                    `DELETE FROM task_mastery
                     WHERE course_id = ?
                       AND user_id IN (${studentPlaceholders})`,
                    [courseId, ...studentIds]
                );
            }
        }

        // 2) Delete quiz attempts (answers cascade) for quizzes in this course.
        const quizRows = await all('SELECT id FROM quizzes WHERE course_id = ?', [courseId]);
        if (quizRows && quizRows.length) {
            const quizIds = quizRows.map(r => r.id);
            const quizPlaceholders = quizIds.map(() => '?').join(',');
            await run(
                `DELETE FROM quiz_attempts WHERE quiz_id IN (${quizPlaceholders})`,
                quizIds
            );
        }

        // 3) Delete questions (and quiz_questions) for tasks in this course.
        const taskRows = await all('SELECT id FROM tasks WHERE course_id = ?', [courseId]);
        if (taskRows && taskRows.length) {
            const taskIds = taskRows.map(r => r.id);
            const taskPlaceholders = taskIds.map(() => '?').join(',');
            const questionRows = await all(
                `SELECT id FROM questions WHERE task_id IN (${taskPlaceholders})`,
                taskIds
            );
            if (questionRows && questionRows.length) {
                const questionIds = questionRows.map(r => r.id);
                const qPlaceholders = questionIds.map(() => '?').join(',');
                await run(
                    `DELETE FROM quiz_questions WHERE question_id IN (${qPlaceholders})`,
                    questionIds
                );
                await run(
                    `DELETE FROM questions WHERE id IN (${qPlaceholders})`,
                    questionIds
                );
            }
        }

        // 4) Delete tasks, vocab, units, and quizzes for this course.
        await run('DELETE FROM tasks WHERE course_id = ?', [courseId]);
        await run('DELETE FROM vocab_terms WHERE course_id = ?', [courseId]);
        await run('DELETE FROM units WHERE course_id = ?', [courseId]);
        await run('DELETE FROM quizzes WHERE course_id = ?', [courseId]);
    } catch (err) {
        console.error('Error cleaning up task_mastery via API when deleting course', courseId, err);
    }

    await run('DELETE FROM courses WHERE id = ?', [courseId]);
    res.status(204).send();
});

router.put('/courses/reorder', async (req, res) => {
    const userId = req.session && req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const courseIds = ids.map(id => parseInt(id)).filter(Boolean);
    for (let i = 0; i < courseIds.length; i++) {
        const course = await get('SELECT id FROM courses WHERE id = ? AND owner_id = ?', [courseIds[i], userId]);
        if (!course) return res.status(403).json({ error: 'Not allowed to reorder one or more courses' });
        await run('UPDATE courses SET sort_order = ? WHERE id = ?', [i, courseIds[i]]);
    }
    res.json({ ok: true });
});

router.post('/courses/:courseId/tasks', requireCourseOwner, async (req, res) => {
    const { name, target, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM tasks WHERE course_id = ?', [req.courseId]);
    await run(
        'INSERT INTO tasks (course_id, name, target, description, sort_order) VALUES (?, ?, ?, ?, ?)',
        [req.courseId, name, target || null, (description || '').trim() || null, maxOrder.n]
    );
    const row = await get('SELECT id, course_id, name, target, description, sort_order FROM tasks ORDER BY id DESC LIMIT 1');
    res.status(201).json(row);
});

router.patch('/courses/:courseId/tasks/:taskId', requireCourseOwner, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    const task = await get('SELECT id FROM tasks WHERE id = ? AND course_id = ?', [taskId, req.courseId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const { name, target, description, sort_order } = req.body || {};
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (target !== undefined) { updates.push('target = ?'); params.push(target); }
    if (description !== undefined) { updates.push('description = ?'); params.push((description || '').trim() || null); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(parseInt(sort_order)); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(taskId);
    await run('UPDATE tasks SET ' + updates.join(', ') + ' WHERE id = ?', params);
    const row = await get('SELECT id, course_id, name, target, description, sort_order FROM tasks WHERE id = ?', [taskId]);
    res.json(row);
});

router.delete('/courses/:courseId/tasks/:taskId', requireCourseOwner, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    const task = await get('SELECT id FROM tasks WHERE id = ? AND course_id = ?', [taskId, req.courseId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await run('DELETE FROM tasks WHERE id = ?', [taskId]);
    res.status(204).send();
});

router.put('/courses/:courseId/tasks/reorder', requireCourseOwner, async (req, res) => {
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const taskIds = ids.map(id => parseInt(id)).filter(Boolean);
    for (let i = 0; i < taskIds.length; i++) {
        const task = await get('SELECT id FROM tasks WHERE id = ? AND course_id = ?', [taskIds[i], req.courseId]);
        if (!task) return res.status(403).json({ error: 'Invalid task in list' });
        await run('UPDATE tasks SET sort_order = ? WHERE id = ?', [i, taskIds[i]]);
    }
    res.json({ ok: true });
});

router.post('/courses/:courseId/tasks/:taskId/questions', requireCourseOwner, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    const task = await get('SELECT id FROM tasks WHERE id = ? AND course_id = ?', [taskId, req.courseId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const { prompt, correctAnswer, correctIndex, answers } = req.body || {};
    if (!prompt || !answers || !Array.isArray(answers)) return res.status(400).json({ error: 'prompt and answers array required' });
    const idx = correctIndex != null ? parseInt(correctIndex) : 0;
    await run('INSERT INTO questions (task_id, prompt, correct_answer, correct_index, answers, ai) VALUES (?, ?, ?, ?, ?, ?)',
        [taskId, prompt, correctAnswer || '', idx, JSON.stringify(answers), req.body.ai ? 1 : 0]);
    const row = await get('SELECT id, task_id, prompt, correct_answer, correct_index, answers FROM questions ORDER BY id DESC LIMIT 1');
    res.status(201).json({ id: row.id, task_id: row.task_id, prompt: row.prompt, correctAnswer: row.correct_answer, correctIndex: row.correct_index, answers: JSON.parse(row.answers) });
});

router.patch('/courses/:courseId/questions/:questionId', requireCourseOwner, async (req, res) => {
    const questionId = parseInt(req.params.questionId);
    const q = await get('SELECT q.id, q.task_id FROM questions q JOIN tasks t ON q.task_id = t.id WHERE q.id = ? AND t.course_id = ?', [questionId, req.courseId]);
    if (!q) return res.status(404).json({ error: 'Question not found' });
    const { prompt, correctAnswer, correctIndex, answers } = req.body || {};
    const updates = [];
    const params = [];
    if (prompt !== undefined) { updates.push('prompt = ?'); params.push(prompt); }
    if (correctAnswer !== undefined) { updates.push('correct_answer = ?'); params.push(correctAnswer); }
    if (correctIndex !== undefined) { updates.push('correct_index = ?'); params.push(parseInt(correctIndex)); }
    if (answers !== undefined) { updates.push('answers = ?'); params.push(JSON.stringify(answers)); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(questionId);
    await run('UPDATE questions SET ' + updates.join(', ') + ' WHERE id = ?', params);
    const row = await get('SELECT id, task_id, prompt, correct_answer, correct_index, answers FROM questions WHERE id = ?', [questionId]);
    res.json({ id: row.id, task_id: row.task_id, prompt: row.prompt, correctAnswer: row.correct_answer, correctIndex: row.correct_index, answers: JSON.parse(row.answers) });
});

router.delete('/courses/:courseId/questions/:questionId', requireCourseOwner, async (req, res) => {
    const questionId = parseInt(req.params.questionId);
    const q = await get('SELECT q.id FROM questions q JOIN tasks t ON q.task_id = t.id WHERE q.id = ? AND t.course_id = ?', [questionId, req.courseId]);
    if (!q) return res.status(404).json({ error: 'Question not found' });
    await run('DELETE FROM questions WHERE id = ?', [questionId]);
    res.status(204).send();
});

router.post('/courses/:courseId/vocab', requireCourseOwner, async (req, res) => {
    const { term, definition } = req.body || {};
    if (!term) return res.status(400).json({ error: 'term required' });
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM vocab_terms WHERE course_id = ?', [req.courseId]);
    await run('INSERT INTO vocab_terms (course_id, term, definition, sort_order) VALUES (?, ?, ?, ?)', [req.courseId, term, (definition || '').trim() || null, maxOrder.n]);
    const row = await get('SELECT id, course_id, term, definition, sort_order FROM vocab_terms ORDER BY id DESC LIMIT 1');
    res.status(201).json(row);
});

router.get('/courses/:courseId/vocab', requireCourseOwner, async (req, res) => {
    const rows = await all('SELECT id, term, definition, sort_order FROM vocab_terms WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    res.json(rows);
});

router.patch('/courses/:courseId/vocab/:vocabId', requireCourseOwner, async (req, res) => {
    const vocabId = parseInt(req.params.vocabId);
    const v = await get('SELECT id FROM vocab_terms WHERE id = ? AND course_id = ?', [vocabId, req.courseId]);
    if (!v) return res.status(404).json({ error: 'Vocab term not found' });
    const { term, definition, sort_order } = req.body || {};
    const updates = [];
    const params = [];
    if (term !== undefined) { updates.push('term = ?'); params.push(term); }
    if (definition !== undefined) { updates.push('definition = ?'); params.push(definition === '' || definition === null ? null : definition); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(parseInt(sort_order)); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(vocabId);
    await run('UPDATE vocab_terms SET ' + updates.join(', ') + ' WHERE id = ?', params);
    const row = await get('SELECT id, course_id, term, definition, sort_order FROM vocab_terms WHERE id = ?', [vocabId]);
    res.json(row);
});

router.delete('/courses/:courseId/vocab/:vocabId', requireCourseOwner, async (req, res) => {
    const vocabId = parseInt(req.params.vocabId);
    const v = await get('SELECT id FROM vocab_terms WHERE id = ? AND course_id = ?', [vocabId, req.courseId]);
    if (!v) return res.status(404).json({ error: 'Vocab term not found' });
    await run('DELETE FROM vocab_terms WHERE id = ?', [vocabId]);
    res.status(204).send();
});

router.put('/courses/:courseId/vocab/reorder', requireCourseOwner, async (req, res) => {
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const vocabIds = ids.map(id => parseInt(id)).filter(Boolean);
    for (let i = 0; i < vocabIds.length; i++) {
        const v = await get('SELECT id FROM vocab_terms WHERE id = ? AND course_id = ?', [vocabIds[i], req.courseId]);
        if (!v) return res.status(403).json({ error: 'Invalid vocab term in list' });
        await run('UPDATE vocab_terms SET sort_order = ? WHERE id = ?', [i, vocabIds[i]]);
    }
    res.json({ ok: true });
});

router.put('/classes/reorder', async (req, res) => {
    const userId = req.session && req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const classIds = ids.map(id => parseInt(id)).filter(Boolean);
    // Only allow reordering classes the user is a member of
    for (let i = 0; i < classIds.length; i++) {
        const row = await get('SELECT class_id FROM class_members WHERE class_id = ? AND user_id = ?', [classIds[i], userId]);
        if (!row) return res.status(403).json({ error: 'Not allowed to reorder one or more classes' });
        await run('UPDATE classes SET sort_order = ? WHERE id = ?', [i, classIds[i]]);
    }
    res.json({ ok: true });
});

router.post('/courses/:courseId/units', requireCourseOwner, async (req, res) => {
    const { name, sort_order } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const order = sort_order != null ? parseInt(sort_order) : (await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM units WHERE course_id = ?', [req.courseId])).n;
    await run('INSERT INTO units (course_id, name, sort_order) VALUES (?, ?, ?)', [req.courseId, name, order]);
    const row = await get('SELECT id, course_id, name, sort_order FROM units ORDER BY id DESC LIMIT 1');
    res.status(201).json(row);
});

router.get('/courses/:courseId/units', requireCourseOwner, async (req, res) => {
    const rows = await all('SELECT id, name, sort_order FROM units WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    res.json(rows);
});

router.patch('/courses/:courseId/units/:unitId', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.unitId);
    const u = await get('SELECT id FROM units WHERE id = ? AND course_id = ?', [unitId, req.courseId]);
    if (!u) return res.status(404).json({ error: 'Unit not found' });
    const { name, sort_order } = req.body || {};
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(parseInt(sort_order)); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(unitId);
    await run('UPDATE units SET ' + updates.join(', ') + ' WHERE id = ?', params);
    const row = await get('SELECT id, course_id, name, sort_order FROM units WHERE id = ?', [unitId]);
    res.json(row);
});

router.put('/courses/:courseId/units/reorder', requireCourseOwner, async (req, res) => {
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const unitIds = ids.map(id => parseInt(id)).filter(Boolean);
    for (let i = 0; i < unitIds.length; i++) {
        const u = await get('SELECT id FROM units WHERE id = ? AND course_id = ?', [unitIds[i], req.courseId]);
        if (!u) return res.status(403).json({ error: 'Invalid unit in list' });
        await run('UPDATE units SET sort_order = ? WHERE id = ?', [i, unitIds[i]]);
    }
    res.json({ ok: true });
});

router.delete('/courses/:courseId/units/:unitId', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.unitId);
    const u = await get('SELECT id FROM units WHERE id = ? AND course_id = ?', [unitId, req.courseId]);
    if (!u) return res.status(404).json({ error: 'Unit not found' });
    await run('DELETE FROM units WHERE id = ?', [unitId]);
    res.status(204).send();
});

router.post('/courses/:courseId/units/:unitId/tasks', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.unitId);
    const u = await get('SELECT id FROM units WHERE id = ? AND course_id = ?', [unitId, req.courseId]);
    if (!u) return res.status(404).json({ error: 'Unit not found' });
    const taskId = parseInt(req.body.task_id);
    const task = await get('SELECT id FROM tasks WHERE id = ? AND course_id = ?', [taskId, req.courseId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM unit_tasks WHERE unit_id = ?', [unitId]);
    await run('INSERT OR IGNORE INTO unit_tasks (unit_id, task_id, sort_order) VALUES (?, ?, ?)', [unitId, taskId, maxOrder.n]);
    res.status(201).json({ unit_id: unitId, task_id: taskId });
});

router.delete('/courses/:courseId/units/:unitId/tasks/:taskId', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.unitId);
    const taskId = parseInt(req.params.taskId);
    await run('DELETE FROM unit_tasks WHERE unit_id = ? AND task_id = ?', [unitId, taskId]);
    res.status(204).send();
});

router.put('/courses/:courseId/units/:unitId/tasks/reorder', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.unitId);
    const u = await get('SELECT id FROM units WHERE id = ? AND course_id = ?', [unitId, req.courseId]);
    if (!u) return res.status(404).json({ error: 'Unit not found' });
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const taskIds = ids.map(id => parseInt(id)).filter(Boolean);
    for (let i = 0; i < taskIds.length; i++) {
        const t = await get('SELECT task_id FROM unit_tasks WHERE unit_id = ? AND task_id = ?', [unitId, taskIds[i]]);
        if (!t) return res.status(403).json({ error: 'Invalid task in unit' });
        await run('UPDATE unit_tasks SET sort_order = ? WHERE unit_id = ? AND task_id = ?', [i, unitId, taskIds[i]]);
    }
    res.json({ ok: true });
});

router.post('/courses/:courseId/units/:unitId/vocab', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.unitId);
    const u = await get('SELECT id FROM units WHERE id = ? AND course_id = ?', [unitId, req.courseId]);
    if (!u) return res.status(404).json({ error: 'Unit not found' });
    const vocabTermId = parseInt(req.body.vocab_term_id);
    const v = await get('SELECT id FROM vocab_terms WHERE id = ? AND course_id = ?', [vocabTermId, req.courseId]);
    if (!v) return res.status(404).json({ error: 'Vocab term not found' });
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM unit_vocab WHERE unit_id = ?', [unitId]);
    await run('INSERT OR IGNORE INTO unit_vocab (unit_id, vocab_term_id, sort_order) VALUES (?, ?, ?)', [unitId, vocabTermId, maxOrder.n]);
    res.status(201).json({ unit_id: unitId, vocab_term_id: vocabTermId });
});

router.delete('/courses/:courseId/units/:unitId/vocab/:vocabTermId', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.unitId);
    const vocabTermId = parseInt(req.params.vocabTermId);
    await run('DELETE FROM unit_vocab WHERE unit_id = ? AND vocab_term_id = ?', [unitId, vocabTermId]);
    res.status(204).send();
});

router.put('/courses/:courseId/units/:unitId/vocab/reorder', requireCourseOwner, async (req, res) => {
    const unitId = parseInt(req.params.unitId);
    const u = await get('SELECT id FROM units WHERE id = ? AND course_id = ?', [unitId, req.courseId]);
    if (!u) return res.status(404).json({ error: 'Unit not found' });
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const vocabTermIds = ids.map(id => parseInt(id)).filter(Boolean);
    for (let i = 0; i < vocabTermIds.length; i++) {
        const v = await get('SELECT vocab_term_id FROM unit_vocab WHERE unit_id = ? AND vocab_term_id = ?', [unitId, vocabTermIds[i]]);
        if (!v) return res.status(403).json({ error: 'Invalid vocab in unit' });
        await run('UPDATE unit_vocab SET sort_order = ? WHERE unit_id = ? AND vocab_term_id = ?', [i, unitId, vocabTermIds[i]]);
    }
    res.json({ ok: true });
});

router.post('/courses/:courseId/quizzes', requireCourseOwner, async (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM quizzes WHERE course_id = ?', [req.courseId]);
    await run('INSERT INTO quizzes (course_id, name, sort_order) VALUES (?, ?, ?)', [req.courseId, name, maxOrder.n]);
    const row = await get('SELECT id, course_id, name, sort_order, created_at FROM quizzes ORDER BY id DESC LIMIT 1');
    res.status(201).json(row);
});

router.get('/courses/:courseId/quizzes', requireCourseOwner, async (req, res) => {
    const rows = await all('SELECT id, course_id, name, sort_order, created_at FROM quizzes WHERE course_id = ? ORDER BY sort_order, id', [req.courseId]);
    res.json(rows);
});

router.patch('/courses/:courseId/quizzes/:quizId', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.quizId);
    const q = await get('SELECT id FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (!q) return res.status(404).json({ error: 'Quiz not found' });
    const { name, sort_order } = req.body || {};
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(parseInt(sort_order)); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(quizId);
    await run('UPDATE quizzes SET ' + updates.join(', ') + ' WHERE id = ?', params);
    const row = await get('SELECT id, course_id, name, sort_order, created_at FROM quizzes WHERE id = ?', [quizId]);
    res.json(row);
});

router.delete('/courses/:courseId/quizzes/:quizId', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.quizId);
    const q = await get('SELECT id FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (!q) return res.status(404).json({ error: 'Quiz not found' });
    await run('DELETE FROM quizzes WHERE id = ?', [quizId]);
    res.status(204).send();
});

router.put('/courses/:courseId/quizzes/reorder', requireCourseOwner, async (req, res) => {
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const quizIds = ids.map(id => parseInt(id)).filter(Boolean);
    for (let i = 0; i < quizIds.length; i++) {
        const q = await get('SELECT id FROM quizzes WHERE id = ? AND course_id = ?', [quizIds[i], req.courseId]);
        if (!q) return res.status(403).json({ error: 'Invalid quiz in list' });
        await run('UPDATE quizzes SET sort_order = ? WHERE id = ?', [i, quizIds[i]]);
    }
    res.json({ ok: true });
});

router.post('/courses/:courseId/quizzes/:quizId/items', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.quizId);
    const q = await get('SELECT id FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (!q) return res.status(404).json({ error: 'Quiz not found' });
    const { source_type, source_id, pick_mode, count } = req.body || {};
    if (!source_type || !source_id || !pick_mode) return res.status(400).json({ error: 'source_type, source_id, pick_mode required' });
    const { pickQuestionsForSource } = require('../lib/quiz-resolve');
    const questions = await pickQuestionsForSource(source_type, parseInt(source_id), req.courseId, pick_mode, count != null ? parseInt(count) : null);
    if (!questions.length) return res.status(400).json({ error: 'No questions to add' });
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) + 1 as n FROM quiz_questions WHERE quiz_id = ?', [quizId]);
    let sortOrder = maxOrder.n;
    for (const question of questions) {
        await run('INSERT INTO quiz_questions (quiz_id, question_id, sort_order) VALUES (?, ?, ?)', [quizId, question.id, sortOrder++]);
    }
    const rows = await all('SELECT id, question_id, sort_order FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order', [quizId]);
    res.status(201).json({ added: questions.length, items: rows });
});

router.get('/courses/:courseId/quizzes/:quizId/items', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.quizId);
    const q = await get('SELECT id FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (!q) return res.status(404).json({ error: 'Quiz not found' });
    const rows = await all(
        `SELECT qq.id, qq.question_id, qq.sort_order, q.prompt
         FROM quiz_questions qq
         JOIN questions q ON qq.question_id = q.id
         JOIN tasks t ON q.task_id = t.id
         WHERE qq.quiz_id = ? AND t.course_id = ?
         ORDER BY qq.sort_order`,
        [quizId, req.courseId]
    );
    res.json(rows.map(r => ({ id: r.id, question_id: r.question_id, sort_order: r.sort_order, prompt: r.prompt })));
});

router.delete('/courses/:courseId/quizzes/:quizId/items/:itemId', requireCourseOwner, async (req, res) => {
    const itemId = parseInt(req.params.itemId);
    const row = await get('SELECT qq.id FROM quiz_questions qq JOIN quizzes q ON qq.quiz_id = q.id WHERE qq.id = ? AND q.course_id = ?', [itemId, req.courseId]);
    if (!row) return res.status(404).json({ error: 'Quiz question not found' });
    await run('DELETE FROM quiz_questions WHERE id = ?', [itemId]);
    res.status(204).send();
});

router.put('/courses/:courseId/quizzes/:quizId/items/reorder', requireCourseOwner, async (req, res) => {
    const quizId = parseInt(req.params.quizId);
    const q = await get('SELECT id FROM quizzes WHERE id = ? AND course_id = ?', [quizId, req.courseId]);
    if (!q) return res.status(404).json({ error: 'Quiz not found' });
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const itemIds = ids.map(id => parseInt(id)).filter(Boolean);
    for (let i = 0; i < itemIds.length; i++) {
        const item = await get('SELECT id FROM quiz_questions WHERE id = ? AND quiz_id = ?', [itemIds[i], quizId]);
        if (!item) return res.status(403).json({ error: 'Invalid item in quiz' });
        await run('UPDATE quiz_questions SET sort_order = ? WHERE id = ?', [i, itemIds[i]]);
    }
    res.json({ ok: true });
});

module.exports = router;
