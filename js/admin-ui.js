/**
 * --- ADMINISZTRÁCIÓS FELÜLET RÉTEG (ADMIN UI LAYER) ---
 * Az adminisztrátori felület specifikus megjelenítési logikája,
 * táblázatok és vezérlőgombok koordinálása.
 */

import { showToast, formatTime, formatMemberListHtml, formatRacerName, formatOtprobaListHtml } from './ui-utils.js';
import { API_URL } from './api.js';

// Komponensek és Export funkciók importálása
import { renderAdminCharts } from './components/admin-charts.js';
import { exportResultsToExcel, exportFilteredTableToExcel, exportOtprobaExcel } from './export/excel-export.js';
import { renderTeamManager, renderExistingTeamsGrid } from './components/team-manager-ui.js';

// Újra-exportálás a meglévő hivatkozások zökkenőmentes működéséhez
export {
    renderAdminCharts,
    exportResultsToExcel,
    exportFilteredTableToExcel,
    exportOtprobaExcel,
    renderTeamManager,
    renderExistingTeamsGrid
};


export function renderAdminTable(filterType = 'all') {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!window.raceManager || !window.raceManager.data.racers || window.raceManager.data.racers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nincs rögzített adat</td></tr>';
        return;
    }

    // Regisztráljuk a rendezési függvényt globálisan, ha még nincs
    if (!window.sortAdminTable) {
        window.adminTableSortCol = 'bib';
        window.adminTableSortDir = 'asc';
        window.sortAdminTable = col => {
            const currentCol = window.adminTableSortCol || 'bib';
            const currentDir = window.adminTableSortDir || 'asc';

            if (currentCol === col) {
                window.adminTableSortDir = currentDir === 'asc' ? 'desc' : 'asc';
            } else {
                window.adminTableSortCol = col;
                window.adminTableSortDir = 'asc';
            }

            renderAdminTable(window.currentTableFilter || 'all');
        };
    }

    const thead = document.querySelector('#admin-table thead');
    if (thead) {
        const sortCol = window.adminTableSortCol || 'bib';
        const sortDir = window.adminTableSortDir || 'asc';
        const getIndicator = col => {
            if (sortCol === col) {
                return sortDir === 'asc' ? ' ▲' : ' ▼';
            }
            return ' ⇅';
        };

        thead.innerHTML = `
            <tr>
                <th onclick="window.sortAdminTable('bib')" style="cursor: pointer; user-select: none; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">Rajtszám${getIndicator('bib')}</th>
                <th onclick="window.sortAdminTable('name')" style="cursor: pointer; user-select: none; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">Egység Tagjai${getIndicator('name')}</th>
                <th style="user-select: none;">Ötpróba ID</th>
                <th onclick="window.sortAdminTable('category')" style="cursor: pointer; user-select: none; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">Kategória${getIndicator('category')}</th>
                <th onclick="window.sortAdminTable('distance')" style="cursor: pointer; user-select: none; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">Táv${getIndicator('distance')}</th>
                <th onclick="window.sortAdminTable('status')" style="cursor: pointer; user-select: none; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">Státusz${getIndicator('status')}</th>
                <th onclick="window.sortAdminTable('time')" style="cursor: pointer; user-select: none; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">Időeredmény${getIndicator('time')}</th>
                <th onclick="window.sortAdminTable('checked_in')" style="cursor: pointer; user-select: none; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">Megjelent${getIndicator('checked_in')}</th>
                <th onclick="window.sortAdminTable('is_paid')" style="cursor: pointer; user-select: none; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background=''">Barion${getIndicator('is_paid')}</th>
                <th>Művelet</th>
            </tr>
        `;
    }

    let racers = [...window.raceManager.data.racers].filter(r => r && r.status);

    // Alkalmazzuk a szűrőt
    if (filterType === '22km') {
        racers = racers.filter(r => r.distance === '22km');
    } else if (filterType === '11km') {
        // 11km-esek, kivéve a sárkányhajó kategóriát
        racers = racers.filter(r => r.distance === '11km' && !/s[aá]rk[aá]ny/i.test(r.category || ''));
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
            const catMatch =
                r.category && window.raceManager.formatCategoryName(r.category).toLowerCase().includes(query);
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
                        team_size_was_larger: true,
                    });
                });
            } else {
                displayRacers.push(r);
            }
        } else {
            displayRacers.push(r);
        }
    });

    const sortCol = window.adminTableSortCol || 'bib';
    const sortDir = window.adminTableSortDir || 'asc';
    const dirMultiplier = sortDir === 'asc' ? 1 : -1;

    displayRacers.sort((a, b) => {
        let valA, valB;

        if (sortCol === 'bib') {
            valA = a.bib || 0;
            valB = b.bib || 0;
        } else if (sortCol === 'name') {
            const realA = (a.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
            const realB = (b.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
            valA = (realA[0] ? realA[0].name : a.name) || '';
            valB = (realB[0] ? realB[0].name : b.name) || '';
        } else if (sortCol === 'category') {
            valA = a.category || '';
            valB = b.category || '';
        } else if (sortCol === 'distance') {
            valA = a.distance || '';
            valB = b.distance || '';
        } else if (sortCol === 'status') {
            valA = a.status || '';
            valB = b.status || '';
        } else if (sortCol === 'time') {
            valA = a.total_time || 0;
            valB = b.total_time || 0;
        } else if (sortCol === 'checked_in') {
            valA = a.team_size_was_larger && a.members && a.members[0] ? !!a.members[0].checked_in : !!a.checked_in;
            valB = b.team_size_was_larger && b.members && b.members[0] ? !!b.members[0].checked_in : !!b.checked_in;
        } else if (sortCol === 'is_paid') {
            valA = !!a.is_paid;
            valB = !!b.is_paid;
        } else {
            valA = a.bib || 0;
            valB = b.bib || 0;
        }

        if (valA === valB) {
            if (sortCol === 'bib') {
                const realA = (a.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
                const realB = (b.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
                const nameA = (realA[0] ? realA[0].name : a.name) || '';
                const nameB = (realB[0] ? realB[0].name : b.name) || '';
                return nameA.localeCompare(nameB);
            } else {
                return (a.bib || 0) - (b.bib || 0);
            }
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
            return valA.localeCompare(valB) * dirMultiplier;
        }
        if (typeof valA === 'boolean' && typeof valB === 'boolean') {
            return ((valA ? 1 : 0) - (valB ? 1 : 0)) * dirMultiplier;
        }
        return (valA - valB) * dirMultiplier;
    });

    displayRacers.forEach(r => {
        const tr = document.createElement('tr');
        let statusColor = 'white';
        let dataStartAttr = '';

        if (r.status === 'running') {
            statusColor = 'var(--accent-primary)';
            tr.className = 'status-running';
            dataStartAttr = `data-start="${r.start_time || 0}"`;
        } else if (r.status === 'finished') {
            statusColor = '#00FFCC';
        } else if (r.status === 'duplicate') {
            statusColor = '#FFA500'; // Narancs
            tr.style.background = 'rgba(255, 165, 0, 0.15)';
        }

        let timeStr = '00:00:00.000';
        if (r.status === 'running') {
            timeStr = formatTime(Date.now() + (window.raceManager.serverTimeOffset || 0) - (r.start_time || 0));
        } else if (r.status === 'finished') {
            timeStr = formatTime(r.total_time || 0);
        }

        const memberList = formatMemberListHtml(r);
        const otprobaList = formatOtprobaListHtml(r);

        const isChecked =
            r.team_size_was_larger && r.members && r.members[0] ? !!r.members[0].checked_in : !!r.checked_in;
        const isPaid = !!r.is_paid;

        const checkInHtml =
            r.team_size_was_larger && r.members && r.members[0]
                ? `<input type="checkbox" style="transform: scale(1.5)" ${isChecked ? 'checked' : ''} onchange="window.raceManager.updateMemberStatus('${r.members[0].id}', 'checked_in', this.checked).then(res => { if(res) { window.raceManager.renderWaitingListCards(); window.raceManager.renderRunningListCards(); } })">`
                : `<input type="checkbox" style="transform: scale(1.5)" ${isChecked ? 'checked' : ''} onchange="window.raceManager.updateRacerStatus('${r.id}', 'checked_in', this.checked).then(res => { if(res) { window.raceManager.renderWaitingListCards(); window.raceManager.renderRunningListCards(); } })">`;
        const paidHtml = isPaid
            ? `<span style="background:#5BB226; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold; cursor:pointer;" onclick="if(confirm('Mégis visszaállítod fizetetlenre?')) window.raceManager.updateRacerStatus('${r.id}', 'is_paid', false).then(() => renderAdminTable(window.currentTableFilter))">Befizetve</span>`
            : `<button onclick="window.raceManager.updateRacerStatus('${r.id}', 'is_paid', true).then(() => renderAdminTable(window.currentTableFilter))" class="action-btn" style="background:transparent; border:1px solid #5BB226; color:#5BB226; padding:2px 8px; font-size:0.8rem;">Függőben</button>`;

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
                ${
                    r.status === 'duplicate'
                        ? `
                <button class="action-btn" onclick="if(confirm('Biztosan érvényesíted a nevezést?')) window.raceManager.updateRacerStatus('${r.id}', 'status', 'registered').then(() => renderAdminTable(window.currentTableFilter))" style="background:#5BB226; color:white; padding: 5px 8px; font-size: 0.8rem; border-radius: 6px; font-weight:bold;" title="Érvényesítés">✅ ÉRVÉNYESÍT</button>
                `
                        : ''
                }
                ${
                    r.status === 'running'
                        ? `
                <button class="action-btn" onclick="if(confirm('Biztosan DNF (Feladta) státuszba teszed?')) window.raceManager.updateRacerStatus('${r.id}', 'status', 'dnf').then(() => renderAdminTable(window.currentTableFilter))" style="background:#FFA500; color:black; padding: 5px 8px; font-size: 0.8rem; border-radius: 6px; margin-right: 5px; font-weight:bold;" title="Feladta">DNF</button>
                <button class="action-btn" onclick="if(confirm('Biztosan DSQ (Kizárva) státuszba teszed?')) window.raceManager.updateRacerStatus('${r.id}', 'status', 'dsq').then(() => renderAdminTable(window.currentTableFilter))" style="background:#800080; color:white; padding: 5px 8px; font-size: 0.8rem; border-radius: 6px; font-weight:bold;" title="Kizárva">DSQ</button>
                `
                        : ''
                }
                ${
                    r.status === 'finished' || r.status === 'dnf' || r.status === 'dsq'
                        ? `
                <button class="action-btn" onclick="if(confirm('Biztosan visszarakod ezt a versenyzőt a futamába? Az ideje folytatódni fog a kategóriája idejével.')) window.raceManager.resumeRacer('${r.id}').then(() => renderAdminTable(window.currentTableFilter))" style="background:#007bff; color:white; padding: 5px 8px; font-size: 0.8rem; border-radius: 6px; font-weight:bold; margin-right: 5px;" title="Visszarakás futamba">🏃 VISSZARAK FUTAMBA</button>
                `
                        : ''
                }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// globális kereső támogatása
window.adminSearchQuery = '';
window.handleTableSearch = query => {
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
                ${
                    isRunning
                        ? `
                    <button onclick="window.stopCategory(null, null, 'MASS_START_ALL')" class="btn-stop" style="width: 100%; margin: 0; min-height: 42px; border-radius: 10px; font-weight: 700;">
                        🛑 STOP
                    </button>
                `
                        : ''
                }
            </div>
        `;
    }

    // --- 2. Távolság Rajt ---
    const distanceContainer = document.getElementById('distance-start-ctrl');
    if (distanceContainer) {
        distanceContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                ${['11km', '22km', '4km']
                    .map(dist => {
                        const isRunning = !!rm.data.categories[`DISTANCE_${dist}`];
                        return `
                        <div style="display: flex; gap: 10px; align-items: center; background: rgba(0,228,255,0.03); padding: 10px; border-radius: var(--border-radius-md); border: 1px solid rgba(0,228,255,0.1);">
                            <button onclick="window.startDistance('${dist}')" class="btn-start" style="flex:2; height: 45px; font-weight: 700; ${isRunning ? 'opacity:0.4;' : ''}" ${isRunning ? 'disabled' : ''}>
                                ${dist} RAJT
                            </button>
                            ${isRunning ? `<button onclick="window.stopCategory(null, null, 'DISTANCE_${dist}')" class="btn-stop" style="flex:1; height: 45px; font-weight: 700; border-radius: 10px;">STOP</button>` : ''}
                        </div>
                    `;
                    })
                    .join('')}
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
            availableStarts.push({
                id: groupId,
                name: rm.groupMap[groupId].replace('Összes ', ''),
                type: 'group',
                isRunning,
            });
        });

        Object.keys(rm.categoryMap).forEach(catId => {
            ['11km', '22km', '4km'].forEach(dist => {
                const key = `${catId}_${dist}`;
                const isSup = catId.includes('sup');
                const isSarkany = /s[aá]rk[aá]ny/i.test(catId || '');
                const hasDistSuffix = catId.endsWith(`_${dist}`);
                const hasOtherDistSuffix =
                    (dist !== '11km' && catId.endsWith('_11km')) ||
                    (dist !== '22km' && catId.endsWith('_22km')) ||
                    (dist !== '4km' && catId.endsWith('_4km'));

                let isDistanceMatch;
                if (hasDistSuffix) isDistanceMatch = true;
                else if (hasOtherDistSuffix) isDistanceMatch = false;
                else if (isSup)
                    isDistanceMatch = dist === '4km' || dist === '22km' || dist === '11km'; // SUP can be multiple
                else if (isSarkany) isDistanceMatch = dist === '11km';
                else isDistanceMatch = dist === '11km' || dist === '22km';

                if (isDistanceMatch) {
                    const isRunning = !!rm.data.categories[key];
                    const inExistingGroup = availableStarts.some(
                        s => s.type === 'group' && rm.belongsToGroup({ category: catId, distance: dist }, s.id)
                    );
                    if (!inExistingGroup) {
                        availableStarts.push({
                            id: key,
                            name: rm.formatCategoryName(key),
                            type: 'category',
                            isRunning,
                        });
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
                div.style =
                    'display:flex; gap:10px; margin-bottom:10px; background:rgba(0,228,255,0.03); padding:8px; border-radius:10px; border:1px solid rgba(0,228,255,0.08);';
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
 * Nevezettek kategóriánkénti választófelülete (Kártyás elrendezés)
 */
export function renderAdminCategoryList() {
    const rm = window.raceManager;
    const container = document.getElementById('admin-category-cards-container');
    if (!rm || !container) return;

    container.innerHTML = '';

    const distances = [
        { id: '11km', title: '📐 Rövid táv' },
        { id: '22km', title: '📏 Hosszú táv' },
        { id: '4km', title: '🛶 SUP 4 km' },
    ];

    distances.forEach(dist => {
        const distHeader = document.createElement('h2');
        distHeader.className = 'section-title';
        distHeader.style =
            'margin-top: 30px; border-left: 5px solid var(--accent-primary); padding-left: 15px; background: rgba(0,228,255,0.05); padding: 10px 15px; border-radius: 4px;';
        distHeader.textContent = dist.title;
        container.appendChild(distHeader);

        const grid = document.createElement('div');
        grid.style =
            'display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;';

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

            let namesListHtml;
            if (hasRacers) {
                const names = racers
                    .slice(0, 3)
                    .map(r => {
                        const name = formatRacerName(r);
                        return `<div style="font-size: 0.72rem; color: #bbb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px;">• ${name}</div>`;
                    })
                    .join('');
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
        noResults.style =
            'text-align: center; padding: 50px; background: rgba(255,255,255,0.02); border-radius: 15px; border: 1px dashed rgba(255,255,255,0.1);';
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
    racers
        .sort((a, b) => {
            const bibDiff = (a.bib || 0) - (b.bib || 0);
            if (bibDiff !== 0) return bibDiff;
            const realA = (a.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
            const realB = (b.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
            const nameA = (realA[0] ? realA[0].name : a.name) || '';
            const nameB = (realB[0] ? realB[0].name : b.name) || '';
            return nameA.localeCompare(nameB);
        })
        .forEach(r => {
            const tr = document.createElement('tr');
            let statusColor = 'white';
            let dataStartAttr = '';

            if (r.status === 'running') {
                statusColor = 'var(--accent-primary)';
                tr.className = 'status-running';
                dataStartAttr = `data-start="${r.start_time || 0}"`;
            } else if (r.status === 'finished') {
                statusColor = '#00FFCC';
            } else if (r.status === 'duplicate') {
                statusColor = '#FFA500';
                tr.style.background = 'rgba(255, 165, 0, 0.15)';
            }

            let timeStr = '00:00:00.000';
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
            const paidHtml = isPaid
                ? `<span style="background:#5BB226; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold; cursor:pointer;" onclick="if(confirm('Mégis visszaállítod fizetetlenre?')) window.raceManager.updateRacerStatus('${r.id}', 'is_paid', false).then(() => window.renderAdminCategoryDetail('${distId}', '${catId}'))">Befizetve</span>`
                : `<button onclick="window.raceManager.updateRacerStatus('${r.id}', 'is_paid', true).then(() => window.renderAdminCategoryDetail('${distId}', '${catId}'))" class="action-btn" style="background:transparent; border:1px solid #5BB226; color:#5BB226; padding:2px 8px; font-size:0.8rem;">Függőben</button>`;

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
                    ${
                        r.status === 'duplicate'
                            ? `
                    <button class="action-btn" onclick="if(confirm('Biztosan érvényesíted a nevezést?')) window.raceManager.updateRacerStatus('${r.id}', 'status', 'registered').then(() => window.renderAdminCategoryDetail('${distId}', '${catId}'))" style="background:#5BB226; color:white; padding: 6px 12px; font-size: 0.75rem; border-radius: 6px; font-weight:bold; margin:0;" title="Érvényesítés">✅ ÉRVÉNYESÍT</button>
                    `
                            : ''
                    }
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
        showToast('Egyszerre maximum 3 módosítási sor lehet nyitva!', 'error');
        return;
    }

    const rowIdx = Date.now(); // Egyedi azonosító a sornak
    const div = document.createElement('div');
    div.className = 'bib-mod-row admin-card';
    div.style = 'padding: 20px; position: relative; animation: fadeIn 0.3s ease-out;';

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
        infoContainer.innerHTML =
            '<span style="color: var(--text-secondary); font-style: italic; font-size: 0.9rem;">Írj be egy rajtszámot a kereséshez...</span>';
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
        infoContainer.style.border = '1px solid rgba(0, 145, 255, 0.2)';
        infoContainer.style.background = 'rgba(0, 145, 255, 0.05)';
        saveCtrl.classList.remove('hidden');
        // Eltároljuk az azonosítót a mentéshez
        saveCtrl.dataset.racerId = racer.id;
    } else {
        infoContainer.innerHTML =
            '<span style="color: #ff4d4d; font-size: 0.9rem;">⚠️ Nincs ilyen rajtszámú versenyző!</span>';
        infoContainer.style.border = '1px dashed rgba(255, 77, 77, 0.3)';
        infoContainer.style.background = 'rgba(255, 77, 77, 0.05)';
        saveCtrl.classList.add('hidden');
    }
};

/**
 * Mentés wrapper
 */
window.saveBibChange = async rowIdx => {
    const saveCtrl = document.getElementById(`save-ctrl-${rowIdx}`);
    const racerId = saveCtrl.dataset.racerId;
    const newBib = document.getElementById(`new-bib-${rowIdx}`).value;

    if (!newBib) {
        showToast('Kérlek adj meg egy új rajtszámot!', 'error');
        return;
    }

    try {
        const success = await window.raceManager.updateRacerBib(racerId, newBib);
        if (success) {
            const row = saveCtrl.closest('.bib-mod-row');
            row.style.opacity = '0.5';
            row.style.pointerEvents = 'none';
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
        console.error('Save error in admin-ui:', err);
        showToast('Hiba a mentés során!', 'error');
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
            headers: { Authorization: `Bearer ${window.raceManager.adminPassword}` },
        });

        if (!response.ok) {
            tbody.innerHTML =
                '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #ff4d4d;">Hiba az adatok lekérésekor</td></tr>';
            return;
        }

        const history = await response.json();

        if (!Array.isArray(history) || history.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-secondary);">Nincsenek előzmények</td></tr>';
            return;
        }

        tbody.innerHTML = history
            .map(
                entry => `
            <tr>
                <td>${new Date(entry.timestamp).toLocaleString('hu-HU')}</td>
                <td style="font-weight: bold;">${entry.racerName}</td>
                <td style="text-align: center; color: var(--text-secondary);">${entry.oldBib}</td>
                <td style="text-align: center; color: var(--accent-primary); font-weight: bold;">${entry.newBib}</td>
            </tr>
        `
            )
            .join('');
    } catch (err) {
        console.error('History render error:', err);
        tbody.innerHTML =
            '<tr><td colspan="4" style="text-align:center; color: #ff4d4d; padding: 20px;">Hiba az előzmények betöltésekor</td></tr>';
    }
}
window.renderBibHistory = renderBibHistory;

/**
 * Előzmények törlése megerősítéssel
 */
export function clearBibHistory() {
    window.showConfirmModal('Biztosan törölni akarod a rajtszám módosítási előzményeket?', async () => {
        try {
            const response = await fetch(`${API_URL}/bib-history`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${window.raceManager.adminPassword}` },
            });
            if (response.ok) {
                showToast('Előzmények törölve.', 'success');
                renderBibHistory();
            } else {
                showToast('Sikertelen törlés.', 'error');
            }
        } catch (err) {
            showToast('Szerver hiba a törléskor.', 'error');
        }
    });
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
            racers = racers.filter(r => r.distance === filterType && !/s[aá]rk[aá]ny/i.test(r.category || ''));
        }
    }

    // Rendezés időeredmény szerint (növekvő)
    racers.sort((a, b) => (a.total_time || 0) - (b.total_time || 0));

    if (racers.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--text-secondary); font-style: italic;">Nincs beérkezett eredmény a szűrésnek megfelelően</td></tr>';
        return;
    }

    const thead = document.querySelector('#admin-results-table thead tr');
    const showFordulo = filterType === '22km' || filterType === 'all';

    if (thead) {
        thead.innerHTML = `
            <th style="width: 8%">Helyezés</th>
            <th style="width: 10%">Rajtszám</th>
            <th style="width: ${showFordulo ? '25%' : '35%'}">Egység Tagjai</th>
            <th style="width: 15%">Kategória</th>
            <th style="width: 10%">Táv</th>
            ${showFordulo ? '<th style="width: 10%">Forduló idő (11km)</th>' : ''}
            <th style="width: 10%">Időeredmény</th>
            <th style="width: 10%">Különbség</th>
            <th style="width: 10%; text-align: center;">Oklevél</th>
        `;
    }

    racers.forEach((r, idx) => {
        const tr = document.createElement('tr');
        const memberList = r.members ? r.members.map(m => m.name).join(', ') : r.name || '-';
        const rank = idx + 1;
        const rankDecor =
            rank <= 3 ? `font-weight: 800; color: ${rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32'}` : '';

        const cp = (rm.data.checkpoints || []).find(
            c => c.racer_bib === r.bib && c.checkpoint_name === '22km_tav_11km_fordulo'
        );
        const forduloTd = showFordulo
            ? `<td data-label="Forduló (11km)" style="font-family:'Space Mono'; color:#ff9900;">${cp ? formatTime(cp.timestamp - r.start_time) : '-'}</td>`
            : '';

        const gapStr = idx === 0 ? 'Leader' : `+${formatTime(r.total_time - racers[0].total_time)}`;

        let certificateHtml;
        const isDragon = /s[aá]rk[aá]ny/i.test(r.category || '');
        if (isDragon && r.members && r.members.length > 0) {
            const memberOptions = r.members
                .filter(m => m.otproba_id !== 'CSAPATNEV')
                .map(m => `<option value="${m.name.replace(/"/g, '&quot;')}">${m.name}</option>`)
                .join('');
            certificateHtml = `
                <div style="display: inline-flex; align-items: center; gap: 5px; justify-content: center; width: 100%;">
                    <select id="cert-select-${r.id}" style="padding: 4px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.4); color: white; font-family: inherit; max-width: 130px;">
                        ${memberOptions}
                    </select>
                    <button onclick="window.generateCertificate('${r.id}', document.getElementById('cert-select-${r.id}').value)" class="action-btn" style="background:#5BB226; color:white; border:none; padding:4px 8px; font-size:0.75rem; border-radius:4px; font-weight:bold; margin:0;" title="Oklevél letöltése">📜 LETÖLTÉS</button>
                </div>
            `;
        } else {
            certificateHtml = `<button onclick="window.generateCertificate('${r.id}')" class="action-btn" style="background:#5BB226; color:white; border:none; padding:4px 8px; font-size:0.75rem; border-radius:4px; font-weight:bold; margin:0;" title="Oklevél letöltése">📜 LETÖLTÉS</button>`;
        }

        tr.innerHTML = `
            <td data-label="Helyezés" style="${rankDecor}">${rank}.</td>
            <td data-label="Rajtszám"><strong>#${(r.bib || 0).toString().padStart(3, '0')}</strong></td>
            <td data-label="Egység Tagjai">${memberList}</td>
            <td data-label="Kategória">${rm.formatCategoryName(r.category)}</td>
            <td data-label="Táv">${r.distance || '-'}</td>
            ${forduloTd}
            <td data-label="Időeredmény" style="font-family:'Space Mono'; font-weight:bold; color:var(--accent-primary);">${formatTime(r.total_time || 0)}</td>
            <td data-label="Különbség" style="font-family:'Space Mono'; color: ${idx === 0 ? 'var(--success)' : '#aaa'}">${gapStr}</td>
            <td data-label="Oklevél" style="text-align: center;">
                ${certificateHtml}
            </td>
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

        // Egyedi kategóriák gyűjtése ehhez a távhoz (összevonásokat figyelembe véve)
        const relevantCats = new Set();
        rm.data.racers
            .filter(r => r.distance === dist)
            .forEach(r => {
                const effectiveCat = rm.getEffectiveCategory(r.category);
                relevantCats.add(effectiveCat);
            });

        const sortedCats = Array.from(relevantCats).sort();

        sortedCats.forEach(catId => {
            const finishers = rm.data.racers.filter(
                r => rm.getEffectiveCategory(r.category) === catId && r.distance === dist && r.status === 'finished'
            );

            const card = document.createElement('div');
            card.className = 'landing-card';
            card.style =
                'padding: 20px; text-align: left; align-items: flex-start; cursor: pointer; min-height: auto; transition: all 0.2s;';
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
    const finishersSarkany = rm.data.racers.filter(
        r => /s[aá]rk[aá]ny/i.test(r.category || '') && r.status === 'finished'
    );
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
    const contentEl = document.getElementById('admin-results-category-detail-content');
    const titleEl = document.getElementById('admin-results-category-detail-title');
    if (!contentEl) return;
    contentEl.innerHTML = '';

    const rm = window.raceManager;
    if (!rm) return;

    const formattedCatName = rm.formatCategoryName(catId);
    if (titleEl) {
        titleEl.textContent = `🥇 ${formattedCatName} - Rangsor (${distId})`;
        titleEl.classList.remove('hidden');
    }

    // Szűrés kategória és táv szerint
    let finishers = [];
    if (catId === 'sarkany') {
        finishers = rm.data.racers.filter(r => {
            if (!/s[aá]rk[aá]ny/i.test(r.category || '') || r.status !== 'finished') return false;
            // Csak a már csapatba beosztottak jelennek meg az eredményeknél:
            const isTeam = r.id.startsWith('DRAGON_') || (r.members && r.members.length > 1);
            return isTeam;
        });
    } else {
        const baseCatId = catId.replace(/_(11km|22km|4km)$/, '');
        finishers = rm.data.racers.filter(r => {
            const effectiveCat = rm.getEffectiveCategory(r.category);
            const rBaseCat = (effectiveCat || '').replace(/_(11km|22km|4km)$/, '');
            return (
                (effectiveCat === catId || rBaseCat === baseCatId) && r.distance === distId && r.status === 'finished'
            );
        });
    }

    // Rendezés időeredmény szerint
    finishers.sort((a, b) => (a.total_time || 0) - (b.total_time || 0));

    // Export gomb hozzáadása felülre
    const headerBar = document.createElement('div');
    headerBar.style = 'margin-bottom: 20px; display: flex; justify-content: flex-end;';
    headerBar.innerHTML = `
        <button onclick="window.exportCategoryResultsExcel()" class="btn-primary" style="background: #28a745; width: auto; font-size: 0.8rem; padding: 8px 20px;">
            📥 EXCEL EXPORT (CSAK EZ A RANGSOR)
        </button>
    `;
    contentEl.appendChild(headerBar);

    if (finishers.length === 0) {
        const noResults = document.createElement('div');
        noResults.style =
            'text-align: center; padding: 50px; background: rgba(255,255,255,0.02); border-radius: 15px; border: 1px dashed rgba(255,255,255,0.1);';
        noResults.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 15px;">🏜️</div>
            <h3 style="color: #888;">Még nincs beérkezett eredmény ebben a kategóriában.</h3>
        `;
        contentEl.appendChild(noResults);
        return;
    }

    const tableDiv = document.createElement('div');
    tableDiv.className = 'table-responsive';

    const showFordulo = distId === '22km';
    tableDiv.innerHTML = `
        <table class="results-table">
            <thead>
                <tr>
                    <th style="width: 10%">Helyezés</th>
                    <th style="width: 15%">Rajtszám</th>
                    <th style="width: ${showFordulo ? '30%' : '40%'}">Egység Tagjai</th>
                    ${showFordulo ? '<th style="width: 15%">Forduló idő (11km)</th>' : ''}
                    <th style="width: 15%">Időeredmény</th>
                    <th style="width: 15%">Különbség</th>
                    <th style="width: 10%; text-align: center;">Oklevél</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    const tbody = tableDiv.querySelector('tbody');
    contentEl.appendChild(tableDiv);

    finishers.forEach((r, idx) => {
        const tr = document.createElement('tr');
        const memberList = r.members ? r.members.map(m => m.name).join(', ') : r.name || '-';
        const rank = idx + 1;
        const rankDecor =
            rank <= 3 ? `font-weight: 800; color: ${rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32'}` : '';

        const cp = (rm.data.checkpoints || []).find(
            c => c.racer_bib === r.bib && c.checkpoint_name === '22km_tav_11km_fordulo'
        );
        const forduloTd =
            distId === '22km'
                ? `<td data-label="Forduló (11km)" style="font-family:'Space Mono'; color:#ff9900;">${cp ? formatTime(cp.timestamp - r.start_time) : '-'}</td>`
                : '';

        const gapStr = idx === 0 ? 'Leader' : `+${formatTime(r.total_time - finishers[0].total_time)}`;

        let certificateHtml;
        const isDragon = /s[aá]rk[aá]ny/i.test(r.category || '');
        if (isDragon && r.members && r.members.length > 0) {
            const memberOptions = r.members
                .filter(m => m.otproba_id !== 'CSAPATNEV')
                .map(m => `<option value="${m.name.replace(/"/g, '&quot;')}">${m.name}</option>`)
                .join('');
            certificateHtml = `
                <div style="display: inline-flex; align-items: center; gap: 5px; justify-content: center; width: 100%;">
                    <select id="cert-select-cat-${r.id}" style="padding: 4px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.4); color: white; font-family: inherit; max-width: 130px;">
                        ${memberOptions}
                    </select>
                    <button onclick="window.generateCertificate('${r.id}', document.getElementById('cert-select-cat-${r.id}').value)" class="action-btn" style="background:#5BB226; color:white; border:none; padding:4px 8px; font-size:0.75rem; border-radius:4px; font-weight:bold; margin:0;" title="Oklevél letöltése">📜 LETÖLTÉS</button>
                </div>
            `;
        } else {
            certificateHtml = `<button onclick="window.generateCertificate('${r.id}')" class="action-btn" style="background:#5BB226; color:white; border:none; padding:4px 8px; font-size:0.75rem; border-radius:4px; font-weight:bold; margin:0;" title="Oklevél letöltése">📜 LETÖLTÉS</button>`;
        }

        tr.innerHTML = `
            <td data-label="Helyezés" style="${rankDecor}">${rank}.</td>
            <td data-label="Rajtszám"><strong>#${(r.bib || 0).toString().padStart(3, '0')}</strong></td>
            <td data-label="Egység Tagjai">${memberList}</td>
            ${forduloTd}
            <td data-label="Időeredmény" style="font-family:'Space Mono'; font-weight:bold; color:var(--accent-primary);">${formatTime(r.total_time || 0)}</td>
            <td data-label="Különbség" style="font-family:'Space Mono'; color: ${idx === 0 ? 'var(--success)' : '#aaa'}">${gapStr}</td>
            <td data-label="Oklevél" style="text-align: center;">
                ${certificateHtml}
            </td>
        `;
        tbody.appendChild(tr);
    });
}
window.renderResultsCategoryDetail = renderResultsCategoryDetail;

/**
 * --- SÁRKÁNYHAJÓ CSAPATÉPÍTŐ (TEAM MANAGER) ---
 */

export async function generateCertificate(racerId, selectedMemberName = 'ALL') {
    const rm = window.raceManager;
    if (!rm) return;
    const racer = rm.data.racers.find(r => r.id === racerId);
    if (!racer) return;

    // Az adminisztrációs felületről letöltött oklevelet is egységesítjük a sablonos változatra
    await window.generateDiploma(racer.bib, selectedMemberName);
}
window.generateCertificate = generateCertificate;

export function renderOtprobaList() {
    const rm = window.raceManager;
    const container = document.getElementById('admin-otproba-content');
    if (!container) return;

    try {
        container.innerHTML = '';

        if (!rm || !rm.data) {
            container.innerHTML = `
                <div class="admin-card" style="padding: 25px; text-align: center; border-radius: 12px; border: 1px solid var(--glass-border);">
                    <p style="color: var(--text-secondary); margin:0; font-style: italic; font-size: 0.9rem;">Hiba: A versenyadatok nincsenek betöltve (RaceManager hiányzik).</p>
                </div>
            `;
            return;
        }

        const racers = rm.data.racers || [];

        // Gyűjtsük össze az összes 5Próba tagot egyetlen listába
        const otprobaList = [];

        // Robust cleaner and identifier extractor for 5Próba ID (e.g. "5P123456", "5p 123456", "123456", "SP549259", "5P239008.")
        const cleanOtprobaId = val => {
            if (val === undefined || val === null) return null;
            const s = String(val).trim();
            if (s.toLowerCase() === 'nincs' || s.toLowerCase() === 'csapatnev' || s === '') return null;

            // Match optional '5P' or 'SP' prefix, optional separators (spaces, dashes, hashes), then a series of digits, and optional trailing dots/spaces
            const match = s.match(/^(?:5[Pp]|S[Pp])?[-#\s]*(\d+)[.\s]*$/);
            if (match) {
                return match[1]; // Return the clean digits
            }
            return null;
        };

        // Logging helper to diagnose what we have in the database (helpful if list is empty)
        console.log('renderOtprobaList: processing', racers.length, 'racers');
        const rawIdsForDebug = [];

        racers.forEach(r => {
            if (!r.members || r.members.length === 0) {
                if (r.otproba_id) {
                    rawIdsForDebug.push({
                        source: 'racer',
                        name: r.name,
                        raw: r.otproba_id,
                        cleaned: cleanOtprobaId(r.otproba_id),
                    });
                }
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
                    if (m.otproba_id) {
                        rawIdsForDebug.push({
                            source: 'member',
                            name: m.name,
                            raw: m.otproba_id,
                            cleaned: cleanOtprobaId(m.otproba_id),
                        });
                    }
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

        console.log('renderOtprobaList: scanned ids in database:', rawIdsForDebug);
        console.log('renderOtprobaList: matched valid numeric 5Próba list:', otprobaList);

        // Rendezzük rajtszám szerint, majd név szerint abc-ben
        otprobaList.sort((a, b) => {
            const bibDiff = (a.bib || 0) - (b.bib || 0);
            if (bibDiff !== 0) return bibDiff;
            return (a.name || '').localeCompare(b.name || '');
        });

        let html = '';

        // Összesítő statisztika kártya
        html += `
            <div style="display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 30px;">
                <div class="admin-card" style="text-align: center; border-left: 4px solid #00ff88; background: rgba(0, 255, 136, 0.03); padding: 15px; border-radius: 12px;">
                    <span style="color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Összesen 5Próbás Versenyző</span>
                    <h2 style="margin: 5px 0 0 0; color: #fff; font-size: 2.2rem; font-weight: 800;">${otprobaList.length} fő</h2>
                </div>
            </div>
        `;

        if (otprobaList.length === 0) {
            html += `
                <div class="admin-card" style="padding: 25px; text-align: center; border-radius: 12px; border: 1px solid var(--glass-border);">
                    <p style="color: var(--text-secondary); margin:0; font-style: italic; font-size: 0.9rem;">Nincs regisztrált egész számú 5Próba azonosítóval rendelkező versenyző.</p>
                </div>
            `;
        } else {
            html += `
                <div class="admin-card" style="padding: 20px; border-radius: 12px; border: 1px solid var(--glass-border);">
                    <div class="table-responsive">
                        <table class="results-table" style="font-size: 0.85rem;">
                            <thead>
                                <tr>
                                    <th style="width: 80px;">Rajtszám</th>
                                    <th>Név</th>
                                    <th>5Próba Azonosító</th>
                                    <th>Kategória</th>
                                    <th>Táv</th>
                                    <th>Státusz</th>
                                    <th style="text-align: right;">Eredmény</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${otprobaList
                                    .map(item => {
                                        const status = item.status || 'registered';
                                        const statusColor =
                                            status === 'finished'
                                                ? '#00FFCC'
                                                : status === 'running'
                                                  ? 'var(--accent-primary)'
                                                  : '#aaa';
                                        const timeStr =
                                            status === 'finished'
                                                ? formatTime(item.total_time || 0)
                                                : status === 'running'
                                                  ? 'Futamban'
                                                  : 'Regisztrálva';
                                        return `
                                        <tr>
                                            <td><strong style="color: var(--accent-primary);">#${(item.bib || 0).toString().padStart(3, '0')}</strong></td>
                                            <td style="font-weight: bold; color: #fff;">${item.name}</td>
                                            <td><span style="font-family: 'Space Mono', monospace; font-weight: bold; color: var(--accent-secondary); background: rgba(0, 163, 255, 0.1); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(0, 163, 255, 0.2);">5P${item.otproba_id}</span></td>
                                            <td style="font-size: 0.75rem; color: var(--text-secondary);">${rm.formatCategoryName(item.category)}</td>
                                            <td style="font-size: 0.75rem; color: #aaa;">${item.distance || '-'}</td>
                                            <td style="color: ${statusColor}; font-weight: 600; font-size: 0.75rem;">${status.toUpperCase()}</td>
                                            <td style="text-align: right; font-family: 'Space Mono', monospace; font-weight: bold; color: ${status === 'finished' ? '#00ff88' : '#888'};">${timeStr}</td>
                                        </tr>
                                    `;
                                    })
                                    .join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('renderOtprobaList error:', error);
        container.innerHTML = `
            <div class="admin-card" style="padding: 25px; text-align: center; border-radius: 12px; border: 1px solid var(--glass-border); border-left: 4px solid var(--accent-primary); background: rgba(255, 0, 85, 0.03);">
                <p style="color: var(--accent-primary); margin:0; font-weight: bold;">Hiba történt a megjelenítés közben:</p>
                <p style="color: var(--text-secondary); margin:5px 0 0 0; font-family: monospace; font-size: 0.85rem;">${error.message}</p>
            </div>
        `;
    }
}
window.renderOtprobaList = renderOtprobaList;

