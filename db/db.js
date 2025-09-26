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
models.User.hasMany(models.Course,   { as: "courses",   foreignKey: "userUid" });
models.Course.belongsTo(models.User, { as: "user",      foreignKey: "userUid" });
models.Course.hasMany(models.Section, { as: "sections", foreignKey: "courseUid" });
models.Section.belongsTo(models.Course,{ as: "course",  foreignKey: "courseUid" });
models.Section.hasMany(models.Unit,   { as: "units",    foreignKey: "sectionUid" });
models.Unit.belongsTo(models.Section, { as: "section",  foreignKey: "sectionUid" });
models.Unit.hasMany(models.Task,      { as: "tasks",    foreignKey: "unitUid" });
models.Task.belongsTo(models.Unit,    { as: "unit",     foreignKey: "unitUid" });
models.Task.hasMany(models.Question,  { as: "questions", foreignKey: "taskUid" });
models.Question.belongsTo(models.Task,{ as: "task",     foreignKey: "taskUid" });

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;