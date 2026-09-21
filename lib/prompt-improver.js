/**
 * Improve teacher additional-context prompt text via OpenAI.
 */
const OpenAI = require('openai').default;

const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * @param {string} promptText
 * @param {{ hasFiles?: boolean }} [options]
 * @returns {Promise<string>}
 */
async function improvePromptText(promptText, options = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set');
    }
    const text = String(promptText || '').trim();
    if (!text) {
        throw new Error('Prompt text is empty');
    }

    const fileNote = options.hasFiles
        ? ' The teacher will also attach source files separately; improve only the instruction text, do not invent file contents.'
        : '';

    const systemContent =
        'You improve short teacher instructions used as additional context when generating multiple-choice quiz questions. ' +
        'Make the instructions clearer, more specific, and actionable for an assessment writer. ' +
        'Preserve the teacher\'s intent and constraints. Do not add questions. Do not wrap the result in quotes or markdown fences. ' +
        'Return only the improved instruction text.' + fileNote;

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: 'Improve these generation instructions:\n\n' + text }
        ],
        temperature: 0.4
    });

    const content = response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content;
    if (!content || typeof content !== 'string' || !content.trim()) {
        throw new Error('Empty or invalid response from OpenAI');
    }
    return content.trim().replace(/^```[\w]*\s*|\s*```$/g, '');
}

module.exports = { improvePromptText };
