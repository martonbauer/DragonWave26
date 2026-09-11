/**
 * --- SOCKET HELPER UTILITY ---
 * Valós idejű WebSocket kommunikáció és eseményküldés a kliensek felé.
 */

let ioInstance = null;

function setIo(io) {
    ioInstance = io;
}

function getIo() {
    return ioInstance;
}

function emitUpdate(action, payload = {}) {
    if (ioInstance) {
        ioInstance.emit(action, payload);
    }
}

function emitRefresh() {
    if (ioInstance) {
        ioInstance.emit('dataUpdated', { action: 'refresh' });
    }
}

module.exports = {
    setIo,
    getIo,
    emitUpdate,
    emitRefresh,
};
