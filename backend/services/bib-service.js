/**
 * --- ÜZLETI LOGIKA RÉTEG (SERVICE LAYER) ---
 * Rajtszámkezelő szolgáltatás és logika (folyamatosan 101-től).
 */

const supabase = require('../../database');

/**
 * Következő szabad rajtszám lekérése (folyamatosan 101-től)
 */
async function getNextBib(_distance, _category) {
    const min = 101;

    // Lekérdezzük az összes már kiosztott rajtszámot, ami >= 101
    const { data: results, error } = await supabase.from('racers').select('bib').gte('bib', min);

    if (error) {
        console.error('Hiba a rajtszám lekérésekor:', error);
        throw error;
    }

    const usedBibs = (results || []).map(r => r.bib);
    let bib = min;

    // Megkeressük a legelső szabad egész számot
    while (usedBibs.includes(bib)) {
        bib++;
    }
    return bib;
}

module.exports = {
    getNextBib,
};
