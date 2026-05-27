/**
 * --- ADATBÁZIS RÉTEG (DATA LAYER) ---
 * Supabase kliens inicializálása és konfigurálása.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl === 'your_project_url' || supabaseKey === 'your_anon_public_key') {
    console.error('\x1b[31m%s\x1b[0m', 'HIBA: SUPABASE_URL vagy SUPABASE_KEY hiányzik vagy hibás a .env fájlban!');
    console.error(
        '\x1b[33m%s\x1b[0m',
        'Kérlek másold le a .env.example fájlt .env néven és töltsd ki a saját adataiddal!'
    );
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
