module.exports = (sequelize, DataTypes) => {
    const Course = sequelize.define("Course", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        index: {
            type: DataTypes.INTEGER,
        },
        name: { type: DataTypes.TEXT, allowNull: false },
    }, {
        tableName: 'courses'
    });

    Course.associate = models => {
        Course.hasMany(models.Section, {
            foreignKey: { name: "course_id", allowNull: false },
            as: "sections",
            onDelete: "CASCADE",
        });
    };

    return Course;
};  