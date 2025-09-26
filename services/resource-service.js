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

getFullCourseHierarchy = async (userUid) => {
    const courses = await Course.findAll({

        where: { UserUid: userUid },
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
            ["index", "ASC"],
            [Section, "index", "ASC"],
            [Section, Unit, "index", "ASC"],
            [Section, Unit, Task, "index", "ASC"],
            [Section, Unit, Task, Question, "index", "ASC"],
        ]
    });

    // Convert to plain JS objects
    let json = {
        courses: courses.map(c => c.toJSON())
    };
    return json;
}

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

function resolveHierarchy(root, segments) {

    let data = root;

    segments.forEach(({ type, indexes }) => {

        const collection = data[type + "s"];
        if (!collection) throw new Error(`Invalid resource type: ${type}`);
        if (!indexes.length) { data = collection; return; }

        console.log(collection);

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

    console.log(segments);

    if (segments.length === 0) {
        throw new Error("Empty resource path");
    }

    if (resourceDepthMap.get(segments[0].type) !== 0) {
        throw new Error(`Path must start with a course: found ${segments[0].type}`);
    }

    let data = await getFullCourseHierarchy(userId);
    console.log(data);
    let resolvedData = resolveHierarchy(data, segments);

    if (pickAmount) {
        const allQuestions = collectQuestions(resolvedData);

        if (allQuestions.length === 0) throw new Error("No questions available to pick from");
        if (pickAmount > allQuestions.length) throw new Error(`Requested ${pickAmount} questions, but only ${allQuestions.length} available`);

        data = { questions: getRandomItems(allQuestions, pickAmount) };
    }

    return data;
}

let testing = async () => {
    let path = "course/1/section/1/unit/3/task/1/pick/2";
    let userId = 1;
    module.exports.getResource(userId, path).then(data => {
        console.log(JSON.stringify(data, null, 2));
    }).catch(err => {
        console.error(err);
    });
}
testing();
