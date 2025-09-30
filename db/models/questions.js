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
        prompt: { type: DataTypes.TEXT, allowNull: false },
        correct_answer: { type: DataTypes.TEXT },
        correct_index: { type: DataTypes.INTEGER },
        ai: { type: DataTypes.BOOLEAN, defaultValue: false },
        answers: { type: DataTypes.TEXT }, // JSON string
    }, {
        tableName: 'questions'
    });

    return Question;
};  