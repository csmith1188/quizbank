const seed = require("../db/seed");

async function init() {
    try {
        // creates tables if they don't exist
        await db.sequelize.sync({ force: false });
        seed();
        
    } catch (err) {
        console.error("Error syncing database:", err);
    }
}