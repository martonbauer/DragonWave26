/**
 * --- CATEGORY MERGE SERVICE ---
 * Kategória-összevonási konfigurációk olvasása és mentése.
 */

const path = require('path');
const fs = require('fs');
const supabase = require('../../database');

const CATEGORY_MERGES_FILE = path.join(process.cwd(), 'backend', 'data', 'category_merges.json');

async function getCategoryMerges() {
    try {
        if (fs.existsSync(CATEGORY_MERGES_FILE)) {
            const content = await fs.promises.readFile(CATEGORY_MERGES_FILE, 'utf8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.warn('Hiba a category_merges.json olvasásakor:', e.message);
    }
    // Fallback ha még a régebbi adatbázis rekordban lenne:
    try {
        const { data } = await supabase
            .from('racers')
            .select('email')
            .eq('id', 'SYSTEM_CATEGORY_MERGES')
            .maybeSingle();
        if (data && data.email) {
            return JSON.parse(data.email);
        }
    } catch {
        /* Ignore fallback error */
    }
    return {};
}

async function saveCategoryMerges(merges) {
    const dir = path.dirname(CATEGORY_MERGES_FILE);
    try {
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(CATEGORY_MERGES_FILE, JSON.stringify(merges, null, 2), 'utf8');
    } catch (e) {
        console.error('Hiba a category_merges mentésekor:', e.message);
    }
}

module.exports = {
    getCategoryMerges,
    saveCategoryMerges,
    CATEGORY_MERGES_FILE,
};
