module.exports = (router) => {

    router.get('/error', (req, res) => {
        res.render('pages/error', { title: 'Error' });
    });
    
};