/**
 * --- TEAM MANAGER COMPONENT (team-manager-ui.js) ---
 * Sárkányhajó és egyéb csapatok építése, tagok mozgatása, oklevelek generálása.
 */

import { showToast, formatTime, formatRacerName } from '../ui-utils.js';
import { API_URL } from '../api.js';

export function renderTeamManager() {
    const tbody = document.getElementById('dragon-team-builder-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const rm = window.raceManager;
    if (!rm || !rm.data.racers) return;

    const allRacers = rm.data.racers;

    // Szűrő lekérése
    const filterSelect = document.getElementById('team-builder-category-filter');

    if (window.newlyRegisteredRacerId) {
        const newlyRegisteredRacer = allRacers.find(r => r.id === window.newlyRegisteredRacerId);
        if (newlyRegisteredRacer && !/s[aá]rk[aá]ny/i.test(newlyRegisteredRacer.category || '')) {
            if (filterSelect) filterSelect.value = 'all';
        }
    }

    const filterValue = filterSelect ? filterSelect.value : 'sarkanyhajo';
    const statusSelect = document.getElementById('team-builder-status-filter');
    const statusFilter = statusSelect ? statusSelect.value : 'unassigned';

    // Meglévő csapatok összegyűjtése a dropdown számára (minden olyan egység, aminek van CSAPATNEV tagja)
    // Ezt nem szűrjük, hogy bármilyen kategóriájú csapatba be lehessen osztani!
    const existingTeams = allRacers.filter(r => r.members && r.members.some(m => m.otproba_id === 'CSAPATNEV'));
    const teamSelect = document.getElementById('existing-dragon-teams-select');
    if (teamSelect) {
        teamSelect.innerHTML = `
            <option value="">-- Új csapat létrehozása (Töltsd ki az alsó mezőket) --</option>
            <option value="REMOVE">❌ Kijelöltek eltávolítása a jelenlegi csapatukból</option>
        `;
        existingTeams.forEach(team => {
            const teamMember = team.members.find(m => m.otproba_id === 'CSAPATNEV');
            const teamName = teamMember ? teamMember.name : `Ismeretlen Csapat #${team.bib}`;
            // Jelezzük a kategóriát is a legördülőben, hogy egyértelmű legyen, melyik csapat melyik kategóriában van
            const categoryName = rm.formatCategoryName(team.category) || 'Ismeretlen kategória';
            const opt = new Option(
                `${teamName} (#${team.bib} - ${categoryName})`,
                JSON.stringify({ bib: team.bib, name: teamName })
            );

            const membersList = team.members
                .filter(m => m.otproba_id !== 'CSAPATNEV')
                .map(m => m.name)
                .join(', ');
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
            if (!/s[aá]rk[aá]ny/i.test(r.category || '')) {
                return; // Kihagyjuk, ha nem sárkányhajó kategória
            }
        }

        const hasTeamName = r.members && r.members.some(m => m.otproba_id === 'CSAPATNEV');
        const isTeam = r.id.startsWith('DRAGON_') || hasTeamName || (r.members && r.members.length > 1);

        // Szűrés a beosztási állapot alapján
        if (statusFilter === 'unassigned' && isTeam) {
            return; // Csak a beosztásra váró egyéni jelentkezőket jelenítjük meg
        }
        if (statusFilter === 'assigned' && !isTeam) {
            return; // Csak a már beosztott tagokat jelenítjük meg
        }
        if (r.members) {
            const teamMember = hasTeamName ? r.members.find(x => x.otproba_id === 'CSAPATNEV') : null;
            const teamName = teamMember ? teamMember.name : isTeam ? `Csapat #${r.bib}` : null;

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
                        category: r.category,
                    });
                }
            });
        }
    });

    window.allDragonMembers = allMembers;

    if (allMembers.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-secondary);">Nincs versenyző a rendszerben.</td></tr>';
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

        const teamInfo = m.isTeam
            ? `<span style="background: rgba(0, 228, 255, 0.08); border: 1px solid rgba(0, 228, 255, 0.2); padding: 4px 8px; border-radius: 6px; color:#00e4ff; font-weight:bold; display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem;">🔗 Beosztva: ${m.teamName || '#' + m.racerBib}</span>`
            : `<span style="background: rgba(255, 152, 0, 0.08); border: 1px solid rgba(255, 152, 0, 0.2); padding: 4px 8px; border-radius: 6px; color:#ff9800; font-weight:bold; display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem;">❓ Beosztatlan: Egyéni</span>`;

        const isNewlyRegistered = window.newlyRegisteredRacerId && m.racerId === window.newlyRegisteredRacerId;

        tr.innerHTML = `
            <td data-label="Kiválaszt"><input type="checkbox" class="dragon-member-check" value="${m.id}" ${isNewlyRegistered ? 'checked' : ''}></td>
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

    // Töröljük a globális változót, hogy a következő kézi frissítésnél vagy belépésnél ne jelölje be őket újra
    window.newlyRegisteredRacerId = null;

    // Dinamikus csapatkártyák frissítése
    renderExistingTeamsGrid();
}
window.renderTeamManager = renderTeamManager;

/**
 * --- SÁRKÁNYHAJÓ CSAPATOK VIZUÁLIS SZERKESZTŐJE ---
 */
export function renderExistingTeamsGrid() {
    const container = document.getElementById('existing-teams-grid-container');
    if (!container) return;
    container.innerHTML = '';

    const rm = window.raceManager;
    if (!rm || !rm.data.racers) return;

    const allRacers = rm.data.racers;

    // Meglévő csapatok összegyűjtése (minden olyan egység, aminek van CSAPATNEV tagja)
    const teams = allRacers.filter(r => r.members && r.members.some(m => m.otproba_id === 'CSAPATNEV'));

    // Beosztatlan (várakozó) egyéni versenyzők összegyűjtése az új tag hozzáadása funkcióhoz
    const unassignedList = [];
    allRacers.forEach(r => {
        const hasTeamName = r.members && r.members.some(m => m.otproba_id === 'CSAPATNEV');
        const isTeam = r.id.startsWith('DRAGON_') || hasTeamName || (r.members && r.members.length > 1);
        if (!isTeam && r.members) {
            r.members.forEach(m => {
                unassignedList.push({
                    id: m.id,
                    name: m.name,
                    category: r.category,
                    bib: r.bib,
                });
            });
        }
    });
    // Ábécé sorrendbe rendezés név szerint
    unassignedList.sort((a, b) => a.name.localeCompare(b.name));

    if (teams.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--glass-border); border-radius: 12px; color: var(--text-secondary);">
                👥 Nincsenek még létrehozott sárkányhajó csapatok a rendszerben.<br>
                <span style="font-size: 0.85rem; color: #888; display: block; margin-top: 10px;">Válassz ki versenyzőket a fenti táblázatból, add meg a csapatnevet és kattints az "ÚJ EGYSÉG LÉTREHOZÁSA" gombra!</span>
            </div>
        `;
        return;
    }

    teams.forEach(team => {
        const teamNameMember = team.members.find(m => m.otproba_id === 'CSAPATNEV');
        const teamName = teamNameMember ? teamNameMember.name : `Csapat #${team.bib}`;
        const categoryName = rm.formatCategoryName(team.category) || 'Ismeretlen kategória';

        // Csapattagok kigyűjtése (a CSAPATNEV nélküliek)
        const humanMembers = team.members.filter(m => m.otproba_id !== 'CSAPATNEV');

        const card = document.createElement('div');
        card.className = 'team-card';

        // Fejléc
        const headerHTML = `
            <div class="team-card-header">
                <div class="team-card-title-area">
                    <h4 class="team-card-title">${teamName}</h4>
                    <div class="team-card-meta">
                        <span>🔢 Rajtszám: <strong>#${team.bib}</strong></span>
                        <span>🏆 Kategória: ${categoryName}</span>
                        <span>👥 Létszám: <strong>${humanMembers.length} fő</strong></span>
                    </div>
                </div>
                <div class="team-card-actions">
                    <button class="btn-card-action" onclick="window.renameDragonTeam('${team.id}', ${team.bib}, \`${teamName.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)" title="Csapat átnevezése">✏️</button>
                    <button class="btn-card-action" onclick="window.changeDragonTeamBib('${team.id}', ${team.bib}, \`${teamName.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)" title="Rajtszám módosítása">🔢</button>
                    <button class="btn-card-action danger" onclick="window.dissolveDragonTeam(${team.bib}, \`${teamName.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, ${JSON.stringify(humanMembers.map(m => m.id))})" title="Csapat feloszlatása (minden tag egyéni lesz)">🚨</button>
                </div>
            </div>
        `;

        // Tagok listája
        let membersHTML = '<ul class="team-card-members">';
        if (humanMembers.length === 0) {
            membersHTML += `<li style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 10px 0;">Nincsenek tagok a csapatban</li>`;
        } else {
            humanMembers.forEach(m => {
                // Áthelyezési legördülő más csapatokhoz
                let moveOptionsHTML = `<option value="" disabled selected>➡️ Áthelyez...</option>`;
                teams.forEach(otherTeam => {
                    if (otherTeam.id !== team.id) {
                        const otherNameMember = otherTeam.members.find(x => x.otproba_id === 'CSAPATNEV');
                        const otherName = otherNameMember ? otherNameMember.name : `Csapat #${otherTeam.bib}`;
                        moveOptionsHTML += `<option value="${otherTeam.bib}">${otherName} (#${otherTeam.bib})</option>`;
                    }
                });

                membersHTML += `
                    <li class="team-card-member-item">
                        <div class="team-card-member-info">
                            <span class="team-card-member-name" onclick="window.raceManager.openEditModal('${team.id}', '${m.id}')" title="Tag adatlapjának szerkesztése">${m.name}</span>
                            <div class="team-card-member-sub">
                                ${m.birth_date || '-'} | ID: ${m.otproba_id || '-'}
                            </div>
                        </div>
                        <div class="team-card-member-actions">
                            <select class="team-member-move-select" onchange="window.moveMemberToTeam('${m.id}', this.value, \`${m.name.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)" title="Tag áthelyezése másik csapatba">
                                ${moveOptionsHTML}
                            </select>
                            <button class="team-member-remove-btn" onclick="window.removeMemberFromTeam('${m.id}', '${team.id}', \`${m.name.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, \`${teamName.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)" title="Kivétel a csapatból (egyéni versenyzővé válik)">❌</button>
                        </div>
                    </li>
                `;
            });
        }
        membersHTML += '</ul>';

        // Tag hozzáadása legördülő
        let addOptionsHTML = `<option value="" disabled selected>➕ Tag hozzáadása...</option>`;
        unassignedList.forEach(unassigned => {
            const catName = rm.formatCategoryName(unassigned.category) || 'SUP/Egyéni';
            addOptionsHTML += `<option value="${unassigned.id}">${unassigned.name} (${catName})</option>`;
        });

        const addMemberHTML = `
            <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05);">
                <select class="team-card-add-member-select" onchange="window.addMemberToTeam(this.value, ${team.bib}, \`${teamName.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, this.options[this.selectedIndex].text)" ${unassignedList.length === 0 ? 'disabled' : ''}>
                    ${unassignedList.length === 0 ? '<option value="" disabled selected>Nincs várakozó beosztható tag</option>' : addOptionsHTML}
                </select>
            </div>
        `;

        card.innerHTML = headerHTML + membersHTML + addMemberHTML;
        container.appendChild(card);
    });
}
window.renderExistingTeamsGrid = renderExistingTeamsGrid;

window.renameDragonTeam = async (racerId, currentBib, currentName) => {
    const newName = prompt(`Add meg a(z) "${currentName}" csapat új nevét:`, currentName);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === currentName) return;

    try {
        const response = await fetch(`${API_URL}/create-dragon-team`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${window.raceManager.adminPassword}`,
            },
            body: JSON.stringify({ memberIds: [], bib: currentBib, name: trimmed }),
        });
        const result = await response.json();
        if (response.ok) {
            showToast(`Csapat sikeresen átnevezve: "${trimmed}"`, 'success');
            await window.raceManager.loadData();
            renderTeamManager();
            window.renderAdminTable();
        } else {
            showToast(result.error || 'Hiba történt!', 'error');
        }
    } catch (err) {
        showToast('Hálózati hiba a csapat átnevezése során!', 'error');
    }
};

window.changeDragonTeamBib = async (racerId, currentBib, teamName) => {
    const newBib = prompt(`Add meg a(z) "${teamName}" csapat új rajtszámát:`, currentBib);
    if (newBib === null) return;
    const bibInt = parseInt(newBib.trim());
    if (isNaN(bibInt) || bibInt === currentBib) return;

    try {
        const response = await fetch(`${API_URL}/racer/${racerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${window.raceManager.adminPassword}`,
            },
            body: JSON.stringify({ bib: bibInt }),
        });
        const result = await response.json();
        if (response.ok) {
            showToast(`Rajtszám sikeresen módosítva: #${bibInt}`, 'success');
            await window.raceManager.loadData();
            renderTeamManager();
            window.renderAdminTable();
        } else {
            showToast(result.error || 'Hiba történt!', 'error');
        }
    } catch (err) {
        showToast('Hálózati hiba a rajtszám módosítása során!', 'error');
    }
};

window.dissolveDragonTeam = async (teamBib, teamName, memberIds) => {
    if (memberIds.length === 0) {
        if (!confirm(`Biztosan törlöd a(z) "${teamName}" üres csapatot?`)) return;
        try {
            const response = await fetch(`${API_URL}/racer/${teamBib}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${window.raceManager.adminPassword}`,
                },
            });
            if (response.ok) {
                showToast(`Üres csapat törölve!`, 'success');
                await window.raceManager.loadData();
                renderTeamManager();
                window.renderAdminTable();
            } else {
                const res = await response.json();
                showToast(res.error || 'Hiba a törlésnél', 'error');
            }
        } catch (err) {
            showToast('Hálózati hiba a csapat törlésekor!', 'error');
        }
        return;
    }

    if (
        !confirm(
            `Biztosan feloszlatod a(z) "${teamName}" csapatot?\n\nMinden tagja (${memberIds.length} fő) egyéni indulóvá válik, a csapat pedig véglegesen törlődik!`
        )
    )
        return;

    try {
        const response = await fetch(`${API_URL}/remove-from-dragon-team`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${window.raceManager.adminPassword}`,
            },
            body: JSON.stringify({ memberIds }),
        });
        const result = await response.json();
        if (response.ok) {
            showToast(`Csapat feloszlatva! A tagok egyéni indulókká váltak.`, 'success');
            await window.raceManager.loadData();
            renderTeamManager();
            window.renderAdminTable();
        } else {
            showToast(result.error || 'Hiba történt!', 'error');
        }
    } catch (err) {
        showToast('Hálózati hiba a feloszlatás során!', 'error');
    }
};

window.removeMemberFromTeam = async (memberId, racerId, memberName, teamName) => {
    if (
        !confirm(
            `Biztosan kiveszed ${memberName} versenyzőt a(z) "${teamName}" csapatból? (Visszaalakul egyéni versenyzővé)`
        )
    )
        return;

    try {
        const response = await fetch(`${API_URL}/remove-from-dragon-team`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${window.raceManager.adminPassword}`,
            },
            body: JSON.stringify({ memberIds: [memberId] }),
        });
        const result = await response.json();
        if (response.ok) {
            showToast(`${memberName} sikeresen kivéve a csapatból!`, 'success');
            await window.raceManager.loadData();
            renderTeamManager();
            window.renderAdminTable();
        } else {
            showToast(result.error || 'Hiba történt!', 'error');
        }
    } catch (err) {
        showToast('Hálózati hiba az eltávolítás során!', 'error');
    }
};

window.moveMemberToTeam = async (memberId, targetBib, memberName) => {
    const rm = window.raceManager;
    const targetTeam = rm.data.racers.find(r => r.bib === parseInt(targetBib));
    if (!targetTeam) {
        showToast('A kiválasztott célcsapat nem található!', 'error');
        return;
    }
    const nameMember = targetTeam.members.find(m => m.otproba_id === 'CSAPATNEV');
    const targetName = nameMember ? nameMember.name : `Csapat #${targetBib}`;

    if (!confirm(`Biztosan áthelyezed ${memberName} versenyzőt a(z) "${targetName}" (#${targetBib}) csapatba?`)) {
        renderTeamManager();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/create-dragon-team`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${window.raceManager.adminPassword}`,
            },
            body: JSON.stringify({ memberIds: [memberId], bib: targetBib, name: targetName }),
        });
        const result = await response.json();
        if (response.ok) {
            showToast(`${memberName} sikeresen áthelyezve a(z) "${targetName}" csapatba!`, 'success');
            await window.raceManager.loadData();
            renderTeamManager();
            window.renderAdminTable();
        } else {
            showToast(result.error || 'Hiba történt!', 'error');
            renderTeamManager();
        }
    } catch (err) {
        showToast('Hálózati hiba az áthelyezés során!', 'error');
        renderTeamManager();
    }
};

window.addMemberToTeam = async (memberId, teamBib, teamName, _selectText) => {
    const rm = window.raceManager;
    let mName = 'versenyző';
    const racer = rm.data.racers.find(r => r.members && r.members.some(m => m.id === memberId));
    if (racer) {
        const member = racer.members.find(m => m.id === memberId);
        if (member) mName = member.name;
    }

    try {
        const response = await fetch(`${API_URL}/create-dragon-team`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${window.raceManager.adminPassword}`,
            },
            body: JSON.stringify({ memberIds: [memberId], bib: teamBib, name: teamName }),
        });
        const result = await response.json();
        if (response.ok) {
            showToast(`${mName} sikeresen hozzáadva a(z) "${teamName}" csapathoz!`, 'success');
            await window.raceManager.loadData();
            renderTeamManager();
            window.renderAdminTable();
        } else {
            showToast(result.error || 'Hiba történt!', 'error');
        }
    } catch (err) {
        showToast('Hálózati hiba a hozzáadás során!', 'error');
    }
};

window.selectExistingDragonTeam = val => {
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
            if (bibInput) {
                bibInput.value = data.bib || '';
                bibInput.disabled = true;
            }
            if (nameInput) {
                nameInput.value = data.name || '';
                nameInput.disabled = false;
            }

            if (inputsContainer) inputsContainer.style.display = 'flex';
            if (submitBtn) {
                submitBtn.innerHTML = `BEOSZTÁS ÉS ÁTNEVEZÉS A(Z) "${data.name}" CSAPATBA`;
                submitBtn.style.background = '#28a745';
            }
        } catch (err) {
            console.error('Hibás csapatadat formátum:', err);
        }
    } else {
        if (bibInput) {
            bibInput.value = '';
            bibInput.disabled = false;
        }
        if (nameInput) {
            nameInput.value = '';
            nameInput.disabled = false;
        }

        if (inputsContainer) inputsContainer.style.display = 'flex';
        if (submitBtn) {
            submitBtn.innerHTML = 'ÚJ EGYSÉG LÉTREHOZÁSA';
            submitBtn.style.background = 'var(--accent-primary)';
        }
    }
};

window.selectAllDragonMembers = checked => {
    document.querySelectorAll('.dragon-member-check:not(:disabled)').forEach(cb => (cb.checked = checked));
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
            showToast('Válassz ki legalább egy versenyzőt az eltávolításhoz!', 'error');
            return;
        }
        if (!confirm('Biztosan kiveszed a kijelölt versenyzőket a jelenlegi csapatukból? (Egyéni versenyzőkké válnak)'))
            return;

        try {
            const response = await fetch(`${API_URL}/remove-from-dragon-team`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${window.raceManager.adminPassword}`,
                },
                body: JSON.stringify({ memberIds: selectedIds }),
            });
            const result = await response.json();
            if (response.ok) {
                showToast(`Sikeres eltávolítás!`, 'success');
                teamSelect.value = '';
                window.selectExistingDragonTeam('');
                await window.raceManager.loadData();
                renderTeamManager();
                window.renderAdminTable();
            } else {
                showToast(result.error, 'error');
            }
        } catch (err) {
            showToast('Hiba a hálózati kapcsolatban!', 'error');
        }
        return;
    }

    if (selectedIds.length === 0) {
        showToast('Kérjük, válasszon ki legalább egy versenyzőt a beosztáshoz!', 'error');
        return;
    }

    const selectedMembers = selectedIds
        .map(id => (window.allDragonMembers || []).find(m => m.id === id))
        .filter(Boolean);
    const alreadyAssigned = selectedMembers.filter(m => m.isTeam);
    if (alreadyAssigned.length > 0) {
        const listStr = alreadyAssigned.map(m => ` - ${m.name} (${m.teamName || '#' + m.racerBib})`).join('\n');
        const confirmMsg = `Figyelem! Az alábbi versenyző(k) már be van(nak) osztva egy sárkányhajó egységbe:\n\n${listStr}\n\nEgy versenyző egyszerre csak egy egységben szerepelhet. Biztosan át szeretnéd őket osztani az új csapatba? (Ezzel automatikusan kikerülnek a régi egységükből!)`;
        if (!confirm(confirmMsg)) {
            return;
        }
    }

    if (!bib && !name) {
        showToast('Adja meg a csapat nevét vagy a rajtszámát!', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/create-dragon-team`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${window.raceManager.adminPassword}`,
            },
            body: JSON.stringify({ memberIds: selectedIds, bib, name }),
        });
        const result = await response.json();
        if (response.ok) {
            showToast(`Sikeres csapatépítés! #${result.bib || bib} egység feldolgozva.`, 'success');
            const teamSelect = document.getElementById('existing-dragon-teams-select');
            if (teamSelect) {
                teamSelect.value = '';
                window.selectExistingDragonTeam('');
            }
            await window.raceManager.loadData();
            renderTeamManager();
            window.renderAdminTable();
        } else {
            showToast(result.error, 'error');
        }
    } catch (err) {
        showToast('Hiba a szerver kapcsolatban!', 'error');
    }
};

window.generateDiploma = async (bibStr, selectedMemberName = 'ALL') => {
    const bib = parseInt(bibStr);
    if (isNaN(bib)) {
        showToast('Kérjük, adjon meg egy érvényes rajtszámot!', 'error');
        return;
    }

    const rm = window.raceManager;
    if (!rm || !rm.data || !rm.data.racers) {
        showToast('Az adatok még nem töltődtek be!', 'error');
        return;
    }

    const racer = rm.data.racers.find(r => r.bib === bib);
    if (!racer) {
        showToast('Nincs ilyen rajtszámmal rendelkező versenyző!', 'error');
        return;
    }

    showToast('Oklevél generálása folyamatban...', 'info');

    try {
        // Dinamikusan betöltjük a PDF-lib könyvtárat CDN-ről, ha még nincs betöltve
        if (typeof window.PDFLib === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/pdf-lib/dist/pdf-lib.min.js';
            document.head.appendChild(script);
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = () =>
                    reject(
                        new Error(
                            'Nem sikerült betölteni a PDF-lib könyvtárat a CDN-ről! Kérjük, ellenőrizze az internetkapcsolatot.'
                        )
                    );
            });
        }

        // Dinamikusan betöltjük a fontkit könyvtárat CDN-ről, ha még nincs betöltve
        if (typeof window.fontkit === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@pdf-lib/fontkit/dist/fontkit.umd.min.js';
            document.head.appendChild(script);
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = () => reject(new Error('Nem sikerült betölteni a fontkit könyvtárat a CDN-ről!'));
            });
        }

        // Helyezés kiszámítása
        const categoryRacers = rm.data.racers.filter(
            r => r.category === racer.category && r.distance === racer.distance
        );
        const sorted = categoryRacers.sort((a, b) => {
            if (a.status === 'finished' && b.status !== 'finished') return -1;
            if (a.status !== 'finished' && b.status === 'finished') return 1;
            if (a.status === 'finished' && b.status === 'finished') return (a.total_time || 0) - (b.total_time || 0);
            return (a.bib || 0) - (b.bib || 0);
        });

        let rankStr = '-';
        if (racer.status === 'finished') {
            const index = sorted.findIndex(r => r.bib === bib);
            if (index !== -1) rankStr = (index + 1).toString();
        }

        let name = formatRacerName(racer)
            .replace(/\t/g, ' ')
            .replace(/\r/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (selectedMemberName && selectedMemberName !== 'ALL') {
            name = selectedMemberName
                .replace(/\t/g, ' ')
                .replace(/\r/g, ' ')
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }
        const categoryName = rm.formatCategoryName(racer.category);
        const distanceStr = racer.distance;

        // Dinamikus elérési út meghatározása: HTTP/HTTPS esetén a relatív path tökéletesen azonos-eredetű (same-origin CORS-mentes),
        // de file:// protokoll esetén a backend szervertől kérjük le a sablont.
        let pdfUrl = 'Dunakeszi.pdf';
        if (window.location.protocol === 'file:') {
            const baseStaticUrl = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : '';
            pdfUrl = baseStaticUrl ? `${baseStaticUrl}/Dunakeszi.pdf` : 'Dunakeszi.pdf';
        }

        // PDF Letöltése és betöltése
        const existingPdfBytes = await fetch(pdfUrl).then(res => {
            if (!res.ok)
                throw new Error(
                    'Nem található a Dunakeszi.pdf fájl a szerveren! Kérjük, győződjön meg róla, hogy a szerver fut.'
                );
            return res.arrayBuffer();
        });

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
            const safeText = String(text || '')
                .replace(/\t/g, ' ')
                .replace(/\r/g, ' ')
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/ő/g, 'ö')
                .replace(/Ő/g, 'Ö')
                .replace(/ű/g, 'ü')
                .replace(/Ű/g, 'Ü');
            const textWidth = fontUsed.widthOfTextAtSize(safeText, size);
            firstPage.drawText(safeText, {
                x: centerX - textWidth / 2,
                y: y,
                size: size,
                font: fontUsed,
                color: color || rgb(0, 0, 0),
            });
        };

        const darkBlue = rgb(0.05, 0.2, 0.35);
        const isPlural =
            selectedMemberName && selectedMemberName !== 'ALL'
                ? false
                : (racer.members && racer.members.length > 1) ||
                  /csapat/i.test(name) ||
                  /s[aá]rk[aá]ny/i.test(racer.category || '');
        const reszereText = isPlural ? 'részükre, akik' : 'részére, aki';
        const elerteText = isPlural ? 'értek el' : 'ért el';

        let resultText = '';
        if (rankStr !== '-') {
            resultText = `${rankStr}. helyezést ${elerteText}`;
        } else {
            resultText = isPlural ? 'sikeresen teljesítették a távot' : 'sikeresen teljesítette a távot';
        }

        const centerX = width * 0.71;
        const maxTextWidth = width * 0.45;

        // Név méretének dinamikus csökkentése, ha túl hosszú (pl. sok csapattag)
        let nameSize = 28;
        let safeNameText = name.replace(/ő/g, 'ö').replace(/Ő/g, 'Ö').replace(/ű/g, 'ü').replace(/Ű/g, 'Ü');
        while (fontBold.widthOfTextAtSize(safeNameText, nameSize) > maxTextWidth && nameSize > 10) {
            nameSize -= 1;
        }

        // Minden felirat betűméretét és Y pozícióját az elvárt egyedi értékekre állítjuk,
        // elkerülve a képekre való rálógást az alsó részen.
        drawCenteredText(name, centerX, height * 0.76, nameSize, fontBold, darkBlue);
        drawCenteredText(reszereText, centerX, height * 0.71, 16, fontNormal, darkBlue);
        drawCenteredText('az Országos Vízitúra Bajnokság', centerX, height * 0.66, 14, fontBold, darkBlue);
        drawCenteredText('2. fordulóján a Dunakeszi Futam', centerX, height * 0.61, 14, fontNormal, darkBlue);
        drawCenteredText(
            `${categoryName} (${distanceStr}) kategóriában`,
            centerX,
            height * 0.56,
            14,
            fontBold,
            darkBlue
        );
        drawCenteredText(resultText, centerX, height * 0.51, 14, fontBold, darkBlue);

        // Hivatalos célidő kiírása, ha beérkezett
        if (racer.status === 'finished' && racer.total_time) {
            const timeDisplay = formatTime(racer.total_time);
            drawCenteredText(`Hivatalos időeredménye: ${timeDisplay}`, centerX, height * 0.46, 14, fontBold, darkBlue);
        }

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

        showToast('Az oklevél sikeresen letöltve!', 'success');
    } catch (err) {
        console.error('PDF hiba:', err);
        showToast('Hiba történt az oklevél generálása során: ' + err.message, 'error');
    }
};
