/**
 * --- FELÜLETI SEGÉDFUNKCIÓK (UI HELPER LAYER) ---
 * Általános megjelenítési segédfunkciók, formázás és navigáció.
 */

/**
 * Toast üzenet megjelenítése
 * @param {string} message - Az üzenet szövege
 * @param {string} [type='info'] - Az üzenet típusa ('success', 'error', 'info')
 */
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const bgColors = {
        success: 'rgba(0, 255, 136, 0.9)',
        error: 'rgba(255, 0, 60, 0.9)',
        info: 'rgba(0, 240, 255, 0.9)',
        warning: 'rgba(255, 165, 0, 0.9)',
    };

    toast.style.background = bgColors[type] || 'rgba(50,50,50,0.9)';
    toast.style.color = type === 'success' || type === 'info' ? '#000' : '#fff';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    toast.style.fontFamily = "'Space Mono', monospace";
    toast.style.fontWeight = 'bold';
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.3s ease-out';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Tab váltás kezelése
 * @param {string} tab - A kiválasztott tab neve
 */
export function switchTab(tab) {
    console.log(`Switching tab to: ${tab}`);
    const regForm = document.getElementById('registration-form');
    const liveResults = document.getElementById('live-results');
    const adminView = document.getElementById('admin-view');
    const clockContainer = document.getElementById('local-time-container');
    const btns = document.querySelectorAll('.nav-btn');

    btns.forEach(b => b.classList.remove('active'));

    // Vizualizáció vezérlése (Hero szekció mutatása/elrejtése)
    const heroSection = document.getElementById('main-hero-section');
    if (heroSection) {
        if (tab === 'admin') {
            heroSection.classList.add('hidden');
        } else {
            heroSection.classList.remove('hidden');
        }
    }

    // Mindent elrejt és visszahozza a regisztrációs űrlapot a helyére
    const regHome = document.getElementById('registration-form-home');
    if (regHome && regForm) {
        regHome.appendChild(regForm);
    }

    if (regForm) regForm.classList.add('hidden');
    if (liveResults) liveResults.classList.add('hidden');
    if (adminView) adminView.classList.add('hidden');
    if (clockContainer) clockContainer.classList.add('hidden');

    if (tab === 'regisztracio') {
        updateRegFormContext(false);
        if (regForm) regForm.classList.remove('hidden');
        const btn = document.getElementById('btn-regisztracio');
        if (btn) btn.classList.add('active');
    } else if (tab === 'eredmenyek') {
        if (liveResults) liveResults.classList.remove('hidden');
        if (clockContainer) clockContainer.classList.remove('hidden');
        const btn = document.getElementById('btn-eredmenyek');
        if (btn) btn.classList.add('active');
        if (window.raceManager) window.raceManager.updateLiveTimers();
    } else if (tab === 'admin') {
        if (adminView) adminView.classList.remove('hidden');
        if (clockContainer) clockContainer.classList.remove('hidden');
        const btn = document.getElementById('btn-admin');
        if (btn) btn.classList.add('active');

        const loginPanel = document.getElementById('admin-login-panel');
        const dashboardPanel = document.getElementById('admin-dashboard-panel');

        if (window.raceManager && window.raceManager.adminPassword) {
            if (loginPanel) loginPanel.classList.add('hidden');
            if (dashboardPanel) dashboardPanel.classList.remove('hidden');
            if (typeof window.renderAdminTable === 'function') window.renderAdminTable();
            window.raceManager.renderUI();
        } else {
            if (loginPanel) loginPanel.classList.remove('hidden');
            if (dashboardPanel) dashboardPanel.classList.add('hidden');
        }
    }
}

/**
 * Regisztrációs űrlap fejléc és lábléc frissítése kontextus szerint (Admin vs Publikus)
 */
export function updateRegFormContext(isAdmin) {
    const subtitle = document.getElementById('reg-form-subtitle');
    const title = document.getElementById('reg-form-title');
    const sectionTitle = document.getElementById('reg-form-section-title');
    const notice = document.getElementById('reg-form-payment-notice');

    const nameInput = document.getElementById('reg-name');
    const emailInput = document.getElementById('reg-email');
    const phoneInput = document.getElementById('reg-phone');

    if (isAdmin) {
        if (subtitle) subtitle.classList.add('hidden');
        if (title) title.textContent = 'Admin nevezés';
        if (sectionTitle) sectionTitle.classList.add('hidden');
        if (notice) notice.classList.add('hidden');

        if (nameInput) nameInput.removeAttribute('required');
        if (emailInput) emailInput.removeAttribute('required');
        if (phoneInput) phoneInput.removeAttribute('required');
    } else {
        if (subtitle) subtitle.classList.remove('hidden');
        if (title) title.textContent = 'DunakesziFutam 2026';
        if (sectionTitle) {
            sectionTitle.classList.remove('hidden');
            sectionTitle.textContent = 'Online Nevezés és Fizetés';
        }
        if (notice) notice.classList.remove('hidden');

        if (nameInput) nameInput.setAttribute('required', 'required');
        if (emailInput) emailInput.setAttribute('required', 'required');
        if (phoneInput) phoneInput.setAttribute('required', 'required');
    }
}

/**
 * Idő formázása (ms -> HH:mm:ss.SSS)
 * @param {number} ms - Időtartam miliszekundumban
 * @returns {string}
 */
export function formatTime(ms) {
    if (ms < 0) ms = 0;
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor(ms % 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Rendszer szintű megerősítő ablak megjelenítése
 */
let pendingConfirmAction = null;

export function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmModalMessage');
    if (modal && msgEl) {
        msgEl.textContent = message;
        pendingConfirmAction = onConfirm;
        modal.classList.add('active');
    }
}

export function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.classList.remove('active');
        pendingConfirmAction = null;
    }
}

export function executeConfirmedAction() {
    if (typeof pendingConfirmAction === 'function') {
        pendingConfirmAction();
    }
    closeConfirmModal();
}

/**
 * Versenyző taglistájának HTML formázása (CSAPATNEV kezelése)
 */
export function formatMemberListHtml(racer) {
    if (!racer.members || racer.members.length === 0) return racer.name || '-';
    const t = racer.members.find(m => m.otproba_id === 'CSAPATNEV');
    const rm = racer.members.filter(m => m.otproba_id !== 'CSAPATNEV');
    let html = '';

    if (t) {
        html += `<details style="cursor: pointer; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 8px; width: 100%;">
                    <summary style="font-weight:bold; color:var(--accent-primary); outline: none; margin-bottom: 5px;">${t.name} <span style="font-size: 0.8em;">▼</span></summary>
                    <div style="margin-top: 10px; padding: 10px; border-left: 2px solid var(--accent-secondary); display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; background: rgba(0,0,0,0.1); border-radius: 6px;">`;
        html += rm
            .map(
                m =>
                    `<div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;">
                        <input type="checkbox" ${m.checked_in ? 'checked' : ''} onchange="if(window.raceManager) window.raceManager.updateMemberStatus('${m.id}', 'checked_in', this.checked)" style="cursor:pointer; width:14px; height:14px; margin-right:3px; transform: scale(1.1); vertical-align: middle;">
                        <strong onclick="window.raceManager.openEditModal('${racer.id}')" style="cursor: pointer; color: var(--accent-primary);" title="Versenyző/Csapat szerkesztése">${m.name || '?'}</strong>
                        <span style="font-size:0.7rem; color:#aaa;">(${m.birth_date || '?'})</span>
                    </div>`
            )
            .join('');
        html += `</div></details>`;
    } else {
        html += rm
            .map(
                m =>
                    `<div style="margin-bottom:4px; display: flex; align-items: center; gap: 6px;">
                        ${racer.members.length > 1 ? `<input type="checkbox" ${m.checked_in ? 'checked' : ''} onchange="if(window.raceManager) window.raceManager.updateMemberStatus('${m.id}', 'checked_in', this.checked)" style="cursor:pointer; width:14px; height:14px; transform: scale(1.1); vertical-align: middle;">` : ''}
                        <strong onclick="window.raceManager.openEditModal('${racer.id}')" style="cursor: pointer; color: var(--text-primary);" title="Versenyző szerkesztése">${m.name || '?'}</strong> 
                        <span style="font-size:0.7rem; color:#888;">(${m.birth_date || '?'})</span>
                    </div>`
            )
            .join('');
    }
    return html || racer.name || '-';
}

/**
 * Versenyző egyszerű nevének lekérése (Excel / Keresés / Címkék)
 */
export function formatRacerName(racer) {
    if (!racer.members || racer.members.length === 0) return racer.name || '-';
    const t = racer.members.find(m => m.otproba_id === 'CSAPATNEV');
    const rm = racer.members.filter(m => m.otproba_id !== 'CSAPATNEV');
    let nameStr = t ? t.name : '';
    if (rm.length > 0) {
        const memNames = rm.map(m => m.name).join(', ');
        nameStr = t ? `${t.name} (${memNames})` : memNames;
    }
    return nameStr || racer.name || '-';
}

/**
 * Ötpróba ID-k HTML formázása (CSAPATNEV kihagyása)
 */
export function formatOtprobaListHtml(racer) {
    if (!racer.members || racer.members.length === 0) return racer.otproba_id || '-';
    const t = racer.members.find(m => m.otproba_id === 'CSAPATNEV');
    const rm = racer.members.filter(m => m.otproba_id !== 'CSAPATNEV');

    if (t) {
        return `<span style="color:#888; font-size: 0.8rem;">(Lásd a neveknél)</span>`;
    }
    return rm.map(m => `<div style="margin-bottom:2px;">${m.otproba_id || '-'}</div>`).join('') || '-';
}
