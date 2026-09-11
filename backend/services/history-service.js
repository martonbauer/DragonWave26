/**
 * --- HISTORY SERVICE ---
 * Helyi fájlrendszerbeli előzmények (rajtszámok és kiosztatlan idők) perzisztálása.
 */

const path = require('path');
const fs = require('fs');

const HISTORY_FILE = path.join(process.cwd(), 'history', 'bib_history.json');
const UNASSIGNED_FILE = path.join(process.cwd(), 'history', 'unassigned_times.json');

async function ensureHistoryDir() {
    const dir = path.dirname(HISTORY_FILE);
    try {
        await fs.promises.mkdir(dir, { recursive: true });
    } catch {
        /* Ignore if already exists */
    }
    try {
        await fs.promises.access(HISTORY_FILE);
    } catch {
        await fs.promises.writeFile(HISTORY_FILE, JSON.stringify([]));
    }
    try {
        await fs.promises.access(UNASSIGNED_FILE);
    } catch {
        await fs.promises.writeFile(UNASSIGNED_FILE, JSON.stringify([]));
    }
}

async function getUnassignedTimes() {
    await ensureHistoryDir();
    try {
        const data = await fs.promises.readFile(UNASSIGNED_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function saveUnassignedTimes(times) {
    await ensureHistoryDir();
    await fs.promises.writeFile(UNASSIGNED_FILE, JSON.stringify(times, null, 2));
}

async function getBibHistory() {
    await ensureHistoryDir();
    try {
        const data = await fs.promises.readFile(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function addBibHistoryEntry(entry) {
    const history = await getBibHistory();
    history.unshift({ id: Date.now(), timestamp: new Date().toISOString(), ...entry });
    await ensureHistoryDir();
    await fs.promises.writeFile(HISTORY_FILE, JSON.stringify(history.slice(0, 100), null, 2));
}

module.exports = {
    ensureHistoryDir,
    getUnassignedTimes,
    saveUnassignedTimes,
    getBibHistory,
    addBibHistoryEntry,
    HISTORY_FILE,
    UNASSIGNED_FILE,
};
