const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const supabase = require('./database');
const fs = require('fs');

// --- 0. ELŐZMÉNYEK KEZELÉSE (HISTORY MANAGEMENT) ---
const HISTORY_FILE = path.join(__dirname, 'history', 'bib_history.json');
const UNASSIGNED_FILE = path.join(__dirname, 'history', 'unassigned_times.json');

async function ensureHistoryDir() {
    const dir = path.dirname(HISTORY_FILE);
    try { await fs.promises.mkdir(dir, { recursive: true }); }
    catch (e) {}
    try { await fs.promises.access(HISTORY_FILE); }
    catch (e) { await fs.promises.writeFile(HISTORY_FILE, JSON.stringify([])); }
    try { await fs.promises.access(UNASSIGNED_FILE); }
    catch (e) { await fs.promises.writeFile(UNASSIGNED_FILE, JSON.stringify([])); }
}

async function getUnassignedTimes() {
    await ensureHistoryDir();
    try { 
        const data = await fs.promises.readFile(UNASSIGNED_FILE, 'utf8');
        return JSON.parse(data); 
    }
    catch (e) { return []; }
}

async function saveUnassignedTimes(times) {
    await ensureHistoryDir();
    await fs.promises.writeFile(UNASSIGNED_FILE, JSON.stringify(times, null, 2));
}

async function getBibHistory() {
    await ensureHistoryDir();
    try { 
        const data = await fs.promises.readFile(HISTORY_FILE, 'utf8');
        return JSON.parse(data); 
    }
    catch (e) { return []; }
}

async function addBibHistoryEntry(entry) {
    const history = await getBibHistory();
    history.unshift({ id: Date.now(), timestamp: new Date().toISOString(), ...entry });
    await ensureHistoryDir();
    await fs.promises.writeFile(HISTORY_FILE, JSON.stringify(history.slice(0, 100), null, 2));
}

// --- 1. STRUKTURÁLIS RÉTEGEK: MIDDLEWARE-EK IMPORTÁLÁSA ---
const { rateLimiter } = require('./backend/middleware/rate-limiter');
const { ADMIN_PASSWORD, authenticateAdmin } = require('./backend/middleware/auth');

// --- 2. STRUKTURÁLIS RÉTEGEK: SZOLGÁLTATÁSOK (BUSINESS LOGIC) IMPORTÁLÁSA ---
const { getNextBib } = require('./backend/services/bib-service');
const { getGroupQuery, checkAndStopEmptyBatchTimers } = require('./backend/services/batch-service');

// --- 3. STRUKTURÁLIS RÉTEGEK: SEGÉDFUNKCIÓK (UTILITIES) IMPORTÁLÁSA ---
const { validateRacerData, normalizeCategoryToSlug } = require('./backend/utils/validation');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
    console.log('Új kliens csatlakozott az élő szinkronizációhoz!');
});

const emitUpdate = (action, payload = {}) => { io.emit(action, payload); };
const emitRefresh = () => { io.emit('dataUpdated', { action: 'refresh' }); };

// --- 4. ALAPVETŐ SZERVER KONFIGURÁCIÓK ÉS MIDDLEWARE-EK ---
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname), { extensions: ['html', 'htm'] }));

// Kényelmi átirányítások (Route fallbacks for Render)
app.get('/admin', (req, res) => res.redirect('/management.html?view=admin'));
app.get('/management', (req, res) => res.redirect('/management.html'));

app.use(rateLimiter);

// --- 4.5 VALÓS IDEJŰ SZINKRONIZÁCIÓ (REALTIME MIDDLEWARE) ---
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function(body) {
        if (['POST', 'PUT', 'DELETE'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 300 && !req.path.includes('/api/login')) {
            emitRefresh();
            if (req.path.includes('/api/start-')) {
                let msg = 'Egy kategória vagy táv rajtja elindult.';
                if(req.body && req.body.categoryName) msg = req.body.categoryName + ' elindult!';
                else if (req.body && req.body.distance) msg = req.body.distance + ' elindult!';
                emitUpdate('notify_event', { title: '🚀 Futam elindult!', body: msg });
            }
        }
        originalJson.apply(this, arguments);
    };
    next();
});

// --- 5. HITELESÍTÉS (AUTHENTICATION) ---
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Sikeres belépés!' });
    } else {
        res.status(401).json({ error: 'Hibás admin jelszó!' });
    }
});

// --- 6. RENDSZERÁLLAPOT ELLENŐRZÉS (HEALTH CHECK) ---
app.get('/api/health', async (req, res) => {
    try {
        const { data, error } = await supabase.from('racers').select('id').limit(1);
        if (error) throw error;
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
    }
});

// --- 7. ADAT LEKÉRDEZÉSI VÉGPONT (DATA ACCESS) ---
app.get('/api/data', async (req, res) => {
    try {
        const { data: racers, error: rError } = await supabase.from('racers').select('*, members(*)');
        if (rError) throw rError;
        const { data: categories, error: cError } = await supabase.from('categories').select('*');
        if (cError) throw cError;

        const { data: checkpoints, error: chkError } = await supabase.from('checkpoints').select('*');
        if (chkError) console.warn("Checkpoints fetch (maybe table missing):", chkError.message);

        const categoriesObj = {};
        (categories || []).forEach(c => categoriesObj[c.key] = c.start_time);

        res.json({ 
            racers: racers || [], 
            categories: categoriesObj, 
            checkpoints: checkpoints || [],
            serverNow: Date.now() 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

class SimpleMutex {
    constructor() { this.queue = []; this.locked = false; }
    async acquire() {
        if (!this.locked) { this.locked = true; return; }
        return new Promise(resolve => this.queue.push(resolve));
    }
    release() {
        if (this.queue.length > 0) { const resolve = this.queue.shift(); resolve(); }
        else { this.locked = false; }
    }
}
const registerMutex = new SimpleMutex();

// --- 8. VERSENYZŐ REGISZTRÁCIÓ (REGISTRATION) ---
app.post('/api/register', async (req, res) => {
    const { members, category: rawCategory, distance, is_series, email, phone } = req.body;
    const category = normalizeCategoryToSlug(rawCategory);
    
    const validationError = validateRacerData(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    await registerMutex.acquire();
    try {
        let isDuplicate = false;
        
        // --- DUPLIKÁCIÓ ELLENŐRZÉS (A 2026-os versenyszabályok alapján) ---
        if (members && members.length > 0) {
            for (const m of members) {
                // 1. Ellenőrzés Ötpróba ID alapján
                const otp = m.otproba_id ? m.otproba_id.trim() : '';
                if (otp.length > 0 && otp.toLowerCase() !== 'nincs') {
                    const { data } = await supabase.from('members').select('id, name').eq('otproba_id', otp).limit(1);
                    if (data && data.length > 0) { 
                        if (data[0].name.toLowerCase().trim() !== m.name.toLowerCase().trim()) {
                            return res.status(400).json({ error: `Hiba: Az '${otp}' 5Próba azonosító már foglalt egy másik versenyző (${data[0].name}) által!` });
                        }
                        isDuplicate = true; break; 
                    }
                }
                // 2. Ellenőrzés Név + Születési dátum alapján
                if (!isDuplicate && m.name && m.birth_date) {
                    const { data } = await supabase.from('members').select('id').ilike('name', m.name.trim()).eq('birth_date', m.birth_date.trim()).limit(1);
                    if (data && data.length > 0) { isDuplicate = true; break; }
                }
            }
        }
        
        const finalStatus = isDuplicate ? 'duplicate' : 'registered';

        const bib = await getNextBib(distance, category);
        if (bib === null) return res.status(400).json({ error: 'Nincs több szabad rajtszám!' });

        const racerId = Date.now().toString();
        const { error: rError } = await supabase.from('racers').insert({
            id: racerId, bib, category, distance, 
            is_series: is_series ? 1 : 0, 
            status: finalStatus
        });
        if (rError) throw rError;

        if (members && members.length > 0) {
            const membersToInsert = members.map(m => ({
                racer_id: racerId, name: m.name, birth_date: m.birth_date, otproba_id: m.otproba_id
            }));
            const { error: mError } = await supabase.from('members').insert(membersToInsert);
            if (mError) {
                // ROLLBACK: Töröljük a már beszúrt versenyzőt, ha a tagok felvétele sikertelen
                await supabase.from('racers').delete().eq('id', racerId);
                throw mError;
            }
        }
        res.json({ id: racerId, bib, category, distance, status: finalStatus, isDuplicate });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        registerMutex.release();
    }
});

let fetchLib;
async function getFetch() {
    if (!fetchLib) { fetchLib = global.fetch ? global.fetch : (await import('node-fetch')).default; }
    return fetchLib;
}

// --- 8.5 BARION FIZETÉS (PAYMENT INTEGRATION) ---
app.post('/api/barion/payment', async (req, res) => {
    const { email, amount, guestString, orderId } = req.body;
    const posKey = process.env.BARION_POS_KEY;
    
    // Fallback ha nincs kulcs: szimulált visszatérés (hogy az élesítés előtt is működjön a projekt bemutató)
    if (!posKey || posKey === 'your_barion_poskey') {
        return res.status(400).json({ error: "A Barion fizetés jelenleg élesítve van, de hiányzik a BARION_POS_KEY az .env fájlból!" });
    }

    const payload = {
        POSKey: posKey,
        PaymentType: "Immediate",
        GuestCheckout: true,
        FundingSources: ["All"],
        PaymentRequestId: orderId || `DRGW-${Date.now()}`,
        PayerHint: email || "ugyfel@pelda.hu",
        Transactions: [
            {
                POSTransactionId: `TR-${Date.now()}`,
                Payee: email || "ugyfel@pelda.hu",
                Total: amount || 0,
                Items: [
                    {
                        Name: "DragonWave Nevezési Díj",
                        Description: guestString || "Nevezés",
                        Quantity: 1,
                        Unit: "db",
                        UnitPrice: amount || 0,
                        ItemTotal: amount || 0
                    }
                ]
            }
        ],
        Locale: "hu-HU",
        Currency: "HUF",
        RedirectUrl: `${req.headers.origin}?payment=success`,
        CallbackUrl: `${req.headers.origin}/api/barion/callback`
    };

    try {
        const customFetch = await getFetch();
        const response = await customFetch('https://api.barion.com/v2/Payment/Start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (data.Errors && data.Errors.length > 0) {
            return res.status(400).json({ error: data.Errors[0].Description });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 9. VERSENY VEZÉRLÉS: RAJT (RACE CONTROL: START) ---
app.post('/api/start-category', authenticateAdmin, async (req, res) => {
    const { categoryName, distance, groupId } = req.body;
    const now = Date.now();
    const startKey = groupId || `${categoryName}_${distance}`;

    try {
        await supabase.from('categories').insert({ key: startKey, start_time: now });
        let query = supabase.from('racers').update({ status: 'running', start_time: now }).eq('status', 'registered');
        query = groupId ? getGroupQuery(query, groupId) : query.eq('category', categoryName).eq('distance', distance);
        const { data: updated } = await query.select();
        res.json({ success: true, start_time: now, count: updated?.length || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/start-mass', authenticateAdmin, async (req, res) => {
    const now = Date.now();
    const startKey = 'MASS_START_ALL';
    try {
        await supabase.from('categories').insert({ key: startKey, start_time: now });
        const { data } = await supabase.from('racers').update({ status: 'running', start_time: now }).eq('status', 'registered').select();
        res.json({ success: true, start_time: now, count: data?.length || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/start-distance', authenticateAdmin, async (req, res) => {
    const { distance } = req.body;
    const now = Date.now();
    const startKey = `DISTANCE_${distance}`;
    try {
        await supabase.from('categories').insert({ key: startKey, start_time: now });
        const { data } = await supabase.from('racers').update({ status: 'running', start_time: now }).eq('status', 'registered').eq('distance', distance).select();
        res.json({ success: true, start_time: now, count: data?.length || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/start-individual', authenticateAdmin, async (req, res) => {
    const { bib } = req.body;
    const now = Date.now();
    try {
        const { data: racer } = await supabase.from('racers').select('*').eq('bib', bib).maybeSingle();
        if (!racer) return res.status(404).json({ error: 'Nincs ilyen rajtszám!' });
        await supabase.from('racers').update({ status: 'running', start_time: now }).eq('id', racer.id);
        res.json({ success: true, bib, start_time: now });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 10. VERSENY VEZÉRLÉS: CÉL ÉS RESET (RACE CONTROL: STOP/RESET) ---
app.post('/api/stop-category', authenticateAdmin, async (req, res) => {
    const { categoryName, distance, groupId } = req.body;
    const now = Date.now();
    const startKey = groupId || `${categoryName}_${distance}`;
    try {
        let query = supabase.from('racers').select('*').eq('status', 'running');
        query = groupId ? getGroupQuery(query, groupId) : query.eq('category', categoryName).eq('distance', distance);
        const { data: runningRacers } = await query;
        
        if (runningRacers && runningRacers.length > 0) {
            await Promise.all(runningRacers.map(r => 
                supabase.from('racers').update({ 
                    status: 'finished', 
                    finish_time: now, 
                    total_time: now - r.start_time 
                }).eq('id', r.id)
            ));
        }
        await supabase.from('categories').delete().eq('key', startKey);
        res.json({ success: true, count: runningRacers?.length || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reset-category', authenticateAdmin, async (req, res) => {
    const { categoryName, distance, groupId } = req.body;
    const startKey = groupId || `${categoryName}_${distance}`;
    try {
        await supabase.from('categories').delete().eq('key', startKey);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/stop-racer', authenticateAdmin, async (req, res) => {
    const { bib } = req.body;
    const now = Date.now();
    try {
        const { data: racer } = await supabase.from('racers').select('*').eq('bib', bib).single();
        if (!racer) return res.status(404).json({ error: 'Nincs ilyen rajtszám!' });
        
        if (racer.status === 'finished') {
            return res.status(400).json({ error: 'Már beérkezett! (Második nyomás kihagyva)' });
        }

        const total_time = now - racer.start_time;
        await supabase.from('racers').update({ status: 'finished', finish_time: now, total_time }).eq('bib', bib);
        const { data: members } = await supabase.from('members').select('name, otproba_id').eq('racer_id', racer.id);
        let names = racer.name || '-';
        if (members && members.length > 0) {
            const teamMember = members.find(m => m.otproba_id === 'CSAPATNEV');
            const realMembers = members.filter(m => m.otproba_id !== 'CSAPATNEV');
            if (teamMember && realMembers.length > 0) {
                names = `${teamMember.name} (${realMembers.map(m => m.name).join(', ')})`;
            } else if (teamMember) {
                names = teamMember.name;
            } else {
                names = realMembers.map(m => m.name).join(', ');
            }
        }
        await checkAndStopEmptyBatchTimers();
        res.json({ success: true, racer: { name: names, total_time } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/stop-bulk-racers', authenticateAdmin, async (req, res) => {
    const { bibs } = req.body;
    const baseNow = Date.now();
    
    if (!bibs || !Array.isArray(bibs) || bibs.length === 0) {
        return res.status(400).json({ error: 'Üres rajtszám lista!' });
    }

    try {
        const { data: racers } = await supabase.from('racers').select('id, bib, start_time, status').in('bib', bibs);
        const results = { successful: [], failed: [] };
        
        if (!racers || racers.length === 0) {
            return res.status(404).json({ error: 'Nincs találat a megadott rajtszámokra!' });
        }

        // Rendezzük és járjuk be a kliens által küldött EXACT sorrendben (bibs tömb)
        const promises = bibs.map(async (bibStr, index) => {
            const bibNum = parseInt(bibStr);
            const r = racers.find(dbRacer => dbRacer.bib === bibNum);
            
            if (!r) {
                // Ha valamit elgépeltek és nincs rajtszám (Bár az error array-be is mehet)
                return;
            }
            if (r.status === 'finished') {
                results.failed.push(`#${r.bib}: Már beérkezett`);
                return;
            }
            if (r.status !== 'running') {
                results.failed.push(`#${r.bib}: Nincs futamban`);
                return;
            }
            
            // TRÜKK: Minden egymást követő beütött rajtszámnak +500 milliszekundumot (0.5 mp) adunk
            // Így megmarad a bíró által begépelt sorrend, nem lesz holtverseny!
            const racerFinishTime = baseNow + (index * 500);
            const total_time = racerFinishTime - r.start_time;
            
            const { error } = await supabase.from('racers')
                .update({ status: 'finished', finish_time: racerFinishTime, total_time })
                .eq('id', r.id);
                
            if (error) results.failed.push(`#${r.bib}: DB hiba`);
            else results.successful.push(`#${r.bib}`);
        });

        await Promise.all(promises);
        await checkAndStopEmptyBatchTimers();

        
        res.json({ success: true, results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 10.1 KIOSZTATLAN IDŐK KEZELÉSE (UNASSIGNED TIMES) ---
app.post('/api/unassigned-time', authenticateAdmin, async (req, res) => {
    const { timestamp } = req.body;
    const now = timestamp || Date.now();
    try {
        const times = await getUnassignedTimes();
        const newTime = { id: Date.now().toString() + '_' + Math.floor(Math.random()*1000), timestamp: now, dateString: new Date(now).toISOString() };
        times.push(newTime);
        await saveUnassignedTimes(times);
        emitRefresh();
        res.json({ success: true, id: newTime.id });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/unassigned-times', authenticateAdmin, async (req, res) => {
    res.json(await getUnassignedTimes());
});

app.post('/api/assign-time', authenticateAdmin, async (req, res) => {
    const { id, bib } = req.body;
    try {
        const times = await getUnassignedTimes();
        const timeIndex = times.findIndex(t => t.id === id);
        if (timeIndex === -1) return res.status(404).json({ error: 'Kiosztatlan idő nem található!' });
        
        const timestamp = times[timeIndex].timestamp;
        
        const { data: racer } = await supabase.from('racers').select('*').eq('bib', bib).single();
        if (!racer) return res.status(404).json({ error: 'Nincs ilyen rajtszám!' });
        
        if (racer.status === 'finished') {
            return res.status(400).json({ error: 'Már beérkezett!' });
        }
        if (racer.status !== 'running') {
            return res.status(400).json({ error: 'Nincs futamban!' });
        }

        const total_time = timestamp - racer.start_time;
        await supabase.from('racers').update({ status: 'finished', finish_time: timestamp, total_time }).eq('bib', bib);
        
        times.splice(timeIndex, 1);
        await saveUnassignedTimes(times);
        
        await checkAndStopEmptyBatchTimers();
        emitRefresh();
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/unassigned-time/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        let times = await getUnassignedTimes();
        times = times.filter(t => t.id !== id);
        await saveUnassignedTimes(times);
        emitRefresh();
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 10.5 ELLENŐRZŐPONT REGISZTRÁCIÓ (CHECKPOINT) ---
app.post('/api/checkpoint', authenticateAdmin, async (req, res) => {
    const { bib, checkpoint_name } = req.body;
    const now = Date.now();
    try {
        const { data: racer } = await supabase.from('racers').select('id, status').eq('bib', bib).maybeSingle();
        if (!racer) return res.status(404).json({ error: 'Nincs ilyen rajtszám!' });
        
        const { error } = await supabase.from('checkpoints').insert({
            racer_bib: bib,
            checkpoint_name: checkpoint_name,
            timestamp: now
        });
        
        if (error) throw error;

        res.json({ success: true, bib, checkpoint_name, timestamp: now });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 11. VERSENYZŐ KEZELÉS: CRUD (MANAGEMENT) ---
app.delete('/api/racer/:idOrBib', authenticateAdmin, async (req, res) => {
    const param = req.params.idOrBib;
    try {
        const { data: idData } = await supabase.from('racers').delete().eq('id', String(param)).select();
        if (idData?.length > 0) {
            await checkAndStopEmptyBatchTimers();
            return res.json({ success: true });
        }
        if (/^\d+$/.test(param)) {
            const { data: bibData } = await supabase.from('racers').delete().eq('bib', parseInt(param)).select();
            if (bibData?.length > 0) {
                await checkAndStopEmptyBatchTimers();
                return res.json({ success: true });
            }
        }
        res.status(404).json({ error: 'Nem található!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/racer/:id', authenticateAdmin, async (req, res) => {
    const id = req.params.id;
    const { bib, category, distance, is_series, status, email, phone, members, checked_in, is_paid } = req.body;
    try {
        if (bib) {
            const { data: existing } = await supabase.from('racers').select('id').eq('bib', bib).neq('id', id).maybeSingle();
            if (existing) return res.status(400).json({ error: `A #${bib} rajtszám már foglalt egy másik versenyzőnél!` });
        }

        let isDuplicate = false;
        if (members && members.length > 0) {
            for (const m of members) {
                const otp = m.otproba_id ? m.otproba_id.trim() : '';
                if (otp.length > 0 && otp.toLowerCase() !== 'nincs') {
                    const { data } = await supabase.from('members').select('id, name').eq('otproba_id', otp).neq('racer_id', id).limit(1);
                    if (data && data.length > 0) { 
                        if (data[0].name.toLowerCase().trim() !== m.name.toLowerCase().trim()) {
                            return res.status(400).json({ error: `Hiba: Az '${otp}' 5Próba azonosító már foglalt egy másik versenyző (${data[0].name}) által!` });
                        }
                        isDuplicate = true; break; 
                    }
                }
                if (!isDuplicate && m.name && m.birth_date) {
                    const { data } = await supabase.from('members').select('id').ilike('name', m.name.trim()).eq('birth_date', m.birth_date.trim()).neq('racer_id', id).limit(1);
                    if (data && data.length > 0) { isDuplicate = true; break; }
                }
            }
        }

        const updateData = {};
        if (bib !== undefined) updateData.bib = bib;
        if (category !== undefined) updateData.category = category;
        if (distance !== undefined) updateData.distance = distance;
        
        if (status !== undefined) {
            // Ha szerkesztésből jövünk (members array küldve van) és duplikáció van, akkor kényszerítjük a duplicate státuszt
            updateData.status = (members && isDuplicate) ? 'duplicate' : status;
        } else if (members && isDuplicate) {
            updateData.status = 'duplicate';
        }

        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (is_series !== undefined) updateData.is_series = is_series ? 1 : 0;
        if (checked_in !== undefined) updateData.checked_in = checked_in;
        if (is_paid !== undefined) updateData.is_paid = is_paid;

        if (Object.keys(updateData).length > 0) {
            console.log("UPDATING RACER", id, "with data:", updateData);
            const { error: updErr } = await supabase.from('racers').update(updateData).eq('id', id);
            if (updErr) console.error("SUPABASE UPDATE ERROR:", updErr);
        }
        if (members) {
            await supabase.from('members').delete().eq('racer_id', id);
            await supabase.from('members').insert(members.map(m => ({ racer_id: id, ...m })));
        }
        await checkAndStopEmptyBatchTimers();
        
        // Előzmény rögzítése ha rajtszám módosítás történt
        if (req.body.oldBib && bib && req.body.oldBib != bib) {
            await addBibHistoryEntry({
                racerName: req.body.racerName || 'Ismeretlen',
                oldBib: req.body.oldBib,
                newBib: bib
            });
        }

        res.json({ success: true, warning: (members && isDuplicate) ? "A szerkesztés mentve, de az adatok egyeznek egy már létező nevezéssel, ezért a státusz DUPLICATE maradt!" : null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 11.5 RAJTSZÁM ELŐZMÉNYEK (BIB HISTORY API) ---
app.get('/api/bib-history', authenticateAdmin, async (req, res) => {
    res.json(await getBibHistory());
});

app.delete('/api/bib-history', authenticateAdmin, async (req, res) => {
    await ensureHistoryDir();
    await fs.promises.writeFile(HISTORY_FILE, JSON.stringify([]));
    res.json({ success: true });
});

// --- 12. ADATKARBANTARTÁS (MAINTENANCE) ---
app.post('/api/reset', authenticateAdmin, async (req, res) => {
    try {
        await supabase.from('members').delete().not('racer_id', 'is', null);
        await supabase.from('racers').delete().not('id', 'is', null);
        await supabase.from('categories').delete().not('key', 'is', null);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reset-times', authenticateAdmin, async (req, res) => {
    try {
        await supabase.from('racers').update({ status: 'registered', total_time: null, start_time: null, finish_time: null }).not('id', 'is', null);
        await supabase.from('categories').delete().not('key', 'is', null);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 13. CSV IMPORTÁLÁS (DATA IMPORT) ---
function mapCsvCategoryToSlug(rawCategory, dist) {
    if (!rawCategory) return '';
    const n = rawCategory.toLowerCase();
    
    if (dist === '22km') {
        if (n.includes('versenykajak') && n.includes('női')) return 'versenykajak_noi_1_22km';
        if (n.includes('versenykajak') && n.includes('férfi')) return 'versenykajak_ferfi_1_22km';
        if (n.includes('túrakajak') || n.includes('turakajak')) {
            if (n.includes('2')) return 'turakajak_2_nyitott_22km';
            if (n.includes('női')) return 'turakajak_noi_1_22km';
            if (n.includes('férfi')) return 'turakajak_ferfi_1_22km';
        }
        if (n.includes('tengeri')) {
            if (n.includes('női')) return 'tengeri_kajak_noi_1_22km';
            if (n.includes('férfi')) return 'tengeri_kajak_ferfi_1_22km';
        }
        if (n.includes('surfski')) {
            if (n.includes('női')) return 'surfski_noi_22km';
            if (n.includes('férfi')) return 'surfski_ferfi_22km';
        }
        if (n.includes('mk')) {
            if (n.includes('fiú') || n.includes('fiu')) return 'mk_1_fiu_22km';
            if (n.includes('leány') || n.includes('leany')) return 'mk_1_leany_22km';
        }
        if (n.includes('outrigger')) {
            if (n.includes('2')) return 'outrigger_2_nyitott_22km';
            if (n.includes('női')) return 'outrigger_noi_1_22km';
            if (n.includes('férfi')) return 'outrigger_ferfi_22km';
        }
        if (n.includes('kenu')) {
            if (n.includes('2') && n.includes('férfi')) return 'kenu_2_ferfi_22km';
            if (n.includes('2') && n.includes('vegyes')) return 'kenu_2_vegyes_22km';
            if (n.includes('3')) return 'kenu_3_nyitott_22km';
            if (n.includes('4')) return 'kenu_4_nyitott_22km';
        }
        if (n.includes('sup')) {
            if (n.includes('női')) return 'sup_noi_1_22km';
            if (n.includes('férfi')) return 'sup_ferfi_1_22km';
        }
    }
    
    if (dist === '11km') {
        if (n.includes('kajak') && n.includes('1')) return 'kajak_1_nyitott_11km';
        if (n.includes('kajak') && n.includes('2')) return 'kajak_2_nyitott_11km';
        if (n.includes('kenu') && n.includes('1')) return 'kenu_1_nyitott_11km';
        if (n.includes('kenu') && n.includes('nyitott')) return 'kenu_nyitott_11km';
        if (n.includes('rövid') || n.includes('rovid')) return 'rovid_kenu_11km';
        if (n.includes('sárkányhajó') || n.includes('sarkanyhajo') || n.includes('sárkányha') || n.includes('sarkanyhaj')) return 'sarkanyhajo_otproba';
    }
    
    if (dist === '4km') {
        const isMerev = n.includes('merev');
        const isFelfujhato = n.includes('felfújható') || n.includes('felfujhato');
        const isNoi = n.includes('női');
        const isFerfi = n.includes('férfi');
        const is39Alatt = n.includes('39') || n.includes('alatt');
        const is40Felett = n.includes('40') || n.includes('felett');
        
        if (isNoi) {
            if (isMerev) {
                if (is39Alatt) return 'sup_noi_1_merev_39_alatt_4km';
                if (is40Felett) return 'sup_noi_1_merev_40_felett_4km';
            }
            if (isFelfujhato) {
                if (is39Alatt) return 'sup_noi_1_felfujhato_39_alatt_4km';
                if (is40Felett) return 'sup_noi_1_felfujhato_40_felett_4km';
            }
        }
        if (isFerfi) {
            if (isMerev) {
                if (is39Alatt) return 'sup_ferfi_1_merev_39_alatt_4km';
                if (is40Felett) return 'sup_ferfi_1_merev_40_felett_4km';
            }
            if (isFelfujhato) {
                if (is39Alatt) return 'sup_ferfi_1_felfujhato_39_alatt_4km';
                if (is40Felett) return 'sup_ferfi_1_felfujhato_40_felett_4km';
            }
        }
    }
    
    return normalizeCategoryToSlug(rawCategory);
}

app.post('/api/upload-csv', authenticateAdmin, bodyParser.json({ limit: '10mb' }), async (req, res) => {
    const { csvData } = req.body;
    const lines = csvData.trim().split('\n');
    if (lines.length === 0) {
        return res.json({ success: true, importedCount: 0, duplicatesCount: 0, logs: [] });
    }

    const header = lines[0].toLowerCase();
    const isNewFormat = header.includes('kategoriatipus') || header.includes('kategorianev');

    try {
        const results = [];
        // Szekvenciális feldolgozás, hogy a rajtszám generálás ne akadjon össze
        for (const line of lines.slice(1)) {
            if (!line.trim()) {
                results.push({ added: 0, duplicate: 0 });
                continue;
            }
            const delim = line.includes(';') ? ';' : ',';
            const fields = line.split(delim).map(s => s.trim());
            
            if (isNewFormat) {
                // ÚJ FORMÁTUM FELDOLGOZÁSA:
                // fields[0]: Nev (Contact Name)
                // fields[1]: Email
                // fields[2]: 5p (Contact 5Próba ID)
                // fields[3]: KategoriaTipus (Distance string)
                // fields[4]: KategoriaNev (Category string)
                // fields[5] - fields[8]: InduloNeve1 - InduloNeve4
                
                if (fields.length >= 5 && fields[0]) {
                    const contactName = fields[0];
                    const email = fields[1] || '';
                    const rawOtp = fields[2] || '';
                    const rawDistance = fields[3] || '11km';
                    const rawCategory = fields[4] || '';

                    // Megállapítjuk a távolságot (distance slug)
                    let dist = '11km';
                    const normDist = rawDistance.toLowerCase();
                    if (normDist.includes('hosszú') || normDist.includes('hosszu')) dist = '22km';
                    else if (normDist.includes('rövid') || normDist.includes('rovid')) dist = '11km';
                    else if (normDist.includes('sup')) {
                        const normCat = rawCategory.toLowerCase();
                        if (normCat.includes('merev') || normCat.includes('felfujhato') || normCat.includes('39') || normCat.includes('40')) {
                            dist = '4km';
                        } else {
                            dist = '22km';
                        }
                    }

                    const category = mapCsvCategoryToSlug(rawCategory, dist);
                    let bib = await getNextBib(dist, category);
                    
                    if (bib) {
                        let isDuplicate = false;
                        const { data: existing } = await supabase.from('racers')
                            .select('id')
                            .eq('bib', bib)
                            .eq('distance', dist)
                            .maybeSingle();

                        if (existing) {
                            isDuplicate = true;
                            bib = await getNextBib(dist, category);
                            if (!bib) {
                                results.push({ added: 0, duplicate: 0 });
                                continue;
                            }
                        }
                        
                        const membersToInsert = [];
                        let hasHardConflict = false;
                        
                        // maximum 4 induló beolvasása
                        for (let j = 0; j < 4; j++) {
                            const mName = fields[j + 5] ? fields[j + 5].trim() : '';
                            if (mName) {
                                // Ha a tag neve megegyezik a kapcsolattartó nevével, megkapja a megadott 5Próba ID-t
                                let mOtp = 'Nincs';
                                if (mName.toLowerCase() === contactName.toLowerCase() && rawOtp && rawOtp.toLowerCase() !== 'x') {
                                    mOtp = rawOtp.trim();
                                }
                                
                                const mBirth = ''; // Új formátumban nincs születési dátum
                                
                                membersToInsert.push({ racer_id: "", name: mName, birth_date: mBirth, otproba_id: mOtp });
                                
                                if (mOtp !== 'Nincs' && mOtp.length > 0) {
                                    const { data } = await supabase.from('members').select('id, name').eq('otproba_id', mOtp).limit(1);
                                    if (data && data.length > 0) {
                                        if (data[0].name.toLowerCase().trim() !== mName.toLowerCase().trim()) {
                                            hasHardConflict = true;
                                            break;
                                        }
                                        isDuplicate = true;
                                    }
                                }
                                
                                if (!isDuplicate && mName) {
                                    const { data } = await supabase.from('members').select('id').ilike('name', mName).eq('birth_date', mBirth).limit(1);
                                    if (data && data.length > 0) isDuplicate = true;
                                }
                            }
                        }

                        if (hasHardConflict || membersToInsert.length === 0) {
                            results.push({ 
                                added: 0, 
                                duplicate: 0,
                                log: hasHardConflict ? `❌ Kihagyva: ${membersToInsert.length > 0 ? membersToInsert[0].name : 'Ismeretlen'} - Az 5Próba azonosító egy másik névhez tartozik!` : null
                            });
                            continue;
                        }

                        const finalStatus = isDuplicate ? 'duplicate' : 'registered';
                        const racerId = Date.now().toString() + "_" + Math.floor(Math.random() * 1000);
                        
                        membersToInsert.forEach(m => m.racer_id = racerId);

                        const { error: rError } = await supabase.from('racers').insert({ 
                            id: racerId, bib, category, distance: dist, 
                            status: finalStatus, email
                        });
                        
                        if (!rError) {
                            const { error: mError } = await supabase.from('members').insert(membersToInsert);
                            if (mError) {
                                await supabase.from('racers').delete().eq('id', racerId);
                                results.push({ added: 0, duplicate: 0 });
                            } else {
                                results.push({ 
                                    added: 1, 
                                    duplicate: isDuplicate ? 1 : 0,
                                    log: isDuplicate ? `⚠️ Duplikáció: ${membersToInsert[0].name} (Egyezés egy már létező nevezéssel)` : null
                                });
                            }
                            continue;
                        } else {
                            console.error('Racer insert error:', rError);
                        }
                    }
                }
            } else {
                // RÉGI FORMÁTUM FELDOLGOZÁSA:
                if (fields.length >= 8 && fields[1]) {
                    const category = normalizeCategoryToSlug(fields[7]);
                    const dist = (fields[12] || '11km').replace(/\s+/g, '').toLowerCase();
                    let bib = parseInt(fields[0]);
                    
                    if (bib) {
                        let isDuplicate = false;
                        const { data: existing } = await supabase.from('racers')
                            .select('id')
                            .eq('bib', bib)
                            .eq('distance', dist)
                            .maybeSingle();

                        if (existing) {
                            isDuplicate = true;
                            bib = await getNextBib(dist, category);
                            if (!bib) {
                                results.push({ added: 0, duplicate: 0 });
                                continue;
                            }
                        }
                        
                        const membersToInsert = [];
                        let hasHardConflict = false;
                        
                        for(let j=0; j<4; j++) {
                            if(fields[j+1]) {
                                const mName = fields[j+1].trim();
                                const mBirth = fields[j+8] ? fields[j+8].trim() : '';
                                const mOtp = fields[j+13] ? fields[j+13].trim() : '';
                                
                                membersToInsert.push({ racer_id: "", name: mName, birth_date: mBirth, otproba_id: mOtp });
                                
                                if (mOtp.length > 0 && mOtp.toLowerCase() !== 'nincs') {
                                    const { data } = await supabase.from('members').select('id, name').eq('otproba_id', mOtp).limit(1);
                                    if (data && data.length > 0) {
                                        if (data[0].name.toLowerCase().trim() !== mName.toLowerCase().trim()) {
                                            hasHardConflict = true;
                                            break;
                                        }
                                        isDuplicate = true;
                                    }
                                }
                                if (!isDuplicate && mName && mBirth) {
                                    const { data } = await supabase.from('members').select('id').ilike('name', mName).eq('birth_date', mBirth).limit(1);
                                    if (data && data.length > 0) isDuplicate = true;
                                }
                            }
                        }

                        if (hasHardConflict || membersToInsert.length === 0) {
                            results.push({ 
                                added: 0, 
                                duplicate: 0,
                                log: hasHardConflict ? `❌ Kihagyva: ${membersToInsert.length > 0 ? membersToInsert[0].name : 'Ismeretlen'} - Az 5Próba azonosító egy másik névhez tartozik!` : null
                            });
                            continue;
                        }

                        const finalStatus = isDuplicate ? 'duplicate' : 'registered';
                        const racerId = Date.now().toString() + "_" + Math.floor(Math.random() * 1000);
                        
                        membersToInsert.forEach(m => m.racer_id = racerId);

                        const { error: rError } = await supabase.from('racers').insert({ 
                            id: racerId, bib, category, distance: dist, 
                            status: finalStatus 
                        });
                        
                        if (!rError) {
                            const { error: mError } = await supabase.from('members').insert(membersToInsert);
                            if (mError) {
                                await supabase.from('racers').delete().eq('id', racerId);
                                results.push({ added: 0, duplicate: 0 });
                            } else {
                                results.push({ 
                                    added: 1, 
                                    duplicate: isDuplicate ? 1 : 0,
                                    log: isDuplicate ? `⚠️ Duplikáció: ${membersToInsert[0].name} (Egyezés egy már létező nevezéssel)` : null
                                });
                            }
                            continue;
                        } else {
                            console.error('Racer insert error:', rError);
                        }
                    }
                }
            }
            results.push({ added: 0, duplicate: 0 });
        }

        const added = results.reduce((acc, curr) => acc + (curr.added || 0), 0);
        const duplicates = results.reduce((acc, curr) => acc + (curr.duplicate || 0), 0);
        const logs = results.map(r => r.log).filter(l => l);
        
        res.json({ success: true, importedCount: added, duplicatesCount: duplicates, logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/remove-from-dragon-team', authenticateAdmin, async (req, res) => {
    const { memberIds, targetCategory, targetDistance } = req.body;
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ error: 'Nincs kijelölt versenyző!' });
    }

    try {
        const { data: members, error: membersError } = await supabase.from('members').select('*').in('id', memberIds);
        if (membersError) throw membersError;

        let processed = 0;
        let oldRacerIds = [];
        let newRacerIds = [];

        for (const member of members) {
            if (member.otproba_id === 'CSAPATNEV') continue; // nem vesszük ki a csapatnevet!

            oldRacerIds.push(member.racer_id);

            let newCat = targetCategory || 'sarkanyhajo_otproba';
            let newDist = targetDistance || '11km';

            let bib = await getNextBib(newDist, newCat);
            if (!bib) throw new Error('Nincs szabad rajtszám az eltávolított tagnak!');

            const newRacerId = "INDIV_" + Date.now() + "_" + Math.floor(Math.random()*1000);
            newRacerIds.push(newRacerId);
            
            const { error: rError } = await supabase.from('racers').insert({
                id: newRacerId, 
                bib: parseInt(bib), 
                category: newCat, 
                distance: newDist, 
                status: 'registered'
            });
            if (rError) throw rError;

            const { error: mError } = await supabase.from('members')
                .update({ racer_id: newRacerId })
                .eq('id', member.id);
            if (mError) throw mError;
            
            processed++;
        }

        // Takarítás: töröljük azokat a régi rekordokat, amik kiürültek (már nincsenek tagjaik egyáltalán)
        oldRacerIds = [...new Set(oldRacerIds)];
        for (const oldId of oldRacerIds) {
            const { data: remMembers } = await supabase.from('members').select('id').eq('racer_id', oldId).limit(1);
            if (!remMembers || remMembers.length === 0) {
                await supabase.from('racers').delete().eq('id', oldId);
            }
        }

        res.json({ success: true, count: processed, newRacerIds });
    } catch (err) {
        console.error("[RemoveFromDragonTeam Error]", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/create-dragon-team', authenticateAdmin, async (req, res) => {
    let { memberIds, bib, name } = req.body;
    if (!bib && !name) return res.status(400).json({ error: 'Nincs megadva se csapatnév, se rajtszám!' });

    try {
        let oldRacerIds = [];
        if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
            // 1. Megszerezzük a kiválasztott tagok jelenlegi racer_id-it (későbbi takarításhoz)
            const { data: oldMembers, error: oldError } = await supabase.from('members').select('racer_id').in('id', memberIds);
            if (oldError) throw oldError;
            
            oldRacerIds = [...new Set((oldMembers || []).map(m => m.racer_id))].filter(id => id);
        }

        // 2. Megnézzük, létezik-e már a cél rajtszám vagy csapatnév
        let existingRacer = null;
        if (bib) {
            const { data } = await supabase.from('racers').select('id, category, bib').eq('bib', parseInt(bib)).maybeSingle();
            existingRacer = data;
        } else if (name) {
            const { data: teamMember } = await supabase.from('members').select('racer_id').ilike('name', name).eq('otproba_id', 'CSAPATNEV').maybeSingle();
            if (teamMember) {
                const { data } = await supabase.from('racers').select('id, category, bib').eq('id', teamMember.racer_id).maybeSingle();
                existingRacer = data;
                if (existingRacer) bib = existingRacer.bib;
            }
        }
        
        let targetRacerId = existingRacer ? existingRacer.id : null;

        if (existingRacer) {
            console.log(`[CreateDragonTeam] Using existing racer: ${existingRacer.id} (Bib: ${bib})`);
            // Ha létezik, de nem sárkányhajó, akkor hiba
            if (!(/s[aá]rk[aá]ny/i.test(existingRacer.category || ''))) {
                return res.status(400).json({ error: `A #${bib} rajtszám vagy csapat már foglalt egy másik kategóriában!` });
            }
            if (name) {
                const { data: dTags } = await supabase.from('members').select('id').eq('racer_id', targetRacerId).eq('otproba_id', 'CSAPATNEV');
                if (dTags && dTags.length > 0) {
                    await supabase.from('members').update({ name: name }).eq('id', dTags[0].id);
                } else {
                    await supabase.from('members').insert({
                        racer_id: targetRacerId,
                        name: name,
                        birth_date: '1900-01-01',
                        otproba_id: 'CSAPATNEV'
                    });
                }
            }
        } else {
            // Auto-generate bib if missing
            if (!bib) {
                bib = await getNextBib('11km', 'sarkanyhajo_otproba');
                if (!bib) return res.status(400).json({ error: 'Nincs szabad rajtszám az új csapatnak!' });
            }

            console.log(`[CreateDragonTeam] Creating new racer for Bib: ${bib}`);
            // Ha nem létezik, létrehozzuk
            targetRacerId = "DRAGON_" + Date.now();
            const { error: rError } = await supabase.from('racers').insert({
                id: targetRacerId, 
                bib: parseInt(bib), 
                category: 'sarkanyhajo_otproba', 
                distance: '11km', 
                status: 'registered'
            });
            if (rError) throw rError;

            if (name) {
                await supabase.from('members').insert({
                    racer_id: targetRacerId,
                    name: name,
                    birth_date: '1900-01-01',
                    otproba_id: 'CSAPATNEV'
                });
            }
        }

        // 3. Tagok behelyezése a cél egységbe
        if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
            const { error: mError } = await supabase.from('members')
                .update({ racer_id: targetRacerId })
                .in('id', memberIds);
            
            if (mError) throw mError;
        }

        // 4. Takarítás: töröljük azokat a régi rekordokat, amik kiürültek
        for (const oldId of oldRacerIds) {
            if (oldId === targetRacerId) continue;
            const { data: remMembers } = await supabase.from('members').select('id').eq('racer_id', oldId).limit(1);
            if (!remMembers || remMembers.length === 0) {
                // Ha nincs benne több tag, töröljük a racer rekordot is (kivéve ha épp oda mozgattunk)
                await supabase.from('racers').delete().eq('id', oldId);
            }
        }

        res.json({ success: true, racerId: targetRacerId, bib: bib });
    } catch (err) {
        console.error("[CreateDragonTeam Error]", err);
        res.status(500).json({ error: err.message });
    }
});

server.listen(PORT, () => {
    console.log(`DragonWave Server running at http://localhost:${PORT}`);
});
