/**
 * --- LIVE CARDS AND DOM RENDERER (live-cards-renderer.js) ---
 * Versenykártyák (Várakozók, Futók, Célbaértek, Élő napló) DOM megjelenítése.
 */

import { formatTime, escapeHtml } from '../ui-utils.js';

export function renderAdminStats(rm) {
        const statsContainers = document.querySelectorAll('.admin-stats');
        if (statsContainers.length === 0) return;

        const validRacers = (rm.data.racers || []).filter(r => r.id !== 'SYSTEM_CATEGORY_MERGES' && r.status !== 'system');
        const total = validRacers.length;
        const running = validRacers.filter(r => r.status === 'running').length;
        const finished = validRacers.filter(r => r.status === 'finished').length;
        const registered = validRacers.filter(r => r.status === 'registered').length;
        const pending = validRacers.filter(r => r.status === 'duplicate').length;
        const dnf = validRacers.filter(r => r.status === 'dnf').length;
        const dsq = validRacers.filter(r => r.status === 'dsq').length;

        let pendingHtml = '';
        if (pending > 0) {
            pendingHtml = `
                <div class="stat-item" style="cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--text-secondary)';" onclick="window.showDataSubSection && window.showDataSubSection('admin-data-section-duplicates')">
                    <span style="color: #ffaa00; font-size: 0.8rem;">FÜGGŐBEN:</span> <strong>${pending}</strong>
                </div>
            `;
        }

        let extraStatsHtml = '';
        if (dnf > 0) {
            extraStatsHtml += `<div class="stat-item"><span style="color: #FFA500; font-size: 0.8rem;">DNF:</span> <strong>${dnf}</strong></div>`;
        }
        if (dsq > 0) {
            extraStatsHtml += `<div class="stat-item"><span style="color: #ff4444; font-size: 0.8rem;">DSQ:</span> <strong>${dsq}</strong></div>`;
        }

        const statsHtml = `
            <div style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
                <div class="stat-item"><span style="color: #888; font-size: 0.8rem;">ÖSSZES:</span> <strong style="color: white;">${total}</strong></div>
                <div class="stat-item" style="cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--text-secondary)'; this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.borderColor='transparent'; this.style.background='rgba(0, 145, 255, 0.1)';" onclick="window.toggleRunningListCards(true)">
                    <span style="color: var(--accent-primary); font-size: 0.8rem;">FUTÓ:</span> <strong>${running}</strong>
                </div>
                <div class="stat-item" style="cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--text-secondary)'; this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.borderColor='transparent'; this.style.background='rgba(0, 255, 136, 0.1)';" onclick="window.toggleFinishedListCards(true)">
                    <span style="color: #00ff88; font-size: 0.8rem;">CÉLBA ÉRT:</span> <strong>${finished}</strong>
                </div>
                <div class="stat-item" style="cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--text-secondary)'; this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.borderColor='transparent'; this.style.background='rgba(0, 145, 255, 0.1)';" onclick="window.toggleWaitingListCards(true)">
                    <span style="color: var(--text-secondary); font-size: 0.8rem;">VÁRAKOZIK:</span> <strong>${registered}</strong>
                </div>
                ${pendingHtml}
                ${extraStatsHtml}
            </div>
        `;

        statsContainers.forEach(container => {
            container.innerHTML = statsHtml;
        });

        const cpStatsContainer = document.getElementById('admin-checkpoint-stats');
        if (cpStatsContainer) {
            const running22kmRacers = validRacers.filter(r => r.status === 'running' && r.distance === '22km');
            const running22km = running22kmRacers.length;
            const cpData = rm.data.checkpoints || [];
            const uniqueTurnedBibs = new Set(
                cpData.filter(c => c.checkpoint_name === '22km_tav_11km_fordulo').map(c => c.racer_bib)
            );

            let megfordult;
            let nem_fordult;

            if (running22km > 0) {
                megfordult = running22kmRacers.filter(r => uniqueTurnedBibs.has(r.bib)).length;
                nem_fordult = running22km - megfordult;
            } else {
                megfordult = uniqueTurnedBibs.size;
                nem_fordult = 0;
            }

            cpStatsContainer.innerHTML = `
                <div style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
                    <div class="stat-item" style="cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--text-secondary)'; this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.borderColor='transparent'; this.style.background='rgba(255, 153, 0, 0.1)';" onclick="window.toggleRunningListCards(true)">
                        <span style="color: var(--accent-primary); font-size: 0.8rem;">22KM FUTÓ LÉTSZÁM:</span> <strong style="color: white;">${running22km}</strong>
                    </div>
                    <div class="stat-item"><span style="color: #ff9900; font-size: 0.8rem;">MEGFORDULT (11km):</span> <strong style="color: white;">${megfordult}</strong></div>
                    <div class="stat-item" style="cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--text-secondary)'; this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.borderColor='transparent'; this.style.background='rgba(255, 153, 0, 0.1)';" onclick="window.toggleNotTurnedListCards(true)">
                        <span style="color: #ff4444; font-size: 0.8rem;">MÉG NEM FORDULT:</span> <strong style="color: white;">${nem_fordult}</strong>
                    </div>
                </div>
            `;
        }
    }
export function renderWaitingListCards(rm) {
        const containers = [
            {
                content: document.getElementById('waiting-list-content-starts'),
                card: document.getElementById('waiting-list-container-starts'),
            },
            {
                content: document.getElementById('waiting-list-content-live'),
                card: document.getElementById('waiting-list-container-live'),
            },
        ].filter(item => item.content && item.card && !item.card.classList.contains('hidden'));

        if (containers.length === 0) return;

        const registered = rm.data.racers.filter(r => r.status === 'registered');

        let html = '';
        if (registered.length === 0) {
            html =
                '<div style="text-align: center; padding: 20px; color: var(--text-secondary); opacity: 0.7;">Jelenleg nincs várakozó versenyző.</div>';
        } else {
            html = `
                <div class="table-responsive">
                    <table class="results-table" style="font-size: 0.85rem;">
                        <thead>
                            <tr>
                                <th style="width: 80px;">Rajtszám</th>
                                <th>Egység Tagjai</th>
                                <th>Kategória</th>
                                <th>Táv</th>
                            </tr>
                        </thead>
                            ${registered
                                .sort((a, b) => {
                                    const bibDiff = (a.bib || 0) - (b.bib || 0);
                                    if (bibDiff !== 0) return bibDiff;
                                    const realA = (a.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
                                    const realB = (b.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
                                    const nameA = (realA[0] ? realA[0].name : a.name) || '';
                                    const nameB = (realB[0] ? realB[0].name : b.name) || '';
                                    return nameA.localeCompare(nameB);
                                })
                                .map(
                                    r => `
                                <tr>
                                    <td><strong style="color: var(--accent-primary);">#${(r.bib || 0).toString().padStart(3, '0')}</strong></td>
                                    <td>${r.members ? r.members.map(m => escapeHtml(m.name)).join(', ') : escapeHtml(r.name || '-')}</td>
                                    <td style="font-size: 0.75rem; color: var(--text-secondary);">${rm.formatCategoryName(r.category)}</td>
                                    <td style="font-size: 0.75rem; color: #aaa;">${escapeHtml(r.distance || '-')}</td>
                                </tr>
                            `
                                )
                                .join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        containers.forEach(item => {
            item.content.innerHTML = html;
        });
    }
export function renderRunningListCards(rm) {
        const containers = [
            {
                content: document.getElementById('running-list-content-starts'),
                card: document.getElementById('running-list-container-starts'),
            },
            {
                content: document.getElementById('running-list-content-live'),
                card: document.getElementById('running-list-container-live'),
            },
        ].filter(item => item.content && item.card && !item.card.classList.contains('hidden'));

        if (containers.length === 0) return;

        const runningRacers = rm.data.racers.filter(r => r.status === 'running');

        let html = '';
        if (runningRacers.length === 0) {
            html =
                '<div style="text-align: center; padding: 20px; color: var(--text-secondary); opacity: 0.7;">Jelenleg nincs futó versenyző.</div>';
        } else {
            html = `
                <div class="table-responsive">
                    <table class="results-table" style="font-size: 0.85rem;">
                        <thead>
                            <tr>
                                <th style="width: 80px;">Rajtszám</th>
                                <th>Egység Tagjai</th>
                                <th>Kategória</th>
                                <th>Táv</th>
                                <th style="text-align: right;">Eltelt idő</th>
                            </tr>
                        </thead>
                            ${runningRacers
                                .sort((a, b) => {
                                    const bibDiff = (a.bib || 0) - (b.bib || 0);
                                    if (bibDiff !== 0) return bibDiff;
                                    const realA = (a.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
                                    const realB = (b.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
                                    const nameA = (realA[0] ? realA[0].name : a.name) || '';
                                    const nameB = (realB[0] ? realB[0].name : b.name) || '';
                                    return nameA.localeCompare(nameB);
                                })
                                .map(r => {
                                    const now = Date.now() + (rm.serverTimeOffset || 0);
                                    const timeDisplay = formatTime(now - (r.start_time || 0));
                                    return `
                                <tr class="status-running">
                                    <td><strong style="color: var(--accent-primary);">#${(r.bib || 0).toString().padStart(3, '0')}</strong></td>
                                    <td>${r.members ? r.members.map(m => escapeHtml(m.name)).join(', ') : escapeHtml(r.name || '-')}</td>
                                    <td style="font-size: 0.75rem; color: var(--text-secondary);">${rm.formatCategoryName(r.category)}</td>
                                    <td style="font-size: 0.75rem; color: #aaa;">${escapeHtml(r.distance || '-')}</td>
                                    <td style="text-align: right; font-weight: bold; color: #00ff88; font-family: 'Space Mono', monospace;" class="time" data-start="${r.start_time || 0}">${timeDisplay}</td>
                                </tr>
                            `;
                                })
                                .join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        containers.forEach(item => {
            item.content.innerHTML = html;
        });
    }
export function renderFinishedListCards(rm) {
        const containers = [
            {
                content: document.getElementById('finished-list-content-starts'),
                card: document.getElementById('finished-list-container-starts'),
            },
            {
                content: document.getElementById('finished-list-content-live'),
                card: document.getElementById('finished-list-container-live'),
            },
        ].filter(item => item.content && item.card && !item.card.classList.contains('hidden'));

        if (containers.length === 0) return;

        const finishedRacers = rm.data.racers.filter(r => r.status === 'finished');

        let html = '';
        if (finishedRacers.length === 0) {
            html =
                '<div style="text-align: center; padding: 20px; color: var(--text-secondary); opacity: 0.7;">Jelenleg nincs célba érkezett versenyző.</div>';
        } else {
            html = `
                <div class="table-responsive">
                    <table class="results-table" style="font-size: 0.85rem;">
                        <thead>
                            <tr>
                                <th style="width: 80px;">Rajtszám</th>
                                <th>Egység Tagjai</th>
                                <th>Kategória</th>
                                <th>Táv</th>
                                <th style="text-align: right;">Eredmény</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${finishedRacers
                                .sort((a, b) => (a.total_time || 0) - (b.total_time || 0))
                                .map(r => {
                                    const timeDisplay = formatTime(r.total_time || 0);
                                    return `
                                <tr class="status-finished">
                                    <td><strong style="color: #00ff88;">#${(r.bib || 0).toString().padStart(3, '0')}</strong></td>
                                    <td>${r.members ? r.members.map(m => escapeHtml(m.name)).join(', ') : escapeHtml(r.name || '-')}</td>
                                    <td style="font-size: 0.75rem; color: var(--text-secondary);">${rm.formatCategoryName(r.category)}</td>
                                    <td style="font-size: 0.75rem; color: #aaa;">${escapeHtml(r.distance || '-')}</td>
                                    <td style="text-align: right; font-weight: bold; color: #00ff88; font-family: 'Space Mono', monospace;">${timeDisplay}</td>
                                </tr>
                            `;
                                })
                                .join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        containers.forEach(item => {
            item.content.innerHTML = html;
        });
    }
export function renderNotTurnedListCards(rm) {
        const liveCard = document.getElementById('not-turned-list-container-live');
        const liveContent = document.getElementById('not-turned-list-content-live');
        if (!liveCard || liveCard.classList.contains('hidden') || !liveContent) return;

        const checkpoints = rm.data.checkpoints || [];
        const notTurnedRacers = rm.data.racers.filter(r => {
            if (r.status !== 'running' || r.distance !== '22km') return false;
            return !checkpoints.some(c => c.racer_bib === r.bib && c.checkpoint_name === '22km_tav_11km_fordulo');
        });

        let html;
        if (notTurnedRacers.length === 0) {
            html =
                '<div style="text-align: center; padding: 20px; color: var(--text-secondary); opacity: 0.7;">Jelenleg nincs ilyen versenyző.</div>';
        } else {
            html = `
                <div class="table-responsive">
                    <table class="results-table" style="font-size: 0.85rem;">
                        <thead>
                            <tr>
                                <th style="width: 80px;">Rajtszám</th>
                                <th>Egység Tagjai</th>
                                <th>Kategória</th>
                                <th>Táv</th>
                            </tr>
                        </thead>
                            ${notTurnedRacers
                                .sort((a, b) => {
                                    const bibDiff = (a.bib || 0) - (b.bib || 0);
                                    if (bibDiff !== 0) return bibDiff;
                                    const realA = (a.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
                                    const realB = (b.members || []).filter(m => m.otproba_id !== 'CSAPATNEV');
                                    const nameA = (realA[0] ? realA[0].name : a.name) || '';
                                    const nameB = (realB[0] ? realB[0].name : b.name) || '';
                                    return nameA.localeCompare(nameB);
                                })
                                .map(
                                    r => `
                                <tr>
                                    <td><strong style="color: var(--accent-primary);">#${(r.bib || 0).toString().padStart(3, '0')}</strong></td>
                                    <td>${r.members ? r.members.map(m => escapeHtml(m.name)).join(', ') : escapeHtml(r.name || '-')}</td>
                                    <td style="font-size: 0.75rem; color: var(--text-secondary);">${rm.formatCategoryName(r.category)}</td>
                                    <td style="font-size: 0.75rem; color: #aaa;">${escapeHtml(r.distance || '-')}</td>
                                </tr>
                            `
                                )
                                .join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        liveContent.innerHTML = html;
    }
export function renderRacersList(rm) {
        const container = document.getElementById('results-tables-container');
        if (!container) return;
        container.innerHTML = '';

        if (!rm.data.racers || rm.data.racers.length === 0) {
            container.innerHTML =
                '<div style="text-align:center; color: var(--text-secondary); width:100%;">Nincsenek nevezett versenyzők</div>';
            return;
        }

        const catGroups = {};
        rm.data.racers.forEach(r => {
            const effectiveCat = rm.getEffectiveCategory(r.category);
            const groupKey = `${effectiveCat}_${r.distance}`;
            if (!catGroups[groupKey]) catGroups[groupKey] = [];
            catGroups[groupKey].push(r);
        });

        Object.keys(catGroups)
            .sort()
            .forEach(groupKey => {
                const racers = catGroups[groupKey];
                if (!racers.some(r => r.status === 'finished' || r.status === 'running')) return;
                const sortedRacers = racers.sort((a, b) => {
                    if (a.status === 'finished' && b.status !== 'finished') return -1;
                    if (a.status !== 'finished' && b.status === 'finished') return 1;
                    if (a.status === 'finished' && b.status === 'finished') return a.total_time - b.total_time;
                    return a.bib - b.bib;
                });
                const distStr = sortedRacers[0].distance || '';
                const cleanDist = distStr.replace(/km/i, '').trim();
                const distDisplay = cleanDist ? `${cleanDist} km` : '';
                const catTitle = distDisplay
                    ? `${rm.formatCategoryName(groupKey)} - ${distDisplay}`
                    : rm.formatCategoryName(groupKey);
                createResultsTable(rm, container, catTitle, sortedRacers, false);
            });

        [
            { id: '22km', title: 'Hosszú táv összetett' },
            { id: '11km', title: 'Rövid táv összetett' },
            { id: '4km', title: 'SUP 4 km összetett' },
        ].forEach(dist => {
            const distRacers = rm.data.racers.filter(
                r => r.distance === dist.id && (r.status === 'finished' || r.status === 'running')
            );
            if (distRacers.length === 0) return;
            const sortedDistRacers = distRacers.sort((a, b) => {
                if (a.status === 'finished' && b.status !== 'finished') return -1;
                if (a.status !== 'finished' && b.status === 'finished') return 1;
                if (a.status === 'finished' && b.status === 'finished') return a.total_time - b.total_time;
                return a.bib - b.bib;
            });
            const hr = document.createElement('hr');
            hr.style =
                'margin: 3rem 0 1rem 0; border: none; height: 1px; background: linear-gradient(to right, transparent, var(--accent-primary), transparent);';
            container.appendChild(hr);
            createResultsTable(rm, container, dist.title, sortedDistRacers, true);
        });
    }
export function createResultsTable(rm, container, title, racers, showCategory = false) {
        const hasKöridő = racers.some(r => r.distance === '22km');
        const catWrapper = document.createElement('div');
        catWrapper.className = 'category-results-table';
        catWrapper.style.marginBottom = '2rem';
        catWrapper.innerHTML = `<h4 class="category-title">${title}</h4><div class="table-responsive"><table class="results-table"><thead><tr><th style="width: 80px;">Helyezés</th><th style="width: 80px;">Rajtszám</th><th>Név</th>${showCategory ? '<th>Kategória</th>' : ''}${hasKöridő ? '<th>Köridő</th>' : ''}<th style="text-align:right;">Időeredmény</th></tr></thead><tbody></tbody></table></div>`;
        const tbody = catWrapper.querySelector('tbody');
        let rank = 1;
        racers.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = `status-${r.status}`;
            let timeDisplay = 'folyamatban...',
                dataStartAttr = '',
                rankDisplay = '-';
            if (r.status === 'running') {
                const now = Date.now() + (rm.serverTimeOffset || 0);
                timeDisplay = formatTime(now - (r.start_time || 0));
                dataStartAttr = `data-start="${r.start_time || 0}"`;
            } else if (r.status === 'finished') {
                timeDisplay = formatTime(r.total_time || 0);
                rankDisplay = `${rank++}.`;
            } else if (r.status === 'dnf') {
                timeDisplay = '<span style="color:#FFA500; font-weight:bold;">DNF (Feladta)</span>';
            } else if (r.status === 'dsq') {
                timeDisplay = '<span style="color:#ff4444; font-weight:bold;">DSQ (Kizárva)</span>';
            } else if (r.status === 'dns') {
                timeDisplay = '<span style="color:#888888; font-style:italic;">DNS (Nem indult)</span>';
            }

            let cpHtml = '';
            if (hasKöridő) {
                let lapTimeStr = r.status === 'finished' ? 'nincs adat' : '-';
                if (rm.data.checkpoints) {
                    const cp = rm.data.checkpoints.find(
                        c => c.racer_bib === r.bib && c.checkpoint_name === '22km_tav_11km_fordulo'
                    );
                    if (cp) {
                        lapTimeStr = formatTime(cp.timestamp - (r.start_time || 0));
                    }
                }
                cpHtml = `<td style="font-family: 'Space Mono', monospace; font-size: 0.85rem; color: #ff9900;">${lapTimeStr}</td>`;
            }

            const rowColor =
                r.status === 'finished' ? '#00ff88' : r.status === 'running' ? 'var(--accent-primary)' : 'inherit';
            const isDragon = /s[aá]rk[aá]ny/i.test(r.category || '');
            let diplomaBtnHtml = '';
            if (r.status === 'finished' && !isDragon) {
                diplomaBtnHtml = `<button onclick="window.generateDiploma('${r.bib}')" class="btn-primary" style="display:inline-flex; align-items:center; gap:5px; margin-left:12px; padding: 3px 8px; font-size: 0.7rem; background: #007bff; border: none; border-radius: 4px; cursor: pointer; color: white; vertical-align: middle; font-family: inherit;">🎓 Oklevél</button>`;
            }

            let namesDisplay;
            if (isDragon && r.members && r.members.length > 0) {
                const teamMember = r.members.find(m => m.otproba_id === 'CSAPATNEV');
                const rawTeamName = teamMember ? teamMember.name : r.name || `Sárkányhajó csapat #${r.bib}`;
                const teamName = escapeHtml(rawTeamName);
                const athleteMembers = r.members.filter(m => m.otproba_id !== 'CSAPATNEV');

                if (athleteMembers.length > 0) {
                    const athleteListHtml = athleteMembers
                        .map(m => {
                            let btnHtml = '';
                            if (r.status === 'finished') {
                                const safeJsName = String(m.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                                btnHtml = `<button onclick="window.generateDiploma('${escapeHtml(r.bib)}', '${safeJsName}')" class="btn-primary" style="display:inline-flex; align-items:center; gap:3px; padding: 2px 6px; font-size: 0.65rem; background: #007bff; border: none; border-radius: 4px; cursor: pointer; color: white; font-family: inherit; margin-left:8px; vertical-align: middle;">🎓 Letöltés</button>`;
                            }
                            return `<li style="margin-bottom: 6px;">${escapeHtml(m.name)}${btnHtml}</li>`;
                        })
                        .join('');
                    namesDisplay = `
                        <div class="team-dropdown-wrapper" style="display:inline-block; vertical-align:middle; width:100%; max-width:550px; text-align:left;">
                            <details class="team-details" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 6px 12px; cursor: pointer; transition: all 0.3s; width:100%; box-sizing:border-box;" onmouseover="this.style.borderColor='var(--accent-primary)'; this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.background='rgba(255,255,255,0.03)'">
                                <summary style="font-weight:bold; color:white; outline:none; display:flex; align-items:center; justify-content:space-between; user-select:none; gap:10px;">
                                    <span>🐉 ${teamName} <span style="font-size:0.85em; color:var(--text-secondary); font-weight:normal; margin-left: 8px;">(${athleteMembers.length} tag)</span></span>
                                    <span class="dropdown-chevron" style="color:var(--accent-primary); font-size:0.8em;">▼</span>
                                </summary>
                                <ul style="margin: 10px 0 0 0; padding-left: 20px; text-align: left; list-style-type: decimal; color: var(--text-secondary); font-size: 0.9em; line-height: 1.5; columns: 2; -webkit-columns: 2; -moz-columns: 2;">
                                    ${athleteListHtml}
                                </ul>
                            </details>
                        </div>
                    `;
                } else {
                    namesDisplay = `<strong>🐉 ${teamName}</strong>`;
                }
            } else {
                namesDisplay = `${r.members ? r.members.map(m => escapeHtml(m.name)).join(', ') : escapeHtml(r.name || '-')}${diplomaBtnHtml}`;
            }
            tr.innerHTML = `<td style="color:${rowColor}; font-weight:bold;">${rankDisplay}</td><td>#${(r.bib || 0).toString().padStart(3, '0')}</td><td>${namesDisplay}</td>${showCategory ? `<td style="font-size: 0.8rem; color: #888;">${(rm.categoryMap && rm.categoryMap[r.category]) || r.category}</td>` : ''}${cpHtml}<td class="time" style="color:${rowColor}; font-family: 'Space Mono', monospace; text-align:right;" ${dataStartAttr}>${timeDisplay}</td>`;
            tbody.appendChild(tr);
        });
        container.appendChild(catWrapper);
    }
export function renderLiveLog(rm) {
        const logContainer = document.getElementById('admin-event-log-content');
        if (!logContainer) return;

        const events = [];

        // Checkpoints feldolgozása
        if (rm.data.checkpoints) {
            rm.data.checkpoints.forEach(cp => {
                events.push({
                    type: 'checkpoint',
                    time: cp.timestamp,
                    bib: cp.racer_bib,
                    msg: `📍 KÖR rögzítve: #${cp.racer_bib} (${cp.checkpoint_name.replace('22km_tav_11km_fordulo', 'Forduló')})`,
                });
            });
        }

        // Finishers feldolgozása
        if (rm.data.racers) {
            rm.data.racers
                .filter(r => r.status === 'finished')
                .forEach(r => {
                    const finishTime = (r.start_time || 0) + (r.total_time || 0);
                    events.push({
                        type: 'finish',
                        time: finishTime,
                        bib: r.bib,
                        msg: `🎯 BEÉRKEZETT: #${r.bib} - Idő: ${formatTime(r.total_time)}`,
                    });
                });
        }

        events.sort((a, b) => b.time - a.time);
        const recentEvents = events.slice(0, 15);

        if (recentEvents.length === 0) {
            logContainer.innerHTML = '<div class="empty-text">Nincs rögzített esemény</div>';
            return;
        }

        logContainer.innerHTML = recentEvents
            .map(
                e => `
            <div style="padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: ${e.type === 'checkpoint' ? '#ff9900' : '#00ffcc'}">
                <span style="color: #888; font-size: 0.75rem;">[${new Date(e.time).toLocaleTimeString('hu-HU')}]</span> ${e.msg}
            </div>
        `
            )
            .join('');
    }
