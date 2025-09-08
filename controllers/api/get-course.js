const { getEntity, shallow } = require("../../util/scope-limit");

module.exports = (router) => {
    router.get('/course/:courseId', (req, res) => {
        const courseId = Number(req.params.courseId);

        // Top-level course object
        const course = getEntity(["id", courseId]);

        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        // Limit to shallow children (only id + name)
        const limitedCourse = shallow(course);

        res.json(limitedCourse);
    });
};
