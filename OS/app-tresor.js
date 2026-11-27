// OS/app-tresor.js – Passwort-Safe als eigene OS-App. Gleiches Format wie im Dashboard (Firestore „vault“, AES-256-GCM, PBKDF2 600.000),
// verschlüsselt wird nur im Browser; das Master-Passwort verlässt nie den Rechner.
(function () {
    'use strict';
    const { esc, modal, toast, errMsg } = OAK;
    const ITER = 600000, LEGACY = 100000, MASK = '••••••••', enc = new TextEncoder(), dec = new TextDecoder();
    const b64 = u8 => btoa(String.fromCharCode(...u8)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    async function derive(pass, salt, iter) { const km = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
    async function encW(key, text) { const iv = crypto.getRandomValues(new Uint8Array(12)), ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)); return { cipher: b64(new Uint8Array(ct)), iv: b64(iv) }; }
    const decW = async (key, cipher, iv) => dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(cipher)));
    const gen = (n = 20) => { const set = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?-_', lim = Math.floor(4294967296 / set.length) * set.length, o = []; while (o.length < n) { const [r] = crypto.getRandomValues(new Uint32Array(1)); if (r < lim) o.push(set[r % set.length]); } return o.join(''); };
    const strength = p => { let s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (p.length >= 16) s++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^\w]/.test(p)) s++; return Math.min(4, Math.floor(s * 4 / 6)); };
    const PAL = ['#f472b6', '#22d3ee', '#fb923c', '#f87171', '#818cf8', '#34d399', '#fbbf24', '#a78bfa'];
    let U = null;

    function ui(body, win) {
        let key = null, check = null, items = [], rows = [], fails = 0, lockUntil = 0, last = Date.now(), q = '';
        body.innerHTML = `<div class="oa oa-vault" style="--m:#fb923c;--mr:251,146,60"><div class="oa-h"><span class="oa-ico"><i class="fa-solid fa-shield-halved"></i></span><div><h2>Passwort-Safe</h2><small class="tv-sub">Verschlüsselt, nur mit deinem Master-Passwort lesbar</small></div><span class="oa-sp"></span><span class="tv-tools"></span></div><div class="oa-b tv-b"></div></div>`;
        const $ = s => body.querySelector(s), root = $('.oa'), main = $('.tv-b');
        const off = db.collection('vault').where('owner', '==', U.email).onSnapshot(s => { const all = s.docs.map(d => ({ id: d.id, ...d.data() })); check = all.find(i => i.kind === 'check') || null; items = all.filter(i => !i.kind); if (key) decryptAll(); else locked(); }, x => { main.innerHTML = `<p class="oa-empty">Safe konnte nicht geladen werden: ${esc(errMsg(x))}</p>`; });
        function locked() {
            const setup = !check && !items.length; $('.tv-tools').innerHTML = ''; $('.tv-sub').textContent = 'Verschlüsselt, nur mit deinem Master-Passwort lesbar';
            main.innerHTML = `<form class="tv-lock oa-card"><span class="tv-big"><i class="fa-solid fa-lock"></i></span><h3>${setup ? 'Safe einrichten' : 'Safe ist gesperrt'}</h3>
                <p class="oa-note">${setup ? 'Lege ein Master-Passwort fest (mind. 8 Zeichen). Es wird nirgends gespeichert – wer es vergisst, verliert den Zugriff.' : 'Deine Einträge sind per AES-256 direkt im Browser verschlüsselt.'}</p>
                <input class="oa-in" type="password" name="p" placeholder="Master-Passwort" autocomplete="current-password" autofocus>${setup ? '<input class="oa-in" type="password" name="p2" placeholder="Master-Passwort wiederholen" autocomplete="new-password">' : ''}
                <button type="submit" class="btn pri"><i class="fa-solid fa-${setup ? 'shield-halved' : 'lock-open'}"></i>${setup ? 'Einrichten' : 'Entsperren'}</button></form>`;
            const fm = main.querySelector('form'); setTimeout(() => fm.p.focus(), 30);
            fm.addEventListener('submit', async ev => { ev.preventDefault(); if (Date.now() < lockUntil) return toast(root, `Bitte ${Math.ceil((lockUntil - Date.now()) / 1000)} Sekunden warten.`, true);
                const p = fm.p.value, b = fm.querySelector('button'); if (!p) return; b.disabled = true; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Prüfe …';
                const fail = () => { fails++; lockUntil = Date.now() + Math.min(30000, 2000 * fails); toast(root, 'Falsches Master-Passwort.', true); if (typeof logSystemEvent === 'function') logSystemEvent('auth', 'Tresor: falsches Master-Passwort'); };
                try {
                    const legacy = items.filter(i => i.v !== 2);
                    if (check) { const k = await derive(p, unb64(check.salt), check.iter || ITER); let ok = false; try { ok = (await decW(k, check.cipher, check.iv)) === 'vault-ok'; } catch (x) {} if (!ok) { fail(); return locked(); } key = k; }
                    else if (legacy.length) { try { await decW(await derive(p, unb64(legacy[0].salt), LEGACY), legacy[0].cipher, legacy[0].iv); } catch (x) { fail(); return locked(); } await createCheck(p); }
                    else { if (p.length < 8) { toast(root, 'Mindestens 8 Zeichen.', true); return locked(); } if (p !== fm.p2.value) { toast(root, 'Die beiden Passwörter stimmen nicht überein.', true); return locked(); } await createCheck(p); }
                    fails = 0; await migrate(p); last = Date.now(); decryptAll();
                } catch (x) { toast(root, errMsg(x), true); locked(); } });
        }
        async function createCheck(p) { const salt = crypto.getRandomValues(new Uint8Array(16)), k = await derive(p, salt, ITER), { cipher, iv } = await encW(k, 'vault-ok'), d = { kind: 'check', v: 2, salt: b64(salt), iter: ITER, cipher, iv, owner: U.email };
            await db.collection('vault').doc('meta-' + U.uid).set({ ...d, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); check = d; key = k; }
        async function migrate(p) { for (const it of items.filter(i => i.v !== 2)) { try { const secret = await decW(await derive(p, unb64(it.salt), LEGACY), it.cipher, it.iv), { cipher, iv } = await encW(key, JSON.stringify({ title: it.title || '', username: it.username || '', secret })), del = firebase.firestore.FieldValue.delete(); await db.collection('vault').doc(it.id).update({ v: 2, cipher, iv, title: del, username: del, salt: del }); } catch (x) {} } }
        async function decryptAll() {
            const out = []; for (const it of items) { if (it.v === 2) { try { out.push({ id: it.id, ...JSON.parse(await decW(key, it.cipher, it.iv)) }); } catch (x) { out.push({ id: it.id, title: 'Nicht lesbar', username: '', secret: null }); } } else out.push({ id: it.id, title: it.title || 'Alter Eintrag', username: 'Altes Format – sperren und neu entsperren', secret: null }); }
            rows = out.sort((a, b) => String(a.title).localeCompare(String(b.title), 'de')); draw();
        }
        function draw() {
            if (!key) return locked();
            $('.tv-sub').textContent = `${rows.length} ${rows.length === 1 ? 'Eintrag' : 'Einträge'} · sperrt nach 5 Minuten ohne Aktivität`;
            if (!$('.tv-tools').firstChild) { $('.tv-tools').innerHTML = `<input class="oa-in" type="search" placeholder="Suchen" aria-label="Einträge suchen" style="width:200px"><button type="button" class="btn pri" data-k="add"><i class="fa-solid fa-plus"></i>Eintrag</button><button type="button" class="btn" data-k="lock"><i class="fa-solid fa-lock"></i>Sperren <small class="tv-eta"></small></button>`;
                $('.tv-tools input').addEventListener('input', ev => { q = ev.target.value.trim().toLowerCase(); draw(); }); }
            const L = rows.filter(r => !q || [r.title, r.username, r.url].join(' ').toLowerCase().includes(q));
            main.innerHTML = L.length ? `<div class="tv-grid">${L.map(r => { const c = PAL[[...String(r.title)].reduce((s, ch) => s + ch.charCodeAt(0), 0) % PAL.length];
                return `<div class="oa-card tv-it" data-id="${esc(r.id)}" style="--c:${c}"><div class="tv-top"><span class="tv-tile">${esc(String(r.title || '?').slice(0, 1).toUpperCase())}</span><span class="tv-nm"><b>${esc(r.title)}</b><small>${esc(r.username || '')}</small></span><button type="button" class="mx-ib" data-a="menu" aria-label="Mehr"><i class="fa-solid fa-ellipsis"></i></button></div>
                    <div class="tv-sec"><code data-val>${r.secret === null ? '—' : MASK}</code><button type="button" class="mx-ib" data-a="show"${r.secret === null ? ' disabled' : ''} aria-label="Anzeigen"><i class="fa-regular fa-eye"></i></button><button type="button" class="mx-ib" data-a="copy"${r.secret === null ? ' disabled' : ''} aria-label="Passwort kopieren"><i class="fa-regular fa-copy"></i></button></div>
                    ${r.url ? `<a class="tv-url" href="${esc(/^https?:\/\//.test(r.url) ? r.url : 'https://' + r.url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i>${esc(r.url)}</a>` : ''}</div>`; }).join('')}</div>`
                : `<p class="oa-empty"><i class="fa-solid fa-key"></i>${q ? 'Nichts gefunden.' : 'Noch keine Einträge. Lege oben den ersten an.'}</p>`;
        }
        const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); toast(root, `${what} kopiert – die Zwischenablage wird nach 30 Sekunden geleert`); setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30000); } catch (x) { toast(root, 'Kopieren nicht möglich.', true); } };
        function editor(r) {
            const m = modal(root, `<form><h3><i class="fa-solid fa-key"></i>${r ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</h3><div class="oa-form">
                <label class="oa-f w">Titel<input class="oa-in" name="title" maxlength="120" required value="${esc(r ? r.title : '')}" placeholder="z. B. Netflix"></label>
                <label class="oa-f w">Benutzername / E-Mail<input class="oa-in" name="username" maxlength="200" value="${esc(r ? r.username || '' : '')}" autocomplete="off"></label>
                <label class="oa-f w">Passwort<span class="tv-pw"><input class="oa-in" name="secret" required value="${esc(r ? r.secret || '' : '')}" autocomplete="off" spellcheck="false"><button type="button" class="btn" data-gen title="Starkes Passwort erzeugen"><i class="fa-solid fa-dice"></i>Erzeugen</button></span><span class="oa-bar tv-str"><i></i></span></label>
                <label class="oa-f w">Webseite (optional)<input class="oa-in" name="url" maxlength="300" value="${esc(r ? r.url || '' : '')}" placeholder="netflix.com"></label>
                <label class="oa-f w">Notiz (optional)<textarea class="oa-in" name="note" rows="2" maxlength="1000">${esc(r ? r.note || '' : '')}</textarea></label></div>
                <div class="oa-acts"><button type="button" class="btn" data-close>Abbrechen</button><button type="submit" class="btn pri"><i class="fa-solid fa-lock"></i>Verschlüsselt speichern</button></div></form>`);
            const fm = m.box.querySelector('form'), str = () => { const s = strength(fm.secret.value), bar = m.box.querySelector('.tv-str i'); bar.style.width = (s * 25) + '%'; bar.style.background = ['#f87171', '#fb923c', '#facc15', '#a3e635', '#4ade80'][s]; };
            fm.secret.addEventListener('input', str); str();
            m.box.querySelector('[data-gen]').addEventListener('click', () => { fm.secret.value = gen(); str(); });
            fm.addEventListener('submit', async ev => { ev.preventDefault(); if (!key) return m.close();
                const payload = JSON.stringify({ title: fm.title.value.trim(), username: fm.username.value.trim(), secret: fm.secret.value, url: fm.url.value.trim(), note: fm.note.value.trim() });
                try { const { cipher, iv } = await encW(key, payload); if (r) await db.collection('vault').doc(r.id).update({ v: 2, cipher, iv, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); else await db.collection('vault').add({ v: 2, cipher, iv, owner: U.email, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); m.close(); }
                catch (x) { toast(root, 'Speichern fehlgeschlagen: ' + errMsg(x), true); } });
        }
        async function del(r) { if (await uiConfirm(`„${r.title}“ löschen?`, { danger: true, ok: 'Löschen' })) try { await db.collection('vault').doc(r.id).delete(); } catch (x) { toast(root, errMsg(x), true); } }
        function lock() { key = null; rows = []; locked(); }
        body.addEventListener('click', ev => {
            const k = ev.target.closest('[data-k]'); if (k) { if (k.dataset.k === 'add') editor(null); else lock(); return; }
            const a = ev.target.closest('[data-a]'), box = ev.target.closest('[data-id]'); if (!a || !box) return; const r = rows.find(x => x.id === box.dataset.id); if (!r) return;
            if (a.dataset.a === 'show') { const v = box.querySelector('[data-val]'); v.textContent = v.textContent === MASK ? r.secret : MASK; }
            else if (a.dataset.a === 'copy') copy(r.secret, 'Passwort');
            else { const rc = a.getBoundingClientRect(); menu(r, rc.left, rc.bottom + 4); }
        });
        function menu(r, x, y) { API.ctx(x, y, [r.secret !== null && ['fa-copy', 'Passwort kopieren', () => copy(r.secret, 'Passwort')], r.username && ['fa-user', 'Benutzername kopieren', () => copy(r.username, 'Benutzername')], r.secret !== null && ['fa-pen', 'Bearbeiten', () => editor(r)], null, ['fa-trash-can', 'Löschen', () => del(r)]].filter(v => v !== false && v !== undefined && v !== '')); }
        body.addEventListener('contextmenu', ev => { const box = ev.target.closest('[data-id]'); if (!box) return; ev.preventDefault(); const r = rows.find(x => x.id === box.dataset.id); if (r) menu(r, ev.clientX, ev.clientY); });
        body.addEventListener('dblclick', ev => { const box = ev.target.closest('[data-id]'); if (!box || ev.target.closest('button, a')) return; const r = rows.find(x => x.id === box.dataset.id); if (r && r.secret !== null) editor(r); });
        ['keydown', 'pointerdown'].forEach(t => body.addEventListener(t, () => { last = Date.now(); }, true));
        const iv = setInterval(() => { if (!win.el.isConnected) return clearInterval(iv); if (!key) return; const left = 300000 - (Date.now() - last); if (left <= 0) return lock(); const e = $('.tv-eta'); if (e) e.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`; }, 1000);
        win.onClose = () => { off(); clearInterval(iv); key = null; rows = []; };
        locked();
    }
    let API = null;
    JMOS_LAZY.register('passwort', { ui, init(api, user) { API = api; U = user; } });
})();
