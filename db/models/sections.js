module.exports = (sequelize, DataTypes) => {
    const Section = sequelize.define("Section", {
        uid: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: { type: DataTypes.TEXT, allowNull: false },
    });

    return Section;
};  