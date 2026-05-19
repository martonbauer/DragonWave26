/**
 * DragonWave - Fő belépési pont (Entry Point)
 * v2.2.1 modularizált verzió
 */

import { RaceManager } from './js/RaceManager.js';
import { switchTab, showToast, formatTime, updateRegFormContext, showConfirmModal, closeConfirmModal, executeConfirmedAction } from './js/ui-utils.js';
import { renderAdminTable, renderAdminControlButtons, exportResultsToExcel, exportFilteredTableToExcel, renderAdminCategoryList, renderAdminCategoryDetail, renderBibManagementTable, renderResultsCategoryList } from './js/admin-ui.js';
import { API_URL, APP_VERSION } from './js/api.js';

// --- Globális hatókör biztosítása a HTML onclick eseményekhez ---
window.switchTab = (tabId) => {
    // Ha az adminba váltunk, reseteljük a dashboardot a főoldalra
    if (tabId === 'admin' && typeof window.showAdminLanding === 'function') {
        window.showAdminLanding();
    }
    // Eredeti tab váltás hívása
    switchTab(tabId);
};
window.showToast = showToast;
window.formatTime = formatTime;
window.showConfirmModal = showConfirmModal;
window.closeConfirmModal = closeConfirmModal;
window.executeConfirmedAction = executeConfirmedAction;
window.renderAdminTable = renderAdminTable;
window.renderAdminControlButtons = renderAdminControlButtons;
window.exportResultsToExcel = exportResultsToExcel;
window.renderResultsCategoryList = renderResultsCategoryList;

// Inicializálás
window.raceManager = new RaceManager();

// --- Adminisztrációs Funkciók (Bejelentkezés / Kijelentkezés) ---
window.loginAdmin = async () => {
    const password = document.getElementById('admin-pass').value;
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            window.raceManager.adminPassword = password;
            sessionStorage.setItem('dragonAdminPassword', password);
            document.getElementById('admin-login-panel').classList.add('hidden');
            document.getElementById('admin-dashboard-panel').classList.remove('hidden');
            
            // Alapértelmezett nézet beállítása
            window.showAdminLanding();
            
            window.renderAdminTable();
            window.raceManager.renderUI();
            showToast('Sikeres belépés!', 'success');
        } else {
            showToast(result.error || 'Hibás jelszó!', 'error');
        }
    } catch (err) {
        showToast("Hiba a belépés során!", "error");
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

// --- Admin Navigációs Logika ---
window.showAdminSection = (sectionId) => {
    // Elrejtjük a landing oldalt és az összes többi szekciót
    document.getElementById('admin-landing-view').classList.add('hidden');
    document.querySelectorAll('.admin-sub-section').forEach(s => s.classList.add('hidden'));
    
    // Megjelenítjük a kért szekciót
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('hidden');
    
    // Ha az adatkezelés szekcióba lépünk, frissítsük a táblázatot és mutassuk a landingjét
    if (sectionId === 'admin-section-data') {
        window.showDataLanding();
        window.renderAdminTable();
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.showAdminLanding = () => {
    // Visszahozzuk a regisztrációs űrlapot a helyére, ha épp kint volt
    const regForm = document.getElementById('registration-form');
    const regHome = document.getElementById('registration-form-home');
    if (regForm && regHome) {
        updateRegFormContext(false);
        regHome.appendChild(regForm);
        regForm.classList.add('hidden');
    }

    // Elrejtünk minden al-szekciót és data-al-szekciót
    document.querySelectorAll('.admin-sub-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.admin-data-sub').forEach(s => s.classList.add('hidden'));
    // Megjelenítjük a landing view-t
    document.getElementById('admin-landing-view').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- Segédfüggvény a fejléc frissítéséhez ---
window.updateAdminDataHeader = (title, backAction = null, useLocalBack = false) => {
    const mainTitle = document.getElementById('admin-data-main-title');
    const backBtn = document.getElementById('btn-data-back-to-landing');
    
    if (mainTitle) mainTitle.textContent = title;
    
    if (backBtn) {
        // Ha van megadva helyi vissza gomb a HTML-ben, elrejtjük a központi vissza gombot
        if (useLocalBack || !backAction) {
            backBtn.classList.add('hidden');
        } else {
            backBtn.classList.remove('hidden');
            backBtn.onclick = backAction;
            backBtn.textContent = '⬅️ Vissza az adatkezeléshez';
        }
    }
};

// --- Adatkezelés Al-navigáció ---
window.showDataSubSection = async (subId) => {
    // Elrejtjük a data landinget és minden más data al-szekciót
    document.getElementById('admin-data-landing-view').classList.add('hidden');
    document.querySelectorAll('.admin-data-sub').forEach(s => s.classList.add('hidden'));
    
    // Megjelenítjük a cél szekciót
    const target = document.getElementById(subId);
    if (target) target.classList.remove('hidden');

    const titles = {
        'admin-data-section-import': '📥 Tömeges Nevezés / CSV Feltöltés',
        'admin-data-section-nevezes': '📝 Adminisztrátori Nevezés',
        'admin-data-section-table': '👥 Versenyzői Adatbázis',
        'admin-data-section-export': '📊 Eredmények Listázása',
        'admin-data-section-system': '⚙️ Rendszerkezelés',
        'admin-data-section-bibs': '🔢 Rajtszámok Újraosztása'
    };

    window.updateAdminDataHeader(titles[subId] || '📂 Adatkezelés', window.showDataLanding);

    // Ha a regisztrációs űrlapot kérik az adminban
    if (subId === 'admin-data-section-nevezes') {
        const regForm = document.getElementById('registration-form');
        if (regForm && target) {
            updateRegFormContext(true);
            target.appendChild(regForm);
            regForm.classList.remove('hidden');
        }
    }
    
    // Ha a rajtszám módosítás szekciót kérik
    if (subId === 'admin-data-section-bibs') {
        renderBibManagementTable();
    }

    // Ha a sárkányhajó építő szekciót kérik
    if (subId === 'admin-data-section-teams') {
        const { renderTeamManager } = await import('./js/admin-ui.js');
        renderTeamManager();
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.showDataLanding = () => {
    // Visszahozzuk a regisztrációs űrlapot a helyére
    const regForm = document.getElementById('registration-form');
    const regHome = document.getElementById('registration-form-home');
    if (regForm && regHome) {
        updateRegFormContext(false);
        regHome.appendChild(regForm);
        regForm.classList.add('hidden');
    }

    // Elrejtünk minden data al-szekciót és megmutatjuk a fő data landinget
    document.querySelectorAll('.admin-data-sub').forEach(s => s.classList.add('hidden'));
    document.getElementById('admin-data-landing-view').classList.remove('hidden');

    // Alaphelyzetbe állítjuk a címet és elrejtjük a vissza gombot
    window.updateAdminDataHeader('📂 Adatkezelés & Adatbázis', null);
    
    // Csendes reset a táblázat és eredmény nézetek belső állapotához
    document.getElementById('admin-table-content-view').classList.add('hidden');
    document.getElementById('admin-table-category-list-view').classList.add('hidden');
    document.getElementById('admin-table-landing-view').classList.remove('hidden');
    
    document.getElementById('admin-results-content-view').classList.add('hidden');
    document.getElementById('admin-results-category-list-view').classList.add('hidden');
    document.getElementById('admin-results-landing-view').classList.remove('hidden');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- Versenyzői Adatbázis Al-navigáció ---
window.showTableSubSection = (mode) => {
    // Elrejtünk minden táblázattal kapcsolatos nézetet
    document.getElementById('admin-table-landing-view').classList.add('hidden');
    document.getElementById('admin-table-content-view').classList.add('hidden');
    document.getElementById('admin-table-category-list-view').classList.add('hidden');
    document.getElementById('admin-data-section-bibs').classList.add('hidden');
    
    if (mode === 'category-list') {
        document.getElementById('admin-table-category-list-view').classList.remove('hidden');
        window.updateAdminDataHeader('🏷️ Nevezettek Kategóriánként', window.showTableLanding);
        window.backToCategorySelector(); 
    } else if (mode === 'admin-data-section-bibs') {
        document.getElementById('admin-data-section-bibs').classList.remove('hidden');
        window.updateAdminDataHeader('🔢 Rajtszámok Újraosztása', window.showTableLanding);
        window.renderBibManagementTable();
    } else {
        document.getElementById('admin-table-content-view').classList.remove('hidden');
        const filterCtrls = document.getElementById('admin-table-filter-ctrls');
        
        if (mode === 'all') {
            window.currentTableFilter = 'all';
            window.updateAdminDataHeader('👥 Összes Versenyző Listája', null, true);
            filterCtrls.classList.add('hidden');
            window.renderAdminTable('all');
        } else {
            window.currentTableFilter = '22km';
            window.updateAdminDataHeader('🔍 Nevezettek Távonként', null, true);
            filterCtrls.classList.remove('hidden');
            window.filterAdminTable('22km'); 
        }
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.showTableLanding = () => {
    // Elrejtjük a tartalom nézeteket
    document.getElementById('admin-table-content-view').classList.add('hidden');
    document.getElementById('admin-table-category-list-view').classList.add('hidden');
    document.getElementById('admin-data-section-bibs').classList.add('hidden');
    // Megjelenítjük a landinget
    document.getElementById('admin-table-landing-view').classList.remove('hidden');
    
    window.updateAdminDataHeader('👥 Versenyzői Adatbázis', window.showDataLanding);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Kategória részletek megjelenítése
window.showCategoryDetail = (distId, catId) => {
    document.getElementById('admin-category-selector-view').classList.add('hidden');
    document.getElementById('admin-category-detail-view').classList.remove('hidden');
    window.updateAdminDataHeader(window.raceManager.formatCategoryName(catId), null, true);
    renderAdminCategoryDetail(distId, catId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Visszalépés a kategória választóhoz
window.backToCategorySelector = () => {
    document.getElementById('admin-category-detail-view').classList.add('hidden');
    document.getElementById('admin-category-selector-view').classList.remove('hidden');
    window.updateAdminDataHeader('🏷️ Nevezettek Kategóriánként', null, true);
    renderAdminCategoryList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.filterAdminTable = (type) => {
    window.currentTableFilter = type;
    window.renderAdminTable(type);
    
    // Frissítjük a szűrőgombok vizuális kiemelését (zöld szín)
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

// --- Eredmények Al-navigáció ---
window.showResultsLanding = () => {
    document.getElementById('admin-results-landing-view').classList.remove('hidden');
    document.getElementById('admin-results-content-view').classList.add('hidden');
    document.getElementById('admin-results-category-list-view').classList.add('hidden');
    
    window.updateAdminDataHeader('🏆 Eredmények Listázása', window.showDataLanding);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.showResultsSubSection = (mode) => {
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
            window.currentResultsFilter = '22km'; // Alapértelmezett táv
            window.updateAdminDataHeader('📏 Távonkénti Összetett', null, true);
            filterCtrls.classList.remove('hidden');
            allCtrls.classList.add('hidden');
            window.filterResultsTable('22km');
        }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.filterResultsTable = (type) => {
    window.currentResultsFilter = type;
    window.renderResultsTable(type);
    
    // Gomb kiemelés (zöld)
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
window.startIndividual = (bib) => window.raceManager.startIndividual(bib);
window.startMass = () => window.raceManager.startMass();
window.startDistance = (dist) => window.raceManager.startDistance(dist);
window.stopCategory = (cat, dist, group) => window.raceManager.stopCategory(cat, dist, group);
window.resetCategory = (cat, dist, group) => window.raceManager.resetCategory(cat, dist, group);
window.stopRacer = () => {
    const input = document.getElementById('bib-input');
    if (input && input.value) {
        window.raceManager.stopRacer(input.value);
        input.value = '';
        input.focus();
    } else {
        showToast("Kérem adja meg a rajtszámot!", 'error');
    }
};

window.recordCheckpoint = () => {
    const input = document.getElementById('checkpoint-bib-input');
    const select = document.getElementById('checkpoint-name-select');
    if (input && input.value && select && select.value) {
        window.raceManager.recordCheckpoint(input.value, select.value);
    } else {
        showToast("Kérem adja meg a rajtszámot és az ellenőrzőpontot!", 'error');
    }
};

window.toggleWaitingListCards = (show) => {
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
        // Scroll to the first visible card
        const firstVisible = document.querySelector('.admin-card:not(.hidden)[id^="waiting-list-container"]');
        if (firstVisible) {
            firstVisible.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
};

window.toggleRunningListCards = (show) => {
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

window.toggleFinishedListCards = (show) => {
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

window.toggleNotTurnedListCards = (show) => {
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

// --- CSV Importálás ---
window.uploadCsv = async () => {
    const fileInput = document.getElementById('csv-upload');
    if (!fileInput || fileInput.files.length === 0) {
        showToast("Válasszon ki egy CSV fájlt!", "error");
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const buffer = e.target.result;
        let csvData = "";
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
                    ...window.raceManager.getAuthHeader()
                },
                body: JSON.stringify({ csvData })
            });
            const result = await response.json();
            if (response.ok) {
                let msg = `Sikeres importálás: ${result.importedCount} versenyző`;
                if (result.duplicatesCount > 0) {
                    msg += ` (${result.duplicatesCount} ütközés: Admin jóváhagyás szükséges)`;
                }
                showToast(msg, "success");
                
                if (result.logs && result.logs.length > 0) {
                    alert("Importálási napló:\n\n" + result.logs.join("\n"));
                }
                
                await window.raceManager.loadData();
                window.raceManager.renderUI();
                fileInput.value = '';
            } else {
                showToast(result.error, "error");
            }
        } catch (err) {
            showToast("Hiba a feltöltés során!", "error");
        }
    };
    reader.readAsArrayBuffer(file);
};

// --- Alkalmazás Indítása és Globális Események ---
document.addEventListener('DOMContentLoaded', () => {
    // Verzió megjelenítése
    const versionEl = document.createElement('div');
    versionEl.style = "position:fixed; bottom:5px; left:5px; font-size:10px; color:#444; z-index:9999;";
    versionEl.textContent = `System v${APP_VERSION}`;
    document.body.appendChild(versionEl);

    // Kategória választó frissítése
    window.updateCategorySelect = () => {
        const dist = document.getElementById('versenytav').value;
        const catSelect = document.getElementById('kategoria');
        catSelect.innerHTML = '<option value="" disabled selected>Válassz kategóriát...</option>';

        const categories = {
            '11km': [
                { id: 'kajak_1_nyitott_11km', name: 'Kajak-1 nyitott' },
                { id: 'kajak_2_nyitott_11km', name: 'Kajak-2 nyitott' },
                { id: 'kenu_1_nyitott_11km', name: 'Kenu-1 nyitott' },
                { id: 'kenu_2_nyitott_11km', name: 'Kenu-2 nyitott' },
                { id: 'kenu_3_nyitott_11km', name: 'Kenu-3 nyitott' },
                { id: 'kenu_4_nyitott_11km', name: 'Kenu-4 nyitott' },
                { id: 'sarkanyhajo_otproba', name: 'Sárkányhajó' }
            ],
            '22km': [
                { id: 'versenykajak_noi_1_22km', name: 'Versenykajak női-1 (38 cm)' },
                { id: 'versenykajak_ferfi_1_22km', name: 'Versenykajak férfi-1 (38 cm)' },
                { id: 'turakajak_noi_1_22km', name: 'Túrakajak női-1 (42–51 cm)' },
                { id: 'turakajak_ferfi_1_22km', name: 'Túrakajak férfi-1 (42–51 cm)' },
                { id: 'turakajak_2_nyitott_22km', name: 'Túrakajak 2 (nyitott)' },
                { id: 'tengeri_kajak_noi_1_22km', name: 'Tengeri kajak női-1 (51 cm>)' },
                { id: 'tengeri_kajak_ferfi_1_22km', name: 'Tengeri kajak férfi-1 (51 cm>)' },
                { id: 'surfski_noi_22km', name: 'Surfski női-1' },
                { id: 'surfski_ferfi_22km', name: 'Surfski férfi-1' },
                { id: 'mk_1_fiu_22km', name: 'MK-1 fiú' },
                { id: 'mk_1_leany_22km', name: 'MK-1 leány' },
                { id: 'outrigger_noi_1_22km', name: 'Outrigger női-1' },
                { id: 'outrigger_ferfi_1_22km', name: 'Outrigger férfi-1' },
                { id: 'outrigger_2_nyitott_22km', name: 'Outrigger-2 (nyitott)' },
                { id: 'kenu_2_ferfi_22km', name: 'Kenu-2 férfi' },
                { id: 'kenu_2_vegyes_22km', name: 'Kenu-2 vegyes' },
                { id: 'kenu_3_nyitott_22km', name: 'Kenu-3 (nyitott)' },
                { id: 'kenu_4_nyitott_22km', name: 'Kenu-4 (nyitott)' },
                { id: 'sup_noi_1_22km', name: 'SUP női-1' },
                { id: 'sup_ferfi_1_22km', name: 'SUP férfi-1' }
            ],
            '4km': [
                { id: 'sup_noi_1_merev_39_alatt_4km', name: 'SUP női-1- merev deszka 39 év alatt' },
                { id: 'sup_noi_1_merev_40_felett_4km', name: 'SUP női-1- merev deszka 40 év felett' },
                { id: 'sup_ferfi_1_merev_39_alatt_4km', name: 'SUP férfi-1- merev deszka 39 év alatt' },
                { id: 'sup_ferfi_1_merev_40_felett_4km', name: 'SUP férfi-1- merev deszka 40 év felett' },
                { id: 'sup_noi_1_felfujhato_39_alatt_4km', name: 'SUP női-1- felfújható deszka 39 év alatt' },
                { id: 'sup_noi_1_felfujhato_40_felett_4km', name: 'SUP női-1- felfújható deszka 40 év felett' },
                { id: 'sup_ferfi_1_felfujhato_39_alatt_4km', name: 'SUP férfi-1- felfújható deszka 39 év alatt' },
                { id: 'sup_ferfi_1_felfujhato_40_felett_4km', name: 'SUP férfi-1- felfújható deszka 40 év felett' }
            ]
        };

        if (categories[dist]) {
            categories[dist].forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                catSelect.appendChild(opt);
            });
        }
        document.getElementById('members-container').innerHTML = '<div style="text-align: center; padding: 20px; color: #888; border: 1px dashed #444; border-radius: 8px; margin: 15px 0;">Válassz kategóriát...</div>';
    };

    // Registration Form Submit
    document.getElementById('nevezesForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const kategoria = document.getElementById('kategoria').value;
        const tav = document.getElementById('versenytav').value;
        const email = document.getElementById('reg-email').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const contactName = document.getElementById('reg-name').value.trim();

        if (!email || !phone || !contactName) {
            showToast("Kérjük adja meg az összes kapcsolattartói adatot!", "error");
            return;
        }

        const members = [];
        try {
            document.querySelectorAll('.member-entry').forEach((entry, idx) => {
                const name = entry.querySelector('.member-name').value.trim();
                const birth_date = entry.querySelector('.member-birth').value;
                const otprobaInp = entry.querySelector('.member-otproba');
                const otproba_id = otprobaInp.disabled ? "Nincs" : otprobaInp.value;
                if (!name || !birth_date) throw new Error(`Kérjük adja meg a(z) ${idx + 1}. versenyző minden adatát!`);
                members.push({ name, birth_date, otproba_id });
            });
            const payModal = document.getElementById('payment-modal');
            const notice = document.getElementById('reg-form-payment-notice');
            const isAdmin = notice && notice.classList.contains('hidden');

            if(payModal && !isAdmin) {
                const actualMembersCount = members.filter(m => m.otproba_id !== 'CSAPATNEV').length;
                const finalAmount = actualMembersCount * 7000;
                
                const paymentAmountEl = document.getElementById('payment-amount');
                if (paymentAmountEl) {
                    paymentAmountEl.textContent = `${finalAmount.toLocaleString('hu-HU')} Ft`;
                }

                payModal.classList.add('active');
                
                const btnPaySuccess = document.getElementById('btn-pay-success');
                const newBtn = btnPaySuccess.cloneNode(true);
                btnPaySuccess.parentNode.replaceChild(newBtn, btnPaySuccess);
                
                newBtn.onclick = async () => {
                    newBtn.disabled = true;
                    newBtn.textContent = 'Szinkronizálás Barionnal...';
                    try {
                        // 1. Átmeneti regisztráció a szerveren
                        const formRes = await window.raceManager.registerRacer(members, kategoria, tav, false, email, phone, contactName, true); // true = silent flag (opcionálisan kiegészítjük, de a race manager bírja)
                        
                        if (!formRes) {
                            newBtn.disabled = false;
                            newBtn.textContent = 'Tovább a fizetésre ➔';
                            return;
                        }

                        // 2. Barion fizetés indítása API-n keresztül
                        const payload = {
                            email: email,
                            amount: finalAmount,
                            guestString: `${contactName} - ${tav}`,
                            orderId: `DRGW-${Date.now()}`
                        };
                        const barionRes = await fetch(`${API_URL}/barion/payment`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        const barionData = await barionRes.json();
                        
                        // 3. Átirányítás a cél URL-re
                        if (barionData.GatewayUrl) {
                            showToast('Átirányítás a Barion biztonságos oldalára...', 'info');
                            setTimeout(() => {
                                window.location.href = barionData.GatewayUrl;
                            }, 1500);
                        } else {
                            showToast('Hiba a Barion inicializálásakor!', 'error');
                            newBtn.disabled = false;
                            newBtn.textContent = 'Tovább a fizetésre ➔';
                        }
                    } catch (submitErr) {
                        showToast(submitErr.message || "Hiba a mentésnél", "error");
                        newBtn.disabled = false;
                        newBtn.textContent = 'Tovább a fizetésre ➔';
                    }
                };
            } else {
                await window.raceManager.registerRacer(members, kategoria, tav, false, email, phone, contactName, isAdmin);
                this.reset();
                window.updateCategorySelect();
            }
        } catch (err) {
            showToast(err.message, "error");
        }
    });

    // Ha a URL-ben payment=success van visszatéréskor
    if (window.location.search.includes('payment=success')) {
        setTimeout(() => {
            showToast('Sikeres Barion Fizetés! A nevezésed megerősítve.', 'success');
            // Tisztítjuk a címsort anélkül, hogy oldalfrissítés történne
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 500);
    }

    // Enter gomb a rajtszám rögzítéshez
    const bibInput = document.getElementById('bib-input');
    if (bibInput) bibInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') window.stopRacer(); });

    // Enter gomb az ellenőrzőponthoz
    const cpBibInput = document.getElementById('checkpoint-bib-input');
    if (cpBibInput) cpBibInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') window.recordCheckpoint(); });

    // Mobil menü kezelés
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('main-nav');
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            menuToggle.classList.toggle('active');
            mainNav.classList.toggle('active');
        });
        document.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            mainNav.classList.remove('active');
        });
    }

    // Routing kezelése
    const handleURLRouting = () => {
        const view = new URLSearchParams(window.location.search).get('view');
        if (view) setTimeout(() => window.switchTab(view), 200);
    };
    handleURLRouting();
});
