module.exports = (sequelize, DataTypes) => {
    const Course = sequelize.define("Course", {
        uid: {
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

    return Course;
};  