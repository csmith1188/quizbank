function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect(`/formbar?redirectURL=${THIS_URL}`);
    }
}

module.exports = isAuthenticated;