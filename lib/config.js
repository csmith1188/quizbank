function intFromEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw === '') return fallback;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : fallback;
}

function strFromEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || String(raw).trim() === '') return fallback;
    return String(raw).trim();
}

const CONFIG = {
    apiRateLimitWindowMs: intFromEnv('API_RATE_LIMIT_WINDOW_MS', 60 * 1000),
    apiRateLimitMax: intFromEnv('API_RATE_LIMIT_MAX', 120),
    questionGenerateRateLimitWindowMs: intFromEnv('QUESTION_GENERATE_RATE_LIMIT_WINDOW_MS', 60 * 1000),
    questionGenerateRateLimitMax: intFromEnv('QUESTION_GENERATE_RATE_LIMIT_MAX', 12),

    masteryWindowRelaxed: intFromEnv('MASTERY_WINDOW_RELAXED', 5),
    masteryWindowStandard: intFromEnv('MASTERY_WINDOW_STANDARD', 10),
    masteryWindowIntense: intFromEnv('MASTERY_WINDOW_INTENSE', 20),

    progressTestQuestionCount: intFromEnv('PROGRESS_TEST_QUESTION_COUNT', 10),
    overallTestQuestionCount: intFromEnv('OVERALL_TEST_QUESTION_COUNT', 50),

    apiPickMax: intFromEnv('API_PICK_MAX', 25),
    apiGenerateMax: intFromEnv('API_GENERATE_MAX', 10),
    questionGeneratorRoundCount: intFromEnv('QUESTION_GENERATOR_ROUND_COUNT', 10),
    questionModel: strFromEnv('QUESTION_MODEL', 'gpt-5.6-sol'),
    coachModel: strFromEnv('COACH_MODEL', 'gpt-5.6-terra'),
    improveModel: strFromEnv('IMPROVE_MODEL', 'gpt-5.6-luna'),

    promptFileMaxBytes: intFromEnv('PROMPT_FILE_MAX_BYTES', 50 * 1024 * 1024),
    promptFilesTotalMaxBytes: intFromEnv('PROMPT_FILES_TOTAL_MAX_BYTES', 50 * 1024 * 1024),
    promptContextMaxWords: intFromEnv('PROMPT_CONTEXT_MAX_WORDS', 50000),
    promptFilesMaxCount: intFromEnv('PROMPT_FILES_MAX_COUNT', 5)
};

module.exports = CONFIG;
