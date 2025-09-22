const jwt = require('jsonwebtoken');
const UserService = require('../../services/user-service');
const isAuthenticated = require('../../middleware/auth');

const FBJS_URL = process.env.FBJS_URL || 'https://formbar.yorktechapps.com';
const THIS_URL = process.env.THIS_URL || 'http://localhost:3000/login/formbar';

module.exports = function (router) {

    router.get('/formbar', async (req, res) => {
        const { token } = req.query;
        if (token) {
            const tokenData = jwt.decode(token);
    
            const userId = tokenData.id || tokenData.sub || tokenData.user_id;
    
            if (!userId) {
                return res.status(400).send("User ID not found in token.");
            }
    
            let user = await UserService.findUserById(userId);
            if (!user) {
                user = await UserService.createUser(userId, tokenData.username, tokenData.email);
            }
    
            req.session.user = {
                username: user.username,
                email: user.email,
                id: user.fb_id
            };
            req.session.token = tokenData;
    
            req.session.save(() => {
                res.redirect('/');
            });
        } else {
            res.redirect(`${FBJS_URL}/oauth?redirectURL=${THIS_URL}`);
        }
    });

};