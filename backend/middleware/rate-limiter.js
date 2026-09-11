/**
 * --- BIZTONSÁGI RÉTEG (SECURITY LAYER) ---
 * IP alapú kéréskorlátozás (Rate Limiting) middleware.
 */

const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 perc
const MAX_REQUESTS = 200; // 200 kérés ablakonként

// Időzített takarítás (10 percenként) a memóriaszivárgás megelőzésére
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of requestCounts.entries()) {
        if (now > val.resetTime) {
            requestCounts.delete(key);
        }
    }
}, 10 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

function getClientIp(req) {
    const socketAddress = req.socket && req.socket.remoteAddress;
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
        const client = xff.split(',')[0].trim();
        if (client) return client;
    }
    return req.ip || socketAddress || 'unknown';
}

/**
 * Kéréskorlátozó middleware
 */
function rateLimiter(req, res, next) {
    const socketAddress = req.socket && req.socket.remoteAddress;
    const isDirectLocalhost =
        socketAddress === '::1' || socketAddress === '127.0.0.1' || socketAddress === '::ffff:127.0.0.1';

    // Fehérlista közvetlen helyi gépről történő teszteléshez
    if (isDirectLocalhost && !req.headers['x-forwarded-for']) {
        return next();
    }

    const ip = getClientIp(req);
    const now = Date.now();

    if (!requestCounts.has(ip)) {
        requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }

    const record = requestCounts.get(ip);
    if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + RATE_LIMIT_WINDOW;
        return next();
    }

    record.count++;
    if (record.count > MAX_REQUESTS) {
        console.warn(`[RATE-LIMIT] Blokkolt IP: ${ip} (${record.count} kérés)`);
        return res.status(429).json({ error: 'Túl sok kérés! Kérlek várj 15 percet.' });
    }
    next();
}

module.exports = {
    rateLimiter,
};
