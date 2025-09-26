module.exports = (sequelize, DataTypes) => {
    const Course = sequelize.define("Course", {
        uid: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: { type: DataTypes.TEXT, allowNull: false },
    });

    return Course;
};  