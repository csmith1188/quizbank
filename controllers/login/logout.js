const isAuthenticated = require('../../middleware/auth');

module.exports = (router) => {

    router.get('/logout', isAuthenticated, (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.clearCookie('connect.sid');
            res.redirect('/');
        });
    });
    
};