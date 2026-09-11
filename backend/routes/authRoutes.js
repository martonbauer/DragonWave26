/**
 * --- AUTH & SYSTEM ROUTES ---
 * Admin hitelesítés, health check és navigációs átirányítások.
 */

const express = require('express');
const crypto = require('crypto');
const supabase = require('../../database');
const { ADMIN_PASSWORD, TOKEN_SECRET } = require('../middleware/auth');

const router = express.Router();

// Navigációs átirányítások
router.get(['/admin', '/api/admin'], (req, res) => res.redirect('/admin.html'));
router.get(['/management', '/api/management'], (req, res) => res.redirect('/management.html'));

// Hitelesítés: jelszó ellenőrzés és HMAC-SHA256 token kiállítás
router.post(['/login', '/api/login'], (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const payload = { role: 'admin', exp: Date.now() + 8 * 60 * 60 * 1000 }; // 8 órás érvényesség
        const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
        const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadBase64).digest('hex');
        const token = `${payloadBase64}.${signature}`;
        res.json({ success: true, token, message: 'Sikeres belépés!' });
    } else {
        res.status(401).json({ error: 'Hibás admin jelszó!' });
    }
});

// Rendszerállapot ellenőrzés (Health check)
router.get(['/health', '/api/health'], async (req, res) => {
    try {
        const { error } = await supabase.from('racers').select('id').limit(1);
        if (error) throw error;
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
    }
});

module.exports = router;
