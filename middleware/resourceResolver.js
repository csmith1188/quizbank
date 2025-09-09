const testData = require("./quizsources/10th.json");
const depthMap = new Map([
    ["course", 0],
    ["section", 1],
    ["unit", 2],
    ["task", 3],
    ["question", 4]
]);

module.exports = (req, res, next) => {
    let pieces = req.path.split('/').filter(p => p);
}