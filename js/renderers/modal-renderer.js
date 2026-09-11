/**
 * --- MODAL RENDERER (modal-renderer.js) ---
 * Versenyző és egység szerkesztő modális ablak megjelenítése és mezőinek inicializálása.
 */

import { formatTime } from '../ui-utils.js';

export function updateEditCategoryOptions(rm, distance, selectValue = null) {
    const catSelect = document.getElementById('edit-category');
    const catCustom = document.getElementById('edit-category-custom');
    if (!catSelect) return;

    catSelect.innerHTML = '<option value="" disabled selected>Válassz kategóriát...</option>';

    const keys = rm.distanceCategories[distance] || [];
    keys.forEach(slug => {
        const name = rm.categoryMap[slug];
        if (name) {
            catSelect.appendChild(new Option(name, slug));
        }
    });

    if (selectValue) {
        const exists = Array.from(catSelect.options).some(opt => opt.value === selectValue);
        if (!exists) {
            const name = rm.categoryMap[selectValue] || `${selectValue} (Egyedi)`;
            catSelect.appendChild(new Option(name, selectValue));
        }
        catSelect.value = selectValue;
    } else {
        catSelect.value = '';
    }

    catSelect.appendChild(new Option('➕ Egyéb (kézi megadás)...', '__custom__'));

    if (
        selectValue === '__custom__' ||
        (selectValue && !keys.includes(selectValue) && !rm.categoryMap[selectValue])
    ) {
        catSelect.value = '__custom__';
        if (catCustom) {
            catCustom.style.display = 'block';
            catCustom.value = selectValue === '__custom__' ? '' : selectValue;
        }
    } else {
        if (catCustom) {
            catCustom.style.display = 'none';
            catCustom.value = '';
        }
    }
}

export function openEditModal(rm, id, memberId = null) {
    if (!rm.data || !rm.data.racers) return;
    const racer = rm.data.racers.find(r => r.id === id);
    if (!racer) return;

    window.currentEditingRacer = JSON.parse(JSON.stringify(racer));
    window.currentEditingMemberId = memberId;

    const dataContainer = document.getElementById('edit-racer-data-container');
    const titleEl = document.querySelector('#editRacerModal .card-title');

    if (memberId) {
        if (dataContainer) dataContainer.style.display = 'none';
        if (titleEl) titleEl.innerHTML = '✏️ Versenyző Szerkesztése';
    } else {
        if (dataContainer) dataContainer.style.display = 'block';
        if (titleEl) titleEl.innerHTML = '✏️ Egység / Versenyző Szerkesztése';
    }

    document.getElementById('edit-id').value = racer.id;
    document.getElementById('edit-bib').value = racer.bib || '';
    document.getElementById('edit-status').value = racer.status || 'registered';

    const totalTimeEl = document.getElementById('edit-total_time');
    if (totalTimeEl) {
        totalTimeEl.value = racer.total_time ? formatTime(racer.total_time) : '';
    }

    const distanceVal = racer.distance || '11km';
    const editDistanceEl = document.getElementById('edit-distance');
    if (editDistanceEl) {
        editDistanceEl.value = distanceVal;
    }

    updateEditCategoryOptions(rm, distanceVal, racer.category);
    document.getElementById('edit-email').value = racer.email || '';
    document.getElementById('edit-phone').value = racer.phone || '';
    document.getElementById('edit-is_series').checked = !!racer.is_series;
    document.getElementById('edit-is_paid').value = racer.is_paid ? '1' : '0';

    const editDragonTeamContainer = document.getElementById('edit-dragon-team-container');
    const editDragonTeamSelect = document.getElementById('edit-dragon-team');

    if (editDragonTeamContainer && editDragonTeamSelect) {
        if (/s[aá]rk[aá]ny/i.test(racer.category || '')) {
            editDragonTeamContainer.style.display = 'block';
            editDragonTeamSelect.innerHTML = '<option value="">-- Jelenlegi állapot megtartása --</option>';

            const teams = [];
            rm.data.racers.forEach(r => {
                if (/s[aá]rk[aá]ny/i.test(r.category || '')) {
                    const tMember = (r.members || []).find(m => m.otproba_id === 'CSAPATNEV');
                    if (tMember && tMember.name) {
                        teams.push({ id: r.id, name: tMember.name, bib: r.bib });
                    }
                }
            });

            teams
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(t => {
                    if (t.id !== racer.id) {
                        editDragonTeamSelect.appendChild(
                            new Option(`${t.name} (#${t.bib || '-'})`, JSON.stringify(t))
                        );
                    }
                });
        } else {
            editDragonTeamContainer.style.display = 'none';
            editDragonTeamSelect.innerHTML = '';
        }
    }

    const container = document.getElementById('edit-members-container');
    if (container) {
        container.innerHTML = '';

        let membersToShow;
        const isTeam =
            racer.id.startsWith('DRAGON_') ||
            (racer.members && racer.members.some(m => m.otproba_id === 'CSAPATNEV'));

        if (memberId) {
            membersToShow = (racer.members || []).filter(m => m.id === memberId);
        } else if (isTeam) {
            const teamMember = (racer.members || []).find(m => m.otproba_id === 'CSAPATNEV');
            if (teamMember) {
                membersToShow = [teamMember];
            } else {
                membersToShow = [{ name: '', birth_date: '1900-01-01', otproba_id: 'CSAPATNEV' }];
            }
        } else {
            membersToShow = racer.members || [];
        }

        membersToShow.forEach(m => {
            const row = document.createElement('div');
            row.className = 'member-edit-row';
            let birth = m.birth_date || '';
            if (birth && birth.includes('.')) {
                const parts = birth.split('.');
                if (parts.length === 3)
                    birth = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }

            const isTeamName = m.otproba_id === 'CSAPATNEV';

            row.innerHTML = `
                <div style="display: flex; flex-direction: column;">
                    <label style="font-size: 0.7rem; color: ${isTeamName ? 'var(--accent-primary)' : 'var(--text-secondary)'}; margin-bottom: 2px;">${isTeamName ? 'Csapat Név' : 'Név'}</label>
                    <input type="text" class="edit-m-name" value="${m.name || ''}" placeholder="Név">
                </div>
                <div style="display: flex; flex-direction: column; ${isTeamName ? 'display: none;' : ''}">
                    <label style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 2px;">Szül. dátum</label>
                    <input type="text" onfocus="(this.type='date')" onblur="if(!this.value)this.type='text'" class="edit-m-birth" placeholder="ÉÉÉÉ.HH.NN." value="${birth}">
                </div>
                <div style="display: flex; flex-direction: column; ${isTeamName ? 'display: none;' : ''}">
                    <label style="font-size: 0.7rem; color: var(--accent-primary); margin-bottom: 2px;">5Próba ID</label>
                    <input type="text" class="edit-m-otproba" value="${isTeamName ? 'CSAPATNEV' : m.otproba_id || ''}" placeholder="Nincs">
                </div>
            `;
            container.appendChild(row);
        });
    }

    const modal = document.getElementById('editRacerModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

export function closeEditModal() {
    const modal = document.getElementById('editRacerModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}
