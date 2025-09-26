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

// Fetch the full course hierarchy for a user
getFullCourseHierarchy = async (userUid) => {
    const courses = await Course.findAll({
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
        segments.push({
            type: pieces[i],
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

    // traverse each segment of the resource path
    segments.forEach(({ type, indexes }) => {

        // next layer of the hierarchy
        const collection = data[type + "s"];
        if (!collection) throw new Error(`Invalid resource type: ${type}`);
        // if no indexes specified, return all
        if (!indexes.length) { data = collection; return; }

        // find entity matching the indexes
        const matched = collection.filter(e => indexes.includes(e.index));

        if (!matched.length) throw new Error(`Resource not found: ${type} ${indexes}`);

        // if one index, return that entity
        // if multiple, return a combined object
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

    // if pick amount is not null, pick questions under the resolved data
    if (pickAmount) {
        const allQuestions = collectQuestions(resolvedData);

        if (allQuestions.length === 0) throw new Error("No questions available to pick from");
        if (pickAmount > allQuestions.length) throw new Error(`Requested ${pickAmount} questions, but only ${allQuestions.length} available`);

        resolvedData = { questions: getRandomItems(allQuestions, pickAmount) };
    }

    return resolvedData;
}

let testing = async () => {
    let path = "course/1/section/1+2/pick/4";
    let userId = 1;
    module.exports.getResource(userId, path).then(data => {
        console.log(JSON.stringify(data, null, 2));
    }).catch(err => {
        console.error(err);
    });
}
testing();
