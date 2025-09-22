const { Sequelize } = require("sequelize");
const fs = require("fs");
const path = require("path");

const sequelize = new Sequelize({
    dialect: "sqlite",
    // Points to db/database.sqlite
    storage: path.join(__dirname, "..", "database.sqlite"),
    logging: false,
});

// Dynamically import all models in this folder
const models = {};
fs.readdirSync(__dirname)
    .filter(file => file !== "index.js" && file.endsWith(".js"))
    .forEach(file => {
        const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
        models[model.name] = model;
    });

// If you have associations between models
Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;