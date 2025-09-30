module.exports = (sequelize, DataTypes) => {
    const Task = sequelize.define("Task", {
        uid: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        index: {
            type: DataTypes.INTEGER,
        },
        name: { type: DataTypes.TEXT, allowNull: false },
    }, {
        tableName: 'tasks'
    });

    return Task;
};  