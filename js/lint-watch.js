const { execSync } = require('child_process');

console.clear();
console.log('\x1b[36m%s\x1b[0m', '--- 🔄 Automatikus kódellenőrzés aktív (Linter Watch)... ---');
console.log('\x1b[90m%s\x1b[0m', 'Figyelt fájlok: server.js, database.js, dragon.js, js/*\n');

try {
    execSync('npm run lint', { stdio: 'inherit' });
    console.log('\n\x1b[32m%s\x1b[0m', '✅ SIKER: Nincs hiba a kódban!');
} catch {
    console.log('\n\x1b[31m%s\x1b[0m', '❌ HIBA: Javítsd a fenti linting hibákat!');
}
