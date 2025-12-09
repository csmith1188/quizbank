const { isAuthenticated } = require('../../../middleware/auth');
const {
  editCourseForUser,
  editSectionForUser,
  editUnitForUser,
  editTaskForUser
} = require('../../../services/resource-service');

module.exports = function (router) {
  router.post('/edit', isAuthenticated, async (req, res) => {
    try {
      const { type, uid, name, description, genprompt, oldIndex, newIndex } = req.body;

      let updatedResource;

      const updateData = { uid, name, description, oldIndex, newIndex };
      if (genprompt !== undefined) updateData.genprompt = genprompt;

      switch (type) {
        case 'course':
          updatedResource = await editCourseForUser(updateData);
          break;
        case 'section':
          updatedResource = await editSectionForUser(updateData);
          break;
        case 'unit':
          updatedResource = await editUnitForUser(updateData);
          break;
        case 'task':
          updatedResource = await editTaskForUser(updateData);
          break;
        default:
          return res.status(400).json({ success: false, message: 'Invalid resource type.' });
      }

      res.json({
        success: true,
        message: `${type} updated successfully.`,
        type: type,
        ...updatedResource
      });

    } catch (error) {
      console.error('Error editing resource:', error);
      res.status(500).json({ success: false, message: 'Server error editing resource.' });
    }
  });
};