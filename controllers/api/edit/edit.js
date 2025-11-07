const { isAuthenticated } = require('../../../middleware/auth');
const { editCourseForUser, editSectionForUser, editUnitForUser, editTaskForUser } = require('../../../services/resource-service');

module.exports = function (router) {
  router.post('/edit', isAuthenticated, async (req, res) => {
    try {
      const { type, uid, name, index, description, genprompt } = req.body;
      let updatedResource;

      switch (type) {
        case 'course':
          updatedResource = await editCourseForUser({ uid, name, index, description });
          break;
        case 'section':
          updatedResource = await editSectionForUser({ uid, name, index, description });
          break;
        case 'unit':
          updatedResource = await editUnitForUser({ uid, name, index, description });
          break;
        case 'task':
          updatedResource = await editTaskForUser({ uid, name, index, description, genprompt });
          break;
        default:
          return res.status(400).json({ success: false, message: 'Invalid resource type.' });
      }

      res.json({ success: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully.`, ...updatedResource });
    } catch (error) {
      console.error('Error editing resource:', error);
      res.status(500).json({ success: false, message: 'Server error editing resource.' });
    }
  });
};