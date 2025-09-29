module.exports = (sequelize, DataTypes) => {
    const Question = sequelize.define("Question", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        index: {
            type: DataTypes.INTEGER,
        },
        prompt: { type: DataTypes.TEXT, allowNull: false },
        correct_answer: { type: DataTypes.TEXT },
        correct_index: { type: DataTypes.INTEGER },
        ai: { type: DataTypes.BOOLEAN, defaultValue: false },
        answers: { type: DataTypes.TEXT }, // JSON string
    }, {
        tableName: 'questions'
    });

    Question.associate = models => {
        Question.belongsTo(models.Task, {
            foreignKey: { name: "task_id", allowNull: false },
            as: "task",
            onDelete: "CASCADE",
        });
    };

    return Question;
};  