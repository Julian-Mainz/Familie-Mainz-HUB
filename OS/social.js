// OS/social.js – Familien-Zettel (geteiltes Widget), Chat-Blasen mit Antwortfeld und Musik-Leiste in der Taskleiste für J.Mainz OS.
(function () {
    'use strict';
    let API, U, e, S;
    const $ = id => document.getElementById(id);

    // ---------- Widget: Familien-Zettel (os_shared/zettel, für alle freigegebenen Mitglieder) ----------
    const FAMILY = { name: 'Familien-Zettel', icon: 'fa-users', c: '#fb923c', desc: 'Ein Zettel, den alle in der Familie sehen und bearbeiten', sizes: { s: [230, 200], m: [280, 260], l: [340, 340] }, bare: true,
        mount(b) {
            b.innerHTML = `<div class="wg-fam"><textarea class="wg-sticky" maxlength="3000" placeholder="Für alle sichtbar, z. B. „Wer holt heute die Kinder?“" aria-label="Familien-Zettel"></textarea><small class="by"></small></div>`;
            const ta = b.querySelector('textarea'), by = b.querySelector('.by'); let t = 0, dirty = false;
            const ref = db.collection('os_shared').doc('zettel');
            const off = ref.onSnapshot(d => {
                const x = d.exists ? d.data() : {};
                if (!dirty && document.activeElement !== ta) ta.value = x.text || '';
                by.textContent = x.by ? `zuletzt: ${x.by} · ${new Date(x.at || 0).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'noch leer';
            }, err => { by.textContent = err.code === 'permission-denied' ? 'Firestore-Regel für den Familien-Zettel fehlt noch' : 'nicht erreichbar'; });
            ta.addEventListener('input', () => { dirty = true; by.textContent = 'wird gespeichert …'; clearTimeout(t);
                t = setTimeout(() => ref.set({ text: ta.value.slice(0, 3000), by: U.firstName || U.email, at: Date.now() }).then(() => { dirty = false; }).catch(x => { by.textContent = 'Speichern fehlgeschlagen: ' + (x.code === 'permission-denied' ? 'Regel fehlt' : x.message); }), 800); });
            ta.addEventListener('blur', () => { if (!dirty) return; });
            return off;
        } };

    // ---------- Chat-Blasen ----------
    const base = {}; let ready = false, openId = null, unsubMsgs = null, dragging = false;
    const bubblesOn = () => S.bubbles !== false;
    function chatOf(id) { return MSG.state.chats.find(c => c.id === id); }
    const nameOf = uid => (MSG.state.dir[uid] && MSG.state.dir[uid].name) || 'Jemand';
    const thumbOf = uid => { const t = MSG.state.dir[uid] && MSG.state.dir[uid].thumb; return /^data:image\/(jpeg|png|webp);base64,/.test(t || '') ? t : ''; };
    function bubbleList() {
        const m = MSG.state;
        return m.chats.filter(c => c.last && c.last.from !== U.uid && !MSG.isMuted(c, m.meta) && MSG.unreadCount(c, m.meta) > 0 && (c.seq || 0) > (base[c.id] ?? 0) && !(S.bubbleGone || []).includes(c.id + ':' + c.seq));
    }
    function paintBubbles() {
        const box = $('bubbles'); if (!bubblesOn() && !dragging) { box.innerHTML = ''; return; }
        box.classList.toggle('dragmode', dragging);
        const list = dragging ? recentChats() : bubbleList(), keep = openId && chatOf(openId) ? [chatOf(openId)] : [], all = [...new Map([...list, ...keep].map(c => [c.id, c])).values()].slice(0, 5);
        box.innerHTML = all.map(c => { const t = MSG.chatTitle(c, MSG.state.dir, U.uid), other = c.type === 'group' ? null : (c.members || []).find(u => u !== U.uid), th = other ? thumbOf(other) : '', n = MSG.unreadCount(c, MSG.state.meta);
            return `<div class="bb${openId === c.id ? ' on' : ''}" data-chat="${e(c.id)}" role="button" tabindex="0" title="${e(t)}: ${e(MSG.previewLine(c, MSG.state.dir, U.uid))}">${th ? `<img src="${th}" alt="">` : `<span>${e((t || '?').slice(0, 1))}</span>`}${n ? `<b>${n > 9 ? '9+' : n}</b>` : ''}<button type="button" class="bx" data-bx="${e(c.id)}" aria-label="Blase schließen"><i class="fa-solid fa-xmark"></i></button><em>${e(t)}</em></div>`; }).join('');
    }
    const recentChats = () => MSG.state.chats.filter(c => c.last).sort((a, b) => (b.lastMs || 0) - (a.lastMs || 0)).slice(0, 5);
    // ---------- Dateien verschicken: auf eine Blase ziehen, oder „Per Chat senden“ ----------
    async function sendFile(c, src) {
        let blob, name;
        if (src.key) { const r = await JMOS_FILES.blobOf(src.key); blob = r.blob; name = r.name; } else { blob = src.blob; name = src.name; }
        const t = MSG.chatTitle(c, MSG.state.dir, U.uid);
        if (/^image\/(jpeg|png|webp|gif)$/.test(blob.type) || /\.(jpe?g|png|webp|gif)$/i.test(name)) {
            const img = await MSG.compressImage(new File([blob], name, { type: blob.type || 'image/jpeg' }));
            await MSG.send(c, { text: '', image: img });
        } else await MSG.send(c, { text: '', file: await MSG.fileToAttachment(blob, name) });
        info('fa-paper-plane', '#f472b6', 'Gesendet an ' + t, name);
    }
    function info(icon, c, title, text) {
        const box = $('toasts'), el = document.createElement('div'); el.className = 'tst';
        el.innerHTML = `<div class="tst-i"><span class="ic" style="--c:${c}"><i class="fa-solid ${icon}"></i></span><span class="tx"><b>${e(title)}</b><span>${e(text)}</span></span></div>`;
        box.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 3500);
    }
    // Chat auswählen (für „Per Chat senden“ und das Bildschirmfoto)
    function pickChat(title) {
        return new Promise(res => {
            const list = MSG.state.chats.filter(c => c.last || c.type === 'group').sort((a, b) => (b.lastMs || 0) - (a.lastMs || 0)).slice(0, 30);
            const bg = document.createElement('div'); bg.className = 'uidlg-bg cp-bg';
            bg.innerHTML = `<div class="uidlg cp" role="dialog" aria-label="${e(title)}"><h3>${e(title)}</h3><div class="cp-l">${list.length ? list.map(c => { const t = MSG.chatTitle(c, MSG.state.dir, U.uid), o = c.type === 'group' ? null : (c.members || []).find(u => u !== U.uid), th = o ? thumbOf(o) : '';
                return `<button type="button" data-pc="${e(c.id)}"><span class="av">${th ? `<img src="${th}" alt="">` : e((t || '?')[0])}</span><span><b>${e(t)}</b><small>${e(MSG.previewLine(c, MSG.state.dir, U.uid))}</small></span></button>`; }).join('') : '<p style="color:var(--mut)">Noch keine Chats.</p>'}</div><div class="uidlg-a"><button type="button" data-pc="">Abbrechen</button></div></div>`;
            const done = v => { bg.remove(); res(v); };
            bg.addEventListener('click', ev => { const b = ev.target.closest('[data-pc]'); if (b) done(b.dataset.pc ? chatOf(b.dataset.pc) : null); else if (ev.target === bg) done(null); });
            bg.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); done(null); } });
            document.body.appendChild(bg); (bg.querySelector('[data-pc]') || bg).focus();
        });
    }
    async function sendVia(src) {
        const c = await pickChat('Per Chat senden'); if (!c) return;
        try { await sendFile(c, src); } catch (x) { uiAlert(x.message, { title: 'Nicht gesendet' }); }
    }
    function wireFileDrop() {
        const isFile = dt => dt && [...dt.types].some(t => t === 'text/x-jmos-file' || t === 'Files');
        let leaveT = 0;
        const on = () => { clearTimeout(leaveT); if (!dragging) { dragging = true; paintBubbles(); } };
        const off = () => { clearTimeout(leaveT); leaveT = setTimeout(() => { if (dragging) { dragging = false; $('bubbles').querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); paintBubbles(); } }, 120); };
        document.addEventListener('dragenter', ev => { if (isFile(ev.dataTransfer)) on(); }, true);
        document.addEventListener('dragover', ev => { if (isFile(ev.dataTransfer)) on(); }, true);
        document.addEventListener('dragleave', ev => { if (!ev.relatedTarget) off(); }, true);
        document.addEventListener('drop', () => off(), true);
        document.addEventListener('dragend', () => off(), true);
        const box = $('bubbles');
        box.addEventListener('dragover', ev => { const b = ev.target.closest('.bb'); if (!b) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; box.querySelectorAll('.drop').forEach(x => x.classList.toggle('drop', x === b)); b.classList.add('drop'); });
        box.addEventListener('drop', async ev => {
            const b = ev.target.closest('.bb'); if (!b) return; ev.preventDefault(); ev.stopPropagation();
            const c = chatOf(b.dataset.chat), key = ev.dataTransfer.getData('text/x-jmos-file'), files = [...ev.dataTransfer.files]; if (!c) return;
            try { if (key) await sendFile(c, { key }); else for (const f of files.slice(0, 5)) await sendFile(c, { blob: f, name: f.name }); } catch (x) { uiAlert(x.message, { title: 'Nicht gesendet' }); }
        });
        const cb = $('chatbox');
        cb.addEventListener('dragover', ev => { if (isFile(ev.dataTransfer) && openId) { ev.preventDefault(); cb.classList.add('drop'); } });
        cb.addEventListener('dragleave', ev => { if (!cb.contains(ev.relatedTarget)) cb.classList.remove('drop'); });
        cb.addEventListener('drop', async ev => {
            cb.classList.remove('drop'); const c = chatOf(openId); if (!c) return; ev.preventDefault(); ev.stopPropagation();
            const key = ev.dataTransfer.getData('text/x-jmos-file'), files = [...ev.dataTransfer.files];
            try { if (key) await sendFile(c, { key }); else for (const f of files.slice(0, 5)) await sendFile(c, { blob: f, name: f.name }); } catch (x) { uiAlert(x.message, { title: 'Nicht gesendet' }); }
        });
    }
    function openChat(id) {
        const c = chatOf(id); if (!c) return;
        openId = id; paintBubbles(); if (unsubMsgs) unsubMsgs();
        const box = $('chatbox'), t = MSG.chatTitle(c, MSG.state.dir, U.uid);
        box.hidden = false;
        box.innerHTML = `<div class="cb-h"><span class="av">${e(t.slice(0, 1))}</span><b>${e(t)}</b><button type="button" data-cb="full" title="Im Messenger öffnen"><i class="fa-solid fa-up-right-from-square"></i></button><button type="button" data-cb="close" title="Schließen"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="cb-l"><div class="wb-load"><span>Lädt …</span></div></div><form class="cb-f"><input maxlength="2000" placeholder="Antworten …" aria-label="Nachricht"><button type="submit" aria-label="Senden"><i class="fa-solid fa-paper-plane"></i></button></form>`;
        const list = box.querySelector('.cb-l');
        unsubMsgs = db.collection('chats').doc(id).collection('messages').orderBy('createdAt', 'desc').limit(30).onSnapshot(s => {
            const msgs = s.docs.map(d => ({ id: d.id, ...d.data() })).reverse(); let last = '';
            list.innerHTML = msgs.length ? msgs.map(m => { const mine = m.from === U.uid, who = !mine && c.type === 'group' && m.from !== last ? `<small>${e(nameOf(m.from).split(' ')[0])}</small>` : ''; last = m.from;
                const ts = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate() : null;
                return `<div class="cm${mine ? ' me' : ''}">${who}<p>${m.deleted ? '<i>Nachricht gelöscht</i>' : m.image ? '<i class="fa-solid fa-image"></i> Bild' + (m.text ? ' · ' + e(m.text) : '') : m.file ? '<i class="fa-solid fa-file-arrow-down"></i> ' + e(m.file.name || 'Datei') : e(m.text)}</p><time>${ts ? ts.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}</time></div>`; }).join('') : '<div class="nc-empty"><span>Noch keine Nachrichten</span></div>';
            list.scrollTop = list.scrollHeight;
            const cc = chatOf(id); if (cc) MSG.markRead(cc);
        }, () => { list.innerHTML = '<div class="nc-empty"><span>Nachrichten konnten nicht geladen werden</span></div>'; });
        setTimeout(() => box.querySelector('input').focus(), 50);
    }
    function closeChat() { openId = null; if (unsubMsgs) { unsubMsgs(); unsubMsgs = null; } $('chatbox').hidden = true; paintBubbles(); }
    function wireBubbles() {
        $('bubbles').addEventListener('click', ev => {
            const x = ev.target.closest('[data-bx]'); if (x) { const c = chatOf(x.dataset.bx); S.bubbleGone = [...(S.bubbleGone || []), c.id + ':' + c.seq].slice(-40); API.save(); if (openId === c.id) closeChat(); else paintBubbles(); return; }
            const b = ev.target.closest('[data-chat]'); if (b) { if (openId === b.dataset.chat) closeChat(); else openChat(b.dataset.chat); }
        });
        $('chatbox').addEventListener('click', ev => { const k = ev.target.closest('[data-cb]'); if (!k) return; if (k.dataset.cb === 'close') closeChat(); else { const id = openId; closeChat(); API.openApp('messenger', { url: '/messenger.html#chat=' + id }); } });
        $('chatbox').addEventListener('submit', async ev => { ev.preventDefault(); const i = ev.target.querySelector('input'), text = i.value.trim(), c = chatOf(openId); if (!text || !c) return; i.value = '';
            try { await MSG.send(c, { text }); } catch (x) { i.value = text; uiAlert('Senden fehlgeschlagen: ' + x.message); } });
        $('chatbox').addEventListener('keydown', ev => { if (ev.key === 'Escape') closeChat(); });
        MSG.subscribe(() => {
            if (!ready && MSG.state.ready) { MSG.state.chats.forEach(c => { base[c.id] = c.seq || 0; }); ready = true; }       // nur neue Nachrichten ab jetzt als Blase
            if (ready) MSG.state.chats.forEach(c => { if (base[c.id] === undefined) base[c.id] = 0; });
            paintBubbles();
        });
    }

    // ---------- Musik in der Taskleiste ----------
    let mpState = null, mpBusy = false, mpMode = 'off';       // off = nicht verbunden, idle = verbunden, aber nichts läuft, play = Lied läuft
    async function mpLoad() {
        if (document.hidden) return;
        if (!window.JMOS_SP || !JMOS_SP_TOK()) { mpState = null; mpMode = 'off'; return mpPaint(); }
        try { mpState = await JMOS_SP('/me/player?additional_types=episode'); mpMode = mpState && mpState.item ? 'play' : 'idle'; }
        catch (x) { mpState = null; mpMode = x.auth ? 'off' : 'idle'; }
        mpPaint();
    }
    function mpPaint() {
        const el = $('mp'), it = mpState && mpState.item; el.hidden = S.musicBar === false;
        el.classList.toggle('idle', !it);
        if (!it) {
            el.title = mpMode === 'off' ? 'Spotify ist in diesem Browser nicht verbunden. Klicken zum Verbinden.' : 'Gerade läuft nichts auf Spotify. Klicken zum Öffnen.';
            el.innerHTML = `<i class="fa-solid fa-headphones"></i><span class="mp-t"><b>Spotify</b><small>${mpMode === 'off' ? 'Verbinden' : 'Nichts läuft'}</small></span>`;
            return;
        }
        el.title = '';
        const art = (it.album && it.album.images && (it.album.images[2] || it.album.images[0]) || {}).url || (it.images && it.images[0] && it.images[0].url) || '';
        const who = (it.artists || []).map(a => a.name).join(', ') || (it.show && it.show.name) || '';
        el.innerHTML = `${art ? `<img src="${e(art)}" alt="">` : '<i class="fa-solid fa-music"></i>'}<span class="mp-t" title="${e(it.name)} – ${e(who)}"><b>${e(it.name)}</b><small>${e(who)}</small></span>
            <button type="button" data-mp="pp" aria-label="${mpState.is_playing ? 'Pause' : 'Abspielen'}"><i class="fa-solid ${mpState.is_playing ? 'fa-pause' : 'fa-play'}"></i></button><button type="button" data-mp="next" aria-label="Weiter"><i class="fa-solid fa-forward-step"></i></button>`;
    }
    function wireMp() {
        $('mp').addEventListener('click', async ev => {
            const k = ev.target.closest('[data-mp]'); if (!k) { if (API.hasApp('spotify')) API.openApp('spotify'); return; }
            if (mpBusy) return; mpBusy = true;
            try { if (k.dataset.mp === 'pp') await JMOS_SP(mpState && mpState.is_playing ? '/me/player/pause' : '/me/player/play', 'PUT'); else await JMOS_SP('/me/player/next', 'POST'); } catch (x) { uiAlert('Spotify: ' + x.message); }
            mpBusy = false; setTimeout(mpLoad, 600);
        });
        mpLoad(); setInterval(mpLoad, 10000); document.addEventListener('visibilitychange', () => { if (!document.hidden) mpLoad(); });
    }

    // ---------- Einstellungen ----------
    function settings(body) {
        const box = body.querySelector('.app-set'), sec = document.createElement('section');
        sec.innerHTML = `<h3>Chat &amp; Musik</h3>
            ${can(U, 'messenger') ? `<label class="set-row"><div><b>Chat-Blasen</b><small>Neue Nachrichten erscheinen als Blase am rechten Rand. Ein Klick öffnet ein kleines Chatfenster zum direkten Antworten.</small></div><input type="checkbox" class="tgl" data-s="bubbles" ${S.bubbles !== false ? 'checked' : ''}></label>` : ''}
            ${can(U, 'spotify') ? `<label class="set-row"><div><b>Musik in der Taskleiste</b><small>Zeigt das aktuelle Spotify-Lied mit Pause und Weiter. Ist Spotify in diesem Browser noch nicht verbunden, führt ein Klick zum Verbinden.</small></div><input type="checkbox" class="tgl" data-s="musicBar" ${S.musicBar !== false ? 'checked' : ''}></label>` : ''}`;
        if (sec.querySelector('.set-row')) box.insertBefore(sec, box.children[3] || null);
        sec.addEventListener('change', ev => { const k = ev.target.dataset.s; if (!k) return; S[k] = ev.target.checked; API.save(); if (k === 'bubbles') { if (!S.bubbles) closeChat(); paintBubbles(); } else mpPaint(); });
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        init(api, user) {
            API = api; U = user; e = api.esc; S = api.state();
            JMOS_WIDGETS.TYPES.family = FAMILY;
            if (can(U, 'messenger') && window.MSG) { MSG.start(); wireBubbles(); wireFileDrop(); window.JMOS_CHAT = { pick: pickChat, send: sendFile, sendVia }; }
            if (can(U, 'spotify')) wireMp();
            const base0 = window.JMOS_NATIVE_UI.set; window.JMOS_NATIVE_UI.set = (b, w) => { base0(b, w); settings(b); };
            JMOS_WIDGETS.render();
        },
    });
})();
