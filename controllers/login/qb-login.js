module.exports = (router) => {

    router.get('/native', (req, res) => {
        res.render('pages/login-system/native-login', { title: 'Login Page' });
    });

    router.post('/native', (req, res) => {
        const { username, password } = req.body;
        console.log(`Username: ${username}, Password: ${password}`);
        res.redirect('/');
    });

};