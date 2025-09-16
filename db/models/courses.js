module.exports = (sequelize, DataTypes) => {
    const Course = sequelize.define("Course", {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.TEXT, allowNull: false },
    });

    Course.associate = models => {
        Course.hasMany(models.Section, { foreignKey: "course_id", as: "sections" });
    };

    return Course;
};