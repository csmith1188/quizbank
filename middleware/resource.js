const resourceService = require('../services/resource-service');
const { shallow } = require("../util/scope-limit");
const {parseStringifiedArraysInObject} = require("../util/misc")

module.exports = async (req, res, next) => {
    try {
        const resourcePath = req.path;
        const questionType = req.query.type;
        const pickAmount = req.query.pick;
        const data = await resourceService.getResource(resourcePath, pickAmount, questionType);

        // band aid fix later
        if (Array.isArray(data) && typeof data[0].answers === 'string') {
          data[0].answers = JSON.parse(data[0].answers);
        }

        res.send(shallow(data));

      } catch (err) {
        next(err); // Let Express error middleware handle it
      }
}