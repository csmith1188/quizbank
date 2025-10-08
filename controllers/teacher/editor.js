module.exports = (router) => {

    router.get('/editor', (req, res) => {
        res.render('pages/teacher/editor', { title: 'Editor' });
    });
    
};