// js/pages/start.js – Auswahl nach der Anmeldung: Dashboard oder J.Mainz OS (nur am PC; am Handy geht es direkt ins Dashboard)
(function () {
    'use strict';
    const URLS = { dash: '/menu.html', os: '/OS/' };
    const force = new URLSearchParams(location.search).has('wahl');          // /start.html?wahl zeigt die Auswahl immer
    let busy = false;
    async function go(v) {
        if (busy) return; busy = true;
        if (document.getElementById('remember').checked) { try { await saveEntryPref(v); } catch (e) { /* Merken ist ein Extra */ } }
        location.href = URLS[v];
    }
    initAuthGuard(user => {
        if (!user) return;
        if (!bigScreen()) return location.replace(URLS.dash);
        const v = entryPref(user.userPrefs);
        if (!force && v !== 'ask') return location.replace(URLS[v]);
        document.getElementById('hi').textContent = `Hallo ${user.firstName || ''}!`.replace(' !', '!');
        document.getElementById('wait').remove();
        document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
        document.addEventListener('keydown', ev => { if (ev.target.closest('input') && ev.key !== '1' && ev.key !== '2') return; if (ev.key === '1') go('dash'); else if (ev.key === '2') go('os'); });
        document.querySelector('[data-go]').focus({ preventScroll: true });
    });
})();
