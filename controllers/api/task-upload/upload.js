const { createTaskForUser } = require("../../../services/resource-service");

module.exports = (router) => {
    router.post("/upload", async (req, res) => {
        try {
            const { taskName, unitUid, description, genPrompt } = req.body;

            if (!taskName || !taskName.trim()) {
                return res.json({ success: false, message: "Task name is required." });
            }

            const newTask = await createTaskForUser(
                taskName,
                unitUid,
                description,
                genPrompt
            );

            res.json({
                success: true,
                message: `Task "${newTask.name}" created successfully!`,
                newTask,
            });
        } catch (error) {
            console.error("Error creating task:", error);
            res
                .status(500)
                .json({ success: false, message: error.message || "Server error creating task." });
        }
    });
}