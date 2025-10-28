module.exports = (sequelize, DataTypes) => {
    const Unit = sequelize.define("Unit", {
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
        tableName: 'units'
    });

    return Unit;
};  