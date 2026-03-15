const { get, all, run } = require('./db');
const { resolveQuizToQuestions } = require('./quiz-resolve');

async function getOrCreateActiveAttempt(userId, classId, quizId, courseId) {
    let attempt = await get(
        'SELECT * FROM quiz_attempts WHERE user_id = ? AND class_id = ? AND quiz_id = ? AND completed_at IS NULL ORDER BY id DESC LIMIT 1',
        [userId, classId, quizId]
    );
    if (attempt) return attempt;

    const questions = await resolveQuizToQuestions(courseId, quizId);
    if (!questions.length) throw new Error('No questions in quiz');

    await run(
        'INSERT INTO quiz_attempts (user_id, class_id, quiz_id, total_questions, correct_questions, score) VALUES (?, ?, ?, ?, 0, 0)',
        [userId, classId, quizId, questions.length]
    );
    attempt = await get(
        'SELECT * FROM quiz_attempts WHERE user_id = ? AND class_id = ? AND quiz_id = ? AND completed_at IS NULL ORDER BY id DESC LIMIT 1',
        [userId, classId, quizId]
    );

    const quizQuestions = await all(
        `SELECT qq.question_id, q.task_id
         FROM quiz_questions qq
         JOIN questions q ON qq.question_id = q.id
         WHERE qq.quiz_id = ?
         ORDER BY qq.sort_order`,
        [quizId]
    );

    for (const row of quizQuestions) {
        let unitId = null;
        if (row.task_id != null) {
            const ut = await get(
                'SELECT unit_id FROM unit_tasks WHERE task_id = ? ORDER BY sort_order LIMIT 1',
                [row.task_id]
            );
            unitId = ut ? ut.unit_id : null;
        }
        await run(
            'INSERT INTO quiz_attempt_answers (attempt_id, question_id, task_id, unit_id) VALUES (?, ?, ?, ?)',
            [attempt.id, row.question_id, row.task_id || null, unitId]
        );
    }

    return attempt;
}

async function getAttemptQuestions(attemptId) {
    const rows = await all(
        `SELECT qaa.id as answer_row_id, qaa.question_id, qaa.chosen_index,
                q.prompt, q.answers, q.correct_index,
                qaa.task_id, qaa.unit_id
         FROM quiz_attempt_answers qaa
         JOIN questions q ON qaa.question_id = q.id
         WHERE qaa.attempt_id = ?
         ORDER BY qaa.id`,
        [attemptId]
    );
    return rows.map((r) => ({
        answerRowId: r.answer_row_id,
        questionId: r.question_id,
        chosenIndex: r.chosen_index,
        prompt: r.prompt,
        answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers,
        correctIndex: r.correct_index,
        taskId: r.task_id,
        unitId: r.unit_id
    }));
}

async function getCoachContext(attemptId) {
    const attempt = await get('SELECT * FROM quiz_attempts WHERE id = ?', [attemptId]);
    if (!attempt) return null;

    const answerRows = await all(
        `SELECT qaa.id, qaa.question_id, qaa.chosen_index, qaa.is_correct,
                q.prompt, q.answers, q.correct_index, q.correct_answer,
                qaa.task_id, qaa.unit_id
         FROM quiz_attempt_answers qaa
         JOIN questions q ON qaa.question_id = q.id
         WHERE qaa.attempt_id = ?
         ORDER BY qaa.id`,
        [attemptId]
    );
    if (!answerRows || !answerRows.length) return null;

    // Determine course
    let course = null;
    if (attempt.is_progress_quiz) {
        if (attempt.metadata) {
            try {
                const meta = JSON.parse(attempt.metadata);
                if (meta && meta.courseId) {
                    const row = await get('SELECT id, name FROM courses WHERE id = ?', [
                        meta.courseId
                    ]);
                    if (row) {
                        course = { id: row.id, name: row.name };
                    }
                }
            } catch (e) {
                // ignore malformed metadata
            }
        }
    } else if (attempt.quiz_id != null) {
        const row = await get(
            'SELECT c.id, c.name FROM quizzes q JOIN courses c ON q.course_id = c.id WHERE q.id = ?',
            [attempt.quiz_id]
        );
        if (row) {
            course = { id: row.id, name: row.name };
        }
    }

    const answers = answerRows.map(r => {
        const parsedAnswers =
            typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers || [];
        const chosenIndex =
            r.chosen_index != null && !Number.isNaN(parseInt(r.chosen_index, 10))
                ? parseInt(r.chosen_index, 10)
                : null;
        const chosenAnswer =
            chosenIndex != null && parsedAnswers[chosenIndex] != null
                ? parsedAnswers[chosenIndex]
                : null;
        const correctIndex =
            r.correct_index != null && !Number.isNaN(parseInt(r.correct_index, 10))
                ? parseInt(r.correct_index, 10)
                : null;
        const correctAnswer =
            correctIndex != null && parsedAnswers[correctIndex] != null
                ? parsedAnswers[correctIndex]
                : r.correct_answer || null;
        return {
            questionId: r.question_id,
            prompt: r.prompt,
            answers: parsedAnswers,
            chosenIndex,
            chosenAnswer,
            correctIndex,
            correctAnswer,
            isCorrect: !!r.is_correct,
            taskId: r.task_id,
            unitId: r.unit_id
        };
    });

    const missedQuestions = answers.filter(a => !a.isCorrect);

    // Collect task and unit ids where there were misses
    const taskMissCounts = {};
    const unitMissCounts = {};
    missedQuestions.forEach(q => {
        if (q.taskId != null) {
            taskMissCounts[q.taskId] = (taskMissCounts[q.taskId] || 0) + 1;
        }
        if (q.unitId != null) {
            unitMissCounts[q.unitId] = (unitMissCounts[q.unitId] || 0) + 1;
        }
    });

    const taskIds = Object.keys(taskMissCounts)
        .map(id => parseInt(id, 10))
        .filter(Boolean);
    const unitIds = Object.keys(unitMissCounts)
        .map(id => parseInt(id, 10))
        .filter(Boolean);

    let tasks = [];
    let units = [];

    if (taskIds.length) {
        const placeholders = taskIds.map(() => '?').join(',');
        const rows = await all(
            `SELECT id, name, target, sort_order FROM tasks WHERE id IN (${placeholders})`,
            taskIds
        );
        tasks = (rows || []).map(r => ({
            id: r.id,
            name: r.name,
            target: r.target || null,
            sortOrder: r.sort_order,
            missedCount: taskMissCounts[r.id] || 0
        }));
    }

    if (unitIds.length) {
        const placeholders = unitIds.map(() => '?').join(',');
        const rows = await all(
            `SELECT id, name, sort_order FROM units WHERE id IN (${placeholders})`,
            unitIds
        );
        units = (rows || []).map(r => ({
            id: r.id,
            name: r.name,
            sortOrder: r.sort_order,
            missedCount: unitMissCounts[r.id] || 0
        }));
    }

    return {
        attempt: {
            id: attempt.id,
            isProgressQuiz: !!attempt.is_progress_quiz,
            score: attempt.score,
            totalQuestions: attempt.total_questions,
            correctQuestions: attempt.correct_questions
        },
        course,
        units,
        tasks,
        missedQuestions
    };
}

const LAST_N_MASTERY = 20;

/**
 * Get count and correct for the last N (e.g. 20) answers for this user/course/task.
 * Mastery is computed as percent correct over that window.
 */
async function getLastNTaskMastery(userId, courseId, taskId) {
    const rows = await all(
        `SELECT qaa.is_correct
         FROM quiz_attempt_answers qaa
         JOIN quiz_attempts qa ON qa.id = qaa.attempt_id
         WHERE qaa.task_id = ? AND qa.user_id = ?
         AND qa.completed_at IS NOT NULL
         AND (
             (qa.is_progress_quiz = 0 AND EXISTS (SELECT 1 FROM quizzes q WHERE q.id = qa.quiz_id AND q.course_id = ?))
             OR (qa.is_progress_quiz = 1 AND CAST(json_extract(qa.metadata, '$.courseId') AS INTEGER) = ?)
         )
         ORDER BY qa.completed_at DESC, qaa.id DESC
         LIMIT ?`,
        [taskId, userId, courseId, courseId, LAST_N_MASTERY]
    );
    const count = (rows || []).length;
    const correct = (rows || []).filter(r => r.is_correct === 1 || r.is_correct === true).length;
    return { count, correct };
}

/**
 * Delete quiz_attempt_answers rows for this user/course/task that fall
 * outside the LAST_N_MASTERY most recent answers window.
 */
async function cleanupOldTaskAnswers(userId, courseId, taskId) {
    await run(
        `DELETE FROM quiz_attempt_answers
         WHERE id IN (
             SELECT old.id
             FROM quiz_attempt_answers old
             JOIN quiz_attempts qa ON qa.id = old.attempt_id
             WHERE old.task_id = ? AND qa.user_id = ?
               AND qa.completed_at IS NOT NULL
               AND (
                   (qa.is_progress_quiz = 0 AND EXISTS (SELECT 1 FROM quizzes q WHERE q.id = qa.quiz_id AND q.course_id = ?))
                   OR (qa.is_progress_quiz = 1 AND CAST(json_extract(qa.metadata, '$.courseId') AS INTEGER) = ?)
               )
               AND old.id NOT IN (
                   SELECT recent.id
                   FROM quiz_attempt_answers recent
                   JOIN quiz_attempts qa2 ON qa2.id = recent.attempt_id
                   WHERE recent.task_id = ? AND qa2.user_id = ?
                     AND qa2.completed_at IS NOT NULL
                     AND (
                         (qa2.is_progress_quiz = 0 AND EXISTS (SELECT 1 FROM quizzes q2 WHERE q2.id = qa2.quiz_id AND q2.course_id = ?))
                         OR (qa2.is_progress_quiz = 1 AND CAST(json_extract(qa2.metadata, '$.courseId') AS INTEGER) = ?)
                     )
                   ORDER BY qa2.completed_at DESC, recent.id DESC
                   LIMIT ?
               )
         )`,
        [
            taskId,
            userId,
            courseId,
            courseId,
            taskId,
            userId,
            courseId,
            courseId,
            LAST_N_MASTERY
        ]
    );
}

async function gradeAttempt(attemptId) {
    const attemptRow = await get('SELECT * FROM quiz_attempts WHERE id = ?', [attemptId]);
    if (!attemptRow) return null;

    const answers = await all(
        `SELECT qaa.id, qaa.question_id, qaa.chosen_index,
                q.correct_index, qaa.task_id, qaa.unit_id
         FROM quiz_attempt_answers qaa
         JOIN questions q ON qaa.question_id = q.id
         WHERE qaa.attempt_id = ?`,
        [attemptId]
    );
    if (!answers.length) return null;

    let total = answers.length;
    let correct = 0;
    const taskStats = {};
    const unitStats = {};

    for (const a of answers) {
        const isCorrect = a.chosen_index != null && parseInt(a.chosen_index, 10) === a.correct_index;
        await run(
            'UPDATE quiz_attempt_answers SET is_correct = ? WHERE id = ?',
            [isCorrect ? 1 : 0, a.id]
        );
        if (isCorrect) correct += 1;

        const taskId = a.task_id;
        const unitId = a.unit_id;

        if (taskId != null) {
            if (!taskStats[taskId]) taskStats[taskId] = { total: 0, missed: 0 };
            taskStats[taskId].total += 1;
            if (!isCorrect) taskStats[taskId].missed += 1;
        }

        if (unitId != null) {
            if (!unitStats[unitId]) unitStats[unitId] = { total: 0, missed: 0 };
            unitStats[unitId].total += 1;
            if (!isCorrect) unitStats[unitId].missed += 1;
        }
    }

    const score = total > 0 ? (correct / total) * 100 : 0;
    await run(
        'UPDATE quiz_attempts SET completed_at = CURRENT_TIMESTAMP, score = ?, total_questions = ?, correct_questions = ? WHERE id = ?',
        [score, total, correct, attemptId]
    );

    // Update task_mastery: mastery = percent correct out of last 20 questions for that task
    let courseId = null;
    if (attemptRow.is_progress_quiz) {
        if (attemptRow.metadata) {
            try {
                const meta = JSON.parse(attemptRow.metadata);
                if (meta && meta.courseId) {
                    courseId = meta.courseId;
                }
            } catch (e) {
                // ignore malformed metadata for now
            }
        }
    } else {
        const quizRow = await get('SELECT course_id FROM quizzes WHERE id = ?', [attemptRow.quiz_id]);
        courseId = quizRow ? quizRow.course_id : null;
    }
    if (courseId != null) {
        // Only track mastery for students (class members with role 'student').
        if (attemptRow.class_id != null) {
            const membership = await get(
                'SELECT role FROM class_members WHERE class_id = ? AND user_id = ? AND role = ?',
                [attemptRow.class_id, attemptRow.user_id, 'student']
            );
            if (!membership) {
                // Not a student in this class; skip mastery updates entirely.
                return { total, correct, score, taskStats, unitStats };
            }
        }
        for (const [taskIdStr] of Object.entries(taskStats)) {
            const taskId = parseInt(taskIdStr, 10);
            if (!taskId) continue;
            const { correct: windowCorrect } = await getLastNTaskMastery(
                attemptRow.user_id,
                courseId,
                taskId
            );
            const denom = LAST_N_MASTERY;
            const mastery = denom > 0 ? windowCorrect / denom : 0;
            const existing = await get(
                'SELECT id FROM task_mastery WHERE user_id = ? AND course_id = ? AND task_id = ?',
                [attemptRow.user_id, courseId, taskId]
            );
            if (existing) {
                await run(
                    'UPDATE task_mastery SET mastery = ? WHERE id = ?',
                    [mastery, existing.id]
                );
            } else {
                await run(
                    'INSERT INTO task_mastery (user_id, course_id, task_id, mastery) VALUES (?, ?, ?, ?)',
                    [attemptRow.user_id, courseId, taskId, mastery]
                );
            }

            // After updating mastery, clean out historical answers beyond the 20-question window
            await cleanupOldTaskAnswers(attemptRow.user_id, courseId, taskId);
        }
    }

    // If this is not a progress quiz and this attempt is the best score
    // for this user/class/quiz, remove older attempts for that quiz
    if (!attemptRow.is_progress_quiz) {
        const others = await all(
            'SELECT id, score FROM quiz_attempts WHERE user_id = ? AND class_id = ? AND quiz_id = ? AND id != ?',
            [attemptRow.user_id, attemptRow.class_id, attemptRow.quiz_id, attemptId]
        );
        if (others && others.length) {
            const maxOther = Math.max(...others.map(o => o.score != null ? o.score : 0));
            if (score > maxOther) {
                for (const o of others) {
                    await run('DELETE FROM quiz_attempt_answers WHERE attempt_id = ?', [o.id]);
                    await run('DELETE FROM quiz_attempts WHERE id = ?', [o.id]);
                }
            }
        }
    }

    return { total, correct, score, taskStats, unitStats };
}

async function getBreakdown(taskStats, unitStats) {
    const tasks = [];
    for (const taskId of Object.keys(taskStats)) {
        const t = await get('SELECT id, name FROM tasks WHERE id = ?', [parseInt(taskId, 10)]);
        if (t) {
            const total = taskStats[taskId].total;
            const missed = taskStats[taskId].missed;
            const correct = total - missed;
            const pctCorrect = total > 0 ? correct / total : 1;
            tasks.push({
                id: t.id,
                name: t.name,
                total,
                missed,
                pctCorrect
            });
        }
    }
    tasks.sort((a, b) => a.pctCorrect - b.pctCorrect || a.name.localeCompare(b.name));

    const units = [];
    for (const unitId of Object.keys(unitStats)) {
        const u = await get('SELECT id, name FROM units WHERE id = ?', [parseInt(unitId, 10)]);
        if (u) {
            const total = unitStats[unitId].total;
            const missed = unitStats[unitId].missed;
            const correct = total - missed;
            const pctCorrect = total > 0 ? correct / total : 1;
            units.push({
                id: u.id,
                name: u.name,
                total,
                missed,
                pctCorrect
            });
        }
    }
    units.sort((a, b) => a.pctCorrect - b.pctCorrect || a.name.localeCompare(b.name));

    return { tasks, units };
}

module.exports = {
    getOrCreateActiveAttempt,
    getAttemptQuestions,
    gradeAttempt,
    gradeAttempt,
    getBreakdown,
    getCoachContext
};

