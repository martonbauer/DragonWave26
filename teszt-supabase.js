/**
 * DragonWave 2026 - Supabase Kapcsolat Ellenőrző Teszt
 * Futtatás: node teszt-supabase.js
 */

const supabase = require('./database');

async function testConnection() {
    console.log("=== SUPABASE KAPCSOLAT TESZTELÉSE ===");
    try {
        const { data, error } = await supabase
            .from('racers')
            .select('id, bib, status')
            .limit(5);

        if (error) {
            console.error("❌ Hiba történt a lekérdezés során:");
            console.error(error.message);
            process.exit(1);
        }

        console.log("✅ Sikeres kapcsolat a Supabase-hez!");
        console.log(`Kiolvasott versenyzők száma (max 5): ${data.length}`);
        console.log("Adatok:", data);
        
    } catch (err) {
        console.error("❌ Kritikus hiba a teszt futtatásakor:");
        console.error(err.message);
        process.exit(1);
    }
}

testConnection();
