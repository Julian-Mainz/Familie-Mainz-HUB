// js/theme.js - wird als erstes Skript im <head> geladen (ohne defer), damit nichts aufblitzt:
// helles oder dunkles Design, Karten-Raster bis zum Sortieren verstecken und die Dateiversionen für nachgeladene Skripte.
// Alles andere (Firebase, Seiten-Code) kommt mit "defer" und blockiert das erste Anzeigen nicht mehr.
(function () {
    const safe = fn => { try { return fn(); } catch (e) { return null; } };
    window.safeStore = window.safeStore || safe;
    // Versionsnummern der Dateien (trägt die GitHub-Action ein). assetUrl('/js/settings.js') -> '/js/settings.js?v=ab12cd34'
    window.ASSET_V = {"/OS/app-admin.js":"bd1cab01","/OS/app-changelog.js":"450d2b4b","/OS/app-finanzen.js":"cc2cbe8b","/OS/app-kalender.js":"4b813c7d","/OS/app-kit.js":"5d2342d4","/OS/app-spotify.js":"ce9a7b58","/OS/app-tresor.js":"541ed744","/OS/app-zeit.js":"2ce67fdc","/OS/apps.js":"3a9efc75","/OS/calc.js":"26b0e403","/OS/chart.js":"e0093e54","/OS/contacts.js":"cee5be90","/OS/docx.js":"1d432796","/OS/editor.js":"966d4a62","/OS/explorer.js":"2e4a56c5","/OS/extras.js":"c66d2f03","/OS/live.js":"b8c746dd","/OS/messenger.js":"5789e281","/OS/more.js":"e35b151a","/OS/office.js":"899bb197","/OS/officekit.js":"beb9d3e7","/OS/os-icons.css":"f17aed4a","/OS/os.css":"4f455904","/OS/os.js":"ba6e0051","/OS/plus.js":"6a3f8310","/OS/pptx.js":"1e0f22b5","/OS/season.js":"1a6bd43b","/OS/setwin.js":"daa9de54","/OS/sheetcore.js":"556a4d5e","/OS/shell.js":"e72c727d","/OS/slides.js":"6c676d46","/OS/social.js":"167105eb","/OS/sound.js":"b665566f","/OS/taskman.js":"61874436","/OS/tools.js":"955fc18e","/OS/widgets.js":"534cc2ac","/OS/writer.js":"21bc1f63","/OS/zip.js":"ec5ca428","/assets/css/wand.css":"362c63f7","/assets/icons.css":"f020f76b","/assets/layout.css":"af1abb40","/assets/light.css":"3ab881b3","/assets/space.css":"6a03cf86","/assets/ui.css":"e86af0ba","/assets/ux.css":"5dadaea8","/js/cal-remind.js":"a3dc3fc0","/js/calendar-core.js":"205fb9b3","/js/drawer.js":"f6f08069","/js/emoji-data.js":"cd8b4940","/js/emoji-picker.js":"c51a2242","/js/firebase-init.js":"e5e469f1","/js/gamesave.js":"b3e8bf75","/js/layout.js":"65577de7","/js/messenger-core.js":"793776e2","/js/pages/admin.js":"b45dd657","/js/pages/changelog.js":"5d68bdcb","/js/pages/dokumente.js":"8b1ef28d","/js/pages/finanzen.js":"1379bc06","/js/pages/login.js":"028aa521","/js/pages/menu.js":"686c02f4","/js/pages/messenger.js":"8ee28a51","/js/pages/passwort.js":"be5b294b","/js/pages/profil.js":"de6b797e","/js/pages/spotify.js":"8f505b22","/js/pages/start.js":"4c9b4301","/js/pages/wand.js":"e29f01c8","/js/pages/zeiterfassung.js":"dda8f1ef","/js/search.js":"09088740","/js/settings.js":"b3e3053f","/js/space.js":"6b19e834","/js/timesheet-pdf.js":"0ca24e09","/js/timesheet.js":"505b6dd4","/js/update.js":"913a3f5e","/js/ux.js":"34deac13","/js/vendor/firebase-app-compat.js":"c066068f","/js/vendor/firebase-auth-compat.js":"4d9f6e50","/js/vendor/firebase-firestore-compat.js":"53cdabb9"}; /*ASSET_V*/
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
