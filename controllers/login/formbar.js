require('dotenv').config();
const jwt = require('jsonwebtoken');
const UserService = require('../../services/user-service');
const createSession = require('../../middleware/create-session');

const FBJS_URL = process.env.FBJS_URL || 'https://formbeta.yorktechapps.com';
const THIS_URL = process.env.THIS_URL || 'http://localhost:3000/login/formbar';

module.exports = function (router) {

    router.get('/formbar', async (req, res) => {
        const { token } = req.query;
        if (token) {
            const tokenData = jwt.decode(token);
    
            const userId = tokenData.id || tokenData.sub || tokenData.user_id;
    
            if (!userId) {
                return res.render('error', { message: "User ID not found in token." });
            }
    
            let user = await UserService.findUserByFbId(userId);
            if (!user) {
                user = await UserService.createUser(userId, tokenData.username, tokenData.email);
            }
    
            createSession(req, res, user);
        } else {
            res.redirect(`${FBJS_URL}/oauth?redirectURL=${THIS_URL}`);
        }
    });

};