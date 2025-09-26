const fs = require("fs");
const path = require("path");
const { sequelize, Course, Section, Unit, Task, Question } = require("./db");

async function seed() {
  try {
    const filePath = path.join(__dirname, "../quizsources/courses.json");
    const rawData = fs.readFileSync(filePath);
    const jsonData = JSON.parse(rawData);

    await sequelize.sync({ force: true });

    for (const courseData of jsonData.courses) {
      const course = await Course.create({
        name: courseData.name,
      });

      for (const sectionData of courseData.sections || []) {
        const section = await Section.create({
          name: sectionData.name,
          CourseUid: course.uid,
        });

        for (const unitData of sectionData.units || []) {
          const unit = await Unit.create({
            name: unitData.name,
            SectionUid: section.uid,
          });

          for (const taskData of unitData.tasks || []) {
            const task = await Task.create({
              name: taskData.name,
              UnitUid: unit.uid,
            });

            for (const qData of taskData.questions || []) {
              await Question.create({
                ai: qData.ai || false,
                prompt: qData.prompt,
                correct_answer: qData.correctAnswer,
                correct_index: qData.correctIndex,
                answers: JSON.stringify(qData.answers),
                TaskUid: task.uid,
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