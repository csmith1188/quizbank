const { Course, Section, Unit, Task, Question } = require("../db/db");
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
getFullCourseHierarchy = async (userUid) => {
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

    let data = await getFullCourseHierarchy(userId);
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