module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define("User", {
        uid: {
            type: DataTypes.INTEGER,
            unique: true,
            primaryKey: true,
            autoIncrement: true,
        },
        fb_id: {
            type: DataTypes.INTEGER,
        },
        google_id: {
            type: DataTypes.INTEGER,
        },
        username: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        password: {
            type: DataTypes.TEXT,
        },
        salt: {
            type: DataTypes.TEXT,
        },
        email: {
            type: DataTypes.TEXT,
        },
    }, {
        tableName: "users",
        timestamps: false,
    });

    return User;
};