/**
 * --- MANAGEMENT AND IMPORT ROUTES ---
 * Adatbázis archiválás, visszaállítás, CSV import, AI keretrendszer és sárkányhajó csapatkezelés.
 */

const express = require('express');
const bodyParser = require('body-parser');
const supabase = require('../../database');
const { authenticateAdmin } = require('../middleware/auth');
const { getNextBib } = require('../services/bib-service');
const { normalizeName, normalizeOtprobaId } = require('../utils/stringHelper');
const { normalizeCategoryToSlug } = require('../utils/validation');
const { findOtprobaDuplicate, findNameBirthDuplicate } = require('../services/duplicate-service');
const { getCategoryMerges, saveCategoryMerges } = require('../services/category-merge-service');
const { emitRefresh } = require('../utils/socketHelper');

const router = express.Router();

let fetchLib;
async function getFetch() {
    if (!fetchLib) {
        fetchLib = global.fetch ? global.fetch : (await import('node-fetch')).default;
    }
    return fetchLib;
}

router.get('/backup/export', authenticateAdmin, async (req, res) => {
    try {
        const { data: racers, error: rError } = await supabase.from('racers').select('*');
        if (rError) throw rError;

        const { data: members, error: mError } = await supabase.from('members').select('*');
        if (mError) throw mError;

        const { data: categories, error: cError } = await supabase.from('categories').select('*');
        if (cError) throw cError;

        const { data: checkpoints, error: chkError } = await supabase.from('checkpoints').select('*');
        if (chkError) console.warn('Checkpoints fetch warning:', chkError.message);

        res.json({
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            data: {
                racers: racers || [],
                members: members || [],
                categories: categories || [],
                checkpoints: checkpoints || [],
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/backup/restore', authenticateAdmin, bodyParser.json({ limit: '20mb' }), async (req, res) => {
    try {
        const { racers, members, categories, checkpoints } = req.body || {};

        // 1. Töröljük a meglévő rekordokat a megfelelő sorrendben a függőségek miatt
        await supabase.from('checkpoints').delete().not('id', 'is', null);
        await supabase.from('members').delete().not('id', 'is', null);
        await supabase.from('racers').delete().not('id', 'is', null);
        await supabase.from('categories').delete().not('key', 'is', null);

        // 2. Újraírjuk a kategóriákat
        if (categories && categories.length > 0) {
            const { error: cErr } = await supabase.from('categories').insert(categories);
            if (cErr) throw new Error('Hiba a kategóriák visszaállításakor: ' + cErr.message);
        }

        // 3. Újraírjuk a versenyzőket
        if (racers && racers.length > 0) {
            const { error: rErr } = await supabase.from('racers').insert(racers);
            if (rErr) throw new Error('Hiba a versenyzők visszaállításakor: ' + rErr.message);
        }

        // 4. Újraírjuk a csapattagokat
        if (members && members.length > 0) {
            const { error: mErr } = await supabase.from('members').insert(members);
            if (mErr) throw new Error('Hiba a tagok visszaállításakor: ' + mErr.message);
        }

        // 5. Újraírjuk az ellenőrzőpontokat
        if (checkpoints && checkpoints.length > 0) {
            const { error: chkErr } = await supabase.from('checkpoints').insert(checkpoints);
            if (chkErr) throw new Error('Hiba az ellenőrzőpontok visszaállításakor: ' + chkErr.message);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 12.6 ADATBÁZIS KATEGÓRIA ÖSSZEVONÁSOK (CATEGORY MERGES) ---
router.get('/category-merges', async (req, res) => {
    try {
        const merges = await getCategoryMerges();
        res.json(merges);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/category-merges', authenticateAdmin, bodyParser.json(), async (req, res) => {
    try {
        const merges = req.body || {};
        await saveCategoryMerges(merges);
        // Töröljük a korábbi kamu adatbázis rekordot ha még létezik a racers táblában
        await supabase.from('racers').delete().eq('id', 'SYSTEM_CATEGORY_MERGES');
        emitRefresh();
        res.json({ success: true, merges });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 13. CSV IMPORTÁLÁS (DATA IMPORT) ---
function mapCsvCategoryToSlug(rawCategory, dist) {
    if (!rawCategory) return '';
    const n = rawCategory.toLowerCase();

    if (dist === '22km') {
        if (n.includes('versenykajak') && n.includes('női')) return 'versenykajak_noi_1';
        if (n.includes('versenykajak') && n.includes('férfi')) return 'versenykajak_ferfi_1';
        if (n.includes('túrakajak') || n.includes('turakajak')) {
            if (n.includes('2')) return 'turakajak_2_nyitott';
            if (n.includes('női')) return 'turakajak_noi_1';
            if (n.includes('férfi')) return 'turakajak_ferfi_1';
        }
        if (n.includes('tengeri')) {
            if (n.includes('női')) return 'tengeri_kajak_noi_1';
            if (n.includes('férfi')) return 'tengeri_kajak_ferfi_1';
        }
        if (n.includes('surfski')) {
            if (n.includes('női')) return 'surfski_noi';
            if (n.includes('férfi')) return 'surfski_ferfi';
        }
        if (n.includes('outrigger')) {
            if (n.includes('2')) return 'outrigger_2_nyitott';
            if (n.includes('női')) return 'outrigger_noi_1';
            if (n.includes('férfi')) return 'outrigger_ferfi_1';
        }
        if (n.includes('kenu')) {
            if (n.includes('2') && n.includes('férfi')) return 'kenu_2_ferfi';
            if (n.includes('2') && n.includes('vegyes')) return 'kenu_2_vegyes';
            if (n.includes('3')) return 'kenu_3_nyitott';
            if (n.includes('4')) return 'kenu_4_nyitott';
        }
        if (n.includes('sup')) {
            if (n.includes('női')) return 'sup_noi_1';
            if (n.includes('férfi')) return 'sup_ferfi_1';
        }
    }

    if (dist === '11km') {
        if (n.includes('sup')) {
            const isMerev = n.includes('merev');
            const isFelfujhato = n.includes('felfújható') || n.includes('felfujhato');
            const isNoi = n.includes('női');
            const isFerfi = n.includes('férfi');

            if (isNoi) {
                if (isMerev) return 'sup_noi_1_merev';
                if (isFelfujhato) return 'sup_noi_1_felfujhato';
            }
            if (isFerfi) {
                if (isMerev) return 'sup_ferfi_1_merev';
                if (isFelfujhato) return 'sup_ferfi_1_felfujhato';
            }
        }
        if (n.includes('kajak') && n.includes('1')) return 'kajak_1_nyitott';
        if (n.includes('kajak') && n.includes('2')) return 'kajak_2_nyitott';
        if (n.includes('kenu') && n.includes('1')) return 'kenu_1_nyitott';
        if (n.includes('kenu') && n.includes('2')) return 'kenu_2_nyitott';
        if (n.includes('kenu') && n.includes('3')) return 'kenu_3_nyitott';
        if (n.includes('kenu') && n.includes('4')) return 'kenu_4_nyitott';
        if (
            n.includes('sárkányhajó') ||
            n.includes('sarkanyhajo') ||
            n.includes('sárkányha') ||
            n.includes('sarkanyhaj')
        )
            return 'sarkanyhajo_otproba';
    }

    if (dist === '4km') {
        const isMerev = n.includes('merev');
        const isFelfujhato = n.includes('felfújható') || n.includes('felfujhato');
        const isNoi = n.includes('női');
        const isFerfi = n.includes('férfi');
        const is39Alatt = n.includes('39') || n.includes('alatt');
        const is40Felett = n.includes('40') || n.includes('felett');
        const is16Alatt = n.includes('16');

        if (isNoi) {
            if (isMerev) {
                if (is39Alatt) return 'sup_noi_1_merev_39_alatt';
                if (is40Felett) return 'sup_noi_1_merev_40_felett';
            }
            if (isFelfujhato) {
                if (is16Alatt) return 'sup_noi_1_felfujhato_16_alatt';
                if (is39Alatt) return 'sup_noi_1_felfujhato_39_alatt';
                if (is40Felett) return 'sup_noi_1_felfujhato_40_felett';
            }
        }
        if (isFerfi) {
            if (isMerev) {
                if (is39Alatt) return 'sup_ferfi_1_merev_39_alatt';
                if (is40Felett) return 'sup_ferfi_1_merev_40_felett';
            }
            if (isFelfujhato) {
                if (is16Alatt) return 'sup_ferfi_1_felfujhato_16_alatt';
                if (is39Alatt) return 'sup_ferfi_1_felfujhato_39_alatt';
                if (is40Felett) return 'sup_ferfi_1_felfujhato_40_felett';
            }
        }
    }

    return normalizeCategoryToSlug(rawCategory, dist);
}

/**
 * Segédfunkció meglévő regisztráció kereséséhez kategória, távolság és a tagok neveinek egyezése alapján.
 */
async function findExistingRacerRegistration(category, distance, memberList) {
    if (!memberList || memberList.length === 0) return null;

    // 1. Lekérjük a kategóriában és távon lévő összes versenyzőt
    const { data: racers, error: rErr } = await supabase
        .from('racers')
        .select('id, bib')
        .eq('category', category)
        .eq('distance', distance);

    if (rErr || !racers || racers.length === 0) return null;

    const racerIds = racers.map(r => r.id);

    // 2. Lekérjük ezen versenyzők összes tagját
    const { data: members, error: mErr } = await supabase
        .from('members')
        .select('racer_id, name')
        .in('racer_id', racerIds);

    if (mErr || !members || members.length === 0) return null;

    // Csoportosítjuk a tagokat racer_id szerint
    const racerMembersMap = {};
    for (const m of members) {
        if (!racerMembersMap[m.racer_id]) {
            racerMembersMap[m.racer_id] = [];
        }
        racerMembersMap[m.racer_id].push(m);
    }

    // A bejövő tagok listájának normalizált nevei
    const inputNormNames = memberList.map(m => normalizeName(m.name)).sort();

    // 3. Megkeressük, van-e olyan regisztráció, aminek pontosan ugyanazok a tagjai vannak
    for (const racerId of racerIds) {
        const existingMembers = racerMembersMap[racerId] || [];
        if (existingMembers.length !== memberList.length) continue;

        const existingNormNames = existingMembers.map(m => normalizeName(m.name)).sort();
        
        // Összehasonlítás
        let match = true;
        for (let i = 0; i < inputNormNames.length; i++) {
            if (inputNormNames[i] !== existingNormNames[i]) {
                match = false;
                break;
            }
        }

        if (match) {
            return racers.find(r => r.id === racerId);
        }
    }

    return null;
}

router.post('/upload-csv', authenticateAdmin, bodyParser.json({ limit: '10mb' }), async (req, res) => {
    const { csvData } = req.body;
    const cleanCsvData = (csvData || '').replace(/^\uFEFF/, '').trim();
    const lines = cleanCsvData.split(/\r?\n/);
    if (lines.length === 0 || !cleanCsvData) {
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
                        if (
                            normCat.includes('merev') ||
                            normCat.includes('felfujhato') ||
                            normCat.includes('39') ||
                            normCat.includes('40')
                        ) {
                            dist = '4km';
                        } else {
                            dist = '22km';
                        }
                    }

                    const category = mapCsvCategoryToSlug(rawCategory, dist);
                    let bib = await getNextBib(dist, category);

                    if (bib) {
                        let isDuplicate = false;
                        const { data: existing } = await supabase
                            .from('racers')
                            .select('id')
                            .eq('bib', bib)
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
                                if (
                                    mName.toLowerCase() === contactName.toLowerCase() &&
                                    rawOtp &&
                                    rawOtp.toLowerCase() !== 'x'
                                ) {
                                    mOtp = rawOtp.trim();
                                }
                                mOtp = normalizeOtprobaId(mOtp) || 'Nincs';

                                const mBirth = ''; // Új formátumban nincs születési dátum

                                membersToInsert.push({
                                    racer_id: '',
                                    name: mName,
                                    birth_date: mBirth,
                                    otproba_id: mOtp,
                                });

                                if (mOtp !== 'Nincs' && mOtp.length > 0 && mOtp.toLowerCase() !== 'csapatnev') {
                                    const duplicateMember = await findOtprobaDuplicate(mOtp);
                                    if (duplicateMember) {
                                        if (normalizeName(duplicateMember.name) !== normalizeName(mName)) {
                                            hasHardConflict = true;
                                            break;
                                        }
                                        isDuplicate = true;
                                    }
                                }

                                if (!isDuplicate && mName) {
                                    const hasDuplicate = await findNameBirthDuplicate(mName, mBirth);
                                    if (hasDuplicate) isDuplicate = true;
                                }
                            }
                        }

                        if (hasHardConflict || membersToInsert.length === 0) {
                            results.push({
                                added: 0,
                                duplicate: 0,
                                log: hasHardConflict
                                    ? `❌ Kihagyva (Ötpróba ID ütközés): ${membersToInsert.length > 0 ? membersToInsert[0].name : 'Ismeretlen'} - Az 5Próba azonosító egy másik névhez tartozik!`
                                    : null,
                            });
                            continue;
                        }

                        // Ellenőrizzük, hogy létezik-e már pontosan ugyanez a regisztráció a távon/kategóriában
                        const existingReg = await findExistingRacerRegistration(category, dist, membersToInsert);
                        if (existingReg) {
                            results.push({
                                added: 0,
                                duplicate: 0,
                                log: `❌ Kihagyva (Már létezik): ${membersToInsert[0].name}${membersToInsert.length > 1 ? ' és csapata' : ''} már regisztrálva van ezen a távon és kategóriában (Rajtszám: #${existingReg.bib}).`
                            });
                            continue;
                        }

                        const finalStatus = isDuplicate ? 'duplicate' : 'registered';
                        const racerId = Date.now().toString() + '_' + Math.floor(Math.random() * 1000);

                        membersToInsert.forEach(m => (m.racer_id = racerId));

                        const { error: rError } = await supabase.from('racers').insert({
                            id: racerId,
                            bib,
                            category,
                            distance: dist,
                            status: finalStatus,
                            email,
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
                                    log: isDuplicate
                                        ? `⚠️ Duplikáció: ${membersToInsert[0].name} (Egyezés egy már létező nevezéssel)`
                                        : null,
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
                    const dist = (fields[12] || '11km').replace(/\s+/g, '').toLowerCase();
                    const category = normalizeCategoryToSlug(fields[7], dist);
                    let bib = parseInt(fields[0]);
                    if (!bib) {
                        bib = await getNextBib(dist, category);
                    }

                    if (bib) {
                        let isDuplicate = false;
                        const { data: existing } = await supabase
                            .from('racers')
                            .select('id')
                            .eq('bib', bib)
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

                        for (let j = 0; j < 4; j++) {
                            if (fields[j + 1]) {
                                const mName = fields[j + 1].trim();
                                const mBirth = fields[j + 8] ? fields[j + 8].trim() : '';
                                let mOtp = fields[j + 13] ? fields[j + 13].trim() : '';
                                mOtp = normalizeOtprobaId(mOtp) || 'Nincs';

                                membersToInsert.push({
                                    racer_id: '',
                                    name: mName,
                                    birth_date: mBirth,
                                    otproba_id: mOtp,
                                });

                                if (
                                    mOtp.length > 0 &&
                                    mOtp.toLowerCase() !== 'nincs' &&
                                    mOtp.toLowerCase() !== 'csapatnev'
                                ) {
                                    const duplicateMember = await findOtprobaDuplicate(mOtp);
                                    if (duplicateMember) {
                                        if (normalizeName(duplicateMember.name) !== normalizeName(mName)) {
                                            hasHardConflict = true;
                                            break;
                                        }
                                        isDuplicate = true;
                                    }
                                }
                                if (!isDuplicate && mName && mBirth) {
                                    const hasDuplicate = await findNameBirthDuplicate(mName, mBirth);
                                    if (hasDuplicate) isDuplicate = true;
                                }
                            }
                        }

                        if (hasHardConflict || membersToInsert.length === 0) {
                            results.push({
                                added: 0,
                                duplicate: 0,
                                log: hasHardConflict
                                    ? `❌ Kihagyva (Ötpróba ID ütközés): ${membersToInsert.length > 0 ? membersToInsert[0].name : 'Ismeretlen'} - Az 5Próba azonosító egy másik névhez tartozik!`
                                    : null,
                            });
                            continue;
                        }

                        // Ellenőrizzük, hogy létezik-e már pontosan ugyanez a regisztráció a távon/kategóriában
                        const existingReg = await findExistingRacerRegistration(category, dist, membersToInsert);
                        if (existingReg) {
                            results.push({
                                added: 0,
                                duplicate: 0,
                                log: `❌ Kihagyva (Már létezik): ${membersToInsert[0].name}${membersToInsert.length > 1 ? ' és csapata' : ''} már regisztrálva van ezen a távon és kategóriában (Rajtszám: #${existingReg.bib}).`
                            });
                            continue;
                        }

                        const finalStatus = isDuplicate ? 'duplicate' : 'registered';
                        const racerId = Date.now().toString() + '_' + Math.floor(Math.random() * 1000);

                        membersToInsert.forEach(m => (m.racer_id = racerId));

                        const { error: rError } = await supabase.from('racers').insert({
                            id: racerId,
                            bib,
                            category,
                            distance: dist,
                            status: finalStatus,
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
                                    log: isDuplicate
                                        ? `⚠️ Duplikáció: ${membersToInsert[0].name} (Egyezés egy már létező nevezéssel)`
                                        : null,
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

// --- 13.5 AI SZOLGÁLTATÁSOK (AI SERVICES) ---
router.post('/ai/parse-roster', authenticateAdmin, async (req, res) => {
    const { base64Data, mimeType } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!base64Data || !mimeType) {
        return res.status(400).json({ error: 'Hiányzó kép adatok (base64Data vagy mimeType)!' });
    }

    // Ha nincs Gemini API key konfigurálva, egy szép bemutató szimulációt adunk vissza
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        console.warn('AI Roster Parser: Nincs GEMINI_API_KEY a környezeti változók között. Szimulációs mód fut.');
        
        // Szimuláljuk a feldolgozási időt a valósághű UX kedvéért
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const mockMembers = [
            { name: 'Szabó Gábor', birth_date: '1987-04-12', otproba_id: '874125' },
            { name: 'Kovács Anita', birth_date: '1991-08-25', otproba_id: 'Nincs' },
            { name: 'Németh Zoltán', birth_date: '1983-10-02', otproba_id: '831002' },
            { name: 'Kiss Borbála', birth_date: '1995-02-14', otproba_id: 'Nincs' }
        ];

        return res.json({
            success: true,
            simulated: true,
            members: mockMembers,
            message: 'Szimulált beolvasás sikeres! (A valódi működéshez add meg a GEMINI_API_KEY-t a .env-ben)'
        });
    }

    try {
        const fetchLib = await getFetch();
        const response = await fetchLib(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: 'Feladatod, hogy beolvasd ezt a sportverseny legénységi listát vagy csapatlistát ábrázoló képet/dokumentumot.\nKeresd meg a csapattagok nevét, születési idejét (ÉÉÉÉ-HH-NN formátumban) és opcionálisan az Ötpróba azonosítójukat (ha szerepel a képen).\nA válaszod kizárólag egy JSON tömb legyen, amely az alábbi formátumú objektumokat tartalmazza, egyéb magyarázó szöveg nélkül:\n[\n  {\n    "name": "Kovács István",\n    "birth_date": "1985-05-12",\n    "otproba_id": "123456" // Ha nincs megadva, vagy nem számjegy, akkor "Nincs"\n  }\n]'
                            },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Data
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: 'application/json'
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || 'Gemini API hiba');
        }

        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) {
            throw new Error('Üres válasz érkezett az AI modelltől.');
        }

        // Tisztítjuk és parszoljuk a JSON választ
        const cleanedText = textResponse.trim().replace(/^```json/, '').replace(/```$/, '').trim();
        const parsedMembers = JSON.parse(cleanedText);

        res.json({
            success: true,
            simulated: false,
            members: Array.isArray(parsedMembers) ? parsedMembers : [parsedMembers]
        });
    } catch (err) {
        console.error('AI Roster Parse hiba:', err);
        res.status(500).json({ error: 'Nem sikerült az AI-alapú beolvasás: ' + err.message });
    }
});

router.post('/remove-from-dragon-team', authenticateAdmin, async (req, res) => {
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

            const newRacerId = 'INDIV_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            newRacerIds.push(newRacerId);

            const { error: rError } = await supabase.from('racers').insert({
                id: newRacerId,
                bib: parseInt(bib),
                category: newCat,
                distance: newDist,
                status: 'registered',
            });
            if (rError) throw rError;

            const { error: mError } = await supabase
                .from('members')
                .update({ racer_id: newRacerId })
                .eq('id', member.id);
            if (mError) throw mError;

            processed++;
        }

        // Takarítás: töröljük azokat a régi rekordokat, amik kiürültek (már nincsenek tagjaik egyáltalán)
        oldRacerIds = [...new Set(oldRacerIds)];
        for (const oldId of oldRacerIds) {
            const { data: remMembers } = await supabase
                .from('members')
                .select('id')
                .eq('racer_id', oldId)
                .neq('otproba_id', 'CSAPATNEV')
                .limit(1);
            if (!remMembers || remMembers.length === 0) {
                await supabase.from('racers').delete().eq('id', oldId);
            }
        }

        res.json({ success: true, count: processed, newRacerIds });
    } catch (err) {
        console.error('[RemoveFromDragonTeam Error]', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/create-dragon-team', authenticateAdmin, async (req, res) => {
    let { memberIds, bib, name } = req.body;
    if (!bib && !name) return res.status(400).json({ error: 'Nincs megadva se csapatnév, se rajtszám!' });

    try {
        let oldRacerIds = [];
        if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
            // 1. Megszerezzük a kiválasztott tagok jelenlegi racer_id-it (későbbi takarításhoz)
            const { data: oldMembers, error: oldError } = await supabase
                .from('members')
                .select('racer_id')
                .in('id', memberIds);
            if (oldError) throw oldError;

            oldRacerIds = [...new Set((oldMembers || []).map(m => m.racer_id))].filter(id => id);
        }

        // 2. Megnézzük, létezik-e már a cél rajtszám vagy csapatnév
        let existingRacer = null;
        if (bib) {
            const { data } = await supabase
                .from('racers')
                .select('id, category, bib')
                .eq('bib', parseInt(bib))
                .maybeSingle();
            existingRacer = data;
        } else if (name) {
            const { data: teamMember } = await supabase
                .from('members')
                .select('racer_id')
                .ilike('name', name)
                .eq('otproba_id', 'CSAPATNEV')
                .maybeSingle();
            if (teamMember) {
                const { data } = await supabase
                    .from('racers')
                    .select('id, category, bib')
                    .eq('id', teamMember.racer_id)
                    .maybeSingle();
                existingRacer = data;
                if (existingRacer) bib = existingRacer.bib;
            }
        }

        let targetRacerId = existingRacer ? existingRacer.id : null;

        if (existingRacer) {
            console.log(`[CreateDragonTeam] Using existing racer: ${existingRacer.id} (Bib: ${bib})`);
            // Ha létezik, de nem sárkányhajó, akkor hiba
            if (!/s[aá]rk[aá]ny/i.test(existingRacer.category || '')) {
                return res
                    .status(400)
                    .json({ error: `A #${bib} rajtszám vagy csapat már foglalt egy másik kategóriában!` });
            }
            if (name) {
                const { data: dTags } = await supabase
                    .from('members')
                    .select('id')
                    .eq('racer_id', targetRacerId)
                    .eq('otproba_id', 'CSAPATNEV');
                if (dTags && dTags.length > 0) {
                    await supabase.from('members').update({ name: name }).eq('id', dTags[0].id);
                } else {
                    await supabase.from('members').insert({
                        racer_id: targetRacerId,
                        name: name,
                        birth_date: '1900-01-01',
                        otproba_id: 'CSAPATNEV',
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
            targetRacerId = 'DRAGON_' + Date.now();
            const { error: rError } = await supabase.from('racers').insert({
                id: targetRacerId,
                bib: parseInt(bib),
                category: 'sarkanyhajo_otproba',
                distance: '11km',
                status: 'registered',
            });
            if (rError) throw rError;

            if (name) {
                await supabase.from('members').insert({
                    racer_id: targetRacerId,
                    name: name,
                    birth_date: '1900-01-01',
                    otproba_id: 'CSAPATNEV',
                });
            }
        }

        // 3. Tagok behelyezése a cél egységbe
        if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
            const { error: mError } = await supabase
                .from('members')
                .update({ racer_id: targetRacerId })
                .in('id', memberIds);

            if (mError) throw mError;
        }

        // 4. Takarítás: töröljük azokat a régi rekordokat, amik kiürültek
        for (const oldId of oldRacerIds) {
            if (oldId === targetRacerId) continue;
            const { data: remMembers } = await supabase
                .from('members')
                .select('id')
                .eq('racer_id', oldId)
                .neq('otproba_id', 'CSAPATNEV')
                .limit(1);
            if (!remMembers || remMembers.length === 0) {
                // Ha nincs benne több tag, töröljük a racer rekordot is (kivéve ha épp oda mozgattunk)
                await supabase.from('racers').delete().eq('id', oldId);
            }
        }

        res.json({ success: true, racerId: targetRacerId, bib: bib });
    } catch (err) {
        console.error('[CreateDragonTeam Error]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
