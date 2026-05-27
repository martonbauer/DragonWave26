/**
 * --- BIZTONSÁGI RÉTEG (SECURITY LAYER) ---
 * IP alapú kéréskorlátozás (Rate Limiting) middleware.
 */

const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 perc
const MAX_REQUESTS = 200; // 200 kérés ablakonként

/**
 * Kéréskorlátozó middleware
 */
function rateLimiter(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    // Fehérlista localhost feletti fejlesztéshez
    if (ip === '::1' || ip === '127.0.0.1' || ip.includes('localhost')) {
        return next();
    }

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
