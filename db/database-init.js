const seed = require("../db/seed");

async function init() {
    try {
        // creates tables if they don't exist
        seed();
        await db.sequelize.sync({ force: false });
        
    } catch (err) {
        console.error("Error syncing database:", err);
    }
}