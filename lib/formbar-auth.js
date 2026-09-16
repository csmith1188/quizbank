const { get } = require('./db');

function getFormbarApiBase() {
    const authUrl = process.env.AUTH_URL;
    if (!authUrl) return null;
    const base = String(authUrl).replace(/\/+$/, '').replace(/\/oauth$/i, '');
    return base.endsWith('/api') ? base : `${base}/api`;
}

function getApiKey(req) {
    const apiHeader = req.headers && (req.headers.api || req.headers['x-api-key']);
    if (apiHeader) return String(apiHeader).trim();

    const authorization = req.headers && req.headers.authorization;
    if (typeof authorization === 'string' && /^Bearer\s+/i.test(authorization)) {
        return authorization.replace(/^Bearer\s+/i, '').trim();
    }

    return req.query && req.query.api_key ? String(req.query.api_key).trim() : '';
}

async function authenticateFormbarApiKey(apiKey) {
    const base = getFormbarApiBase();
    if (!base || !apiKey) return null;

    const response = await fetch(`${base}/me`, {
        headers: { API: apiKey, Accept: 'application/json' }
    });
    if (!response.ok) return null;

    const payload = await response.json();
    const user = payload && (payload.user || (payload.data && payload.data.user) || payload.data || payload);
    const formbarId = user && (user.id ?? user.userId ?? user._id);
    if (formbarId == null) return null;
    const permissions = user && user.permissions != null
        ? user.permissions
        : (payload && payload.permissions != null ? payload.permissions : null);

    const localUser = await get('SELECT id, username, formbar_id FROM users WHERE formbar_id = ?', [formbarId]);
    return localUser ? { ...localUser, formbarId, permissions } : null;
}

async function apiAuthentication(req, res, next) {
    const apiKey = getApiKey(req);
    if (!apiKey) return next();

    try {
        const user = await authenticateFormbarApiKey(apiKey);
        if (!user) return res.status(401).json({ error: 'Invalid Formbar API key' });
        req.apiUser = user;
        req.apiKey = apiKey;
        next();
    } catch (err) {
        console.error('Error authenticating Formbar API key:', err.message);
        res.status(502).json({ error: 'Unable to authenticate with Formbar' });
    }
}

function getAuthenticatedUserId(req) {
    return (req.apiUser && req.apiUser.id) || (req.session && req.session.userId) || null;
}

module.exports = { apiAuthentication, getAuthenticatedUserId, getApiKey };