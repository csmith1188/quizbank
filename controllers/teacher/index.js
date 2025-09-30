const {isAuthenticated} = require('../../middleware/auth');

module.exports = (router) => {

    router.get('/', isAuthenticated, (req, res) => {
        res.render('pages/teacher/index.ejs', { title: 'Dashboard' });
    });
    
};