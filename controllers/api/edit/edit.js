const { isAuthenticated } = require('../../../middleware/auth');
const { courses, sections, tasks, units } = require('../../../db/db');

module.exports = function (router) {
  router.put('/edit', isAuthenticated, async (req, res) => {
    console.log('hello')
  });
};