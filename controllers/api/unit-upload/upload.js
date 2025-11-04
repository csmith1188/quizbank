const { createUnitForUser } = require("../../../services/resource-service");

module.exports = (router) => {
    router.post("/upload", async (req, res) => {
        try {
            const { unitName, sectionUid, description } = req.body;

            if (!unitName || !unitName.trim()) {
                return res.json({ success: false, message: "Unit name is required." });
            }

            const newUnit = await createUnitForUser(
                unitName,
                sectionUid,
                description
            );

            res.json({
                success: true,
                message: `Unit "${newUnit.name}" created successfully!`,
                newUnit,
            });
        } catch (error) {
            console.error("Error creating unit:", error);
            res
                .status(500)
                .json({ success: false, message: error.message || "Server error creating unit." });
        }
    });
};