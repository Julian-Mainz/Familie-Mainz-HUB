// OS/officekit.js – Gemeinsame Office-Funktionen für Writer, Tabellen und Präsentation:
// Automatisch speichern, Versionsverlauf (letzte 5 Stände), eigene Vorlagen, Diagramm aus einer Tabelle übernehmen, Datenquellen für den Serienbrief.
(function () {
    'use strict';
    if (window.JMOFFICE) return;
    let API = null, U = null;
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const cfg = () => { const s = API.state(); s.office = s.office || {}; return s.office; };
    const opt = k => !API || cfg()[k] !== false;                    // Standard: an
    const setOpt = (k, v) => { cfg()[k] = !!v; API.save(); document.querySelectorAll(`[data-of-opt="${k}"]`).forEach(i => { i.checked = !!v; }); };
    const size = b => b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
    const when = t => { const d = new Date(t), m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} Min.` : d.toDateString() === new Date().toDateString() ? 'Heute, ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }); };

    function flash(msg) { const el = document.createElement('div'); el.className = 'of-flash'; el.innerHTML = `<i class="fa-solid fa-circle-check"></i>${esc(msg)}`; document.body.appendChild(el); setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3000); }
    function dialog(html, wide) {
        const bg = document.createElement('div'); bg.className = 'uidlg-bg'; bg.innerHTML = `<div class="uidlg of-dlg${wide ? ' wide' : ''}">${html}</div>`;
        const close = () => { bg.remove(); document.removeEventListener('keydown', key, true); };
        const key = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
        bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-of-x]')) close(); });
        document.addEventListener('keydown', key, true); document.body.appendChild(bg); return { el: bg.querySelector('.uidlg'), close };
    }
    const ask = (title, value, okText) => new Promise(res => {
        const d = dialog(`<form><div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-bookmark"></i></span><span>${esc(title)}</span></div><input class="xp-ask" maxlength="80" value="${esc(value)}"><div class="uidlg-a"><button type="button" data-of-x>Abbrechen</button><button type="submit" class="ok">${esc(okText)}</button></div></form>`);
        const i = d.el.querySelector('input'); i.focus(); i.select();
        d.el.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); const v = i.value.trim(); d.close(); res(v || null); });
        d.el.querySelector('[data-of-x]').addEventListener('click', () => res(null));
    });

    // ---------- Automatisch speichern ----------
    // c = { body, win, doc, dirty(), save(as, auto), busy() }
    function autosave(c) {
        const tabs = c.body.querySelector('.wr-tabs'), sv = tabs && tabs.querySelector('.wr-sv');
        if (sv) { const l = document.createElement('label'); l.className = 'of-as'; l.title = 'Gespeicherte Dateien werden nach jeder Änderung von selbst gesichert';
            l.innerHTML = `<input type="checkbox" class="tgl" data-of-opt="autosave"${opt("autosave") ? " checked" : ""}><span>Automatisch speichern</span>`; sv.before(l);
            l.querySelector('input').addEventListener('change', ev => { setOpt('autosave', ev.target.checked); if (ev.target.checked) tick(true); }); }
        let last = Date.now();
        const mark = () => { last = Date.now(); };
        ['keydown', 'input', 'pointerup', 'paste', 'drop'].forEach(t => c.body.addEventListener(t, mark, true));
        function tick(now) {
            if (!c.win.el.isConnected) return clearInterval(iv);
            if (!opt('autosave') || !c.doc.key || c.doc.saving || !c.dirty() || (c.busy && c.busy())) return;
            if (!now && Date.now() - last < 2500) return;
            c.save(false, true);
        }
        const iv = setInterval(() => tick(false), 1500);
        return { on: () => opt('autosave') };
    }
    // Speicheroptionen für saveText: Version vor dem Überschreiben (wenn eingeschaltet)
    const saveOpts = () => ({ version: opt('versions') });

    // ---------- Versionsverlauf ----------
    // c = { doc, dirty(), save(), reload(), app: 'Writer' }
    function versions(c) {
        if (!c.doc.key) return uiAlert('Speichere die Datei zuerst – danach merkt sich das System bei Änderungen die letzten fünf Stände.');
        const d = dialog('', true);
        const draw = () => {
            const list = JMOS_FILES.versions(c.doc.key);
            d.el.innerHTML = `<div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-clock-rotate-left"></i></span><span>Versionsverlauf – ${esc(c.doc.name)}</span></div>
                <p class="uidlg-m">Beim Speichern wird der vorherige Stand aufgehoben (höchstens alle 10 Minuten einer). Die letzten fünf bleiben erhalten und zählen zu deinem Speicher.</p>
                <label class="of-sw"><input type="checkbox" class="tgl" data-of-opt="versions"${opt("versions") ? " checked" : ""}><span>Versionen aufheben</span></label>
                <div class="of-list">${list.length ? list.map((v, i) => `<div class="of-row"><i class="fa-solid fa-file-circle-check"></i><span><b>${esc(when(v.at))}</b><small>${i === 0 ? 'Neuester gesicherter Stand · ' : ''}${size(v.size)}</small></span>
                    <button type="button" class="btn" data-dl="${esc(v.id)}" title="Herunterladen"><i class="fa-solid fa-download"></i></button><button type="button" class="btn pri" data-rs="${esc(v.id)}"><i class="fa-solid fa-rotate-left"></i>Wiederherstellen</button></div>`).join('')
                    : `<p class="of-none"><i class="fa-solid fa-circle-info"></i>Noch keine älteren Stände. ${opt('versions') ? 'Sobald du die Datei das nächste Mal speicherst, wird der jetzige Stand hier aufgehoben.' : 'Versionen sind ausgeschaltet.'}</p>`}</div>
                <div class="uidlg-a"><button type="button" data-of-x>Schließen</button></div>`;
            d.el.querySelector('[data-of-opt]').addEventListener('change', ev => setOpt('versions', ev.target.checked));
        };
        draw();
        d.el.addEventListener('click', async ev => {
            const dl = ev.target.closest('[data-dl]'), rs = ev.target.closest('[data-rs]');
            if (dl) { try { const b = await JMOS_FILES.versionBlob(dl.dataset.dl), v = JMOS_FILES.versions(c.doc.key).find(x => x.id === dl.dataset.dl), a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: c.doc.name.replace(/(\.\w+)$/, ` (Stand ${new Date(v ? v.at : Date.now()).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }).replace(/[/:]/g, '-')})$1`) }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } catch (x) { uiAlert(x.message); } return; }
            if (!rs) return;
            if (!(await uiConfirm('Diesen Stand wiederherstellen? Der jetzige Stand wird vorher als Version aufgehoben, du kannst also zurück.', { ok: 'Wiederherstellen', title: 'Versionsverlauf' }))) return;
            rs.disabled = true; rs.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Wird wiederhergestellt …';
            try {
                if (c.dirty()) await c.save();
                const b = new Uint8Array(await (await JMOS_FILES.versionBlob(rs.dataset.rs)).arrayBuffer());
                await JMOS_FILES.snapshot(c.doc.key, true);
                await JMOS_FILES.saveText(c.doc.key, b);
                d.close(); await c.reload();
                flash('Älterer Stand wiederhergestellt');
            } catch (x) { uiAlert('Wiederherstellen fehlgeschlagen: ' + x.message); draw(); }
        });
    }

    // ---------- Eigene Vorlagen ----------
    function tplHtml(ext) {
        const list = window.JMOS_FILES && JMOS_FILES.templates ? JMOS_FILES.templates(ext) : [];
        return `<h3>Eigene Vorlagen</h3>${list.length ? `<div class="wr-tpls of-utpls">${list.map(t => `<div class="of-ut"><button type="button" class="wr-tpl" data-utpl="${esc(t.id)}"><span class="wr-tpi of-tpi"><i class="fa-solid fa-bookmark"></i></span><b>${esc(t.name.replace(/\.\w+$/, ''))}</b></button><button type="button" class="of-utx" data-utdel="${esc(t.id)}" title="Vorlage löschen" aria-label="Vorlage löschen"><i class="fa-solid fa-xmark"></i></button></div>`).join('')}</div>`
            : '<p class="wr-none">Noch keine eigenen Vorlagen. Öffne ein Dokument, das du öfter brauchst, und wähle Datei → „Als Vorlage speichern“.</p>'}`;
    }
    async function saveTemplate(name, ext, bytes) {
        if (!window.JMOS_FILES || !can(U, 'dokumente')) return uiAlert('Für eigene Vorlagen brauchst du die Berechtigung „Dokumente“.');
        const v = await ask('Als Vorlage speichern', name.replace(/\.\w+$/, ''), 'Speichern'); if (!v) return;
        try { await JMOS_FILES.saveTemplate(v.replace(/[\\/:*?"<>|]+/g, '_') + '.' + ext, await bytes()); flash(`Vorlage „${v}“ gespeichert – zu finden unter Datei → Neu`); }
        catch (x) { uiAlert('Vorlage konnte nicht gespeichert werden: ' + x.message); }
    }
    // Klicks auf eigene Vorlagen im Datei-Menü. c = { back, rerender(), use(id) }
    function tplClicks(c) {
        c.back.addEventListener('click', async ev => {
            const u = ev.target.closest('[data-utpl]'), x = ev.target.closest('[data-utdel]');
            if (!u && !x) return; ev.stopPropagation();
            if (x) { if (!(await uiConfirm('Diese Vorlage löschen?', { danger: true, ok: 'Löschen' }))) return; try { await JMOS_FILES.deleteTemplate(x.dataset.utdel); setTimeout(c.rerender, 300); } catch (er) { uiAlert(er.message); } return; }
            c.use(u.dataset.utpl);
        }, true);
    }
    const templateBytes = async id => new Uint8Array(await (await JMOS_FILES.templateBlob(id)).arrayBuffer());

    // ---------- Diagramm aus einer Tabelle übernehmen (für Writer und Präsentation) ----------
    async function pickChart() {
        const files = window.JMOS_FILES ? JMOS_FILES.sheetFiles().filter(f => /\.xlsx$/i.test(f.name)).sort((a, b) => (b.date || 0) - (a.date || 0)) : [];
        if (!files.length) { uiAlert('In deinen Dokumenten gibt es noch keine Tabelle (.xlsx). Lege in „Tabellen“ ein Diagramm an (Einfügen → Diagramm) und speichere die Mappe.'); return null; }
        return new Promise(res => {
            const d = dialog(`<div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-chart-column"></i></span><span>Diagramm aus Tabelle</span></div>
                <div class="of-cols"><div class="of-list of-files">${files.map(f => `<button type="button" class="of-row" data-f="${esc(f.key)}"><i class="fa-solid fa-file-excel" style="color:#34d399"></i><span><b>${esc(f.name)}</b><small>${f.date ? new Date(f.date).toLocaleDateString('de-DE') : ''}</small></span></button>`).join('')}</div>
                <div class="of-charts"><p class="of-none">Wähle links eine Tabelle.</p></div></div><div class="uidlg-a"><button type="button" data-of-x>Abbrechen</button></div>`, true);
            let charts = [];
            d.el.querySelector('[data-of-x]').addEventListener('click', () => res(null));
            d.el.addEventListener('click', async ev => {
                const f = ev.target.closest('[data-f]'), ch = ev.target.closest('[data-ch]'), box = d.el.querySelector('.of-charts');
                if (f) { d.el.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('on', b === f)); box.innerHTML = '<p class="of-none"><i class="fa-solid fa-spinner fa-spin"></i> Wird gelesen …</p>';
                    try { await JMOS_LAZY.script('sheetcore.js'); const { blob } = await JMOS_FILES.blobOf(f.dataset.f), b = await JMSHEET.readXlsx(await blob.arrayBuffer());
                        charts = []; b.sheets.forEach(s => (s.charts || []).forEach(c => { const m = c.src ? JMCHART.data(c, (r, cc) => { const x = s.cells.get(r + ',' + cc); return x ? (x.f ? x.cv : x.v) : null; }) : { type: c.type, title: c.title, cats: (c.cache || {}).cats || [], series: (c.cache || {}).series || [] }; charts.push({ sheet: s.name, m, w: c.w, h: c.h }); }));
                        box.innerHTML = charts.length ? charts.map((c, i) => `<button type="button" class="of-chart" data-ch="${i}" title="Einfügen">${JMCHART.svg(c.m, c.w, c.h)}<small>${esc(c.m.title || 'Diagramm ' + (i + 1))} · ${esc(c.sheet)}</small></button>`).join('') : '<p class="of-none">In dieser Tabelle ist kein Diagramm. Öffne sie in „Tabellen“ und wähle Einfügen → Diagramm.</p>';
                    } catch (x) { box.innerHTML = `<p class="of-none">${esc(x.message)}</p>`; } return; }
                if (ch) { const c = charts[+ch.dataset.ch]; try { const blob = await JMCHART.png(c.m, c.w, c.h); d.close(); res(new File([blob], (c.m.title || 'Diagramm').replace(/[\\/:*?"<>|]+/g, '_') + '.png', { type: 'image/png' })); } catch (x) { uiAlert(x.message); } }
            });
        });
    }

    // ---------- Datenquellen für den Serienbrief: Tabellen (.xlsx/.csv) und – falls vorhanden – die Kontakte ----------
    function sources() {
        const out = [];
        if (window.JMOS_CONTACTS && JMOS_CONTACTS.records) { const a = JMOS_CONTACTS.all(); if (a.length) { out.push({ id: 'contacts', name: `Alle Kontakte (${a.length})`, icon: 'fa-address-book', c: '#a78bfa' });
            JMOS_CONTACTS.cats().forEach(k => { const n = a.filter(c => c.kat === k).length; if (n) out.push({ id: 'contacts:' + k, name: `Kontakte – ${k} (${n})`, icon: 'fa-address-book', c: '#a78bfa' }); }); } }
        (window.JMOS_FILES ? JMOS_FILES.sheetFiles() : []).sort((a, b) => (b.date || 0) - (a.date || 0)).forEach(f => out.push({ id: f.key, name: f.name, icon: /\.csv$/i.test(f.name) ? 'fa-file-csv' : 'fa-file-excel', c: '#34d399' }));
        return out;
    }
    // → { fields: [...], rows: [{Feld: Wert}] }
    async function records(id) {
        if (id === 'contacts' || id.startsWith('contacts:')) return JMOS_CONTACTS.records(id.slice(9));
        await JMOS_LAZY.script('sheetcore.js');
        const { blob, name } = await JMOS_FILES.blobOf(id), J = JMSHEET;
        const b = /\.csv$/i.test(name) ? J.readCsv(await blob.text()) : await J.readXlsx(await blob.arrayBuffer()), sh = b.sheets[0];
        const val = (r, c) => { const x = sh.cells.get(r + ',' + c); if (!x) return ''; const v = x.f ? x.cv : x.v; if (v == null || v === '') return ''; return typeof v === 'number' ? J.fmtVal(v, x.s || {}) : String(v); };
        let maxC = -1, maxR = -1; sh.cells.forEach((x, k) => { const [r, c] = k.split(',').map(Number); if (r > maxR) maxR = r; if (r === 0 && c > maxC && val(r, c)) maxC = c; });
        const fields = []; for (let c = 0; c <= maxC; c++) fields.push(val(0, c) || J.colS(c));
        const rows = []; for (let r = 1; r <= maxR; r++) { const o = {}; let any = false; fields.forEach((f, c) => { o[f] = val(r, c); if (o[f]) any = true; }); if (any) rows.push(o); }
        return { fields, rows };
    }

    window.JMOFFICE = {
        init(api, user) { API = api; U = user; },
        opt, setOpt, saveOpts, autosave, versions, tplHtml, saveTemplate, tplClicks, templateBytes, pickChart, sources, records, dialog, esc, when, flash,
    };
})();
