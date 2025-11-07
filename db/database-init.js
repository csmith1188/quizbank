const db = require('./db.js');

async function init() {
    try {
        // creates tables if they don't exist
        await db.sequelize.sync({ force: true });
    } catch (err) {
        console.error("Error syncing database:", err);
    }
}

init().then(() => {
    console.log("Database initialized successfully.");
}).catch(err => {
    console.error("Failed to initialize database:", err);
});