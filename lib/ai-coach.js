const axios = require('axios');

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

function buildPrompt(context) {
    const { course, units, tasks, missedQuestions } = context || {};

    const lines = [];
    lines.push(
        'You are a supportive learning coach for a middle or high school student.',
        'The student either just completed a quiz/progress test or is reviewing their current mastery for a course.',
        'Your goal is to create a short, concrete improvement plan that will help them learn the underlying skills and concepts for the topics listed.',
        ''
    );

    if (course) {
        lines.push(`Course: ${course.name || 'Unknown'} (id: ${course.id != null ? course.id : 'n/a'})`);
    }

    if (Array.isArray(units) && units.length) {
        lines.push('', 'Units that need more attention:');
        units.forEach(u => {
            let detail = '';
            if (u.missedCount != null) {
                detail = `(missed ${u.missedCount} questions)`;
            } else if (typeof u.mastery === 'number') {
                detail = `(current mastery about ${Math.round(u.mastery * 100)}%)`;
            }
            lines.push(`- Unit ${u.id != null ? u.id : ''}: ${u.name || ''} ${detail}`.trim());
        });
    }

    if (Array.isArray(tasks) && tasks.length) {
        lines.push('', 'Tasks that need more attention:');
        tasks.forEach(t => {
            let detail = '';
            if (t.missedCount != null) {
                detail = `(missed ${t.missedCount} questions)`;
            } else if (typeof t.mastery === 'number') {
                detail = `(current mastery about ${Math.round(t.mastery * 100)}%)`;
            }
            lines.push(
                `- Task ${t.id != null ? t.id : ''}: ${t.name || ''}` +
                    (t.target ? ` — Target: ${t.target}` : '') +
                    (detail ? ` ${detail}` : '')
            );
        });
    }

    const limitedMissed =
        Array.isArray(missedQuestions) && missedQuestions.length
            ? missedQuestions.slice(0, 20)
            : [];

    if (limitedMissed.length) {
        lines.push(
            '',
            'Missed questions (only questions the student got wrong are listed):'
        );
        limitedMissed.forEach((q, idx) => {
            const answers = Array.isArray(q.answers) ? q.answers : [];
            lines.push(
                '',
                `Question ${idx + 1}:`,
                `Prompt: ${q.prompt || ''}`,
                'Answers:'
            );
            answers.forEach((a, i) => {
                lines.push(`  ${i}. ${a}`);
            });
            lines.push(
                `Student\'s answer index: ${q.chosenIndex != null ? q.chosenIndex : 'none'}`,
                `Student\'s answer text: ${q.chosenAnswer || '(no answer)'}`,
                `Correct answer index: ${q.correctIndex != null ? q.correctIndex : 'unknown'}`,
                `Correct answer text: ${q.correctAnswer || '(unknown)'}`,
                `Task id: ${q.taskId != null ? q.taskId : 'n/a'}, Unit id: ${q.unitId != null ? q.unitId : 'n/a'}`
            );
        });
    } else {
        lines.push(
            '',
            'No individual missed questions are listed for this request. Instead, focus on helping the student improve in the units and tasks above where mastery is below 100%.'
        );
    }

    lines.push(
        '',
        'Now, based on this information, create an improvement plan for the student. Focus on:',
        '- 2–4 specific things they should review or practice.',
        '- 3–6 high-quality actions they can take, which may include:',
        '  - well-phrased search queries they can paste into Google,',
        '  - suggestions for types of articles or videos to look for (and links to examples if you know any),',
        '  - small self-directed projects or exercises they can do to practice.',
        '',
        'Write directly to the student in a friendly tone. Keep the total response under about 600 words.',
        'Format the response as short sections with headings and bullet points in HTML (raw HTML, not markdown. don\'t even wrap the html in markdown. send RAW html, ready to be displayed as-is).'
    );

    return lines.join('\n');
}

async function getImprovementPlan(context) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return 'AI coaching is not currently available because the OpenAI API key is not configured.';
    }

    const model = DEFAULT_MODEL;
    const prompt = buildPrompt(context);

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model,
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are a kind, practical learning coach who helps students understand what to study next and how to practice effectively.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.6
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 20000
            }
        );

        const choice = response.data && response.data.choices && response.data.choices[0];
        const content =
            choice && choice.message && typeof choice.message.content === 'string'
                ? choice.message.content.trim()
                : null;
        if (!content) {
            return 'The AI coach did not return a response. Please try again in a moment.';
        }
        return content;
    } catch (err) {
        console.error('Error calling OpenAI for AI coach:', err.response?.data || err.message);
        return 'The AI coach is temporarily unavailable. Please review your results and try again later.';
    }
}

module.exports = {
    getImprovementPlan
};

