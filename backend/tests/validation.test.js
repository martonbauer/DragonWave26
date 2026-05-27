const { validateRacerData, normalizeCategoryToSlug } = require('../utils/validation');

describe('validation.js tests', () => {
    describe('validateRacerData', () => {
        it('should return null for valid data', () => {
            const data = {
                email: 'test@example.com',
                phone: '123456789',
                category: 'versenykajak_noi_1',
                distance: '11km',
                members: [{ name: 'John Doe', otproba_id: 'OT-123' }],
            };
            expect(validateRacerData(data)).toBeNull();
        });

        it('should return error if email is too long', () => {
            const data = {
                email: 'a'.repeat(151) + '@example.com',
                phone: '123456789',
            };
            expect(validateRacerData(data)).toBe('Az email cím túl hosszú!');
        });

        it('should return error if members count > 20', () => {
            const members = new Array(21).fill({ name: 'Test' });
            const data = { members };
            expect(validateRacerData(data)).toBe('Túl sok csapattag!');
        });

        it('should return error if a member name is too long', () => {
            const data = {
                members: [{ name: 'a'.repeat(101) }],
            };
            expect(validateRacerData(data)).toBe('A név túl hosszú (max 100 karakter)!');
        });
    });

    describe('normalizeCategoryToSlug', () => {
        it('should normalize known category names correctly', () => {
            expect(normalizeCategoryToSlug('Női versenykajak egyes')).toBe('versenykajak_noi_1');
            expect(normalizeCategoryToSlug('Férfi túrakajak 1')).toBe('turakajak_ferfi_1');
            expect(normalizeCategoryToSlug('Sárkányhajó')).toBe('sarkanyhajo_otproba');
            expect(normalizeCategoryToSlug('Sarkanyhajo')).toBe('sarkanyhajo_otproba');
        });

        it('should return original string if not matched', () => {
            expect(normalizeCategoryToSlug('Ismeretlen Kategória')).toBe('Ismeretlen Kategória');
        });

        it('should return empty string for empty input', () => {
            expect(normalizeCategoryToSlug('')).toBe('');
            expect(normalizeCategoryToSlug(null)).toBe('');
            expect(normalizeCategoryToSlug(undefined)).toBe('');
        });
    });
});
