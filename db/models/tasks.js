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
        description: { type: DataTypes.TEXT, allowNull: true },
        genprompt: { type: DataTypes.TEXT, allowNull: true },
    }, {
        tableName: 'tasks'
    });

    return Task;
};  