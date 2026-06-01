import { apiCall, API_URL, socketAdmin } from './api.js';
import { showToast, formatTime } from './ui-utils.js';

export function parseTimeToMs(timeStr) {
    if (!timeStr || !timeStr.trim()) return null;
    const parts = timeStr.trim().split(':');
    if (parts.length < 2 || parts.length > 3) return NaN;

    let hours = 0;
    let minutes;
    let secondsWithMs;

    if (parts.length === 3) {
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
        secondsWithMs = parts[2];
    } else {
        minutes = parseInt(parts[0], 10);
        secondsWithMs = parts[1];
    }

    if (isNaN(hours) || hours < 0 || isNaN(minutes) || minutes < 0 || minutes >= 60) return NaN;

    const secParts = secondsWithMs.split('.');
    const seconds = parseInt(secParts[0], 10);
    if (isNaN(seconds) || seconds < 0 || seconds >= 60) return NaN;

    let milliseconds = 0;
    if (secParts.length === 2) {
        const msStr = secParts[1];
        milliseconds = parseInt(msStr.padEnd(3, '0').slice(0, 3), 10);
        if (isNaN(milliseconds)) return NaN;
    } else if (secParts.length > 2) {
        return NaN;
    }

    return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
}

/**
 * --- KÖZPONTI LOGIKAI RÉTEG (MANAGER LAYER) ---
 * RaceManager - A verseny lebonyolításáért, az adatok kezeléséért
 * és a szinkronizációért felelős központi üzleti logika.
 */
export class RaceManager {
    constructor() {
        this.data = {
            racers: [],
            categories: {}, // { 'category_id': startTime (timestamp) }
            events: [],
        };
        this.serverTimeOffset = 0;
        this.adminPassword = sessionStorage.getItem('dragonAdminPassword') || '';

        this.categoryMap = {
            // 11 km (Rövid)
            kajak_1_nyitott: 'Kajak-1 nyitott',
            kajak_2_nyitott: 'Kajak-2 nyitott',
            kenu_1_nyitott: 'Kenu-1 nyitott',
            kenu_2_nyitott: 'Kenu-2 nyitott',
            kenu_3_nyitott: 'Kenu-3 (nyitott)',
            kenu_4_nyitott: 'Kenu-4 (nyitott)',
            sup_ferfi_1_merev: 'SUP férfi-1- merev deszka',
            sup_noi_1_merev: 'SUP női-1- merev deszka',
            sup_ferfi_1_felfujhato: 'SUP férfi-1- felfújható deszka',
            sup_noi_1_felfujhato: 'SUP női-1- felfújható deszka',

            // 22 km (Hosszú)
            versenykajak_noi_1: 'Versenykajak női-1 (38 cm)',
            versenykajak_ferfi_1: 'Versenykajak férfi-1 (38 cm)',
            turakajak_noi_1: 'Túrakajak női-1 (42–51 cm)',
            turakajak_ferfi_1: 'Túrakajak férfi-1 (42–51 cm)',
            turakajak_2_nyitott: 'Túrakajak 2 (nyitott)',
            tengeri_kajak_noi_1: 'Tengeri kajak női-1 (51 cm>)',
            tengeri_kajak_ferfi_1: 'Tengeri kajak férfi-1 (51 cm>)',
            surfski_noi: 'Surfski kajak női',
            surfski_ferfi: 'Surfski kajak férfi',
            outrigger_noi_1: 'Outrigger női-1',
            outrigger_ferfi_1: 'Outrigger férfi-1',
            outrigger_2_nyitott: 'Outrigger-2 (nyitott)',
            kenu_2_ferfi: 'Kenu-2 férfi',
            kenu_2_vegyes: 'Kenu-2 vegyes',
            sup_noi_1: 'SUP női-1',
            sup_ferfi_1: 'SUP férfi-1',

            // 4 km SUP
            sup_noi_1_merev_39_alatt: 'SUP női-1- merev deszka 39 év alatt',
            sup_noi_1_merev_40_felett: 'SUP női-1- merev deszka 40 év felett',
            sup_ferfi_1_merev_39_alatt: 'SUP férfi-1- merev deszka 39 év alatt',
            sup_ferfi_1_merev_40_felett: 'SUP férfi-1- merev deszka 40 év felett',
            sup_noi_1_felfujhato_39_alatt: 'SUP női-1- felfújható deszka 39 év alatt',
            sup_noi_1_felfujhato_40_felett: 'SUP női-1- felfújható deszka 40 év felett',
            sup_ferfi_1_felfujhato_39_alatt: 'SUP férfi-1- felfújható deszka 39 év alatt',
            sup_ferfi_1_felfujhato_40_felett: 'SUP férfi-1- felfújható deszka 40 év felett',
            sup_ferfi_1_felfujhato_16_alatt: 'SUP férfi-1- felfújható deszka 16 év alatt',
            sup_noi_1_felfujhato_16_alatt: 'SUP női-1- felfújható deszka 16 év alatt',

            // Legacy / Admin support
            sarkanyhajo_otproba: 'Sárkányhajó ötpróba',
        };

        this.distanceCategories = {
            '4km': [
                'sup_noi_1_merev_39_alatt',
                'sup_noi_1_merev_40_felett',
                'sup_ferfi_1_merev_39_alatt',
                'sup_ferfi_1_merev_40_felett',
                'sup_noi_1_felfujhato_39_alatt',
                'sup_noi_1_felfujhato_40_felett',
                'sup_ferfi_1_felfujhato_39_alatt',
                'sup_ferfi_1_felfujhato_40_felett',
                'sup_ferfi_1_felfujhato_16_alatt',
                'sup_noi_1_felfujhato_16_alatt',
            ],
            '11km': [
                'kajak_1_nyitott',
                'kajak_2_nyitott',
                'kenu_1_nyitott',
                'kenu_2_nyitott',
                'kenu_3_nyitott',
                'kenu_4_nyitott',
                'sup_ferfi_1_merev',
                'sup_noi_1_merev',
                'sup_ferfi_1_felfujhato',
                'sup_noi_1_felfujhato',
                'sarkanyhajo_otproba',
            ],
            '22km': [
                'versenykajak_noi_1',
                'versenykajak_ferfi_1',
                'turakajak_noi_1',
                'turakajak_ferfi_1',
                'turakajak_2_nyitott',
                'tengeri_kajak_noi_1',
                'tengeri_kajak_ferfi_1',
                'surfski_noi',
                'surfski_ferfi',
                'outrigger_noi_1',
                'outrigger_ferfi_1',
                'outrigger_2_nyitott',
                'kenu_2_ferfi',
                'kenu_2_vegyes',
                'kenu_3_nyitott',
                'kenu_4_nyitott',
                'sup_noi_1',
                'sup_ferfi_1',
            ],
        };

        this.groupMap = {
            kajak_hosszu: 'Összes Hosszú Kajak',
            kajak_rovid: 'Összes Rövid Kajak',
            kenu_hosszu: 'Összes Hosszú Kenu + Hosszú SUP',
            kenu_rovid: 'Összes Rövid Kenu + Rövid SUP',
            sup_4km: 'Összes SUP 4 km',
            sarkanyhajo_11km: '🐉 SÁRKÁNYHAJÓ',
        };
        this.init();
    }

    // --- 1. INICIALIZÁLÁS ÉS ADATBETÖLTÉS (INITIALIZATION) ---
    async init() {
        await this.checkConnectivity();
        await this.loadData();
        this.renderUI();
        this.startTickLoop();
        this.setupRealtimeSync();
    }

    setupRealtimeSync() {
        if (socketAdmin) {
            socketAdmin.on('dataUpdated', msg => {
                console.log('Real-time frissítés érkezett:', msg);
                this.refreshUI();
            });
            socketAdmin.on('notify_event', data => {
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification(data.title, { body: data.body, icon: 'admin_landingpage_4_0_png.png' });
                }
            });
        }

        if (this.adminPassword && typeof Notification !== 'undefined') {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }

    async checkConnectivity() {
        try {
            const response = await fetch(`${API_URL}/health`);
            const result = await response.json();
            if (response.ok && result.database === 'connected') {
                console.log('Adatbázis kapcsolat ellenőrizve.');
            } else {
                throw new Error(result.error || 'Adatbázis nem elérhető');
            }
        } catch (err) {
            console.error('Connectivity check failed:', err);
            showToast('Hiba: Nincs adatbázis kapcsolat! Ellenőrizd a szervert.', 'error');
        }
    }

    getAuthHeader() {
        return { Authorization: `Bearer ${this.adminPassword}` };
    }

    async refreshUI() {
        await this.loadData();
        this.renderUI();
    }

    async loadData() {
        try {
            console.log(`Adatok lekérése: ${API_URL}/data`);
            const response = await fetch(`${API_URL}/data`);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Szerver hiba:', errorData);
                throw new Error(errorData.error || `HTTP hiba! státusz: ${response.status}`);
            }

            const result = await response.json();
            this.data = result;

            if (result.serverNow) {
                this.serverTimeOffset = result.serverNow - Date.now();
                console.log(`Idő szinkronizáció: eltolás ${this.serverTimeOffset}ms`);
            }

            console.log('Adatok sikeresen betöltve:', this.data);
        } catch (err) {
            console.error('KRITIKUS: Nem sikerült betölteni az adatokat:', err);
            showToast('Szerver hiba az adatok betöltésekor!', 'error');
        }
    }

    // --- 2. VERSENY VEZÉRLÉSI LOGIKA (RACE CONTROL LOGIC) ---
    async registerRacer(members, category, distance, is_series, email, phone, contactName, isSilent = false) {
        try {
            const formattedMembers = members.map(m => ({
                name: m.name,
                birth_date: m.birth_date,
                otproba_id: m.otproba_id,
            }));

            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    members: formattedMembers,
                    category,
                    distance,
                    is_series,
                    email,
                    phone,
                    contact_name: contactName,
                }),
            });

            if (response.status === 401 || response.status === 403) {
                const errorData = await response.json();
                showToast(`Hitelesítési hiba: ${errorData.error}`, 'error');
                if (response.status === 403) sessionStorage.removeItem('dragonAdminPassword');
                return;
            }

            if (response.ok) {
                const result = await response.json();
                await this.loadData();
                this.renderUI();

                if (!isSilent) {
                    if (result.isDuplicate) {
                        showToast(
                            `FIGYELEM: Te már neveztél! A nevezésedet rögzítettük 'Függő Duplikáció' állapotban. Az Adminisztrátor fogja jóváhagyni.`,
                            'info'
                        );
                    } else {
                        showToast(`Sikeres nevezés! Rajtszám: ${result.bib.toString().padStart(3, '0')}`, 'success');
                    }

                    setTimeout(() => {
                        window.location.href = 'https://sarkanyhajozz.hu/termek/dunakeszi-futam-elonevezes/';
                    }, 3000);
                } else {
                    if (result.isDuplicate) {
                        showToast(`FIGYELEM: Duplikált nevezés rögzítve!`, 'warning');
                    } else {
                        showToast(`Sikeres nevezés rögzítve!`, 'success');
                    }
                }

                return result;
            } else {
                const errorData = await response.json();
                showToast(errorData.error || 'Hiba a regisztráció során!', 'error');
            }
        } catch (err) {
            showToast('Hiba a regisztráció során!', 'error');
        }
    }

    async startCategory(categoryName, distance, groupId) {
        const startKey = groupId || `${categoryName}_${distance}`;
        if (this.data.categories[startKey]) {
            showToast(`Ez a futam (${this.formatCategoryName(startKey)}) már elindult!`, 'error');
            return;
        }
        try {
            const response = await apiCall(
                'start-category',
                'POST',
                { categoryName, distance, groupId },
                this.adminPassword
            );
            if (!response) return;
            const result = await response.json();
            if (response.ok) {
                await this.refreshUI();
                showToast(
                    `START: ${this.formatCategoryName(startKey)} (${result.startedCount || result.count} versenyző)`,
                    'success'
                );
            } else {
                showToast(result.error, 'error');
            }
        } catch (err) {
            showToast('Hiba a rajt indításakor!', 'error');
        }
    }

    async stopCategory(categoryName, distance, groupId) {
        const startKey = groupId || `${categoryName}_${distance}`;
        if (!this.data.categories[startKey]) {
            showToast(`Ez a futam még el sem indult!`, 'error');
            return;
        }
        if (
            confirm(
                `FIGYELEM! Leállítod a(z) ${this.formatCategoryName(startKey)} futamot?\nA még úton lévők automatikusan befejezik mostani idővel!`
            )
        ) {
            try {
                const response = await apiCall(
                    'stop-category',
                    'POST',
                    { categoryName, distance, groupId },
                    this.adminPassword
                );
                if (!response) return;
                const result = await response.json();
                await this.refreshUI();
                this.updateLiveTimers();
                showToast(
                    `STOP: ${this.formatCategoryName(startKey)} leállítva. (${result.count} versenyző beérkezett)`,
                    'success'
                );
            } catch (err) {
                showToast('Hiba a megállítás során!', 'error');
            }
        }
    }

    async resetCategory(categoryName, distance, groupId) {
        const startKey = groupId || `${categoryName}_${distance}`;
        if (
            confirm(
                `Biztosan törlöd a(z) ${this.formatCategoryName(startKey)} időmérőjét?\n(A futó óra leáll, de a versenyzők státusza nem változik!)`
            )
        ) {
            try {
                const response = await apiCall(
                    'reset-category',
                    'POST',
                    { categoryName, distance, groupId },
                    this.adminPassword
                );
                if (!response) return;
                if (response.ok) {
                    await this.refreshUI();
                    showToast('Időmérő törölve.', 'info');
                }
            } catch (err) {
                console.error('ResetCategory error:', err);
            }
        }
    }

    async stopRacer(bibInput) {
        const inputStr = String(bibInput).trim();
        if (!inputStr) {
            showToast('Kérlek adj meg legalább egy érvényes rajtszámot!', 'error');
            return;
        }

        const bibs = inputStr
            .split(/\s+/)
            .map(b => parseInt(b, 10))
            .filter(b => !isNaN(b));
        if (bibs.length === 0) {
            showToast('Kérlek adj meg érvényes rajtszámokat!', 'error');
            return;
        }

        if (bibs.length > 1) {
            try {
                const response = await apiCall('stop-bulk-racers', 'POST', { bibs }, this.adminPassword);
                if (!response) return;
                const data = await response.json();

                if (response.ok && data.success) {
                    await this.refreshUI();
                    const { successful, failed } = data.results;
                    let msg = '';
                    if (successful.length > 0) {
                        msg += `✅ Rögzítve:\n${successful.join(', ')}\n`;
                        const bibInputEl = document.getElementById('bib-input');
                        if (bibInputEl) {
                            bibInputEl.value = '';
                            bibInputEl.focus();
                        }
                    }
                    if (failed.length > 0) msg += `\n❌ Sikertelen:\n${failed.join('\n')}`;
                    showToast(msg, failed.length > 0 ? (successful.length > 0 ? 'warning' : 'error') : 'success');
                } else {
                    showToast(data.error || 'Hiba a tömeges rögzítéskor!', 'error');
                }
            } catch (err) {
                showToast('Hálózati hiba a tömeges rögzítéskor!', 'error');
            }
        } else {
            const bib = bibs[0];
            try {
                const response = await apiCall('stop-racer', 'POST', { bib }, this.adminPassword);
                if (!response) return;
                const result = await response.json();
                if (response.ok) {
                    await this.refreshUI();
                    const names = result.racer.name;
                    showToast(`CÉL: #${bib} ${names} - ${formatTime(result.racer.total_time)}`, 'success');
                    const bibInputEl = document.getElementById('bib-input');
                    if (bibInputEl) {
                        bibInputEl.value = '';
                        bibInputEl.focus();
                    }
                } else {
                    showToast(result.error, 'error');
                }
            } catch (err) {
                showToast('Hiba a célba érkezés rögzítésekor!', 'error');
            }
        }
    }

    async recordCheckpoint(bibInput, checkpointName) {
        const inputStr = String(bibInput).trim();
        if (!inputStr) {
            showToast('Kérlek adj meg egy érvényes rajtszámot!', 'error');
            return;
        }

        const bibs = inputStr
            .split(/\s+/)
            .map(b => parseInt(b, 10))
            .filter(b => !isNaN(b));
        if (bibs.length === 0) {
            showToast('Kérlek adj meg egy érvényes rajtszámot!', 'error');
            return;
        }

        try {
            let successful = [];
            let failed = [];

            for (const bib of bibs) {
                const response = await apiCall(
                    'checkpoint',
                    'POST',
                    { bib, checkpoint_name: checkpointName },
                    this.adminPassword
                );
                if (response && response.ok) {
                    successful.push(bib);
                } else {
                    const data = response ? await response.json() : { error: 'Hiba' };
                    failed.push(`${bib} (${data.error || 'Hiba'})`);
                }
            }

            await this.refreshUI();

            let msg = '';
            if (successful.length > 0) {
                msg += `📍 Kör rögzítve:\n${successful.join(', ')}\n`;
                const cpBibEl = document.getElementById('checkpoint-bib-input');
                if (cpBibEl) {
                    cpBibEl.value = '';
                    cpBibEl.focus();
                }
            }
            if (failed.length > 0) {
                msg += `\n❌ Sikertelen:\n${failed.join('\n')}`;
            }

            showToast(msg, failed.length > 0 ? (successful.length > 0 ? 'warning' : 'error') : 'success');
        } catch (err) {
            showToast('Hálózati hiba az ellenőrzőpont rögzítésekor!', 'error');
        }
    }

    async startIndividual(bib) {
        if (!bib) {
            showToast('Kérlek adj meg egy rajtszámot!', 'error');
            return;
        }
        try {
            const response = await apiCall('start-individual', 'POST', { bib }, this.adminPassword);
            if (!response) return;
            const result = await response.json();
            if (response.ok) {
                await this.refreshUI();
                showToast(`RAJT: #${bib} elindult!`, 'success');
            } else {
                showToast(result.error, 'error');
            }
        } catch (err) {
            showToast('Hiba az egyéni indításkor!', 'error');
        }
    }

    async startMass() {
        if (
            !confirm(
                "BIZTOSAN ELINDÍTOD A TÖMEGRAJTOT?\nMinden 'Regisztrált' állapotú versenyző elindul az aktuális idővel!"
            )
        )
            return;
        try {
            const response = await apiCall('start-mass', 'POST', {}, this.adminPassword);
            if (!response) return;
            const result = await response.json();
            if (response.ok) {
                await this.refreshUI();
                showToast(`TÖMEGRAJT: ${result.count} versenyző elindult!`, 'success');
            } else {
                showToast(result.error, 'error');
            }
        } catch (err) {
            showToast('Hiba a tömegrajt indításakor!', 'error');
        }
    }

    async startDistance(distance) {
        if (!confirm(`Elindítod a(z) ${distance} táv rajtját?`)) return;
        try {
            const response = await apiCall('start-distance', 'POST', { distance }, this.adminPassword);
            if (!response) return;
            const result = await response.json();
            if (response.ok) {
                await this.refreshUI();
                showToast(`TÁV RAJT (${distance}): ${result.count} versenyző elindult!`, 'success');
            } else {
                showToast(result.error, 'error');
            }
        } catch (err) {
            showToast('Hiba a táv szerinti indításkor!', 'error');
        }
    }

    async deleteRacer(id, bib) {
        if (!confirm(`Biztosan törlöd ezt a versenyzőt?${bib ? ' (Rajtszám: #' + bib + ')' : ''}`)) return;

        try {
            const response = await fetch(`${API_URL}/racer/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${this.adminPassword}` },
            });

            if (response.ok) {
                await this.loadData();
                this.renderUI();
                showToast(`Versenyző törölve: ${bib ? '#' + bib : 'ID: ' + id}`, 'info');
            } else {
                const errData = await response.json();
                showToast(`Hiba a törlés során: ${errData.error || response.statusText}`, 'error');
            }
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Hiba a hálózati kapcsolatban!', 'error');
        }
    }

    updateEditCategoryOptions(distance, selectValue = null) {
        const catSelect = document.getElementById('edit-category');
        const catCustom = document.getElementById('edit-category-custom');
        if (!catSelect) return;

        catSelect.innerHTML = '<option value="" disabled selected>Válassz kategóriát...</option>';

        const keys = this.distanceCategories[distance] || [];
        keys.forEach(slug => {
            const name = this.categoryMap[slug];
            if (name) {
                catSelect.appendChild(new Option(name, slug));
            }
        });

        if (selectValue) {
            const exists = Array.from(catSelect.options).some(opt => opt.value === selectValue);
            if (!exists) {
                const name = this.categoryMap[selectValue] || `${selectValue} (Egyedi)`;
                catSelect.appendChild(new Option(name, selectValue));
            }
            catSelect.value = selectValue;
        } else {
            catSelect.value = '';
        }

        catSelect.appendChild(new Option('➕ Egyéb (kézi megadás)...', '__custom__'));

        if (
            selectValue === '__custom__' ||
            (selectValue && !keys.includes(selectValue) && !this.categoryMap[selectValue])
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

    openEditModal(id, memberId = null) {
        if (!this.data || !this.data.racers) return;
        const racer = this.data.racers.find(r => r.id === id);
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

        this.updateEditCategoryOptions(distanceVal, racer.category);
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
                this.data.racers.forEach(r => {
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
                // Csak az adott tagot szerkesztjük
                membersToShow = (racer.members || []).filter(m => m.id === memberId);
            } else if (isTeam) {
                // Csapatot szerkesztünk: csak a csapatnév jelenjen meg (vagy adjunk hozzá egy üreset, ha nincs)
                const teamMember = (racer.members || []).find(m => m.otproba_id === 'CSAPATNEV');
                if (teamMember) {
                    membersToShow = [teamMember];
                } else {
                    membersToShow = [{ name: '', birth_date: '1900-01-01', otproba_id: 'CSAPATNEV' }];
                }
            } else {
                // Sima versenyző összes tagja
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

    closeEditModal() {
        const modal = document.getElementById('editRacerModal');
        if (modal) modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    async saveRacer() {
        const id = document.getElementById('edit-id').value;
        const racer = window.currentEditingRacer;
        const memberId = window.currentEditingMemberId;

        let membersToSend;

        if (memberId) {
            // Egy adott tagot szerkesztünk
            const row = document.querySelector('.member-edit-row');
            if (!row) return;
            const updatedName = row.querySelector('.edit-m-name').value;
            const updatedBirth = row.querySelector('.edit-m-birth').value;
            const updatedOtp = row.querySelector('.edit-m-otproba').value;

            membersToSend = (racer.members || []).map(m => {
                if (m.id === memberId) {
                    return { ...m, name: updatedName, birth_date: updatedBirth, otproba_id: updatedOtp };
                }
                return m;
            });
        } else {
            const isTeam =
                racer.id.startsWith('DRAGON_') ||
                (racer.members && racer.members.some(m => m.otproba_id === 'CSAPATNEV'));

            if (isTeam) {
                // Csapatot szerkesztünk (csak a csapatnév van a formon)
                const row = document.querySelector('.member-edit-row');
                const updatedName = row ? row.querySelector('.edit-m-name').value : '';

                let teamMemberFound = false;
                membersToSend = (racer.members || []).map(m => {
                    if (m.otproba_id === 'CSAPATNEV') {
                        teamMemberFound = true;
                        return { ...m, name: updatedName };
                    }
                    return m;
                });

                if (!teamMemberFound && updatedName) {
                    membersToSend.push({ name: updatedName, birth_date: '1900-01-01', otproba_id: 'CSAPATNEV' });
                }
            } else {
                // Sima versenyzőt szerkesztünk, a formon minden tag ott van
                const membersRows = document.querySelectorAll('.member-edit-row');
                membersToSend = Array.from(membersRows).map((row, index) => {
                    const originalMember = racer.members && racer.members[index] ? racer.members[index] : {};
                    return {
                        id: originalMember.id, // Supabase allows it, if not it will ignore or fail
                        name: row.querySelector('.edit-m-name').value,
                        birth_date: row.querySelector('.edit-m-birth').value,
                        otproba_id: row.querySelector('.edit-m-otproba').value,
                    };
                });
            }
        }

        let finalCategory = racer.category; // Megtartjuk, ha csak tagot szerkesztünk
        let targetCategoryChanged = false;

        if (!memberId) {
            finalCategory = document.getElementById('edit-category').value;
            if (finalCategory === '__custom__') {
                finalCategory = document.getElementById('edit-category-custom').value.trim();
                if (!finalCategory) {
                    showToast('Kérem adjon meg egy egyedi kategóriát!', 'error');
                    return;
                }
            }
        } else {
            const catVal = document.getElementById('edit-category').value;
            let checkCat = catVal;
            if (catVal === '__custom__') {
                checkCat = document.getElementById('edit-category-custom').value.trim();
            }
            if (checkCat && checkCat !== finalCategory) {
                targetCategoryChanged = true;
                finalCategory = checkCat;
            }
        }

        let totalTimeMs = null;
        if (!memberId) {
            const totalTimeStr = document.getElementById('edit-total_time').value.trim();
            if (totalTimeStr) {
                totalTimeMs = parseTimeToMs(totalTimeStr);
                if (isNaN(totalTimeMs)) {
                    showToast(
                        'Érvénytelen időformátum! Használja az ÓÓ:pp:mp.mmm (pl. 01:23:45.678) vagy pp:mp formátumot!',
                        'error'
                    );
                    return;
                }
                // Ha van időeredmény, a státuszt automatikusan FINISHED-re állítjuk!
                document.getElementById('edit-status').value = 'finished';
            }
        }

        const data = {
            members: membersToSend,
        };

        if (!memberId) {
            data.bib = document.getElementById('edit-bib').value
                ? parseInt(document.getElementById('edit-bib').value)
                : null;
            data.status = document.getElementById('edit-status').value;
            data.category = finalCategory;
            data.distance = document.getElementById('edit-distance').value;
            data.email = document.getElementById('edit-email').value;
            data.phone = document.getElementById('edit-phone').value;
            data.is_series = document.getElementById('edit-is_series').checked;
            data.is_paid = document.getElementById('edit-is_paid').value === '1';
            data.total_time = totalTimeMs;
        }
        try {
            const response = await apiCall(`racer/${id}`, 'PUT', data, this.adminPassword);
            if (!response) return;

            const result = await response.json();

            if (response.ok) {
                // Ha tagot szerkesztettünk, de megváltoztattuk a kategóriáját, akkor ki kell venni a csapatból
                if (memberId && targetCategoryChanged) {
                    const distSelect = document.getElementById('edit-distance');
                    const targetDist = distSelect ? distSelect.value : '11km';

                    try {
                        await fetch(`${API_URL}/remove-from-dragon-team`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${this.adminPassword}`,
                            },
                            body: JSON.stringify({
                                memberIds: [memberId],
                                targetCategory: finalCategory,
                                targetDistance: targetDist,
                            }),
                        });
                        showToast('A versenyző kikerült a csapatból az új kategóriába!', 'success');
                    } catch (e) {
                        console.error('Csapatból kivételi hiba kategóriaváltás miatt:', e);
                        showToast('Sikerült a mentés, de hiba a csapatból való leválasztáskor!', 'warning');
                    }
                }

                const editDragonTeamSelect = document.getElementById('edit-dragon-team');
                if (editDragonTeamSelect && editDragonTeamSelect.value && memberId) {
                    try {
                        const targetTeam = JSON.parse(editDragonTeamSelect.value);
                        await fetch(`${API_URL}/create-dragon-team`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${this.adminPassword}`,
                            },
                            body: JSON.stringify({
                                memberIds: [memberId],
                                bib: targetTeam.bib,
                                name: targetTeam.name,
                            }),
                        });
                        showToast('A versenyző sikeresen átkerült a kiválasztott csapatba!', 'success');
                    } catch (e) {
                        console.error('Csapat áthelyezési hiba:', e);
                        showToast('Hiba a csapatba helyezés során!', 'error');
                    }
                } else if (!targetCategoryChanged) {
                    if (result.warning) {
                        showToast(result.warning, 'warning');
                    } else {
                        showToast('Sikeres mentés!', 'success');
                    }
                }

                this.closeEditModal();
                await this.refreshUI();
            } else {
                showToast(result.error || 'Hiba a mentés során!', 'error');
            }
        } catch (err) {
            showToast('Hiba a szerver kapcsolatban!', 'error');
        }
    }

    async resetAll() {
        if (confirm('Biztosan törölsz MINDEN ADATOT?')) {
            try {
                const response = await apiCall('reset', 'POST', {}, this.adminPassword);
                if (!response) return;
                if (response.ok) {
                    await this.refreshUI();
                    showToast('Minden adat törölve!', 'error');
                }
            } catch (err) {
                showToast('Hiba a törlés során!', 'error');
            }
        }
    }

    async resetTimes() {
        if (confirm('BIZTOSAN NULLÁZOD AZ ÖSSZES IDŐT ÉS EREDMÉNYT?')) {
            try {
                const response = await apiCall('reset-times', 'POST', {}, this.adminPassword);
                if (!response) return;
                if (response.ok) {
                    await this.refreshUI();
                    showToast('Minden időeredmény nullázva!', 'success');
                }
            } catch (err) {
                showToast('Hálózati hiba a nullázás során!', 'error');
            }
        }
    }

    // --- 3. SEGÉDFUNKCIÓK ÉS IDŐMÉRÉS (HELPERS & TIMING) ---
    formatCategoryName(id) {
        if (!id) return 'Ismeretlen Kategória';
        if (id === 'MASS_START_ALL') return '🚀 Tömegrajt - Mindenki';
        if (id.startsWith('DISTANCE_')) {
            const dist = id.replace('DISTANCE_', '');
            const distName = dist === '11km' ? 'Rövid táv' : dist === '22km' ? 'Hosszú táv' : 'SUP 4 km';
            return `📏 ${distName} (Összesített)`;
        }
        if (this.groupMap[id]) return this.groupMap[id];

        if (this.categoryMap[id]) return this.categoryMap[id];

        if (id.includes('_')) {
            const parts = id.split('_');
            const dist = parts[parts.length - 1];
            if (dist === '11km' || dist === '22km' || dist === '4km') {
                const catId = id.substring(0, id.lastIndexOf('_'));
                const catName = this.categoryMap[catId] || catId;
                if (/s[aá]rk[aá]ny/i.test(catId)) return `🐉 SÁRKÁNYHAJÓ`;
                return catName;
            }
        }
        if (/s[aá]rk[aá]ny/i.test(id)) return `🐉 SÁRKÁNYHAJÓ`;
        return id;
    }

    startTickLoop() {
        if (this.tickInterval) clearInterval(this.tickInterval);
        this.tickInterval = setInterval(() => {
            this.updateTick();
        }, 50); // Minta időzítő, nem áll meg mikor a tab inaktív
    }

    updateTick() {
        const timestamp = Date.now() + (this.serverTimeOffset || 0);
        const now = new Date(timestamp);
        const localTimeEl = document.getElementById('local-time-display');
        const localDateEl = document.getElementById('local-date-display');

        if (!this._lastClockUpdate || Date.now() - this._lastClockUpdate > 500) {
            if (localTimeEl) localTimeEl.textContent = now.toLocaleTimeString('hu-HU');
            if (localDateEl) {
                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                localDateEl.textContent = now.toLocaleDateString('hu-HU', options);
            }
            this._lastClockUpdate = Date.now();
        }
        this.updateLiveTimers();
    }

    getTeamSize(catId) {
        if (!catId) return 1;
        if (catId.includes('_2_')) return 2;
        if (catId.includes('_3_')) return 3;
        if (catId.includes('_4_')) return 4;
        if (catId.includes('turakajak_2_nyitott')) return 2;
        if (catId.includes('outrigger_2_nyitott')) return 2;
        if (catId.includes('kenu_2_ferfi') || catId.includes('kenu_2_vegyes')) return 2;
        if (catId.includes('kenu_3_nyitott')) return 3;
        if (catId.includes('kenu_4_nyitott')) return 4;
        return 1;
    }

    updateMemberFields() {
        const catId = document.getElementById('kategoria').value;
        const size = this.getTeamSize(catId);
        const container = document.getElementById('members-container');
        container.innerHTML = '';

        if (size > 1) {
            const isSarkany =
                catId && (catId.toLowerCase().includes('sarkany') || catId.toLowerCase().includes('dragon'));

            // Csapatnév mező (Egység neve)
            const teamDiv = document.createElement('div');
            teamDiv.className = 'member-entry team-name-entry';
            teamDiv.style =
                'margin-bottom: 25px; padding: 15px; border: 1px solid var(--accent-primary); border-radius: 12px; background: rgba(0, 145, 255, 0.05);';
            teamDiv.innerHTML = `
                <div>
                    <label style="color: var(--accent-primary); font-weight: bold; font-size: 1.1rem;">Egység / Csapat neve (${isSarkany ? 'kötelező' : 'opcionális'})</label>
                    <input type="text" class="member-name" placeholder="Pl. Sárkányok" ${isSarkany ? 'required' : ''} maxlength="100">
                    <input type="hidden" class="member-birth" value="1900-01-01">
                    <input type="hidden" class="member-otproba" value="CSAPATNEV">
                </div>
            `;
            container.appendChild(teamDiv);

            // Tagok felirata
            const tagokCimke = document.createElement('h4');
            tagokCimke.textContent = 'Az egység tagjai:';
            tagokCimke.style = 'margin-bottom: 15px; color: #fff;';
            container.appendChild(tagokCimke);
        }

        for (let i = 1; i <= size; i++) {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'member-entry';
            memberDiv.style =
                'margin-bottom: 25px; padding: 15px; border: 1px solid var(--glass-border); border-radius: 12px; background: rgba(255, 255, 255, 0.05);';
            memberDiv.innerHTML = `
                <div style="margin-bottom: 10px; font-weight: bold; color: var(--accent-secondary);">${size > 1 ? i + '. Tag' : 'Versenyző'}</div>
                <div>
                    <label>Név</label>
                    <input type="text" class="member-name" placeholder="Pl. Kiss János" required maxlength="100">
                </div>
                <div>
                    <label>Születési Dátum</label>
                    <input type="text" onfocus="(this.type='date')" onblur="if(!this.value)this.type='text'" class="member-birth" placeholder="ÉÉÉÉ.HH.NN." required>
                </div>
                <div style="margin-top: 15px;">
                    <label>Ötpróba azonosító (opcionális)</label>
                    <div style="display: flex; gap: 0; align-items: center; flex-wrap: wrap;">
                        <div style="display: flex; flex: 2; min-width: 150px; margin-bottom: 5px;">
                            <span style="background: rgba(0, 145, 255, 0.1); color: var(--accent-primary); padding: 8px 12px; border: 1px solid var(--accent-primary); border-right: none; border-radius: 4px 0 0 4px; font-family: 'Space Mono', monospace; font-weight: bold;">5P</span>
                            <input type="text" class="member-otproba" placeholder="123456" pattern="[0-9]{6}" title="6 darab számjegy" maxlength="6" style="flex: 1; border-radius: 0 4px 4px 0; margin-bottom: 0;">
                        </div>
                        <label style="flex: 1; min-width: 80px; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 0.75rem; cursor: pointer; border: 1px solid var(--glass-border); padding: 5px; border-radius: 4px; margin-left: 10px; margin-bottom: 5px; height: 42px;">
                            <input type="checkbox" onchange="const inp=this.parentElement.parentElement.querySelector('.member-otproba'); inp.disabled=this.checked; if(this.checked) inp.value='';" style="margin: 0; transform: scale(1.2);"> Nincs
                        </label>
                    </div>
                </div>
            `;
            container.appendChild(memberDiv);
        }
    }

    updateLiveTimers() {
        const publicContainer = document.getElementById('category-timers');
        const containers = [];
        if (publicContainer) containers.push(publicContainer);
        document.querySelectorAll('.admin-timer-grid').forEach(el => containers.push(el));
        if (containers.length === 0) return;

        const activeCategories = Object.keys(this.data.categories || {})
            .map(k => ({ id: k, start: this.data.categories[k] }))
            .sort((a, b) => a.start - b.start);

        const runningRacers = (this.data.racers || []).filter(r => r.status === 'running');

        containers.forEach(container => {
            const hasActive = activeCategories.length > 0 || runningRacers.length > 0;
            if (hasActive) {
                const safeId = id => id.replace(/[^a-z0-9]/gi, '_');

                // Ellenőrizzük, hogy minden aktív kategóriához és futó versenyzőhöz megvan-e a timer elem
                const missingTimers = activeCategories.some(
                    cat => !container.querySelector(`[data-cat-id="${cat.id}"]`)
                );
                const missingRacerTimers = runningRacers.some(
                    r => !container.querySelector(`[data-racer-id="${r.id}"]`)
                );
                const expectedTotal = activeCategories.length + runningRacers.length;
                const needsRebuild =
                    container.children.length !== expectedTotal ||
                    container.querySelector('.empty-text') !== null ||
                    (activeCategories.length > 0 && container.querySelector('[data-cat-id]') === null) ||
                    (runningRacers.length > 0 && container.querySelector('[data-racer-id]') === null) ||
                    missingTimers ||
                    missingRacerTimers;

                if (needsRebuild) {
                    container.innerHTML = '';

                    // 1. Kategória órák
                    activeCategories.forEach(cat => {
                        const div = document.createElement('div');
                        div.className = 'cat-timer';
                        div.setAttribute('data-cat-id', cat.id);
                        const isAdmin = container.classList.contains('admin-timer-grid');
                        const displayId = `${container.id || 'timer'}-val-${safeId(cat.id)}`;
                        div.innerHTML = `
                            <div class="cat-name">${this.formatCategoryName(cat.id)}</div>
                            <div class="cat-time" id="${displayId}">00:00:00.000</div>
                            ${isAdmin ? `<button onclick="window.stopCategory(null, null, '${cat.id}')" style="margin-top:10px; padding:5px 10px; font-size:0.7rem; background:rgba(255,68,68,0.2); color:#ff4444; border:1px solid #ff4444; border-radius:4px; cursor:pointer; width:100%;">AZONNALI LEÁLLÍTÁS (CÉL)</button>` : ''}
                        `;
                        container.appendChild(div);
                    });

                    // 2. Egyéni futók órái
                    runningRacers.forEach(r => {
                        const div = document.createElement('div');
                        div.className = 'cat-timer';
                        div.setAttribute('data-racer-id', r.id);
                        const isAdmin = container.classList.contains('admin-timer-grid');
                        const displayId = `${container.id || 'timer'}-racer-val-${r.id}`;
                        const racerName =
                            r.members && r.members.length > 0
                                ? r.members.map(m => m.name).join(', ')
                                : r.name || 'Névtelen';
                        div.innerHTML = `
                            <div class="cat-name" style="color: var(--accent-secondary); font-weight: bold;">👤 #${r.bib} - ${racerName}</div>
                            <div class="cat-time" id="${displayId}">00:00:00.000</div>
                            ${isAdmin ? `<button onclick="window.raceManager.stopRacer('${r.bib}')" style="margin-top:10px; padding:5px 10px; font-size:0.7rem; background:rgba(0,145,255,0.2); color:var(--accent-primary); border:1px solid var(--accent-primary); border-radius:4px; cursor:pointer; width:100%;">BEÉRKEZTETÉS (CÉL)</button>` : ''}
                        `;
                        container.appendChild(div);
                    });
                }

                // Frissítés
                activeCategories.forEach(cat => {
                    const displayId = `${container.id || 'timer'}-val-${safeId(cat.id)}`;
                    const timeEl = document.getElementById(displayId);
                    if (timeEl) {
                        const now = Date.now() + (this.serverTimeOffset || 0);
                        timeEl.textContent = formatTime(now - cat.start);
                    }
                });

                runningRacers.forEach(r => {
                    const displayId = `${container.id || 'timer'}-racer-val-${r.id}`;
                    const timeEl = document.getElementById(displayId);
                    if (timeEl) {
                        const now = Date.now() + (this.serverTimeOffset || 0);
                        timeEl.textContent = formatTime(now - (r.start_time || 0));
                    }
                });
            } else {
                if (
                    container.children.length === 0 ||
                    container.querySelector('.cat-timer') !== null ||
                    container.querySelector('.empty-text') === null
                ) {
                    container.innerHTML =
                        '<div class="empty-text" style="text-align:center; color: var(--text-secondary); width:100%; padding:20px;">Még nincs aktív futam</div>';
                }
            }
        });

        const runningElements = document.querySelectorAll('tr.status-running .time');
        runningElements.forEach(el => {
            const startStr = el.getAttribute('data-start');
            if (startStr) {
                const now = Date.now() + (this.serverTimeOffset || 0);
                el.textContent = formatTime(now - parseInt(startStr, 10));
            }
        });
    }

    async updateRacerBib(id, newBib) {
        if (!newBib || isNaN(newBib)) {
            showToast('Kérlek adj meg egy érvényes rajtszámot!', 'error');
            return;
        }

        const bibNum = parseInt(newBib);

        let swap = false;

        // Helyi duplikáció ellenőrzés
        const existing = this.data.racers.find(r => r.bib === bibNum && r.id !== id);
        if (existing) {
            const existingName =
                existing.members && existing.members.length > 0
                    ? existing.members.map(m => m.name).join(', ')
                    : 'Ismeretlen';
            const currentRacer = this.data.racers.find(r => r.id === id);
            const originalBib = currentRacer ? currentRacer.bib : '?';
            const wantSwap = confirm(
                `A #${bibNum} rajtszám már foglalt (${existingName} által)!\n\nSzeretnéd felcserélni a két rajtszámot? (A(z) ${existingName} megkapja a(z) #${originalBib} rajtszámot.)`
            );
            if (!wantSwap) {
                return;
            }
            swap = true;
        }

        // Tagok neveinek lekérése a történethez
        const racer = this.data.racers.find(r => r.id === id);
        const originalBib = racer ? racer.bib : '?';
        const racerName =
            racer && racer.members && racer.members.length > 0
                ? racer.members.map(m => m.name).join(', ')
                : 'Ismeretlen';

        try {
            const response = await fetch(`${API_URL}/racer/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.adminPassword}`,
                },
                body: JSON.stringify({
                    bib: bibNum,
                    oldBib: originalBib,
                    racerName: racerName,
                    swap: swap,
                }),
            });

            const data = await response.json();
            if (response.ok && data.success) {
                showToast(`Rajtszám sikeresen módosítva: #${originalBib} ➔ #${bibNum}`, 'success');
                await this.refreshUI();
                return true;
            } else {
                showToast(data.error || 'Hiba a módosításkor!', 'error');
                return false;
            }
        } catch (err) {
            console.error('Bib update error:', err);
            showToast('Kapcsolódási hiba!', 'error');
            return false;
        }
    }

    async updateRacerStatus(id, field, value) {
        try {
            const response = await fetch(`${API_URL}/racer/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.adminPassword}`,
                },
                body: JSON.stringify({ [field]: value }),
            });

            if (response.ok) {
                showToast('Állapot mentve.', 'success');
                // Frissítjük a helyi adatot és az UI-t
                const racer = this.data.racers.find(r => r.id === id);
                if (racer) racer[field] = value;

                // Ha megjelent állapot változott, frissítsük a listákat
                if (field === 'checked_in' || field === 'is_paid') {
                    this.renderWaitingListCards();
                    this.renderRunningListCards();
                    this.renderFinishedListCards();
                    if (typeof window.renderAdminTable === 'function') window.renderAdminTable();
                }

                return true;
            } else {
                const err = await response.json();
                showToast(err.error || 'Hiba a mentéskor!', 'error');
                return false;
            }
        } catch (err) {
            showToast('Hálózati hiba!', 'error');
            return false;
        }
    }

    async updateMemberStatus(id, field, value) {
        try {
            const response = await fetch(`${API_URL}/member/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.adminPassword}`,
                },
                body: JSON.stringify({ [field]: value }),
            });

            if (response.ok) {
                showToast('Tag állapota mentve.', 'success');
                // Frissítjük a helyi adatot és az UI-t
                for (const r of this.data.racers) {
                    if (r.members) {
                        const member = r.members.find(m => m.id == id);
                        if (member) {
                            member[field] = value;
                            break;
                        }
                    }
                }

                // Újrarajzoljuk a listákat, ha a megjelent állapot változott
                if (field === 'checked_in') {
                    this.renderWaitingListCards();
                    this.renderRunningListCards();
                    this.renderFinishedListCards();
                    if (typeof window.renderAdminTable === 'function') window.renderAdminTable();
                }

                return true;
            } else {
                const err = await response.json();
                showToast(err.error || 'Hiba a mentéskor!', 'error');
                return false;
            }
        } catch (err) {
            showToast('Hálózati hiba!', 'error');
            return false;
        }
    }

    // --- 4. MEGJELENÍTÉSI LOGIKA (UI RENDERING) ---
    renderUI() {
        this.renderRacersList();
        this.renderAdminStats();
        if (typeof window.renderAdminTable === 'function') window.renderAdminTable();
        if (typeof window.renderAdminCharts === 'function') window.renderAdminCharts();
        this.renderAdminControlButtons();
        this.renderWaitingListCards();
        this.renderRunningListCards();
        this.renderFinishedListCards();
        this.renderNotTurnedListCards();
        this.renderLiveLog();
        if (this.adminPassword) this.loadUnassignedTimes();
    }

    renderAdminStats() {
        const statsContainers = document.querySelectorAll('.admin-stats');
        if (statsContainers.length === 0) return;

        const total = this.data.racers.length;
        const running = this.data.racers.filter(r => r.status === 'running').length;
        const finished = this.data.racers.filter(r => r.status === 'finished').length;
        const registered = this.data.racers.filter(r => r.status === 'registered').length;

        const statsHtml = `
            <div style="display: flex; gap: 20px;">
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
            </div>
        `;

        statsContainers.forEach(container => {
            container.innerHTML = statsHtml;
        });

        const cpStatsContainer = document.getElementById('admin-checkpoint-stats');
        if (cpStatsContainer) {
            const running22km = this.data.racers.filter(r => r.status === 'running' && r.distance === '22km').length;
            const megfordult = (this.data.checkpoints || []).filter(
                c => c.checkpoint_name === '22km_tav_11km_fordulo'
            ).length;
            const cpData = this.data.checkpoints || [];
            const nem_fordult = this.data.racers.filter(
                r =>
                    r.status === 'running' &&
                    r.distance === '22km' &&
                    !cpData.some(c => c.racer_bib === r.bib && c.checkpoint_name === '22km_tav_11km_fordulo')
            ).length;

            cpStatsContainer.innerHTML = `
                <div style="display: flex; gap: 20px;">
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

    renderWaitingListCards() {
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

        const registered = this.data.racers.filter(r => r.status === 'registered');

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
                                    <td>${r.members ? r.members.map(m => m.name).join(', ') : r.name || '-'}</td>
                                    <td style="font-size: 0.75rem; color: var(--text-secondary);">${this.formatCategoryName(r.category)}</td>
                                    <td style="font-size: 0.75rem; color: #aaa;">${r.distance || '-'}</td>
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

    renderRunningListCards() {
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

        const runningRacers = this.data.racers.filter(r => r.status === 'running');

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
                                    const now = Date.now() + (this.serverTimeOffset || 0);
                                    const timeDisplay = formatTime(now - (r.start_time || 0));
                                    return `
                                <tr class="status-running">
                                    <td><strong style="color: var(--accent-primary);">#${(r.bib || 0).toString().padStart(3, '0')}</strong></td>
                                    <td>${r.members ? r.members.map(m => m.name).join(', ') : r.name || '-'}</td>
                                    <td style="font-size: 0.75rem; color: var(--text-secondary);">${this.formatCategoryName(r.category)}</td>
                                    <td style="font-size: 0.75rem; color: #aaa;">${r.distance || '-'}</td>
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

    renderFinishedListCards() {
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

        const finishedRacers = this.data.racers.filter(r => r.status === 'finished');

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
                                    <td>${r.members ? r.members.map(m => m.name).join(', ') : r.name || '-'}</td>
                                    <td style="font-size: 0.75rem; color: var(--text-secondary);">${this.formatCategoryName(r.category)}</td>
                                    <td style="font-size: 0.75rem; color: #aaa;">${r.distance || '-'}</td>
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

    renderNotTurnedListCards() {
        const liveCard = document.getElementById('not-turned-list-container-live');
        const liveContent = document.getElementById('not-turned-list-content-live');
        if (!liveCard || liveCard.classList.contains('hidden') || !liveContent) return;

        const checkpoints = this.data.checkpoints || [];
        const notTurnedRacers = this.data.racers.filter(r => {
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
                                    <td>${r.members ? r.members.map(m => m.name).join(', ') : r.name || '-'}</td>
                                    <td style="font-size: 0.75rem; color: var(--text-secondary);">${this.formatCategoryName(r.category)}</td>
                                    <td style="font-size: 0.75rem; color: #aaa;">${r.distance || '-'}</td>
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

    renderAdminControlButtons() {
        // Implementation moved to separate admin-ui.js logic but called from here
        if (typeof window.renderAdminControlButtons === 'function') {
            window.renderAdminControlButtons();
        }
    }

    belongsToGroup(racer, groupId) {
        const cat = racer.category.toLowerCase();
        const dist = racer.distance;
        if (groupId === 'kajak_hosszu')
            return (cat.includes('kajak') || cat.includes('surfski') || cat.includes('mk_1')) && dist === '22km';
        if (groupId === 'kajak_rovid') return (cat.includes('kajak') || cat.includes('surfski')) && dist === '11km';
        if (groupId === 'kenu_hosszu')
            return (cat.includes('kenu') || cat.includes('outrigger') || cat.includes('sup')) && dist === '22km';
        if (groupId === 'kenu_rovid')
            return (cat.includes('kenu') || cat.includes('outrigger') || cat.includes('sup')) && dist === '11km';
        if (groupId === 'sup_4km') return cat.includes('sup') && dist === '4km';
        if (groupId === 'sarkanyhajo_11km') return /s[aá]rk[aá]ny/i.test(cat) && dist === '11km';
        return false;
    }

    renderRacersList() {
        const container = document.getElementById('results-tables-container');
        if (!container) return;
        container.innerHTML = '';

        if (!this.data.racers || this.data.racers.length === 0) {
            container.innerHTML =
                '<div style="text-align:center; color: var(--text-secondary); width:100%;">Nincsenek nevezett versenyzők</div>';
            return;
        }

        const catGroups = {};
        this.data.racers.forEach(r => {
            const groupKey = `${r.category}_${r.distance}`;
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
                    ? `${this.formatCategoryName(groupKey)} - ${distDisplay}`
                    : this.formatCategoryName(groupKey);
                this.createResultsTable(container, catTitle, sortedRacers, false);
            });

        [
            { id: '22km', title: 'Hosszú táv összetett' },
            { id: '11km', title: 'Rövid táv összetett' },
            { id: '4km', title: 'SUP 4 km összetett' },
        ].forEach(dist => {
            const distRacers = this.data.racers.filter(
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
            this.createResultsTable(container, dist.title, sortedDistRacers, true);
        });
    }

    createResultsTable(container, title, racers, showCategory = false) {
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
                const now = Date.now() + (this.serverTimeOffset || 0);
                timeDisplay = formatTime(now - (r.start_time || 0));
                dataStartAttr = `data-start="${r.start_time || 0}"`;
            } else if (r.status === 'finished') {
                timeDisplay = formatTime(r.total_time || 0);
                rankDisplay = `${rank++}.`;
            }

            let cpHtml = '';
            if (hasKöridő) {
                let lapTimeStr = r.status === 'finished' ? 'nincs adat' : '-';
                if (this.data.checkpoints) {
                    const cp = this.data.checkpoints.find(
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
                const teamName = teamMember ? teamMember.name : r.name || `Sárkányhajó csapat #${r.bib}`;
                const athleteMembers = r.members.filter(m => m.otproba_id !== 'CSAPATNEV');

                if (athleteMembers.length > 0) {
                    const athleteListHtml = athleteMembers
                        .map(m => {
                            let btnHtml = '';
                            if (r.status === 'finished') {
                                btnHtml = `<button onclick="window.generateDiploma('${r.bib}', '${m.name.replace(/'/g, "\\'")}')" class="btn-primary" style="display:inline-flex; align-items:center; gap:3px; padding: 2px 6px; font-size: 0.65rem; background: #007bff; border: none; border-radius: 4px; cursor: pointer; color: white; font-family: inherit; margin-left:8px; vertical-align: middle;">🎓 Letöltés</button>`;
                            }
                            return `<li style="margin-bottom: 6px;">${m.name}${btnHtml}</li>`;
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
                namesDisplay = `${r.members ? r.members.map(m => m.name).join(', ') : r.name || '-'}${diplomaBtnHtml}`;
            }
            tr.innerHTML = `<td style="color:${rowColor}; font-weight:bold;">${rankDisplay}</td><td>#${(r.bib || 0).toString().padStart(3, '0')}</td><td>${namesDisplay}</td>${showCategory ? `<td style="font-size: 0.8rem; color: #888;">${this.categoryMap[r.category] || r.category}</td>` : ''}${cpHtml}<td class="time" style="color:${rowColor}; font-family: 'Space Mono', monospace; text-align:right;" ${dataStartAttr}>${timeDisplay}</td>`;
            tbody.appendChild(tr);
        });
        container.appendChild(catWrapper);
    }

    renderLiveLog() {
        const logContainer = document.getElementById('admin-event-log-content');
        if (!logContainer) return;

        const events = [];

        // Checkpoints feldolgozása
        if (this.data.checkpoints) {
            this.data.checkpoints.forEach(cp => {
                events.push({
                    type: 'checkpoint',
                    time: cp.timestamp,
                    bib: cp.racer_bib,
                    msg: `📍 KÖR rögzítve: #${cp.racer_bib} (${cp.checkpoint_name.replace('22km_tav_11km_fordulo', 'Forduló')})`,
                });
            });
        }

        // Finishers feldolgozása
        if (this.data.racers) {
            this.data.racers
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

    async loadUnassignedTimes() {
        try {
            const response = await fetch(`${API_URL}/unassigned-times`, {
                headers: { Authorization: `Bearer ${this.adminPassword}` },
            });
            if (response.ok) {
                const times = await response.json();
                this.renderUnassignedTimes(times);
            }
        } catch (err) {
            console.error('Failed to load unassigned times', err);
        }
    }

    renderUnassignedTimes(times) {
        const container = document.getElementById('unassigned-times-container');
        if (!container) return;

        if (!times || times.length === 0) {
            container.innerHTML = '<div class="empty-text">Nincs kiosztatlan idő.</div>';
            return;
        }

        // Legújabb elöl
        times.sort((a, b) => b.timestamp - a.timestamp);

        container.innerHTML = times
            .map(t => {
                const timeStr = new Date(t.timestamp).toLocaleTimeString('hu-HU');
                return `
                <div style="display: flex; gap: 10px; align-items: center; background: rgba(255, 184, 0, 0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(255, 184, 0, 0.2);">
                    <div style="flex: 1;">
                        <div style="color: var(--text-secondary); font-size: 0.75rem;">Időpont:</div>
                        <div style="font-family: 'Space Mono', monospace; font-size: 1.1rem; color: #ffb800; font-weight: bold;">${timeStr}</div>
                    </div>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <input type="number" id="assign-bib-${t.id}" placeholder="Rajtszám" style="width: 80px; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 6px; color: white; text-align: center;">
                        <button onclick="window.raceManager.assignTime('${t.id}')" class="btn-primary" style="padding: 8px 15px; margin: 0; background: #28a745; min-height: 0;">PÁROSÍT</button>
                        <button onclick="window.raceManager.deleteUnassignedTime('${t.id}')" class="btn-secondary" style="padding: 8px 12px; margin: 0; background: rgba(220, 53, 69, 0.1); color: #dc3545; border-color: rgba(220, 53, 69, 0.3); min-height: 0;">TÖRLÉS</button>
                    </div>
                </div>
            `;
            })
            .join('');
    }

    async assignTime(id) {
        const bibInput = document.getElementById(`assign-bib-${id}`);
        if (!bibInput) return;
        const bib = parseInt(bibInput.value);
        if (isNaN(bib)) {
            showToast('Kérlek adj meg egy érvényes rajtszámot!', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/assign-time`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.adminPassword}`,
                },
                body: JSON.stringify({ id, bib }),
            });
            const data = await response.json();
            if (response.ok && data.success) {
                showToast('Sikeresen párosítva!', 'success');
                this.loadUnassignedTimes();
            } else {
                showToast(data.error || 'Hiba a párosítás során!', 'error');
            }
        } catch (err) {
            showToast('Hálózati hiba!', 'error');
        }
    }

    async deleteUnassignedTime(id) {
        if (!confirm('Biztosan törlöd ezt az időt? Ezt nem lehet visszavonni!')) return;
        try {
            const response = await fetch(`${API_URL}/unassigned-time/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${this.adminPassword}` },
            });
            const data = await response.json();
            if (response.ok && data.success) {
                showToast('Idő törölve!', 'success');
                this.loadUnassignedTimes();
            } else {
                showToast(data.error || 'Hiba a törlés során!', 'error');
            }
        } catch (err) {
            showToast('Hálózati hiba!', 'error');
        }
    }
}
