const { findActiveTimerForRacer } = require('../services/batch-service');

describe('batch-service findActiveTimerForRacer', () => {
    it('returns null if no racer or timers', () => {
        expect(findActiveTimerForRacer(null, [])).toBeNull();
        expect(findActiveTimerForRacer({ category: 'kajak_ferfi_1', distance: '11km' }, [])).toBeNull();
    });

    it('matches exact category and distance timer', () => {
        const racer = { category: 'turakajak_ferfi_1', distance: '11km' };
        const timers = [
            { key: 'turakajak_ferfi_1_11km', start_time: 1000 },
            { key: 'MASS_START_ALL', start_time: 500 },
        ];
        const matched = findActiveTimerForRacer(racer, timers);
        expect(matched).toBeDefined();
        expect(matched.start_time).toBe(1000);
    });

    it('matches distance timer if exact category timer is absent', () => {
        const racer = { category: 'turakajak_ferfi_1', distance: '22km' };
        const timers = [
            { key: 'DISTANCE_22km', start_time: 2000 },
            { key: 'DISTANCE_11km', start_time: 1500 },
        ];
        const matched = findActiveTimerForRacer(racer, timers);
        expect(matched).toBeDefined();
        expect(matched.key).toBe('DISTANCE_22km');
        expect(matched.start_time).toBe(2000);
    });

    it('matches mass start timer as fallback', () => {
        const racer = { category: 'sup_noi_1', distance: '4km' };
        const timers = [
            { key: 'MASS_START_ALL', start_time: 3000 },
        ];
        const matched = findActiveTimerForRacer(racer, timers);
        expect(matched).toBeDefined();
        expect(matched.start_time).toBe(3000);
    });

    it('matches predefined category group timers', () => {
        const racer = { category: 'versenykajak_ferfi_1', distance: '22km' };
        const timers = [
            { key: 'kajak_hosszu', start_time: 4000 },
        ];
        const matched = findActiveTimerForRacer(racer, timers);
        expect(matched).toBeDefined();
        expect(matched.start_time).toBe(4000);
    });
});
