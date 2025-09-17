const testData = require("../quizsources/small.json");
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
        let lastResourceNumber = pieces[pieces.length - 1];
        let pickAmount = null;

        // handle picking random questions
        if (lastResourceType === 'pick') {
            if (pieces.length < 3) {
                throw new Error(`Invalid pick request: ${req.path}`);
            }

            pickAmount = parseInt(lastResourceNumber);

            if (isNaN(pickAmount) || pickAmount <= 0) {
                throw new Error(`Invalid pick amount: ${lastResourceNumber}`);
            }

            pieces = pieces.slice(0, -2); // remove the last two pieces
        }

        let data = testData;
        let currentDepth = -1;

        for (let i = 0; i < pieces.length; i += 2) {
            const resourceType = pieces[i];
            const resourceNumber = pieces[i + 1];

            let pickingSoon = Boolean(pickAmount); // is picking questions in the request?
            let pickingNow = pickingSoon && (i + 2 >= pieces.length); // is picking questions in the current iteration of the loop?

            currentDepth++;

            if (resourceDepthMap.get(resourceType) !== currentDepth) {
                throw new Error(`Invalid resource type: ${resourceType} at depth ${currentDepth}`);
            }

            data = data[resourceType + 's']; // pluralize to get the collection

            // if no number is supplied, list all in the collection. Breaking prevents further traversal.
            if (!resourceNumber && !pickingSoon) {
                break;
            }

            // 
            const ids = resourceNumber ? resourceNumber.split('+').map(id => parseInt(id)) : [];

            if (ids.length > 0) {
                let matchedEntities = data.filter(entity => ids.includes(entity.id));

                if (matchedEntities.length > 0) {
                    // If only one ID, keep as object (backward compatible)
                    if (matchedEntities.length === 1) {
                        data = matchedEntities[0];
                    // if it's multiple ID, build the combined object
                    } else {
                        data = {};
                        data.id = ids.join('+');
                        data.name = `Combined ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}s: ${matchedEntities.map(entity => entity.name).join(', ')}`;
                        data[resourceType + 's'] = matchedEntities;
                    }
                } else if (!pickingNow) {
                    throw new Error(`Resource(s) not found: ${resourceType} with ID(s) ${resourceNumber}`);
                }
            }

            // if picking questions AND we are at the last resource type in the path
            if (pickingNow) {
                let allQuestions = collectQuestions(data);
                data = getRandomItems(allQuestions, pickAmount);
                break;
            }
        }

        res.send(shallow(data));

    } catch (error) {
        next(error);
    }
}