const SHORT_TIME_SECONDS = 15;
const MEDIUM_TIME_SECONDS = 30;
const LONG_TIME_SECONDS = 60;

// Policy B: use total characters in prompt + all answers combined.
const SHORT_MAX_TOTAL_CHARS = 200;
const MEDIUM_MAX_TOTAL_CHARS = 400;

function toSafeString(value) {
    if (value == null) return '';
    return String(value).trim();
}

function computeQuestionTotalChars(prompt, answers) {
    const promptText = toSafeString(prompt);
    const answerList = Array.isArray(answers) ? answers : [];
    const answersChars = answerList.reduce((sum, answer) => sum + toSafeString(answer).length, 0);
    return promptText.length + answersChars;
}

function getQuestionTime(prompt, answers) {
    const totalChars = computeQuestionTotalChars(prompt, answers);
    if (totalChars <= SHORT_MAX_TOTAL_CHARS) return SHORT_TIME_SECONDS;
    if (totalChars <= MEDIUM_MAX_TOTAL_CHARS) return MEDIUM_TIME_SECONDS;
    return LONG_TIME_SECONDS;
}

function normalizeQuestionTime(value, fallback) {
    const n = parseInt(value, 10);
    if (n === SHORT_TIME_SECONDS || n === MEDIUM_TIME_SECONDS || n === LONG_TIME_SECONDS) {
        return n;
    }
    return fallback;
}

module.exports = {
    SHORT_TIME_SECONDS,
    MEDIUM_TIME_SECONDS,
    LONG_TIME_SECONDS,
    computeQuestionTotalChars,
    getQuestionTime,
    normalizeQuestionTime
};

