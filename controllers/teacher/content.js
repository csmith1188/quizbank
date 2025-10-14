const resourceService = require('../../services/resource-service');

module.exports = function(router) {
    router.get('/content', async (req, res, next) => {
        try {
            const user = req.session.user;
            if (!user) return res.redirect('/');
            const allContentData = await resourceService.getResource(user.uid, '/course');
            res.render('pages/teacher/content', {
                allContentData: JSON.stringify(allContentData)
            });
        } catch (err) {
            next(err);
        }
    });
    
};