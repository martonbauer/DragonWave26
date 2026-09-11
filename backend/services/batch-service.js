/**
 * --- ÜZLETI LOGIKA RÉTEG (SERVICE LAYER) ---
 * Futam (batch) kezelő szolgáltatás és csoportosítási logika.
 */

const supabase = require('../../database');

// Segédfunkciók importálása
const { CATEGORY_GROUPS } = require('../utils/validation');

/**
 * Lekérdezés építő segédfunkció csoportos hívásokhoz (tömegrajt, táv rajt, előre definiált csoportok)
 */
function getGroupQuery(query, batchKey) {
    console.log(`[getGroupQuery] batchKey: ${batchKey}`);

    // 1. Tömegrajt
    if (batchKey === 'MASS_START_ALL') return query;

    // 2. Távolság Rajt
    if (batchKey.startsWith('DISTANCE_')) {
        const dist = batchKey.split('_')[1];
        return query.eq('distance', dist);
    }

    // 3. Előre definiált csoportok (Slug alapú szűrés)
    if (batchKey === 'kajak_hosszu') return query.in('category', CATEGORY_GROUPS.KAJAK).eq('distance', '22km');
    if (batchKey === 'kajak_rovid') return query.in('category', CATEGORY_GROUPS.KAJAK).eq('distance', '11km');
    if (batchKey === 'kenu_hosszu') {
        const kenuHosszuCategories = [...CATEGORY_GROUPS.KENU, 'sup_noi_1', 'sup_ferfi_1'];
        return query.in('category', kenuHosszuCategories).eq('distance', '22km');
    }
    if (batchKey === 'kenu_rovid') {
        const kenuRovidCategories = [
            ...CATEGORY_GROUPS.KENU,
            'sup_ferfi_1_merev',
            'sup_noi_1_merev',
            'sup_ferfi_1_felfujhato',
            'sup_noi_1_felfujhato',
        ];
        return query.in('category', kenuRovidCategories).eq('distance', '11km');
    }
    if (batchKey === 'sup_4km') return query.in('category', CATEGORY_GROUPS.SUP).eq('distance', '4km');
    if (batchKey === 'sarkanyhajo_11km')
        return query.in('category', CATEGORY_GROUPS.SARKANYHAJO).eq('distance', '11km');

    // 4. Egyéni kategória/távolság páros
    if (batchKey.includes('_')) {
        const parts = batchKey.split('_');
        const distance = parts.pop();
        const categorySlug = parts.join('_');
        return query.eq('category', categorySlug).eq('distance', distance);
    }

    console.warn(`[getGroupQuery] Nincs egyező csoport a batchKey-re: ${batchKey}`);
    return query;
}

/**
 * Automatikus futamleállítás ellenőrzése
 */
async function checkAndStopEmptyBatchTimers() {
    try {
        const { data: activeTimers, error: tError } = await supabase.from('categories').select('*');
        if (tError) throw tError;
        if (!activeTimers || activeTimers.length === 0) return;

        await Promise.all(
            activeTimers.map(async timer => {
                const batchKey = timer.key;
                let query = supabase.from('racers').select('id, status', { count: 'exact' });
                query = getGroupQuery(query, batchKey);

                const { data: participants, error: qError } = await query;
                if (qError) return null;

                const runningCount = (participants || []).filter(p => p.status === 'running').length;
                const registeredCount = (participants || []).filter(p => p.status === 'registered').length;
                const finishedCount = (participants || []).filter(p => p.status === 'finished').length;

                if (runningCount === 0 && registeredCount === 0 && finishedCount > 0) {
                    console.log(`[AUTO-STOP] >>> LEÁLLÍTÁS: ${batchKey} (mindenki beért).`);
                    return supabase.from('categories').delete().eq('key', batchKey);
                }
                return null;
            })
        );
    } catch (err) {
        console.error('[TimerCheck] Kritikus hiba:', err);
    }
}

/**
 * Megkeresi a versenyzőhöz tartozó aktív rajtórát (ha van ilyen)
 */
function findActiveTimerForRacer(racer, activeTimers) {
    if (!racer || !activeTimers || activeTimers.length === 0) return null;

    // 1. Pontos kategória + távolság páros
    const catKey = `${racer.category}_${racer.distance}`;
    const directTimer = activeTimers.find(t => t.key === catKey);
    if (directTimer) return directTimer;

    // 2. Távolság rajt (pl. DISTANCE_22km)
    const distTimer = activeTimers.find(t => t.key === `DISTANCE_${racer.distance}`);
    if (distTimer) return distTimer;

    // 3. Tömegrajt (mindenki)
    const massTimer = activeTimers.find(t => t.key === 'MASS_START_ALL');
    if (massTimer) return massTimer;

    // 4. Előre definiált csoportok
    for (const t of activeTimers) {
        if (t.key === 'kajak_hosszu' && racer.distance === '22km' && CATEGORY_GROUPS.KAJAK && CATEGORY_GROUPS.KAJAK.includes(racer.category)) return t;
        if (t.key === 'kajak_rovid' && racer.distance === '11km' && CATEGORY_GROUPS.KAJAK && CATEGORY_GROUPS.KAJAK.includes(racer.category)) return t;
        if (t.key === 'kenu_hosszu' && racer.distance === '22km' && ([...(CATEGORY_GROUPS.KENU || []), 'sup_noi_1', 'sup_ferfi_1'].includes(racer.category))) return t;
        if (t.key === 'kenu_rovid' && racer.distance === '11km' && ([...(CATEGORY_GROUPS.KENU || []), 'sup_ferfi_1_merev', 'sup_noi_1_merev', 'sup_ferfi_1_felfujhato', 'sup_noi_1_felfujhato'].includes(racer.category))) return t;
        if (t.key === 'sup_4km' && racer.distance === '4km' && CATEGORY_GROUPS.SUP && CATEGORY_GROUPS.SUP.includes(racer.category)) return t;
        if (t.key === 'sarkanyhajo_11km' && racer.distance === '11km' && CATEGORY_GROUPS.SARKANYHAJO && CATEGORY_GROUPS.SARKANYHAJO.includes(racer.category)) return t;
    }

    return null;
}

module.exports = {
    getGroupQuery,
    checkAndStopEmptyBatchTimers,
    findActiveTimerForRacer,
};

