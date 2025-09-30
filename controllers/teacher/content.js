const {isAuthenticated} = require('../../middleware/auth');
const userService = require('../../services/user-service');

module.exports = (router) => {

    router.get('/content', isAuthenticated, (req, res) => {
        res.render('pages/teacher/content.ejs', { title: 'Content' });
    });

    router.post('/content', (req, res) => {
        
    })

};