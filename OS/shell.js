// OS/shell.js – Fensterübersicht und -umschalter, Andock-Hilfe, Tastenkürzel, Sperrbildschirm, Personalisierung
// (Akzentfarbe, Symbolgröße, Taskleiste mittig, eigenes Hintergrundbild) und „Zuletzt geöffnet“ im Startmenü.
(function () {
    'use strict';
    let API, U, e, S;
    const $ = id => document.getElementById(id);
    const ACCENTS = { lila: ['#6366f1', '#8b5cf6', '#a78bfa', '139,92,246'], blau: ['#3b82f6', '#06b6d4', '#7dd3fc', '59,130,246'], gruen: ['#10b981', '#22d3ee', '#6ee7b7', '16,185,129'],
        pink: ['#ec4899', '#f43f5e', '#f9a8d4', '236,72,153'], orange: ['#f59e0b', '#ef4444', '#fcd34d', '245,158,11'], tuerkis: ['#14b8a6', '#0ea5e9', '#5eead4', '20,184,166'], rot: ['#ef4444', '#f97316', '#fca5a5', '239,68,68'], grau: ['#64748b', '#94a3b8', '#cbd5e1', '148,163,184'] };
    const ACC_NAMES = { lila: 'Lila', blau: 'Blau', gruen: 'Grün', pink: 'Pink', orange: 'Orange', tuerkis: 'Türkis', rot: 'Rot', grau: 'Grau' };

    // ---------- Personalisierung ----------
    function applyLook() {
        const a = ACCENTS[S.accent] || ACCENTS.lila, r = document.documentElement.style;
        r.setProperty('--acc-2', a[0]); r.setProperty('--acc', a[1]); r.setProperty('--acc-l', a[2]); r.setProperty('--acc-rgb', a[3]); r.setProperty('--grad', `linear-gradient(135deg, ${a[0]}, ${a[1]})`);
        document.documentElement.classList.toggle('bar-c', S.barPos === 'mitte');
    }
    let wallUrl = '';
    async function loadWall() {
        if (S.wall !== 'eigen') return;
        try { const d = await db.collection('users').doc(U.uid).collection('meta').doc('os').get(); setWallImg(d.exists ? d.data().wall : ''); } catch (x) { setWallImg(''); }
    }
    function setWallImg(data) {
        wallUrl = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data || '') ? data : '';
        document.querySelector('.wall-img').style.backgroundImage = wallUrl ? `url("${wallUrl}")` : '';
    }
    async function uploadWall(file) {
        if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return uiAlert('Bitte ein Bild (JPG, PNG, WebP) wählen.');
        const url = URL.createObjectURL(file);
        try {
            const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = url; });
            const k = Math.min(1, 1920 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            let q = .85, d = c.toDataURL('image/jpeg', q); while (d.length > 850000 && q > .4) { q -= .1; d = c.toDataURL('image/jpeg', q); }
            if (d.length > 880000) throw new Error('Das Bild ist auch verkleinert noch zu groß.');
            await db.collection('users').doc(U.uid).collection('meta').doc('os').set({ wall: d, updatedAt: TS() });
            S.wall = 'eigen'; document.documentElement.dataset.wall = 'eigen'; setWallImg(d); API.save();
        } catch (x) { uiAlert('Hintergrund konnte nicht gespeichert werden: ' + (x.code === 'permission-denied' ? 'Die Firestore-Regel für eigene Hintergründe fehlt noch.' : x.message)); }
        finally { URL.revokeObjectURL(url); }
    }
    // Zusätzliche Bereiche in den Einstellungen
    function settings(body) {
        const sec = document.createElement('section');
        sec.innerHTML = `<h3>Personalisierung</h3>
            <div class="set-row"><div><b>Eigenes Hintergrundbild</b><small>Ein Foto als Hintergrund, gespeichert in deinem Profil (auf allen Geräten).</small></div><label class="btn"><i class="fa-solid fa-arrow-up-from-bracket"></i>Bild wählen<input type="file" accept="image/*" hidden class="sh-wall"></label></div>
            <div class="set-row"><div><b>Akzentfarbe</b><small>Farbe für Knöpfe, Auswahl und aktive Fenster.</small></div><div class="sh-acc">${Object.keys(ACCENTS).map(k => `<button type="button" data-acc="${k}" title="${ACC_NAMES[k]}" class="${(S.accent || 'lila') === k ? 'on' : ''}" style="--a:${ACCENTS[k][0]};--b:${ACCENTS[k][1]}"></button>`).join('')}</div></div>
            <div class="set-row"><div><b>Symbolgröße</b><small>Größe der Desktop-Symbole.</small></div><div class="seg">${[['s', 'Klein'], ['m', 'Mittel'], ['l', 'Groß']].map(([k, n]) => `<button type="button" data-ics="${k}" class="${(S.iconSize || 'm') === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
            <div class="set-row"><div><b>Taskleiste</b><small>Startknopf und Apps links oder in der Mitte.</small></div><div class="seg">${[['links', 'Links'], ['mitte', 'Mitte']].map(([k, n]) => `<button type="button" data-bar="${k}" class="${(S.barPos || 'links') === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>`;
        const lock = document.createElement('section');
        lock.innerHTML = `<h3>Sperrbildschirm</h3>
            <div class="set-row"><div><b>Automatisch sperren</b><small>Nach so vielen Minuten ohne Maus und Tastatur.</small></div><select class="sh-sel sh-lockmin">${[[0, 'Nie'], [5, '5 Min.'], [10, '10 Min.'], [15, '15 Min.'], [30, '30 Min.'], [60, '1 Std.']].map(([v, n]) => `<option value="${v}" ${(+S.lockMin || 0) === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
            <div class="set-row"><div><b>PIN zum Entsperren</b><small>${S.lockPin ? 'Eine PIN ist festgelegt.' : 'Ohne PIN entsperrt ein Klick.'} Die PIN gilt nur für den Sperrbildschirm des OS.</small></div><button type="button" class="btn" data-b="pin"><i class="fa-solid fa-lock"></i>${S.lockPin ? 'Ändern' : 'Festlegen'}</button>${S.lockPin ? '<button type="button" class="btn" data-b="nopin">Entfernen</button>' : ''}</div>
            <div class="set-row"><div><b>Jetzt sperren</b><small>Tastenkürzel: Alt+L</small></div><button type="button" class="btn" data-b="lock"><i class="fa-solid fa-lock"></i>Sperren</button></div>
            <div class="set-row"><div><b>Tastenkürzel</b><small>Strg+Leertaste Suche · Alt+Q Fenster wechseln · Alt+Umschalt+Pfeile andocken · Alt+M minimieren · Alt+Umschalt+D Desktop · Alt+1…9 angeheftete Apps · Alt+W schließen · Alt+L sperren · Alt+A Schnellstart · Alt+V Zwischenablage · Alt+Bild auf/ab Desktop wechseln</small></div></div>`;
        const box = body.querySelector('.app-set'); box.insertBefore(lock, box.children[2] || null); box.insertBefore(sec, box.children[1] || null);
        // Hintergrund-Auswahl um "Eigenes Bild" ergänzen
        const walls = body.querySelector('.walls');
        if (walls) walls.insertAdjacentHTML('beforeend', `<button type="button" class="wall-o${S.wall === 'eigen' ? ' on' : ''}" data-w="eigen" ${wallUrl ? '' : 'disabled'}><i class="prev" style="background:${wallUrl ? `url('${wallUrl}') center / cover` : 'repeating-linear-gradient(45deg, #0f172a 0 10px, #1e293b 10px 20px)'}"></i><span>${wallUrl ? 'Eigenes Bild' : 'Eigenes Bild (noch keins)'}</span></button>`);
        box.addEventListener('click', async ev => {
            const a = ev.target.closest('[data-acc]'); if (a) { S.accent = a.dataset.acc; applyLook(); API.save(); body.querySelectorAll('[data-acc]').forEach(x => x.classList.toggle('on', x === a)); }
            const i = ev.target.closest('[data-ics]'); if (i) { S.iconSize = i.dataset.ics; S.icons = {}; API.renderIcons(); API.save(); body.querySelectorAll('[data-ics]').forEach(x => x.classList.toggle('on', x === i)); }
            const b = ev.target.closest('[data-bar]'); if (b) { S.barPos = b.dataset.bar; applyLook(); API.save(); body.querySelectorAll('[data-bar]').forEach(x => x.classList.toggle('on', x === b)); }
            const w = ev.target.closest('[data-w="eigen"]'); if (w) { S.wall = 'eigen'; document.documentElement.dataset.wall = 'eigen'; setWallImg(wallUrl); API.save(); }
            const k = ev.target.closest('[data-b]'); if (!k) return;
            if (k.dataset.b === 'lock') lockNow();
            if (k.dataset.b === 'pin') { const p = await askPin('Neue PIN (4–8 Ziffern)'); if (p) { S.lockPin = await hash(p); API.save(); uiAlert('PIN gespeichert. Ab jetzt brauchst du sie zum Entsperren.', { title: 'Sperrbildschirm' }); rebuild(); } }
            if (k.dataset.b === 'nopin') { delete S.lockPin; API.save(); rebuild(); }
        });
        body.querySelector('.sh-wall').addEventListener('change', async ev => { const f = ev.target.files[0]; ev.target.value = ''; if (f) { await uploadWall(f); rebuild(); } });
        body.querySelector('.sh-lockmin').addEventListener('change', ev => { S.lockMin = +ev.target.value; API.save(); });
        const rebuild = () => { const w = API.wins.find(x => x.app.id === 'einstellungen'); if (w) { const bd = w.el.querySelector('.wb'), top = bd.querySelector('.app-set').scrollTop; bd.innerHTML = ''; window.JMOS_NATIVE_UI.set(bd, w); bd.querySelector('.app-set').scrollTop = top; } };
    }
    function askPin(title) {
        return new Promise(res => {
            const bg = document.createElement('div'); bg.className = 'uidlg-bg';
            bg.innerHTML = `<form class="uidlg" style="max-width:360px"><div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-lock"></i></span><span>${e(title)}</span></div>
                <input class="xp-ask" type="password" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" autocomplete="new-password" required><div class="uidlg-a"><button type="button" data-r="0">Abbrechen</button><button type="submit" class="ok">Speichern</button></div></form>`;
            const done = v => { bg.remove(); res(v); };
            bg.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); const v = bg.querySelector('input').value; if (/^\d{4,8}$/.test(v)) done(v); });
            bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-r="0"]')) done(null); });
            document.body.appendChild(bg); bg.querySelector('input').focus();
        });
    }
    async function hash(pin) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('jmos|' + U.uid + '|' + pin)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

    // ---------- Sperrbildschirm ----------
    let locked = false, last = Date.now();
    function lockNow() {
        if (locked) return; locked = true; API.closePops(); if (window.JMOS_SOUND) JMOS_SOUND.play('lock');
        const el = document.createElement('div'); el.id = 'lock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Gesperrt');
        const name = [U.firstName, U.lastName].filter(Boolean).join(' ') || U.email;
        el.innerHTML = `<div class="lk-bg"></div><div class="lk-time"><b></b><span></span></div>
            <div class="lk-user"><span class="st-av">${typeof avatarInner === 'function' ? avatarInner({ ...U, name }) : e(name[0])}</span><b>${e(name)}</b>
            ${S.lockPin ? '<form class="lk-pin"><input type="password" inputmode="numeric" maxlength="8" placeholder="PIN" aria-label="PIN" autocomplete="off"><button type="submit" aria-label="Entsperren"><i class="fa-solid fa-arrow-right"></i></button></form><small class="lk-err"></small>' : '<button type="button" class="lk-go"><i class="fa-solid fa-lock-open"></i>Entsperren</button>'}</div>
            <small class="lk-hint">${S.lockPin ? 'PIN eingeben' : 'Klicken oder eine Taste drücken'}</small>`;
        document.body.appendChild(el); document.documentElement.classList.add('locked');
        const bgEl = el.querySelector('.lk-bg'), wall = document.querySelector('.wall-img'); if (wall && getComputedStyle(wall).backgroundImage !== 'none') bgEl.style.backgroundImage = getComputedStyle(wall).backgroundImage;
        const tick = () => { const d = new Date(); el.querySelector('.lk-time b').textContent = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); el.querySelector('.lk-time span').textContent = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }); };
        tick(); const id = setInterval(tick, 1000);
        const open = () => { if (window.JMOS_SOUND) JMOS_SOUND.play('unlock'); clearInterval(id); el.classList.add('out'); document.documentElement.classList.remove('locked'); setTimeout(() => el.remove(), 350); locked = false; last = Date.now(); };
        if (S.lockPin) {
            const f = el.querySelector('.lk-pin'), inp = f.querySelector('input'); setTimeout(() => inp.focus(), 50);
            f.addEventListener('submit', async ev => { ev.preventDefault(); if (await hash(inp.value) === S.lockPin) open(); else { inp.value = ''; el.querySelector('.lk-err').textContent = 'Falsche PIN'; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); } });
            el.addEventListener('click', () => inp.focus());
        } else {
            el.addEventListener('click', open); el.querySelector('.lk-go').focus();
            el.addEventListener('keydown', ev => { ev.preventDefault(); open(); });
        }
    }
    const active = () => { last = Date.now(); };
    function watchIdle() {
        ['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(t => document.addEventListener(t, active, { passive: true, capture: true }));
        (window.JMOS_EMBED_HOOKS = window.JMOS_EMBED_HOOKS || []).push(doc => ['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(t => doc.addEventListener(t, active, { passive: true, capture: true })));
        setInterval(() => { if (!locked && +S.lockMin > 0 && Date.now() - last > S.lockMin * 60000) lockNow(); }, 15000);
    }

    // ---------- Fensterübersicht und Umschalter (Alt+Q) ----------
    let tv = null, tvSel = 0;
    const list = () => API.wins.filter(w => !w.closing && API.onDesk(w)).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
    function card(w, i) { const a = w.app, t = w.el.querySelector('.wt-title').textContent;
        return `<div class="tv-c${i === tvSel ? ' on' : ''}${w.min ? ' mini' : ''}" data-i="${i}" role="button" tabindex="0" style="--c:${a.c || '#818cf8'}"><div class="tv-h"><span class="wt-ico${a.folder ? ' folder' : ''}" style="--c:${a.c || '#818cf8'}"><i class="fa-solid ${a.folder ? 'fa-folder' : a.icon}"></i></span><span>${e(t)}</span><button type="button" class="tv-x" data-x="${i}" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="tv-b">${API.tile(a)}<small>${w.min ? 'minimiert' : w.max ? 'Vollbild' : ''}</small></div></div>`; }
    function openTv(cycle) {
        const L = list(); if (!L.length && cycle) return;
        if (!tv) { tv = document.createElement('div'); tv.id = 'tv'; document.body.appendChild(tv); tvSel = cycle && L.length > 1 ? 1 : 0;
            tv.addEventListener('click', ev => { const x = ev.target.closest('[data-x]'); if (x) { API.closeWin(list()[+x.dataset.x]); setTimeout(() => tv && paintTv(), 200); return; } const c = ev.target.closest('[data-i]'); if (c) { tvSel = +c.dataset.i; pickTv(); } else if (ev.target.closest('.dk-bar')) return; else if (ev.target === tv || ev.target.closest('.tv-g') === null) closeTv(); }); }
        else if (cycle) tvSel = (tvSel + 1) % Math.max(1, L.length);
        paintTv();
    }
    function paintTv() { const L = list(); if (!tv) return; tv.innerHTML = `${window.JMOS_DESKBAR ? JMOS_DESKBAR() : ''}<div class="tv-t">${L.length ? 'Fenster wählen' : 'Keine offenen Fenster'}<small>${L.length ? 'Klicken · Alt+Q gedrückt halten und wiederholt drücken' : ''}</small></div><div class="tv-g">${L.map(card).join('')}</div>`; }
    function pickTv() { const w = list()[tvSel]; closeTv(); if (w) { if (w.min) API.toggleMin(w, false); API.focus(w); } }
    function closeTv() { if (tv) { tv.remove(); tv = null; } }

    // ---------- Andock-Hilfe: andere Hälfte füllen ----------
    function assist(win, s) {
        const opp = { l: 'r', r: 'l' }[s]; if (!opp) return;
        const others = list().filter(w => w !== win && !w.min); if (!others.length) return;
        document.getElementById('sa')?.remove();
        const r = API.snapRect(opp), el = document.createElement('div'); el.id = 'sa';
        Object.assign(el.style, { left: r[0] + 8 + 'px', top: r[1] + 8 + 'px', width: r[2] - 16 + 'px', height: r[3] - 16 + 'px' });
        el.innerHTML = `<div class="tv-t">Welches Fenster soll daneben?<small>Esc zum Abbrechen</small></div><div class="tv-g">${others.map((w, i) => card(w, i).replace(' on', '')).join('')}</div>`;
        document.body.appendChild(el);
        const off = () => { el.remove(); document.removeEventListener('pointerdown', out, true); document.removeEventListener('keydown', esc, true); };
        const out = ev => { if (!el.contains(ev.target)) off(); }, esc = ev => { if (ev.key === 'Escape') off(); };
        el.addEventListener('click', ev => { const c = ev.target.closest('[data-i]'); if (!c || ev.target.closest('[data-x]')) return; const w = others[+c.dataset.i]; off(); API.focus(w); API.snapTo(w, opp); });
        setTimeout(() => { document.addEventListener('pointerdown', out, true); document.addEventListener('keydown', esc, true); }, 50);
    }

    // ---------- Tastenkürzel ----------
    function keys(ev) {
        const t = API.topWin();
        if (ev.altKey && !ev.shiftKey && (ev.key === 'q' || ev.key === 'Q')) { openTv(true); return true; }
        if (ev.altKey && !ev.shiftKey && (ev.key === 'l' || ev.key === 'L')) { lockNow(); return true; }
        if (ev.altKey && !ev.shiftKey && (ev.key === 'm' || ev.key === 'M') && t) { API.toggleMin(t, true); return true; }
        if (ev.altKey && ev.shiftKey && (ev.key === 'D' || ev.key === 'd')) { $('show-desk').click(); return true; }
        if (ev.altKey && ev.shiftKey && /^Arrow/.test(ev.key) && t) {
            if (ev.key === 'ArrowUp') API.toggleMax(t, true); else if (ev.key === 'ArrowDown') { if (t.max) API.toggleMax(t, false); else API.toggleMin(t, true); }
            else { const s = ev.key === 'ArrowLeft' ? 'l' : 'r'; API.snapTo(t, s); assist(t, s); }
            return true;
        }
        if (ev.altKey && !ev.shiftKey && /^[1-9]$/.test(ev.key)) { const id = (S.pinned || [])[+ev.key - 1]; if (id && API.hasApp(id)) { API.openApp(id); return true; } }
        if (tv && ev.key === 'Escape') { closeTv(); return true; }
        if (tv && (ev.key === 'Enter')) { pickTv(); return true; }
        if (tv && /^Arrow(Right|Left)$/.test(ev.key)) { const n = list().length; tvSel = (tvSel + (ev.key === 'ArrowRight' ? 1 : -1) + n) % Math.max(1, n); paintTv(); return true; }
    }

    // ---------- Zuletzt geöffnet (Startmenü ohne Suchbegriff) ----------
    // ---------- Empfohlen (Startmenü ohne Suchbegriff): zuletzt benutzte Dateien und Apps, wie bei Windows 11 ----------
    let recMore = false;
    const ago = t => { if (!t) return ''; const m = Math.round((Date.now() - t) / 60000), d = new Date(t), td = new Date(); if (m < 1) return 'Gerade eben'; if (m < 60) return `vor ${m} Min.`;
        const hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); if (d.toDateString() === td.toDateString()) return 'Heute, ' + hm; const y = new Date(td); y.setDate(td.getDate() - 1); if (d.toDateString() === y.toDateString()) return 'Gestern, ' + hm;
        return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: d.getFullYear() === td.getFullYear() ? undefined : 'numeric' }); };
    const FT = n => /\.docx?$/i.test(n) ? ['fa-file-word', '#4f8ff7'] : /\.(xlsx?|csv)$/i.test(n) ? ['fa-file-excel', '#2fbf6c'] : /\.pptx?$/i.test(n) ? ['fa-file-powerpoint', '#f2784b'] : /\.pdf$/i.test(n) ? ['fa-file-pdf', '#f87171'] : /\.(png|jpe?g|webp|gif)$/i.test(n) ? ['fa-file-image', '#38bdf8'] : /\.zip$/i.test(n) ? ['fa-file-zipper', '#fbbf24'] : /\.(txt|md|json|log)$/i.test(n) ? ['fa-file-lines', '#94a3b8'] : ['fa-file', '#38bdf8'];
    function recent() {
        const A = API.apps(), X = (window.JMOS_EXT || []).find(x => x.items), at = S.recentAt || {};
        const files = (S.recentFiles || []).map(f => { const [icon, c] = FT(f.name); return { icon, c, title: f.name, sub: ago(f.t) || 'Datei', t: f.t || 0, run: () => { const its = X ? X.items() : [], it = its.find(x => x.key === f.key); if (it) X.openViewer(it, its); else uiAlert('Diese Datei gibt es nicht mehr.'); } }; });
        const apps = (S.recent || []).filter(id => A[id]).map((id, i) => ({ icon: A[id].folder ? 'fa-folder' : A[id].icon, c: A[id].c || '#f59e0b', title: A[id].name, sub: at[id] ? 'App · ' + ago(at[id]) : 'App', t: at[id] || 1 - i, run: () => API.openApp(id) }));
        const all = [...files.filter(f => f.t), ...apps].sort((a, b) => b.t - a.t), oldFiles = files.filter(f => !f.t);
        const out = [...all, ...oldFiles].slice(0, recMore ? 16 : 6);
        window.JMOS_RECENT_LIST = out;
        const more = all.length + oldFiles.length > 6 ? `<button type="button" class="st-more" data-recmore>${recMore ? 'Weniger' : 'Mehr'} <i class="fa-solid fa-chevron-${recMore ? 'up' : 'right'}"></i></button>` : '';
        return out.length ? `<div class="st-head"><span>Empfohlen</span>${more}</div><div class="st-rec">${out.map((r, i) => `<button type="button" class="st-r" data-recent="${i}"><span class="ic" style="--c:${r.c}"><i class="fa-solid ${r.icon}"></i></span><span class="tx"><b>${e(r.title)}</b><small>${e(r.sub)}</small></span></button>`).join('')}</div>`
            : '<div class="st-head"><span>Empfohlen</span></div><p class="st-recnone">Hier erscheinen die Dateien und Apps, die du zuletzt benutzt hast.</p>';
    }
    document.addEventListener('click', ev => { const b = ev.target.closest('[data-recmore]'); if (!b) return; ev.stopPropagation(); recMore = !recMore; API.renderStart(); }, true);

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        init(api, user) {
            API = api; U = user; e = api.esc; S = api.state();
            if (!Array.isArray(S.pinned)) S.pinned = ['explorer', 'zeiterfassung', 'finanzen', 'messenger'].filter(id => API.hasApp(id));
            applyLook(); loadWall(); watchIdle(); API.renderTasks();
            API.keys.push(keys);
            document.addEventListener('keyup', ev => { if (tv && ev.key === 'Alt') pickTv(); });
            window.JMOS_SNAPPED = assist; window.JMOS_LOCK = lockNow; window.JMOS_TV_REPAINT = () => tv && paintTv(); window.JMOS_RECENT = recent;
            $('bar-tv').addEventListener('click', () => (tv ? closeTv() : openTv(false)));
            // Einstellungen erweitern
            const base = window.JMOS_NATIVE_UI.set;
            window.JMOS_NATIVE_UI.set = (body, win) => { base(body, win); settings(body); };
            // Startmenü-Apps: Rechtsklick zum Anheften
            $('start').addEventListener('contextmenu', ev => { const a = ev.target.closest('.st-app'); if (!a) return; ev.preventDefault(); const id = a.dataset.id;
                API.ctx(ev.clientX, ev.clientY, [['fa-up-right-from-square', 'Öffnen', () => API.openApp(id)], !API.apps()[id].folder && ['fa-thumbtack', API.isPinned(id) ? 'Von Taskleiste lösen' : 'An Taskleiste anheften', () => API.togglePin(id)], !API.apps()[id].hidden && ['fa-display', API.onDeskIcon(id) ? 'Vom Desktop entfernen' : 'Auf dem Desktop anzeigen', () => API.toggleDeskIcon(id)]]); });
        },
    });
})();
