const fs = require("fs");
const path = require("path");
const { sequelize, User, Course, Section, Unit, Task, Question } = require("./db");

async function seed() {
  try {
    const filePath = path.join(__dirname, "../quizsources/uploadtest.json");
    const rawData = fs.readFileSync(filePath);
    const jsonData = JSON.parse(rawData);

    await sequelize.sync({ force: true });

    /*await User.create({
      username: "CoolGuy",
    });*/

    for (const courseData of jsonData.courses) {
      const course = await Course.create({
        index: courseData.id,
        name: courseData.name,
        userUid: 1,
      });

      for (const sectionData of courseData.sections || []) {
        const section = await Section.create({
          name: sectionData.name,
          index: sectionData.id,
          courseUid: course.uid,
        });

        // for (const unitData of sectionData.units || []) {
        //   const unit = await Unit.create({
        //     name: unitData.name,
        //     index: unitData.id,
        //     sectionUid: section.uid,
        //   });

        //   for (const taskData of unitData.tasks || []) {
        //     const task = await Task.create({
        //       name: taskData.name,
        //       index: taskData.id,
        //       unitUid: unit.uid,
        //     });

        //     for (const qData of taskData.questions || []) {
        //       await Question.create({
        //         index: qData.id,
        //         ai: qData.ai || false,
        //         prompt: qData.prompt,
        //         correct_answer: qData.correctAnswer,
        //         correct_index: qData.correctIndex,
        //         answers: JSON.stringify(qData.answers),
        //         taskUid: task.uid,
        //       });
        //     }
        //   }
        // }
      }
    }

    console.log("✅ Database seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding database:", err);
    process.exit(1);
  }
}

seed();