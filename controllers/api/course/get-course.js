module.exports = (router) => {

    router.get('/:courseId', (req, res) => {
        res.send(`Course ID: ${req.params.courseId}`);
    });

};