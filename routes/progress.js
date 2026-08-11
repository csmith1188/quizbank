const express = require('express');
const { get, all, run } = require('../lib/db');
const {
    getAttemptQuestions,
    gradeAttempt,
    getBreakdown,
    getCoachContext
} = require('../lib/quiz-attempts');
const { getImprovementPlan } = require('../lib/ai-coach');

const router = express.Router();

function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

router.get('/progress/:attemptId/take/:index', requireLogin, async (req, res) => {
    const attemptId = parseInt(req.params.attemptId);
    const index = Math.max(1, parseInt(req.params.index) || 1);
    const userId = req.session.userId;

    const attempt = await get(
        'SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND is_progress_quiz = 1',
        [attemptId, userId]
    );
    if (!attempt || attempt.completed_at) {
        return res.redirect('/classes');
    }

    const classItem = await get('SELECT id, name FROM classes WHERE id = ?', [attempt.class_id]);
    if (!classItem) return res.redirect('/classes');

    const courseRow = await get('SELECT id, name FROM courses WHERE id = (SELECT course_id FROM tasks WHERE id = (SELECT task_id FROM quiz_attempt_answers WHERE attempt_id = ? LIMIT 1))', [attempt.id]);
    const quiz = { id: 0, name: courseRow ? (courseRow.name + ' - Progress Test') : 'Progress Test' };

    const questions = await getAttemptQuestions(attempt.id);
    if (!questions.length || index > questions.length) {
        return res.redirect('/progress/' + attempt.id + '/take/1');
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

router.post('/progress/:attemptId/take/:index', requireLogin, async (req, res) => {
    const attemptId = parseInt(req.params.attemptId);
    const index = Math.max(1, parseInt(req.params.index) || 1);
    const userId = req.session.userId;
    const { chosen_index, nav } = req.body || {};

    const attempt = await get(
        'SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND is_progress_quiz = 1',
        [attemptId, userId]
    );
    if (!attempt || attempt.completed_at) {
        return res.redirect('/classes');
    }

    const questions = await getAttemptQuestions(attempt.id);
    if (!questions.length || index > questions.length) {
        return res.redirect('/progress/' + attempt.id + '/take/1');
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
        return res.redirect('/progress/' + attempt.id + '/take/' + prevIndex);
    }
    if (nav === 'next') {
        const nextIndex = Math.min(questions.length, index + 1);
        return res.redirect('/progress/' + attempt.id + '/take/' + nextIndex);
    }
    if (nav === 'submit') {
        return res.redirect('/progress/' + attempt.id + '/submit');
    }

    res.redirect('/progress/' + attempt.id + '/take/' + index);
});

router.get('/progress/:attemptId/submit', requireLogin, async (req, res) => {
    const attemptId = parseInt(req.params.attemptId);
    const userId = req.session.userId;

    const attempt = await get(
        'SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND is_progress_quiz = 1',
        [attemptId, userId]
    );
    if (!attempt || attempt.completed_at) {
        return res.redirect('/classes');
    }

    const graded = await gradeAttempt(attempt.id);
    if (!graded) return res.redirect('/classes');

    res.redirect('/progress/' + attempt.id + '/results');
});

router.get('/progress/:attemptId/results', requireLogin, async (req, res) => {
    const attemptId = parseInt(req.params.attemptId);
    const userId = req.session.userId;

    const attempt = await get(
        'SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND is_progress_quiz = 1',
        [attemptId, userId]
    );
    if (!attempt || !attempt.completed_at) {
        return res.redirect('/classes');
    }

    const classItem = await get('SELECT id, name FROM classes WHERE id = ?', [attempt.class_id]);
    if (!classItem) return res.redirect('/classes');

    const answerRows = await all(
        `SELECT qaa.id, qaa.question_id, qaa.chosen_index, qaa.is_correct,
                q.prompt, q.answers, q.correct_index
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

    const courseRow = await get('SELECT course_id FROM tasks WHERE id = (SELECT task_id FROM quiz_attempt_answers WHERE attempt_id = ? LIMIT 1)', [attempt.id]);
    const course = courseRow ? await get('SELECT id, name FROM courses WHERE id = ?', [courseRow.course_id]) : null;
    const quiz = { id: 0, name: course ? (course.name + ' - Progress Test') : 'Progress Test' };

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

// Overall knowledge test routes (metadata.type = 'overall', is_progress_quiz = 0)

router.get('/overall/:attemptId/take/:index', requireLogin, async (req, res) => {
    const attemptId = parseInt(req.params.attemptId);
    const index = Math.max(1, parseInt(req.params.index) || 1);
    const userId = req.session.userId;

    const attempt = await get(
        "SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND is_progress_quiz = 0 AND json_extract(metadata, '$.type') = 'overall'",
        [attemptId, userId]
    );
    if (!attempt || attempt.completed_at) {
        return res.redirect('/classes');
    }

    const classItem = await get('SELECT id, name FROM classes WHERE id = ?', [attempt.class_id]);
    if (!classItem) return res.redirect('/classes');

    const courseRow = await get(
        'SELECT course_id FROM tasks WHERE id = (SELECT task_id FROM quiz_attempt_answers WHERE attempt_id = ? LIMIT 1)',
        [attempt.id]
    );
    const course = courseRow
        ? await get('SELECT id, name FROM courses WHERE id = ?', [courseRow.course_id])
        : null;
    const quiz = { id: 0, name: course ? course.name + ' - Overall Knowledge' : 'Overall Knowledge' };

    const questions = await getAttemptQuestions(attempt.id);
    if (!questions.length || index > questions.length) {
        return res.redirect('/overall/' + attempt.id + '/take/1');
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
        questionDots,
        attemptType: 'overall'
    });
});

router.post('/overall/:attemptId/take/:index', requireLogin, async (req, res) => {
    const attemptId = parseInt(req.params.attemptId);
    const index = Math.max(1, parseInt(req.params.index) || 1);
    const userId = req.session.userId;
    const { chosen_index, nav } = req.body || {};

    const attempt = await get(
        "SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND is_progress_quiz = 0 AND json_extract(metadata, '$.type') = 'overall'",
        [attemptId, userId]
    );
    if (!attempt || attempt.completed_at) {
        return res.redirect('/classes');
    }

    const questions = await getAttemptQuestions(attempt.id);
    if (!questions.length || index > questions.length) {
        return res.redirect('/overall/' + attempt.id + '/take/1');
    }
    const q = questions[index - 1];

    if (chosen_index !== undefined && chosen_index !== null && chosen_index !== '') {
        const ci = parseInt(chosen_index);
        if (!Number.isNaN(ci)) {
            await run('UPDATE quiz_attempt_answers SET chosen_index = ? WHERE id = ?', [
                ci,
                q.answerRowId
            ]);
        }
    }

    if (nav === 'prev') {
        const prevIndex = Math.max(1, index - 1);
        return res.redirect('/overall/' + attempt.id + '/take/' + prevIndex);
    }
    if (nav === 'next') {
        const nextIndex = Math.min(questions.length, index + 1);
        return res.redirect('/overall/' + attempt.id + '/take/' + nextIndex);
    }
    if (nav === 'submit') {
        return res.redirect('/overall/' + attempt.id + '/submit');
    }

    res.redirect('/overall/' + attempt.id + '/take/' + index);
});

router.get('/overall/:attemptId/submit', requireLogin, async (req, res) => {
    const attemptId = parseInt(req.params.attemptId);
    const userId = req.session.userId;

    const attempt = await get(
        "SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND is_progress_quiz = 0 AND json_extract(metadata, '$.type') = 'overall'",
        [attemptId, userId]
    );
    if (!attempt || attempt.completed_at) {
        return res.redirect('/classes');
    }

    const graded = await gradeAttempt(attempt.id);
    if (!graded) return res.redirect('/classes');

    res.redirect('/overall/' + attempt.id + '/results');
});

router.get('/overall/:attemptId/results', requireLogin, async (req, res) => {
    const attemptId = parseInt(req.params.attemptId);
    const userId = req.session.userId;

    const attempt = await get(
        "SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND is_progress_quiz = 0 AND json_extract(metadata, '$.type') = 'overall'",
        [attemptId, userId]
    );
    if (!attempt || !attempt.completed_at) {
        return res.redirect('/classes');
    }

    const classItem = await get('SELECT id, name FROM classes WHERE id = ?', [attempt.class_id]);
    if (!classItem) return res.redirect('/classes');

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

    const courseRow = await get(
        'SELECT course_id FROM tasks WHERE id = (SELECT task_id FROM quiz_attempt_answers WHERE attempt_id = ? LIMIT 1)',
        [attempt.id]
    );
    const course = courseRow
        ? await get('SELECT id, name FROM courses WHERE id = ?', [courseRow.course_id])
        : null;

    const worstUnits = (breakdown.units || []).slice(0, 3);
    const worstTasks = (breakdown.tasks || []).slice(0, 10);

    res.render('quiz/overall-results', {
        user: req.session.user,
        classItem,
        quiz: { id: 0, name: course ? course.name + ' - Overall Knowledge' : 'Overall Knowledge' },
        attempt,
        course,
        worstUnits,
        worstTasks
    });
});

router.get('/overall/:attemptId/coach', requireLogin, async (req, res) => {
    const attemptId = parseInt(req.params.attemptId);
    const userId = req.session.userId;

    const attempt = await get(
        "SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND is_progress_quiz = 0 AND json_extract(metadata, '$.type') = 'overall'",
        [attemptId, userId]
    );
    if (!attempt || !attempt.completed_at) {
        return res.redirect('/classes');
    }

    const classItem = await get('SELECT id, name FROM classes WHERE id = ?', [attempt.class_id]);
    if (!classItem) return res.redirect('/classes');

    const context = await getCoachContext(attempt.id);
    if (!context) {
        return res.render('quiz/coach', {
            user: req.session.user,
            classItem,
            quiz: { id: 0, name: 'Overall Knowledge' },
            attempt,
            course: null,
            plan: 'There is not enough data from this attempt for the AI coach to provide suggestions.'
        });
    }

    const effectiveCourse = context.course || null;
    const sortedUnits = (context.units || []).slice().sort((a, b) => (b.missedCount || 0) - (a.missedCount || 0));
    const sortedTasks = (context.tasks || []).slice().sort((a, b) => (b.missedCount || 0) - (a.missedCount || 0));
    const focusUnits = sortedUnits.slice(0, 3);
    const focusTasks = sortedTasks.slice(0, 10);

    const plan = await getImprovementPlan({
        course: effectiveCourse,
        units: focusUnits,
        tasks: focusTasks,
        missedQuestions: context.missedQuestions || []
    });

    const quiz = {
        id: 0,
        name: effectiveCourse ? effectiveCourse.name + ' - Overall Knowledge' : 'Overall Knowledge'
    };

    res.render('quiz/coach', {
        user: req.session.user,
        classItem,
        quiz,
        attempt,
        course: effectiveCourse,
        plan
    });
});

router.get('/progress/:attemptId/coach', requireLogin, async (req, res) => {
    const attemptId = parseInt(req.params.attemptId);
    const userId = req.session.userId;

    const attempt = await get(
        'SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ? AND is_progress_quiz = 1',
        [attemptId, userId]
    );
    if (!attempt || !attempt.completed_at) {
        return res.redirect('/classes');
    }

    const classItem = await get('SELECT id, name FROM classes WHERE id = ?', [attempt.class_id]);
    if (!classItem) return res.redirect('/classes');

    const context = await getCoachContext(attempt.id);
    if (!context) {
        return res.render('quiz/coach', {
            user: req.session.user,
            classItem,
            quiz: { id: 0, name: 'Progress Test' },
            attempt,
            course: null,
            plan: 'There is not enough data from this attempt for the AI coach to provide suggestions.'
        });
    }

    const effectiveCourse = context.course || null;
    const quiz = {
        id: 0,
        name: effectiveCourse ? effectiveCourse.name + ' - Progress Test' : 'Progress Test'
    };

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
});

module.exports = router;

