/**
 * --- EXCEL EXPORT MODULE (excel-export.js) ---
 * SheetJS alapú professzionális Excel (XLSX) exportálás kategóriánkénti,
 * szűrt és 5Próba formátumokban.
 */

import { showToast, formatTime, formatRacerName } from '../ui-utils.js';

/**
 * Eredmények exportálása Excel fájlba - Kategóriánként külön munkalapokra, távolság szerinti sorrendben
 */
export function exportResultsToExcel() {
    const rm = window.raceManager;
    if (!rm || !rm.data.racers || rm.data.racers.length === 0) {
        showToast('Nincs menthető adat!', 'error');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showToast('XLSX könyvtár nem található!', 'error');
        return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Munkalapok létrehozása kategóriánként, Távolság szerinti sorrendben (11km, 22km, 4km)
    const distancePriority = ['11km', '22km', '4km'];

    distancePriority.forEach(distId => {
        const categoriesInDist = [
            ...new Set(
                rm.data.racers
                    .filter(r => r.distance === distId && !/s[aá]rk[aá]ny/i.test(r.category || ''))
                    .map(r => r.category)
            ),
        ].sort();

        categoriesInDist.forEach(catId => {
            const finishers = rm.data.racers.filter(r => r.category === catId && r.distance === distId);
            if (finishers.length === 0) return;

            const sorted = finishers.sort((a, b) => {
                if (a.status === 'finished' && b.status !== 'finished') return -1;
                if (a.status !== 'finished' && b.status === 'finished') return 1;
                if (a.status === 'finished' && b.status === 'finished')
                    return (a.total_time || 0) - (b.total_time || 0);
                return (a.bib || 0) - (b.bib || 0);
            });

            const rows = [[`KATEGÓRIA EREDMÉNYEK: ${rm.formatCategoryName(catId)} (${distId})`]];
            rows.push(['Helyezés', 'Rajtszám', 'Név (Csapattagok)', 'Ötpróba ID-k', 'Táv', 'Státusz', 'Időeredmény']);

            let rank = 1;
            sorted.forEach(r => {
                rows.push([
                    r.status === 'finished' ? rank++ : '-',
                    r.bib,
                    formatRacerName(r),
                    r.members
                        ? r.members
                              .filter(m => m.otproba_id !== 'CSAPATNEV')
                              .map(m => m.otproba_id || '')
                              .filter(id => id)
                              .join(', ')
                        : r.otproba_id || '-',
                    r.distance,
                    r.status,
                    r.status === 'finished'
                        ? formatTime(r.total_time)
                        : r.status === 'running'
                          ? 'Folyamatban'
                          : 'Nem indult / DNS',
                ]);
            });

            const cleanCatName = rm.formatCategoryName(catId).replace(/[/\\?*[\]]/g, '_');
            const sheetName = `${cleanCatName.substring(0, 24)}_${distId}`;

            let finalSheetName = sheetName;
            let counter = 1;
            while (wb.SheetNames.includes(finalSheetName)) {
                finalSheetName = `${sheetName.substring(0, 20)}_${counter++}`;
            }

            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), finalSheetName);
        });
    });

    // 2. Sárkányhajó kategóriák külön lapokra
    const sarkanyRacers = rm.data.racers.filter(r => /s[aá]rk[aá]ny/i.test(r.category || ''));
    const sarkanyTeams = [...new Set(sarkanyRacers.map(r => r.category))];

    sarkanyTeams.forEach(sCat => {
        const sFinishers = sarkanyRacers.filter(r => r.category === sCat);
        if (sFinishers.length === 0) return;

        const sortedS = sFinishers.sort((a, b) => {
            if (a.status === 'finished' && b.status !== 'finished') return -1;
            if (a.status !== 'finished' && b.status === 'finished') return 1;
            if (a.status === 'finished' && b.status === 'finished')
                return (a.total_time || 0) - (b.total_time || 0);
            return (a.bib || 0) - (b.bib || 0);
        });

        const sRows = [[`SÁRKÁNYHAJÓ EREDMÉNYEK: ${rm.formatCategoryName(sCat)}`]];
        sRows.push(['Helyezés', 'Rajtszám', 'Csapatnév (Legénység)', 'Táv', 'Státusz', 'Időeredmény']);

        let sRank = 1;
        sortedS.forEach(r => {
            sRows.push([
                r.status === 'finished' ? sRank++ : '-',
                r.bib,
                formatRacerName(r),
                r.distance,
                r.status,
                r.status === 'finished'
                    ? formatTime(r.total_time)
                    : r.status === 'running'
                      ? 'Folyamatban'
                      : 'Nem indult',
            ]);
        });

        const rawSarkanyName = rm.formatCategoryName(sCat).replace(/[/\\?*[\]]/g, '_');
        let finalSName = ('S_Hajó_' + rawSarkanyName).substring(0, 31);
        let sCounter = 1;
        while (wb.SheetNames.includes(finalSName)) {
            finalSName = ('S_Hajó_' + rawSarkanyName).substring(0, 27) + `_${sCounter++}`;
        }

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sRows), finalSName);
    });

    XLSX.writeFile(wb, `DunakesziFutam_Eredmenyek_Kategoriankent_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Excel sikeresen exportálva kategóriánkénti munkalapokkal!', 'success');
}

/**
 * Szűrt lista exportálása Excelbe
 */
export function exportFilteredTableToExcel(filterType, specificCatId = null) {
    const rm = window.raceManager;
    if (!rm || !rm.data.racers || rm.data.racers.length === 0) {
        showToast('Nincs menthető adat!', 'error');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showToast('XLSX könyvtár nem található!', 'error');
        return;
    }

    let racers = [...rm.data.racers].filter(r => r && r.status);
    let titlePrefix = 'Szurt_Lista';

    if (specificCatId) {
        racers = racers.filter(r => r.category === specificCatId && r.distance === filterType);
        titlePrefix = `${rm.formatCategoryName(specificCatId)}_${filterType}`;
    } else {
        if (filterType === '22km') {
            racers = racers.filter(r => r.distance === '22km');
            titlePrefix = '22km_Nevezettek';
        } else if (filterType === '11km') {
            racers = racers.filter(r => r.distance === '11km' && !/s[aá]rk[aá]ny/i.test(r.category || ''));
            titlePrefix = '11km_Nevezettek';
        } else if (filterType === '4km') {
            racers = racers.filter(r => r.distance === '4km');
            titlePrefix = '4km_Nevezettek';
        } else if (filterType === 'sarkany') {
            racers = racers.filter(r => /s[aá]rk[aá]ny/i.test(r.category || ''));
            titlePrefix = 'Sarkanyhajo_Nevezettek';
        }
    }

    const wb = XLSX.utils.book_new();
    const rows = [
        [
            'Rajtszám',
            'Név (Egység tagjai)',
            'Születési dátumok',
            'Ötpróba ID-k',
            'Kategória',
            'Táv',
            'Sorozat',
            'Státusz',
            'Időeredmény',
        ],
    ];

    racers.forEach(r => {
        rows.push([
            r.bib,
            formatRacerName(r),
            r.members
                ? r.members
                      .filter(m => m.otproba_id !== 'CSAPATNEV')
                      .map(m => m.birth_date || '')
                      .filter(d => d)
                      .join(', ')
                : '-',
            r.members
                ? r.members
                      .filter(m => m.otproba_id !== 'CSAPATNEV')
                      .map(m => m.otproba_id || '')
                      .filter(id => id)
                      .join(', ')
                : r.otproba_id || '-',
            rm.formatCategoryName(r.category),
            r.distance,
            r.is_series ? 'Igen' : 'Nem',
            r.status,
            r.status === 'finished'
                ? formatTime(r.total_time)
                : r.status === 'running'
                  ? 'Folyamatban'
                  : 'Regisztrálva',
        ]);
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Nevezettek');
    XLSX.writeFile(wb, `${titlePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Szűrt Excel sikeresen exportálva!', 'success');
}

/**
 * 5Próba igazolási lista exportálása Excelbe
 */
export function exportOtprobaExcel() {
    const rm = window.raceManager;
    if (!rm || !rm.data.racers || rm.data.racers.length === 0) {
        showToast('Nincs menthető adat!', 'error');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showToast('XLSX könyvtár nem található!', 'error');
        return;
    }

    const racers = rm.data.racers || [];
    const otprobaList = [];

    const cleanOtprobaId = val => {
        if (val === undefined || val === null) return null;
        const s = String(val).trim();
        if (s.toLowerCase() === 'nincs' || s.toLowerCase() === 'csapatnev' || s === '') return null;

        const match = s.match(/^(?:5[Pp]|S[Pp])?[-#\s]*(\d+)[.\s]*$/);
        if (match) {
            return match[1];
        }
        return null;
    };

    racers.forEach(r => {
        if (!r.members || r.members.length === 0) {
            const cleanId = cleanOtprobaId(r.otproba_id);
            if (cleanId) {
                otprobaList.push({
                    bib: r.bib,
                    name: r.name || 'Névtelen',
                    otproba_id: cleanId,
                    category: r.category,
                    distance: r.distance,
                    status: r.status || 'registered',
                    total_time: r.total_time,
                });
            }
        } else {
            r.members.forEach(m => {
                const cleanId = cleanOtprobaId(m.otproba_id);
                if (cleanId) {
                    otprobaList.push({
                        bib: r.bib,
                        name: m.name || 'Névtelen',
                        otproba_id: cleanId,
                        category: r.category,
                        distance: r.distance,
                        status: r.status || 'registered',
                        total_time: r.total_time,
                    });
                }
            });
        }
    });

    if (otprobaList.length === 0) {
        showToast('Nincs 5Próbás versenyző az exportáláshoz!', 'error');
        return;
    }

    otprobaList.sort((a, b) => {
        const bibDiff = (a.bib || 0) - (b.bib || 0);
        if (bibDiff !== 0) return bibDiff;
        return (a.name || '').localeCompare(b.name || '');
    });

    const wb = XLSX.utils.book_new();
    const rows = [['Rajtszám', 'Név', '5Próba Azonosító', 'Kategória', 'Táv', 'Státusz', 'Eredmény']];

    otprobaList.forEach(item => {
        const status = item.status || 'registered';
        const timeStr =
            status === 'finished'
                ? formatTime(item.total_time || 0)
                : status === 'running'
                  ? 'Futamban'
                  : 'Regisztrálva';
        rows.push([
            item.bib ? `#${String(item.bib).padStart(3, '0')}` : '-',
            item.name,
            `5P${item.otproba_id}`,
            rm.formatCategoryName(item.category),
            item.distance || '-',
            status.toUpperCase(),
            timeStr,
        ]);
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), '5Próba Nevezettek');
    XLSX.writeFile(wb, `5Proba_Nevezettek_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('5Próba Excel sikeresen exportálva!', 'success');
}
