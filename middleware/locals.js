function locals(req, res, next){
    res.locals.user = req.session.user;
    res.locals.isLoggedIn = (typeof req.session.user !== 'undefined');
    next();
}

module.exports = locals;