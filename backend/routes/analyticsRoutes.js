/**
 * --- VISITOR ANALYTICS ROUTES ---
 * Publikus oldalmegtekintések naplózása és védett statisztikák aggregációja.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

const analyticsFilePath = path.join(process.cwd(), 'backend', 'data', 'pageviews.json');

// Biztosítjuk a mappaszerkezet meglétét
if (!fs.existsSync(path.join(process.cwd(), 'backend'))) {
    fs.mkdirSync(path.join(process.cwd(), 'backend'));
}
if (!fs.existsSync(path.join(process.cwd(), 'backend', 'data'))) {
    fs.mkdirSync(path.join(process.cwd(), 'backend', 'data'));
}

let pageviews = [];
try {
    if (fs.existsSync(analyticsFilePath)) {
        pageviews = JSON.parse(fs.readFileSync(analyticsFilePath, 'utf8'));
    }
} catch (err) {
    console.error('Hiba az analytics betöltésekor:', err);
}

let isSavingAnalytics = false;
let needsSaveAnalytics = false;

async function savePageviews() {
    if (isSavingAnalytics) {
        needsSaveAnalytics = true;
        return;
    }
    isSavingAnalytics = true;
    try {
        if (pageviews.length > 5000) {
            pageviews = pageviews.slice(-5000);
        }
        await fs.promises.writeFile(analyticsFilePath, JSON.stringify(pageviews, null, 2), 'utf8');
    } catch (err) {
        console.error('Hiba az analytics mentésekor:', err.message);
    } finally {
        isSavingAnalytics = false;
        if (needsSaveAnalytics) {
            needsSaveAnalytics = false;
            savePageviews();
        }
    }
}

// 1. Publikus oldalmegtekintés naplózása
router.post('/analytics/pageview', (req, res) => {
    const { page, visitorId, hasRegistered } = req.body;
    if (!page || !visitorId) {
        return res.status(400).json({ error: 'Hiányzó paraméterek!' });
    }

    pageviews.push({
        timestamp: Date.now(),
        page: String(page).substring(0, 100),
        visitorId: String(visitorId).substring(0, 100),
        hasRegistered: !!hasRegistered,
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    });

    savePageviews();
    res.json({ success: true });
});

// 2. Védett statisztikai adatok lekérése (Csak Adminnak)
router.get('/analytics/stats', authenticateAdmin, (req, res) => {
    try {
        const totalViews = pageviews.length;
        const now = Date.now();

        // Időintervallumok meghatározása
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * oneHour;
        const oneWeek = 7 * oneDay;
        const oneMonth = 30 * oneDay;
        const oneYear = 365 * oneDay;

        const hourly = pageviews.filter(p => now - p.timestamp <= oneHour).length;
        const daily = pageviews.filter(p => now - p.timestamp <= oneDay).length;
        const weekly = pageviews.filter(p => now - p.timestamp <= oneWeek).length;
        const monthly = pageviews.filter(p => now - p.timestamp <= oneMonth).length;
        const yearly = pageviews.filter(p => now - p.timestamp <= oneYear).length;

        // Látogatói adatok aggregációja
        const visitors = {};
        pageviews.forEach(p => {
            if (!visitors[p.visitorId]) {
                visitors[p.visitorId] = { views: 0, hasRegistered: false, pages: new Set(), lastActive: 0 };
            }
            visitors[p.visitorId].views++;
            visitors[p.visitorId].pages.add(p.page);
            visitors[p.visitorId].lastActive = Math.max(visitors[p.visitorId].lastActive, p.timestamp);
            if (p.hasRegistered) {
                visitors[p.visitorId].hasRegistered = true;
            }
        });

        const uniqueVisitorsCount = Object.keys(visitors).length;

        let totalVisitorViews = 0;
        let registeredCount = 0;

        const visitorDetails = Object.keys(visitors).map(vid => {
            const v = visitors[vid];
            totalVisitorViews += v.views;
            if (v.hasRegistered) registeredCount++;
            return {
                visitorId: vid.substring(0, 12) + '...',
                views: v.views,
                hasRegistered: v.hasRegistered,
                pagesViewed: Array.from(v.pages).join(', '),
                lastActive: new Date(v.lastActive).toLocaleTimeString('hu-HU'),
            };
        });

        const avgViewsPerVisitor = uniqueVisitorsCount > 0 ? (totalVisitorViews / uniqueVisitorsCount).toFixed(1) : 0;

        res.json({
            success: true,
            stats: {
                totalViews,
                uniqueVisitorsCount,
                avgViewsPerVisitor,
                registeredCount,
                breakdown: {
                    hourly,
                    daily,
                    weekly,
                    monthly,
                    yearly,
                },
                visitorDetails: visitorDetails.reverse().slice(0, 30),
            },
        });
    } catch (err) {
        console.error('[Analytics Stats Error]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
