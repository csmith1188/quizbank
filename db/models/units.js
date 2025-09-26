module.exports = (sequelize, DataTypes) => {
    const Unit = sequelize.define("Unit", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: { type: DataTypes.TEXT, allowNull: false },
    });

    Unit.associate = models => {
        Unit.belongsTo(models.Section, {
            foreignKey: { name: "section_id", allowNull: false },
            as: "section",
            onDelete: "CASCADE",
        });

        Unit.hasMany(models.Task, {
            foreignKey: { name: "unit_id", allowNull: false },
            as: "tasks",
            onDelete: "CASCADE",
        });
    };

    return Unit;
};  