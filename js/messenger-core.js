// js/messenger-core.js - gemeinsame Logik des Messengers.
// Oben stehen reine Hilfsfunktionen (ohne Oberfläche, einzeln testbar), darunter der Live-Teil:
// Chatliste, Ungelesen-Zähler, Hinweise (Ton, Tab-Titel, Browser-Benachrichtigung) und alle Schreibvorgänge.
//
// Datenmodell (Firestore):
//   directory/{uid}                    Name, Miniaturbild, Farbe, zuletzt aktiv, Einstellungen (nur freigegebene Konten lesen)
//   chats/{chatId}                     { type:'dm'|'group', members:[uid], title, createdBy, last:{text,from,kind}, lastAt, seq, reads:{uid:Zeit} }
//   chats/{chatId}/messages/{id}       { from, text, createdAt, editedAt?, deleted?, image?, replyTo?, reactions:{uid:emoji} }
//   users/{uid}/meta/messenger         privat: { seen:{chatId:Anzahl}, mutes:{chatId:true}, rules:1 }
(function (root) {
    'use strict';
    const MAX_TEXT = 2000, RETENTION_DAYS = 90, CLUSTER_MS = 5 * 60 * 1000, ONLINE_MS = 6 * 60 * 1000;
    const pad = n => String(n).padStart(2, '0');
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : typeof t === 'number' ? t : 0);

    // ---------- reine Hilfsfunktionen ----------
    const dmMembers = (a, b) => (a < b ? [a, b] : [b, a]);
    const dmId = (a, b) => 'dm_' + dmMembers(a, b).join('_');

    // Text -> sicheres HTML: alles wird maskiert, nur http(s)-Adressen werden zu Links
    function linkify(text) {
        text = String(text ?? ''); let out = '', last = 0;
        text.replace(/https?:\/\/[^\s<>"']+/g, (m, i) => {
            let url = m, tail = '';
            while (/[.,;:!?)\]}]$/.test(url)) { tail = url.slice(-1) + tail; url = url.slice(0, -1); }
            out += esc(text.slice(last, i)) + `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>` + esc(tail);
            last = i + m.length; return m;
        });
        return (out + esc(text.slice(last))).replace(/\n/g, '<br>');
    }
    function preview(m) {
        if (m && m.image && !(m.text || '').trim()) return 'Bild';
        const t = String((m && m.text) || '').replace(/\s+/g, ' ').trim();
        return (m && m.image ? 'Bild: ' : '') + (t.length > 80 ? t.slice(0, 79) + '…' : t);
    }
    const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    const hhmm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    function dayLabel(t, now = Date.now()) {
        const k = dayKey(t); if (k === dayKey(now)) return 'Heute'; if (k === dayKey(now - 864e5)) return 'Gestern';
        const d = new Date(t), y = d.getFullYear() !== new Date(now).getFullYear() ? ' ' + d.getFullYear() : '';
        return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }) + y;
    }
    function listTime(t, now = Date.now()) {            // Zeit in der Chatliste
        if (!t) return ''; const k = dayKey(t);
        if (k === dayKey(now)) return hhmm(t); if (k === dayKey(now - 864e5)) return 'Gestern';
        if (now - t < 6 * 864e5) return new Date(t).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
        const d = new Date(t); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.';
    }
    function lastSeenLabel(t, now = Date.now()) {
        if (!t) return 'Lange nicht aktiv'; const diff = now - t;
        if (diff < ONLINE_MS) return 'online'; if (diff < 3600e3) return 'zuletzt aktiv vor ' + Math.round(diff / 60000) + ' Min';
        const k = dayKey(t); if (k === dayKey(now)) return 'zuletzt aktiv heute, ' + hhmm(t); if (k === dayKey(now - 864e5)) return 'zuletzt aktiv gestern, ' + hhmm(t);
        const d = new Date(t); return 'zuletzt aktiv am ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.';
    }
    const isOnline = (t, now = Date.now()) => !!t && now - t < ONLINE_MS;

    // Ungelesen: Anzahl aller Nachrichten im Chat minus Anzahl beim letzten Lesen (je Konto privat gespeichert)
    const unreadCount = (chat, meta) => Math.max(0, (chat.seq || 0) - (((meta || {}).seen || {})[chat.id] || 0));
    const isMuted = (chat, meta) => !!(((meta || {}).mutes || {})[chat.id]);
    function totalUnread(chats, meta) { return (chats || []).reduce((s, c) => s + (isMuted(c, meta) ? 0 : unreadCount(c, meta)), 0); }

    function chatTitle(chat, dir, me) {
        if (chat.type === 'group') return chat.title || 'Gruppe';
        const other = (chat.members || []).find(u => u !== me); return (dir[other] && dir[other].name) || 'Gelöschtes Konto';
    }
    function previewLine(chat, dir, me) {
        const l = chat.last; if (!l) return 'Noch keine Nachricht';
        if (l.kind === 'sys') return l.text;
        const who = l.from === me ? 'Du: ' : chat.type === 'group' ? (((dir[l.from] && dir[l.from].name) || 'Gelöscht').split(' ')[0]) + ': ' : '';
        return who + l.text;
    }

    // Nachrichten in Anzeige-Einträge: Tagestrenner, "Neue Nachrichten"-Linie, Blöcke gleicher Absender
    function layout(msgs, me, o = {}) {
        const items = []; let prev = null, prevDay = '';
        for (const m of msgs) {
            const t = m.createdMs || Date.now(), dk = dayKey(t); let divider = false;
            if (dk !== prevDay) { items.push({ type: 'day', label: dayLabel(t, o.now), key: 'd' + dk }); prevDay = dk; prev = null; }
            if (o.unreadFromId && m.id === o.unreadFromId) { items.push({ type: 'unread', key: 'u' }); prev = null; divider = true; }
            const joins = prev && prev.from === m.from && t - (prev.createdMs || t) <= CLUSTER_MS && !divider;
            const it = { type: 'msg', m, mine: m.from === me, first: !joins, last: true, showName: !joins && m.from !== me && o.group === true };
            if (joins && items.length) { const p = items[items.length - 1]; if (p.type === 'msg') p.last = false; }
            items.push(it); prev = m;
        }
        return items;
    }
    // Haken: 'pending' (wird gesendet), 'sent', 'read' (alle anderen Mitglieder haben gelesen)
    function ticks(m, chat, me, receiptsOn) {
        if (m.pending) return { state: 'pending', n: 0, total: 0 };
        const others = (chat.members || []).filter(u => u !== me), reads = chat.reads || {};
        if (!receiptsOn || !others.length) return { state: 'sent', n: 0, total: others.length };
        const n = others.filter(u => ms(reads[u]) >= (m.createdMs || 0) && ms(reads[u]) > 0).length;
        return { state: n === others.length ? 'read' : 'sent', n, total: others.length };
    }
    const matches = (m, q) => !!q && !m.deleted && (String(m.text || '').toLowerCase().includes(String(q).toLowerCase()));
    const reactionSummary = (m, me) => {
        const out = {}; Object.entries(m.reactions || {}).forEach(([u, e]) => { (out[e] = out[e] || { emoji: e, n: 0, mine: false }).n++; if (u === me) out[e].mine = true; });
        return Object.values(out).sort((a, b) => b.n - a.n);
    };

    // ---------- Live-Teil ----------
    const S = { me: null, chats: [], meta: { seen: {}, mutes: {} }, dir: {}, self: {}, unsubs: [], started: false, ready: false, subs: new Set(), seqSeen: {}, active: null, baseTitle: '', nameCache: {} };
    const TS = () => firebase.firestore.FieldValue.serverTimestamp();
    const FV = () => firebase.firestore.FieldValue;
    const chatRef = id => db.collection('chats').doc(id);
    const metaRef = () => db.collection('users').doc(S.me).collection('meta').doc('messenger');
    const emit = () => S.subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });

    function prefs() { let p = {}; try { p = JSON.parse(localStorage.getItem('msg_prefs') || '{}'); } catch (e) {} return Object.assign({ sound: true, desktop: false, preview: false }, p); }
    function setPrefs(patch) { try { localStorage.setItem('msg_prefs', JSON.stringify(Object.assign(prefs(), patch))); } catch (e) {} }

    let audio = null;
    function beep() {
        try {
            audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume();
            [[880, 0], [1175, 0.12]].forEach(([f, t]) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audio.destination);
                const s = audio.currentTime + t; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.14, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.22); o.start(s); o.stop(s + 0.25); });
        } catch (e) { /* kein Ton möglich */ }
    }
    async function nameOf(uid) {
        if (S.dir[uid]) return S.dir[uid].name; if (S.nameCache[uid]) return S.nameCache[uid];
        try { const d = await db.collection('directory').doc(uid).get(); S.nameCache[uid] = d.exists ? d.data().name : 'Gelöschtes Konto'; } catch (e) { S.nameCache[uid] = 'Jemand'; }
        return S.nameCache[uid];
    }
    async function notifyNew(chat) {
        if (isMuted(chat, S.meta)) return;
        const visibleHere = S.active === chat.id && !document.hidden; if (visibleHere) return;
        const p = prefs(); if (p.sound) beep();
        if (p.desktop && 'Notification' in window && Notification.permission === 'granted') {
            const who = chat.type === 'group' ? (chat.title || 'Gruppe') : await nameOf(chat.last && chat.last.from);
            const body = p.preview && chat.last ? ((chat.type === 'group' ? (await nameOf(chat.last.from)).split(' ')[0] + ': ' : '') + chat.last.text) : 'Neue Nachricht';
            try { const n = new Notification(who, { body, icon: '/icons/icon-192.png', tag: chat.id }); n.onclick = () => { window.focus(); location.href = '/messenger.html#chat=' + chat.id; n.close(); }; } catch (e) { /* nicht unterstützt */ }
        }
    }
    function updateBadges() {
        const n = totalUnread(S.chats, S.meta), txt = n > 99 ? '99+' : String(n);
        ['sb-msg-badge', 'tb-msg-badge'].forEach(id => { const el = document.getElementById(id); if (el) { el.textContent = txt; el.classList.toggle('show', n > 0); } });
        if (!S.baseTitle) S.baseTitle = document.title.replace(/^\(\d+\+?\)\s*/, '');
        document.title = (n > 0 ? '(' + n + ') ' : '') + S.baseTitle;
    }
    function recompute() { updateBadges(); emit(); }

    function start() {
        if (S.started || typeof currentUser === 'undefined' || !currentUser) return; S.started = true; S.me = currentUser.uid;
        S.unsubs.push(db.collection('chats').where('members', 'array-contains', S.me).limit(80).onSnapshot(snap => {
            const first = !S.ready;
            S.chats = snap.docs.map(d => ({ id: d.id, ...d.data(), lastMs: ms(d.data().lastAt) || Date.now() })).sort((a, b) => b.lastMs - a.lastMs);
            S.chats.forEach(c => {
                const was = S.seqSeen[c.id]; S.seqSeen[c.id] = c.seq || 0;
                if (!first && was !== undefined && (c.seq || 0) > was && c.last && c.last.from !== S.me) notifyNew(c);
                else if (!first && was === undefined && (c.seq || 0) > 0 && c.last && c.last.from !== S.me) notifyNew(c);       // ganz neuer Chat
            });
            S.ready = true; recompute();
        }, err => console.error('Messenger Chats:', err.code || err.message)));
        S.unsubs.push(metaRef().onSnapshot(d => { const m = d.exists ? d.data() : {}; S.meta = Object.assign({}, m, { seen: m.seen || {}, mutes: m.mutes || {} }); recompute(); }, err => console.error('Messenger Meta:', err.code || err.message)));
    }
    function stop() { S.unsubs.forEach(u => u()); S.unsubs = []; S.started = false; S.ready = false; }

    // Verzeichnis: einmal laden (Namen, Miniaturbilder), Anwesenheit nur für den geöffneten Zweier-Chat verfolgen
    async function loadDirectory() {
        const snap = await db.collection('directory').get(); S.dir = {};
        snap.docs.forEach(d => { const x = d.data(); S.dir[d.id] = { uid: d.id, name: x.name || 'Unbekannt', thumb: x.thumb || '', color: x.color || 0, lastSeen: ms(x.lastSeen), receipts: x.receipts !== false, showSeen: x.showSeen !== false }; });
        return S.dir;
    }
    function makeThumb(dataUrl, size = 64) {
        return new Promise(res => {
            if (!dataUrl) return res(''); const img = new Image();
            img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), s = Math.min(img.width, img.height); x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); res(c.toDataURL('image/jpeg', 0.72)); };
            img.onerror = () => res(''); img.src = dataUrl;
        });
    }
    async function ensureSelf() {
        const ref = db.collection('directory').doc(S.me), cur = await ref.get(), x = cur.exists ? cur.data() : {};
        const thumb = await makeThumb(currentUser.photo), patch = { name: currentUser.name, thumb: thumb || '', color: +currentUser.avatarColor || 0, lastSeen: TS(), updatedAt: TS() };
        if (!cur.exists) { patch.receipts = true; patch.showSeen = true; }
        await ref.set(patch, { merge: true }); S.self = { receipts: x.receipts !== false, showSeen: x.showSeen !== false }; return S.self;
    }
    async function setSelfPref(k, v) { await db.collection('directory').doc(S.me).set({ [k]: v, updatedAt: TS() }, { merge: true }); S.self[k] = v; if (S.dir[S.me]) S.dir[S.me][k] = v; }
    const heartbeat = () => db.collection('directory').doc(S.me).set({ lastSeen: TS() }, { merge: true }).catch(() => {});
    function watchPresence(uid, cb) { return db.collection('directory').doc(uid).onSnapshot(d => cb(d.exists ? ms(d.data().lastSeen) : 0, d.exists ? d.data().showSeen !== false : false), () => cb(0, false)); }

    // ---------- Schreibvorgänge ----------
    async function send(chat, o) {
        const text = String(o.text || '').trim().slice(0, MAX_TEXT); if (!text && !o.image) return null;
        const cref = chatRef(chat.id), mref = cref.collection('messages').doc(), last = { text: preview({ text, image: o.image }), from: S.me, kind: o.image ? 'image' : 'text' };
        const msg = { from: S.me, text, createdAt: TS() }; if (o.image) msg.image = o.image; if (o.replyTo) msg.replyTo = o.replyTo;
        const b = db.batch();
        if (chat.isNew) b.set(cref, { type: 'dm', members: dmMembers(chat.members[0], chat.members[1]), createdBy: S.me, createdAt: TS(), last, lastAt: TS(), seq: 1, reads: {} });
        else b.update(cref, { last, lastAt: TS(), seq: FV().increment(1) });
        b.set(mref, msg); b.set(metaRef(), { seen: { [chat.id]: (chat.seq || 0) + 1 } }, { merge: true });
        await b.commit(); chat.isNew = false; return mref.id;
    }
    const edit = (chat, id, text) => chatRef(chat.id).collection('messages').doc(id).update({ text: String(text).trim().slice(0, MAX_TEXT), editedAt: TS() });
    const remove = (chat, id) => chatRef(chat.id).collection('messages').doc(id).update({ deleted: true, text: '', image: FV().delete(), editedAt: TS() });
    function react(chat, m, emoji) { const cur = (m.reactions || {})[S.me]; return chatRef(chat.id).collection('messages').doc(m.id).update({ ['reactions.' + S.me]: cur === emoji ? FV().delete() : emoji }); }
    async function createGroup(title, ids) {
        const members = Array.from(new Set([S.me, ...ids])), ref = db.collection('chats').doc();
        await ref.set({ type: 'group', title: String(title).trim().slice(0, 60), members, createdBy: S.me, createdAt: TS(), last: { text: 'Gruppe erstellt', from: S.me, kind: 'sys' }, lastAt: TS(), seq: 0, reads: {} }); return ref.id;
    }
    const updateGroup = (chat, patch) => chatRef(chat.id).update(patch);
    const leaveGroup = chat => chatRef(chat.id).update({ members: FV().arrayRemove(S.me) });
    const setMute = (id, on) => metaRef().set({ mutes: { [id]: on ? true : FV().delete() } }, { merge: true });
    const acceptRules = () => metaRef().set({ rules: 1 }, { merge: true });

    // Gelesen: privater Zähler (immer) und sichtbarer Zeitpunkt für die anderen (nur wenn Lesebestätigung an)
    function markRead(chat) {
        if (!chat || chat.isNew) return;
        if (unreadCount(chat, S.meta) > 0) { S.meta.seen[chat.id] = chat.seq || 0; metaRef().set({ seen: { [chat.id]: chat.seq || 0 } }, { merge: true }).catch(() => {}); recompute(); }
        const mine = ms((chat.reads || {})[S.me]);
        if (S.self.receipts !== false && chat.last && chat.last.from !== S.me && chat.last.kind !== 'sys' && mine < (chat.lastMs || 0)) chatRef(chat.id).update({ ['reads.' + S.me]: TS() }).catch(() => {});
    }
    // Aufbewahrung: abgelaufene Nachrichten (älter als 90 Tage) löscht jedes Mitglied beim Öffnen des Chats mit
    async function purgeExpired(chatId) {
        try {
            const cutoff = Date.now() - RETENTION_DAYS * 864e5, snap = await chatRef(chatId).collection('messages').orderBy('createdAt', 'asc').limit(30).get();
            const old = snap.docs.filter(d => ms(d.data().createdAt) && ms(d.data().createdAt) < cutoff); if (!old.length) return 0;
            const b = db.batch(); old.forEach(d => b.delete(d.ref)); await b.commit(); return old.length;
        } catch (e) { return 0; }
    }
    // Bild verkleinern: längste Seite 960 Pixel, JPEG, bleibt unter ca. 110 KB
    function compressImage(file) {
        return new Promise((res, rej) => {
            const url = URL.createObjectURL(file), img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url); let w = img.width, h = img.height; const k = Math.min(1, 960 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
                const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
                let q = 0.8, d = c.toDataURL('image/jpeg', q); while (d.length > 150000 && q > 0.35) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
                if (d.length > 180000) return rej(new Error('Das Bild ist auch verkleinert noch zu groß.')); res(d);
            };
            img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Dieses Bild konnte nicht gelesen werden.')); }; img.src = url;
        });
    }

    root.MSG = { MAX_TEXT, RETENTION_DAYS, esc, ms, dmMembers, dmId, linkify, preview, dayKey, hhmm, dayLabel, listTime, lastSeenLabel, isOnline, unreadCount, isMuted, totalUnread, chatTitle, previewLine,
        layout, ticks, matches, reactionSummary, state: S, prefs, setPrefs, start, stop, subscribe: f => { S.subs.add(f); return () => S.subs.delete(f); }, loadDirectory, ensureSelf, setSelfPref, heartbeat, watchPresence,
        send, edit, remove, react, createGroup, updateGroup, leaveGroup, setMute, acceptRules, markRead, purgeExpired, compressImage, makeThumb, nameOf, beep, updateBadges };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.MSG;
})(typeof window !== 'undefined' ? window : globalThis);
