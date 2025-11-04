module.exports = (router) => {

    router.get('/help', (req, res) => {
        res.render('pages/help', { title: 'Help page' });
    });
    
};