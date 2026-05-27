/**
 * --- API KOMMUNIKÁCIÓS RÉTEG (API LAYER) ---
 * Hálózati hívások, végpontok kezelése és alapvető konfiguráció.
 */

export const API_URL =
    window.location.hostname === 'localhost' || window.location.protocol === 'file:'
        ? 'http://localhost:3001/api'
        : '/api';

export const SOCKET_URL =
    window.location.hostname === 'localhost' || window.location.protocol === 'file:' ? 'http://localhost:3001' : '';

export const socketAdmin = typeof io !== 'undefined' ? io(SOCKET_URL) : null;

export const APP_VERSION = '2.3.0';

/**
 * Általános API-hívó segédfunkció
 * @param {string} path - Az API végpont útvonala (pl. 'data')
 * @param {string} [method='GET'] - HTTP metódus
 * @param {object} [body=undefined] - Kérés törzse
 * @param {string} [adminPassword=''] - Admin jelszó a hitelesítéshez
 * @returns {Promise<Response|null>}
 */
export async function apiCall(path, method = 'GET', body = undefined, adminPassword = '') {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };

    if (adminPassword) {
        opts.headers['Authorization'] = `Bearer ${adminPassword}`;
    }

    if (body !== undefined) {
        opts.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}/${path}`, opts);

        if (response.status === 401 || response.status === 403) {
            if (typeof showToast === 'function') {
                showToast('Nincs jogosultságod a művelethez! Jelentkezz be újra.', 'error');
            }
            if (response.status === 403) {
                sessionStorage.removeItem('dragonAdminPassword');
            }
            return null;
        }

        return response;
    } catch (err) {
        console.error(`API hiba (${path}):`, err);
        return null;
    }
}
