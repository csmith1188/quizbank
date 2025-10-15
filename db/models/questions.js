module.exports = (sequelize, DataTypes) => {
    const Question = sequelize.define("Question", {
        uid: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        index: {
            type: DataTypes.INTEGER,
        },
        ai: { type: DataTypes.BOOLEAN, defaultValue: false },
        type: {
            type: DataTypes.ENUM('multiple-choice', 'multiple-answer', 'true-false', 'open-ended', 'fill-in-the-blank'),
        },
        prompt: { type: DataTypes.TEXT, allowNull: false },
        correct_answers: { type: DataTypes.TEXT },
        correct_answer_indexes: { type: DataTypes.INTEGER },
        answers: { type: DataTypes.TEXT }, // JSON string
    }, {
        tableName: 'questions'
    });

    return Question;
};  