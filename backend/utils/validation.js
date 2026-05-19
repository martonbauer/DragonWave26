/**
 * --- SEGÉDFUNKCIÓ RÉTEG (UTILITY LAYER) ---
 * Bemeneti adatok validálása, normalizálása és kategória-konstansok.
 */

/**
 * Versenyzői adatok validálása
 */
function validateRacerData(data) {
    const { members, email, phone, category, distance } = data;
    
    if (email && email.length > 150) return "Az email cím túl hosszú!";
    if (phone && phone.length > 30) return "A telefonszám túl hosszú!";
    if (category && category.length > 100) return "A kategória név túl hosszú!";
    if (distance && distance.length > 20) return "A táv megnevezése túl hosszú!";
    
    if (members && Array.isArray(members)) {
        if (members.length > 20) return "Túl sok csapattag!";
        for (const m of members) {
            if (m.name && m.name.length > 100) return "A név túl hosszú (max 100 karakter)!";
            if (m.otproba_id && m.otproba_id.length > 20) return "Az Ötpróba ID túl hosszú!";
        }
    }
    return null;
}

/**
 * CSV importáláshoz használt kategória leképezés (Slug MAP)
 */
const SLUG_MAP = [
    { keys: ['versenykajak','női'],                           slug: 'versenykajak_noi_1' },
    { keys: ['versenykajak','férfi'],                         slug: 'versenykajak_ferfi_1' },
    { keys: ['túrakajak','női','1'],                          slug: 'turakajak_noi_1' },
    { keys: ['túrakajak','férfi','1'],                        slug: 'turakajak_ferfi_1' },
    { keys: ['túrakajak','2'],                                slug: 'turakajak_2_nyitott' },
    { keys: ['tengeri','női'],                               slug: 'tengeri_kajak_noi_1' },
    { keys: ['tengeri','férfi'],                             slug: 'tengeri_kajak_ferfi_1' },
    { keys: ['surfski','női'],                               slug: 'surfski_noi' },
    { keys: ['surfski','férfi'],                             slug: 'surfski_ferfi' },
    { keys: ['kenu','1','nyitott'],                          slug: 'kenu_1_nyitott_11km' },
    { keys: ['kenu','2','nyitott'],                          slug: 'kenu_2_nyitott_11km' },
    { keys: ['kenu','3','nyitott'],                          slug: 'kenu_3_nyitott_11km' },
    { keys: ['kenu','4','nyitott'],                          slug: 'kenu_4_nyitott_11km' },
    { keys: ['kenu','női','1'],                              slug: 'kenu_noi_1' },
    { keys: ['kenu','férfi','1'],                            slug: 'kenu_ferfi_1' },
    { keys: ['kenu','2','férfi'],                            slug: 'kenu_2_ferfi' },
    { keys: ['kenu','2','vegyes'],                           slug: 'kenu_2_vegyes' },
    { keys: ['kenu','3'],                                    slug: 'kenu_3_nyitott' },
    { keys: ['kenu','4'],                                    slug: 'kenu_4_nyitott' },
    { keys: ['outrigger','női'],                            slug: 'outrigger_noi_1' },
    { keys: ['outrigger','férfi'],                          slug: 'outrigger_ferfi_1' },
    { keys: ['outrigger','2'],                               slug: 'outrigger_2_nyitott' },
    { keys: ['sup','női','merev','alatt'],                  slug: 'sup_noi_1_merev_39_alatt' },
    { keys: ['sup','női','merev'],                          slug: 'sup_noi_1_merev_39_felett' },
    { keys: ['sup','férfi','merev','alatt'],                slug: 'sup_ferfi_1_merev_39_alatt' },
    { keys: ['sup','férfi','merev'],                        slug: 'sup_ferfi_1_merev_39_felett' },
    { keys: ['sup','női','felfújható','alatt'],           slug: 'sup_noi_1_felfujhato_39_alatt' },
    { keys: ['sup','női','felfújható'],                   slug: 'sup_noi_1_felfujhato_39_felett' },
    { keys: ['sup','férfi','felfújható','alatt'],         slug: 'sup_ferfi_1_felfujhato_39_alatt' },
    { keys: ['sup','férfi','felfújható'],               slug: 'sup_ferfi_1_felfujhato_39_felett' },
    { keys: ['sárkányha'],                                  slug: 'sarkanyhajo_otproba' },
    { keys: ['sarkanyhaj'],                                  slug: 'sarkanyhajo_otproba' },
];

/**
 * Kategória név normalizálása slug formátumra
 */
function normalizeCategoryToSlug(categoryName) {
    if (!categoryName) return '';
    const n = categoryName.toLowerCase();
    const match = SLUG_MAP.find(e => e.keys.every(k => n.includes(k)));
    return match ? match.slug : categoryName;
}

/**
 * Kategória csoportok (a lekérdezésekhez)
 */
const CATEGORY_GROUPS = {
    KAJAK: [
        'versenykajak_noi_1', 'versenykajak_ferfi_1', 
        'turakajak_noi_1', 'turakajak_ferfi_1', 'turakajak_2_nyitott',
        'tengeri_kajak_noi_1', 'tengeri_kajak_ferfi_1',
        'surfski_noi', 'surfski_ferfi',
        'mk_1_fiu', 'mk_1_leany'
    ],
    KENU: [
        'kenu_1_nyitott_11km', 'kenu_2_nyitott_11km', 'kenu_3_nyitott_11km', 'kenu_4_nyitott_11km',
        'kenu_noi_1', 'kenu_ferfi_1', 
        'kenu_2_ferfi', 'kenu_2_vegyes', 'kenu_3_nyitott', 'kenu_4_nyitott',
        'outrigger_noi_1', 'outrigger_ferfi_1', 'outrigger_2_nyitott'
    ],
    SUP: [
        'sup_noi_1_merev_39_alatt', 'sup_noi_1_merev_39_felett',
        'sup_ferfi_1_merev_39_alatt', 'sup_ferfi_1_merev_39_felett',
        'sup_noi_1_felfujhato_39_alatt', 'sup_noi_1_felfujhato_39_felett',
        'sup_ferfi_1_felfujhato_39_alatt', 'sup_ferfi_1_felfujhato_39_felett',
        'sup_noi_1', 'sup_ferfi_1'
    ],
    SARKANYHAJO: ['sarkanyhajo_otproba']
};

module.exports = {
    validateRacerData,
    SLUG_MAP,
    CATEGORY_GROUPS,
    normalizeCategoryToSlug
};
