module.exports = (sequelize, DataTypes) => {
    const Question = sequelize.define("Question", {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        task_id: { type: DataTypes.INTEGER, allowNull: false },
        prompt: { type: DataTypes.TEXT, allowNull: false },
        correct_answer: { type: DataTypes.TEXT },
        correct_index: { type: DataTypes.INTEGER },
        ai: { type: DataTypes.BOOLEAN, defaultValue: false },
        answers: { type: DataTypes.TEXT },
    });

    Question.associate = models => {
        Question.belongsTo(models.Task, { foreignKey: "task_id", as: "task" });
    };

    return Question;
};