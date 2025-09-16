module.exports = (sequelize, DataTypes) => {
    const Task = sequelize.define("Task", {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        unit_id: { type: DataTypes.INTEGER, allowNull: false },
        name: { type: DataTypes.TEXT, allowNull: false },
    });

    Task.associate = models => {
        Task.belongsTo(models.Unit, { foreignKey: "unit_id", as: "unit" });
        Task.hasMany(models.Question, { foreignKey: "task_id", as: "questions" });
    };

    return Task;
};