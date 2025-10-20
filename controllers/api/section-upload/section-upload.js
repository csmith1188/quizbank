const { createSectionForUser } = require('../../../services/resource-service');

module.exports = (router) => {
  router.post('/upload', async (req, res) => {
    try {
      const userUid = req.session.user.uid;
      const { sectionName, courseUid } = req.body;
      console.log('Received section upload request:', { sectionName, courseUid });

      if (!sectionName || !sectionName.trim()) {
        return res.json({ success: false, message: 'Section name is required.' });
      }

      if (!courseUid) {
        return res.json({ success: false, message: 'Course UID is required.' });
      }

      const newSection = await createSectionForUser(userUid, sectionName, courseUid);

      res.json({
        success: true,
        message: `Section "${newSection.name}" created successfully!`,
        newSection
      });
    } catch (error) {
      console.error('Error creating section:', error);
      res.status(500).json({ success: false, message: error.message || 'Server error creating section.' });
    }
  });
};