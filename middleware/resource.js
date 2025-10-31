const resourceService = require('../services/resource-service');
const { shallow } = require("../util/scope-limit");

module.exports = async (req, res, next) => {
    try {
        const resourcePath = req.path;
        const questionType = req.query.type;
        const userUid = req.session.user.uid;
        const data = await resourceService.getResource(userUid, resourcePath, questionType);
        
        res.send(shallow(data));

      } catch (err) {
        next(err); // Let Express error middleware handle it
      }
}