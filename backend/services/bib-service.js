/**
 * --- ÜZLETI LOGIKA RÉTEG (SERVICE LAYER) ---
 * Rajtszámkezelő szolgáltatás: a rajtszámok kiosztása a regisztráció sorrendjében történik (1-től indulva).
 */

const supabase = require('../../database');

/**
 * Következő szabad rajtszám lekérése a regisztráció sorrendjében (1-től indulva folyamatosan)
 */
async function getNextBib(_distance, _category) {
    const min = 1;

    // Lekérdezzük az összes már kiosztott valós rajtszámot (kivéve rendszerrekordokat mint 9999)
    const { data: results, error } = await supabase
        .from('racers')
        .select('bib')
        .gte('bib', min)
        .lt('bib', 9000);

    if (error) {
        console.error('Hiba a rajtszám lekérésekor:', error);
        throw error;
    }

    const usedBibs = new Set((results || []).map(r => r.bib));
    let bib = min;

    // Megkeressük a legelső szabad egész számot 1-től folyamatosan
    while (usedBibs.has(bib)) {
        bib++;
    }
    return bib;
}

module.exports = {
    getNextBib,
};
