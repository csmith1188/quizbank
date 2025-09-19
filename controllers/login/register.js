module.exports = (router) => {

    router.get('/register', (req, res) => {
        res.render('pages/login-system/register', { title: 'Register' });
    });

};