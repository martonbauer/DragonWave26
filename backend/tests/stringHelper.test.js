const { normalizeName, normalizeOtprobaId, makeLoosePattern } = require('../utils/stringHelper');

describe('stringHelper.js tests', () => {
    describe('normalizeName', () => {
        it('should handle basic names and casing', () => {
            expect(normalizeName('Kovács Péter')).toBe('kovacs peter');
            expect(normalizeName('kovács péter')).toBe('kovacs peter');
            expect(normalizeName('KOVÁCS PÉTER')).toBe('kovacs peter');
        });

        it('should handle leading/trailing/multiple spaces', () => {
            expect(normalizeName('   Kovács Péter   ')).toBe('kovacs peter');
            expect(normalizeName('Kovács    Péter')).toBe('kovacs peter');
        });

        it('should remove Hungarian accents correctly', () => {
            expect(normalizeName('Árvíztűrő Tükörfúrógép')).toBe('arvizturo tukorfurogep');
            expect(normalizeName('árvíztűrő tükörfúrógép')).toBe('arvizturo tukorfurogep');
        });

        it('should handle empty, null or undefined input', () => {
            expect(normalizeName('')).toBe('');
            expect(normalizeName(null)).toBe('');
            expect(normalizeName(undefined)).toBe('');
        });
    });

    describe('normalizeOtprobaId', () => {
        it('should extract correct digits and ignore 5p prefix', () => {
            expect(normalizeOtprobaId('5p123456')).toBe('123456');
            expect(normalizeOtprobaId('5P123456')).toBe('123456');
            expect(normalizeOtprobaId('5p-123456')).toBe('123456');
            expect(normalizeOtprobaId('5P 123456')).toBe('123456');
            expect(normalizeOtprobaId('5p  123456')).toBe('123456');
        });

        it('should ignore other Hungarian prefix variations', () => {
            expect(normalizeOtprobaId('5próba123456')).toBe('123456');
            expect(normalizeOtprobaId('ötpróba 123456')).toBe('123456');
            expect(normalizeOtprobaId('otproba-123456')).toBe('123456');
        });

        it('should handle raw numbers', () => {
            expect(normalizeOtprobaId('123456')).toBe('123456');
            expect(normalizeOtprobaId(987654)).toBe('987654');
        });

        it('should ignore special tags like nincs and csapatnev', () => {
            expect(normalizeOtprobaId('Nincs')).toBe('');
            expect(normalizeOtprobaId('nincs')).toBe('');
            expect(normalizeOtprobaId('csapatnev')).toBe('');
        });

        it('should handle empty/null inputs', () => {
            expect(normalizeOtprobaId('')).toBe('');
            expect(normalizeOtprobaId(null)).toBe('');
            expect(normalizeOtprobaId(undefined)).toBe('');
        });
    });

    describe('makeLoosePattern', () => {
        it('should generate correct wildcard pattern for SQL', () => {
            expect(makeLoosePattern('Kovács Péter')).toBe('k_v_cs%p_t_r');
            expect(makeLoosePattern('kovacs   peter')).toBe('k_v_cs%p_t_r');
        });

        it('should handle vowels substitution', () => {
            expect(makeLoosePattern('áéíóöőúüű')).toBe('_________');
        });
    });
});
