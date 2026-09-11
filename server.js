/**
 * DragonWave 2026 - Main Server Entry Point
 * Clean Architecture Modular Express & Socket.IO Server
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');

// Middleware-ek és Segédfunkciók
const { rateLimiter } = require('./backend/middleware/rate-limiter');
const { setIo, emitRefresh, emitUpdate } = require('./backend/utils/socketHelper');

// Express Route Modulok
const authRoutes = require('./backend/routes/authRoutes');
const racerRoutes = require('./backend/routes/racerRoutes');
const timingRoutes = require('./backend/routes/timingRoutes');
const managementRoutes = require('./backend/routes/managementRoutes');
const analyticsRoutes = require('./backend/routes/analyticsRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// HTTP és Socket.IO Szerver létrehozása
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Helyi és offline mobil kliensek engedélyezése
            callback(null, true);
        },
        methods: ['GET', 'POST'],
    },
});

setIo(io);

io.on('connection', () => {
    console.log('Új kliens csatlakozott az élő szinkronizációhoz!');
});

// Alapvető szerver konfigurációk és middleware-ek
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname), { extensions: ['html', 'htm'] }));
app.use(rateLimiter);

// Valós idejű szinkronizáció (Realtime Middleware)
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (...args) {
        if (
            ['POST', 'PUT', 'DELETE'].includes(req.method) &&
            res.statusCode >= 200 &&
            res.statusCode < 300 &&
            !req.path.includes('/api/login') &&
            !req.path.includes('/login')
        ) {
            emitRefresh();
            if (req.path.includes('/api/start-') || req.path.includes('/start-')) {
                let msg = 'Egy kategória vagy táv rajtja elindult.';
                if (req.body && req.body.categoryName) msg = req.body.categoryName + ' elindult!';
                else if (req.body && req.body.distance) msg = req.body.distance + ' elindult!';
                emitUpdate('notify_event', { title: '🚀 Futam elindult!', body: msg });
            }
        }
        originalJson.apply(this, args);
    };
    next();
});

// Moduláris Route-ok regisztrálása
app.use('/', authRoutes);
app.use('/api', racerRoutes);
app.use('/api', timingRoutes);
app.use('/api', managementRoutes);
app.use('/api', analyticsRoutes);

// Szerver indítása
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`DragonWave Server running at http://localhost:${PORT}`);
    });
}

module.exports = { app, server };
