module.exports = (sequelize, DataTypes) => {
    const Task = sequelize.define("Task", {
        uid: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: { type: DataTypes.TEXT, allowNull: false },
    });

    return Task;
};  