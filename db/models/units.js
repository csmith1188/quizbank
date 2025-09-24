module.exports = (sequelize, DataTypes) => {
    const Unit = sequelize.define("Unit", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: { type: DataTypes.TEXT, allowNull: false },
    });

    return Unit;
};  