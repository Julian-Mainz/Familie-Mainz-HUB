// js/theme.js - wird als erstes Skript im <head> geladen (ohne defer), damit nichts aufblitzt:
// helles oder dunkles Design, Karten-Raster bis zum Sortieren verstecken und die Dateiversionen für nachgeladene Skripte.
// Alles andere (Firebase, Seiten-Code) kommt mit "defer" und blockiert das erste Anzeigen nicht mehr.
(function () {
    const safe = fn => { try { return fn(); } catch (e) { return null; } };
    window.safeStore = window.safeStore || safe;
    // Versionsnummern der Dateien (trägt die GitHub-Action ein). assetUrl('/js/settings.js') -> '/js/settings.js?v=ab12cd34'
    window.ASSET_V = {"/assets/css/wand.css":"b072ec91","/assets/icons.css":"946dd4ee","/assets/layout.css":"af1abb40","/assets/light.css":"00672ed2","/assets/space.css":"6a03cf86","/assets/ui.css":"5c4d9c4c","/assets/ux.css":"5dadaea8","/js/cal-remind.js":"a3dc3fc0","/js/calendar-core.js":"205fb9b3","/js/drawer.js":"f6f08069","/js/emoji-data.js":"cd8b4940","/js/emoji-picker.js":"c51a2242","/js/firebase-init.js":"77ec4fd2","/js/gamesave.js":"b3e8bf75","/js/layout.js":"65577de7","/js/messenger-core.js":"793776e2","/js/pages/admin.js":"b45dd657","/js/pages/changelog.js":"55bbc080","/js/pages/dokumente.js":"8b1ef28d","/js/pages/finanzen.js":"abf5f0af","/js/pages/login.js":"fd876d6f","/js/pages/menu.js":"686c02f4","/js/pages/messenger.js":"8ee28a51","/js/pages/passwort.js":"be5b294b","/js/pages/profil.js":"de6b797e","/js/pages/spotify.js":"8f505b22","/js/pages/wand.js":"e29f01c8","/js/pages/zeiterfassung.js":"dda8f1ef","/js/search.js":"09088740","/js/settings.js":"cd4c8770","/js/space.js":"6b19e834","/js/timesheet.js":"79743231","/js/update.js":"913a3f5e","/js/ux.js":"34deac13","/js/vendor/firebase-app-compat.js":"c066068f","/js/vendor/firebase-auth-compat.js":"4d9f6e50","/js/vendor/firebase-firestore-compat.js":"53cdabb9"}; /*ASSET_V*/
    window.assetUrl = p => (ASSET_V[p] ? p + '?v=' + ASSET_V[p] : p);
    // Seiten mit frei anpassbaren Karten: Raster bleibt unsichtbar, bis js/layout.js die Karten sortiert hat
    if (document.querySelector('link[href*="/assets/layout.css"]')) document.documentElement.classList.add('lay-js');
})();

// Seiten mit /assets/light.css bekommen ein echtes helles Design (Klasse "hell" an <html>).
// Seiten ohne light.css nutzen weiter den Farbfilter als Notlösung.
// Seiten, die immer dunkel bleiben sollen (Wandkalender), setzen <html data-theme-lock="dark">.
(function () {
    const css = document.createElement('style');
    css.textContent = 'html.light:not(.hell){filter:invert(.94) hue-rotate(180deg)}html.light:not(.hell) img,html.light:not(.hell) video,html.light:not(.hell) iframe{filter:invert(1) hue-rotate(180deg)}';
    document.head.appendChild(css);
})();
window.applyTheme = function () {
    const lock = document.documentElement.dataset.themeLock;
    const pref = lock || window.safeStore(() => localStorage.getItem('theme')) || 'dark';
    const light = pref === 'light' || (pref === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
    const own = !!document.querySelector('link[href*="/assets/light.css"]');       // Seite hat ein echtes helles Design
    document.documentElement.classList.toggle('light', light);
    document.documentElement.classList.toggle('hell', light && own);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = light ? (own ? '#eef1f6' : '#f1f5f9') : '#080c14';
    window.updateThemeButtons();
};
window.updateThemeButtons = function () {
    const light = document.documentElement.classList.contains('light');
    document.querySelectorAll('[data-theme-icon]').forEach(el => { el.classList.toggle('fa-sun', light); el.classList.toggle('fa-moon', !light); });
    document.querySelectorAll('[data-theme-text]').forEach(el => { el.textContent = light ? 'Hell' : 'Dunkel'; });
};
window.toggleTheme = function () {
    window.safeStore(() => localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'dark' : 'light'));
    applyTheme();
};
applyTheme();
document.addEventListener('DOMContentLoaded', () => updateThemeButtons());
