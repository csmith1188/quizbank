function getClientIp(req) {
    const fwd = req.headers && req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.trim()) {
        return fwd.split(',')[0].trim();
    }
    return (req.ip || (req.connection && req.connection.remoteAddress) || 'unknown').toString();
}

function defaultKey(req) {
    const userId = req.session && req.session.userId ? String(req.session.userId) : '';
    if (userId) return 'user:' + userId;
    const apiKey = req.query && req.query.api_key ? String(req.query.api_key) : '';
    if (apiKey) return 'api_key:' + apiKey;
    return 'ip:' + getClientIp(req);
}

function createRateLimiter(options) {
    const opts = options || {};
    const windowMs = Number(opts.windowMs) > 0 ? Number(opts.windowMs) : 60000;
    const max = Number(opts.max) > 0 ? Number(opts.max) : 60;
    const keyFn = typeof opts.keyFn === 'function' ? opts.keyFn : defaultKey;
    const message = opts.message || 'Too many requests';
    const store = new Map();

    function cleanup(now) {
        for (const [k, rec] of store.entries()) {
            if (!rec || rec.resetAt <= now) store.delete(k);
        }
    }

    return function rateLimitMiddleware(req, res, next) {
        const now = Date.now();
        if (Math.random() < 0.02) cleanup(now);
        const key = keyFn(req);
        const existing = store.get(key);
        const rec = existing && existing.resetAt > now
            ? existing
            : { count: 0, resetAt: now + windowMs };
        rec.count += 1;
        store.set(key, rec);

        const remaining = Math.max(0, max - rec.count);
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(rec.resetAt / 1000)));

        if (rec.count > max) {
            const retryAfter = Math.max(1, Math.ceil((rec.resetAt - now) / 1000));
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({ error: message });
        }
        next();
    };
}

module.exports = { createRateLimiter, getClientIp };
