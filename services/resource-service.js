const { sequelize, User, Course, Section, Unit, Task, Question } = require("../db/db");
const { shallow } = require("../util/scope-limit");
const { getRandomItems } = require('../util/misc');

const resourceTypeModelMap = new Map([
    ["course", Course],
    ["section", Section],
    ["unit", Unit],
    ["task", Task],
    ["question", Question]
]);

const resourceTypes = Array.from(resourceTypeModelMap.keys());

const resourceTypeIndexMap = new Map();
resourceTypes.forEach((type, index) => {
    resourceTypeIndexMap.set(type, index);
});

const questionTypeMinAnswerChoices = new Map([
    ["multiple-choice", 2],
    ["multiple-answer", 2],
    ["open-ended", 0]
]);

// Add plural to singular map
const pluralToSingular = {
    "courses": "course",
    "sections": "section",
    "units": "unit",
    "tasks": "task",
    "questions": "question"
};

const MAX_QUESTIONS_PICK = 20;

// Recursively collect all questions from the data
const collectQuestions = (data, questionType = null) => {
    if (!data) return [];
    if (Array.isArray(data)) {
        return data.flatMap(item => collectQuestions(item, questionType));
    }
    if (typeof data === "object") {
        if (data.questions) {
            return questionType ? data.questions.filter(q => q.type === questionType) : data.questions;
        }
        return Object.values(data).flatMap(item => collectQuestions(item, questionType));
    }
    return [];
};

// Fetch the full course hierarchy for a user
module.exports.getFullCourseHierarchy = async (courseUid) => {
    const courses = await Course.findAll({
        where: { uid: courseUid }, // Filter by courseUid
        include: [{
            model: Section,
            as: "sections",
            include: [{
                model: Unit,
                as: "units",
                include: [{
                    model: Task,
                    as: "tasks",
                    include: [{ model: Question, as: "questions" }]
                }]
            }]
        }]
    });

    // Convert to plain JSON objects
    let json = {
        courses: courses.map(c => c.toJSON())
    };
    return json;
}

module.exports.getSection = async (sectionUid) => {
    const section = await Section.findOne({
        where: { uid: sectionUid },
        include: [{
            model: Unit,
            as: "units",
            include: [{
                model: Task,
                as: "tasks",
                include: [{ model: Question, as: "questions" }]
            }]
        }]
    });
    if (!section) throw new Error("Section not found");
    return section.toJSON();
}

module.exports.getSectionsForUser = async (userUid) => {
    const sections = await Section.findAll({
        include: [{
            model: Course,
            as: "course",
            where: { userUid: userUid },
            attributes: []
        }],
        attributes: ["uid", "name", "index", "createdAt", "updatedAt"],
    });
    if (!sections) throw new Error("No sections found for user");
    return sections.map(s => s.toJSON());
}

module.exports.getCoursesForUser = async (userUid) => {
    const courses = await Course.findAll({
        where: { userUid: userUid },
        attributes: ["uid", "name", "index", "createdAt", "updatedAt"],
    });
    if (!courses) throw new Error("No courses found for user");
    return courses.map(c => c.toJSON());
}

module.exports.createCourseForUser = async (userUid, courseName, curseDescription) => {
    if (!courseName || !courseName.trim()) {
        throw new Error("Course name is required.");
    }

    const count = await Course.count({ where: { userUid } });

    const course = await Course.create({
        userUid,
        name: courseName.trim(),
        index: count + 1,
        description: curseDescription
    });

    return course.toJSON();
};

module.exports.createUnitForUser = async (unitName, sectionUid, description) => {
    if (!unitName) {
        throw new Error("Unit name is required.");
    }

    if (!sectionUid) {
        throw new Error("Section UID is required.");
    }

    const count = await Unit.count({ where: { sectionUid } });
    const unit = await Unit.create({
        sectionUid,
        name: unitName,
        index: count + 1,
        description: description
    });
    return unit.toJSON();
};

module.exports.createSectionForUser = async (sectionName, courseUid, description) => {
    if (!sectionName) {
        throw new Error("Section name is required.");
    }

    if (!courseUid) {
        throw new Error("Course UID is required.");
    }

    const count = await Section.count({ where: { courseUid } });
    const section = await Section.create({
        courseUid,
        name: sectionName,
        index: count + 1,
        description: description
    });
    return section.toJSON();
};

module.exports.createTaskForUser = async (taskName, unitUid, description, GenPrompt) => {
    if (!taskName) {
        throw new Error("Task name is required.");
    }
    if (!unitUid) {
        throw new Error("Unit UID is required.");
    }

    const count = await Task.count({ where: { unitUid } });
    const task = await Task.create({
        unitUid,
        name: taskName,
        index: count + 1,
        description: description,
        genprompt: GenPrompt
    });
    return task.toJSON();
};

module.exports.getResourceOwnerUid = async (resourceType, resourceUid) => {
    let model;
    switch (resourceType) {
        case "course": model = Course; break;
        case "section": model = Section; break;
        case "unit": model = Unit; break;
        case "task": model = Task; break;
        case "question": model = Question; break;
        default: throw new Error(`Invalid resource type: ${resourceType}`);
    }

    const resource = await model.findOne({
        where: { uid: resourceUid },
        include: [{
            model: Course,
            as: "course",
            attributes: ["uid", "userUid"],
            include: [{ model: User, as: "user", attributes: ["uid", "username"] }]
        }],
        attributes: ["uid"]
    });

    if (!resource) throw new Error(`${resourceType} not found`);

    return resource.course.userUid;
}

// Parse the resource path into segments and pick amount
function parseResourcePath(path) {
    const pieces = path.split("/").filter(Boolean);

    const segments = [];
    for (let i = 0; i < pieces.length; i += 2) {
        let type = pieces[i];
        // Normalize plural to singular
        if (pluralToSingular[type]) type = pluralToSingular[type];
        segments.push({
            type: type,
            ids: pieces[i + 1]
                ? pieces[i + 1].split("+").map(Number)
                : []
        });
    }
    return segments;
}

// gets the full hierarchy underneath an entity
async function getEntityHierarchy(entityType, entityUid) {
    const model = resourceTypeModelMap.get(entityType);
    const typeIndex = resourceTypeIndexMap.get(entityType);
    const include = {};

    let tempInclude = include;

    for (let i = typeIndex + 1; i < resourceTypes.length; i++){
        const type = resourceTypes[i];
        const isLast = (i === resourceTypes.length - 1);
        tempInclude.model = resourceTypeModelMap.get(type);
        tempInclude.as = type + 's';
        if (!isLast) {
            tempInclude.include = [{}];
            tempInclude = tempInclude.include[0];
        }
    }

    const scope = await model.findOne({
        where: { uid: entityUid },
        include: [include]
    });

    return scope;
}

async function resolveResource(type, uid) {
    const model = resourceTypeModelMap.get(type);
    if (!model) {
        throw new Error(`Invalid resource type: ${type}`);
    }

    const entity = await model.findOne({
        where: { uid }
    });

    if (!entity) {
        throw new Error(`${type} with id ${uid} not found.`);
    }

    return entity.dataValues;
}

async function entitiesInSameHierarchy(entities) {

    const centerIndex = Math.floor(resourceTypes.length / 2);
    const centerType = resourceTypes[centerIndex];

    const uids = [];

    // traverse entities to center type and check if uids match

    for (e of entities) {
        const typeIndex = resourceTypeIndexMap.get(e.constructor.name.toLowerCase());
        const traversalDistance = Math.abs(centerIndex - typeIndex);
        const traversalDirection = Math.sign(centerIndex - typeIndex);

        let currentEntity = e;

        for (let i = 0; i < traversalDistance; i++) {

            // where we will be after step
            const nextIndex = typeIndex + (traversalDirection * (i + 1));
            const nextType = resourceTypes[nextIndex];
            const nextModel = resourceTypeModelMap.get(nextType);

            // if moving forward, search for entity with foreign key of last entity
            // if moving backward, use foreign key

            if (traversalDirection === 1) {

                // where we are before step
                const currentIndex = nextIndex - traversalDirection;
                const currentType = resourceTypes[currentIndex];
                const currentModel = resourceTypeModelMap.get(currentType);

                const where = {};
                where[currentType + 'Uid'] = currentEntity.uid;

                currentEntity = await nextModel.findOne({
                    where
                });


            } else if (traversalDirection === -1) {

                const nextUid = currentEntity[nextType + 'Uid'];

                currentEntity = await nextModel.findOne({
                    where: {
                        uid: nextUid
                    }
                })

            }

        }

        // when the loop is over, currentEntity should theoretically be of the centerType
        // add currentEntity uid to uid array
        uids.push(currentEntity.uid);

    }

    // check that all uids match

    const firstUid = uids[0];

    for (uid of uids) {
        if (uid !== firstUid) return false;
    }

    return true;

};

// Resolve the hierarchy based on segments
function resolveHierarchy(root, segments) {
    let data = root;

    segments.forEach(({ type, ids }) => {
        const collection = data[type + "s"];
        if (!collection) throw new Error(`Invalid resource type: ${type}`);

        if (!ids.length) { 
            data = collection; 
            return; 
        }

        const matched = collection.filter(e => ids.includes(e.uid));
        if (!matched.length) throw new Error(`Resource not found: ${type} ${ids}`);

        data = matched.length === 1 ? matched[0] : {
            name: `Combined ${type}s`,
            [type + "s"]: matched
        };
    });

    return data;
}

module.exports.getResource = async (path, questionType = null) => {
    const { segments, pickAmount } = parseResourcePath(path);

    console.log(path);
    console.log(parseResourcePath(path));

    if (segments.length === 0) {
        throw new Error("Empty resource path");
    }

    let data = await getEntityHierarchy(segments[0].type, segments[0].ids[0]); // add combining the top layer later
    let resolvedData = resolveHierarchy(data, segments);

    if (
        segments.length === 1 &&
        segments[0].type === "course" &&
        Array.isArray(resolvedData)
    ) {
        resolvedData = { courses: resolvedData };
    }

    // if pick amount is not null, pick questions under the resolved data
    if (pickAmount) {

        if (pickAmount <= 0 || pickAmount > MAX_QUESTIONS_PICK) {
            throw new Error(`Pick amount must be between 1 and ${MAX_QUESTIONS_PICK}`);
        }

        const allQuestions = collectQuestions(resolvedData, questionType);

        if (allQuestions.length === 0) throw new Error("No questions available to pick from");

        resolvedData = { questions: [] };
        while (resolvedData.questions.length < pickAmount) {
            const pickedQuestions = getRandomItems(allQuestions, pickAmount - resolvedData.questions.length);
            resolvedData.questions.push(...pickedQuestions);
        }
    }

    return resolvedData;
}

module.exports.insertUploadData = async (data, sectionUid) => {

    return sequelize.transaction(async (t) => {

        // keeps track of created units and tasks to avoid duplicates
        const newUnits = new Map(); // key: unitName, value: unitEntity
        const newTasks = new Map(); // key: unitName:taskName, value: taskEntity

        for (let item of data) {
            const { unitName, taskName } = item.createNew;
            const question = item.question;

            if (question.answers.length < questionTypeMinAnswerChoices.get(question.type)) {
                throw new Error(`Not enough answer choices for question of type ${question.type}`);
            }

            // find section
            const sectionEntity = await Section.findOne({
                where: {
                    uid: sectionUid,
                },
                transaction: t
            });

            if (!sectionEntity) {
                throw new Error(`Section not found`);
            }

            let unitEntity;

            if (!newUnits.has(unitName)) {

                // create unit
                const lastUnitIndex = await Unit.max('index', {
                    where: {
                        sectionUid: sectionUid
                    },
                    transaction: t
                });

                unitEntity = await Unit.create({
                    name: unitName,
                    index: (lastUnitIndex || 0) + 1,
                    sectionUid: sectionUid,
                }, { transaction: t });

                newUnits.set(unitName, unitEntity);
            }

            // keys like this are necessary because of the hierarchical relationship
            // imagine two tasks with the same name in different units
            // sorry if I hurty your brain
            let taskKey = unitName + ":" + taskName;
            let taskEntity = newTasks.get(taskKey);

            if (!taskEntity) {

                const lastTaskIndex = await Task.max('index', {
                    where: {
                        unitUid: unitEntity ? unitEntity.uid : newUnits.get(unitName).uid
                    },
                    transaction: t
                });

                // create task
                taskEntity = await Task.create({
                    name: taskName,
                    index: (lastTaskIndex || 0) + 1,
                    unitUid: unitEntity ? unitEntity.uid : newUnits.get(unitName).uid, // get from map if already created
                }, { transaction: t });

                newTasks.set(taskKey, taskEntity);
            }

            // find next question index
            const lastQuestionIndex = await Question.count({
                where: {
                    taskUid: taskEntity ? taskEntity.uid : newTasks.get(taskName).uid
                },
                transaction: t
            });

            // if multiple answer question, store as array, else single answer
            const correctAnswers = question.type === 'multiple-answer' ? JSON.stringify(question.correctAnswers) : question.correctAnswers[0];
            const correctIndices = question.type === 'multiple-answer' ? JSON.stringify(question.correctIndices) : question.correctIndices[0];

            // for insertion
            const questionData = {
                taskUid: taskEntity.uid,
                index: lastQuestionIndex + 1,
                ai: question.ai,
                prompt: question.prompt,
                type: question.type,
                correct_index: correctIndices,
                correct_answer: correctAnswers,
                answers: JSON.stringify(question.answers)
            }

            // create question
            await Question.create(questionData, { transaction: t });

        }

    });
}

// async function testing(){
//     console.log(await getEntityHierarchy('section', 1));
// }

// testing();