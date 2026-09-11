/**
 * --- ADMIN EVENT LISTENERS MODULE (admin-events.js) ---
 * Modern, deklaratív eseménykezelés (addEventListener) és eseménydelegálás
 * az admin felület elemeihez az inline onclick attribútumok helyett.
 */

export function setupAdminEventListeners() {
    // 1. Bejelentkező űrlap
    const loginForm = document.querySelector('#admin-login-panel form');
    if (loginForm) {
        loginForm.addEventListener('submit', event => {
            event.preventDefault();
            if (typeof window.loginAdmin === 'function') {
                window.loginAdmin();
            }
        });
    }

    // 2. Kijelentkezés gomb
    const logoutButtons = document.querySelectorAll('button[onclick*="logoutAdmin"], [data-action="logout"]');
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', event => {
            event.preventDefault();
            if (typeof window.logoutAdmin === 'function') {
                window.logoutAdmin();
            }
        });
    });

    // 3. Eseménydelegáció a dinamikus és statikus gombokhoz (data-action és data-section alapján)
    document.addEventListener('click', event => {
        // Fő szekció váltás
        const sectionTarget = event.target.closest('[data-section]');
        if (sectionTarget) {
            const section = sectionTarget.getAttribute('data-section');
            if (section && typeof window.showAdminSection === 'function') {
                window.showAdminSection(section);
                return;
            }
        }

        // Adatkezelő alszekció váltás
        const subSectionTarget = event.target.closest('[data-subsection]');
        if (subSectionTarget) {
            const subSection = subSectionTarget.getAttribute('data-subsection');
            if (subSection && typeof window.showDataSubSection === 'function') {
                window.showDataSubSection(subSection);
                return;
            }
        }

        // Visszalépő és landing akciók
        const actionTarget = event.target.closest('[data-action]');
        if (actionTarget) {
            const action = actionTarget.getAttribute('data-action');
            if (action === 'admin-landing' && typeof window.showAdminLanding === 'function') {
                window.showAdminLanding();
            } else if (action === 'data-landing' && typeof window.showDataLanding === 'function') {
                window.showDataLanding();
            } else if (action === 'table-landing' && typeof window.showTableLanding === 'function') {
                window.showTableLanding();
            } else if (action === 'results-landing' && typeof window.showResultsLanding === 'function') {
                window.showResultsLanding();
            } else if (action === 'close-confirm' && typeof window.closeConfirmModal === 'function') {
                window.closeConfirmModal();
            } else if (action === 'execute-confirm' && typeof window.executeConfirmedAction === 'function') {
                window.executeConfirmedAction();
            }
        }
    });

    // 4. Keresőmező eseménykezelő (keyup)
    const searchInput = document.getElementById('table-search-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', event => {
            if (typeof window.handleTableSearch === 'function') {
                window.handleTableSearch(event.target.value);
            }
        });
    }

    // 5. Szerkesztő modál űrlap
    const editForm = document.getElementById('edit-racer-form');
    if (editForm) {
        editForm.addEventListener('submit', event => {
            event.preventDefault();
            if (window.raceManager && typeof window.raceManager.saveRacer === 'function') {
                window.raceManager.saveRacer();
            }
        });
    }
}
