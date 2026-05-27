/**
 * --- BIZTONSÁGI RÉTEG (SECURITY LAYER) ---
 * Adminisztrátori hitelesítés és jogosultságkezelés middleware.
 */

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'dragon2026';

/**
 * Admin hitelesítő middleware
 */
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.warn(`UNAUTHORIZED: Nincs hitelesítés az endpointon: ${req.method} ${req.url}`);
        return res.status(401).json({ error: 'Nincs hitelesítés!' });
    }

    const password = authHeader.replace('Bearer ', '');
    if (password === ADMIN_PASSWORD) {
        next();
    } else {
        console.warn(`FORBIDDEN: Hibás admin jelszó próbálkozás: ${req.method} ${req.url}`);
        res.status(403).json({ error: 'Hibás admin jelszó!' });
    }
}

module.exports = {
    ADMIN_PASSWORD,
    authenticateAdmin,
};
