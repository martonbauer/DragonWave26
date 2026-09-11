/**
 * Segédfunkciók nevek és 5Próba azonosítók normalizálására és összehasonlítására.
 */

/**
 * Név normalizálása: kisbetűssé alakítás, magyar ékezetek eltávolítása, szóközök tisztítása.
 * @param {string} name 
 * @returns {string}
 */
function normalizeName(name) {
    if (!name) return '';
    return String(name)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Ékezetek eltávolítása
        .replace(/\s+/g, ' ')            // Dupla szóközök egy szóközre cserélése
        .trim();
}

/**
 * 5Próba azonosító normalizálása: előtagok eltávolítása és csak a számjegyek megtartása.
 * @param {string|number} id 
 * @returns {string}
 */
function normalizeOtprobaId(id) {
    if (!id) return '';
    let val = String(id).trim().toLowerCase();
    if (val === 'nincs' || val === 'csapatnev' || val === '') return '';

    // Eltávolítjuk a 5p, 5p-, ötpróba stb. előtagokat az elejéről
    val = val.replace(/^(5próba|5proba|ötpróba|otproba|5p)\s*[-_:/.]?\s*/gi, '');

    // Csak a számjegyeket tartjuk meg
    return val.replace(/\D/g, '');
}

/**
 * Laza keresési minta generálása SQL ILIKE kereséshez.
 * Lecseréli a magyar magánhangzókat '_' helyettesítő karakterre, a szóközöket pedig '%'-re.
 * @param {string} str 
 * @returns {string}
 */
function makeLoosePattern(str) {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .replace(/[aá]/g, '_')
        .replace(/[eéë]/g, '_')
        .replace(/[ií]/g, '_')
        .replace(/[oóöő]/g, '_')
        .replace(/[uúüű]/g, '_')
        .replace(/\s+/g, '%')
        .trim();
}

module.exports = {
    normalizeName,
    normalizeOtprobaId,
    makeLoosePattern
};
