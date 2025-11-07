const { createQuestionForUser } = require("../../../services/resource-service");

module.exports = (router) => {
    router.post("/upload", async (req, res) => {
        try{
            const { question, taskUid } = req.body;
            const correct_answers = question.answers.filter((_, index) =>
                question.correct_indices.includes(index)
            );

            if (!question) {
                return res.json({ success: false, message: "Question text is required." });
            }

            const newQuestion = await createQuestionForUser(
                taskUid,
                question.prompt,
                question.type,
                question.answers,
                question.correct_indices,
                correct_answers
            );

            res.json({
                success: true,
                message: `Question created successfully!`,
                newQuestion,
            });
        } catch (error){
            console.error("Error creating task:", error);
            res
                .status(500)
                .json({ success: false, message: "Server error creating question." });
        }
    });
};