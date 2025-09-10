module.exports = (router) => {

    router.get('/native', (req, res) => {
        res.render('pages/login-system/native-login', { title: 'Login Page' });
    });

};