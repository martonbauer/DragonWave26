/**
 * --- RACER & REGISTRATION ROUTES ---
 * Versenyzői adatok lekérése (GDPR szűréssel), nevezés, módosítás, törlés és Barion fizetés.
 */

const express = require('express');
const fs = require('fs');
const supabase = require('../../database');
const { authenticateAdmin, isAdmin } = require('../middleware/auth');
const { getNextBib } = require('../services/bib-service');
const { checkAndStopEmptyBatchTimers } = require('../services/batch-service');
const { validateRacerData, normalizeCategoryToSlug } = require('../utils/validation');
const { normalizeOtprobaId } = require('../utils/stringHelper');
const { findOtprobaDuplicate, findNameBirthDuplicate } = require('../services/duplicate-service');
const {
    ensureHistoryDir,
    getBibHistory,
    addBibHistoryEntry,
    HISTORY_FILE,
} = require('../services/history-service');
const { getCategoryMerges } = require('../services/category-merge-service');
const { SimpleMutex } = require('../utils/mutex');

const router = express.Router();
const registerMutex = new SimpleMutex();

let fetchLib;
async function getFetch() {
    if (!fetchLib) {
        fetchLib = global.fetch ? global.fetch : (await import('node-fetch')).default;
    }
    return fetchLib;
}

// 1. Publikus és admin versenyadatok lekérése
router.get('/data', async (req, res) => {
    try {
        const { data: racers, error: rError } = await supabase.from('racers').select('*, members(*)');
        if (rError) throw rError;
        const { data: categories, error: cError } = await supabase.from('categories').select('*');
        if (cError) throw cError;

        const { data: checkpoints, error: chkError } = await supabase.from('checkpoints').select('*');
        if (chkError) console.warn('Checkpoints fetch (maybe table missing):', chkError.message);

        const categoriesObj = {};
        (categories || []).forEach(c => (categoriesObj[c.key] = c.start_time));

        const isUserAdmin = isAdmin(req);

        // Kiszűrjük az esetleges rendszer-beállítás kamu sorokat
        const filteredRacers = (racers || []).filter(r => r.id !== 'SYSTEM_CATEGORY_MERGES');

        // Adatvédelmi / GDPR szűrés ha a kérés publikus (nem hitelesített admin):
        const safeRacers = isUserAdmin
            ? filteredRacers
            : filteredRacers.map(r => ({
                  id: r.id,
                  bib: r.bib,
                  category: r.category,
                  distance: r.distance,
                  status: r.status,
                  start_time: r.start_time,
                  finish_time: r.finish_time,
                  total_time: r.total_time,
                  name: r.name,
                  members: (r.members || []).map(m => ({
                      id: m.id,
                      name: m.name,
                      otproba_id: m.otproba_id === 'CSAPATNEV' ? 'CSAPATNEV' : undefined,
                  })),
              }));

        const categoryMerges = await getCategoryMerges();

        res.json({
            racers: safeRacers,
            categories: categoriesObj,
            checkpoints: checkpoints || [],
            categoryMerges,
            serverNow: Date.now(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Versenyző regisztráció (Nevezés)
router.post('/register', async (req, res) => {
    const { members, category: rawCategory, distance, is_series, email, phone } = req.body;
    const category = normalizeCategoryToSlug(rawCategory, distance);

    const validationError = validateRacerData(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    await registerMutex.acquire();
    try {
        let isDuplicate = false;

        // Duplikáció ellenőrzés a versenyszabályok szerint
        if (members && members.length > 0) {
            for (const m of members) {
                m.otproba_id = normalizeOtprobaId(m.otproba_id) || 'Nincs';
                m.name = m.name ? m.name.trim() : '';

                // 1. Ellenőrzés Ötpróba ID alapján
                const duplicateMember = await findOtprobaDuplicate(m.otproba_id);
                if (duplicateMember) {
                    const bibStr = duplicateMember.racer_bib ? `#${duplicateMember.racer_bib}` : 'ismeretlen';
                    return res.status(400).json({
                        error: `Hiba: A(z) '${m.otproba_id}' 5Próba azonosító már regisztrálva van a(z) ${bibStr} rajtszámú egységnél (${duplicateMember.name})! Egy versenyző nem szerepelhet több egységben.`,
                    });
                }
                // 2. Ellenőrzés Név + Születési dátum alapján
                if (!isDuplicate && m.name && m.birth_date) {
                    const hasDuplicate = await findNameBirthDuplicate(m.name, m.birth_date);
                    if (hasDuplicate) {
                        isDuplicate = true;
                        break;
                    }
                }
            }
        }

        const finalStatus = isDuplicate ? 'duplicate' : 'registered';

        const bib = await getNextBib(distance, category);
        if (bib === null) return res.status(400).json({ error: 'Nincs több szabad rajtszám!' });

        const racerId = Date.now().toString();
        const { error: rError } = await supabase.from('racers').insert({
            id: racerId,
            bib,
            category,
            distance,
            is_series: is_series ? 1 : 0,
            status: finalStatus,
            email,
            phone,
        });
        if (rError) throw rError;

        if (members && members.length > 0) {
            const membersToInsert = members.map(m => ({
                racer_id: racerId,
                name: m.name,
                birth_date: m.birth_date,
                otproba_id: m.otproba_id,
            }));
            const { error: mError } = await supabase.from('members').insert(membersToInsert);
            if (mError) {
                // Rollback: töröljük a már beszúrt versenyzőt
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

// 3. Barion fizetés indítása
router.post('/barion/payment', async (req, res) => {
    const { email, amount, guestString, orderId } = req.body;
    const posKey = process.env.BARION_POS_KEY;

    if (!posKey || posKey === 'your_barion_poskey') {
        return res
            .status(400)
            .json({ error: 'A Barion fizetés jelenleg élesítve van, de hiányzik a BARION_POS_KEY az .env fájlból!' });
    }

    const payload = {
        POSKey: posKey,
        PaymentType: 'Immediate',
        GuestCheckout: true,
        FundingSources: ['All'],
        PaymentRequestId: orderId || `DRGW-${Date.now()}`,
        PayerHint: email || 'ugyfel@pelda.hu',
        Transactions: [
            {
                POSTransactionId: `TR-${Date.now()}`,
                Payee: email || 'ugyfel@pelda.hu',
                Total: amount || 0,
                Items: [
                    {
                        Name: 'DragonWave Nevezési Díj',
                        Description: guestString || 'Nevezés',
                        Quantity: 1,
                        Unit: 'db',
                        UnitPrice: amount || 0,
                        ItemTotal: amount || 0,
                    },
                ],
            },
        ],
        Locale: 'hu-HU',
        Currency: 'HUF',
        RedirectUrl: `${req.headers.origin}?payment=success`,
        CallbackUrl: `${req.headers.origin}/api/barion/callback`,
    };

    try {
        const customFetch = await getFetch();
        const response = await customFetch('https://api.barion.com/v2/Payment/Start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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

// 4. Versenyző törlése (ID vagy BIB alapján)
router.delete('/racer/:idOrBib', authenticateAdmin, async (req, res) => {
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

// 5. Versenyző módosítása
router.put('/racer/:id', authenticateAdmin, async (req, res) => {
    const id = req.params.id;
    const { bib, category, distance, is_series, status, email, phone, members, checked_in, is_paid, total_time } =
        req.body;
    try {
        const { data: racer } = await supabase.from('racers').select('*').eq('id', id).single();
        if (!racer) return res.status(404).json({ error: 'A módosítani kívánt versenyző nem található!' });

        if (bib) {
            const { data: existing } = await supabase
                .from('racers')
                .select('id, bib')
                .eq('bib', bib)
                .neq('id', id)
                .maybeSingle();
            if (existing) {
                if (req.body.swap) {
                    const oldBibA = racer.bib;
                    const oldBibB = existing.bib;
                    const idB = existing.id;

                    const tempBib = -1000 - Math.floor(Math.random() * 10000);
                    const { error: err1 } = await supabase.from('racers').update({ bib: tempBib }).eq('id', id);
                    if (err1) throw new Error('Csere hiba (A -> Temp): ' + err1.message);

                    const { error: err2 } = await supabase.from('racers').update({ bib: oldBibA }).eq('id', idB);
                    if (err2) {
                        await supabase.from('racers').update({ bib: oldBibA }).eq('id', id);
                        throw new Error('Csere hiba (B -> A régi): ' + err2.message);
                    }

                    const { error: err3 } = await supabase.from('racers').update({ bib: oldBibB }).eq('id', id);
                    if (err3) {
                        throw new Error('Csere hiba (A -> B régi): ' + err3.message);
                    }

                    const { data: m1 } = await supabase.from('members').select('name').eq('racer_id', id);
                    const { data: m2 } = await supabase.from('members').select('name').eq('racer_id', idB);
                    const nameA = m1 && m1.length > 0 ? m1.map(m => m.name).join(', ') : 'Ismeretlen';
                    const nameB = m2 && m2.length > 0 ? m2.map(m => m.name).join(', ') : 'Ismeretlen';

                    await addBibHistoryEntry({ racerName: nameA, oldBib: oldBibA, newBib: oldBibB });
                    await addBibHistoryEntry({ racerName: nameB, oldBib: oldBibB, newBib: oldBibA });

                    delete req.body.oldBib;
                } else {
                    return res.status(400).json({ error: `A #${bib} rajtszám már foglalt egy másik versenyzőnél!` });
                }
            }
        }

        let isDuplicate = false;
        if (members && members.length > 0) {
            for (const m of members) {
                m.otproba_id = normalizeOtprobaId(m.otproba_id) || 'Nincs';
                m.name = m.name ? m.name.trim() : '';

                const duplicateMember = await findOtprobaDuplicate(m.otproba_id, id);
                if (duplicateMember) {
                    const bibStr = duplicateMember.racer_bib ? `#${duplicateMember.racer_bib}` : 'ismeretlen';
                    return res.status(400).json({
                        error: `Hiba: A(z) '${m.otproba_id}' 5Próba azonosító már regisztrálva van a(z) ${bibStr} rajtszámú egységnél (${duplicateMember.name})! Egy versenyző nem szerepelhet több egységben.`,
                    });
                }
                if (!isDuplicate && m.name && m.birth_date) {
                    const hasDuplicate = await findNameBirthDuplicate(m.name, m.birth_date, id);
                    if (hasDuplicate) {
                        isDuplicate = true;
                        break;
                    }
                }
            }
        }

        const updateData = {};
        if (bib !== undefined) updateData.bib = bib;
        if (category !== undefined) updateData.category = category;
        if (distance !== undefined) updateData.distance = distance;

        if (status !== undefined) {
            updateData.status = members && isDuplicate ? 'duplicate' : status;
        } else if (members && isDuplicate) {
            updateData.status = 'duplicate';
        }

        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (is_series !== undefined) updateData.is_series = is_series ? 1 : 0;
        if (checked_in !== undefined) updateData.checked_in = checked_in;
        if (is_paid !== undefined) updateData.is_paid = is_paid;

        if (total_time !== undefined) {
            updateData.total_time = total_time;
            if (total_time !== null) {
                const start = racer.start_time || Date.now();
                updateData.finish_time = start + total_time;
            } else {
                updateData.finish_time = null;
            }
        }

        if (Object.keys(updateData).length > 0) {
            console.log('UPDATING RACER', id, 'with data:', updateData);
            const { error: updErr } = await supabase.from('racers').update(updateData).eq('id', id);
            if (updErr) console.error('SUPABASE UPDATE ERROR:', updErr);
        }
        if (members) {
            await supabase.from('members').delete().eq('racer_id', id);
            await supabase.from('members').insert(members.map(m => ({ racer_id: id, ...m })));
        }
        await checkAndStopEmptyBatchTimers();

        if (req.body.oldBib && bib && req.body.oldBib != bib) {
            await addBibHistoryEntry({
                racerName: req.body.racerName || 'Ismeretlen',
                oldBib: req.body.oldBib,
                newBib: bib,
            });
        }

        res.json({
            success: true,
            warning:
                members && isDuplicate
                    ? 'A szerkesztés mentve, de az adatok egyeznek egy már létező nevezéssel, ezért a státusz DUPLICATE maradt!'
                    : null,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Tag módosítása
router.put('/member/:id', authenticateAdmin, async (req, res) => {
    const id = req.params.id;
    const { checked_in } = req.body;
    try {
        const updateData = {};
        if (checked_in !== undefined) updateData.checked_in = checked_in;

        if (Object.keys(updateData).length > 0) {
            const { error } = await supabase.from('members').update(updateData).eq('id', id);
            if (error) throw error;
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Rajtszám előzmények (BIB History)
router.get('/bib-history', authenticateAdmin, async (req, res) => {
    res.json(await getBibHistory());
});

router.delete('/bib-history', authenticateAdmin, async (req, res) => {
    await ensureHistoryDir();
    await fs.promises.writeFile(HISTORY_FILE, JSON.stringify([]));
    res.json({ success: true });
});

module.exports = router;
