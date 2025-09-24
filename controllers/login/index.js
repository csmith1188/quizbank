const isLoggedIn = require('../../middleware/logged-in');

module.exports = (router) => {

    router.get('/', isLoggedIn, (req, res) => {
        res.render('pages/login-system/index.ejs', { title: 'Login' });
    });

    router.post('/native', isLoggedIn, (req, res) => {
        res.send('Native login not yet implemented');
    });

    router.post('/formbar', isLoggedIn, (req, res) => {
        res.redirect('/login/formbar');
    });

    router.post('/google', isLoggedIn, (req, res) => {
        res.send('Google login not yet implemented');
    });

    router.post('/microsoft', isLoggedIn, (req, res) => {
        res.send('Microsoft login not yet implemented');
    });
};