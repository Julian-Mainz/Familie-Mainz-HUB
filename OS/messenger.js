// OS/messenger.js – Messenger als eigene App im J.Mainz OS (nicht mehr die Dashboard-Seite im Fenster).
// Gleiche Daten wie im Dashboard: Chats, Nachrichten, Gelesen-Stand und Einstellungen kommen über js/messenger-core.js (MSG) aus Firestore.
// Extras im OS: Rechtsklick-Menüs, Dateien aus dem Explorer oder vom PC per Drag & Drop, Anhänge in „Dokumente“ speichern.
(function () {
    'use strict';
    let API, U, e;
    const M = () => window.MSG;
    const EMO = ['😀', '😂', '🥲', '😊', '😍', '😘', '😎', '🤔', '😅', '😉', '🙃', '😴', '😢', '😭', '😡', '🥳', '🤗', '🙄', '😬', '🤯', '👍', '👎', '👏', '🙏', '💪', '👋', '🤝', '✌️', '👌', '🤞', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '🔥', '✨', '🎉', '🎂', '🎁', '☕', '🍕', '🍺', '🍻', '⚽', '🎮', '🎵', '🚗', '✈️', '🏖️', '☀️', '🌧️', '❄️', '⏰', '📅', '✅', '❌', '⚠️', '❓', '💯', '👀', '🙈', '💤', '🐶', '🐱', '🌹', '🍀'];
    const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

    // Schlüsselbasiertes Aktualisieren (unveränderte Elemente bleiben stehen, kein Flackern)
    function patch(box, entries, animate) {
        const old = new Map(); [...box.children].forEach(el => { if (el._k) old.set(el._k, el); else el.remove(); });
        let prev = null;
        entries.forEach(({ k, html }) => {
            let el = old.get(k); old.delete(k);
            if (!el || el._h !== html) { const t = document.createElement('template'); t.innerHTML = html.trim(); const n = t.content.firstElementChild; n._k = k; n._h = html; if (!el && animate) n.classList.add('new'); if (el) el.replaceWith(n); el = n; }
            const want = prev ? prev.nextElementSibling : box.firstElementChild; if (el !== want) box.insertBefore(el, want); prev = el;
        });
        old.forEach(el => el.remove());
    }
    const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

    function ui(body, win) {
        const MS = M(), S = MS.state;
        let cur = null, msgs = new Map(), oldest = null, hasMore = false, unMsgs = null, unPres = null, replyTo = null, editing = null, staged = null;
        let firstRender = true, firstUnread = null, openUnread = 0, newBelow = 0, pres = { ms: 0, show: true }, lastSend = 0, readT = 0, listReady = false, hits = [], hitI = -1;
        const purged = new Set();
        body.innerHTML = `<div class="mx">
            <aside class="mx-side">
                <div class="mx-sh"><b>Chats</b><span class="mx-sp"></span>
                    <button type="button" class="mx-ib" data-x="new" title="Neuer Chat" aria-label="Neuer Chat"><i class="fa-solid fa-pen-to-square"></i></button>
                    ${can(U, 'gruppen') ? '<button type="button" class="mx-ib" data-x="group" title="Neue Gruppe" aria-label="Neue Gruppe"><i class="fa-solid fa-user-group"></i></button>' : ''}
                    <button type="button" class="mx-ib" data-x="set" title="Einstellungen" aria-label="Einstellungen"><i class="fa-solid fa-sliders"></i></button></div>
                <label class="mx-q"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Chats durchsuchen" aria-label="Chats durchsuchen"></label>
                <div class="mx-list" role="list"></div>
            </aside>
            <section class="mx-conv">
                <div class="mx-none"><i class="fa-solid fa-comments"></i><b>Messenger</b><span>Wähle links einen Chat oder starte mit <i class="fa-solid fa-pen-to-square"></i> einen neuen.</span></div>
                <div class="mx-chat" hidden>
                    <div class="mx-head"><span class="mx-hav"></span><div class="mx-ht"><b></b><small></small></div>
                        <button type="button" class="mx-ib" data-x="search" title="Im Chat suchen (Strg+F)" aria-label="Im Chat suchen"><i class="fa-solid fa-magnifying-glass"></i></button>
                        <button type="button" class="mx-ib" data-x="mute" title="Stummschalten" aria-label="Stummschalten"><i class="fa-solid fa-bell"></i></button>
                        <button type="button" class="mx-ib" data-x="info" title="Gruppeninfo" aria-label="Gruppeninfo"><i class="fa-solid fa-circle-info"></i></button></div>
                    <div class="mx-sbar" hidden><i class="fa-solid fa-magnifying-glass"></i><input placeholder="In diesem Chat suchen" aria-label="In diesem Chat suchen"><span class="mx-sc"></span>
                        <button type="button" class="mx-ib" data-x="sup" aria-label="Vorheriger Treffer"><i class="fa-solid fa-chevron-up"></i></button><button type="button" class="mx-ib" data-x="sdown" aria-label="Nächster Treffer"><i class="fa-solid fa-chevron-down"></i></button><button type="button" class="mx-ib" data-x="sclose" aria-label="Suche schließen"><i class="fa-solid fa-xmark"></i></button></div>
                    <div class="mx-scroll" tabindex="0"></div>
                    <button type="button" class="mx-jump" hidden><i class="fa-solid fa-arrow-down"></i><span>0</span> neu</button>
                    <div class="mx-bar" hidden></div>
                    <div class="mx-comp">
                        <button type="button" class="mx-ib" data-x="attach" title="Anhängen" aria-label="Anhängen"><i class="fa-solid fa-paperclip"></i></button>
                        <button type="button" class="mx-ib" data-x="emo" title="Emoji" aria-label="Emoji"><i class="fa-regular fa-face-smile"></i></button>
                        <textarea rows="1" maxlength="2000" placeholder="Nachricht schreiben …" aria-label="Nachricht"></textarea>
                        <button type="button" class="mx-send" data-x="send" title="Senden (Enter)" aria-label="Senden"><i class="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>
                <div class="mx-drop" hidden><i class="fa-solid fa-cloud-arrow-up"></i>Hier loslassen zum Anhängen</div>
            </section>
            <input type="file" class="mx-fimg" accept="image/*" hidden><input type="file" class="mx-ffile" hidden>
            <div class="mx-layer"></div></div>`;
        const $ = s => body.querySelector(s), list = $('.mx-list'), sc = $('.mx-scroll'), ta = $('.mx-comp textarea'), layer = $('.mx-layer');
        const nameOf = uid => (S.dir[uid] && S.dir[uid].name) || 'Gelöschtes Konto';
        const title = c => MS.chatTitle(c, S.dir, S.me);
        const avatar = (uid, cls = '') => { const d = S.dir[uid] || {}, ok = PHOTO_OK.test(d.thumb || ''); return `<span class="mx-av ${cls}" style="background:${avatarGradient(d.color)}">${ok ? `<img src="${d.thumb}" alt="">` : e(initialsOf(d.name || '?'))}</span>`; };
        const chatAv = (c, cls = '') => c.type === 'group' ? `<span class="mx-av ${cls}" style="background:${avatarGradient(hash(c.id))}"><i class="fa-solid fa-users"></i></span>` : avatar((c.members || []).find(u => u !== S.me), cls);
        const toast = (msg, bad) => { const t = document.createElement('div'); t.className = 'mx-toast' + (bad ? ' bad' : ''); t.textContent = msg; body.querySelector('.mx').appendChild(t); setTimeout(() => t.remove(), 3200); };
        const setTitle = () => { const n = MS.totalUnread(S.chats, S.meta); win.el.querySelector('.wt-title').textContent = (cur ? title(cur) + ' – ' : '') + 'Messenger' + (n ? ` (${n})` : ''); };

        // ---------- Dialoge im Fenster ----------
        function modal(html, lock) {
            layer.innerHTML = `<div class="mx-mod"><div class="mx-box">${html}</div></div>`; const m = layer.firstChild;
            if (!lock) m.addEventListener('mousedown', ev => { if (ev.target === m) closeModal(); }); return m.firstChild;
        }
        const closeModal = () => { layer.innerHTML = ''; };
        const pop = (html, anchor, cls = '') => { closePop(); const p = document.createElement('div'); p.className = 'mx-pop ' + cls; p.innerHTML = html; body.querySelector('.mx').appendChild(p);
            const r = anchor.getBoundingClientRect(), br = body.getBoundingClientRect(); p.style.left = Math.max(8, Math.min(r.left - br.left, br.width - p.offsetWidth - 8)) + 'px'; p.style.top = Math.max(8, r.top - br.top - p.offsetHeight - 8) + 'px'; return p; };
        const closePop = () => body.querySelectorAll('.mx-pop').forEach(p => p.remove());

        function showRules() {
            const b = modal(`<h3><i class="fa-solid fa-shield-halved"></i>Nutzungsregeln</h3><ul class="mx-rules">
                <li>Der Messenger ist für den normalen Austausch gedacht. <b>Keine Passwörter oder vertraulichen Daten</b> darüber schicken.</li>
                <li>Nachrichten werden verschlüsselt übertragen und bei Google (Firebase) gespeichert. <b>Technisch hat der Betreiber des Portals Zugriff.</b> In der App kann niemand fremde Chats lesen.</li>
                <li>Nachrichten werden nach <b>90 Tagen</b> gelöscht. Eigene kannst du jederzeit bearbeiten oder löschen.</li>
                <li>Andere sehen deinen Namen und dein Profilbild. Ob sie „zuletzt aktiv“ und Gelesen-Haken sehen, stellst du selbst ein.</li>
                <li>Sei freundlich. Wer den Messenger missbraucht, verliert den Zugang.</li></ul>
                <div class="mx-acts"><button type="button" class="btn" data-m="close">Fenster schließen</button><button type="button" class="btn pri" data-m="ok">Verstanden, weiter</button></div>`, true);
            b.addEventListener('click', async ev => { const k = ev.target.closest('[data-m]'); if (!k) return; if (k.dataset.m === 'close') return API.closeWin(win, true);
                try { await MS.acceptRules(); closeModal(); } catch (x) { toast('Konnte nicht gespeichert werden: ' + (x.code || x.message), true); } });
        }

        // ---------- Chatliste ----------
        function renderList() {
            const term = ($('.mx-q input').value || '').trim().toLowerCase();
            let L = S.chats.filter(c => !term || title(c).toLowerCase().includes(term));
            if (cur && cur.isNew && !S.chats.find(c => c.id === cur.id)) L = [Object.assign({ lastMs: Date.now() }, cur), ...L];
            const ent = L.map(c => { const n = MS.unreadCount(c, S.meta), mu = MS.isMuted(c, S.meta), on = cur && cur.id === c.id;
                return { k: c.id, html: `<button type="button" class="mx-it${on ? ' on' : ''}${n && !mu ? ' unread' : ''}" data-id="${e(c.id)}">${chatAv(c)}<span class="mx-im"><span class="mx-r"><b>${e(title(c))}</b><time>${MS.listTime(c.lastMs)}</time></span>
                    <span class="mx-r"><span class="mx-pv">${e(c.isNew ? 'Neuer Chat' : MS.previewLine(c, S.dir, S.me))}</span>${n && !on ? `<em class="mx-bd${mu ? ' mute' : ''}">${n > 99 ? '99+' : n}</em>` : mu ? '<i class="fa-solid fa-bell-slash mx-mu"></i>' : ''}</span></span></button>` }; });
            if (!ent.length) ent.push({ k: 'empty', html: `<p class="mx-empty">${term ? 'Keine Chats gefunden.' : S.ready ? 'Noch keine Chats. Starte oben mit dem Stift einen neuen.' : '<i class="fa-solid fa-spinner fa-spin"></i> Wird geladen …'}</p>` });
            patch(list, ent, listReady); listReady = S.ready; setTitle();
        }
        let dirAt = Date.now(), dirBusy = false;
        function onState() {
            if (!win.el.isConnected) return off();
            if (cur) { const f = S.chats.find(c => c.id === cur.id);
                if (f) { const wasNew = cur.isNew; cur = f; if (wasNew) attach(); renderHead(); renderMsgs(); scheduleRead(); }
                else if (!cur.isNew) { closeChat(); toast('Dieser Chat ist nicht mehr verfügbar.', true); } }
            renderList();
            if (!dirBusy && Date.now() - dirAt > 300000 && S.chats.some(c => (c.members || []).some(u => !S.dir[u]))) { dirBusy = true; dirAt = Date.now(); MS.loadDirectory().then(() => { renderList(); renderHead(); renderMsgs(0, true); }).catch(() => {}).finally(() => { dirBusy = false; }); }
        }

        // ---------- Chat öffnen ----------
        function openChat(id, draft) {
            const c = S.chats.find(x => x.id === id) || draft; if (!c) return;
            detach(); cur = c; S.active = id; replyTo = editing = staged = null; hits = []; hitI = -1; search(false);
            msgs = new Map(); oldest = null; hasMore = false; firstRender = true; newBelow = 0; firstUnread = null; openUnread = c.isNew ? 0 : MS.unreadCount(c, S.meta); pres = { ms: 0, show: true };
            ta.value = ''; grow(); renderBar(); $('.mx-none').hidden = true; $('.mx-chat').hidden = false;
            renderHead(); renderMsgs(); renderList();
            if (!c.isNew) { attach(); if (!purged.has(id)) { purged.add(id); MS.purgeExpired(id); } }
            if (c.type === 'dm') { const o = c.members.find(u => u !== S.me); unPres = MS.watchPresence(o, (t, show) => { pres = { ms: t, show }; renderHead(); }); }
            setTimeout(() => ta.focus(), 40);
        }
        function openDM(uid) { closeModal(); const id = MS.dmId(S.me, uid), ex = S.chats.find(c => c.id === id); openChat(id, ex ? undefined : { id, type: 'dm', members: MS.dmMembers(S.me, uid), isNew: true, seq: 0, reads: {}, last: null, lastMs: Date.now() }); }
        function detach() { if (unMsgs) unMsgs(); if (unPres) unPres(); unMsgs = unPres = null; }
        function closeChat() { detach(); cur = null; S.active = null; $('.mx-chat').hidden = true; $('.mx-none').hidden = false; renderList(); }
        const toMsg = d => ({ id: d.id, ...d.data(), createdMs: MS.ms(d.data().createdAt) || Date.now(), pending: d.metadata.hasPendingWrites });
        function attach() {
            if (unMsgs || !cur) return; const id = cur.id;
            unMsgs = db.collection('chats').doc(id).collection('messages').orderBy('createdAt', 'desc').limit(40).onSnapshot({ includeMetadataChanges: true }, snap => {
                if (!cur || cur.id !== id) return; const inc = [];
                snap.docChanges({ includeMetadataChanges: true }).forEach(ch => { if (ch.type !== 'removed') { const m = toMsg(ch.doc); if (!msgs.has(m.id)) inc.push(m); msgs.set(m.id, m); } });
                if (!oldest && snap.docs.length) { oldest = snap.docs[snap.docs.length - 1]; hasMore = snap.docs.length >= 40; }
                if (firstRender && openUnread > 0) { const arr = [...msgs.values()].sort((a, b) => a.createdMs - b.createdMs); if (openUnread <= arr.length) firstUnread = arr[arr.length - openUnread].id; }
                renderMsgs(inc.filter(m => m.from !== S.me && !firstRender).length); scheduleRead();
            }, err => toast('Nachrichten konnten nicht geladen werden: ' + (err.code || err.message), true));
        }
        async function loadOlder() {
            if (!oldest || !cur) return; const prev = sc.scrollHeight;
            try { const snap = await db.collection('chats').doc(cur.id).collection('messages').orderBy('createdAt', 'desc').startAfter(oldest).limit(40).get();
                snap.docs.forEach(d => msgs.set(d.id, toMsg(d))); if (snap.docs.length) oldest = snap.docs[snap.docs.length - 1]; hasMore = snap.docs.length >= 40;
                renderMsgs(0, true); sc.scrollTop += sc.scrollHeight - prev; } catch (x) { toast('Ältere Nachrichten konnten nicht geladen werden.', true); }
        }
        function scheduleRead() { clearTimeout(readT); readT = setTimeout(() => { if (cur && !document.hidden && win.el.classList.contains('focus')) MS.markRead(cur); }, 350); }

        function renderHead() {
            if (!cur) return; const dm = cur.type === 'dm'; let st = '', on = false;
            if (dm) { if (pres.show && S.self.showSeen !== false && pres.ms) { st = MS.lastSeenLabel(pres.ms); on = MS.isOnline(pres.ms); } } else st = `${cur.members.length} Mitglieder`;
            $('.mx-ht b').textContent = title(cur); const s = $('.mx-ht small'); s.textContent = st; s.className = on ? 'on' : '';
            const h = chatAv(cur).replace(/<\/span>$/, on ? '<i class="mx-dot"></i></span>' : '</span>'); if ($('.mx-hav')._h !== h) { $('.mx-hav').innerHTML = h; $('.mx-hav')._h = h; }
            $('[data-x="info"]').hidden = dm; const mu = MS.isMuted(cur, S.meta), b = $('[data-x="mute"]'); b.classList.toggle('on', mu); b.querySelector('i').className = 'fa-solid ' + (mu ? 'fa-bell-slash' : 'fa-bell'); b.title = mu ? 'Stummschaltung aufheben' : 'Stummschalten';
            setTitle();
        }

        // ---------- Nachrichten ----------
        const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
        function tick(m) { const t = MS.ticks(m, cur, S.me, S.self.receipts !== false);
            return t.state === 'pending' ? '<i class="fa-regular fa-clock" title="Wird gesendet"></i>' : t.state === 'read' ? '<i class="fa-solid fa-check-double read" title="Gelesen"></i>' : `<i class="fa-solid ${t.n ? 'fa-check-double' : 'fa-check'}" title="${t.n ? `Gelesen von ${t.n} von ${t.total}` : 'Gesendet'}"></i>`; }
        function msgHtml(it) {
            const m = it.m, rs = MS.reactionSummary(m, S.me), grp = cur.type === 'group', img = m.image && PHOTO_OK.test(m.image);
            const q = m.replyTo ? `<div class="mx-quote" data-goto="${e(m.replyTo.id)}"><b>${e(nameOf(m.replyTo.from))}</b><span>${e(m.replyTo.text || (m.replyTo.image ? 'Bild' : ''))}</span></div>` : '';
            const bodyH = m.deleted ? '<span class="mx-del"><i class="fa-solid fa-ban"></i> Nachricht gelöscht</span>'
                : (img ? `<img class="mx-img" src="${m.image}" data-zoom="1" alt="Bild">` : '') + (m.file && m.file.name ? `<button type="button" class="mx-file" data-file="${e(m.id)}"><i class="fa-solid fa-file-arrow-down"></i><span><b>${e(m.file.name)}</b><small>${fmtSize(m.file.size || 0)} · Rechtsklick für mehr</small></span></button>` : '')
                + (m.text ? `<div class="mx-t">${MS.linkify(m.text)}</div>` : '');
            const av = !it.mine && grp ? (it.last ? avatar(m.from, 'sm') : '<span class="mx-avsp"></span>') : '';
            const tools = m.deleted || m.pending ? '' : '<div class="mx-tools"><button type="button" data-a="react" aria-label="Reagieren"><i class="fa-regular fa-face-smile"></i></button><button type="button" data-a="reply" aria-label="Antworten"><i class="fa-solid fa-reply"></i></button><button type="button" data-a="more" aria-label="Mehr"><i class="fa-solid fa-ellipsis"></i></button></div>';
            return `<div class="mx-m${it.mine ? ' mine' : ''}${it.first ? ' first' : ''}" data-id="${e(m.id)}">${av}<div class="mx-b">${tools}${it.showName ? `<span class="mx-nm">${e(nameOf(m.from))}</span>` : ''}${q}${bodyH}
                <div class="mx-info">${m.editedAt && !m.deleted ? '<span>bearbeitet</span>' : ''}<time>${MS.hhmm(m.createdMs)}</time>${it.mine && !m.deleted ? tick(m) : ''}</div>
                ${rs.length && !m.deleted ? `<div class="mx-rx">${rs.map(r => `<button type="button" data-react="${e(r.emoji)}" class="${r.mine ? 'me' : ''}">${e(r.emoji)}${r.n > 1 ? ' ' + r.n : ''}</button>`).join('')}</div>` : ''}</div></div>`;
        }
        function renderMsgs(fresh = 0, keep = false) {
            if (!cur) return; const atBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 90;
            const arr = [...msgs.values()].sort((a, b) => a.createdMs - b.createdMs), items = MS.layout(arr, S.me, { group: cur.type === 'group', unreadFromId: firstUnread });
            const lastMine = arr.length && arr[arr.length - 1].from === S.me && arr[arr.length - 1].pending, ent = [];
            if (hasMore) ent.push({ k: 'more', html: '<button type="button" class="mx-more">Ältere Nachrichten laden</button>' });
            if (items.length) items.forEach(it => ent.push(it.type === 'day' ? { k: it.key, html: `<div class="mx-day"><span>${e(it.label)}</span></div>` } : it.type === 'unread' ? { k: 'unread', html: '<div class="mx-unr"><span>Neue Nachrichten</span></div>' } : { k: 'm' + it.m.id, html: msgHtml(it) }));
            else ent.push({ k: 'empty', html: `<div class="mx-hello"><i class="fa-regular fa-hand"></i><b>${cur.isNew ? 'Neuer Chat' : 'Noch keine Nachrichten'}</b><span>Schreib die erste Nachricht an ${e(title(cur))}.</span></div>` });
            patch(sc, ent, !firstRender && !keep); if (hits.length || $('.mx-sbar input').value.trim()) mark();
            if (keep) return;
            if (firstRender && arr.length) { const u = sc.querySelector('.mx-unr'); if (u) u.scrollIntoView({ block: 'center' }); else sc.scrollTop = sc.scrollHeight; firstRender = false; }
            else if (atBottom || lastMine) down();
            else if (fresh) { newBelow += fresh; $('.mx-jump span').textContent = newBelow; $('.mx-jump').hidden = false; }
        }
        const down = smooth => { sc.scrollTo({ top: sc.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); newBelow = 0; $('.mx-jump').hidden = true; };
        sc.addEventListener('scroll', () => { if (sc.scrollHeight - sc.scrollTop - sc.clientHeight < 90) { newBelow = 0; $('.mx-jump').hidden = true; } }, { passive: true });
        $('.mx-jump').addEventListener('click', () => down(true));
        sc.addEventListener('load', ev => { if (ev.target.tagName === 'IMG' && sc.scrollHeight - sc.scrollTop - sc.clientHeight < ev.target.offsetHeight + 140) down(); }, true);          // Bild nachgeladen: unten bleiben

        // ---------- Aktionen an Nachrichten ----------
        const dataBlob = f => { const [h, b64] = f.data.split(','), bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return { bytes: u, blob: new Blob([u], { type: (/data:([^;]+)/.exec(h) || [])[1] || f.mime || '' }) }; };
        function download(f) { const a = Object.assign(document.createElement('a'), { href: f.data, download: f.name || 'Datei' }); document.body.appendChild(a); a.click(); a.remove(); }
        async function toDocs(name, bytes) {
            if (!window.JMOS_FILES || !can(U, 'dokumente')) return toast('Zum Speichern brauchst du die Berechtigung „Dokumente“.', true);
            try { await JMOS_FILES.createText(name, bytes, ''); toast(`„${name}“ liegt jetzt in deinen Dokumenten`); } catch (x) { toast('Speichern fehlgeschlagen: ' + x.message, true); }
        }
        function msgMenu(id, x, y) {
            const m = msgs.get(id); if (!m || m.deleted) return; const mine = m.from === S.me;
            const img = !!(m.image && PHOTO_OK.test(m.image)), f = m.file && /^data:/.test(m.file.data || '') ? m.file : null, hasF = !!f;
            API.ctx(x, y, [['fa-reply', 'Antworten', () => startReply(id)], ['fa-face-smile', 'Reagieren …', () => react(id, sc.querySelector(`.mx-m[data-id="${CSS.escape(id)}"] .mx-b`))],
                !!m.text && ['fa-copy', 'Text kopieren', async () => { try { await navigator.clipboard.writeText(m.text); toast('Text kopiert'); } catch (er) { toast('Kopieren nicht möglich.', true); } }],
                img && null, img && ['fa-download', 'Bild herunterladen', () => download({ data: m.image, name: 'Bild.jpg' })], img && ['fa-folder-plus', 'Bild in Dokumente speichern', () => toDocs(`Chatbild ${new Date(m.createdMs).toLocaleDateString('de-DE').replace(/\./g, '-')}.jpg`, dataBlob({ data: m.image }).bytes)],
                hasF && null, hasF && ['fa-download', 'Datei herunterladen', () => download(f)], hasF && ['fa-folder-plus', 'In Dokumente speichern', () => toDocs(f.name, dataBlob(f).bytes)],
                mine && null, mine && !!m.text && !m.image && ['fa-pen', 'Bearbeiten', () => { editing = m; replyTo = null; ta.value = m.text; grow(); renderBar(); ta.focus(); }],
                mine && ['fa-trash-can', 'Für alle löschen', async () => { if (await uiConfirm('Diese Nachricht für alle löschen?', { danger: true, ok: 'Löschen' })) try { await MS.remove(cur, id); } catch (er) { toast('Löschen fehlgeschlagen: ' + (er.code || er.message), true); } }]].filter(v => v !== false && v !== undefined && v !== ''));
        }
        function react(id, anchor) {
            const p = pop(QUICK.map(x => `<button type="button" data-e="${x}">${x}</button>`).join('') + '<button type="button" data-e="+" aria-label="Mehr Emojis"><i class="fa-solid fa-plus"></i></button>', anchor || sc, 'mx-qr');
            p.addEventListener('click', ev => { const b = ev.target.closest('[data-e]'); if (!b) return; if (b.dataset.e === '+') { closePop(); return emojiPop(anchor || sc, em => doReact(id, em)); } closePop(); doReact(id, b.dataset.e); });
        }
        async function doReact(id, em) { const m = msgs.get(id); if (!m || !cur) return; try { await MS.react(cur, m, em); } catch (x) { toast('Reaktion fehlgeschlagen: ' + (x.code || x.message), true); } }
        function emojiPop(anchor, pick) { const p = pop(`<div class="mx-emo">${EMO.map(x => `<button type="button" data-e="${x}">${x}</button>`).join('')}</div>`, anchor, 'mx-ep'); p.addEventListener('click', ev => { const b = ev.target.closest('[data-e]'); if (b) pick(b.dataset.e, p); }); }
        function gotoMsg(id) { const el = sc.querySelector(`.mx-m[data-id="${CSS.escape(id)}"]`); if (!el) return toast('Diese Nachricht ist nicht mehr geladen.'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
        function zoom(src) { if (!PHOTO_OK.test(src)) return; const d = document.createElement('div'); d.className = 'mx-lb'; d.innerHTML = `<img src="${src}" alt="Bild"><span>Klicken zum Schließen · Rechtsklick auf die Nachricht zum Speichern</span>`; d.onclick = () => d.remove(); body.querySelector('.mx').appendChild(d); }
        sc.addEventListener('click', ev => {
            if (ev.target.closest('.mx-more')) return loadOlder();
            const z = ev.target.closest('[data-zoom]'); if (z) return zoom(z.src);
            const fb = ev.target.closest('[data-file]'); if (fb) { const m = msgs.get(fb.dataset.file); if (m && m.file && /^data:/.test(m.file.data || '')) download(m.file); return; }
            const g = ev.target.closest('[data-goto]'); if (g) return gotoMsg(g.dataset.goto);
            const row = ev.target.closest('.mx-m'), rx = ev.target.closest('[data-react]'); if (rx && row) return doReact(row.dataset.id, rx.dataset.react);
            const a = ev.target.closest('[data-a]'); if (a && row) { ev.stopPropagation(); if (a.dataset.a === 'react') return react(row.dataset.id, a); if (a.dataset.a === 'reply') return startReply(row.dataset.id); const r = a.getBoundingClientRect(); return msgMenu(row.dataset.id, r.left, r.bottom + 4); }
        });
        sc.addEventListener('contextmenu', ev => { const row = ev.target.closest('.mx-m'); if (!row || ev.target.closest('a')) return; ev.preventDefault(); msgMenu(row.dataset.id, ev.clientX, ev.clientY); });
        sc.addEventListener('dblclick', ev => { const row = ev.target.closest('.mx-m'); if (row && !ev.target.closest('a, img, button')) startReply(row.dataset.id); });
        function startReply(id) { const m = msgs.get(id); if (!m) return; replyTo = m; editing = null; renderBar(); ta.focus(); }
        function cancelBar() { replyTo = null; if (editing) { editing = null; ta.value = ''; grow(); } staged = null; renderBar(); }
        function renderBar() {
            const b = $('.mx-bar'); let h = '';
            if (editing) h = `<i class="fa-solid fa-pen"></i><div class="q"><b>Nachricht bearbeiten</b><span>${e(editing.text)}</span></div>`;
            else if (replyTo) h = `<i class="fa-solid fa-reply"></i><div class="q"><b>Antwort an ${e(nameOf(replyTo.from))}</b><span>${e(replyTo.text || (replyTo.image ? 'Bild' : replyTo.file ? replyTo.file.name : ''))}</span></div>`;
            if (staged) h += staged.image ? `<img src="${staged.image}" alt="Vorschau"><span class="mx-stg">Bild angehängt</span>` : `<i class="fa-solid fa-file"></i><span class="mx-stg">${e(staged.file.name)} · ${fmtSize(staged.file.size)}</span>`;
            b.innerHTML = h ? h + '<button type="button" class="mx-ib" data-x="cancel" aria-label="Abbrechen"><i class="fa-solid fa-xmark"></i></button>' : ''; b.hidden = !h;
        }

        // ---------- Schreiben ----------
        function grow() { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; }
        ta.addEventListener('input', grow);
        ta.addEventListener('keydown', ev => {
            if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); send(); }
            else if (ev.key === 'Escape' && (editing || replyTo || staged)) { ev.stopPropagation(); cancelBar(); }
            else if (ev.key === 'ArrowUp' && !ta.value && cur) { const last = [...msgs.values()].filter(m => m.from === S.me && m.text && !m.image && !m.deleted).sort((a, b) => b.createdMs - a.createdMs)[0]; if (last) { ev.preventDefault(); editing = last; replyTo = null; ta.value = last.text; grow(); renderBar(); } }
        });
        ta.addEventListener('paste', ev => { const f = [...((ev.clipboardData && ev.clipboardData.files) || [])][0]; if (f) { ev.preventDefault(); stage(f, f.name); } });
        async function stage(blob, name) {
            if (!cur) return;
            try { if ((blob.type || '').startsWith('image/') && !/svg/.test(blob.type)) staged = { image: await MS.compressImage(blob instanceof File ? blob : new File([blob], name || 'Bild', { type: blob.type })) };
                else staged = { file: await MS.fileToAttachment(blob, name) };
                renderBar(); ta.focus(); } catch (x) { toast(x.message, true); }
        }
        async function send() {
            if (!cur || Date.now() - lastSend < 350) return; const text = ta.value;
            try {
                if (editing) { if (!text.trim()) return toast('Der Text darf nicht leer sein.', true); const ed = editing; editing = null; ta.value = ''; grow(); renderBar(); await MS.edit(cur, ed.id, text); return; }
                if (!text.trim() && !staged) return; lastSend = Date.now();
                const r = replyTo ? { id: replyTo.id, from: replyTo.from, text: (replyTo.deleted ? '' : replyTo.text || (replyTo.file ? replyTo.file.name : '')).slice(0, 120), image: !!replyTo.image } : null, st = staged;
                ta.value = ''; grow(); replyTo = staged = null; renderBar(); const wasNew = cur.isNew;
                await MS.send(cur, Object.assign({ text, replyTo: r }, st || {})); if (wasNew) { cur.isNew = false; attach(); } down();
            } catch (x) { toast('Senden fehlgeschlagen: ' + (x.code || x.message), true); ta.value = text; grow(); }
        }
        $('.mx-fimg').addEventListener('change', ev => { const f = ev.target.files[0]; ev.target.value = ''; if (f) stage(f, f.name); });
        $('.mx-ffile').addEventListener('change', ev => { const f = ev.target.files[0]; ev.target.value = ''; if (f) stage(f, f.name); });
        function attachMenu(btn) {
            const r = btn.getBoundingClientRect();
            API.ctx(r.left, r.top - 8, [['fa-image', 'Bild vom PC …', () => $('.mx-fimg').click()], ['fa-file', 'Datei vom PC … (bis 500 KB)', () => $('.mx-ffile').click()],
                window.JMOS_FILES && can(U, 'dokumente') && ['fa-folder-open', 'Aus meinen Dokumenten …', pickDoc]].filter(Boolean));
        }
        function pickDoc() {
            const files = JMOS_FILES.all().filter(f => f.own && f.size <= 4 * 1024 * 1024).sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 200);
            const b = modal(`<h3><i class="fa-solid fa-folder-open"></i>Aus Dokumenten anhängen</h3><input class="mx-in" placeholder="Datei suchen" aria-label="Datei suchen">
                <div class="mx-pl">${files.map(f => `<button type="button" class="mx-p" data-k="${e(f.key)}" data-s="${e(f.name.toLowerCase())}"><i class="fa-solid ${/\.(jpe?g|png|webp|gif)$/i.test(f.name) ? 'fa-image' : 'fa-file'}"></i><span class="n">${e(f.name)}</span><small>${fmtSize(f.size || 0)}</small></button>`).join('') || '<p class="mx-empty">Keine Dateien.</p>'}</div>
                <p class="mx-hint">Bilder werden verkleinert, andere Dateien gehen bis 500 KB. Tipp: Du kannst Dateien auch aus dem Explorer in den Chat ziehen.</p><div class="mx-acts"><button type="button" class="btn" data-m="x">Abbrechen</button></div>`);
            const q = b.querySelector('.mx-in'); q.focus(); q.addEventListener('input', () => { const v = q.value.toLowerCase(); b.querySelectorAll('[data-s]').forEach(x => { x.hidden = !x.dataset.s.includes(v); }); });
            b.addEventListener('click', async ev => { if (ev.target.closest('[data-m]')) return closeModal(); const k = ev.target.closest('[data-k]'); if (!k) return; closeModal(); fromKey(k.dataset.k); });
        }
        async function fromKey(key) { try { const { blob, name } = await JMOS_FILES.blobOf(key); stage(blob, name); } catch (x) { toast('Datei konnte nicht gelesen werden: ' + x.message, true); } }
        // Drag & Drop: Dateien vom PC und aus dem Explorer
        const conv = $('.mx-conv'), drop = $('.mx-drop'); let dragN = 0;
        const dragOk = ev => cur && ev.dataTransfer && [...ev.dataTransfer.types].some(t => t === 'Files' || t === 'text/x-jmos-file');
        conv.addEventListener('dragenter', ev => { if (!dragOk(ev)) return; ev.preventDefault(); dragN++; drop.hidden = false; });
        conv.addEventListener('dragover', ev => { if (dragOk(ev)) ev.preventDefault(); });
        conv.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; drop.hidden = true; } });
        conv.addEventListener('drop', ev => { if (!dragOk(ev)) return; ev.preventDefault(); dragN = 0; drop.hidden = true;
            const key = ev.dataTransfer.getData('text/x-jmos-file'); if (key) return fromKey(key); const f = ev.dataTransfer.files[0]; if (f) stage(f, f.name); });

        // ---------- Suche im Chat ----------
        function search(on) { const bar = $('.mx-sbar'); bar.hidden = !on; if (on) { const i = bar.querySelector('input'); i.focus(); i.select(); } else { bar.querySelector('input').value = ''; hits = []; hitI = -1; mark(); } }
        function runSearch() { const q = $('.mx-sbar input').value.trim(); hits = q ? [...msgs.values()].filter(m => MS.matches(m, q)).sort((a, b) => a.createdMs - b.createdMs).map(m => m.id) : []; hitI = hits.length - 1; mark(); goHit(); }
        function goHit() { if (hitI < 0) return; const el = sc.querySelector(`.mx-m[data-id="${CSS.escape(hits[hitI])}"]`); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        function mark() {
            sc.querySelectorAll('mark').forEach(m => m.replaceWith(document.createTextNode(m.textContent))); sc.querySelectorAll('.mx-t').forEach(t => t.normalize()); sc.querySelectorAll('.hit,.hitcur').forEach(x => x.classList.remove('hit', 'hitcur'));
            const q = $('.mx-sbar input').value.trim(); $('.mx-sc').textContent = !q ? '' : hits.length ? `${hitI + 1} von ${hits.length}${hasMore ? '+' : ''}` : 'Keine Treffer';
            if (!q) return; const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            hits.forEach((id, i) => { const el = sc.querySelector(`.mx-m[data-id="${CSS.escape(id)}"]`); if (!el) return; el.classList.add(i === hitI ? 'hitcur' : 'hit'); const t = el.querySelector('.mx-t'); if (!t) return;
                const tw = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), ns = []; while (tw.nextNode()) ns.push(tw.currentNode);
                ns.forEach(n => { re.lastIndex = 0; if (!re.test(n.nodeValue)) return; re.lastIndex = 0; const f = document.createDocumentFragment(); let last = 0; n.nodeValue.replace(re, (m, idx) => { f.append(n.nodeValue.slice(last, idx)); const mk = document.createElement('mark'); mk.textContent = m; f.append(mk); last = idx + m.length; return m; }); f.append(n.nodeValue.slice(last)); n.replaceWith(f); }); });
        }
        $('.mx-sbar input').addEventListener('input', runSearch);
        $('.mx-sbar input').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); if (hits.length) { hitI = (hitI + (ev.shiftKey ? 1 : -1) + hits.length) % hits.length; mark(); goHit(); } } else if (ev.key === 'Escape') { ev.stopPropagation(); search(false); ta.focus(); } });

        // ---------- Neuer Chat, Gruppen, Einstellungen ----------
        const people = () => Object.values(S.dir).filter(p => p.uid !== S.me).sort((a, b) => a.name.localeCompare(b.name, 'de'));
        const peopleHtml = (L, check) => L.map(p => `<button type="button" class="mx-p" data-u="${e(p.uid)}" data-s="${e(p.name.toLowerCase())}">${avatar(p.uid)}<span class="n">${e(p.name)}</span>${check ? '<input type="checkbox" tabindex="-1">' : ''}</button>`).join('') || '<p class="mx-empty">Noch niemand freigegeben.</p>';
        const filterBox = b => { const q = b.querySelector('.mx-in'); if (q) q.addEventListener('input', () => { const v = q.value.toLowerCase(); b.querySelectorAll('.mx-pl [data-s]').forEach(x => { x.hidden = !x.dataset.s.includes(v); }); }); };
        const toggleCheck = (b, ev) => { const p = ev.target.closest('[data-u]'); if (p) { const i = p.querySelector('input'); if (ev.target !== i) i.checked = !i.checked; } };
        const checked = b => [...b.querySelectorAll('.mx-p')].filter(x => x.querySelector('input') && x.querySelector('input').checked).map(x => x.dataset.u);
        async function newChat() {
            try { await MS.loadDirectory(); } catch (x) {}
            const b = modal(`<h3><i class="fa-solid fa-pen-to-square"></i>Neuer Chat</h3><input class="mx-in" placeholder="Name suchen" aria-label="Name suchen"><div class="mx-pl">${peopleHtml(people())}</div><div class="mx-acts"><button type="button" class="btn" data-m="x">Abbrechen</button></div>`);
            filterBox(b); b.querySelector('.mx-in').focus(); b.addEventListener('click', ev => { if (ev.target.closest('[data-m]')) return closeModal(); const p = ev.target.closest('[data-u]'); if (p) openDM(p.dataset.u); });
        }
        async function newGroup() {
            try { await MS.loadDirectory(); } catch (x) {}
            const b = modal(`<h3><i class="fa-solid fa-user-group"></i>Neue Gruppe</h3><input class="mx-in" maxlength="60" placeholder="Gruppenname" aria-label="Gruppenname" data-t><div class="mx-pl">${peopleHtml(people(), true)}</div><div class="mx-acts"><button type="button" class="btn" data-m="x">Abbrechen</button><button type="button" class="btn pri" data-m="ok">Gruppe erstellen</button></div>`);
            b.querySelector('[data-t]').focus();
            b.addEventListener('click', async ev => { toggleCheck(b, ev); const k = ev.target.closest('[data-m]'); if (!k) return; if (k.dataset.m === 'x') return closeModal();
                const t = b.querySelector('[data-t]').value.trim(), ids = checked(b); if (!t) return toast('Bitte einen Gruppennamen eingeben.', true); if (!ids.length) return toast('Wähle mindestens ein Mitglied.', true); if (ids.length > 29) return toast('Höchstens 30 Mitglieder.', true);
                k.disabled = true; try { const id = await MS.createGroup(t, ids); closeModal(); const un = MS.subscribe(() => { if (S.chats.find(x => x.id === id)) { un(); openChat(id); } }); } catch (x) { k.disabled = false; toast('Gruppe konnte nicht erstellt werden: ' + (x.code || x.message), true); } });
        }
        function info() {
            if (!cur || cur.type !== 'group') return; const mine = cur.createdBy === S.me;
            const b = modal(`<h3><i class="fa-solid fa-users"></i>${e(cur.title || 'Gruppe')}</h3><p class="mx-hint">${cur.members.length} Mitglieder</p>
                ${mine ? `<div class="mx-row"><input class="mx-in" maxlength="60" value="${e(cur.title || '')}" aria-label="Gruppenname" data-t><button type="button" class="btn" data-m="ren">Umbenennen</button></div>` : ''}
                <div class="mx-pl">${cur.members.map(u => `<div class="mx-p">${avatar(u)}<span class="n">${e(nameOf(u))}${u === S.me ? ' (du)' : ''}${u === cur.createdBy ? ' <small>· Ersteller</small>' : ''}</span>${mine && u !== S.me ? `<button type="button" class="mx-ib" data-rm="${e(u)}" aria-label="Entfernen"><i class="fa-solid fa-user-minus"></i></button>` : ''}</div>`).join('')}</div>
                <div class="mx-acts">${mine ? '<button type="button" class="btn" data-m="add"><i class="fa-solid fa-user-plus"></i>Mitglieder hinzufügen</button>' : '<button type="button" class="btn bad" data-m="leave">Gruppe verlassen</button>'}<button type="button" class="btn" data-m="x">Schließen</button></div>`);
            b.addEventListener('click', async ev => {
                const rm = ev.target.closest('[data-rm]'); if (rm) { if (await uiConfirm('Dieses Mitglied entfernen?', { danger: true, ok: 'Entfernen' })) try { await MS.updateGroup(cur, { members: cur.members.filter(u => u !== rm.dataset.rm) }); closeModal(); } catch (x) { toast('Fehlgeschlagen: ' + (x.code || x.message), true); } return; }
                const k = ev.target.closest('[data-m]'); if (!k) return;
                if (k.dataset.m === 'x') closeModal();
                else if (k.dataset.m === 'ren') { const t = b.querySelector('[data-t]').value.trim(); if (!t) return toast('Der Name darf nicht leer sein.', true); try { await MS.updateGroup(cur, { title: t.slice(0, 60) }); closeModal(); } catch (x) { toast('Fehlgeschlagen: ' + (x.code || x.message), true); } }
                else if (k.dataset.m === 'leave') { if (await uiConfirm('Gruppe wirklich verlassen?', { danger: true, ok: 'Verlassen' })) try { await MS.leaveGroup(cur); closeModal(); closeChat(); } catch (x) { toast('Fehlgeschlagen: ' + (x.code || x.message), true); } }
                else if (k.dataset.m === 'add') addMembers();
            });
        }
        async function addMembers() {
            try { await MS.loadDirectory(); } catch (x) {} const c = cur, free = people().filter(p => !c.members.includes(p.uid));
            const b = modal(`<h3><i class="fa-solid fa-user-plus"></i>Mitglieder hinzufügen</h3><div class="mx-pl">${free.length ? peopleHtml(free, true) : '<p class="mx-empty">Alle sind schon dabei.</p>'}</div><div class="mx-acts"><button type="button" class="btn" data-m="x">Abbrechen</button><button type="button" class="btn pri" data-m="ok">Hinzufügen</button></div>`);
            b.addEventListener('click', async ev => { toggleCheck(b, ev); const k = ev.target.closest('[data-m]'); if (!k) return; if (k.dataset.m === 'x') return closeModal();
                const ids = checked(b); if (!ids.length) return closeModal(); if (c.members.length + ids.length > 30) return toast('Höchstens 30 Mitglieder.', true);
                try { await MS.updateGroup(c, { members: [...c.members, ...ids] }); closeModal(); } catch (x) { toast('Fehlgeschlagen: ' + (x.code || x.message), true); } });
        }
        function settings() {
            const p = MS.prefs(), row = (id, on, t, s) => `<label class="mx-sw"><span><b>${t}</b><small>${s}</small></span><input type="checkbox" class="tgl" data-s="${id}"${on ? ' checked' : ''}></label>`;
            const b = modal(`<h3><i class="fa-solid fa-sliders"></i>Messenger-Einstellungen</h3>
                ${row('rec', S.self.receipts !== false, 'Lesebestätigung', 'Andere sehen, wann du ihre Nachrichten gelesen hast. Aus: Du siehst die Haken der anderen auch nicht.')}
                ${row('seen', S.self.showSeen !== false, 'Zuletzt aktiv anzeigen', 'Andere sehen, ob du online bist oder wann du zuletzt aktiv warst.')}
                ${row('snd', p.sound, 'Ton bei neuen Nachrichten', 'Kurzer Ton, wenn der Chat gerade nicht offen ist (dieses Gerät).')}
                ${row('prv', p.preview, 'Nachrichtentext in Hinweisen', 'Aus: In Mitteilungen steht nur „Neue Nachricht“.')}
                <p class="mx-hint">Gilt genauso im Dashboard – es sind dieselben Einstellungen.</p>
                <div class="mx-acts"><button type="button" class="btn" data-m="rules">Nutzungsregeln</button><button type="button" class="btn pri" data-m="x">Fertig</button></div>`);
            b.addEventListener('change', async ev => { const t = ev.target.closest('[data-s]'); if (!t) return; const on = t.checked;
                try { if (t.dataset.s === 'rec') await MS.setSelfPref('receipts', on); else if (t.dataset.s === 'seen') await MS.setSelfPref('showSeen', on); else if (t.dataset.s === 'snd') { MS.setPrefs({ sound: on }); if (on) MS.beep(); } else if (t.dataset.s === 'prv') MS.setPrefs({ preview: on }); renderMsgs(0, true); }
                catch (x) { t.checked = !on; toast('Konnte nicht gespeichert werden: ' + (x.code || x.message), true); } });
            b.addEventListener('click', ev => { const k = ev.target.closest('[data-m]'); if (!k) return; if (k.dataset.m === 'rules') showRules(); else closeModal(); });
        }

        // ---------- Klicks, Tasten ----------
        body.addEventListener('click', ev => {
            if (!ev.target.closest('.mx-pop') && !ev.target.closest('[data-x="emo"]') && !ev.target.closest('[data-a="react"]')) closePop();
            const it = ev.target.closest('.mx-it'); if (it) return openChat(it.dataset.id);
            const x = ev.target.closest('[data-x]'); if (!x) return;
            ({ new: newChat, group: newGroup, set: settings, search: () => search($('.mx-sbar').hidden), sclose: () => search(false), mute: async () => { if (!cur || cur.isNew) return; try { await MS.setMute(cur.id, !MS.isMuted(cur, S.meta)); } catch (er) { toast('Konnte nicht geändert werden.', true); } },
                info, send, cancel: cancelBar, attach: () => attachMenu(x), emo: () => { if (body.querySelector('.mx-ep')) return closePop(); emojiPop(x, em => { const s = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, s) + em + ta.value.slice(ta.selectionEnd ?? s); ta.selectionStart = ta.selectionEnd = s + em.length; grow(); ta.focus(); }); },
                sup: () => { if (hits.length) { hitI = (hitI - 1 + hits.length) % hits.length; mark(); goHit(); } }, sdown: () => { if (hits.length) { hitI = (hitI + 1) % hits.length; mark(); goHit(); } } }[x.dataset.x] || (() => {}))();
        });
        list.addEventListener('contextmenu', ev => { const it = ev.target.closest('.mx-it'); if (!it) return; ev.preventDefault(); const c = S.chats.find(x => x.id === it.dataset.id); if (!c) return; const mu = MS.isMuted(c, S.meta), n = MS.unreadCount(c, S.meta);
            API.ctx(ev.clientX, ev.clientY, [['fa-comment', 'Öffnen', () => openChat(c.id)], n && ['fa-check-double', 'Als gelesen markieren', () => MS.markRead(c)], ['fa-bell' + (mu ? '' : '-slash'), mu ? 'Stummschaltung aufheben' : 'Stummschalten', () => MS.setMute(c.id, !mu)],
                c.type === 'group' && null, c.type === 'group' && c.createdBy !== S.me && ['fa-right-from-bracket', 'Gruppe verlassen', async () => { if (await uiConfirm('Gruppe wirklich verlassen?', { danger: true, ok: 'Verlassen' })) { try { await MS.leaveGroup(c); if (cur && cur.id === c.id) closeChat(); } catch (x) { toast('Fehlgeschlagen.', true); } } }]].filter(v => v !== false && v !== 0)); });
        $('.mx-q input').addEventListener('input', renderList);
        $('.mx-q input').addEventListener('keydown', ev => { if (ev.key === 'Enter') { const f = list.querySelector('.mx-it'); if (f) openChat(f.dataset.id); } });
        body.addEventListener('keydown', ev => {
            if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'f' && cur) { ev.preventDefault(); search(true); }
            else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'n') { ev.preventDefault(); newChat(); }
            else if (ev.key === 'Escape' && layer.firstChild && !layer.querySelector('[data-m="close"]')) { ev.stopPropagation(); closeModal(); }
            else if (ev.altKey && /^Arrow(Up|Down)$/.test(ev.key)) { ev.preventDefault(); const i = S.chats.findIndex(c => cur && c.id === cur.id), n = S.chats[Math.max(0, Math.min(S.chats.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)))]; if (n) openChat(n.id); }
        });
        // Fenster im Vordergrund → gelesen
        const focusObs = new MutationObserver(() => { if (win.el.classList.contains('focus')) { S.active = cur ? cur.id : null; scheduleRead(); } else if (S.active && cur && S.active === cur.id) S.active = null; });
        focusObs.observe(win.el, { attributes: true, attributeFilter: ['class'] });
        const presIv = setInterval(() => { if (!win.el.isConnected) return clearInterval(presIv); if (cur && cur.type === 'dm') renderHead(); renderList(); }, 60000);
        const off = MS.subscribe(onState);
        win.onClose = () => { off(); detach(); focusObs.disconnect(); clearInterval(presIv); if (S.active === (cur && cur.id)) S.active = null; };
        // Chat aus Adresse (#chat=…) oder Parametern öffnen – auch wenn das Fenster schon offen ist
        const want = u => { const m = /chat=([\w-]+)/.exec(u || ''); return m ? m[1] : null; };
        let pending = want(win.url) || (win.params && win.params.chat) || null;
        const tryOpen = () => { if (!pending || !S.ready) return; const c = S.chats.find(x => x.id === pending); pending = null; if (c) openChat(c.id); };
        win.onUrl = u => { pending = want(u); tryOpen(); };
        win.onParams = p => { if (p && p.chat) { pending = p.chat; tryOpen(); } else if (p && p.dm) openDM(p.dm); };

        (async () => {
            renderList();
            try { MS.state.me = U.uid; const meta = await db.collection('users').doc(U.uid).collection('meta').doc('messenger').get(); await MS.ensureSelf(); await MS.loadDirectory(); MS.start();
                if (!(meta.exists && meta.data().rules)) showRules(); }
            catch (x) { toast('Der Messenger konnte nicht gestartet werden: ' + (x.code || x.message), true); }
            renderList(); const un = MS.subscribe(() => { if (S.ready) { tryOpen(); un(); } }); tryOpen();
            if (win.params && win.params.dm) openDM(win.params.dm);
        })();
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        apps: [{ id: 'messenger', name: 'Messenger', icon: 'fa-comments', c: '#f472b6', native: 'messenger', perm: 'messenger', path: '/messenger.html', w: 1020, h: 680 }],
        ui: { messenger: ui },
        init(api, user) { API = api; U = user; e = api.esc; },
    });
})();
