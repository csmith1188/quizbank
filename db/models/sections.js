module.exports = (sequelize, DataTypes) => {
    const Section = sequelize.define("Section", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: { type: DataTypes.TEXT, allowNull: false },
    });

    return Section;
};  