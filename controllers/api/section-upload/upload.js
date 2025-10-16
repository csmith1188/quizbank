const { getsectionsForUser, createsectionForUser } = require('../../../services/resource-service');

module.exports = (router) => {
  router.post('/upload', async (req, res) => {
    try {
      const userUid = req.session.user.uid;
      const { sectionName } = req.body;

      if (!sectionName || !sectionName.trim()) {
        return res.json({ success: false, message: 'Section name is required.' });
      }

      const newSection = await createSectionForUser(userUid, sectionName);

      res.json({
        success: true,
        message: `Section "${newSection.name}" created successfully!`,
        newSection
      });
    } catch (error) {
      console.error('❌ Error creating section:', error);
      res.status(500).json({ success: false, message: 'Server error creating section.' });
    }
  });
};