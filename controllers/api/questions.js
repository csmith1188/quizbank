const { isAuthenticated } = require('../../middleware/auth');
const { Question } = require('../../db/db');

module.exports = function (router) {
  router.put('/questions/:uid', isAuthenticated, async (req, res) => {
    const uid = parseInt(req.params.uid, 10);
    if (Number.isNaN(uid)) return res.status(400).json({ error: 'Invalid question id' });

    let { prompt, answers, correct_index, correct_answer, ai } = req.body;

    try {
      const question = await Question.findOne({ where: { uid } });
      if (!question) return res.status(404).json({ error: 'Question not found' });

      if (typeof answers === 'string') {
        try { answers = JSON.parse(answers); } catch (e) {  }
      }

      if (!Array.isArray(answers)) {
        answers = JSON.parse(question.answers || '[]');
      }

      if (typeof correct_index !== 'undefined' && (correct_index < 0 || correct_index >= answers.length)) {
        return res.status(400).json({ error: 'correct_index out of range' });
      }

      if (typeof correct_answer === 'undefined' && typeof correct_index !== 'undefined') {
        correct_answer = answers[correct_index] ?? null;
      }

      const updated = await question.update({
        prompt: (typeof prompt !== 'undefined') ? prompt : question.prompt,
        answers: JSON.stringify(answers),
        correct_index: (typeof correct_index !== 'undefined') ? correct_index : question.correct_index,
        correct_answer: (typeof correct_answer !== 'undefined') ? correct_answer : question.correct_answer,
        ai: (typeof ai !== 'undefined') ? ai : question.ai
      });

      return res.json({ success: true, question: updated.toJSON() });
    } catch (err) {
      console.error('Error updating question:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });
};