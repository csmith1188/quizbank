const { User, Course, Section, Unit, Task, Question } = require("../db/db");
const { shallow } = require("../util/scope-limit");
const { getRandomItems } = require('../util/misc');

const resourceDepthMap = new Map([
    ["course", 0],
    ["section", 1],
    ["unit", 2],
    ["task", 3],
    ["question", 4]
]);

// Add plural to singular map
const pluralToSingular = {
    "courses": "course",
    "sections": "section",
    "units": "unit",
    "tasks": "task",
    "questions": "question"
};

// Recursively collect all questions from the data
const collectQuestions = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) {
        return data.flatMap(collectQuestions);
    }
    if (typeof data === "object") {
        if (data.questions) {
            return data.questions;
        }
        return Object.values(data).flatMap(collectQuestions);
    }
    return [];
};

// Fetch the full course hierarchy for a user
module.exports.getFullCourseHierarchy = async (userUid) => {
    const courses = await Course.findAll({
        where: { userUid: userUid }, // Filter by userUid
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

module.exports.createCourseForUser = async (userUid, courseName) => {
    if (!courseName || !courseName.trim()) {
        throw new Error("Course name is required.");
    }

    const count = await Course.count({ where: { userUid } });

    const course = await Course.create({
        userUid,
        name: courseName.trim(),
        index: count + 1
    });

    return course.toJSON();
};

module.exports.createSectionForUser = async (userUid, sectionName) => {
    if (!sectionName || !sectionName.trim()) {
        throw new Error("Section name is required.");
    }

    const courses = await Course.findAll({
        where: { userUid },
        attributes: ["uid"]
    });

    const courseUid = courses[0].uid;
    const count = await Section.count({ where: { courseUid } });
    const section = await Section.create({
        courseUid,
        name: sectionName.trim(),
        index: count + 1
    });
    return section.toJSON();
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
    let pickAmount = null;

    if (pieces[pieces.length - 2] === "pick") {
        pickAmount = parseInt(pieces.pop(), 10);
        pieces.pop(); // remove 'pick'
    }

    const segments = [];
    for (let i = 0; i < pieces.length; i += 2) {
        let type = pieces[i];
        // Normalize plural to singular
        if (pluralToSingular[type]) type = pluralToSingular[type];
        segments.push({
            type: type,
            indexes: pieces[i + 1]
                ? pieces[i + 1].split("+").map(Number)
                : []
        });
    }
    return { segments, pickAmount };
}

// Resolve the hierarchy based on segments
function resolveHierarchy(root, segments) {
    let data = root;

    segments.forEach(({ type, indexes }) => {
        const collection = data[type + "s"];
        if (!collection) throw new Error(`Invalid resource type: ${type}`);

        if (!indexes.length) { 
            data = collection; 
            return; 
        }

        const matched = collection.filter(e => indexes.includes(e.index));
        if (!matched.length) throw new Error(`Resource not found: ${type} ${indexes}`);

        data = matched.length === 1 ? matched[0] : {
            name: `Combined ${type}s`,
            [type + "s"]: matched
        };
    });

    return data;
}

module.exports.getResource = async (userId, path) => {
    const { segments, pickAmount } = parseResourcePath(path);

    if (segments.length === 0) {
        throw new Error("Empty resource path");
    }

    if (resourceDepthMap.get(segments[0].type) !== 0) {
        throw new Error(`Path must start with a course: found ${segments[0].type}`);
    }

    let data = await module.exports.getFullCourseHierarchy(userId);
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
        const allQuestions = collectQuestions(resolvedData);

        if (allQuestions.length === 0) throw new Error("No questions available to pick from");
        if (pickAmount > allQuestions.length) throw new Error(`Requested ${pickAmount} questions, but only ${allQuestions.length} available`);

        resolvedData = { questions: getRandomItems(allQuestions, pickAmount) };
    }

    return resolvedData;
}