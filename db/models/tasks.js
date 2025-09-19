module.exports = (sequelize, DataTypes) => {
    const Task = sequelize.define("Task", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: { type: DataTypes.TEXT, allowNull: false },
    });

    Task.associate = models => {
        Task.belongsTo(models.Unit, {
            foreignKey: { name: "unit_id", allowNull: false },
            as: "unit",
            onDelete: "CASCADE",
        });

        Task.hasMany(models.Question, {
            foreignKey: { name: "task_id", allowNull: false },
            as: "questions",
            onDelete: "CASCADE",
        });
    };

    return Task;
};  