const fs = require("fs");
const path = require("path");
const { sequelize, User, Course, Section, Unit, Task, Question } = require("./db");

async function seed() {
  try {
    const filePath = path.join(__dirname, "../quizsources/courses.json");
    const rawData = fs.readFileSync(filePath);
    const jsonData = JSON.parse(rawData);

    await sequelize.sync(); // Remove { force: true }

    await User.findOrCreate({
      where: { username: "CoolGuy" },
      defaults: { username: "CoolGuy" },
    });

    for (const courseData of jsonData.courses) {
      let courseIndex = courseData.id;
      let courseName = courseData.name;

      // Check for existing courses with the same index
      while (await Course.findOne({ where: { index: courseIndex } })) {
        courseIndex++;
      }

      const [course] = await Course.findOrCreate({
        where: { index: courseIndex },
        defaults: {
          name: courseName,
          userUid: 1,
        },
      });

      for (const sectionData of courseData.sections || []) {
        let sectionIndex = sectionData.id;
        let sectionName = sectionData.name;

        // Check for existing sections with the same index
        while (await Section.findOne({ where: { index: sectionIndex, courseUid: course.uid } })) {
          sectionIndex++;
        }

        const [section] = await Section.findOrCreate({
          where: { index: sectionIndex, courseUid: course.uid },
          defaults: {
            name: sectionName,
          },
        });

        for (const unitData of sectionData.units || []) {
          let unitIndex = unitData.id;
          let unitName = unitData.name;

          // Check for existing units with the same index
          while (await Unit.findOne({ where: { index: unitIndex, sectionUid: section.uid } })) {
            unitIndex++;
          }

          const [unit] = await Unit.findOrCreate({
            where: { index: unitIndex, sectionUid: section.uid },
            defaults: {
              name: unitName,
            },
          });

          for (const taskData of unitData.tasks || []) {
            let taskIndex = taskData.id;
            let taskName = taskData.name;

            // Check for existing tasks with the same index
            while (await Task.findOne({ where: { index: taskIndex, unitUid: unit.uid } })) {
              taskIndex++;
            }

            const [task] = await Task.findOrCreate({
              where: { index: taskIndex, unitUid: unit.uid },
              defaults: {
                name: taskName,
              },
            });

            for (const qData of taskData.questions || []) {
              await Question.upsert({
                index: qData.id,
                ai: qData.ai || false,
                prompt: qData.prompt,
                correct_answer: qData.correctAnswer,
                correct_index: qData.correctIndex,
                answers: JSON.stringify(qData.answers),
                taskUid: task.uid,
              });
            }
          }
        }
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