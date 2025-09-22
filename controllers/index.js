module.exports = (router) => {

    router.get('/', (req, res) => {
        res.render('pages/index', { title: 'Home', user: req.session.user });
    });
    
};