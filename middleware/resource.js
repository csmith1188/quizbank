const resourceService = require('../services/resource-service');
const { shallow } = require("../util/scope-limit");

module.exports = async (req, res, next) => {
    try {
        const data = await resourceService.getResource(req.path);
        res.send(shallow(data));
      } catch (err) {
        next(err); // Let Express error middleware handle it
      }
}
