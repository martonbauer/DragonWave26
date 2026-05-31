/**
 * DragonWave - Adminisztrációs Rendszer Főmodul (admin.js)
 * v2.3.0 különválasztott verzió
 */

import { RaceManager } from './js/RaceManager.js';
import {
    showToast,
    formatTime,
    updateRegFormContext,
    showConfirmModal,
    closeConfirmModal,
    executeConfirmedAction,
} from './js/ui-utils.js';
import {
    renderAdminTable,
    renderAdminControlButtons,
    exportResultsToExcel,
    exportFilteredTableToExcel,
    renderAdminCategoryList,
    renderAdminCategoryDetail,
    renderBibManagementTable,
    renderResultsCategoryList,
    renderResultsCategoryDetail,
} from './js/admin-ui.js';
import { API_URL, APP_VERSION } from './js/api.js';

// --- Globális ablak-szintű függvények a HTML eseménykezelőkhöz ---
window.showToast = showToast;
window.formatTime = formatTime;
window.showConfirmModal = showConfirmModal;
window.closeConfirmModal = closeConfirmModal;
window.executeConfirmedAction = executeConfirmedAction;
window.renderAdminTable = renderAdminTable;
window.renderAdminControlButtons = renderAdminControlButtons;
window.exportResultsToExcel = exportResultsToExcel;

// Inicializálás
window.raceManager = new RaceManager();

// --- Adminisztrációs Hitelesítés ---
window.loginAdmin = async () => {
    const password = document.getElementById('admin-pass').value;
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        const result = await response.json();
        if (response.ok && result.success) {
            console.log('Login successful');
            window.raceManager.adminPassword = password;
            sessionStorage.setItem('dragonAdminPassword', password);

            const loginPanel = document.getElementById('admin-login-panel');
            const dashboardPanel = document.getElementById('admin-dashboard-panel');

            if (loginPanel) loginPanel.classList.add('hidden');
            if (dashboardPanel) dashboardPanel.classList.remove('hidden');

            window.showAdminLanding();

            if (typeof window.renderAdminTable === 'function') window.renderAdminTable();
            window.raceManager.renderUI();
            showToast('Sikeres belépés!', 'success');
        } else {
            console.error('Login failed:', result.message || result.error || 'Unknown error');
            showToast(result.message || result.error || 'Hibás jelszó!', 'error');
        }
    } catch (err) {
        console.error('Login error:', err);
        showToast('Hiba a belépés során!', 'error');
    }
};

window.logoutAdmin = () => {
    sessionStorage.removeItem('dragonAdminPassword');
    if (window.raceManager) window.raceManager.adminPassword = '';
    document.getElementById('admin-login-panel').classList.remove('hidden');
    document.getElementById('admin-dashboard-panel').classList.add('hidden');
    document.getElementById('admin-pass').value = '';

    // Minden al-szekció elrejtése
    document.querySelectorAll('.admin-sub-section').forEach(s => s.classList.add('hidden'));
    document.getElementById('admin-landing-view').classList.remove('hidden');

    showToast('Sikeres kijelentkezés', 'info');
};

// --- Navigáció ---
window.showAdminSection = sectionId => {
    if (sectionId === 'admin-section-teams') {
        window.showAdminSection('admin-section-data');
        window.showDataSubSection('admin-data-section-teams');
        return;
    }
    if (sectionId === 'admin-section-system') {
        window.showAdminSection('admin-section-data');
        window.showDataSubSection('admin-data-section-system');
        return;
    }

    document.getElementById('admin-landing-view').classList.add('hidden');
    document.querySelectorAll('.admin-sub-section').forEach(s => s.classList.add('hidden'));

    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('hidden');

    if (sectionId === 'admin-section-data') {
        window.showDataLanding();
        window.renderAdminTable();
    }

    if (sectionId === 'admin-section-stats') {
        window.loadAnalyticsStats();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.loadAnalyticsStats = async () => {
    try {
        const response = await fetch(`${API_URL}/analytics/stats`, {
            headers: {
                ...window.raceManager.getAuthHeader(),
            },
        });
        const result = await response.json();
        if (response.ok && result.success) {
            const s = result.stats;

            document.getElementById('analytics-total-views').textContent = s.totalViews.toLocaleString('hu-HU');
            document.getElementById('analytics-unique-visitors').textContent =
                s.uniqueVisitorsCount.toLocaleString('hu-HU');
            document.getElementById('analytics-avg-views').textContent = s.avgViewsPerVisitor;
            document.getElementById('analytics-registered-count').textContent =
                s.registeredCount.toLocaleString('hu-HU');

            document.getElementById('analytics-breakdown-hourly').textContent =
                s.breakdown.hourly.toLocaleString('hu-HU');
            document.getElementById('analytics-breakdown-daily').textContent =
                s.breakdown.daily.toLocaleString('hu-HU');
            document.getElementById('analytics-breakdown-weekly').textContent =
                s.breakdown.weekly.toLocaleString('hu-HU');
            document.getElementById('analytics-breakdown-monthly').textContent =
                s.breakdown.monthly.toLocaleString('hu-HU');
            document.getElementById('analytics-breakdown-yearly').textContent =
                s.breakdown.yearly.toLocaleString('hu-HU');

            const tbody = document.getElementById('analytics-visitors-table-body');
            if (tbody) {
                if (s.visitorDetails.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888;">Nincs még betöltött látogatói adat.</td></tr>`;
                } else {
                    tbody.innerHTML = s.visitorDetails
                        .map(
                            v => `
                        <tr>
                            <td style="font-family: 'Space Mono', monospace; font-size: 0.85rem;">👤 ${v.visitorId}</td>
                            <td style="font-weight: 700; text-align: center;">${v.views}</td>
                            <td style="font-size: 0.85rem; color: var(--text-secondary);">${v.pagesViewed}</td>
                            <td style="text-align: center;">${v.hasRegistered ? '<span style="color: #00FFC2; font-weight: bold;">✅ IGEN</span>' : '<span style="color: #FF4D4D;">❌ NEM</span>'}</td>
                            <td style="color: var(--text-secondary); font-size: 0.85rem;">${v.lastActive}</td>
                        </tr>
                    `
                        )
                        .join('');
                }
            }
        } else {
            showToast('Hiba az analitika betöltésekor: ' + (result.error || 'Ismeretlen'), 'error');
        }
    } catch (err) {
        console.error('Analytics load error:', err);
        showToast('Hálózati hiba a statisztikák betöltésekor!', 'error');
    }
};

window.showAdminLanding = () => {
    const regForm = document.getElementById('registration-form');
    const regHome = document.getElementById('registration-form-home');
    if (regForm && regHome) {
        updateRegFormContext(false);
        regHome.appendChild(regForm);
        regForm.classList.add('hidden');
    }

    document.querySelectorAll('.admin-sub-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.admin-data-sub').forEach(s => s.classList.add('hidden'));
    document.getElementById('admin-landing-view').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.updateAdminDataHeader = (title, backAction = null, useLocalBack = false) => {
    const mainTitle = document.getElementById('admin-data-main-title');
    const backBtn = document.getElementById('btn-data-back-to-landing');

    if (mainTitle) mainTitle.textContent = title;

    if (backBtn) {
        if (useLocalBack || !backAction) {
            backBtn.classList.add('hidden');
        } else {
            backBtn.classList.remove('hidden');
            backBtn.onclick = backAction;
            backBtn.textContent = '⬅️ Vissza az adatkezeléshez';
        }
    }
};

window.showDataSubSection = async subId => {
    document.getElementById('admin-data-landing-view').classList.add('hidden');
    document.querySelectorAll('.admin-data-sub').forEach(s => s.classList.add('hidden'));

    const target = document.getElementById(subId);
    if (target) target.classList.remove('hidden');

    const titles = {
        'admin-data-section-import': '📥 Tömeges Nevezés / CSV Feltöltés',
        'admin-data-section-nevezes': '📝 Adminisztrátori Nevezés',
        'admin-data-section-table': '👥 Versenyzői Adatbázis',
        'admin-data-section-export': '📊 Eredmények Listázása',
        'admin-data-section-system': '⚙️ Rendszerkezelés',
        'admin-data-section-bibs': '🔢 Rajtszámok Újraosztása',
    };

    window.updateAdminDataHeader(titles[subId] || '📂 Adatkezelés', window.showDataLanding);

    if (subId === 'admin-data-section-nevezes') {
        const regForm = document.getElementById('registration-form');
        if (regForm && target) {
            updateRegFormContext(true);
            target.appendChild(regForm);
            regForm.classList.remove('hidden');
        }
    }

    if (subId === 'admin-data-section-bibs') {
        renderBibManagementTable();
    }

    if (subId === 'admin-data-section-teams') {
        const { renderTeamManager } = await import('./js/admin-ui.js');
        renderTeamManager();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.showDataLanding = () => {
    const regForm = document.getElementById('registration-form');
    const regHome = document.getElementById('registration-form-home');
    if (regForm && regHome) {
        updateRegFormContext(false);
        regHome.appendChild(regForm);
        regForm.classList.add('hidden');
    }

    document.querySelectorAll('.admin-data-sub').forEach(s => s.classList.add('hidden'));
    document.getElementById('admin-data-landing-view').classList.remove('hidden');

    window.updateAdminDataHeader('📂 Adatkezelés & Adatbázis', null);

    document.getElementById('admin-table-content-view').classList.add('hidden');
    document.getElementById('admin-table-category-list-view').classList.add('hidden');
    const otprobaView = document.getElementById('admin-table-otproba-view');
    if (otprobaView) otprobaView.classList.add('hidden');
    document.getElementById('admin-table-landing-view').classList.remove('hidden');

    document.getElementById('admin-results-content-view').classList.add('hidden');
    document.getElementById('admin-results-category-list-view').classList.add('hidden');
    document.getElementById('admin-results-landing-view').classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.showTableSubSection = mode => {
    document.getElementById('admin-table-landing-view').classList.add('hidden');
    document.getElementById('admin-table-content-view').classList.add('hidden');
    document.getElementById('admin-table-category-list-view').classList.add('hidden');
    document.getElementById('admin-data-section-bibs').classList.add('hidden');
    const otprobaView = document.getElementById('admin-table-otproba-view');
    if (otprobaView) otprobaView.classList.add('hidden');

    if (mode === 'category-list') {
        document.getElementById('admin-table-category-list-view').classList.remove('hidden');
        window.updateAdminDataHeader('🏷️ Nevezettek Kategóriánként', window.showTableLanding);
        window.backToCategorySelector();
    } else if (mode === 'admin-data-section-bibs') {
        document.getElementById('admin-data-section-bibs').classList.remove('hidden');
        window.updateAdminDataHeader('🔢 Rajtszámok Újraosztása', window.showTableLanding);
        window.renderBibManagementTable();
    } else if (mode === 'otproba') {
        if (otprobaView) otprobaView.classList.remove('hidden');
        window.updateAdminDataHeader('🏅 Nevezettek 5Próba Azonosítóval', window.showTableLanding);
        if (typeof window.renderOtprobaList === 'function') window.renderOtprobaList();
    } else {
        document.getElementById('admin-table-content-view').classList.remove('hidden');
        const filterCtrls = document.getElementById('admin-table-filter-ctrls');
        if (filterCtrls) filterCtrls.classList.remove('hidden');

        if (mode === 'all') {
            window.updateAdminDataHeader('👥 Összes Versenyző Listája', null, true);
            window.filterAdminTable('all');
        } else {
            window.updateAdminDataHeader('🔍 Nevezettek Távonként', null, true);
            window.filterAdminTable('22km');
        }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.showTableLanding = () => {
    document.getElementById('admin-table-content-view').classList.add('hidden');
    document.getElementById('admin-table-category-list-view').classList.add('hidden');
    document.getElementById('admin-data-section-bibs').classList.add('hidden');
    const otprobaView = document.getElementById('admin-table-otproba-view');
    if (otprobaView) otprobaView.classList.add('hidden');
    document.getElementById('admin-table-landing-view').classList.remove('hidden');

    window.updateAdminDataHeader('👥 Versenyzői Adatbázis', window.showDataLanding);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.showCategoryDetail = (distId, catId) => {
    document.getElementById('admin-category-selector-view').classList.add('hidden');
    document.getElementById('admin-category-detail-view').classList.remove('hidden');
    window.updateAdminDataHeader(window.raceManager.formatCategoryName(catId), null, true);
    renderAdminCategoryDetail(distId, catId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.backToCategorySelector = () => {
    document.getElementById('admin-category-detail-view').classList.add('hidden');
    document.getElementById('admin-category-selector-view').classList.remove('hidden');
    window.updateAdminDataHeader('🏷️ Nevezettek Kategóriánként', null, true);
    renderAdminCategoryList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.filterAdminTable = type => {
    window.currentTableFilter = type;
    window.renderAdminTable(type);

    const container = document.getElementById('admin-table-filter-ctrls');
    if (container) {
        const buttons = container.querySelectorAll('.btn-secondary');
        buttons.forEach(btn => {
            const clickAttr = btn.getAttribute('onclick') || '';
            if (clickAttr.includes(`'${type}'`)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
};

window.exportFilteredTable = () => {
    exportFilteredTableToExcel(window.currentTableFilter || 'all');
};

window.exportSpecificCategoryExcel = (distId, catId) => {
    exportFilteredTableToExcel(distId, catId);
};

window.currentTableFilter = 'all';

// --- Eredmények al-navigáció ---
window.showResultsLanding = () => {
    document.getElementById('admin-results-landing-view').classList.remove('hidden');
    document.getElementById('admin-results-content-view').classList.add('hidden');
    document.getElementById('admin-results-category-list-view').classList.add('hidden');

    window.updateAdminDataHeader('🏆 Eredmények Listázása', window.showDataLanding);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.showResultsSubSection = mode => {
    document.getElementById('admin-results-landing-view').classList.add('hidden');
    document.getElementById('admin-results-content-view').classList.add('hidden');
    document.getElementById('admin-results-category-list-view').classList.add('hidden');

    if (mode === 'category-list') {
        document.getElementById('admin-results-category-list-view').classList.remove('hidden');
        window.updateAdminDataHeader('🥇 Kategória Eredmények', null, true);
        window.backToResultsCategorySelector();
    } else {
        document.getElementById('admin-results-content-view').classList.remove('hidden');
        const filterCtrls = document.getElementById('admin-results-filter-ctrls');
        const allCtrls = document.getElementById('admin-results-all-ctrls');

        if (mode === 'all') {
            window.currentResultsFilter = 'all';
            window.updateAdminDataHeader('🏆 Összes Eredménylista', null, true);
            filterCtrls.classList.add('hidden');
            allCtrls.classList.remove('hidden');
            window.renderResultsTable('all');
        } else {
            window.currentResultsFilter = '22km';
            window.updateAdminDataHeader('📏 Távonkénti Összetett', null, true);
            filterCtrls.classList.remove('hidden');
            allCtrls.classList.add('hidden');
            window.filterResultsTable('22km');
        }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.filterResultsTable = type => {
    window.currentResultsFilter = type;
    window.renderResultsTable(type);

    const container = document.getElementById('admin-results-filter-ctrls');
    if (container) {
        const buttons = container.querySelectorAll('.btn-secondary');
        buttons.forEach(btn => {
            if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${type}'`)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
};

window.showResultsCategoryDetail = (distId, catId) => {
    document.getElementById('admin-results-category-selector').classList.add('hidden');
    document.getElementById('admin-results-category-detail').classList.remove('hidden');
    window.currentResultsDistId = distId;
    window.currentResultsCatId = catId;
    window.updateAdminDataHeader(window.raceManager.formatCategoryName(catId), null, true);
    renderResultsCategoryDetail(distId, catId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.backToResultsCategorySelector = () => {
    document.getElementById('admin-results-category-detail').classList.add('hidden');
    document.getElementById('admin-results-category-selector').classList.remove('hidden');
    window.updateAdminDataHeader('🥇 Kategória Eredmények', null, true);
    renderResultsCategoryList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.exportResultsExcelSub = () => {
    if (window.currentResultsFilter === 'all') {
        window.exportResultsToExcel();
    } else {
        window.exportFilteredTableToExcel(window.currentResultsFilter);
    }
};

window.exportCategoryResultsExcel = () => {
    exportFilteredTableToExcel(window.currentResultsDistId, window.currentResultsCatId);
};

window.currentResultsFilter = 'all';

// --- Eseménykezelő Wrapper-ek ---
window.startCategory = (cat, dist, group) => window.raceManager.startCategory(cat, dist, group);
window.startIndividual = bib => window.raceManager.startIndividual(bib);
window.startMass = () => window.raceManager.startMass();
window.startDistance = dist => window.raceManager.startDistance(dist);
window.stopCategory = (cat, dist, group) => window.raceManager.stopCategory(cat, dist, group);
window.resetCategory = (cat, dist, group) => window.raceManager.resetCategory(cat, dist, group);

window.stopRacer = () => {
    const input = document.getElementById('bib-input');
    if (input && input.value) {
        window.raceManager.stopRacer(input.value);
        input.value = '';
        input.focus();
    } else {
        showToast('Kérem adja meg a rajtszámot!', 'error');
    }
};

window.recordCheckpoint = () => {
    const input = document.getElementById('checkpoint-bib-input');
    const select = document.getElementById('checkpoint-name-select');
    if (input && input.value && select && select.value) {
        window.raceManager.recordCheckpoint(input.value, select.value);
    } else {
        showToast('Kérem adja meg a rajtszámot és az ellenőrzőpontot!', 'error');
    }
};

window.toggleWaitingListCards = show => {
    const ids = ['waiting-list-container-starts', 'waiting-list-container-live'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    });

    if (show && window.raceManager) {
        window.raceManager.renderWaitingListCards();
        const firstVisible = document.querySelector('.admin-card:not(.hidden)[id^="waiting-list-container"]');
        if (firstVisible) {
            firstVisible.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
};

window.toggleRunningListCards = show => {
    const ids = ['running-list-container-starts', 'running-list-container-live'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    });

    if (show && window.raceManager) {
        window.raceManager.renderRunningListCards();
        const firstVisible = document.querySelector('.admin-card:not(.hidden)[id^="running-list-container"]');
        if (firstVisible) {
            firstVisible.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
};

window.toggleFinishedListCards = show => {
    const ids = ['finished-list-container-starts', 'finished-list-container-live'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    });

    if (show && window.raceManager) {
        window.raceManager.renderFinishedListCards();
        const firstVisible = document.querySelector('.admin-card:not(.hidden)[id^="finished-list-container"]');
        if (firstVisible) {
            firstVisible.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
};

window.toggleNotTurnedListCards = show => {
    const el = document.getElementById('not-turned-list-container-live');
    if (el) {
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }

    if (show && window.raceManager) {
        window.raceManager.renderNotTurnedListCards();
        if (el && !el.classList.contains('hidden')) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
};

// --- CSV Import ---
window.uploadCsv = async () => {
    const fileInput = document.getElementById('csv-upload');
    if (!fileInput || fileInput.files.length === 0) {
        showToast('Válasszon ki egy CSV fájlt!', 'error');
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async e => {
        const buffer = e.target.result;
        let csvData;
        try {
            const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
            csvData = utf8Decoder.decode(buffer);
        } catch (err) {
            const win1250Decoder = new TextDecoder('windows-1250');
            csvData = win1250Decoder.decode(buffer);
        }
        try {
            const response = await fetch(`${API_URL}/upload-csv`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...window.raceManager.getAuthHeader(),
                },
                body: JSON.stringify({ csvData }),
            });
            const result = await response.json();
            if (response.ok) {
                let msg = `Sikeres importálás: ${result.importedCount} versenyző`;
                if (result.duplicatesCount > 0) {
                    msg += ` (${result.duplicatesCount} ütközés: Admin jóváhagyás szükséges)`;
                }
                showToast(msg, 'success');

                if (result.logs && result.logs.length > 0) {
                    alert('Importálási napló:\n\n' + result.logs.join('\n'));
                }

                await window.raceManager.loadData();
                window.raceManager.renderUI();
                fileInput.value = '';
            } else {
                showToast(result.error, 'error');
            }
        } catch (err) {
            showToast('Hiba a feltöltés során!', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
};

// --- Alkalmazás Indítás ---
document.addEventListener('DOMContentLoaded', () => {
    // Verziószám kijelzés
    const versionEl = document.createElement('div');
    versionEl.style = 'position:fixed; bottom:5px; left:5px; font-size:10px; color:#444; z-index:9999;';
    versionEl.textContent = `System v${APP_VERSION}`;
    document.body.appendChild(versionEl);

    // Kategória választó modul adminisztrátori nevezéshez
    window.updateCategorySelect = () => {
        const dist = document.getElementById('versenytav').value;
        const catSelect = document.getElementById('kategoria');
        catSelect.innerHTML = '<option value="" disabled selected>Válassz kategóriát...</option>';

        const categories = {
            '11km': [
                { id: 'kajak_1_nyitott', name: 'Kajak-1 nyitott' },
                { id: 'kajak_2_nyitott', name: 'Kajak-2 nyitott' },
                { id: 'kenu_1_nyitott', name: 'Kenu-1 nyitott' },
                { id: 'kenu_2_nyitott', name: 'Kenu-2 nyitott' },
                { id: 'kenu_3_nyitott', name: 'Kenu-3 nyitott' },
                { id: 'kenu_4_nyitott', name: 'Kenu-4 nyitott' },
                { id: 'sup_ferfi_1_merev', name: 'SUP férfi-1- merev deszka' },
                { id: 'sup_noi_1_merev', name: 'SUP női-1- merev deszka' },
                { id: 'sup_ferfi_1_felfujhato', name: 'SUP férfi-1- felfújható deszka' },
                { id: 'sup_noi_1_felfujhato', name: 'SUP női-1- felfújható deszka' },
                { id: 'sarkanyhajo_otproba', name: 'Sárkányhajó' },
            ],
            '22km': [
                { id: 'versenykajak_noi_1', name: 'Versenykajak női-1 (38 cm)' },
                { id: 'versenykajak_ferfi_1', name: 'Versenykajak férfi-1 (38 cm)' },
                { id: 'turakajak_noi_1', name: 'Túrakajak női-1 (42–51 cm)' },
                { id: 'turakajak_ferfi_1', name: 'Túrakajak férfi-1 (42–51 cm)' },
                { id: 'turakajak_2_nyitott', name: 'Túrakajak 2 (nyitott)' },
                { id: 'tengeri_kajak_noi_1', name: 'Tengeri kajak női-1 (51 cm>)' },
                { id: 'tengeri_kajak_ferfi_1', name: 'Tengeri kajak férfi-1 (51 cm>)' },
                { id: 'surfski_noi', name: 'Surfski kajak női' },
                { id: 'surfski_ferfi', name: 'Surfski kajak férfi' },
                { id: 'outrigger_noi_1', name: 'Outrigger női-1' },
                { id: 'outrigger_ferfi_1', name: 'Outrigger férfi-1' },
                { id: 'outrigger_2_nyitott', name: 'Outrigger-2 (nyitott)' },
                { id: 'kenu_2_ferfi', name: 'Kenu-2 férfi' },
                { id: 'kenu_2_vegyes', name: 'Kenu-2 vegyes' },
                { id: 'kenu_3_nyitott', name: 'Kenu-3 (nyitott)' },
                { id: 'kenu_4_nyitott', name: 'Kenu-4 (nyitott)' },
                { id: 'sup_noi_1', name: 'SUP női-1' },
                { id: 'sup_ferfi_1', name: 'SUP férfi-1' },
            ],
            '4km': [
                { id: 'sup_noi_1_merev_39_alatt', name: 'SUP női-1- merev deszka 39 év alatt' },
                { id: 'sup_noi_1_merev_40_felett', name: 'SUP női-1- merev deszka 40 év felett' },
                { id: 'sup_ferfi_1_merev_39_alatt', name: 'SUP férfi-1- merev deszka 39 év alatt' },
                { id: 'sup_ferfi_1_merev_40_felett', name: 'SUP férfi-1- merev deszka 40 év felett' },
                { id: 'sup_noi_1_felfujhato_39_alatt', name: 'SUP női-1- felfújható deszka 39 év alatt' },
                { id: 'sup_noi_1_felfujhato_40_felett', name: 'SUP női-1- felfújható deszka 40 év felett' },
                { id: 'sup_ferfi_1_felfujhato_39_alatt', name: 'SUP férfi-1- felfújható deszka 39 év alatt' },
                { id: 'sup_ferfi_1_felfujhato_40_felett', name: 'SUP férfi-1- felfújható deszka 40 év felett' },
                { id: 'sup_ferfi_1_felfujhato_16_alatt', name: 'SUP férfi-1- felfújható deszka 16 év alatt' },
                { id: 'sup_noi_1_felfujhato_16_alatt', name: 'SUP női-1- felfújható deszka 16 év alatt' },
            ],
        };

        if (categories[dist]) {
            categories[dist].forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                catSelect.appendChild(opt);
            });
        }
        document.getElementById('members-container').innerHTML =
            '<div style="text-align: center; padding: 20px; color: #888; border: 1px dashed #444; border-radius: 8px; margin: 15px 0;">Válassz kategóriát...</div>';
    };

    // Adminisztrátori Nevezés Submit
    document.getElementById('nevezesForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const kategoria = document.getElementById('kategoria').value;
        const tav = document.getElementById('versenytav').value;
        const email = document.getElementById('reg-email').value.trim() || 'admin@dragonwave.hu';
        const phone = document.getElementById('reg-phone').value.trim() || '0000';
        const contactName = document.getElementById('reg-name').value.trim() || 'Adminisztrátor';

        const members = [];
        try {
            document.querySelectorAll('.member-entry').forEach((entry, idx) => {
                const name = entry.querySelector('.member-name').value.trim();
                const birth_date = entry.querySelector('.member-birth').value;
                const otprobaInp = entry.querySelector('.member-otproba');
                const otproba_id = otprobaInp.disabled ? 'Nincs' : otprobaInp.value;

                if (entry.classList.contains('team-name-entry') && !name) return;
                if (!name || !birth_date) throw new Error(`Kérjük adja meg a(z) ${idx + 1}. versenyző minden adatát!`);
                members.push({ name, birth_date, otproba_id });
            });

            const regResult = await window.raceManager.registerRacer(
                members,
                kategoria,
                tav,
                false,
                email,
                phone,
                contactName,
                true // isAdmin
            );
            this.reset();
            window.updateCategorySelect();

            if (regResult && regResult.id) {
                const wantsTeam = confirm(
                    'Sikeres adminisztrátori nevezés! Szeretnéd a most felvitt versenyző(ke)t közvetlenül beosztani egy csapatba/egységbe?'
                );
                if (wantsTeam) {
                    window.newlyRegisteredRacerId = regResult.id;
                    window.showDataSubSection('admin-data-section-teams');
                }
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Enter gomb a rajtszám rögzítéshez
    const bibInput = document.getElementById('bib-input');
    if (bibInput)
        bibInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') window.stopRacer();
        });

    // Enter gomb az ellenőrzőponthoz
    const cpBibInput = document.getElementById('checkpoint-bib-input');
    if (cpBibInput)
        cpBibInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') window.recordCheckpoint();
        });

    // Automatikus session belépés ha a jelszó már tárolva van
    const savedPassword = sessionStorage.getItem('dragonAdminPassword');
    if (savedPassword) {
        document.getElementById('admin-pass').value = savedPassword;
        window.loginAdmin();
    }
});
