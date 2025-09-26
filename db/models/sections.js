module.exports = (sequelize, DataTypes) => {
    const Section = sequelize.define("Section", {
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
        tableName: 'sections'
    });

    return Section;
};  