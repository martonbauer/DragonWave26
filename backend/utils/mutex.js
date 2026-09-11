/**
 * --- MUTEX UTILITY ---
 * Egyszerű aszinkron Mutex a versenyhelyzetek (race conditions) elkerülésére.
 */

class SimpleMutex {
    constructor() {
        this.queue = [];
        this.locked = false;
    }
    async acquire() {
        if (!this.locked) {
            this.locked = true;
            return;
        }
        return new Promise(resolve => this.queue.push(resolve));
    }
    release() {
        if (this.queue.length > 0) {
            const resolve = this.queue.shift();
            resolve();
        } else {
            this.locked = false;
        }
    }
}

module.exports = { SimpleMutex };
