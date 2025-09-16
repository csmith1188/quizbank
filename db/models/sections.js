module.exports = (sequelize, DataTypes) => {
    const Section = sequelize.define("Section", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: { type: DataTypes.TEXT, allowNull: false },
    });

    Section.associate = models => {
        Section.belongsTo(models.Course, {
            foreignKey: { name: "course_id", allowNull: false },
            as: "course",
            onDelete: "CASCADE",
        });

        Section.hasMany(models.Unit, {
            foreignKey: { name: "section_id", allowNull: false },
            as: "units",
            onDelete: "CASCADE",
        });
    };

    return Section;
};  