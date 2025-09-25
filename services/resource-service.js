const { Course, Section, Unit, Task, Question } = require("../db/db");
const { shallow } = require("../util/scope-limit");
const { getRandomItems } = require('../util/misc');

const resourceDepthMap = new Map([
    ["Course", 0],
    ["Section", 1],
    ["Unit", 2],
    ["Task", 3],
    ["Question", 4]
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
            type: pieces[i].charAt(0).toUpperCase() + pieces[i].slice(1),
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
            ["uid", "ASC"],
            [Section, "uid", "ASC"],
            [Section, Unit, "uid", "ASC"],
            [Section, Unit, Task, "uid", "ASC"],
            [Section, Unit, Task, Question, "uid", "ASC"],
        ]
    });

    // Convert to plain JS objects
    return courses.map(c => c.toJSON());
}

module.exports.getResource = (userId, path) => {
    const { segments, pickAmount } = parseResourcePath(path);

    console.log(segments);

    if (segments.length === 0) {
        throw new Error("Empty resource path");
    }

    if (resourceDepthMap.get(segments[0].type) !== 0) {
        throw new Error(`Path must start with a course: found ${segments[0].type}`);
    }

    let data = getFullCourseHierarchy(userId);
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
    let path = "course/1/section/2/unit/3/task/4/pick/2";
    let userId = 1;
    module.exports.getResource(userId, path).then(data => {
        console.log(JSON.stringify(data, null, 2));
    }).catch(err => {
        console.error(err);
    });
}
testing();
