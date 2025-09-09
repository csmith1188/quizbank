const { shallow } = require("../../util/scope-limit");
const data = require("../../quizsources/10th.json");

module.exports = (router) => {
    router.get('/course/:courseId', (req, res) => {
        const courseId = Number(req.params.courseId);

        // If the root object matches the courseId, return it
        if (data.id !== courseId) {
            return res.status(404).json({ error: "Course not found" });
        }

        const limitedCourse = shallow(data);
        res.json(limitedCourse);
    });
};