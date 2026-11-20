// js/pages/changelog.js - Seiten-Code von /changelog.html (ausgelagert, damit der Browser ihn zwischenspeichern kann)
// Bereiche: Erkennung über die Überschrift, dazu Farbe und Symbol
const AREAS = [
    ['Finanzen', /finanz|rechnung|buchung|lohn/i, '#facc15', '250,204,21', 'fa-coins'], ['Zeiterfassung', /zeit|stempel|überstunden|urlaub/i, '#34d399', '52,211,153', 'fa-business-time'],
    ['Spiele', /spiel|kolonie|game|ballon|keks|büro|buero/i, '#a78bfa', '167,139,250', 'fa-gamepad'], ['Kalender', /kalender|termin|wand/i, '#22d3ee', '34,211,238', 'fa-calendar-days'],
    ['Dokumente', /dokument|datei/i, '#38bdf8', '56,189,248', 'fa-folder-open'], ['Messenger', /messenger|chat|nachricht/i, '#f472b6', '244,114,182', 'fa-comments'],
    ['Optik', /optik|design|hintergrund|anpassen|layout|startseite/i, '#fb923c', '251,146,60', 'fa-palette'], ['Sicherheit', /firestore|regel|sicher|datenschutz|login|anmeld/i, '#c084fc', '192,132,252', 'fa-shield-halved'],
    ['Sonstiges', /./, '#94a3b8', '148,163,184', 'fa-wand-magic-sparkles']];
const areaOf = t => AREAS.find(a => a[1].test(t));
// Nur für Admins: technische Abschnitte
const ADMIN_SEC = /^(geänderte dateien|firestore-regeln)/i, ADMIN_LINE = /^firestore-regeln:/i;
let days = [], admin = false, area = '', seen = '';
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const dIso = s => { const m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
function inline(s, q) {
    let h = esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    if (q) { const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'); h = h.replace(/(^|>)([^<]+)/g, (m, a, b) => a + b.replace(re, '<mark>$1</mark>')); }
    return h;
}
function parse(md) {
    const out = []; let day = null, sec = null;
    for (const raw of md.split(/\r?\n/)) {
        const l = raw.trimEnd();
        if (/^## /.test(l)) { day = { title: l.slice(3).trim(), iso: dIso(l), secs: [] }; out.push(day); sec = null; continue; }
        if (!day) continue;
        if (/^### /.test(l)) { sec = { title: l.slice(4).trim(), items: [], text: [] }; day.secs.push(sec); continue; }
        if (!l.trim()) continue;
        if (!sec) { sec = { title: 'Allgemein', items: [], text: [] }; day.secs.push(sec); }
        if (/^\s*[-*] /.test(l)) sec.items.push(l.replace(/^\s*[-*] /, '')); else if (sec.items.length && /^\s{2,}/.test(raw)) sec.items[sec.items.length - 1] += ' ' + l.trim(); else sec.text.push(l.trim());
    }
    return out;
}
function render() {
    const q = $('cl-q').value.trim(), ql = q.toLowerCase();
    $('cl-chips').innerHTML = ['', ...new Set(days.flatMap(d => d.secs.filter(s => admin || !ADMIN_SEC.test(s.title)).map(s => areaOf(s.title)[0])))].map(a => `<button class="chip${a === area ? ' on' : ''}" data-area="${esc(a)}">${a || 'Alle'}</button>`).join('');
    let html = '', nav = '';
    days.forEach((d, i) => {
        const secs = d.secs.filter(s => admin || !ADMIN_SEC.test(s.title)).map(s => ({ ...s, items: s.items.filter(x => admin || !ADMIN_LINE.test(x)) }))
            .filter(s => (!area || areaOf(s.title)[0] === area) && (!ql || `${s.title} ${s.items.join(' ')} ${s.text.join(' ')}`.toLowerCase().includes(ql)))
            .filter(s => s.items.length || s.text.length);
        if (!secs.length) return;
        const isNew = seen && d.iso && d.iso > seen, id = 'd' + i, wd = d.iso ? new Date(d.iso + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long' }) : '';
        nav += `<a href="#${id}" class="${isNew ? 'new' : ''}"><span class="dot"></span>${esc(d.title)}<small>${secs.length}</small></a>`;
        html += `<section class="cl-day" id="${id}"><div class="cl-dh"><h2>${esc(d.title)}</h2><small>${wd}</small>${isNew ? '<span class="cl-new">NEU FÜR DICH</span>' : ''}</div>` + secs.map(s => {
            const a = areaOf(s.title), adm = ADMIN_SEC.test(s.title);
            return `<div class="ux-card cl-sec" style="--c:${a[2]};--cr:${a[3]}"><div class="cl-ic"><i class="fa-solid ${a[4]}"></i></div><div class="cl-b"><h3>${inline(s.title, q)}${adm ? '<span class="cl-adm">nur für Admins sichtbar</span>' : ''}</h3>
                ${s.text.map(t => `<p>${inline(t, q)}</p>`).join('')}${s.items.length ? `<ul>${s.items.map(x => `<li>${inline(x, q)}</li>`).join('')}</ul>` : ''}</div></div>`; }).join('') + '</section>';
    });
    $('cl-list').innerHTML = html || '<div class="ux-card ux-empty"><i class="fa-solid fa-magnifying-glass"></i>Nichts gefunden.</div>';
    $('cl-nav').innerHTML = '<div class="ux-t" style="margin-bottom:6px"><i class="fa-solid fa-calendar-days"></i>Versionen</div>' + nav;
}
initAuthGuard(async user => {
    if (!user) return; renderDrawer(); admin = typeof isAdmin === 'function' && isAdmin(currentUser);
    seen = ls.get('cl_seen') || '';
    try {
        const r = await fetch('/CHANGELOG.md?v=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status);
        days = parse(await r.text());
        const last = days.find(d => d.iso); if (last) { $('ux-sub').textContent = `Was ist neu im J.Mainz Dashboard · zuletzt aktualisiert am ${last.title}`; ls.set('cl_seen', last.iso); }
        render();
    } catch (e) { $('cl-list').innerHTML = `<div class="ux-card ux-empty neg">Der Changelog konnte nicht geladen werden (${esc(e.message)}).</div>`; }
    $('cl-q').addEventListener('input', render);
    $('cl-chips').addEventListener('click', e => { const b = e.target.closest('[data-area]'); if (b) { area = b.dataset.area; render(); } });
});
