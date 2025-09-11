const testData = require("../quizsources/courses.json");
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

module.exports = (req, res, next) => {
    try {

        let pieces = req.path.split('/').filter(p => p);

        let lastResourceType = pieces[pieces.length - 2];
        let lastResourceId = pieces[pieces.length - 1];
        let pickAmount = null;

        // handle picking random questions
        if (lastResourceType === 'pick') {

            if (pieces.length < 3) {
                throw new Error(`Invalid pick request: ${req.path}`);
            }

            pickAmount = parseInt(lastResourceId);

            if (isNaN(pickAmount) || pickAmount <= 0) {
                throw new Error(`Invalid pick amount: ${lastResourceId}`);
            }

            pieces = pieces.slice(0, -2); // remove the last two pieces

        }

        console.log(`we are picking ${pickAmount} questions`);

        let data = testData;
        let currentDepth = -1;

        for (let i = 0; i < pieces.length; i += 2) {

            const resourceType = pieces[i];
            const resourceId = pieces[i + 1];
            
            let pickingSoon = Boolean(pickAmount);
            let pickingNow = (i + 2 >= pieces.length) && pickAmount;

            currentDepth++;

            if (resourceDepthMap.get(resourceType) !== currentDepth) {
                throw new Error(`Invalid resource type: ${resourceType} at depth ${currentDepth}`);
            }

            data = data[resourceType + 's']; // pluralize the resource type to match the key in the data
            console.log(`next layer: ${resourceType}s`);

            // if no id is supplied, list all in the collection. Breaking prevents further traversal.
            if (!resourceId && !pickingSoon) {
                break;
            }

            // if picking questions AND we are at the last resource type in the path, pick random questions from here and break
            if (pickingNow) {
                console.log('picking now');
                console.log(data);
                // collect all questions under the current data
                let allQuestions = collectQuestions(data);
                data = getRandomItems(allQuestions, pickAmount);
                break;
            }

            // find the entity with the given id
            let entityIndex = data.findIndex(entity => entity.id === parseInt(resourceId));

            if (entityIndex !== -1) {
                // next layer
                data = data[entityIndex];
                console.log(`found data with id: ${resourceId}, next layer`);
            } else {
                throw new Error(`Resource not found: ${resourceType} with ID ${resourceId}`);
            }

        }

        res.send(shallow(data));

    } catch (error) {
        next(error);
    }
}