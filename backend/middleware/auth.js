/**
 * --- BIZTONSÁGI RÉTEG (SECURITY LAYER) ---
 * Adminisztrátori hitelesítés és jogosultságkezelés middleware.
 */

const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'dragon2026';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'dragonwave_secret_key_2026_rfid_timing';

/**
 * Admin hitelesítő middleware
 */
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.warn(`UNAUTHORIZED: Nincs hitelesítés az endpointon: ${req.method} ${req.url}`);
        return res.status(401).json({ error: 'Nincs hitelesítés!' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Ha aláírt token formátum (tartalmaz pontot a payload és szignatúra elválasztására)
    if (token.includes('.')) {
        try {
            const parts = token.split('.');
            if (parts.length === 2) {
                const [payloadBase64, signature] = parts;
                const expectedSignature = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadBase64).digest('hex');
                
                if (signature === expectedSignature) {
                    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
                    if (payload.exp && payload.exp > Date.now()) {
                        return next();
                    } else {
                        console.warn(`UNAUTHORIZED: Lejárt munkamenet token: ${req.method} ${req.url}`);
                        return res.status(401).json({ error: 'A munkamenet lejárt!' });
                    }
                }
            }
        } catch (err) {
            console.error('Hiba a token ellenőrzésekor:', err);
        }
    }

    // Visszafelé kompatibilitás: ha sima jelszót kaptunk (pl. teszt scriptekből)
    if (token === ADMIN_PASSWORD) {
        next();
    } else {
        console.warn(`FORBIDDEN: Hibás admin jelszó vagy érvénytelen token próbálkozás: ${req.method} ${req.url}`);
        res.status(403).json({ error: 'Hibás admin jelszó vagy érvénytelen token!' });
    }
}

/**
 * Ellenőrzi, hogy a kérés érvényes admin jogosultsággal rendelkezik-e
 * @param {object} req - Express kérés objektum
 * @returns {boolean}
 */
function isAdmin(req) {
    const authHeader = req.headers && req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return false;

    if (token.includes('.')) {
        try {
            const parts = token.split('.');
            if (parts.length === 2) {
                const [payloadBase64, signature] = parts;
                const expectedSignature = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadBase64).digest('hex');
                if (signature === expectedSignature) {
                    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
                    if (payload.exp && payload.exp > Date.now()) {
                        return true;
                    }
                }
            }
        } catch {
            return false;
        }
    }
    return token === ADMIN_PASSWORD;
}

module.exports = {
    ADMIN_PASSWORD,
    TOKEN_SECRET,
    authenticateAdmin,
    isAdmin,
};

