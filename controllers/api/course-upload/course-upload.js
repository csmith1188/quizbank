const { getCoursesForUser, createCourseForUser } = require('../../../services/resource-service');

module.exports = (router) => {
  router.post('/upload', async (req, res) => {
    try {
      const userUid = req.session.user.uid;
      const { courseName } = req.body;

      if (!courseName || !courseName.trim()) {
        return res.json({ success: false, message: 'Course name is required.' });
      }

      const newCourse = await createCourseForUser(userUid, courseName);

      res.json({
        success: true,
        message: `Course "${newCourse.name}" created successfully!`,
        newCourse
      });
    } catch (error) {
      console.error('❌ Error creating course:', error);
      res.status(500).json({ success: false, message: 'Server error creating course.' });
    }
  });
};