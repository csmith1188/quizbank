module.exports = (router) => {

    // Render login page
    router.get('/', (req, res) => {
        res.render('pages/login-system/index.ejs', { title: 'Login' });
    });

    router.post('/native', (req, res) => {
        res.send('Native login not yet implemented');
    });

    router.post('/formbar', (req, res) => {
        res.redirect('/login/formbar');
    });

    router.post('/google', (req, res) => {
        res.send('Google login not yet implemented');
    });

    router.post('/microsoft', (req, res) => {
        res.send('Microsoft login not yet implemented');
    });

};