module.exports = (sequelize, DataTypes) => {
    const Unit = sequelize.define("Unit", {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        section_id: { type: DataTypes.INTEGER, allowNull: false },
        name: { type: DataTypes.TEXT, allowNull: false },
    });

    Unit.associate = models => {
        Unit.belongsTo(models.Section, { foreignKey: "section_id", as: "section" });
        Unit.hasMany(models.Task, { foreignKey: "unit_id", as: "tasks" });
    };

    return Unit;
};