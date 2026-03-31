const { get, all } = require('./db');

function getRandomItems(arr, count) {
    const n = Math.min(count, arr.length);
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

function rowToQuestion(row) {
    return {
        id: row.id,
        prompt: row.prompt,
        correctAnswer: row.correct_answer,
        correctIndex: row.correct_index,
        answers: typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers,
        time: row.time
    };
}

async function getQuestionsForUnit(unitId, courseId) {
    const taskIds = await all('SELECT task_id FROM unit_tasks WHERE unit_id = ? ORDER BY sort_order', [unitId]);
    const ids = taskIds.map(r => r.task_id);
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = await all(
        `SELECT q.id, q.prompt, q.correct_answer, q.correct_index, q.answers, q.time
         FROM questions q
         JOIN tasks t ON q.task_id = t.id
         WHERE q.task_id IN (${placeholders})
           AND t.course_id = ?
           AND COALESCE(q.quality, '') != 'bad'`,
        [...ids, courseId]
    );
    return rows.map(rowToQuestion);
}

async function getQuestionsForTask(taskId, courseId) {
    const rows = await all(
        `SELECT q.id, q.prompt, q.correct_answer, q.correct_index, q.answers, q.time
         FROM questions q
         JOIN tasks t ON q.task_id = t.id
         WHERE q.task_id = ?
           AND t.course_id = ?
           AND COALESCE(q.quality, '') != 'bad'`,
        [taskId, courseId]
    );
    return rows.map(rowToQuestion);
}

async function getQuestionsForCourse(courseId) {
    const rows = await all(
        `SELECT q.id, q.prompt, q.correct_answer, q.correct_index, q.answers, q.time
         FROM questions q
         JOIN tasks t ON q.task_id = t.id
         WHERE t.course_id = ?
           AND COALESCE(q.quality, '') != 'bad'`,
        [courseId]
    );
    return rows.map(rowToQuestion);
}

async function getQuestionById(questionId, courseId) {
    const row = await get(
        `SELECT q.id, q.prompt, q.correct_answer, q.correct_index, q.answers, q.time
         FROM questions q
         JOIN tasks t ON q.task_id = t.id
         WHERE q.id = ?
           AND t.course_id = ?
           AND COALESCE(q.quality, '') != 'bad'`,
        [questionId, courseId]
    );
    return row ? rowToQuestion(row) : null;
}

/** Resolve a quiz to its ordered list of questions (quiz is a stored list of question IDs). */
async function resolveQuizToQuestions(courseId, quizId) {
    const rows = await all(
        `SELECT q.id, q.prompt, q.correct_answer, q.correct_index, q.answers, q.time
         FROM quiz_questions qq
         JOIN questions q ON qq.question_id = q.id
         JOIN tasks t ON q.task_id = t.id
         WHERE qq.quiz_id = ?
           AND t.course_id = ?
           AND COALESCE(q.quality, '') != 'bad'
         ORDER BY qq.sort_order`,
        [quizId, courseId]
    );
    return rows.map(rowToQuestion);
}

/**
 * Pick questions from a source (course, unit, or task) at add-time: all or random N.
 * Returns array of question objects suitable for adding to a quiz.
 */
async function pickQuestionsForSource(sourceType, sourceId, courseId, pickMode, count) {
    let questions = [];
    if (sourceType === 'course') {
        questions = await getQuestionsForCourse(courseId);
    } else if (sourceType === 'unit') {
        questions = await getQuestionsForUnit(sourceId, courseId);
    } else if (sourceType === 'task') {
        questions = await getQuestionsForTask(sourceId, courseId);
    } else {
        return [];
    }
    if (pickMode === 'all') {
        return questions;
    }
    if (pickMode === 'random' && count != null && count > 0) {
        return getRandomItems(questions, parseInt(count));
    }
    return questions;
}

module.exports = {
    resolveQuizToQuestions,
    rowToQuestion,
    getQuestionsForUnit,
    getQuestionsForTask,
    getQuestionsForCourse,
    getQuestionById,
    getRandomItems,
    pickQuestionsForSource
};
