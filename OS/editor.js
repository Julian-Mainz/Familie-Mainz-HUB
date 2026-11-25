// OS/editor.js – Texteditor für J.Mainz OS (wie der Windows-Editor): .txt, .md, .json, .log und .csv aus dem Explorer öffnen,
// bearbeiten und zurückspeichern. Mehrere Dateien als Tabs, Suchen & Ersetzen, Zeilenumbruch, Schriftgröße, Markdown-Vorschau.
// Ungespeicherte Änderungen bleiben in diesem Browser erhalten (auch nach Neuladen) und werden beim Schließen abgefragt.
(function () {
    'use strict';
    let API, U, e, win = null, body = null;
    let tabs = [], act = 0, seq = 0;
    const LKEY = () => 'jmos-ed-' + U.uid;
    const S = () => API.state();
    const isMd = n => /\.md$/i.test(n || '');
    const dirty = t => t.text !== t.saved;
    const okFiles = () => !!window.JMOS_FILES && can(U, 'dokumente');

    // ---------- Merken (nur dieser Browser) ----------
    function persist() {
        try {
            const d = tabs.map(t => ({ key: t.key || '', name: t.name, folder: t.folder || '', draft: dirty(t) || !t.key ? t.text : null, saved: dirty(t) && t.key ? t.saved : null }));
            const js = JSON.stringify({ act, tabs: d }); if (js.length < 1500000) localStorage.setItem(LKEY(), js);
        } catch (x) {}
    }
    function restore() {
        let d = null; try { d = JSON.parse(localStorage.getItem(LKEY()) || 'null'); } catch (x) {}
        if (!d || !Array.isArray(d.tabs) || !d.tabs.length) return false;
        tabs = d.tabs.map(t => ({ id: ++seq, key: t.key || null, name: t.name || 'Unbenannt.txt', folder: t.folder || '', text: t.draft ?? '', saved: t.draft != null && t.saved != null ? t.saved : (t.draft ?? ''), loading: t.draft == null && !!t.key, sel: [0, 0], top: 0 }));
        act = Math.min(tabs.length - 1, Math.max(0, d.act | 0));
        tabs.filter(t => t.loading).forEach(load);
        return true;
    }
    async function load(t) {
        t.loading = true; t.err = '';
        try { const { blob, name } = await JMOS_FILES.blobOf(t.key); const txt = await blob.text(); if (!tabs.includes(t)) return; t.name = name; t.text = t.saved = txt; }
        catch (x) { t.err = x.message || 'Datei nicht lesbar.'; }
        t.loading = false; if (tabs[act] === t) show(); else paintTabs();
    }

    // ---------- Öffnen von außen ----------
    function open(key, o = {}) {
        if (!okFiles()) return;
        API.openApp('editor', { params: { open: key, name: o.name } });
    }
    function addFile(key, name) {
        const ex = tabs.findIndex(t => t.key === key); if (ex >= 0) { pick(ex); return; }
        const cur = tabs[act];
        const t = { id: ++seq, key, name: name || (JMOS_FILES.item(key) || {}).name || 'Datei', folder: (JMOS_FILES.item(key) || {}).folder || '', text: '', saved: '', loading: true, sel: [0, 0], top: 0 };
        if (cur && !cur.key && !cur.text && tabs.length === 1) tabs = [t]; else tabs.push(t);          // leeren „Unbenannt“-Tab ersetzen
        act = tabs.indexOf(t); show(); load(t); const ta = $('.ed-ta'); ta && setTimeout(() => ta.focus(), 0);
    }
    function newTab(text = '', name = '') {
        let n = name || 'Unbenannt.txt', k = 1; while (tabs.some(t => t.name === n)) n = `Unbenannt (${++k}).txt`;
        tabs.push({ id: ++seq, key: null, name: n, folder: '', text, saved: name ? '' : text, sel: [0, 0], top: 0 }); act = tabs.length - 1; show(); const ta = $('.ed-ta'); ta && setTimeout(() => ta.focus(), 0);
    }

    // ---------- Fenster ----------
    function ui(b, w) {
        win = w; body = b;
        b.innerHTML = `<div class="ed">
            <div class="ed-tabs" role="tablist"></div>
            <div class="ed-bar">
                <button type="button" data-e="new" title="Neuer Tab"><i class="fa-solid fa-plus"></i><span>Neu</span></button>
                <button type="button" data-e="open" title="Öffnen (Strg+O)"><i class="fa-solid fa-folder-open"></i><span>Öffnen</span></button>
                <button type="button" data-e="save" title="Speichern (Strg+S)"><i class="fa-solid fa-floppy-disk"></i><span>Speichern</span></button>
                <button type="button" data-e="saveas" title="Speichern unter (Strg+Umschalt+S)"><i class="fa-solid fa-file-export"></i><span>Speichern unter</span></button>
                <i class="ed-sep"></i>
                <button type="button" data-e="find" title="Suchen und Ersetzen (Strg+F)"><i class="fa-solid fa-magnifying-glass"></i><span>Suchen</span></button>
                <button type="button" data-e="wrap" title="Zeilenumbruch"><i class="fa-solid fa-paragraph"></i><span>Umbruch</span></button>
                <button type="button" data-e="md" title="Markdown-Vorschau"><i class="fa-solid fa-eye"></i><span>Vorschau</span></button>
                <span class="ed-fill"></span>
                <button type="button" data-e="small" title="Kleiner (Strg+−)" aria-label="Schrift kleiner"><i class="fa-solid fa-minus"></i></button><span class="ed-fs"></span><button type="button" data-e="big" title="Größer (Strg++)" aria-label="Schrift größer"><i class="fa-solid fa-plus"></i></button>
                <button type="button" data-e="dl" title="Herunterladen"><i class="fa-solid fa-download"></i></button>
            </div>
            <form class="ed-find" hidden>
                <input class="ed-q" placeholder="Suchen" aria-label="Suchen"><input class="ed-r" placeholder="Ersetzen durch" aria-label="Ersetzen durch">
                <button type="button" data-f="prev" title="Vorheriger Treffer (Umschalt+Enter)"><i class="fa-solid fa-arrow-up"></i></button><button type="submit" data-f="next" title="Nächster Treffer (Enter)"><i class="fa-solid fa-arrow-down"></i></button>
                <label title="Groß-/Kleinschreibung beachten"><input type="checkbox" class="ed-cs">Aa</label>
                <button type="button" data-f="one">Ersetzen</button><button type="button" data-f="all">Alle ersetzen</button><span class="ed-hits"></span>
                <button type="button" data-f="x" title="Schließen (Esc)" aria-label="Suche schließen"><i class="fa-solid fa-xmark"></i></button>
            </form>
            <div class="ed-main"><textarea class="ed-ta" spellcheck="false" aria-label="Text"></textarea><div class="ed-md" hidden></div><div class="ed-msg" hidden></div></div>
            <div class="ed-st"><span class="ed-pos"></span><span class="ed-cnt"></span><span class="ed-enc">UTF-8</span><span class="ed-sv"></span></div>
            <input type="file" hidden class="ed-file" accept=".txt,.md,.json,.log,.csv,text/*">
            <div class="ed-pick" hidden></div></div>`;
        const q = s => b.querySelector(s), ta = q('.ed-ta');
        if (!tabs.length && !restore()) newTab();
        if (w.params && w.params.open) addFile(w.params.open, w.params.name);
        w.onParams = p => { if (p && p.open) addFile(p.open, p.name); };
        w.beforeClose = () => { const d = tabs.filter(dirty); return d.length ? `${d.length === 1 ? `„${d[0].name}“ hat` : `${d.length} Dateien haben`} ungespeicherte Änderungen. Trotzdem schließen?` : ''; };
        w.onClose = () => { tabs = []; act = 0; try { localStorage.removeItem(LKEY()); } catch (x) {} win = body = null; };
        let pt = 0;
        ta.addEventListener('input', () => { const t = tabs[act]; if (!t || t.loading) return; t.text = ta.value; paintTabs(); status(); mdPaint(); clearTimeout(pt); pt = setTimeout(persist, 500); });
        ['keyup', 'click', 'select'].forEach(ev => ta.addEventListener(ev, status));
        ta.addEventListener('keydown', ev => {
            if (ev.key === 'Tab' && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); document.execCommand('insertText', false, '\t'); }
        });
        b.addEventListener('keydown', ev => {
            const k = ev.key.toLowerCase(), c = ev.ctrlKey || ev.metaKey;
            if (c && k === 's') { ev.preventDefault(); ev.stopPropagation(); ev.shiftKey ? saveAs() : save(); }
            else if (c && k === 'o') { ev.preventDefault(); ev.stopPropagation(); pickOpen(); }
            else if (c && (k === 'f' || k === 'h')) { ev.preventDefault(); ev.stopPropagation(); findOpen(k === 'h'); }
            else if (c && (k === '+' || k === '=')) { ev.preventDefault(); font(1); }
            else if (c && k === '-') { ev.preventDefault(); font(-1); }
            else if (k === 'escape' && !q('.ed-find').hidden) { ev.stopPropagation(); findClose(); }
            else if (k === 'escape' && !q('.ed-pick').hidden) { ev.stopPropagation(); q('.ed-pick').hidden = true; }
        });
        b.addEventListener('click', ev => {
            const a = ev.target.closest('[data-e]'); if (a) return ({ new: () => newTab(), open: pickOpen, save, saveas: saveAs, find: () => findOpen(false), wrap: () => { S().edWrap = !wrapOn(); API.save(); look(); },
                md: () => { S().edMd = !S().edMd; API.save(); look(); mdPaint(); }, small: () => font(-1), big: () => font(1), dl: download })[a.dataset.e]();
            const tb = ev.target.closest('[data-t]'); if (tb) { const i = tabs.findIndex(t => t.id === +tb.dataset.t); if (ev.target.closest('.ed-tx')) return closeTab(i); return pick(i); }
        });
        q('.ed-tabs').addEventListener('auxclick', ev => { const tb = ev.target.closest('[data-t]'); if (tb && ev.button === 1) { ev.preventDefault(); closeTab(tabs.findIndex(t => t.id === +tb.dataset.t)); } });
        q('.ed-tabs').addEventListener('dblclick', ev => { if (ev.target === q('.ed-tabs')) newTab(); });
        q('.ed-file').addEventListener('change', async ev => { const f = ev.target.files[0]; ev.target.value = ''; if (!f) return; if (f.size > 3 * 1024 * 1024) return uiAlert('Die Datei ist größer als 3 MB.'); newTab(await f.text(), f.name); });
        // Suchen & Ersetzen
        const fq = q('.ed-q'), fr = q('.ed-r');
        q('.ed-find').addEventListener('submit', ev => { ev.preventDefault(); findStep(1); });
        q('.ed-find').addEventListener('click', ev => { const f = ev.target.closest('[data-f]'); if (!f || f.type === 'submit') return; ({ prev: () => findStep(-1), one: replaceOne, all: replaceAll, x: findClose })[f.dataset.f](); });
        fq.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.shiftKey) { ev.preventDefault(); findStep(-1); } });
        fq.addEventListener('input', hits); q('.ed-cs').addEventListener('change', hits);
        fr.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); replaceOne(); } });
        look(); show();
        setTimeout(() => ta.focus(), 60);
    }
    const $ = s => body && body.querySelector(s);
    const wrapOn = () => S().edWrap !== false;
    const fontPx = () => Math.max(10, Math.min(28, S().edFont || 14));
    function font(d) { S().edFont = fontPx() + d; API.save(); look(); }
    function look() {
        if (!body) return; const ta = $('.ed-ta');
        ta.style.fontSize = fontPx() + 'px'; ta.classList.toggle('nowrap', !wrapOn()); $('.ed-fs').textContent = fontPx() + ' px';
        $('[data-e="wrap"]').classList.toggle('on', wrapOn());
        const t = tabs[act], md = !!t && isMd(t.name); $('[data-e="md"]').hidden = !md; $('[data-e="md"]').classList.toggle('on', md && !!S().edMd);
        $('.ed-md').hidden = !(md && S().edMd); $('.ed-main').classList.toggle('split', md && !!S().edMd);
    }
    function paintTabs() {
        if (!body) return;
        $('.ed-tabs').innerHTML = tabs.map((t, i) => `<div class="ed-tab${i === act ? ' on' : ''}${dirty(t) ? ' dirty' : ''}" role="tab" aria-selected="${i === act}" data-t="${t.id}" title="${e(t.name)}${t.key ? '' : ' (noch nicht gespeichert)'}"><i class="fa-solid ${isMd(t.name) ? 'fa-file-code' : 'fa-file-lines'}"></i><span>${e(t.name)}</span><b class="ed-dot" aria-label="ungespeichert"></b><button type="button" class="ed-tx" aria-label="Tab schließen" title="Schließen"><i class="fa-solid fa-xmark"></i></button></div>`).join('')
            + '<button type="button" class="ed-add" data-e="new" title="Neuer Tab" aria-label="Neuer Tab"><i class="fa-solid fa-plus"></i></button>';
        const t = tabs[act]; if (t && win) { win.el.querySelector('.wt-title').textContent = (dirty(t) ? '*' : '') + t.name + ' – Texteditor'; API.renderTasks(); }
    }
    function show() {
        if (!body) return; const ta = $('.ed-ta'), t = tabs[act], msg = $('.ed-msg');
        paintTabs(); look();
        if (!t) return;
        msg.hidden = !(t.loading || t.err); ta.hidden = !msg.hidden;
        if (t.loading) msg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Wird geladen …';
        else if (t.err) msg.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i><b>Datei nicht lesbar</b><span>${e(t.err)}</span>`;
        if (ta.value !== t.text) ta.value = t.text;
        ta.readOnly = !!t.loading;
        try { ta.setSelectionRange(t.sel[0], t.sel[1]); } catch (x) {} ta.scrollTop = t.top || 0;
        status(); mdPaint(); hits(); persist();
    }
    function pick(i) {
        if (i < 0 || i >= tabs.length) return; const ta = $('.ed-ta'), t = tabs[act];
        if (t && ta) { t.sel = [ta.selectionStart, ta.selectionEnd]; t.top = ta.scrollTop; }
        act = i; show(); ta && ta.focus();
    }
    async function closeTab(i) {
        const t = tabs[i]; if (!t) return;
        if (dirty(t) && !(await uiConfirm(`„${t.name}“ hat ungespeicherte Änderungen. Tab trotzdem schließen?`, { danger: true, ok: 'Ohne Speichern schließen' }))) return;
        tabs.splice(i, 1);
        if (!tabs.length) { persist(); return win && API.closeWin(win, true); }
        if (act >= tabs.length) act = tabs.length - 1; else if (i < act) act--;
        show();
    }
    function status() {
        if (!body) return; const ta = $('.ed-ta'), t = tabs[act]; if (!t) return;
        const pre = ta.value.slice(0, ta.selectionStart), line = pre.split('\n').length, col = pre.length - pre.lastIndexOf('\n'), selN = ta.selectionEnd - ta.selectionStart;
        const words = (t.text.match(/\S+/g) || []).length;
        $('.ed-pos').textContent = `Zeile ${line}, Spalte ${col}${selN ? ` (${selN} markiert)` : ''}`;
        $('.ed-cnt').textContent = `${t.text.length.toLocaleString('de-DE')} Zeichen · ${words.toLocaleString('de-DE')} Wörter`;
        $('.ed-sv').innerHTML = t.saving ? '<i class="fa-solid fa-spinner fa-spin"></i>Wird gespeichert …' : !t.key ? '<i class="fa-solid fa-circle-info"></i>Noch nicht gespeichert' : dirty(t) ? '<i class="fa-solid fa-pen"></i>Geändert' : '<i class="fa-solid fa-check"></i>Gespeichert';
    }

    // ---------- Speichern ----------
    async function save() {
        const t = tabs[act]; if (!t || t.loading || t.saving) return;
        if (!t.key) return saveAs();
        if (!okFiles()) return uiAlert('Zum Speichern brauchst du die Berechtigung „Dokumente“.');
        t.saving = true; status();
        const txt = t.text;
        try { await JMOS_FILES.saveText(t.key, txt); t.saved = txt; }
        catch (x) { uiAlert('Speichern fehlgeschlagen: ' + x.message); }
        t.saving = false; paintTabs(); status(); persist();
    }
    async function saveAs() {
        const t = tabs[act]; if (!t || t.loading) return;
        if (!okFiles()) return uiAlert('Zum Speichern brauchst du die Berechtigung „Dokumente“.');
        const r = await askSave(t.name, t.folder); if (!r) return;
        t.saving = true; status();
        try { const key = await JMOS_FILES.createText(r.name, t.text, r.folder); t.key = key; t.name = r.name; t.folder = r.folder; t.saved = t.text; }
        catch (x) { uiAlert('Speichern fehlgeschlagen: ' + x.message); }
        t.saving = false; show();
    }
    function askSave(name, folder) {
        return new Promise(res => {
            const fs = JMOS_FILES.folders(), bg = document.createElement('div'); bg.className = 'uidlg-bg';
            bg.innerHTML = `<form class="uidlg" style="max-width:420px"><div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-floppy-disk"></i></span><span>Speichern unter</span></div>
                <label class="ed-dl">Dateiname<input class="xp-ask" maxlength="120" value="${e(name)}"></label>
                <label class="ed-dl">Ordner<select class="sh-sel">${[['', 'Eigene Dateien'], ...fs.map(f => [f.id, f.name])].map(([id, n]) => `<option value="${e(id)}" ${id === (folder || '') ? 'selected' : ''}>${e(n)}</option>`).join('')}</select></label>
                <div class="uidlg-a"><button type="button" data-r="0">Abbrechen</button><button type="submit" class="ok">Speichern</button></div></form>`;
            const done = v => { bg.remove(); res(v); };
            bg.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); let n = bg.querySelector('input').value.trim().replace(/[\\/:*?"<>|]+/g, '_'); if (!n) return; if (!/\.(txt|md|json|log|csv)$/i.test(n)) n += '.txt'; done({ name: n, folder: bg.querySelector('select').value }); });
            bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-r="0"]')) done(null); });
            bg.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); done(null); } });
            document.body.appendChild(bg); const i = bg.querySelector('input'); i.focus(); const dot = i.value.lastIndexOf('.'); i.setSelectionRange(0, dot > 0 ? dot : i.value.length);
        });
    }
    function download() {
        const t = tabs[act]; if (!t) return;
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([t.text], { type: 'text/plain;charset=utf-8' })), download: t.name });
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }

    // ---------- Öffnen-Auswahl ----------
    function pickOpen() {
        const p = $('.ed-pick'); if (!p) return;
        if (!p.hidden) { p.hidden = true; return; }
        const fs = okFiles() ? JMOS_FILES.textFiles() : [], fold = Object.fromEntries((okFiles() ? JMOS_FILES.folders() : []).map(f => [f.id, f.name]));
        const row = it => `<button type="button" class="ed-pr" data-k="${e(it.key)}"><i class="fa-solid ${isMd(it.name) ? 'fa-file-code' : 'fa-file-lines'}"></i><span>${e(it.name)}</span><small>${e(it.folder ? fold[it.folder] || '' : 'Eigene Dateien')} · ${it.date ? new Date(it.date).toLocaleDateString('de-DE') : ''}</small></button>`;
        const paint = s => { const n = s.toLowerCase(), l = fs.filter(it => !n || it.name.toLowerCase().includes(n)).sort((a, b) => (b.date || 0) - (a.date || 0));
            p.querySelector('.ed-pl').innerHTML = l.map(row).join('') || `<div class="ed-pe">${fs.length ? 'Nichts gefunden' : 'Noch keine Textdateien in deinen Dokumenten'}</div>`; };
        p.innerHTML = `<div class="ed-pc"><div class="ed-ph"><b>Datei öffnen</b><button type="button" data-p="x" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button></div>
            <input class="ed-ps" placeholder="Textdateien durchsuchen" aria-label="Textdateien durchsuchen"><div class="ed-pl"></div>
            <button type="button" class="btn" data-p="pc"><i class="fa-solid fa-laptop"></i>Vom Computer öffnen</button></div>`;
        p.hidden = false; paint('');
        const s = p.querySelector('.ed-ps'); s.focus(); s.addEventListener('input', () => paint(s.value.trim()));
        s.addEventListener('keydown', ev => { if (ev.key === 'Enter') { const f = p.querySelector('.ed-pr'); if (f) f.click(); } });
        p.onclick = ev => { if (ev.target === p || ev.target.closest('[data-p="x"]')) { p.hidden = true; return; }
            if (ev.target.closest('[data-p="pc"]')) { p.hidden = true; $('.ed-file').click(); return; }
            const r = ev.target.closest('[data-k]'); if (r) { p.hidden = true; addFile(r.dataset.k); } };
    }

    // ---------- Suchen & Ersetzen ----------
    function findOpen(rep) {
        const f = $('.ed-find'), ta = $('.ed-ta'); f.hidden = false; f.classList.toggle('rep', true);
        const s = ta.value.slice(ta.selectionStart, ta.selectionEnd); if (s && !s.includes('\n')) $('.ed-q').value = s;
        (rep && $('.ed-q').value ? $('.ed-r') : $('.ed-q')).focus(); $('.ed-q').select(); hits();
    }
    function findClose() { $('.ed-find').hidden = true; $('.ed-ta').focus(); }
    const needle = () => { const v = $('.ed-q') ? $('.ed-q').value : ''; return v ? ($('.ed-cs').checked ? v : v.toLowerCase()) : ''; };
    const hay = () => { const v = $('.ed-ta').value; return $('.ed-cs').checked ? v : v.toLowerCase(); };
    function hits() {
        if (!body || $('.ed-find').hidden) return; const n = needle(); if (!n) { $('.ed-hits').textContent = ''; return; }
        let c = 0, i = -1; const h = hay(); while ((i = h.indexOf(n, i + 1)) >= 0) c++;
        $('.ed-hits').textContent = c ? `${c} Treffer` : 'Kein Treffer'; $('.ed-hits').classList.toggle('bad', !c);
    }
    function findStep(d) {
        const n = needle(), ta = $('.ed-ta'); if (!n) return; const h = hay();
        let i = d > 0 ? h.indexOf(n, ta.selectionEnd) : h.lastIndexOf(n, Math.max(0, ta.selectionStart - 1));
        if (i < 0) i = d > 0 ? h.indexOf(n) : h.lastIndexOf(n);
        if (i < 0) return hits();
        ta.focus(); ta.setSelectionRange(i, i + n.length);
        const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20, line = ta.value.slice(0, i).split('\n').length;
        if (!wrapOn()) ta.scrollTop = Math.max(0, (line - 4) * lh); else { ta.blur(); ta.focus(); }
        status(); $('.ed-q').focus();
    }
    function replaceOne() {
        const n = needle(), ta = $('.ed-ta'); if (!n) return;
        const cur = ($('.ed-cs').checked ? ta.value : ta.value.toLowerCase()).slice(ta.selectionStart, ta.selectionEnd);
        if (cur === n) { ta.focus(); document.execCommand('insertText', false, $('.ed-r').value); }
        findStep(1); hits();
    }
    function replaceAll() {
        const v = $('.ed-q').value, r = $('.ed-r').value, ta = $('.ed-ta'); if (!v) return;
        const re = new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $('.ed-cs').checked ? 'g' : 'gi'); const c = (ta.value.match(re) || []).length; if (!c) return hits();
        ta.focus(); ta.select(); document.execCommand('insertText', false, ta.value.replace(re, () => r));          // mit execCommand bleibt Strg+Z möglich
        const t = tabs[act]; if (t && ta.value !== t.text) { t.text = ta.value; paintTabs(); status(); mdPaint(); persist(); }
        $('.ed-hits').textContent = `${c} ersetzt`; $('.ed-hits').classList.remove('bad');
    }

    // ---------- Markdown-Vorschau (einfach, ohne HTML aus dem Text) ----------
    function md(src) {
        const inl = s => e(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>').replace(/~~([^~]+)~~/g, '<s>$1</s>')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        const out = []; let list = null, code = null, para = [];
        const flush = () => { if (para.length) { out.push(`<p>${para.map(inl).join('<br>')}</p>`); para = []; } if (list) { out.push(`</${list}>`); list = null; } };
        for (const ln of src.split('\n')) {
            if (code !== null) { if (/^```/.test(ln)) { out.push(`<pre><code>${e(code)}</code></pre>`); code = null; } else code += (code ? '\n' : '') + ln; continue; }
            if (/^```/.test(ln)) { flush(); code = ''; continue; }
            let m;
            if ((m = /^(#{1,6})\s+(.*)$/.exec(ln))) { flush(); out.push(`<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`); }
            else if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(ln)) { flush(); out.push('<hr>'); }
            else if ((m = /^\s*[-*+]\s+(\[( |x)\]\s+)?(.*)$/i.exec(ln))) { if (para.length) flush(); if (list !== 'ul') { flush(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${m[1] ? `<input type="checkbox" disabled ${m[2].toLowerCase() === 'x' ? 'checked' : ''}> ` : ''}${inl(m[3])}</li>`); }
            else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(ln))) { if (para.length) flush(); if (list !== 'ol') { flush(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inl(m[1])}</li>`); }
            else if ((m = /^>\s?(.*)$/.exec(ln))) { flush(); out.push(`<blockquote>${inl(m[1])}</blockquote>`); }
            else if (!ln.trim()) flush();
            else { if (list) flush(); para.push(ln); }
        }
        if (code !== null) out.push(`<pre><code>${e(code)}</code></pre>`);
        flush(); return out.join('');
    }
    function mdPaint() { if (!body || $('.ed-md').hidden) return; const t = tabs[act]; $('.ed-md').innerHTML = t ? md(t.text) || '<p class="ed-pe">Vorschau erscheint hier.</p>' : ''; }

    // Neues Textdokument auf dem Desktop
    async function newOnDesk() {
        if (!okFiles()) return;
        const taken = new Set(JMOS_FILES.textFiles().filter(x => !x.folder).map(x => x.name.toLowerCase()));
        let n = 'Neues Textdokument.txt', k = 1; while (taken.has(n.toLowerCase())) n = `Neues Textdokument (${++k}).txt`;
        try { const key = await JMOS_FILES.createText(n, '', ''); JMOS_FILES.toDesk(key); open(key, { name: n }); } catch (x) { uiAlert('Anlegen fehlgeschlagen: ' + x.message); }
    }

    window.JMOS_EDITOR = { open, newOnDesk, ok: () => !!U && okFiles() };
    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        apps: [{ id: 'editor', name: 'Texteditor', icon: 'fa-file-pen', c: '#38bdf8', native: 'editor', w: 900, h: 620 }],
        ui: { editor: ui },
        init(api, user) {
            API = api; U = user; e = api.esc;
            window.addEventListener('beforeunload', persist);
        },
    });
})();
