// Imports
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const session = require('express-session');
const { io } = require('socket.io-client');
const SQLiteStore = require('connect-sqlite3')(session);
const { db, get, run } = require('./lib/db');

// Database is opened in lib/db.js

//Constants
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'your_secret_key';
const AUTH_URL = process.env.AUTH_URL || 'http://localhost:420/oauth';
const THIS_URL = process.env.THIS_URL || `http://localhost:${PORT}`;
const API_KEY = process.env.API_KEY || 'your_api_key';

// Debug: log env on startup
console.log('[DEBUG] Env loaded:', {
    PORT,
    AUTH_URL,
    THIS_URL,
    SESSION_SECRET_SET: !!SESSION_SECRET,
    API_KEY_SET: !!API_KEY,
    oauthRedirectUrl: `${AUTH_URL}/oauth?redirectURL=${encodeURIComponent(THIS_URL)}`
});

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: './db' }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))

function isAuthenticated(req, res, next) {
    if (!req.session.user) {
        console.log('[DEBUG] isAuthenticated: no session.user, redirecting to /login');
        return res.redirect('/login');
    }
    if (req.session.userId == null) {
        get('SELECT id FROM users WHERE username = ?', [req.session.user])
            .then((row) => { if (row) req.session.userId = row.id; next(); })
            .catch(() => next());
    } else next();
};

// Expose a simple teacher flag to views based on Formbar permissions
app.use((req, res, next) => {
  const token = req.session && req.session.token ? req.session.token : {};
  const perms = typeof token.permissions === 'number' ? token.permissions : null;
  res.locals.isTeacher = perms != null && perms >= 4; // 4 = Teacher per Formbar docs
  next();
});

// Debug endpoint first - no auth, for testing
app.get('/debug', async (req, res) => {
    const oauthUrl = `${AUTH_URL}/oauth?redirectURL=${encodeURIComponent(THIS_URL)}`;
    let fetchResult = { status: null, ok: null, error: null };
    try {
        const resp = await fetch(oauthUrl, { redirect: 'manual' });
        fetchResult = { status: resp.status, ok: resp.ok };
    } catch (e) {
        fetchResult.error = e.message;
    }
    res.json({
        env: { PORT, AUTH_URL, THIS_URL, oauthUrl },
        session: req.session ? { user: req.session.user, userId: req.session.userId } : null,
        fetchOAuth: fetchResult
    });
});

const apiRouter = require('./routes/api');
app.use('/api', apiRouter);
const progressRouter = require('./routes/progress');
app.use(progressRouter);

// Login/logout must be before isAuthenticated middleware to avoid redirect loops
app.get('/login', async (req, res) => {
    const oauthUrl = `${AUTH_URL}/oauth?redirectURL=${encodeURIComponent(THIS_URL)}`;
    console.log('[DEBUG] GET /login', { hasToken: !!req.query.token, sessionUser: !!req.session?.user, queryKeys: Object.keys(req.query || {}) });

    if (req.query.token) {
        let tokenData = jwt.decode(req.query.token);
        console.log('[DEBUG] Token decoded:', tokenData ? { displayName: tokenData.displayName, id: tokenData.id, sub: tokenData.sub } : 'null');
        if (!tokenData) {
            console.log('[DEBUG] Invalid token, redirecting to OAuth');
            return res.redirect(oauthUrl);
        }
        req.session.token = tokenData;
        req.session.user = tokenData.displayName;
        const formbarId = tokenData.id != null ? tokenData.id : tokenData.sub;

        try {
            // Save or update user: find by formbar_id or username, set formbar_id if missing
            const existingByFormbar = formbarId != null
                ? await get('SELECT id FROM users WHERE formbar_id = ?', [formbarId])
                : null;
            const existingByUsername = await get('SELECT id, formbar_id FROM users WHERE username = ?', [tokenData.displayName]);

            if (existingByFormbar) {
                req.session.userId = existingByFormbar.id;
                if (existingByUsername && existingByUsername.id !== existingByFormbar.id) {
                    await run('UPDATE users SET username = ? WHERE id = ?', [tokenData.displayName, existingByFormbar.id]);
                } else if (!existingByUsername) {
                    await run('UPDATE users SET username = ? WHERE id = ?', [tokenData.displayName, existingByFormbar.id]);
                }
            } else if (existingByUsername) {
                req.session.userId = existingByUsername.id;
                if (formbarId != null && existingByUsername.formbar_id == null) {
                    await run('UPDATE users SET formbar_id = ? WHERE id = ?', [formbarId, existingByUsername.id]);
                }
            } else {
                await run('INSERT INTO users (username, formbar_id) VALUES (?, ?)', [tokenData.displayName, formbarId ?? null]);
                const row = await get('SELECT id FROM users WHERE username = ?', [tokenData.displayName]);
                if (row) req.session.userId = row.id;
            }
            console.log('[DEBUG] User saved, session.userId=', req.session.userId);
            req.session.save((err) => {
                if (err) console.error('[DEBUG] Session save error:', err);
                console.log('[DEBUG] Redirecting to / after login');
                res.redirect('/');
            });
        } catch (err) {
            console.error('[DEBUG] DB error:', err.message);
            res.redirect('/');
        }
    } else {
        console.log('[DEBUG] No token, redirecting to OAuth:', oauthUrl);
        res.redirect(oauthUrl);
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// / must be before teacher router so it matches first (original boilerplate behavior)
app.get('/', isAuthenticated, (req, res) => {
    res.render('index', { user: req.session.user });
});

const teacherRouter = require('./routes/teacher');
app.use(isAuthenticated, teacherRouter);

// Start server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});