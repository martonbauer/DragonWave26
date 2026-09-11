const { authenticateAdmin, ADMIN_PASSWORD, TOKEN_SECRET, isAdmin } = require('../middleware/auth');
const crypto = require('crypto');

describe('auth.js middleware tests', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            headers: {},
            method: 'POST',
            url: '/api/test'
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();
        console.warn = jest.fn(); // Mute warnings in output
    });

    it('should return 401 if authorization header is missing', () => {
        authenticateAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Nincs hitelesítés!' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should authenticate correctly with plain text admin password (backward compatibility)', () => {
        req.headers.authorization = `Bearer ${ADMIN_PASSWORD}`;
        authenticateAdmin(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 for wrong plain password', () => {
        req.headers.authorization = 'Bearer wrong_password';
        authenticateAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('should authenticate correctly with a valid signed token', () => {
        const payload = { role: 'admin', exp: Date.now() + 10000 };
        const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
        const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadBase64).digest('hex');
        const token = `${payloadBase64}.${signature}`;

        req.headers.authorization = `Bearer ${token}`;
        authenticateAdmin(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 for an expired signed token', () => {
        const payload = { role: 'admin', exp: Date.now() - 10000 }; // Expired 10s ago
        const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
        const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadBase64).digest('hex');
        const token = `${payloadBase64}.${signature}`;

        req.headers.authorization = `Bearer ${token}`;
        authenticateAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'A munkamenet lejárt!' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 for a signed token with an invalid signature', () => {
        const payload = { role: 'admin', exp: Date.now() + 10000 };
        const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
        const token = `${payloadBase64}.invalid_signature_here`;

        req.headers.authorization = `Bearer ${token}`;
        authenticateAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    describe('isAdmin helper tests', () => {
        it('should return false if authorization header is missing', () => {
            expect(isAdmin({ headers: {} })).toBe(false);
        });

        it('should return true for valid plain admin password', () => {
            expect(isAdmin({ headers: { authorization: `Bearer ${ADMIN_PASSWORD}` } })).toBe(true);
        });

        it('should return false for invalid password', () => {
            expect(isAdmin({ headers: { authorization: 'Bearer wrong_pass' } })).toBe(false);
        });

        it('should return true for valid signed token', () => {
            const payload = { role: 'admin', exp: Date.now() + 10000 };
            const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
            const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadBase64).digest('hex');
            const token = `${payloadBase64}.${signature}`;
            expect(isAdmin({ headers: { authorization: `Bearer ${token}` } })).toBe(true);
        });

        it('should return false for expired signed token', () => {
            const payload = { role: 'admin', exp: Date.now() - 10000 };
            const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
            const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadBase64).digest('hex');
            const token = `${payloadBase64}.${signature}`;
            expect(isAdmin({ headers: { authorization: `Bearer ${token}` } })).toBe(false);
        });
    });
});
