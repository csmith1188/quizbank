const { Sequelize } = require("sequelize");
const fs = require("fs");
const path = require("path");

const sequelize = new Sequelize({
    dialect: "sqlite",
    // Points to db/database.sqlite
    storage: path.join(__dirname, "database.sqlite"),
    logging: false,
});

// Dynamically import all models in this folder
const models = {};
fs.readdirSync(path.join(__dirname, "models"))
    .filter(file => file.endsWith(".js"))
    .forEach(file => {
        const model = require(path.join(__dirname, "models", file))(sequelize, Sequelize.DataTypes);
        models[model.name] = model;
    });

// associations
models.User.hasMany(models.Course);
models.Course.belongsTo(models.User);
models.Course.hasMany(models.Section);
models.Section.belongsTo(models.Course);
models.Section.hasMany(models.Unit);
models.Unit.belongsTo(models.Section);
models.Unit.hasMany(models.Task);
models.Task.belongsTo(models.Unit);
models.Task.hasMany(models.Question);
models.Question.belongsTo(models.Task);

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;