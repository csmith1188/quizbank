const axios = require('axios');

const AUTH_URL = process.env.AUTH_URL;
const API_KEY = process.env.API_KEY;

// Match Formplug.js POLL_ANSWER_COLORS (green, cyan, yellow, red)
const POLL_ANSWER_COLORS = Object.freeze(['#00ff00', '#00ffff', '#ffff00', '#ff0000']);

/**
 * Formbar production currently serves the stable HTTP API under /api.
 * Newer /api/v1 routes are not available on all hosts, so prefer /api
 * (same base used by lib/formbar-classes.js).
 */
function getFormbarApiBase() {
    if (!AUTH_URL) return null;
    const trimmed = String(AUTH_URL).replace(/\/+$/, '').replace(/\/oauth$/i, '');
    if (trimmed.endsWith('/api/v1')) return trimmed.replace(/\/v1$/, '');
    if (trimmed.endsWith('/api')) return trimmed;
    return trimmed + '/api';
}

function authHeaders() {
    return {
        API: API_KEY,
        'Content-Type': 'application/json'
    };
}

function unwrapData(payload) {
    if (payload == null) return null;
    if (typeof payload !== 'object') return payload;
    if (payload.data != null && typeof payload.data === 'object') return payload.data;
    return payload;
}

/**
 * Resolve the Formbar class the user is currently in.
 * @param {string|number} formbarId
 * @returns {Promise<{id: string|number, name?: string}|null>}
 */
async function getActiveClassForUser(formbarId) {
    const base = getFormbarApiBase();
    if (!base || !API_KEY || formbarId == null || formbarId === '') return null;
    try {
        const res = await axios.get(`${base}/user/${formbarId}/class`, { headers: authHeaders() });
        const data = unwrapData(res.data);
        if (!data || data.id == null) return null;
        return { id: data.id, name: data.name || data.className || null };
    } catch (err) {
        const status = err.response && err.response.status;
        if (status === 404) return null;
        console.error('Error fetching active Formbar class:', err.message);
        throw err;
    }
}

/**
 * Build a Formbar/Formplug-compatible poll body from a quizbank question.
 * Shape matches Formplug emitStartPoll / quiz answers:
 *   { prompt, answers: [{ answer, weight, color }], excludedRespondents, allowTextResponses }
 * Correct answer gets weight 3; others get weight 1.
 *
 * Important: do not send `blind` / `responseTextBox` / `multiRes` / `polls` on the
 * HTTP create endpoint. Production Formbar treats those as "legacy" and remaps
 * to pollPrompt/polls, which drops modern `prompt`/`answers` (prompt becomes undefined).
 *
 * @param {{prompt: string, answers: string[], correct_index?: number, correct_answer?: string, time?: number}} question
 */
function buildPollPayloadFromQuestion(question) {
    const answers = Array.isArray(question.answers) ? question.answers.filter(Boolean) : [];
    if (!answers.length) {
        throw new Error('Question has no answers');
    }

    let correctIndex = typeof question.correct_index === 'number' ? question.correct_index : -1;
    if (correctIndex < 0 || correctIndex >= answers.length) {
        const match = String(question.correct_answer || '').trim();
        correctIndex = match ? answers.findIndex((a) => a === match) : 0;
        if (correctIndex < 0) correctIndex = 0;
    }

    const pollAnswers = answers.map((answer, i) => ({
        answer: String(answer),
        weight: i === correctIndex ? 3 : 1,
        color: POLL_ANSWER_COLORS[i % POLL_ANSWER_COLORS.length]
    }));

    return {
        prompt: String(question.prompt || '').trim(),
        answers: pollAnswers,
        excludedRespondents: [],
        allowTextResponses: false
    };
}

/**
 * Create a poll in a Formbar class.
 * @param {string|number} classId
 * @param {object} pollData
 */
async function createPollInClass(classId, pollData) {
    const base = getFormbarApiBase();
    if (!base || !API_KEY) {
        throw new Error('Formbar API is not configured');
    }
    if (classId == null || classId === '') {
        throw new Error('Class ID is required');
    }

    const res = await axios.post(
        `${base}/class/${classId}/polls/create`,
        pollData,
        { headers: authHeaders() }
    );
    return unwrapData(res.data) || {};
}

/**
 * Create a Formbar poll for the logged-in user's active class from a quizbank question.
 * @param {string|number} formbarId
 * @param {object} question
 */
async function createPollFromQuestionForUser(formbarId, question) {
    const activeClass = await getActiveClassForUser(formbarId);
    if (!activeClass) {
        const err = new Error('You are not in an active Formbar class. Join or start a class on Formbar, then try again.');
        err.code = 'NO_ACTIVE_CLASS';
        throw err;
    }

    const pollData = buildPollPayloadFromQuestion(question);
    await createPollInClass(activeClass.id, pollData);
    return { classId: activeClass.id, className: activeClass.name, poll: pollData };
}

module.exports = {
    getFormbarApiBase,
    getActiveClassForUser,
    buildPollPayloadFromQuestion,
    createPollInClass,
    createPollFromQuestionForUser
};
