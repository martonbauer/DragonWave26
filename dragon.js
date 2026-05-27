/**
 * DragonWave - Fő belépési pont (Entry Point)
 * v2.3.0 modularizált verzió (Publikus oldalhoz)
 */

import { RaceManager } from './js/RaceManager.js';
import { switchTab, showToast, formatTime } from './js/ui-utils.js';
import { renderResultsCategoryList } from './js/admin-ui.js';
import { APP_VERSION } from './js/api.js';

// --- Globális hatókör biztosítása a HTML onclick eseményekhez ---
window.switchTab = switchTab;
window.showToast = showToast;
window.formatTime = formatTime;
window.renderResultsCategoryList = renderResultsCategoryList;

// Inicializálás
window.raceManager = new RaceManager();

// --- Alkalmazás Indítása és Globális Események ---
document.addEventListener('DOMContentLoaded', () => {
    // Verzió megjelenítése
    const versionEl = document.createElement('div');
    versionEl.style = 'position:fixed; bottom:5px; left:5px; font-size:10px; color:#444; z-index:9999;';
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
                { id: 'sarkanyhajo_otproba', name: 'Sárkányhajó' },
            ],
            '22km': [
                { id: 'versenykajak_noi_1_22km', name: 'Versenykajak női-1 (38 cm)' },
                { id: 'versenykajak_ferfi_1_22km', name: 'Versenykajak férfi-1 (38 cm)' },
                { id: 'turakajak_noi_1_22km', name: 'Túrakajak női-1 (42–51 cm)' },
                { id: 'turakajak_ferfi_1_22km', name: 'Túrakajak férfi-1 (42–51 cm)' },
                { id: 'turakajak_2_nyitott_22km', name: 'Túrakajak 2 (nyitott)' },
                { id: 'tengeri_kajak_noi_1_22km', name: 'Tengeri kajak női-1 (51 cm>)' },
                { id: 'tengeri_kajak_ferfi_1_22km', name: 'Tengeri kajak férfi-1 (51 cm>)' },
                { id: 'surfski_noi_22km', name: 'Surfski kajak női' },
                { id: 'surfski_ferfi_22km', name: 'Surfski kajak férfi' },
                { id: 'outrigger_noi_1_22km', name: 'Outrigger női-1' },
                { id: 'outrigger_ferfi_1_22km', name: 'Outrigger férfi-1' },
                { id: 'outrigger_2_nyitott_22km', name: 'Outrigger-2 (nyitott)' },
                { id: 'kenu_2_ferfi_22km', name: 'Kenu-2 férfi' },
                { id: 'kenu_2_vegyes_22km', name: 'Kenu-2 vegyes' },
                { id: 'kenu_3_nyitott_22km', name: 'Kenu-3 (nyitott)' },
                { id: 'kenu_4_nyitott_22km', name: 'Kenu-4 (nyitott)' },
                { id: 'sup_noi_1_22km', name: 'SUP női-1' },
                { id: 'sup_ferfi_1_22km', name: 'SUP férfi-1' },
            ],
            '4km': [
                { id: 'sup_noi_1_merev_39_alatt_4km', name: 'SUP női-1- merev deszka 39 év alatt' },
                { id: 'sup_noi_1_merev_40_felett_4km', name: 'SUP női-1- merev deszka 40 év felett' },
                { id: 'sup_ferfi_1_merev_39_alatt_4km', name: 'SUP férfi-1- merev deszka 39 év alatt' },
                { id: 'sup_ferfi_1_merev_40_felett_4km', name: 'SUP férfi-1- merev deszka 40 év felett' },
                { id: 'sup_noi_1_felfujhato_39_alatt_4km', name: 'SUP női-1- felfújható deszka 39 év alatt' },
                { id: 'sup_noi_1_felfujhato_40_felett_4km', name: 'SUP női-1- felfújható deszka 40 év felett' },
                { id: 'sup_ferfi_1_felfujhato_39_alatt_4km', name: 'SUP férfi-1- felfújható deszka 39 év alatt' },
                { id: 'sup_ferfi_1_felfujhato_40_felett_4km', name: 'SUP férfi-1- felfújható deszka 40 év felett' },
                { id: 'sup_ferfi_1_felfujhato_16_alatt_4km', name: 'SUP férfi-1- felfújható deszka 16 év alatt' },
                { id: 'sup_noi_1_felfujhato_16_alatt_4km', name: 'SUP női-1- felfújható deszka 16 év alatt' },
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

    // Registration Form Submit
    document.getElementById('nevezesForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const kategoria = document.getElementById('kategoria').value;
        const tav = document.getElementById('versenytav').value;
        const email = document.getElementById('reg-email').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const contactName = document.getElementById('reg-name').value.trim();

        const notice = document.getElementById('reg-form-payment-notice');
        const isAdmin = notice && notice.classList.contains('hidden');

        if (!isAdmin && (!email || !phone || !contactName)) {
            showToast('Kérjük adja meg az összes kapcsolattartói adatot!', 'error');
            return;
        }

        const finalEmail = email || 'admin@dragonwave.hu';
        const finalPhone = phone || '0000';
        const finalContactName = contactName || 'Adminisztrátor';

        const members = [];
        try {
            document.querySelectorAll('.member-entry').forEach((entry, idx) => {
                const name = entry.querySelector('.member-name').value.trim();
                const birth_date = entry.querySelector('.member-birth').value;
                const otprobaInp = entry.querySelector('.member-otproba');
                const otproba_id = otprobaInp.disabled ? 'Nincs' : otprobaInp.value;

                // Ha ez a csapatnév mező, és nincs kitöltve (mivel opcionális), egyszerűen átugorjuk
                if (entry.classList.contains('team-name-entry') && !name) {
                    return;
                }

                if (!name || !birth_date) throw new Error(`Kérjük adja meg a(z) ${idx + 1}. versenyző minden adatát!`);
                members.push({ name, birth_date, otproba_id });
            });
            const payModal = document.getElementById('payment-modal');

            if (payModal && !isAdmin) {
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
                    newBtn.textContent = 'Feldolgozás...';
                    try {
                        // 1. Regisztráció a szerveren
                        const formRes = await window.raceManager.registerRacer(
                            members,
                            kategoria,
                            tav,
                            false,
                            finalEmail,
                            finalPhone,
                            finalContactName,
                            true
                        );

                        if (!formRes) {
                            newBtn.disabled = false;
                            newBtn.textContent = 'Tovább a fizetésre ➔';
                            return;
                        }

                        // 2. Átirányítás a cél URL-re
                        showToast('Sikeres nevezés! Átirányítás a fizetési oldalra...', 'success');
                        setTimeout(() => {
                            window.location.href = 'https://sarkanyhajozz.hu/termek/dunakeszi-futam-elonevezes/';
                        }, 1500);
                    } catch (submitErr) {
                        showToast(submitErr.message || 'Hiba a mentésnél', 'error');
                        newBtn.disabled = false;
                        newBtn.textContent = 'Tovább a fizetésre ➔';
                    }
                };
            } else {
                const regResult = await window.raceManager.registerRacer(
                    members,
                    kategoria,
                    tav,
                    false,
                    finalEmail,
                    finalPhone,
                    finalContactName,
                    isAdmin
                );
                this.reset();
                window.updateCategorySelect();

                if (isAdmin && regResult && regResult.id) {
                    const wantsTeam = confirm(
                        'Sikeres adminisztrátori nevezés! Szeretnéd a most felvitt versenyző(ke)t közvetlenül beosztani egy csapatba/egységbe?'
                    );
                    if (wantsTeam) {
                        window.newlyRegisteredRacerId = regResult.id;
                        window.showDataSubSection('admin-data-section-teams');
                    }
                }
            }
        } catch (err) {
            showToast(err.message, 'error');
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

    // Mobil menü kezelés
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('main-nav');
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', e => {
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
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view');
        console.log('URL Routing triggered, view:', view);
        if (view) {
            setTimeout(() => {
                console.log('Executing switchTab for:', view);
                window.switchTab(view);
            }, 200);
        }
    };
    handleURLRouting();
});
