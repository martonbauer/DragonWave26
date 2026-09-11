/**
 * --- DUPLICATE SERVICE ---
 * Versenyzői és tag-duplikációk kiszűrése (5Próba ID és Név+Születési dátum alapján).
 */

const supabase = require('../../database');
const { normalizeName, normalizeOtprobaId, makeLoosePattern } = require('../utils/stringHelper');

/**
 * Segédfunkció az 5Próba ID 6 számjegyes duplikációjának ellenőrzésére.
 */
async function findOtprobaDuplicate(otprobaId, currentRacerId = null) {
    if (!otprobaId) return null;
    const digits = normalizeOtprobaId(otprobaId);
    if (!digits || digits.length < 5) return null; // Rugalmasabb hossz-ellenőrzés (5-7 számjegy)

    let query = supabase.from('members').select('id, name, otproba_id, racer_id').ilike('otproba_id', `%${digits}%`);

    if (currentRacerId) {
        query = query.neq('racer_id', currentRacerId);
    }

    const { data: existingMembers, error } = await query;
    if (error) {
        console.error('Hiba a duplikáció ellenőrzésekor:', error);
        return null;
    }

    if (existingMembers && existingMembers.length > 0) {
        for (const m of existingMembers) {
            const mDigits = normalizeOtprobaId(m.otproba_id);
            if (mDigits === digits) {
                const { data: racerData } = await supabase
                    .from('racers')
                    .select('bib')
                    .eq('id', m.racer_id)
                    .maybeSingle();

                return {
                    id: m.id,
                    name: m.name,
                    otproba_id: m.otproba_id,
                    racer_id: m.racer_id,
                    racer_bib: racerData ? racerData.bib : null,
                };
            }
        }
    }
    return null;
}

/**
 * Segédfunkció név és születési dátum alapú duplikáció vizsgálatához laza normalizált kereséssel.
 */
async function findNameBirthDuplicate(name, birthDate, currentRacerId = null) {
    if (!name) return false;
    const targetNorm = normalizeName(name);
    const pattern = makeLoosePattern(name);
    if (!pattern) return false;

    let query = supabase.from('members').select('name, racer_id');

    if (birthDate !== undefined && birthDate !== null) {
        query = query.eq('birth_date', String(birthDate).trim());
    }

    query = query.ilike('name', pattern);

    if (currentRacerId) {
        query = query.neq('racer_id', currentRacerId);
    }

    const { data: candidates, error } = await query;
    if (error) {
        console.error('Hiba a név duplikáció ellenőrzésekor:', error);
        return false;
    }

    if (candidates && candidates.length > 0) {
        for (const candidate of candidates) {
            if (normalizeName(candidate.name) === targetNorm) {
                return true;
            }
        }
    }
    return false;
}

module.exports = {
    findOtprobaDuplicate,
    findNameBirthDuplicate,
};
