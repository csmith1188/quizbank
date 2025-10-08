function createSession(req, res, user, tokenData) {
    req.session.user = {
        email: user.email,
        username: user.username || user.email.split('@')[0],
        fb_id: user.fb_id || null,
        google_id: user.google_id || null,
        uid: user.uid,
        perm: user.perm || 0,
        theme: user.theme || 'light',
    };
    req.session.token = tokenData;
    
    req.session.save(() => {
        res.redirect('/');
    });
}

module.exports = createSession;