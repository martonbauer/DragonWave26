import { showToast, showConfirmModal, formatTime, formatMemberListHtml, formatRacerName, formatOtprobaListHtml } from './ui-utils.js';
import { API_URL } from './api.js';

/**
 * --- ADMINISZTRÁCIÓS FELÜLET RÉTEG (ADMIN UI LAYER) ---
 * Az adminisztrátori felület specifikus megjelenítési logikája, 
 * táblázatok és vezérlőgombok kezelése.
 */

/**
 * Adminisztrátori versenyzői táblázat kirajzolása
 */
let chartDistances = null;
let chartStatus = null;

export function renderAdminCharts() {
    const rm = window.raceManager;
    if (!rm || !rm.data.racers) return;

    const ctxDist = document.getElementById('chart-distances');
    const ctxStat = document.getElementById('chart-status');
    
    if (!ctxDist || !ctxStat || typeof Chart === 'undefined') return;

    const racers = rm.data.racers;
    
    const distCount = { '22km': 0, '11km': 0, '4km': 0 };
    racers.forEach(r => { if(distCount[r.distance] !== undefined) distCount[r.distance]++; });
    
    const distData = {
        labels: ['22km Hosszú', '11km Rövid', '4km SUP'],
        datasets: [{
            data: [distCount['22km'], distCount['11km'], distCount['4km']],
            backgroundColor: ['#00A3FF', '#FF4D4D', '#00FFCC'],
            borderWidth: 0
        }]
    };

    const statCount = { 'registered': 0, 'running': 0, 'finished': 0 };
    racers.forEach(r => { if(statCount[r.status] !== undefined) statCount[r.status]++; });

    const statData = {
        labels: ['Regisztrált (Vár)', 'Futó (Pályán)', 'Befutott'],
        datasets: [{
            data: [statCount['registered'], statCount['running'], statCount['finished']],
            backgroundColor: ['#555555', '#00A3FF', '#00FFCC'],
            borderWidth: 0
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { color: 'white' } }
        }
    };

    if (chartDistances) {
        chartDistances.data = distData; chartDistances.update();
    } else {
        chartDistances = new Chart(ctxDist, { type: 'doughnut', data: distData, options: chartOptions });
    }

    if (chartStatus) {
        chartStatus.data = statData; chartStatus.update();
    } else {
        chartStatus = new Chart(ctxStat, { type: 'pie', data: statData, options: chartOptions });
    }
}
window.renderAdminCharts = renderAdminCharts;

export function renderAdminTable(filterType = 'all') {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!window.raceManager || !window.raceManager.data.racers || window.raceManager.data.racers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nincs rögzített adat</td></tr>';
        return;
    }

    let racers = [...window.raceManager.data.racers].filter(r => r && r.status);

    // Alkalmazzuk a szűrőt
    if (filterType === '22km') {
        racers = racers.filter(r => r.distance === '22km');
    } else if (filterType === '11km') {
        // 11km-esek, kivéve a sárkányhajó kategóriát
        racers = racers.filter(r => r.distance === '11km' && !(/s[aá]rk[aá]ny/i.test(r.category || '')));
    } else if (filterType === '4km') {
        racers = racers.filter(r => r.distance === '4km');
    } else if (filterType === 'sarkany') {
        racers = racers.filter(r => /s[aá]rk[aá]ny/i.test(r.category || ''));
    } else if (filterType === 'running') {
        racers = racers.filter(r => r.status === 'running');
    }

    // Keresési szűrő alkalmazása
    if (window.adminSearchQuery) {
        const query = window.adminSearchQuery.toLowerCase();
        racers = racers.filter(r => {
            const nameMatch = formatRacerName(r).toLowerCase().includes(query);
            const bibMatch = r.bib && r.bib.toString().includes(query);
            const catMatch = r.category && window.raceManager.formatCategoryName(r.category).toLowerCase().includes(query);
            return nameMatch || bibMatch || catMatch;
        });
    }

    if (racers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nincs a szűrésnek megfelelő adat</td></tr>';
        return;
    }

    let displayRacers = [];
    racers.forEach(r => {
        if (/s[aá]rk[aá]ny/i.test(r.category || '')) {
            const realMembers = (r.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
            if (realMembers.length > 0) {
                realMembers.forEach(m => {
                    displayRacers.push({
                        ...r,
                        members: [m],
                        team_size_was_larger: true
                    });
                });
            } else {
                displayRacers.push(r);
            }
        } else {
            displayRacers.push(r);
        }
    });

    displayRacers.sort((a, b) => (a.bib || 0) - (b.bib || 0)).forEach(r => {
        const tr = document.createElement('tr');
        let statusColor = "white";
        let dataStartAttr = "";

        if (r.status === 'running') {
            statusColor = 'var(--accent-primary)';
            tr.className = "status-running";
            dataStartAttr = `data-start="${r.start_time || 0}"`;
        } else if (r.status === 'finished') {
            statusColor = '#00FFCC';
        } else if (r.status === 'duplicate') {
            statusColor = '#FFA500'; // Narancs
            tr.style.background = 'rgba(255, 165, 0, 0.15)';
        }

        let timeStr = "00:00:00.000";
        if (r.status === 'running') {
            timeStr = formatTime(Date.now() + (window.raceManager.serverTimeOffset || 0) - (r.start_time || 0));
        } else if (r.status === 'finished') {
            timeStr = formatTime(r.total_time || 0);
        }

        const memberList = formatMemberListHtml(r);
        const otprobaList = formatOtprobaListHtml(r);
        
        const isChecked = !!r.checked_in;
        const isPaid = !!r.is_paid;
        
        const checkInHtml = `<input type="checkbox" style="transform: scale(1.5)" ${isChecked ? 'checked' : ''} onchange="window.raceManager.updateRacerStatus('${r.id}', 'checked_in', this.checked).then(res => { if(res) { window.raceManager.renderWaitingListCards(); window.raceManager.renderRunningListCards(); } })">`;
        const paidHtml = isPaid ? 
            `<span style="background:#5BB226; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold; cursor:pointer;" onclick="if(confirm('Mégis visszaállítod fizetetlenre?')) window.raceManager.updateRacerStatus('${r.id}', 'is_paid', false).then(() => renderAdminTable(window.currentTableFilter))">Befizetve</span>` : 
            `<button onclick="window.raceManager.updateRacerStatus('${r.id}', 'is_paid', true).then(() => renderAdminTable(window.currentTableFilter))" class="action-btn" style="background:transparent; border:1px solid #5BB226; color:#5BB226; padding:2px 8px; font-size:0.8rem;">Függőben</button>`;

        tr.innerHTML = `
            <td data-label="Rajtszám"><strong>#${(r.bib || 0).toString().padStart(3, '0')}</strong></td>
            <td data-label="Egység Tagjai">${memberList}</td>
            <td data-label="Ötpróba ID">${otprobaList}</td>
            <td data-label="Kategória">${window.raceManager.formatCategoryName(r.category)}</td>
            <td data-label="Táv" style="font-weight: bold;">${r.distance || '-'}</td>
            <td data-label="Státusz" style="color:${statusColor}">${(r.status || 'registered').toUpperCase()} ${r.status === 'duplicate' ? '⚠️' : ''}</td>
            <td data-label="Időeredmény" class="time" ${dataStartAttr}>${timeStr}</td>
            <td data-label="Megjelent" style="text-align:center;">${checkInHtml}</td>
            <td data-label="Barion" style="text-align:center;">${paidHtml}</td>
            <td data-label="Művelet" style="white-space: nowrap; text-align:center;">
                <button class="action-btn edit" onclick="window.raceManager.openEditModal('${r.id}', ${r.members && r.members.length === 1 && /s[aá]rk[aá]ny/i.test(r.category || '') && (r.id.startsWith('DRAGON_') || r.team_size_was_larger) ? `'${r.members[0].id}'` : 'null'})" style="background:var(--accent-secondary); padding: 5px 8px; font-size: 1rem; border-radius: 6px; margin-right: 5px;" title="Szerkesztés">✏️</button>
                <button class="action-btn delete" onclick="window.raceManager.deleteRacer('${r.id}', ${r.bib || 'null'})" style="background:#dc3545; padding: 5px 8px; font-size: 1rem; border-radius: 6px; margin-right: 5px;" title="Törlés">🗑️</button>
                ${r.status === 'duplicate' ? `
                <button class="action-btn" onclick="if(confirm('Biztosan érvényesíted a nevezést?')) window.raceManager.updateRacerStatus('${r.id}', 'status', 'registered').then(() => renderAdminTable(window.currentTableFilter))" style="background:#5BB226; color:white; padding: 5px 8px; font-size: 0.8rem; border-radius: 6px; font-weight:bold;" title="Érvényesítés">✅ ÉRVÉNYESÍT</button>
                ` : ''}
                ${r.status === 'running' ? `
                <button class="action-btn" onclick="if(confirm('Biztosan DNF (Feladta) státuszba teszed?')) window.raceManager.updateRacerStatus('${r.id}', 'status', 'dnf').then(() => renderAdminTable(window.currentTableFilter))" style="background:#FFA500; color:black; padding: 5px 8px; font-size: 0.8rem; border-radius: 6px; margin-right: 5px; font-weight:bold;" title="Feladta">DNF</button>
                <button class="action-btn" onclick="if(confirm('Biztosan DSQ (Kizárva) státuszba teszed?')) window.raceManager.updateRacerStatus('${r.id}', 'status', 'dsq').then(() => renderAdminTable(window.currentTableFilter))" style="background:#800080; color:white; padding: 5px 8px; font-size: 0.8rem; border-radius: 6px; font-weight:bold;" title="Kizárva">DSQ</button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// globális kereső támogatása
window.adminSearchQuery = '';
window.handleTableSearch = (query) => {
    window.adminSearchQuery = query;
    window.renderAdminTable(window.currentTableFilter);
};

/**
 * Adminisztrátori vezérlőgombok (Start/Stop) kirajzolása
 */
export function renderAdminControlButtons() {
    const rm = window.raceManager;
    if (!rm) return;

    // --- 1. Tömegrajt ---
    const massContainer = document.getElementById('mass-start-ctrl');
    if (massContainer) {
        const isRunning = !!rm.data.categories['MASS_START_ALL'];
        massContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px; align-items: center; background: rgba(255, 77, 77, 0.05); padding: 15px; border-radius: var(--border-radius-md); border: 1px solid rgba(255, 77, 77, 0.15);">
                <button onclick="window.startMass()" class="btn-primary" style="width: 100%; min-height: 54px; background: linear-gradient(135deg, #ff4444, #f00); box-shadow: 0 8px 25px rgba(255,0,0,0.3);" ${isRunning ? 'disabled' : ''}>
                    🚀 ÖSSZES INDÍTÁSA
                </button>
                ${isRunning ? `
                    <button onclick="window.stopCategory(null, null, 'MASS_START_ALL')" class="btn-stop" style="width: 100%; margin: 0; min-height: 42px; border-radius: 10px; font-weight: 700;">
                        🛑 STOP
                    </button>
                ` : ''}
            </div>
        `;
    }

    // --- 2. Távolság Rajt ---
    const distanceContainer = document.getElementById('distance-start-ctrl');
    if (distanceContainer) {
        distanceContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                ${['11km', '22km', '4km'].map(dist => {
                    const isRunning = !!rm.data.categories[`DISTANCE_${dist}`];
                    return `
                        <div style="display: flex; gap: 10px; align-items: center; background: rgba(0,228,255,0.03); padding: 10px; border-radius: var(--border-radius-md); border: 1px solid rgba(0,228,255,0.1);">
                            <button onclick="window.startDistance('${dist}')" class="btn-start" style="flex:2; height: 45px; font-weight: 700; ${isRunning ? 'opacity:0.4;' : ''}" ${isRunning ? 'disabled' : ''}>
                                ${dist} RAJT
                            </button>
                            ${isRunning ? `<button onclick="window.stopCategory(null, null, 'DISTANCE_${dist}')" class="btn-stop" style="flex:1; height: 45px; font-weight: 700; border-radius: 10px;">STOP</button>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // --- 3. Egyéni Rajt ---
    const individualContainer = document.getElementById('individual-start-ctrl');
    if (individualContainer) {
        individualContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <input type="number" id="individual-bib-input" placeholder="000" style="width: 100%; height: 60px; background: rgba(0,0,0,0.3); border: 2px solid var(--accent-primary); color: white; border-radius: 12px; text-align: center; font-size: 2rem; font-weight: 800; margin-bottom:0; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);">
                <button onclick="window.startIndividual(document.getElementById('individual-bib-input').value)" class="btn-primary" style="width: 100%; min-height: 50px; background: var(--accent-primary); color: #0B192C; border:none; font-weight: 800; letter-spacing: 1px;">
                    🎯 RAJT INDÍTÁSA
                </button>
            </div>
        `;
    }

    // --- 4. Kategória Rajt ---
    const groupContainer = document.getElementById('category-start-buttons');
    if (groupContainer) {
        groupContainer.innerHTML = '';
        const availableStarts = [];

        Object.keys(rm.groupMap).forEach(groupId => {
            const isRunning = !!rm.data.categories[groupId];
            availableStarts.push({ id: groupId, name: rm.groupMap[groupId].replace('Összes ', ''), type: 'group', isRunning });
        });

        Object.keys(rm.categoryMap).forEach(catId => {
            ['11km', '22km', '4km'].forEach(dist => {
                const key = `${catId}_${dist}`;
                const isSup = catId.includes('sup');
                const isSarkany = /s[aá]rk[aá]ny/i.test(catId || '');
                const hasDistSuffix = catId.endsWith(`_${dist}`);
                const hasOtherDistSuffix = (dist !== '11km' && catId.endsWith('_11km')) || 
                                           (dist !== '22km' && catId.endsWith('_22km')) || 
                                           (dist !== '4km' && catId.endsWith('_4km'));
                
                let isDistanceMatch = false;
                if (hasDistSuffix) isDistanceMatch = true;
                else if (hasOtherDistSuffix) isDistanceMatch = false;
                else if (isSup) isDistanceMatch = (dist === '4km' || dist === '22km' || dist === '11km'); // SUP can be multiple
                else if (isSarkany) isDistanceMatch = (dist === '11km');
                else isDistanceMatch = (dist === '11km' || dist === '22km');

                if (isDistanceMatch) {
                    const isRunning = !!rm.data.categories[key];
                    const inExistingGroup = availableStarts.some(s => s.type === 'group' && rm.belongsToGroup({category: catId, distance: dist}, s.id));
                    if (!inExistingGroup) {
                        availableStarts.push({ id: key, name: rm.formatCategoryName(key), type: 'category', isRunning });
                    }
                }
            });
        });

        if (availableStarts.length === 0) {
            groupContainer.innerHTML = '<div class="empty-text">Nincs indítható kategória</div>';
        } else {
            groupContainer.style.maxHeight = '400px';
            groupContainer.style.overflowY = 'auto';
            availableStarts.forEach(start => {
                const div = document.createElement('div');
                div.style = 'display:flex; gap:10px; margin-bottom:10px; background:rgba(0,228,255,0.03); padding:8px; border-radius:10px; border:1px solid rgba(0,228,255,0.08);';
                div.innerHTML = `
                    <button onclick="window.startCategory(null, null, '${start.id}')" class="btn-start" style="flex:2; text-align:left; font-weight:700; font-size:0.8rem; padding:10px; margin-bottom:0; opacity: ${start.isRunning ? 0.4 : 1};" ${start.isRunning ? 'disabled' : ''}>
                        ${start.name} RAJT
                    </button>
                    ${start.isRunning ? `<button onclick="window.stopCategory(null, null, '${start.id}')" class="btn-stop" style="flex:1; padding:8px; font-weight:700; margin-bottom:0; font-size:0.75rem;">STOP</button>` : ''}
                `;
                groupContainer.appendChild(div);
            });
        }
    }
}

/**
 * Eredmények exportálása Excel fájlba - Kategóriánként külön munkalapokra, távolság szerinti sorrendben
 */
export function exportResultsToExcel() {
    const rm = window.raceManager;
    if (!rm || !rm.data.racers || rm.data.racers.length === 0) {
        showToast('Nincs menthető adat!', 'error');
        return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Munkalapok létrehozása kategóriánként, Távolság szerinti sorrendben (11km, 22km, 4km)
    const distancePriority = ['11km', '22km', '4km'];
    
    distancePriority.forEach(distId => {
        // Keressük ki az összes kategóriát ebben a távban (kivéve sárkányhajó)
        const categoriesInDist = [...new Set(
            rm.data.racers
                .filter(r => r.distance === distId && !(/s[aá]rk[aá]ny/i.test(r.category || '')))
                .map(r => r.category)
        )].sort();

        categoriesInDist.forEach(catId => {
            const finishers = rm.data.racers.filter(r => r.category === catId && r.distance === distId);
            if (finishers.length === 0) return;

            // Rendezés: Célbaértek idő szerint, majd többiek rajtszám szerint
            const sorted = finishers.sort((a, b) => {
                if (a.status === 'finished' && b.status !== 'finished') return -1;
                if (a.status !== 'finished' && b.status === 'finished') return 1;
                if (a.status === 'finished' && b.status === 'finished') return (a.total_time || 0) - (b.total_time || 0);
                return (a.bib || 0) - (b.bib || 0);
            });

            const rows = [[`KATEGÓRIA EREDMÉNYEK: ${rm.formatCategoryName(catId)} (${distId})`]];
            rows.push(["Helyezés", "Rajtszám", "Név (Csapattagok)", "Ötpróba ID-k", "Táv", "Státusz", "Időeredmény"]);

            let rank = 1;
            sorted.forEach(r => {
                rows.push([
                    r.status === 'finished' ? rank++ : '-',
                    r.bib,
                    formatRacerName(r),
                    r.members ? r.members.filter(m => m.otproba_id !== 'CSAPATNEV').map(m => m.otproba_id || '').filter(id => id).join(', ') : (r.otproba_id || '-'),
                    r.distance,
                    r.status,
                    r.status === 'finished' ? formatTime(r.total_time) : (r.status === 'running' ? 'Folyamatban' : 'Regisztrálva')
                ]);
            });

            // Munkalap név tisztítása és rövidítése (Excel limit 31 karakter)
            // Megpróbáljuk a kategória nevét használni, ha túl hosszú, levágjuk
            let rawBaseName = rm.formatCategoryName(catId).replace(/[\\/?*\[\]]/g, '');
            let sheetName = rawBaseName.substring(0, 25) + `_${distId}`;
            let finalSheetName = sheetName.substring(0, 31);
            
            let counter = 1;
            while (wb.SheetNames.includes(finalSheetName)) {
                finalSheetName = rawBaseName.substring(0, 20) + `_${distId}_${counter++}`;
                finalSheetName = finalSheetName.substring(0, 31);
            }

            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), finalSheetName);
        });
    });

    // 2. Sárkányhajó munkalap(ok) a végére
    const sarkanyCategories = [...new Set(
        rm.data.racers
            .filter(r => /s[aá]rk[aá]ny/i.test(r.category || ''))
            .map(r => r.category)
    )].sort();

    sarkanyCategories.forEach(catId => {
        const gamers = rm.data.racers.filter(r => r.category === catId);
        if (gamers.length === 0) return;

        const sortedS = gamers.sort((a, b) => {
            if (a.status === 'finished' && b.status !== 'finished') return -1;
            if (a.status !== 'finished' && b.status === 'finished') return 1;
            if (a.status === 'finished' && b.status === 'finished') return (a.total_time || 0) - (b.total_time || 0);
            return (a.bib || 0) - (b.bib || 0);
        });

        const sRows = [[`SÁRKÁNYHAJÓ EREDMÉNYEK: ${rm.formatCategoryName(catId)}`]];
        sRows.push(["Helyezés", "Rajtszám", "Név / Egység", "Ötpróba ID-k", "Státusz", "Időeredmény"]);

        let sRank = 1;
        sortedS.forEach(r => {
            sRows.push([
                r.status === 'finished' ? sRank++ : '-',
                r.bib,
                formatRacerName(r),
                r.members ? r.members.filter(m => m.otproba_id !== 'CSAPATNEV').map(m => m.otproba_id || '').filter(id => id).join(', ') : (r.otproba_id || '-'),
                r.status,
                r.status === 'finished' ? formatTime(r.total_time) : (r.status === 'running' ? 'Folyamatban' : 'Regisztrálva')
            ]);
        });

        let rawSarkanyName = rm.formatCategoryName(catId).replace(/[\\/?*\[\]]/g, '');
        let sName = "S_Hajó_" + rawSarkanyName;
        let finalSName = sName.substring(0, 31);
        
        let sCounter = 1;
        while (wb.SheetNames.includes(finalSName)) {
            finalSName = ("S_Hajó_" + rawSarkanyName).substring(0, 27) + `_${sCounter++}`;
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

    let racers = [...rm.data.racers].filter(r => r && r.status);
    let titlePrefix = "Szurt_Lista";

    if (specificCatId) {
        racers = racers.filter(r => r.category === specificCatId && r.distance === filterType);
        titlePrefix = `${rm.formatCategoryName(specificCatId)}_${filterType}`;
    } else {
        if (filterType === '22km') {
            racers = racers.filter(r => r.distance === '22km');
            titlePrefix = "22km_Nevezettek";
        } else if (filterType === '11km') {
            racers = racers.filter(r => r.distance === '11km' && !(/s[aá]rk[aá]ny/i.test(r.category || '')));
            titlePrefix = "11km_Nevezettek";
        } else if (filterType === '4km') {
            racers = racers.filter(r => r.distance === '4km');
            titlePrefix = "4km_Nevezettek";
        } else if (filterType === 'sarkany') {
            racers = racers.filter(r => /s[aá]rk[aá]ny/i.test(r.category || ''));
            titlePrefix = "Sarkanyhajo_Nevezettek";
        }
    }

    const wb = XLSX.utils.book_new();
    const rows = [["Rajtszám", "Név (Egység tagjai)", "Születési dátumok", "Ötpróba ID-k", "Kategória", "Táv", "Sorozat", "Státusz", "Időeredmény"]];
    
    racers.forEach(r => {
        rows.push([
            r.bib,
            formatRacerName(r),
            r.members ? r.members.filter(m => m.otproba_id !== 'CSAPATNEV').map(m => m.birth_date || '').filter(d => d).join(', ') : '-',
            r.members ? r.members.filter(m => m.otproba_id !== 'CSAPATNEV').map(m => m.otproba_id || '').filter(id => id).join(', ') : (r.otproba_id || '-'),
            rm.formatCategoryName(r.category),
            r.distance,
            r.is_series ? 'Igen' : 'Nem',
            r.status,
            r.status === 'finished' ? formatTime(r.total_time) : (r.status === 'running' ? 'Folyamatban' : 'Regisztrálva')
        ]);
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Nevezettek");
    XLSX.writeFile(wb, `${titlePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Szűrt Excel sikeresen exportálva!', 'success');
}

/**
 * Nevezettek kategóriánkénti választófelülete (Kártyás elrendezés)
 */
export function renderAdminCategoryList() {
    const rm = window.raceManager;
    const container = document.getElementById('admin-category-cards-container');
    if (!rm || !container) return;

    container.innerHTML = '';

    const distances = [
        { id: '11km', title: '📐 Rövid' },
        { id: '22km', title: '📏 Hosszú' },
        { id: '4km', title: '🛶 SUP 4 km' }
    ];

    distances.forEach(dist => {
        const distHeader = document.createElement('h2');
        distHeader.className = 'section-title';
        distHeader.style = 'margin-top: 30px; border-left: 5px solid var(--accent-primary); padding-left: 15px; background: rgba(0,228,255,0.05); padding: 10px 15px; border-radius: 4px;';
        distHeader.textContent = dist.title;
        container.appendChild(distHeader);

        const grid = document.createElement('div');
        grid.style = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;';
        
        const validCategories = Object.keys(rm.categoryMap).filter(catId => {
            // Szigorú ellenőrzés: csak ha az ID a megfelelő távval végződik
            if (catId.endsWith(`_${dist.id}`)) return true;
            
            // Kivételek (olyan kategóriák, amiknek nincs fix táv-suffixe az ID-ban)
            if (dist.id === '11km' && catId === 'sarkanyhajo_otproba') return true;
            
            return false;
        });

        validCategories.forEach(catId => {
            // Rugalmasabb keresés: alap ID + táv egyezés (pl. kajak_1_nyitott_11km vagy csak kajak_1_nyitott)
            const baseCatId = catId.replace(/_(11km|22km|4km)$/, '');
            const racers = rm.data.racers.filter(r => {
                const rBaseCat = (r.category || '').replace(/_(11km|22km|4km)$/, '');
                return (r.category === catId || rBaseCat === baseCatId) && r.distance === dist.id;
            });

            const card = document.createElement('div');
            card.className = 'admin-card'; 
            card.style = `
                cursor: pointer; 
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                padding: 18px; 
                border-radius: 14px; 
                border: 1px solid rgba(255,255,255,0.08); 
                background: rgba(255,255,255,0.02); 
                display: flex; 
                flex-direction: column; 
                justify-content: flex-start;
                min-height: 150px;
                position: relative;
                overflow: hidden;
            `;
            card.onclick = () => window.showCategoryDetail(dist.id, catId);
            
            // Hover effects
            card.onmouseenter = () => {
                card.style.background = 'rgba(255,255,255,0.05)';
                card.style.transform = 'translateY(-5px)';
                card.style.borderColor = 'rgba(0, 228, 255, 0.3)';
                card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
            };
            card.onmouseleave = () => {
                card.style.background = 'rgba(255,255,255,0.02)';
                card.style.transform = 'translateY(0)';
                card.style.borderColor = 'rgba(255,255,255,0.08)';
                card.style.boxShadow = 'none';
            };

            const hasRacers = racers.length > 0;
            const badgeColor = hasRacers ? 'var(--accent-primary)' : 'rgba(255,255,255,0.3)';
            const badgeBg = hasRacers ? 'rgba(0, 228, 255, 0.1)' : 'rgba(255,255,255,0.05)';
            
            let namesListHtml = '';
            if (hasRacers) {
                const names = racers.slice(0, 3).map(r => {
                    const name = formatRacerName(r);
                    return `<div style="font-size: 0.72rem; color: #bbb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px;">• ${name}</div>`;
                }).join('');
                namesListHtml = `
                    <div style="margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05);">
                        ${names}
                        ${racers.length > 3 ? `<div style="font-size: 0.65rem; color: #666; margin-top:4px;">+ további ${racers.length - 3} egység</div>` : ''}
                    </div>`;
            } else {
                namesListHtml = `<div style="margin-top: auto; color: #555; font-size: 0.7rem; font-style: italic; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">Még nincs nevező</div>`;
            }

            card.innerHTML = `
                <div style="
                    display: inline-block;
                    align-self: flex-start;
                    font-size: 0.65rem; 
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    font-weight: 800; 
                    margin-bottom: 12px; 
                    color: ${badgeColor};
                    background: ${badgeBg};
                    padding: 4px 10px;
                    border-radius: 20px;
                    border: 1px solid ${hasRacers ? 'rgba(0,228,255,0.2)' : 'transparent'};
                ">${racers.length} NEVEZÉS</div>
                <div style="font-weight: 600; color: white; line-height: 1.3; font-size: 0.95rem; margin-bottom: 10px;">${rm.formatCategoryName(catId)}</div>
                ${namesListHtml}
            `;
            grid.appendChild(card);
        });
        container.appendChild(grid);
    });
}

/**
 * Egy konkrét kategória nevezettjeinek listázása
 */
export function renderAdminCategoryDetail(distId, catId) {
    window.renderAdminCategoryDetail = renderAdminCategoryDetail;
    const rm = window.raceManager;
    const titleEl = document.getElementById('admin-category-detail-title');
    const contentEl = document.getElementById('admin-category-detail-content');
    if (!rm || !contentEl) return;

    if (titleEl) titleEl.textContent = `🏷️ ${rm.formatCategoryName(catId)} (${distId})`;
    contentEl.innerHTML = '';

    // Rugalmasabb keresés a részletes nézetben is
    const baseCatId = catId.replace(/_(11km|22km|4km)$/, '');
    const racers = rm.data.racers.filter(r => {
        const rBaseCat = (r.category || '').replace(/_(11km|22km|4km)$/, '');
        return (r.category === catId || rBaseCat === baseCatId) && r.distance === distId;
    });

    // Export gomb hozzáadása felülre
    const headerBar = document.createElement('div');
    headerBar.style = 'margin-bottom: 20px; display: flex; justify-content: flex-end;';
    headerBar.innerHTML = `
        <button onclick="window.exportSpecificCategoryExcel('${distId}', '${catId}')" class="btn-primary" style="background: #28a745; width: auto; font-size: 0.8rem; padding: 8px 20px;">
            📥 EXCEL EXPORT (CSAK EZ A KATEGÓRIA)
        </button>
    `;
    contentEl.appendChild(headerBar);

    if (racers.length === 0) {
        const noResults = document.createElement('div');
        noResults.style = 'text-align: center; padding: 50px; background: rgba(255,255,255,0.02); border-radius: 15px; border: 1px dashed rgba(255,255,255,0.1);';
        noResults.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 15px;">🏜️</div>
            <h3 style="color: #888;">Még nem érkezett nevezés ebben a kategóriában.</h3>
        `;
        contentEl.appendChild(noResults);
        return;
    }

    const tableDiv = document.createElement('div');
    tableDiv.className = 'table-responsive';
    tableDiv.innerHTML = `
        <table class="results-table">
            <thead>
                <tr>
                    <th>Rajtszám</th>
                    <th>Egység Tagjai</th>
                    <th>Ötpróba ID</th>
                    <th>Kategória</th>
                    <th>Státusz</th>
                    <th>Időeredmény</th>
                    <th>Megjelent</th>
                    <th>Barion</th>
                    <th style="min-width: 180px; text-align: center;">Művelet</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    const tbody = tableDiv.querySelector('tbody');
    racers.sort((a,b) => (a.bib || 0) - (b.bib || 0)).forEach(r => {
        const tr = document.createElement('tr');
        let statusColor = "white";
        let dataStartAttr = "";

        if (r.status === 'running') {
            statusColor = 'var(--accent-primary)';
            tr.className = "status-running";
            dataStartAttr = `data-start="${r.start_time || 0}"`;
        } else if (r.status === 'finished') {
            statusColor = '#00FFCC';
        } else if (r.status === 'duplicate') {
            statusColor = '#FFA500';
            tr.style.background = 'rgba(255, 165, 0, 0.15)';
        }

        let timeStr = "00:00:00.000";
        if (r.status === 'running') {
            timeStr = formatTime(Date.now() + (rm.serverTimeOffset || 0) - (r.start_time || 0));
        } else if (r.status === 'finished') {
            timeStr = formatTime(r.total_time || 0);
        }

        const memberList = formatMemberListHtml(r);
        const otprobaList = formatOtprobaListHtml(r);
        const isChecked = !!r.checked_in;
        const isPaid = !!r.is_paid;
        
        const checkInHtml = `<input type="checkbox" style="transform: scale(1.5)" ${isChecked ? 'checked' : ''} onchange="window.raceManager.updateRacerStatus('${r.id}', 'checked_in', this.checked)">`;
        const paidHtml = isPaid ? 
            `<span style="background:#5BB226; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold; cursor:pointer;" onclick="if(confirm('Mégis visszaállítod fizetetlenre?')) window.raceManager.updateRacerStatus('${r.id}', 'is_paid', false).then(() => window.renderAdminCategoryDetail('${distId}', '${catId}'))">Befizetve</span>` : 
            `<button onclick="window.raceManager.updateRacerStatus('${r.id}', 'is_paid', true).then(() => window.renderAdminCategoryDetail('${distId}', '${catId}'))" class="action-btn" style="background:transparent; border:1px solid #5BB226; color:#5BB226; padding:2px 8px; font-size:0.8rem;">Függőben</button>`;

        tr.innerHTML = `
            <td data-label="Rajtszám"><strong>#${(r.bib || 0).toString().padStart(3, '0')}</strong></td>
            <td data-label="Egység Tagjai">${memberList}</td>
            <td data-label="Ötpróba ID">${otprobaList}</td>
            <td data-label="Kategória">${rm.formatCategoryName(r.category)}</td>
            <td data-label="Státusz" style="color:${statusColor}">${(r.status || 'registered').toUpperCase()} ${r.status === 'duplicate' ? '⚠️' : ''}</td>
            <td data-label="Időeredmény" class="time" ${dataStartAttr}>${timeStr}</td>
            <td data-label="Megjelent" style="text-align:center;">${checkInHtml}</td>
            <td data-label="Barion" style="text-align:center;">${paidHtml}</td>
            <td data-label="Művelet" style="white-space: nowrap; text-align: center;">
                <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                    <button class="action-btn edit" style="margin:0; padding: 6px 12px; font-size: 0.75rem;" onclick="window.raceManager.openEditModal('${r.id}')">Szerkesztés</button>
                    <button class="action-btn delete" style="margin:0; padding: 6px 12px; font-size: 0.75rem;" onclick="window.raceManager.deleteRacer('${r.id}', ${r.bib || 'null'})">Törlés</button>
                    ${r.status === 'duplicate' ? `
                    <button class="action-btn" onclick="if(confirm('Biztosan érvényesíted a nevezést?')) window.raceManager.updateRacerStatus('${r.id}', 'status', 'registered').then(() => window.renderAdminCategoryDetail('${distId}', '${catId}'))" style="background:#5BB226; color:white; padding: 6px 12px; font-size: 0.75rem; border-radius: 6px; font-weight:bold; margin:0;" title="Érvényesítés">✅ ÉRVÉNYESÍT</button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    contentEl.appendChild(tableDiv);
}

/**
 * Rajtszám módosító felület inicializálása
 */
export function renderBibManagementTable() {
    const container = document.getElementById('bib-modification-container');
    if (!container) return;
    
    // Alaphelyzetbe állítás: egyetlen üres sor
    container.innerHTML = '';
    window.addBibEditRow();
}

/**
 * Új módosító sor hozzáadása
 */
window.addBibEditRow = () => {
    const container = document.getElementById('bib-modification-container');
    const currentRows = container.querySelectorAll('.bib-mod-row').length;
    
    if (currentRows >= 3) {
        showToast("Egyszerre maximum 3 módosítási sor lehet nyitva!", "error");
        return;
    }

    const rowIdx = Date.now(); // Egyedi azonosító a sornak
    const div = document.createElement('div');
    div.className = 'bib-mod-row admin-card';
    div.style = "padding: 20px; position: relative; animation: fadeIn 0.3s ease-out;";
    
    div.innerHTML = `
        <div style="display: grid; grid-template-columns: 150px 1fr 150px; gap: 20px; align-items: start;">
            <!-- Bal oldal: Keresés -->
            <div>
                <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 5px;">Eredeti rajtszám</label>
                <input type="number" 
                       class="old-bib-input" 
                       placeholder="Pl. 102"
                       style="width: 100%; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: white; border-radius: 8px; font-weight: bold; font-size: 1.1rem; text-align: center;"
                       oninput="window.searchRacerByBib(this.value, '${rowIdx}')">
            </div>

            <!-- Közép: Versenyző adatai -->
            <div id="racer-info-${rowIdx}" style="min-height: 80px; display: flex; align-items: center; justify-content: center; border: 1px dashed rgba(255,255,255,0.1); border-radius: 10px; background: rgba(255,255,255,0.02);">
                <span style="color: var(--text-secondary); font-style: italic; font-size: 0.9rem;">Írj be egy rajtszámot a kereséshez...</span>
            </div>

            <!-- Jobb oldal: Új rajtszám és Mentés -->
            <div id="save-ctrl-${rowIdx}" class="hidden">
                <label style="display: block; font-size: 0.8rem; color: var(--accent-primary); margin-bottom: 5px;">Új rajtszám</label>
                <input type="number" 
                       id="new-bib-${rowIdx}" 
                       placeholder="Új #"
                       style="width: 100%; padding: 12px; background: rgba(0, 145, 255, 0.05); border: 1px solid var(--accent-primary); color: white; border-radius: 8px; font-weight: bold; font-size: 1.1rem; text-align: center; margin-bottom: 10px;">
                <button class="action-btn edit" style="width: 100%; margin: 0;" onclick="window.saveBibChange('${rowIdx}')">MENTÉS</button>
            </div>
        </div>
        ${container.children.length > 0 ? `<button onclick="this.parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: #ff4d4d; cursor: pointer; font-size: 1.2rem;" title="Sor törlése">✕</button>` : ''}
    `;
    
    container.appendChild(div);
};

/**
 * Versenyző keresése rajtszám alapján
 */
window.searchRacerByBib = (bib, rowIdx) => {
    const infoContainer = document.getElementById(`racer-info-${rowIdx}`);
    const saveCtrl = document.getElementById(`save-ctrl-${rowIdx}`);
    if (!infoContainer || !saveCtrl) return;

    if (!bib) {
        infoContainer.innerHTML = '<span style="color: var(--text-secondary); font-style: italic; font-size: 0.9rem;">Írj be egy rajtszámot a kereséshez...</span>';
        saveCtrl.classList.add('hidden');
        return;
    }

    const rm = window.raceManager;
    const racer = rm.data.racers.find(r => r.bib == bib);

    if (racer) {
        const names = formatRacerName(racer);
        infoContainer.innerHTML = `
            <div style="width: 100%; padding: 10px 20px;">
                <div style="font-weight: bold; color: var(--accent-primary); font-size: 1.1rem; margin-bottom: 5px;">${names}</div>
                <div style="display: flex; gap: 15px; font-size: 0.85rem; color: var(--text-secondary);">
                    <span>🏷️ ${rm.formatCategoryName(racer.category)}</span>
                    <span>📐 ${racer.distance}</span>
                    <span style="color: #28a745;">✓ AKTÍV</span>
                </div>
            </div>
        `;
        infoContainer.style.border = "1px solid rgba(0, 145, 255, 0.2)";
        infoContainer.style.background = "rgba(0, 145, 255, 0.05)";
        saveCtrl.classList.remove('hidden');
        // Eltároljuk az azonosítót a mentéshez
        saveCtrl.dataset.racerId = racer.id;
    } else {
        infoContainer.innerHTML = '<span style="color: #ff4d4d; font-size: 0.9rem;">⚠️ Nincs ilyen rajtszámú versenyző!</span>';
        infoContainer.style.border = "1px dashed rgba(255, 77, 77, 0.3)";
        infoContainer.style.background = "rgba(255, 77, 77, 0.05)";
        saveCtrl.classList.add('hidden');
    }
};

/**
 * Mentés wrapper
 */
window.saveBibChange = async (rowIdx) => {
    const saveCtrl = document.getElementById(`save-ctrl-${rowIdx}`);
    const racerId = saveCtrl.dataset.racerId;
    const newBib = document.getElementById(`new-bib-${rowIdx}`).value;

    if (!newBib) {
        showToast("Kérlek adj meg egy új rajtszámot!", "error");
        return;
    }

    try {
        const success = await window.raceManager.updateRacerBib(racerId, newBib);
        if (success) {
            const row = saveCtrl.closest('.bib-mod-row');
            row.style.opacity = "0.5";
            row.style.pointerEvents = "none";
            row.innerHTML = `<div style="text-align: center; padding: 20px; color: #28a745; font-weight: bold;">✓ SIKERESEN MÓDOSÍTVA: ${newBib}</div>`;
            setTimeout(() => {
                row.remove();
                // Frissítsük az előzményeket a háttérben
                const panel = document.getElementById('bib-history-panel');
                if (panel && !panel.classList.contains('hidden')) {
                    window.renderBibHistory();
                }
            }, 2000);
        }
    } catch (err) {
        console.error("Save error in admin-ui:", err);
        showToast("Hiba a mentés során!", "error");
    }
};

/**
 * Előzmények panel lenyitása/bezárása
 */
export function toggleBibHistory() {
    const panel = document.getElementById('bib-history-panel');
    const icon = document.getElementById('bib-history-toggle-icon');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        icon.textContent = '▲';
        renderBibHistory();
    } else {
        panel.classList.add('hidden');
        icon.textContent = '▼';
    }
}
window.toggleBibHistory = toggleBibHistory;

/**
 * Előzmények renderelése
 */
export async function renderBibHistory() {
    const tbody = document.getElementById('bib-history-table-body');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_URL}/bib-history`, {
            headers: { 'Authorization': `Bearer ${window.raceManager.adminPassword}` }
        });
        
        if (!response.ok) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #ff4d4d;">Hiba az adatok lekérésekor</td></tr>';
            return;
        }

        const history = await response.json();

        if (!Array.isArray(history) || history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-secondary);">Nincsenek előzmények</td></tr>';
            return;
        }

        tbody.innerHTML = history.map(entry => `
            <tr>
                <td>${new Date(entry.timestamp).toLocaleString('hu-HU')}</td>
                <td style="font-weight: bold;">${entry.racerName}</td>
                <td style="text-align: center; color: var(--text-secondary);">${entry.oldBib}</td>
                <td style="text-align: center; color: var(--accent-primary); font-weight: bold;">${entry.newBib}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("History render error:", err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #ff4d4d; padding: 20px;">Hiba az előzmények betöltésekor</td></tr>';
    }
}
window.renderBibHistory = renderBibHistory;

/**
 * Előzmények törlése megerősítéssel
 */
export function clearBibHistory() {
    window.showConfirmModal(
        "Biztosan törölni akarod a rajtszám módosítási előzményeket?",
        async () => {
            try {
                const response = await fetch(`${API_URL}/bib-history`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${window.raceManager.adminPassword}` }
                });
                if (response.ok) {
                    showToast("Előzmények törölve.", "success");
                    renderBibHistory();
                } else {
                    showToast("Sikertelen törlés.", "error");
                }
            } catch (err) {
                showToast("Szerver hiba a törléskor.", "error");
            }
        }
    );
}
window.clearBibHistory = clearBibHistory;

/**
 * --- EREDMÉNYEK MEGJELENÍTÉSE ---
 */

/**
 * Abszolút vagy távonkénti eredménylista renderelése
 */
export function renderResultsTable(filterType = 'all') {
    const tbody = document.getElementById('admin-results-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const rm = window.raceManager;
    if (!rm || !rm.data.racers) return;

    // Csak a beérkezett (finished) versenyzőket mutatjuk eredményként
    let racers = rm.data.racers.filter(r => r.status === 'finished');

    if (filterType !== 'all') {
        if (filterType === 'sarkany') {
            racers = racers.filter(r => /s[aá]rk[aá]ny/i.test(r.category || ''));
        } else {
            racers = racers.filter(r => r.distance === filterType && !(/s[aá]rk[aá]ny/i.test(r.category || '')));
        }
    }

    // Rendezés időeredmény szerint (növekvő)
    racers.sort((a, b) => (a.total_time || 0) - (b.total_time || 0));

    if (racers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-secondary); font-style: italic;">Nincs beérkezett eredmény a szűrésnek megfelelően</td></tr>';
        return;
    }

    const thead = document.querySelector('#admin-results-table thead tr');
    const showFordulo = filterType === '22km' || filterType === 'all';
    
    if (thead) {
        thead.innerHTML = `
            <th style="width: 8%">Helyezés</th>
            <th style="width: 12%">Rajtszám</th>
            <th style="width: ${showFordulo ? '35%' : '45%'}">Egység Tagjai</th>
            <th style="width: 15%">Kategória</th>
            <th style="width: 10%">Táv</th>
            ${showFordulo ? '<th style="width: 10%">Forduló idő (11km)</th>' : ''}
            <th style="width: 10%">Időeredmény</th>
        `;
    }

    racers.forEach((r, idx) => {
        const tr = document.createElement('tr');
        const memberList = r.members ? r.members.map(m => m.name).join(', ') : (r.name || '-');
        const rank = idx + 1;
        const rankDecor = rank <= 3 ? `font-weight: 800; color: ${rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32'}` : '';

        const cp = (rm.data.checkpoints || []).find(c => c.racer_bib === r.bib && c.checkpoint_name === '22km_tav_11km_fordulo');
        const forduloTd = showFordulo ? 
            `<td data-label="Forduló (11km)" style="font-family:'Space Mono'; color:#ff9900;">${cp ? formatTime(cp.timestamp - r.start_time) : '-'}</td>` : '';

        tr.innerHTML = `
            <td data-label="Helyezés" style="${rankDecor}">${rank}.</td>
            <td data-label="Rajtszám"><strong>#${(r.bib || 0).toString().padStart(3, '0')}</strong></td>
            <td data-label="Egység Tagjai">${memberList}</td>
            <td data-label="Kategória">${rm.formatCategoryName(r.category)}</td>
            <td data-label="Táv">${r.distance || '-'}</td>
            ${forduloTd}
            <td data-label="Időeredmény" style="font-family:'Space Mono'; font-weight:bold; color:var(--accent-primary);">${formatTime(r.total_time || 0)}</td>
        `;
        tbody.appendChild(tr);
    });
}
window.renderResultsTable = renderResultsTable;

/**
 * Kategória eredmény választó lista renderelése
 */
export function renderResultsCategoryList() {
    const container = document.getElementById('admin-results-category-list-container');
    if (!container) return;
    container.innerHTML = '';

    const rm = window.raceManager;
    if (!rm) return;

    const distances = ['22km', '11km', '4km'];
    distances.forEach(dist => {
        const distSection = document.createElement('div');
        distSection.style = 'margin-bottom: 2.5rem;';
        distSection.innerHTML = `
            <h4 style="color:var(--accent-secondary); margin-bottom:1.2rem; border-left:4px solid var(--accent-secondary); padding-left:12px; font-size:1.1rem; text-transform:uppercase; letter-spacing:1px;">
                ${dist === '4km' ? '🛶 4 km (SUP)' : dist === '11km' ? '📐 11 km (Rövid)' : '📏 22 km (Hosszú)'}
            </h4>
        `;

        const grid = document.createElement('div');
        grid.className = 'admin-landing-grid';
        grid.style = 'grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; margin:0;';

        // Egyedi kategóriák gyűjtése ehhez a távhoz
        const relevantCats = new Set();
        rm.data.racers.filter(r => r.distance === dist).forEach(r => relevantCats.add(r.category));

        const sortedCats = Array.from(relevantCats).sort();

        sortedCats.forEach(catId => {
            const finishers = rm.data.racers.filter(r => r.category === catId && r.distance === dist && r.status === 'finished');
            
            const card = document.createElement('div');
            card.className = 'landing-card';
            card.style = 'padding: 20px; text-align: left; align-items: flex-start; cursor: pointer; min-height: auto; transition: all 0.2s;';
            card.onclick = () => window.showResultsCategoryDetail(dist, catId);

            const badgeColor = finishers.length > 0 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.3)';
            const badgeBg = finishers.length > 0 ? 'rgba(0, 228, 255, 0.1)' : 'rgba(255,255,255,0.05)';

            card.innerHTML = `
                <div style="font-size: 0.65rem; color: ${badgeColor}; background: ${badgeBg}; padding: 3px 10px; border-radius: 10px; margin-bottom: 12px; font-weight:800; border: 1px solid ${finishers.length > 0 ? 'rgba(0,228,255,0.2)' : 'transparent'};">
                    ${finishers.length} BEÉRKEZETT
                </div>
                <div style="font-weight: 700; color: white; line-height:1.4;">${rm.formatCategoryName(catId)}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px; display:flex; align-items:center; gap:5px;">
                    Megnyitás a rangsorért <span style="font-size:1rem;">➔</span>
                </div>
            `;
            grid.appendChild(card);
        });
        
        if (grid.children.length > 0) {
            distSection.appendChild(grid);
            container.appendChild(distSection);
        }
    });

    // Sárkányhajó külön szekció
    const finishersSarkany = rm.data.racers.filter(r => /s[aá]rk[aá]ny/i.test(r.category || '') && r.status === 'finished');
    if (finishersSarkany.length >= 0) {
        const sarkanySection = document.createElement('div');
        sarkanySection.style = 'margin-bottom: 2.5rem;';
        sarkanySection.innerHTML = `<h4 style="color:#FFD700; margin-bottom:1.2rem; border-left:4px solid #FFD700; padding-left:12px; font-size:1.1rem; text-transform:uppercase; letter-spacing:1px;">🐉 Sárkányhajó</h4>`;
        
        const grid = document.createElement('div');
        grid.className = 'admin-landing-grid';
        grid.style = 'grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; margin:0;';
        
        const card = document.createElement('div');
        card.className = 'landing-card';
        card.style = 'padding: 20px; text-align: left; align-items: flex-start; cursor: pointer; min-height: auto;';
        card.innerHTML = `
            <div style="font-size: 0.65rem; color: #FF9100; background: rgba(255, 145, 0, 0.1); padding: 3px 10px; border-radius: 10px; margin-bottom: 12px; font-weight:800; border: 1px solid rgba(255, 145, 0, 0.2);">
                ${rm.data.racers.filter(r => /s[aá]rk[aá]ny/i.test(r.category || '') && r.status !== 'finished').length} NEVEZETT
            </div>
            <div style="font-weight: 700; color: white;">Csapatok Összeállítása</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px;">Egyéni tagok csoportosítása ➔</div>
        `;
        card.onclick = () => window.showDataSubSection('admin-data-section-teams');
        grid.appendChild(card);

        const card2 = document.createElement('div');
        card2.className = 'landing-card';
        card2.style = 'padding: 20px; text-align: left; align-items: flex-start; cursor: pointer; min-height: auto;';
        card2.onclick = () => window.showResultsCategoryDetail('11km', 'sarkany');

        card2.innerHTML = `
            <div style="font-size: 0.65rem; color: #FFD700; background: rgba(255, 215, 0, 0.1); padding: 3px 10px; border-radius: 10px; margin-bottom: 12px; font-weight:800; border: 1px solid rgba(255, 215, 0, 0.2);">
                ${finishersSarkany.length} BEÉRKEZETT
            </div>
            <div style="font-weight: 700; color: white;">Sárkányhajó Open Rangsor</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px;">Eredmények megtekintése ➔</div>
        `;
        grid.appendChild(card2);
        sarkanySection.appendChild(grid);
        container.appendChild(sarkanySection);
    }
}
window.renderResultsCategoryList = renderResultsCategoryList;

/**
 * Kategória rangsor részleteinek renderelése
 */
export function renderResultsCategoryDetail(distId, catId) {
    const tbody = document.getElementById('admin-results-category-table-body');
    const titleEl = document.getElementById('admin-results-category-title');
    if (!tbody) return;
    tbody.innerHTML = '';

    const rm = window.raceManager;
    if (!rm) return;

    if (titleEl) titleEl.textContent = `🥇 ${rm.formatCategoryName(catId)} - Rangsor (${distId})`;

    // Szűrés kategória és táv szerint
    let finishers = [];
    if (catId === 'sarkany') {
        finishers = rm.data.racers.filter(r => {
            if (!(/s[aá]rk[aá]ny/i.test(r.category || '')) || r.status !== 'finished') return false;
            // Csak a már csapatba beosztottak jelennek meg az eredményeknél:
            const isTeam = r.id.startsWith('DRAGON_') || (r.members && r.members.length > 1);
            return isTeam;
        });
    } else {
        const baseCatId = catId.replace(/_(11km|22km|4km)$/, '');
        finishers = rm.data.racers.filter(r => {
            const rBaseCat = (r.category || '').replace(/_(11km|22km|4km)$/, '');
            return (r.category === catId || rBaseCat === baseCatId) && r.distance === distId && r.status === 'finished';
        });
    }

    // Rendezés időeredmény szerint
    finishers.sort((a, b) => (a.total_time || 0) - (b.total_time || 0));

    if (finishers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px; color: var(--text-secondary); font-style: italic;">Még nincs beérkezett eredmény ebben a kategóriában.</td></tr>';
        return;
    }

    const thead = document.querySelector('.results-table thead tr');
    const theadCategory = document.querySelector('#admin-results-category-detail thead tr');
    const targetThead = theadCategory || thead;
    
    if (targetThead) {
        targetThead.innerHTML = `
            <th style="width: 10%">Helyezés</th>
            <th style="width: 15%">Rajtszám</th>
            <th style="width: ${distId === '22km' ? '45%' : '55%'}">Egység Tagjai</th>
            ${distId === '22km' ? '<th style="width: 15%">Forduló idő (11km)</th>' : ''}
            <th style="width: 15%">Időeredmény</th>
        `;
    }

    finishers.forEach((r, idx) => {
        const tr = document.createElement('tr');
        const memberList = r.members ? r.members.map(m => m.name).join(', ') : (r.name || '-');
        const rank = idx + 1;
        const rankDecor = rank <= 3 ? `font-weight: 800; color: ${rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32'}` : '';

        const cp = (rm.data.checkpoints || []).find(c => c.racer_bib === r.bib && c.checkpoint_name === '22km_tav_11km_fordulo');
        const forduloTd = (distId === '22km') ? 
            `<td data-label="Forduló (11km)" style="font-family:'Space Mono'; color:#ff9900;">${cp ? formatTime(cp.timestamp - r.start_time) : '-'}</td>` : '';

        tr.innerHTML = `
            <td data-label="Helyezés" style="${rankDecor}">${rank}.</td>
            <td data-label="Rajtszám"><strong>#${(r.bib || 0).toString().padStart(3, '0')}</strong></td>
            <td data-label="Egység Tagjai">${memberList}</td>
            ${forduloTd}
            <td data-label="Időeredmény" style="font-family:'Space Mono'; font-weight:bold; color:var(--accent-primary);">${formatTime(r.total_time || 0)}</td>
        `;
        tbody.appendChild(tr);
    });
}
window.renderResultsCategoryDetail = renderResultsCategoryDetail;

/**
 * --- SÁRKÁNYHAJÓ CSAPATÉPÍTŐ (TEAM MANAGER) ---
 */
export function renderTeamManager() {
    const tbody = document.getElementById('dragon-team-builder-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const rm = window.raceManager;
    if (!rm || !rm.data.racers) return;

    const allRacers = rm.data.racers;
    
    // Szűrő lekérése
    const filterSelect = document.getElementById('team-builder-category-filter');
    const filterValue = filterSelect ? filterSelect.value : 'sarkanyhajo';
    
    // Meglévő csapatok összegyűjtése a dropdown számára (minden olyan egység, aminek van CSAPATNEV tagja)
    // Ezt nem szűrjük, hogy bármilyen kategóriájú csapatba be lehessen osztani!
    const existingTeams = allRacers.filter(r => r.members && r.members.some(m => m.otproba_id === 'CSAPATNEV'));
    const teamSelect = document.getElementById('existing-dragon-teams-select');
    if (teamSelect) {
        teamSelect.innerHTML = '<option value="">-- Új csapat létrehozása (Töltsd ki az alsó mezőket) --</option>';
        existingTeams.forEach(team => {
            const teamMember = team.members.find(m => m.otproba_id === 'CSAPATNEV');
            const teamName = teamMember ? teamMember.name : `Ismeretlen Csapat #${team.bib}`;
            // Jelezzük a kategóriát is a legördülőben, hogy egyértelmű legyen, melyik csapat melyik kategóriában van
            const categoryName = rm.formatCategoryName(team.category) || 'Ismeretlen kategória';
            const opt = new Option(`${teamName} (#${team.bib} - ${categoryName})`, JSON.stringify({bib: team.bib, name: teamName}));
            
            const membersList = team.members.filter(m => m.otproba_id !== 'CSAPATNEV').map(m => m.name).join(', ');
            if (membersList) {
                opt.title = `Tagok: ${membersList}`;
            } else {
                opt.title = 'Még nincsenek tagok';
            }
            
            teamSelect.appendChild(opt);
        });
    }
    
    // Gyűjtsük össze az összes tagot ezekből a racer-ekből
    let allMembers = [];
    allRacers.forEach(r => {
        // Szűrés a kiválasztott érték alapján
        if (filterValue === 'sarkanyhajo') {
            if (!(/s[aá]rk[aá]ny/i.test(r.category || ''))) {
                return; // Kihagyjuk, ha nem sárkányhajó kategória
            }
        }

        const hasTeamName = r.members && r.members.some(m => m.otproba_id === 'CSAPATNEV');
        const isTeam = r.id.startsWith('DRAGON_') || hasTeamName || (r.members && r.members.length > 1);
        if (r.members) {
            const teamMember = hasTeamName ? r.members.find(x => x.otproba_id === 'CSAPATNEV') : null;
            const teamName = teamMember ? teamMember.name : (isTeam ? `Csapat #${r.bib}` : null);
            
            r.members.forEach(m => {
                if (m.otproba_id !== 'CSAPATNEV') {
                    allMembers.push({ 
                        ...m, 
                        racerBib: r.bib, 
                        racerStatus: r.status, 
                        racerId: r.id, 
                        teamSize: r.members.length,
                        teamName: teamName,
                        isTeam: isTeam,
                        category: r.category
                    });
                }
            });
        }
    });

    if (allMembers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-secondary);">Nincs versenyző a rendszerben.</td></tr>';
        return;
    }

    // Rendezés: Egyéni jelentkezők elöl, utána csapatok név szerint
    allMembers.sort((a, b) => {
        if (!a.isTeam && b.isTeam) return -1;
        if (a.isTeam && !b.isTeam) return 1;
        if (a.teamName && b.teamName) return a.teamName.localeCompare(b.teamName);
        return 0;
    });

    allMembers.forEach(m => {
        const tr = document.createElement('tr');
        
        const teamInfo = m.isTeam ? 
            `<span style="color:#00e4ff; font-weight:bold;">${m.teamName || ('#' + m.racerBib)}</span>` : 
            `<span style="color:#ff9800; font-weight:bold;">Egyéni jelentkező</span>`;

        tr.innerHTML = `
            <td data-label="Kiválaszt"><input type="checkbox" class="dragon-member-check" value="${m.id}"></td>
            <td data-label="Név" style="font-weight:bold;">
                <span style="cursor: pointer; color: var(--accent-primary); text-decoration: underline;" onclick="window.raceManager.openEditModal('${m.racerId}', '${m.id}')" title="Versenyző szerkesztése">${m.name}</span>
            </td>
            <td data-label="Szül.idő">${m.birth_date || '-'}</td>
            <td data-label="Ötpróba ID">${m.otproba_id || '-'}</td>
            <td data-label="Kategória" style="font-size:0.8rem; color:#ccc;">${rm.formatCategoryName(m.category) || '-'}</td>
            <td data-label="Aktuális Egység" style="font-size:0.8rem; color:#888;">
                ${teamInfo}
            </td>
        `;
        tbody.appendChild(tr);
    });
}
window.renderTeamManager = renderTeamManager;

window.selectExistingDragonTeam = (val) => {
    const bibInput = document.getElementById('new-team-bib');
    const nameInput = document.getElementById('new-team-name');
    const inputsContainer = document.getElementById('new-team-inputs-container');
    const submitBtn = document.getElementById('btn-submit-dragon-team');
    
    if (val === 'REMOVE') {
        if (inputsContainer) inputsContainer.style.display = 'none';
        if (submitBtn) {
            submitBtn.innerHTML = '❌ KIJELÖLTEK ELTÁVOLÍTÁSA A CSAPATBÓL';
            submitBtn.style.background = '#dc3545';
        }
    } else if (val) {
        try {
            const data = JSON.parse(val);
            if (bibInput) bibInput.value = data.bib || '';
            if (nameInput) nameInput.value = data.name || '';
            
            if (inputsContainer) inputsContainer.style.display = 'none';
            if (submitBtn) {
                submitBtn.innerHTML = `BEOSZTÁS A(Z) "${data.name}" CSAPATBA`;
                submitBtn.style.background = '#28a745';
            }
        } catch(e) {}
    } else {
        if (bibInput) bibInput.value = '';
        if (nameInput) nameInput.value = '';
        
        if (inputsContainer) inputsContainer.style.display = 'flex';
        if (submitBtn) {
            submitBtn.innerHTML = 'ÚJ EGYSÉG LÉTREHOZÁSA';
            submitBtn.style.background = 'var(--accent-primary)';
        }
    }
};

window.selectAllDragonMembers = (checked) => {
    document.querySelectorAll('.dragon-member-check:not(:disabled)').forEach(cb => cb.checked = checked);
};

window.createDragonTeam = async () => {
    const selectedIds = Array.from(document.querySelectorAll('.dragon-member-check:checked')).map(cb => cb.value);
    const bibInput = document.getElementById('new-team-bib');
    const bib = bibInput ? bibInput.value : '';
    const nameInput = document.getElementById('new-team-name');
    const name = nameInput ? nameInput.value : '';
    const teamSelect = document.getElementById('existing-dragon-teams-select');
    const val = teamSelect ? teamSelect.value : '';

    if (val === 'REMOVE') {
        if (selectedIds.length === 0) {
            showToast("Válassz ki legalább egy versenyzőt az eltávolításhoz!", "error");
            return;
        }
        if (!confirm("Biztosan kiveszed a kijelölt versenyzőket a jelenlegi csapatukból? (Egyéni versenyzőkké válnak)")) return;

        try {
            const response = await fetch(`${API_URL}/remove-from-dragon-team`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.raceManager.adminPassword}`
                },
                body: JSON.stringify({ memberIds: selectedIds })
            });
            const result = await response.json();
            if (response.ok) {
                showToast(`Sikeres eltávolítás!`, "success");
                teamSelect.value = '';
                window.selectExistingDragonTeam('');
                await window.raceManager.loadData();
                renderTeamManager();
                window.renderAdminTable();
            } else {
                showToast(result.error, "error");
            }
        } catch (err) {
            showToast("Hiba a hálózati kapcsolatban!", "error");
        }
        return;
    }

    if (!bib && !name) {
        showToast("Adja meg a csapat nevét vagy a rajtszámát!", "error");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/create-dragon-team`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.raceManager.adminPassword}`
            },
            body: JSON.stringify({ memberIds: selectedIds, bib, name })
        });
        const result = await response.json();
        if (response.ok) {
            showToast(`Sikeres csapatépítés! #${result.bib || bib} egység feldolgozva.`, "success");
            const teamSelect = document.getElementById('existing-dragon-teams-select');
            if (teamSelect) {
                teamSelect.value = '';
                window.selectExistingDragonTeam('');
            }
            await window.raceManager.loadData();
            renderTeamManager();
            window.renderAdminTable();
        } else {
            showToast(result.error, "error");
        }
    } catch (err) {
        showToast("Hiba a szerver kapcsolatban!", "error");
    }
};

window.generateDiploma = async (bibStr) => {
    const bib = parseInt(bibStr);
    if (isNaN(bib)) {
        showToast("Kérjük, adjon meg egy érvényes rajtszámot!", "error");
        return;
    }

    const rm = window.raceManager;
    if (!rm || !rm.data || !rm.data.racers) {
        showToast("Az adatok még nem töltődtek be!", "error");
        return;
    }

    const racer = rm.data.racers.find(r => r.bib === bib);
    if (!racer) {
        showToast("Nincs ilyen rajtszámmal rendelkező versenyző!", "error");
        return;
    }

    showToast("Oklevél generálása folyamatban...", "info");

    try {
        // Helyezés kiszámítása
        const categoryRacers = rm.data.racers.filter(r => r.category === racer.category && r.distance === racer.distance);
        const sorted = categoryRacers.sort((a, b) => {
            if (a.status === 'finished' && b.status !== 'finished') return -1;
            if (a.status !== 'finished' && b.status === 'finished') return 1;
            if (a.status === 'finished' && b.status === 'finished') return (a.total_time || 0) - (b.total_time || 0);
            return (a.bib || 0) - (b.bib || 0);
        });

        let rankStr = "-";
        if (racer.status === 'finished') {
            const index = sorted.findIndex(r => r.bib === bib);
            if (index !== -1) rankStr = (index + 1).toString();
        }

        const name = formatRacerName(racer);
        const categoryName = rm.formatCategoryName(racer.category);
        const distanceStr = racer.distance;

        // PDF Letöltése és betöltése
        const existingPdfBytes = await fetch('Dunakeszi.pdf').then(res => {
            if (!res.ok) throw new Error("Nem található a Dunakeszi.pdf fájl a szerveren!");
            return res.arrayBuffer();
        });

        if (!window.PDFLib) {
            throw new Error("A PDF-lib könyvtár nem töltődött be!");
        }

        const { PDFDocument, rgb } = window.PDFLib;
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        
        if (window.fontkit) {
            pdfDoc.registerFontkit(window.fontkit);
        }

        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();

        // Használjuk a beépített Helvetica betűtípust
        const fontBold = await pdfDoc.embedFont(window.PDFLib.StandardFonts.HelveticaBold);
        const fontNormal = await pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);

        const drawCenteredText = (text, centerX, y, size, fontUsed, color) => {
            const safeText = text.replace(/ő/g, 'ö').replace(/Ő/g, 'Ö').replace(/ű/g, 'ü').replace(/Ű/g, 'Ü');
            const textWidth = fontUsed.widthOfTextAtSize(safeText, size);
            firstPage.drawText(safeText, {
                x: centerX - textWidth / 2,
                y: y,
                size: size,
                font: fontUsed,
                color: color || rgb(0, 0, 0)
            });
        };

        const darkBlue = rgb(0.05, 0.2, 0.35);
        const isPlural = (racer.members && racer.members.length > 1) || /csapat/i.test(name) || /s[aá]rk[aá]ny/i.test(racer.category || '');
        const reszereText = isPlural ? "részükre, akik" : "részére, aki";
        const elerteText = isPlural ? "értek el" : "ért el";

        let resultText = "";
        if (rankStr !== "-") {
            resultText = `${rankStr}. helyezést ${elerteText}`;
        } else {
            resultText = isPlural ? "sikeresen teljesítették a távot" : "sikeresen teljesítette a távot";
        }

        const centerX = width * 0.71;

        drawCenteredText(name, centerX, height * 0.68, 28, fontBold, darkBlue);
        drawCenteredText(reszereText, centerX, height * 0.62, 16, fontNormal, darkBlue);
        drawCenteredText("az Országos Vízitúra Bajnokság", centerX, height * 0.56, 18, fontBold, darkBlue);
        drawCenteredText("2. fordulóján a Dunakeszi Vízitúra Futamon a", centerX, height * 0.50, 16, fontNormal, darkBlue);
        drawCenteredText(`${categoryName} (${distanceStr}) kategóriában`, centerX, height * 0.44, 22, fontBold, darkBlue);
        drawCenteredText(resultText, centerX, height * 0.38, 26, fontBold, darkBlue);

        const pdfBytes = await pdfDoc.save();

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Oklevel_${racer.bib}_${name.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast("Az oklevél sikeresen letöltve!", "success");

    } catch (err) {
        console.error("PDF hiba:", err);
        showToast("Hiba történt az oklevél generálása során: " + err.message, "error");
    }
};
