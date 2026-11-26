/* J.Mainz OS – Paket E: Widget „Mein Tag“, Bildschirmfoto, Admin-Konsole */
(function () {
    'use strict';
    let API, U, S, e;
    const $ = id => document.getElementById(id);
    const W = () => window.JMOS_WIDGETS;
    const pad = n => String(n).padStart(2, '0');
    const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const eur = n => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    const hm = m => `${Math.floor(m / 60)}:${pad(Math.round(m % 60))}`;
    const dayDiff = iso => Math.round((new Date(iso + 'T12:00') - new Date(localDate() + 'T12:00')) / 864e5);
    function toast(icon, c, title, text, ms) {
        const box = $('toasts'), el = document.createElement('div'); el.className = 'tst';
        el.innerHTML = `<div class="tst-i"><span class="ic" style="--c:${c}"><i class="fa-solid ${icon}"></i></span><span class="tx"><b>${e(title)}</b><span>${e(text || '')}</span></span></div>`;
        box.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, ms || 3500);
    }

    // ================= Widget „Mein Tag“ =================
    const TODAY = {
        name: 'Mein Tag', icon: 'fa-sun', c: '#fbbf24', desc: 'Arbeitszeit heute, Termine, fällige Rechnungen und offene Aufgaben auf einen Blick', sizes: { m: [320, 290], l: [340, 370] },
        mount(b, w) {
            const st = { zeit: null, events: null, fin: null, todos: null }, offs = [];
            const draw = () => {
                const now = new Date(), h = now.getHours(), name = U.firstName || '';
                const greet = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
                const rows = [];
                if (st.zeit) { const k = W().zeitKpis(st.zeit), live = !!st.zeit.active; rows.push({ app: 'zeiterfassung', icon: 'fa-business-time', c: '#34d399', v: hm(k.day || 0) + ' h', t: live ? 'gearbeitet · <span class="md-live">läuft</span>' : 'heute gearbeitet' }); }
                let todayEv = [];
                if (st.events && typeof CAL !== 'undefined') {
                    const t = localDate(); todayEv = CAL.nextOccurrences(st.events, t, 30, 1).filter(o => o.date === t);
                    const tm = s => { const [a, c] = String(s || '').split(':').map(Number); return (a || 0) * 60 + (c || 0); }, nowM = h * 60 + now.getMinutes();
                    const next = todayEv.find(o => !o.time || tm(o.endTime || o.time) + (o.endTime ? 0 : 60) > nowM);
                    rows.push({ app: 'menu', icon: 'fa-calendar-day', c: '#818cf8', v: String(todayEv.length), t: todayEv.length ? (next ? `Termin${todayEv.length === 1 ? '' : 'e'} · als Nächstes ${next.time ? CAL.timeLabel(next) + ' ' : ''}${e(next.title)}` : 'Termine, alle vorbei') : 'Termine heute' });
                }
                if (st.fin) {
                    const open = st.fin.inv.filter(v => v.status !== 'paid'), over = open.filter(v => v.due && dayDiff(v.due) < 0), soon = open.filter(v => v.due && dayDiff(v.due) >= 0 && dayDiff(v.due) <= 7);
                    const sum = [...over, ...soon].reduce((a, v) => a + (Number(v.amount) || 0), 0);
                    rows.push({ app: 'finanzen', url: '/finanzen.html#inv', icon: 'fa-file-invoice', c: over.length ? '#f87171' : '#fbbf24', v: String(over.length + soon.length), t: over.length + soon.length ? `Rechnung${over.length + soon.length === 1 ? '' : 'en'} fällig${over.length ? ` · <span class="md-bad">${over.length} überfällig</span>` : ''} · ${eur(sum)}` : 'Rechnungen fällig diese Woche' });
                }
                if (st.todos) { const o = st.todos.filter(t => !t.done), sh = o.filter(t => t.kind === 'shop').length; rows.push({ app: 'board', icon: 'fa-list-check', c: '#34d399', v: String(o.length - sh), t: `Aufgaben offen${sh ? ` · ${sh} auf der Einkaufsliste` : ''}` }); }
                b.innerHTML = `<div class="md"><div class="md-h"><b>${greet}${name ? ', ' + e(name) : ''}</b><small>${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</small></div>
                    <div class="md-rows">${rows.map((r, i) => `<button type="button" class="md-r" data-i="${i}"><span class="md-ic" style="--c:${r.c}"><i class="fa-solid ${r.icon}"></i></span><b>${r.v}</b><span class="md-t">${r.t}</span></button>`).join('') || '<div class="wg-empty">Keine Bereiche freigegeben</div>'}</div>
                    ${w.size === 'l' && todayEv.length ? `<div class="md-ev">${todayEv.slice(0, 4).map(o => `<div><span>${o.time ? e(CAL.timeLabel(o)) : 'ganztägig'}</span><b>${e(o.title)}</b></div>`).join('')}</div>` : ''}</div>`;
                b._rows = rows;
            };
            b.addEventListener('click', ev => { const r = ev.target.closest('[data-i]'); if (!r) return; const x = b._rows[+r.dataset.i]; if (x && API.hasApp(x.app)) API.openApp(x.app, x.url ? { url: x.url } : {}); });
            if (can(U, 'zeiterfassung')) offs.push(W().use('zeit', d => { st.zeit = d; draw(); }));
            if (can(U, 'termine')) offs.push(W().use('events', d => { st.events = d; draw(); }));
            if (can(U, 'finanzen')) offs.push(W().use('fin', d => { st.fin = d; draw(); }));
            if (can(U, 'aufgaben')) offs.push(W().use('todos', d => { st.todos = d; draw(); }));
            draw(); const id = setInterval(draw, 30000);
            return () => { offs.forEach(f => f && f()); clearInterval(id); };
        },
    };

    // ================= Bildschirmfoto =================
    let shotBusy = false;
    async function grab() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error('Dieser Browser kann keine Bildschirmfotos aufnehmen.');
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser', frameRate: 5 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' });
        try {
            const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = stream; await v.play();
            await new Promise(r => setTimeout(r, 350));      // Auswahl-Hinweis des Browsers verschwinden lassen
            const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); return c;
        } finally { stream.getTracks().forEach(t => t.stop()); }
    }
    async function screenshot() {
        if (shotBusy) return; shotBusy = true; API.closePops();
        let full;
        try { full = await grab(); } catch (x) { shotBusy = false; if (x && x.name !== 'NotAllowedError' && x.name !== 'AbortError') uiAlert(x.message || String(x), { title: 'Bildschirmfoto' }); return; }
        const el = document.createElement('div'); el.className = 'shot'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Bildschirmfoto');
        const url = full.toDataURL('image/png');
        el.innerHTML = `<img src="${url}" alt="" draggable="false"><div class="shot-sel" hidden></div><div class="shot-tip"><i class="fa-solid fa-crop-simple"></i>Bereich aufziehen oder <button type="button" data-s="all">Ganzer Bildschirm</button> · Esc bricht ab</div>`;
        document.body.appendChild(el);
        const img = el.querySelector('img'), sel = el.querySelector('.shot-sel'); let sx = 0, sy = 0, rect = null;
        const close = () => { el.remove(); document.removeEventListener('keydown', key, true); shotBusy = false; };
        const key = ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); } };
        document.addEventListener('keydown', key, true);
        const finish = r => {
            const ir = img.getBoundingClientRect(), kx = full.width / ir.width, ky = full.height / ir.height;
            const x = Math.max(0, (r.x - ir.left) * kx), y = Math.max(0, (r.y - ir.top) * ky), w = Math.min(full.width - x, r.w * kx), h = Math.min(full.height - y, r.h * ky);
            if (w < 8 || h < 8) return;
            const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); c.getContext('2d').drawImage(full, x, y, w, h, 0, 0, c.width, c.height);
            close(); result(c);
        };
        el.addEventListener('pointerdown', ev => {
            if (ev.target.closest('.shot-tip')) return; ev.preventDefault(); el.setPointerCapture(ev.pointerId);
            sx = ev.clientX; sy = ev.clientY; sel.hidden = false; rect = { x: sx, y: sy, w: 0, h: 0 }; Object.assign(sel.style, { left: sx + 'px', top: sy + 'px', width: '0px', height: '0px' }); el.classList.add('sel');
            const mv = m => { rect = { x: Math.min(sx, m.clientX), y: Math.min(sy, m.clientY), w: Math.abs(m.clientX - sx), h: Math.abs(m.clientY - sy) }; Object.assign(sel.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' }); sel.dataset.sz = `${Math.round(rect.w * full.width / innerWidth)} × ${Math.round(rect.h * full.height / innerHeight)}`; };
            const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); if (rect && rect.w > 8 && rect.h > 8) finish(rect); else { sel.hidden = true; el.classList.remove('sel'); } };
            el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
        });
        el.querySelector('[data-s="all"]').addEventListener('click', () => { const ir = img.getBoundingClientRect(); finish({ x: ir.left, y: ir.top, w: ir.width, h: ir.height }); });
    }
    function stamp() { const d = new Date(); return `Bildschirmfoto_${localDate(d)}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`; }
    function result(c) {
        if (window.JMOS_SOUND) JMOS_SOUND.play('shot');
        const name = stamp(), toBlob = (t, q) => new Promise(r => c.toBlob(r, t, q));
        const el = document.createElement('div'); el.className = 'shot-res'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Bildschirmfoto');
        el.innerHTML = `<img src="${c.toDataURL('image/png')}" alt="Bildschirmfoto"><div class="shot-info"><b>Bildschirmfoto</b><small>${c.width} × ${c.height} Pixel</small></div>
            <div class="shot-act">${can(U, 'dokumente') ? '<button type="button" data-a="save"><i class="fa-solid fa-floppy-disk"></i>In Dokumente</button>' : ''}<button type="button" data-a="copy"><i class="fa-solid fa-copy"></i>Kopieren</button>${window.JMOS_CHAT ? '<button type="button" data-a="chat"><i class="fa-solid fa-paper-plane"></i>Per Chat</button>' : ''}<button type="button" data-a="dl"><i class="fa-solid fa-download"></i>Herunterladen</button><button type="button" data-a="x" class="x" aria-label="Verwerfen"><i class="fa-solid fa-xmark"></i></button></div>`;
        document.body.appendChild(el);
        const done = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
        el.addEventListener('click', async ev => {
            const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
            if (a === 'x') return done();
            b.disabled = true;
            try {
                if (a === 'copy') { const blob = await toBlob('image/png'); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('fa-copy', '#a5b4fc', 'Kopiert', 'Das Bildschirmfoto liegt in der Zwischenablage.'); }
                else if (a === 'dl') { const u = URL.createObjectURL(await toBlob('image/png')), l = document.createElement('a'); l.href = u; l.download = name + '.png'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
                else if (a === 'save') {
                    let blob = await toBlob('image/png'); if (blob.size > 3 * 1048576) blob = await toBlob('image/jpeg', .88);
                    const f = new File([blob], name + (blob.type === 'image/png' ? '.png' : '.jpg'), { type: blob.type });
                    if (!window.JMOS_FILES) throw new Error('Explorer nicht geladen.');
                    const n = await JMOS_FILES.upload([f], ''); if (n) { toast('fa-floppy-disk', '#38bdf8', 'Gespeichert', f.name + ' liegt in „Eigene Dateien“.'); done(); return; }
                }
                else if (a === 'chat') { const ch = await JMOS_CHAT.pick('Bildschirmfoto senden an'); if (ch) { await JMOS_CHAT.send(ch, { blob: await toBlob('image/png'), name: name + '.png' }); done(); return; } }
            } catch (x) { uiAlert(x.message || String(x), { title: 'Bildschirmfoto' }); }
            b.disabled = false;
        });
    }

    // ================= Admin-Konsole =================
    const HELP = [
        ['hilfe', 'diese Liste'],
        ['wartung', 'zeigt, welche Seiten in Wartung sind'],
        ['wartung an <seite|alles> [text]', 'Seite in Wartung setzen, z. B. „wartung an finanzen“'],
        ['wartung aus <seite|alle>', 'Wartung beenden'],
        ['nutzer', 'alle Konten mit Rolle und Status'],
        ['nutzer <name|e-mail>', 'Details und Rechte eines Kontos'],
        ['online', 'wer gerade online ist'],
        ['öffne <app>', 'App öffnen, z. B. „öffne finanzen“'],
        ['cache leeren', 'zwischengespeicherte Dateien löschen und neu laden'],
        ['version', 'Stand der Seite'],
        ['clear', 'Konsole leeren'],
    ];
    function konsole(body, win) {
        body.innerHTML = `<div class="tm" tabindex="-1"><div class="tm-out"></div><form class="tm-in"><span class="tm-p">admin@jmainz:~$</span><input autocomplete="off" spellcheck="false" aria-label="Befehl"></form></div>`;
        const out = body.querySelector('.tm-out'), inp = body.querySelector('input'), hist = (() => { try { return JSON.parse(sessionStorage.getItem('jmos-tm') || '[]'); } catch (x) { return []; } })(); let hi = hist.length;
        const print = (html, cls) => { const d = document.createElement('div'); d.className = 'tm-l' + (cls ? ' ' + cls : ''); d.innerHTML = html; out.appendChild(d); body.querySelector('.tm').scrollTop = 1e9; };
        const table = rows => `<table class="tm-t">${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
        print(`<b class="tm-a">J.Mainz OS Konsole</b> · angemeldet als ${e(U.email)} · <span class="tm-m">„hilfe“ zeigt alle Befehle</span>`);
        const pageOf = q => { q = q.toLowerCase().replace(/^\//, ''); if (['alles', 'alle', 'system', '/'].includes(q)) return MAINT_PAGES[0]; return MAINT_PAGES.find(p => p.key.slice(1) === q || p.label.toLowerCase().startsWith(q)); };
        const run = async raw => {
            const line = raw.trim(); if (!line) return;
            print(`<span class="tm-p">admin@jmainz:~$</span> ${e(line)}`, 'tm-cmd');
            const [cmd, ...a] = line.split(/\s+/), c = cmd.toLowerCase(), rest = a.join(' ');
            try {
                if (c === 'hilfe' || c === 'help' || c === '?') print(table(HELP.map(([k, d]) => [`<b class="tm-a">${e(k)}</b>`, e(d)])));
                else if (c === 'clear' || c === 'cls') out.innerHTML = '';
                else if (c === 'wartung') {
                    const ref = db.collection('maintenance').doc('status'), sub = (a[0] || '').toLowerCase();
                    if (!sub) { const m = (await ref.get()).data() || {}, on = MAINT_PAGES.filter(p => maintOn(p.key, m)); print(on.length ? table(on.map(p => [`<span class="tm-bad">● Wartung</span>`, e(p.label), `<span class="tm-m">${e(p.key)}</span>`])) + (m.msg ? `<span class="tm-m">Text: ${e(m.msg)}</span>` : '') : '<span class="tm-ok">● Alle Seiten laufen normal.</span>'); return; }
                    if (sub !== 'an' && sub !== 'aus') throw new Error('Nutze „wartung an <seite>“ oder „wartung aus <seite>“.');
                    const tgt = (a[1] || '').toLowerCase();
                    if (sub === 'aus' && (tgt === 'alle' || tgt === 'alles')) { await ref.set({ pages: {}, updatedBy: U.email, updatedAt: TS() }, { merge: false }).catch(async () => { await ref.set({ pages: {} }); }); logSystemEvent('admin', 'Alle Wartungen beendet', { ueber: 'Konsole' }); print('<span class="tm-ok">✓ Alle Wartungen beendet.</span>'); return; }
                    const p = pageOf(tgt || ''); if (!p) throw new Error(`Seite „${tgt}“ unbekannt. Möglich: ${MAINT_PAGES.slice(1).map(x => x.key.slice(1)).join(', ')}, alles`);
                    if (sub === 'an' && p.key === '/' && !(await uiConfirm('Ganzes System in Wartung setzen? Alle außer Admins werden sofort ausgesperrt.', { danger: true, ok: 'Sperren' }))) { print('<span class="tm-m">Abgebrochen.</span>'); return; }
                    const data = { pages: { [p.key]: sub === 'an' }, updatedBy: U.email, updatedAt: TS() }; if (sub === 'an' && a.length > 2) data.msg = a.slice(2).join(' ').slice(0, 300);
                    await ref.set(data, { merge: true }); logSystemEvent('admin', sub === 'an' ? 'Wartung eingeschaltet' : 'Wartung beendet', { seite: p.label, ueber: 'Konsole' });
                    print(sub === 'an' ? `<span class="tm-bad">● ${e(p.label)} ist jetzt in Wartung.</span>` : `<span class="tm-ok">✓ ${e(p.label)} läuft wieder.</span>`);
                }
                else if (c === 'nutzer' || c === 'user' || c === 'users') {
                    const s = await db.collection('users').get(), all = s.docs.map(d => ({ id: d.id, ...d.data() })), nm = u => [u.firstName, u.lastName].filter(Boolean).join(' ') || '–';
                    if (!rest) { print(table([['<b>Name</b>', '<b>E-Mail</b>', '<b>Rolle</b>', '<b>Status</b>'], ...all.sort((x, y) => nm(x).localeCompare(nm(y), 'de')).map(u => [e(nm(u)), e(u.email || ''), u.role === 'admin' ? '<span class="tm-a">admin</span>' : e(u.role || 'user'), u.status === 'active' ? '<span class="tm-ok">aktiv</span>' : `<span class="tm-bad">${e(u.status || '?')}</span>`])]) + `<span class="tm-m">${all.length} Konten</span>`); return; }
                    const q = rest.toLowerCase(), u = all.find(x => (x.email || '').toLowerCase() === q) || all.find(x => nm(x).toLowerCase().includes(q) || (x.email || '').toLowerCase().includes(q));
                    if (!u) throw new Error(`Kein Konto zu „${rest}“ gefunden.`);
                    const perms = Object.entries(u.permissions || {}).filter(([, v]) => v).map(([k]) => k);
                    print(table([['Name', `<b>${e(nm(u))}</b>`], ['E-Mail', e(u.email || '')], ['Rolle', e(u.role || 'user')], ['Status', e(u.status || '?')], ['Rechte', u.role === 'admin' ? '<span class="tm-a">alle (Admin)</span>' : perms.length ? e(perms.join(', ')) : '<span class="tm-m">keine</span>']]));
                }
                else if (c === 'online') {
                    const s = await db.collection('directory').get(), now = Date.now(), ms = v => v && v.toDate ? +v.toDate() : +v || 0;
                    const l = s.docs.map(d => ({ n: d.data().name || '?', t: ms(d.data().lastSeen) })).filter(x => x.t).sort((x, y) => y.t - x.t);
                    print(l.length ? table(l.map(x => { const m = Math.round((now - x.t) / 60000); return [m < 3 ? '<span class="tm-ok">● online</span>' : '<span class="tm-m">○</span>', e(x.n), `<span class="tm-m">${m < 3 ? 'jetzt' : m < 60 ? 'vor ' + m + ' Min.' : m < 1440 ? 'vor ' + Math.round(m / 60) + ' Std.' : 'vor ' + Math.round(m / 1440) + ' Tagen'}</span>`]; })) : '<span class="tm-m">Keine Daten.</span>');
                }
                else if (c === 'öffne' || c === 'oeffne' || c === 'open') {
                    const q = rest.toLowerCase(), apps = API.apps(), id = Object.keys(apps).find(k => k === q) || Object.keys(apps).find(k => !k.startsWith('file:') && (apps[k].name || '').toLowerCase().startsWith(q));
                    if (!q || !id) throw new Error(`App „${rest}“ nicht gefunden.`); API.openApp(id); print(`<span class="tm-ok">✓ ${e(apps[id].name)} geöffnet.</span>`);
                }
                else if (c === 'cache' && (a[0] || '').toLowerCase() === 'leeren') {
                    let n = 0; if (window.caches) { const ks = await caches.keys(); for (const k of ks) { await caches.delete(k); n++; } }
                    if (navigator.serviceWorker) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.update().catch(() => {}))); }
                    print(`<span class="tm-ok">✓ ${n} Zwischenspeicher gelöscht.</span> <span class="tm-m">Neu laden in 2 Sekunden …</span>`); setTimeout(() => location.reload(), 2000);
                }
                else if (c === 'version') {
                    let head = ''; try { const t = await (await fetch('/CHANGELOG.md', { cache: 'no-store' })).text(); head = (t.match(/^## (.+)$/m) || [])[1] || ''; } catch (x) { }
                    print(table([['Letzte Änderung', e(head || '–')], ['Geladen', e(new Date(performance.timeOrigin).toLocaleString('de-DE'))], ['Browser', e(navigator.userAgent.match(/(Edg|Chrome|Firefox|Safari)\/[\d.]+/)?.[0] || '?')]]));
                }
                else if (c === 'echo') print(e(rest));
                else if (c === 'whoami') print(e(U.email));
                else if (c === 'sudo') print('<span class="tm-m">Du bist schon Admin. 😎</span>');
                else throw new Error(`Unbekannter Befehl „${cmd}“. „hilfe“ zeigt alle Befehle.`);
            } catch (x) { print(`<span class="tm-bad">✗ ${e(x.message || String(x))}</span>`); }
        };
        const CMDS = ['hilfe', 'wartung', 'wartung an ', 'wartung aus ', 'nutzer', 'online', 'öffne ', 'cache leeren', 'version', 'clear'];
        body.querySelector('form').addEventListener('submit', async ev => { ev.preventDefault(); const v = inp.value; inp.value = ''; if (v.trim()) { hist.push(v); while (hist.length > 50) hist.shift(); try { sessionStorage.setItem('jmos-tm', JSON.stringify(hist)); } catch (x) { } } hi = hist.length; inp.disabled = true; await run(v); inp.disabled = false; inp.focus(); });
        inp.addEventListener('keydown', ev => {
            if (ev.key === 'ArrowUp') { ev.preventDefault(); if (hi > 0) inp.value = hist[--hi]; }
            else if (ev.key === 'ArrowDown') { ev.preventDefault(); hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; }
            else if (ev.key === 'Tab') { ev.preventDefault(); const v = inp.value.toLowerCase(), m = CMDS.filter(k => k.startsWith(v)); if (m.length === 1) inp.value = m[0]; else if (m.length) print(`<span class="tm-m">${m.map(e).join('  ')}</span>`); }
            else if (ev.key === 'l' && ev.ctrlKey) { ev.preventDefault(); out.innerHTML = ''; }
        });
        body.addEventListener('click', () => { if (!getSelection().toString()) inp.focus(); });
        setTimeout(() => inp.focus(), 60);
    }

    function keys(ev) {
        if (ev.altKey && ev.shiftKey && (ev.key === 's' || ev.key === 'S')) { screenshot(); return true; }
    }
    function searchExtra(q) {
        q = (q || '').toLowerCase(); if (q.length < 3) return [];
        const out = [];
        if (/(bildschirm|screenshot|foto aufn)/.test(q)) out.push({ kind: 'System', title: 'Bildschirmfoto aufnehmen', sub: 'Alt+Umschalt+S', icon: 'fa-camera', c: '#38bdf8', run: screenshot, s: 4 });
        return out;
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        apps: [
            { id: 'bildschirmfoto', name: 'Bildschirmfoto', icon: 'fa-camera', c: '#38bdf8', noDesk: true, run: () => screenshot() },
            { id: 'konsole', name: 'Admin-Konsole', icon: 'fa-terminal', c: '#64748b', native: 'konsole', admin: true, noDesk: true, w: 820, h: 520 },
        ],
        ui: { konsole },
        init(api, user) {
            API = api; U = user; e = api.esc; S = api.state();
            W().TYPES.today = TODAY;
            API.keys.push(keys);
            (window.JMOS_SEARCH_EXTRA = window.JMOS_SEARCH_EXTRA || []).push(searchExtra);
            window.JMOS_SHOT = screenshot;
            // Termin-Erinnerungen (js/cal-remind.js) erscheinen im OS als eigene Mitteilung; Astro sagt sie zusätzlich an
            addEventListener('jm-cal-remind', ev => { const d = ev.detail || {}; toast('fa-bell', '#818cf8', '⏰ ' + d.title, d.text, 12000); if (window.JMOS_ASTRO && S.astroTalk !== false) JMOS_ASTRO.say('⏰ ' + d.title + ' – ' + d.text, 9000); });
            W().render();
        },
    });
})();
