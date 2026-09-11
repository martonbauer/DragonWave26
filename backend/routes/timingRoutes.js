/**
 * --- RACE TIMING ROUTES ---
 * Rajtok indítása (kategória, tömeg, táv, egyéni), leállítások, részidők, ellenőrzőpontok és reset.
 */

const express = require('express');
const supabase = require('../../database');
const { authenticateAdmin } = require('../middleware/auth');
const { getGroupQuery, checkAndStopEmptyBatchTimers } = require('../services/batch-service');
const {
    getUnassignedTimes,
    saveUnassignedTimes,
} = require('../services/history-service');
const { emitRefresh } = require('../utils/socketHelper');

const router = express.Router();

// 1. Kategória rajt
router.post('/start-category', authenticateAdmin, async (req, res) => {
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

// 2. Tömegrajt (Minden regisztrált egyszerre)
router.post('/start-mass', authenticateAdmin, async (req, res) => {
    const now = Date.now();
    const startKey = 'MASS_START_ALL';
    try {
        await supabase.from('categories').insert({ key: startKey, start_time: now });
        const { data } = await supabase
            .from('racers')
            .update({ status: 'running', start_time: now })
            .eq('status', 'registered')
            .select();
        res.json({ success: true, start_time: now, count: data?.length || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Táv szerinti rajt
router.post('/start-distance', authenticateAdmin, async (req, res) => {
    const { distance } = req.body;
    const now = Date.now();
    const startKey = `DISTANCE_${distance}`;
    try {
        await supabase.from('categories').insert({ key: startKey, start_time: now });
        const { data } = await supabase
            .from('racers')
            .update({ status: 'running', start_time: now })
            .eq('status', 'registered')
            .eq('distance', distance)
            .select();
        res.json({ success: true, start_time: now, count: data?.length || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Egyéni rajt (BIB alapján)
router.post('/start-individual', authenticateAdmin, async (req, res) => {
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

// 5. Kategória leállítása
router.post('/stop-category', authenticateAdmin, async (req, res) => {
    const { categoryName, distance, groupId } = req.body;
    const now = Date.now();
    const startKey = groupId || `${categoryName}_${distance}`;
    try {
        const { data: categoryData } = await supabase
            .from('categories')
            .select('start_time')
            .eq('key', startKey)
            .maybeSingle();

        const startTime = categoryData ? categoryData.start_time : null;
        let count = 0;

        if (startTime) {
            let query = supabase
                .from('racers')
                .update({
                    status: 'finished',
                    finish_time: now,
                    total_time: now - startTime,
                })
                .eq('status', 'running');

            query = groupId ? getGroupQuery(query, groupId) : query.eq('category', categoryName).eq('distance', distance);

            const { data: updated, error: updErr } = await query.select();
            if (updErr) throw updErr;
            count = updated?.length || 0;
        } else {
            let query = supabase.from('racers').select('*').eq('status', 'running');
            query = groupId ? getGroupQuery(query, groupId) : query.eq('category', categoryName).eq('distance', distance);
            const { data: runningRacers } = await query;

            if (runningRacers && runningRacers.length > 0) {
                await Promise.all(
                    runningRacers.map(r =>
                        supabase
                            .from('racers')
                            .update({
                                status: 'finished',
                                finish_time: now,
                                total_time: now - (r.start_time || now),
                            })
                            .eq('id', r.id)
                    )
                );
                count = runningRacers.length;
            }
        }

        await supabase.from('categories').delete().eq('key', startKey);
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Kategória rajtjának törlése (Reset)
router.post('/reset-category', authenticateAdmin, async (req, res) => {
    const { categoryName, distance, groupId } = req.body;
    const startKey = groupId || `${categoryName}_${distance}`;
    try {
        await supabase.from('categories').delete().eq('key', startKey);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Egyéni versenyző leállítása
router.post('/stop-racer', authenticateAdmin, async (req, res) => {
    const { bib, timestamp } = req.body;
    const now = timestamp || Date.now();
    try {
        const { data: racer } = await supabase.from('racers').select('*').eq('bib', bib).single();
        if (!racer) return res.status(404).json({ error: 'Nincs ilyen rajtszám!' });

        if (racer.status === 'finished') {
            return res.status(400).json({ error: 'Már beérkezett! (Második nyomás kihagyva)' });
        }

        if (racer.status !== 'running' || !racer.start_time) {
            return res.status(400).json({ error: 'A versenyző nincs futamban! (Még nem indult el)' });
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

// 8. Tömeges célbaérkezés (Bulk Stop)
router.post('/stop-bulk-racers', authenticateAdmin, async (req, res) => {
    const { bibs, timestamp } = req.body;
    const baseNow = timestamp || Date.now();

    if (!bibs || !Array.isArray(bibs) || bibs.length === 0) {
        return res.status(400).json({ error: 'Üres rajtszám lista!' });
    }

    try {
        const { data: racers } = await supabase.from('racers').select('id, bib, start_time, status').in('bib', bibs);
        const results = { successful: [], failed: [] };

        if (!racers || racers.length === 0) {
            return res.status(404).json({ error: 'Nincs találat a megadott rajtszámokra!' });
        }

        const promises = bibs.map(async (bibStr, index) => {
            const bibNum = parseInt(bibStr);
            const r = racers.find(dbRacer => dbRacer.bib === bibNum);

            if (!r) return;
            if (r.status === 'finished') {
                results.failed.push(`#${r.bib}: Már beérkezett`);
                return;
            }
            if (r.status !== 'running') {
                results.failed.push(`#${r.bib}: Nincs futamban`);
                return;
            }

            // +500 ms eltolás az egymást követő bírói beütések sorrendjének megtartásához
            const racerFinishTime = baseNow + index * 500;
            const total_time = racerFinishTime - r.start_time;

            const { error } = await supabase
                .from('racers')
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

// 9. Kiosztatlan idők (Unassigned Times)
router.post('/unassigned-time', authenticateAdmin, async (req, res) => {
    const { timestamp } = req.body;
    const now = timestamp || Date.now();
    try {
        const times = await getUnassignedTimes();
        const newTime = {
            id: Date.now().toString() + '_' + Math.floor(Math.random() * 1000),
            timestamp: now,
            dateString: new Date(now).toISOString(),
        };
        times.push(newTime);
        await saveUnassignedTimes(times);
        emitRefresh();
        res.json({ success: true, id: newTime.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/unassigned-times', authenticateAdmin, async (req, res) => {
    res.json(await getUnassignedTimes());
});

router.post('/assign-time', authenticateAdmin, async (req, res) => {
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/unassigned-time/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        let times = await getUnassignedTimes();
        times = times.filter(t => t.id !== id);
        await saveUnassignedTimes(times);
        emitRefresh();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. Ellenőrzőpont regisztráció (Checkpoint)
router.post('/checkpoint', authenticateAdmin, async (req, res) => {
    const { bib, checkpoint_name, timestamp } = req.body;
    const now = timestamp || Date.now();
    try {
        const { data: racer } = await supabase.from('racers').select('id, status').eq('bib', bib).maybeSingle();
        if (!racer) return res.status(404).json({ error: 'Nincs ilyen rajtszám!' });

        const { error } = await supabase.from('checkpoints').insert({
            racer_bib: bib,
            checkpoint_name: checkpoint_name,
            timestamp: now,
        });

        if (error) throw error;

        res.json({ success: true, bib, checkpoint_name, timestamp: now });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 11. Teljes reset és idő reset
router.post('/reset', authenticateAdmin, async (req, res) => {
    try {
        await supabase.from('members').delete().not('racer_id', 'is', null);
        await supabase.from('racers').delete().not('id', 'is', null);
        await supabase.from('categories').delete().not('key', 'is', null);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/reset-times', authenticateAdmin, async (req, res) => {
    try {
        await supabase
            .from('racers')
            .update({ status: 'registered', total_time: null, start_time: null, finish_time: null })
            .not('id', 'is', null);
        await supabase.from('categories').delete().not('key', 'is', null);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
