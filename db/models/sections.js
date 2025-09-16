module.exports = (sequelize, DataTypes) => {
    const Section = sequelize.define("Section", {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        course_id: { type: DataTypes.INTEGER, allowNull: false },
        name: { type: DataTypes.TEXT, allowNull: false },
    });

    Section.associate = models => {
        Section.belongsTo(models.Course, { foreignKey: "course_id", as: "course" });
        Section.hasMany(models.Unit, { foreignKey: "section_id", as: "units" });
    };

    return Section;
};