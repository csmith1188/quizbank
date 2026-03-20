/**
 * Generate assessment questions via OpenAI using task context and good/bad examples.
 */
const OpenAI = require('openai').default;
const config = require('./config');

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_COUNT = config.questionGeneratorRoundCount;

/** Fisher-Yates shuffle (mutates array). */
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Shuffle answer order and update correct_index to match correct_answer. */
function shuffleAnswers(answers, correctAnswer) {
    if (!answers || answers.length === 0) return { answers: answers || [], correct_index: 0 };
    const correct = String(correctAnswer || '').trim();
    const shuffled = shuffleArray([].concat(answers));
    const idx = shuffled.findIndex(a => String(a).trim() === correct);
    const correct_index = idx >= 0 ? idx : 0;
    return { answers: shuffled, correct_index };
}

function formatExamples(label, examples) {
    if (!examples || examples.length === 0) return '';
    const lines = examples.map((ex, i) => {
        const ans = Array.isArray(ex.answers) ? ex.answers : (typeof ex.answers === 'string' ? JSON.parse(ex.answers || '[]') : []);
        const idx = ex.correct_index != null ? ex.correct_index : 0;
        let line = (i + 1) + '. Prompt: ' + String(ex.prompt) +
            '\n   Answers: ' + ans.join(' | ') +
            '\n   Correct: ' + String(ex.correct_answer) + ' (index ' + idx + ')';
        const reason = ex.quality_reason || ex.badReason || ex.why;
        if (reason) {
            line += '\n   Why bad: ' + String(reason);
        }
        return line;
    });
    return label + ':\n' + lines.join('\n\n') + '\n';
}

/**
 * @param {Object} options
 * @param {Object} options.task - { target, description }
 * @param {Array} options.goodExamples - array of { prompt, correct_answer, correct_index, answers }
 * @param {Array} options.badExamples - same shape
 * @param {number} [options.count=5]
 * @param {string} [options.additionalContext] - optional extra instructions for the model
 * @returns {Promise<Array<{ prompt, correct_answer, correct_index, answers }>>}
 */
async function generateQuestions(options) {
    const { task = {}, goodExamples = [], badExamples = [], count = DEFAULT_COUNT, additionalContext: additionalContextOpt } = options;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set');
    }

    const target = (task.target || '').trim();
    const description = (task.description || '').trim();
    const name = (task.name || '').trim();
    const contextParts = [];
    if (name) contextParts.push('Task: ' + name);
    if (target) contextParts.push('Learning target (every question MUST assess this): ' + target);
    if (description) contextParts.push('Description: ' + description);
    const context = contextParts.length ? contextParts.join('\n') : 'No specific target or description.';

    const goodBlock = formatExamples('Good example questions (match this style and topic)', goodExamples);
    const badBlock = formatExamples('Bad example questions (avoid these)', badExamples);

    const systemContent = 'You are an expert at writing multiple-choice assessment questions for education. ' +
        'Your job is to generate questions that DIRECTLY assess the learning target provided by the user. ' +
        'Every question you generate MUST be about that specific learning target and task—do not write questions on unrelated topics. ' +
        'Output only valid JSON: an array of exactly ' + count + ' question objects. ' +
        'Each object must have: "prompt" (string), "correct_answer" (string), "correct_index" (integer 0-based), "answers" (array of strings).';

    const extraBlock = (additionalContextOpt && additionalContextOpt.trim())
        ? '\nADDITIONAL INSTRUCTIONS FROM THE TEACHER (follow these):\n' + additionalContextOpt.trim() + '\n\n'
        : '';
    const userContent = 'TASK AND LEARNING TARGET (all questions must assess this):\n' + context + '\n\n' +
        extraBlock +
        (goodBlock + badBlock ? goodBlock + badBlock + '\n' : '') +
        'Generate exactly ' + count + ' new multiple-choice questions that assess the learning target above. ' +
        'Each question must clearly test knowledge or skills related to that target. ' +
        'Answers should be concise and quick to read. ' +
        'Return only a JSON array, no other text.';

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent }
        ],
        temperature: 0.7
    });

    const content = response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content;
    if (!content || typeof content !== 'string') {
        throw new Error('Empty or invalid response from OpenAI');
    }

    const trimmed = content.trim().replace(/^```json?\s*|\s*```$/g, '');
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    } catch (e) {
        throw new Error('OpenAI returned invalid JSON: ' + e.message);
    }

    if (!Array.isArray(parsed)) {
        throw new Error('OpenAI response was not a JSON array');
    }

    return parsed.slice(0, count).map(q => {
        const prompt = typeof q.prompt === 'string' ? q.prompt : String(q.prompt || '');
        const correct_answer = typeof q.correct_answer === 'string' ? q.correct_answer : String(q.correct_answer || '');
        const rawAnswers = Array.isArray(q.answers) ? q.answers.map(a => String(a)) : (q.answers != null ? [String(q.answers)] : []);
        const { answers, correct_index } = shuffleAnswers(rawAnswers, correct_answer);
        return { prompt, correct_answer, correct_index, answers };
    });
}

module.exports = { generateQuestions };
