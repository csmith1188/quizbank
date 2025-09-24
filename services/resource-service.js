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

function parseResourcePath(path) {
    const pieces = path.split("/").filter(Boolean);
    let pickAmount = null;

    if (pieces[pieces.length - 2] === "pick") {
        pickAmount = parseInt(pieces.pop(), 10);
        pieces.pop(); // remove 'pick'
    }

    const segments = [];
    for (let i = 0; i < pieces.length; i += 2) {
        segments.push({
            type: pieces[i],
            ids: pieces[i + 1]
                ? pieces[i + 1].split("+").map(Number)
                : []
        });
    }
    return { segments, pickAmount };
}

function resolveHierarchy(root, segments) {
    let data = root;

    segments.forEach(({ type, ids }) => {

        const collection = data[type + "s"];
        if (!collection) throw new Error(`Invalid resource type: ${type}`);
        if (!ids.length) { data = collection; return; }

        const matched = collection.filter(e => ids.includes(e.id));

        if (!matched.length) throw new Error(`Resource not found: ${type} ${ids}`);

        data = matched.length === 1 ? matched[0] : {
            id: ids.join("+"),
            name: `Combined ${type}s`,
            [type + "s"]: matched
        };

    });

    return data;
}

module.exports.getFullCourseHierarchy = async (userId) => {
    const courses = await Course.findAll({
        where: { userId: userId },
        include: [
            {
                model: Section,
                include: [
                    {
                        model: Unit,
                        include: [
                            {
                                model: Task,
                                include: [Question]
                            }
                        ]
                    }
                ]
            }
        ],
        order: [
            ["id", "ASC"],
            [Section, "id", "ASC"],
            [Section, Unit, "id", "ASC"],
            [Section, Unit, Task, "id", "ASC"],
            [Section, Unit, Task, Question, "id", "ASC"],
        ]
    });

    // Convert to plain JS objects
    return courses.map(c => c.toJSON());
}

module.exports.getResource = (userId, path) => {
    const { segments, pickAmount } = parseResourcePath(path);

    if (segments.length === 0) {
        throw new Error("Empty resource path");
    }

    if (resourceDepthMap.get(segments[0].type) !== 0) {
        throw new Error(`Path must start with a course: found ${segments[0].type}`);
    }

    let data = resolveHierarchy({ courses: Course.getAll({ scope: shallow }) }, segments);

    if (pickAmount) {
        const allQuestions = collectQuestions(data);

        if (allQuestions.length === 0) throw new Error("No questions available to pick from");
        if (pickAmount > allQuestions.length) throw new Error(`Requested ${pickAmount} questions, but only ${allQuestions.length} available`);

        data = { questions: getRandomItems(allQuestions, pickAmount) };
    }

    return data;
}
