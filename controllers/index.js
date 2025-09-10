module.exports = (router) => {

    router.get('/', (req, res) => {
        res.render('pages/index', { title: 'Home' });
    });

};