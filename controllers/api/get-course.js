module.exports = (router) => {

    router.get('/course/:courseId', (req, res) => {
        res.send(`Course ID: ${req.params.courseId}`)
    });

};