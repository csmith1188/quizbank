const testData = require("../quizsources/courses.json");
const {shallow} = require("../util/scope-limit");

const resourceDepthMap = new Map([
    ["course", 0],
    ["section", 1],
    ["unit", 2],
    ["task", 3],
    ["question", 4]
]);

module.exports = (req, res, next) => {
    try {

        let pieces = req.path.split('/').filter(p => p);

        if (pieces.length % 2 !== 0) {
            throw new Error('Invalid path structure');
        }

        let data = testData;
        let currentDepth = -1;

        for (let i = 0; i < pieces.length; i += 2) {

            const resourceType = pieces[i];
            const resourceId = pieces[i + 1];

            currentDepth++;

            if (resourceDepthMap.get(resourceType) !== currentDepth) {
                throw new Error(`Invalid resource type: ${resourceType} at depth ${currentDepth}`);
            }

            data = data[resourceType + 's'];
            
            let entityIndex = data.findIndex(entity => entity.id === parseInt(resourceId));

            if (entityIndex === -1) {
                throw new Error(`Resource not found: ${resourceType} with ID ${resourceId}`);
            }

            data = data[entityIndex];
            //console.log(currentDepth);


        }

        res.send(shallow(data));

    } catch (error) {
        next(error);
    }
}