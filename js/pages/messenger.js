// js/pages/messenger.js - Seiten-Code von /messenger.html (ausgelagert, damit der Browser ihn zwischenspeichern kann)
const M = MSG, S = M.state, esc = M.esc;
let cur = null, msgs = new Map(), oldestDoc = null, hasMore = false, unsubMsgs = null, unsubPres = null, replyTo = null, editing = null, staged = null;
let hits = [], hitI = -1, firstUnreadId = null, openUnread = 0, firstRender = true, newBelow = 0, pres = { ms: 0, show: true }, lastSend = 0, readTimer = 0;
const purged = new Set(); let listReady = false;
// Schlüsselbasiertes Aktualisieren: unveränderte Elemente bleiben unberührt (kein Flackern, keine neue Animation),
// geänderte werden ersetzt, neue eingefügt (und animiert), verschwundene entfernt.
function patch(container, entries, animateNew) {
    const old = new Map();
    [...container.children].forEach(el => { if (el._k) old.set(el._k, el); else el.remove(); });
    let prev = null;
    entries.forEach(({ k, html }) => {
        let el = old.get(k); old.delete(k);
        if (!el || el._h !== html) {
            const t = document.createElement('template'); t.innerHTML = html.trim(); const n = t.content.firstElementChild; n._k = k; n._h = html;
            if (!el && animateNew) n.classList.add('new');
            if (el) el.replaceWith(n); el = n;
        }
        const want = prev ? prev.nextElementSibling : container.firstElementChild;
        if (el !== want) container.insertBefore(el, want);
        prev = el;
    });
    old.forEach(el => el.remove());
} let dirBusy = false, dirAt = Date.now();

// ---------- Hilfen ----------
const nameOf = uid => (S.dir[uid] && S.dir[uid].name) || 'Gelöschtes Konto';
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
function avatarOf(uid, cls = '') {
    const d = S.dir[uid] || {}, ok = PHOTO_OK.test(d.thumb || '');
    return `<span class="ms-av ${cls}" style="background:${avatarGradient(d.color)}">${ok ? `<img src="${d.thumb}" alt="">` : esc(initialsOf(d.name || '?'))}</span>`;
}
function chatAvatar(c, cls = '') {
    if (c.type === 'group') return `<span class="ms-av ${cls}" style="background:${avatarGradient(hash(c.id))}"><i class="fa-solid fa-users"></i></span>`;
    return avatarOf((c.members || []).find(u => u !== S.me), cls);
}
function toast(msg, bad) { document.querySelectorAll('.ms-toast').forEach(t => t.remove()); const t = document.createElement('div'); t.className = 'ms-toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3500); }
const title = c => M.chatTitle(c, S.dir, S.me);
function modal(html) { closeModal(); const d = document.createElement('div'); d.className = 'ms-modal'; d.id = 'ms-mod'; d.innerHTML = `<div class="ms-box">${html}</div>`; d.addEventListener('mousedown', e => { if (e.target === d && !d.dataset.lock) closeModal(); }); $('ms-layer').appendChild(d); return d; }
function closeModal() { const m = $('ms-mod'); if (m) m.remove(); }
function closePop() { document.querySelectorAll('.ms-pop').forEach(p => p.remove()); }
function place(pop, x, y, w = 240) { pop.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px'; pop.style.top = Math.max(8, Math.min(y, innerHeight - pop.offsetHeight - 8)) + 'px'; }

// ---------- Start ----------
initAuthGuard(async user => {
    if (!user) return;
    renderDrawer(); $('b-newgroup').classList.toggle('hidden', !can(currentUser, 'gruppen'));
    try {
        const meta = await db.collection('users').doc(currentUser.uid).collection('meta').doc('messenger').get();
        M.state.me = currentUser.uid;
        await M.ensureSelf(); await M.loadDirectory(); M.start(); M.subscribe(onState);
        if (!(meta.exists && meta.data().rules)) showRules();
    } catch (e) { console.error(e); toast('Der Messenger konnte nicht gestartet werden: ' + (e.code || e.message), true); }
    renderList(); setInterval(() => { if (!document.hidden) M.heartbeat(); }, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { M.heartbeat(); scheduleRead(); } });
    const open = () => { const h = /chat=([\w-]+)/.exec(location.hash); if (h && S.ready) { const c = S.chats.find(x => x.id === h[1]); if (c) openChat(c.id); } };
    const un = M.subscribe(() => { if (S.ready) { open(); un(); } }); open();
    setInterval(() => { if (cur && cur.type === 'dm') renderHeader(); }, 60000);
}, { perm: 'messenger' });

function showRules() {
    const m = modal(`<h3><i class="fa-solid fa-shield-halved"></i>Nutzungsregeln</h3><p class="sub">Kurz und wichtig, bevor du loslegst:</p>
        <div class="ms-rules"><ul>
            <li>Der Messenger ist für den normalen Austausch gedacht. <b>Keine Betriebsgeheimnisse, Kundendaten oder Passwörter</b> darüber schicken.</li>
            <li>Nachrichten werden verschlüsselt übertragen und bei Google (Firebase) gespeichert. <b>Technisch hat der Betreiber des Portals Zugriff auf die gespeicherten Daten.</b> In der App kann niemand fremde Chats lesen.</li>
            <li>Nachrichten werden nach <b>90 Tagen</b> gelöscht. Deine eigenen kannst du jederzeit löschen oder bearbeiten.</li>
            <li>Andere sehen deinen Namen und dein Profilbild. Wann du zuletzt aktiv warst und ob du Nachrichten gelesen hast, stellst du in den Einstellungen selbst ein.</li>
            <li>Sei freundlich. Wer den Messenger missbraucht, verliert den Zugang.</li>
        </ul></div>
        <div class="ms-acts"><button class="ms-btn" onclick="location.href='/menu.html'">Zurück zum Menü</button><button class="ms-btn go" onclick="acceptRules()">Verstanden, weiter</button></div>`);
    m.dataset.lock = '1';
}
async function acceptRules() { try { await M.acceptRules(); closeModal(); } catch (e) { toast('Konnte nicht gespeichert werden: ' + (e.code || e.message), true); } }

// ---------- Chatliste ----------
function renderList() {
    const term = ($('ms-q').value || '').trim().toLowerCase(); let list = S.chats.filter(c => !term || title(c).toLowerCase().includes(term));
    if (cur && cur.isNew && !S.chats.find(c => c.id === cur.id) && (!term || title(cur).toLowerCase().includes(term))) list = [Object.assign({ lastMs: Date.now() }, cur), ...list];
    const entries = list.map((c, i) => {
        const n = M.unreadCount(c, S.meta), muted = M.isMuted(c, S.meta), on = cur && cur.id === c.id;
        return { k: c.id, html: `<button class="ms-item${on ? ' on' : ''}${n && !muted ? ' unread' : ''}" data-id="${esc(c.id)}">${chatAvatar(c)}
            <span class="ms-meta"><span class="ms-row"><b>${esc(title(c))}</b><time>${M.listTime(c.lastMs)}</time></span>
            <span class="ms-row"><span class="ms-prev">${esc(c.isNew ? 'Neuer Chat' : M.previewLine(c, S.dir, S.me))}</span>${n && !on ? `<em class="ms-badge${muted ? ' mute' : ''}">${n > 99 ? '99+' : n}</em>` : muted ? '<i class="fa-solid fa-bell-slash ms-muted"></i>' : ''}</span></span></button>` };
    });
    if (!entries.length) entries.push({ k: 'empty', html: `<div class="ms-empty" style="padding:30px 10px"><p>${term ? 'Keine Chats gefunden.' : 'Noch keine Chats. Starte mit dem Stift oben einen neuen.'}</p></div>` });
    patch($('ms-chats'), entries, listReady); listReady = true;
}
$('ms-chats').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) openChat(b.dataset.id); });
function onState() {
    if (cur) {
        const fresh = S.chats.find(c => c.id === cur.id);
        if (fresh) { const wasNew = cur.isNew; cur = fresh; if (wasNew) attachMessages(); renderHeader(); renderMessages(); scheduleRead(); }
        else if (!cur.isNew) { closeChat(); toast('Dieser Chat ist nicht mehr verfügbar.', true); }
    }
    renderList();
    // Unbekannte Mitglieder (zum Beispiel neu freigegebene Kollegen): Verzeichnis höchstens alle 5 Minuten nachladen
    if (!dirBusy && Date.now() - dirAt > 300000 && S.chats.some(c => (c.members || []).some(u => !S.dir[u]))) {
        dirBusy = true; dirAt = Date.now();
        M.loadDirectory().then(() => { renderList(); renderHeader(); renderMessages(0, true); }).catch(() => {}).finally(() => { dirBusy = false; });
    }
}

// ---------- Chat öffnen ----------
function openChat(id, draft) {
    const c = S.chats.find(x => x.id === id) || draft; if (!c) return;
    detach(); cur = c; S.active = id; replyTo = editing = staged = null; hits = []; hitI = -1; $('ms-sq').value = ''; toggleSearch(false);
    msgs = new Map(); oldestDoc = null; hasMore = false; firstRender = true; newBelow = 0; firstUnreadId = null; openUnread = c.isNew ? 0 : M.unreadCount(c, S.meta); pres = { ms: 0, show: true };
    $('ms-input').value = ''; autoGrow(); renderBar(); $('app').classList.add('conv'); document.body.classList.add('ms-open');
    $('ms-none').classList.add('hidden'); $('ms-none').style.display = 'none'; const ch = $('ms-chat'); ch.classList.remove('hidden'); ch.style.display = 'flex';
    history.replaceState(null, '', '#chat=' + id); renderHeader(); renderMessages(); renderList();
    if (!c.isNew) { attachMessages(); if (!purged.has(id)) { purged.add(id); M.purgeExpired(id); } }
    if (c.type === 'dm') { const other = c.members.find(u => u !== S.me); unsubPres = M.watchPresence(other, (t, show) => { pres = { ms: t, show }; renderHeader(); }); }
    if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => $('ms-input').focus(), 60);
}
function openDM(uid) {
    closeModal(); const id = M.dmId(S.me, uid), ex = S.chats.find(c => c.id === id);
    openChat(id, ex ? undefined : { id, type: 'dm', members: M.dmMembers(S.me, uid), isNew: true, seq: 0, reads: {}, last: null, lastMs: Date.now() });
}
function detach() { if (unsubMsgs) unsubMsgs(); if (unsubPres) unsubPres(); unsubMsgs = unsubPres = null; }
function closeChat() { detach(); cur = null; S.active = null; $('app').classList.remove('conv'); document.body.classList.remove('ms-open'); $('ms-chat').style.display = 'none'; $('ms-none').classList.remove('hidden'); $('ms-none').style.display = ''; history.replaceState(null, '', location.pathname); renderList(); }
const toMsg = d => ({ id: d.id, ...d.data(), createdMs: M.ms(d.data().createdAt) || Date.now(), pending: d.metadata.hasPendingWrites });
function attachMessages() {
    if (unsubMsgs || !cur) return; const id = cur.id;
    unsubMsgs = db.collection('chats').doc(id).collection('messages').orderBy('createdAt', 'desc').limit(40).onSnapshot({ includeMetadataChanges: true }, snap => {
        if (!cur || cur.id !== id) return;
        const incoming = []; snap.docChanges({ includeMetadataChanges: true }).forEach(ch => { if (ch.type !== 'removed') { const m = toMsg(ch.doc); if (!msgs.has(m.id)) incoming.push(m); msgs.set(m.id, m); } });
        if (!oldestDoc && snap.docs.length) { oldestDoc = snap.docs[snap.docs.length - 1]; hasMore = snap.docs.length >= 40; }
        if (firstRender && openUnread > 0) { const arr = [...msgs.values()].sort((a, b) => a.createdMs - b.createdMs); if (openUnread <= arr.length) firstUnreadId = arr[arr.length - openUnread].id; }
        const fresh = incoming.filter(m => m.from !== S.me && !firstRender).length; renderMessages(fresh); scheduleRead();
    }, err => { console.error('Nachrichten:', err); toast('Nachrichten konnten nicht geladen werden: ' + (err.code || err.message), true); });
}
async function loadOlder() {
    if (!oldestDoc || !cur) return; const sc = $('ms-scroll'), prev = sc.scrollHeight;
    try {
        const snap = await db.collection('chats').doc(cur.id).collection('messages').orderBy('createdAt', 'desc').startAfter(oldestDoc).limit(40).get();
        snap.docs.forEach(d => msgs.set(d.id, toMsg(d))); if (snap.docs.length) oldestDoc = snap.docs[snap.docs.length - 1]; hasMore = snap.docs.length >= 40;
        renderMessages(0, true); sc.scrollTop += sc.scrollHeight - prev; if ($('ms-sq').value) runSearch(true);
    } catch (e) { toast('Ältere Nachrichten konnten nicht geladen werden.', true); }
}
function scheduleRead() { clearTimeout(readTimer); readTimer = setTimeout(() => { if (cur && !document.hidden) M.markRead(cur); }, 350); }

// ---------- Kopfzeile ----------
function renderHeader() {
    if (!cur) return; const t = $('ms-title'), dm = cur.type === 'dm', other = dm ? cur.members.find(u => u !== S.me) : null; let st = '', on = false;
    if (dm) { const showSeen = pres.show && (S.self.showSeen !== false); if (showSeen && pres.ms) { st = M.lastSeenLabel(pres.ms); on = M.isOnline(pres.ms); } }
    else st = `${cur.members.length} Mitglieder`;
    t.querySelector('b').textContent = title(cur); const s = t.querySelector('small'); s.textContent = st; s.className = on ? 'on' : '';
    const hav = chatAvatar(cur).replace('</span>', on ? '<i class="ms-dot"></i></span>' : '</span>'); if ($('ms-hav')._h !== hav) { $('ms-hav').innerHTML = hav; $('ms-hav')._h = hav; }
    $('b-info').classList.toggle('hidden', dm); const muted = M.isMuted(cur, S.meta), b = $('b-mute'); b.classList.toggle('on', muted); b.querySelector('i').className = 'fa-solid ' + (muted ? 'fa-bell-slash' : 'fa-bell'); b.title = muted ? 'Stummschaltung aufheben' : 'Stummschalten';
}
async function toggleMute() { if (!cur || cur.isNew) return; try { await M.setMute(cur.id, !M.isMuted(cur, S.meta)); } catch (e) { toast('Konnte nicht geändert werden.', true); } }

// ---------- Nachrichten zeichnen ----------
function tickHtml(m) {
    const t = M.ticks(m, cur, S.me, S.self.receipts !== false);
    return t.state === 'pending' ? '<i class="fa-solid fa-clock" title="Wird gesendet"></i>' : t.state === 'read' ? '<i class="fa-solid fa-check-double read" title="Gelesen"></i>' : `<i class="fa-solid ${t.n ? 'fa-check-double' : 'fa-check'}" title="${t.n ? 'Gelesen von ' + t.n + ' von ' + t.total : 'Gesendet'}"></i>`;
}
function msgHtml(it) {
    const m = it.m, rs = M.reactionSummary(m, S.me), grp = cur.type === 'group', imgOk = m.image && PHOTO_OK.test(m.image);
    const quote = m.replyTo ? `<div class="ms-quote" data-goto="${esc(m.replyTo.id)}"><b>${esc(nameOf(m.replyTo.from))}</b><span>${esc(m.replyTo.text || (m.replyTo.image ? 'Bild' : ''))}</span></div>` : '';
    const body = m.deleted ? '<span class="ms-del"><i class="fa-solid fa-ban"></i> Nachricht gelöscht</span>' : (imgOk ? `<img class="ms-img" src="${m.image}" data-zoom="1" alt="Bild">` : '') + (m.file && m.file.name ? `<button type="button" class="ms-file" data-file="${esc(m.id)}"><i class="fa-solid fa-file-arrow-down"></i><span><b>${esc(m.file.name)}</b><small>${m.file.size < 1048576 ? Math.max(1, Math.round(m.file.size / 1024)) + ' KB' : (m.file.size / 1048576).toFixed(1).replace('.', ',') + ' MB'} · Herunterladen</small></span></button>` : '') + (m.text ? `<div class="ms-t">${M.linkify(m.text)}</div>` : '');
    const av = !it.mine && grp ? (it.last ? avatarOf(m.from, 'sm') : '<span class="sp"></span>') : '';
    const tools = m.deleted || m.pending ? '' : `<div class="ms-tools"><button data-a="react" title="Reagieren" aria-label="Reagieren"><i class="fa-regular fa-face-smile"></i></button><button data-a="reply" title="Antworten" aria-label="Antworten"><i class="fa-solid fa-reply"></i></button><button data-a="more" title="Mehr" aria-label="Mehr"><i class="fa-solid fa-ellipsis"></i></button></div>`;
    return `<div class="ms-m${it.mine ? ' mine' : ''}${it.first ? ' first' : ''}" data-id="${esc(m.id)}">${av}<div class="ms-b">${tools}${it.showName ? `<span class="ms-nm">${esc(nameOf(m.from))}</span>` : ''}${quote}${body}
        <div class="ms-info">${m.editedAt && !m.deleted ? '<span>bearbeitet</span>' : ''}<time>${M.hhmm(m.createdMs)}</time>${it.mine && !m.deleted ? tickHtml(m) : ''}</div>
        ${rs.length && !m.deleted ? `<div class="ms-rx">${rs.map(r => `<button data-react="${esc(r.emoji)}" class="${r.mine ? 'me' : ''}">${esc(r.emoji)}${r.n > 1 ? ' ' + r.n : ''}</button>`).join('')}</div>` : ''}</div></div>`;
}
function renderMessages(freshOthers = 0, keepScroll = false) {
    if (!cur) return; const sc = $('ms-scroll'), atBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 90;
    const arr = [...msgs.values()].sort((a, b) => a.createdMs - b.createdMs), items = M.layout(arr, S.me, { group: cur.type === 'group', unreadFromId: firstUnreadId });
    const lastMine = arr.length && arr[arr.length - 1].from === S.me && arr[arr.length - 1].pending;
    const entries = [];
    if (hasMore) entries.push({ k: 'more', html: '<button class="ms-more" onclick="loadOlder()">Ältere Nachrichten laden</button>' });
    if (items.length) items.forEach(it => entries.push(it.type === 'day' ? { k: it.key, html: `<div class="ms-day">${esc(it.label)}</div>` } : it.type === 'unread' ? { k: 'unread', html: '<div class="ms-unread" id="ms-ud">Neue Nachrichten</div>' } : { k: 'm' + it.m.id, html: msgHtml(it) }));
    else entries.push({ k: 'empty', html: `<div class="ms-empty" style="margin:auto"><div class="big" style="width:64px;height:64px;font-size:26px"><i class="fa-regular fa-hand"></i></div><h3>${cur.isNew ? 'Neuer Chat' : 'Noch keine Nachrichten'}</h3><p>Schreib die erste Nachricht an ${esc(title(cur))}.</p></div>` });
    clearMarks(); patch(sc, entries, !firstRender && !keepScroll); if ($('ms-sq').value.trim()) refreshHits();
    if (keepScroll) return highlight();
    if (firstRender && arr.length) { const ud = $('ms-ud'); if (ud) ud.scrollIntoView({ block: 'center' }); else sc.scrollTop = sc.scrollHeight; firstRender = false; }
    else if (atBottom || lastMine) scrollDown(false);
    else if (freshOthers) { newBelow += freshOthers; $('ms-jn').textContent = newBelow; $('ms-jump').classList.remove('hidden'); }
    const near = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 90; if (near) { newBelow = 0; $('ms-jump').classList.add('hidden'); }
    highlight();
}
function scrollDown(smooth) { const sc = $('ms-scroll'); sc.scrollTo({ top: sc.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); newBelow = 0; $('ms-jump').classList.add('hidden'); }
$('ms-scroll').addEventListener('scroll', e => { const sc = e.target; if (sc.scrollHeight - sc.scrollTop - sc.clientHeight < 90) { newBelow = 0; $('ms-jump').classList.add('hidden'); } }, { passive: true });

// ---------- Aktionen an Nachrichten ----------
$('ms-scroll').addEventListener('click', e => {
    const z = e.target.closest('[data-zoom]'); if (z) return zoom(z.src);
    const fb = e.target.closest('[data-file]'); if (fb) { const it = msgs.get(fb.dataset.file), f = it && (it.m || it).file; if (f && /^data:/.test(f.data || '')) { const a = document.createElement('a'); a.href = f.data; a.download = f.name || 'Datei'; document.body.appendChild(a); a.click(); a.remove(); } return; }
    const g = e.target.closest('[data-goto]'); if (g) return gotoMsg(g.dataset.goto);
    const rx = e.target.closest('[data-react]'); const row = e.target.closest('.ms-m');
    if (rx && row) return doReact(row.dataset.id, rx.dataset.react);
    const a = e.target.closest('[data-a]');
    if (a && row) { e.stopPropagation(); const r = a.getBoundingClientRect(); return a.dataset.a === 'react' ? quickReact(row.dataset.id, r) : a.dataset.a === 'reply' ? startReply(row.dataset.id) : moreMenu(row.dataset.id, r); }
    if (row && matchMedia('(hover: none)').matches && !e.target.closest('a')) { const was = row.classList.contains('tools'); document.querySelectorAll('.ms-m.tools').forEach(x => x.classList.remove('tools')); if (!was) row.classList.add('tools'); }
});
document.addEventListener('click', e => { if (!e.target.closest('.ms-pop') && !e.target.closest('#b-emo')) closePop(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePop(); if ($('ms-lb')) $('ms-lb').remove(); else if ($('ms-mod') && !$('ms-mod').dataset.lock) closeModal(); else if (editing || replyTo) cancelBar(); } });
function gotoMsg(id) { const el = document.querySelector(`.ms-m[data-id="${CSS.escape(id)}"]`); if (!el) return toast('Diese Nachricht ist nicht mehr geladen.'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
function zoom(src) { if (!PHOTO_OK.test(src)) return; const d = document.createElement('div'); d.id = 'ms-lb'; d.innerHTML = `<img src="${src}" alt="Bild">`; d.onclick = () => d.remove(); document.body.appendChild(d); }
function quickReact(id, r) { closePop(); const p = document.createElement('div'); p.className = 'ms-pop ms-qr'; const quick = [...new Set([...EmojiPicker.recent().slice(0, 3), '👍', '❤️', '😂', '😮', '😢', '🙏'])].slice(0, 6); p.innerHTML = quick.map(x => `<button data-e="${esc(x)}">${esc(x)}</button>`).join('') + '<button data-more title="Weitere Emojis" aria-label="Weitere Emojis" class="more"><i class="fa-solid fa-plus"></i></button>'; document.body.appendChild(p); place(p, r.left - 100, r.top - 54, 296); p.onclick = e => { if (e.target.closest('[data-more]')) { closePop(); return EmojiPicker.open(document.querySelector(`.ms-m[data-id="${CSS.escape(id)}"] .ms-b`) || $('b-emo'), em => doReact(id, em), { title: 'Reaktion wählen' }); } const b = e.target.closest('[data-e]'); if (b) { closePop(); doReact(id, b.dataset.e); } }; }
async function doReact(id, emoji) { const m = msgs.get(id); if (!m || !cur) return; try { await M.react(cur, m, emoji); } catch (e) { toast('Reaktion fehlgeschlagen: ' + (e.code || e.message), true); } }
function moreMenu(id, r) {
    const m = msgs.get(id); if (!m) return; closePop(); const mine = m.from === S.me, p = document.createElement('div'); p.className = 'ms-pop ms-menu';
    p.innerHTML = `<button data-k="reply"><i class="fa-solid fa-reply"></i>Antworten</button>${m.text ? '<button data-k="copy"><i class="fa-regular fa-copy"></i>Text kopieren</button>' : ''}${mine && m.text && !m.image ? '<button data-k="edit"><i class="fa-solid fa-pen"></i>Bearbeiten</button>' : ''}${mine ? '<button data-k="del" class="bad"><i class="fa-solid fa-trash-can"></i>Löschen</button>' : ''}`;
    document.body.appendChild(p); place(p, r.left - 150, r.bottom + 6, 200);
    p.onclick = async e => { const b = e.target.closest('[data-k]'); if (!b) return; closePop();
        if (b.dataset.k === 'reply') startReply(id);
        else if (b.dataset.k === 'copy') { try { await navigator.clipboard.writeText(m.text); toast('Text kopiert'); } catch (x) { toast('Kopieren nicht möglich.', true); } }
        else if (b.dataset.k === 'edit') { editing = m; replyTo = null; $('ms-input').value = m.text; autoGrow(); renderBar(); $('ms-input').focus(); }
        else if (b.dataset.k === 'del') { if ((await uiConfirm('Diese Nachricht für alle löschen?', { danger: true, ok: 'Löschen' }))) try { await M.remove(cur, id); } catch (x) { toast('Löschen fehlgeschlagen: ' + (x.code || x.message), true); } } };
}
function startReply(id) { const m = msgs.get(id); if (!m) return; replyTo = m; editing = null; renderBar(); $('ms-input').focus(); }
function cancelBar() { replyTo = null; if (editing) { editing = null; $('ms-input').value = ''; autoGrow(); } staged = null; renderBar(); }
function renderBar() {
    const b = $('ms-rbar'); let h = '';
    if (editing) h = `<i class="fa-solid fa-pen" style="color:#f9a8d4"></i><div class="q"><b>Nachricht bearbeiten</b><span>${esc(editing.text)}</span></div>`;
    else if (replyTo) h = `<i class="fa-solid fa-reply" style="color:#f9a8d4"></i><div class="q"><b>Antwort an ${esc(nameOf(replyTo.from))}</b><span>${esc(replyTo.text || (replyTo.image ? 'Bild' : ''))}</span></div>`;
    if (staged) h += `<img src="${staged}" alt="Vorschau"><span style="color:#94a3b8">Bild angehängt</span>`;
    b.innerHTML = h ? h + '<button class="ms-ib" style="width:32px;height:32px" onclick="cancelBar()" aria-label="Abbrechen"><i class="fa-solid fa-xmark"></i></button>' : ''; b.classList.toggle('hidden', !h);
}

// ---------- Schreiben ----------
function autoGrow() { const t = $('ms-input'); t.style.height = 'auto'; t.style.height = Math.min(150, t.scrollHeight) + 'px'; }
$('ms-input').addEventListener('input', autoGrow);
$('ms-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); doSend(); } });
$('ms-input').addEventListener('paste', async e => { const f = [...(e.clipboardData && e.clipboardData.files || [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); stageImage(f); } });
$('ms-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) stageImage(f); });
async function stageImage(f) { try { staged = await M.compressImage(f); renderBar(); $('ms-input').focus(); } catch (e) { toast(e.message, true); } }
async function doSend() {
    if (!cur || Date.now() - lastSend < 350) return; const text = $('ms-input').value;
    try {
        if (editing) { if (!text.trim()) return toast('Der Text darf nicht leer sein.', true); const e = editing; editing = null; $('ms-input').value = ''; autoGrow(); renderBar(); await M.edit(cur, e.id, text); return; }
        if (!text.trim() && !staged) return; lastSend = Date.now();
        const r = replyTo ? { id: replyTo.id, from: replyTo.from, text: (replyTo.deleted ? '' : replyTo.text || '').slice(0, 120), image: !!replyTo.image } : null, img = staged;
        $('ms-input').value = ''; autoGrow(); replyTo = staged = null; renderBar(); const wasNew = cur.isNew;
        await M.send(cur, { text, image: img, replyTo: r }); if (wasNew) { cur.isNew = false; attachMessages(); } scrollDown(false);
    } catch (e) { console.error(e); toast('Senden fehlgeschlagen: ' + (e.code || e.message), true); $('ms-input').value = text; autoGrow(); }
}
// Emoji-Auswahl mit allen Emojis (js/emoji-picker.js). Bleibt offen, damit man mehrere hintereinander einfügen kann.
function openEmoji(e) {
    e.stopPropagation(); closePop();
    EmojiPicker.open($('b-emo'), em => { const i = $('ms-input'), s = i.selectionStart ?? i.value.length; i.value = i.value.slice(0, s) + em + i.value.slice(i.selectionEnd ?? s); i.selectionStart = i.selectionEnd = s + em.length; autoGrow(); if (!('ontouchstart' in window)) i.focus(); }, { keepOpen: true, title: 'Emoji einfügen' });
}

// ---------- Suche im Chat ----------
function toggleSearch(force) { const on = force === undefined ? $('ms-sbar').classList.contains('hidden') : force; $('ms-sbar').classList.toggle('hidden', !on); if (on) $('ms-sq').focus(); else { $('ms-sq').value = ''; hits = []; hitI = -1; highlight(); } }
function runSearch(keep) {
    const q = $('ms-sq').value.trim(); hits = q ? [...msgs.values()].filter(m => M.matches(m, q)).sort((a, b) => a.createdMs - b.createdMs).map(m => m.id) : [];
    if (!keep || hitI >= hits.length) hitI = hits.length ? hits.length - 1 : -1; highlight(); if (hitI >= 0) gotoHit();
}
// Treffer neu ermitteln (zum Beispiel wenn eine passende Nachricht eintrifft), ohne zu springen
function refreshHits() { const q = $('ms-sq').value.trim(); hits = q ? [...msgs.values()].filter(m => M.matches(m, q)).sort((a, b) => a.createdMs - b.createdMs).map(m => m.id) : []; if (hitI >= hits.length) hitI = hits.length - 1; }
function stepHit(d) { if (!hits.length) return; hitI = (hitI + d + hits.length) % hits.length; highlight(); gotoHit(); }
function gotoHit() { const el = document.querySelector(`.ms-m[data-id="${CSS.escape(hits[hitI])}"]`); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
function clearMarks() { const sc = $('ms-scroll'); sc.querySelectorAll('mark').forEach(m => m.replaceWith(document.createTextNode(m.textContent))); sc.querySelectorAll('.ms-t').forEach(t => t.normalize()); }
function highlight() {
    clearMarks();
    const q = $('ms-sq').value.trim(), cnt = $('ms-scount'); document.querySelectorAll('.ms-m.hit,.ms-m.hitcur').forEach(x => x.classList.remove('hit', 'hitcur'));
    cnt.textContent = !q ? '' : hits.length ? `${hitI + 1} von ${hits.length}${hasMore ? '+' : ''}` : hasMore ? 'Keine Treffer (nur geladene)' : 'Keine Treffer';
    if (!q) return; const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    hits.forEach((id, i) => { const el = document.querySelector(`.ms-m[data-id="${CSS.escape(id)}"]`); if (!el) return; el.classList.add(i === hitI ? 'hitcur' : 'hit');
        const tw = document.createTreeWalker(el.querySelector('.ms-t') || el, NodeFilter.SHOW_TEXT), nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
        nodes.forEach(n => { if (!re.test(n.nodeValue)) return; re.lastIndex = 0; const f = document.createDocumentFragment(); let last = 0; n.nodeValue.replace(re, (m, idx) => { f.append(n.nodeValue.slice(last, idx)); const mk = document.createElement('mark'); mk.textContent = m; f.append(mk); last = idx + m.length; return m; }); f.append(n.nodeValue.slice(last)); n.replaceWith(f); }); });
}

// ---------- Neuer Chat / Gruppe ----------
const people = () => Object.values(S.dir).filter(p => p.uid !== S.me).sort((a, b) => a.name.localeCompare(b.name, 'de'));
async function openNewChat() {
    try { await M.loadDirectory(); } catch (e) { /* alte Liste bleibt */ }
    modal(`<h3><i class="fa-solid fa-pen-to-square"></i>Neuer Chat</h3><p class="sub">Mit wem möchtest du schreiben?</p><input class="ms-in plain" id="np-q" placeholder="Name suchen" oninput="fillPeople('np-list', this.value)" autocomplete="off"><div class="ms-people" id="np-list"></div><div class="ms-acts"><button class="ms-btn" onclick="closeModal()">Abbrechen</button></div>`);
    fillPeople('np-list', '', uid => openDM(uid)); $('np-q').focus();
}
function fillPeople(target, term, onPick, checkbox) {
    const el = $(target); if (onPick) el._pick = onPick; term = (term || '').toLowerCase(); const list = people().filter(p => p.name.toLowerCase().includes(term));
    el.innerHTML = list.map(p => `<button class="ms-p" data-u="${esc(p.uid)}" type="button">${avatarOf(p.uid)}<span class="n">${esc(p.name)}</span>${checkbox ? '<input type="checkbox" tabindex="-1">' : ''}</button>`).join('') || '<div class="sub" style="padding:14px 4px;margin:0">Noch niemand freigegeben.</div>';
    if (!el._bound) { el._bound = true; el.addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (!b) return; if (checkbox || b.querySelector('input')) { const c = b.querySelector('input'); if (e.target !== c) c.checked = !c.checked; } else el._pick(b.dataset.u); }); }
}
async function openNewGroup() {
    try { await M.loadDirectory(); } catch (e) {}
    modal(`<h3><i class="fa-solid fa-user-group"></i>Neue Gruppe</h3><p class="sub">Gib der Gruppe einen Namen und wähle die Mitglieder.</p><input class="ms-in plain" id="ng-t" maxlength="60" placeholder="Gruppenname" autocomplete="off"><div style="height:8px"></div>
        <div class="ms-people" id="ng-list"></div><div class="ms-acts"><button class="ms-btn" onclick="closeModal()">Abbrechen</button><button class="ms-btn go" id="ng-go" onclick="createGroup()">Gruppe erstellen</button></div>`);
    fillPeople('ng-list', '', null, true); $('ng-t').focus();
}
async function createGroup() {
    const t = $('ng-t').value.trim(), ids = [...document.querySelectorAll('#ng-list .ms-p')].filter(b => b.querySelector('input').checked).map(b => b.dataset.u);
    if (!t) return toast('Bitte einen Gruppennamen eingeben.', true); if (!ids.length) return toast('Wähle mindestens ein Mitglied.', true); if (ids.length > 29) return toast('Höchstens 30 Mitglieder.', true);
    $('ng-go').disabled = true;
    try { const id = await M.createGroup(t, ids); closeModal(); const un = M.subscribe(() => { const c = S.chats.find(x => x.id === id); if (c) { un(); openChat(id); } }); }
    catch (e) { $('ng-go').disabled = false; toast('Gruppe konnte nicht erstellt werden: ' + (e.code || e.message), true); }
}
function openInfo() {
    if (!cur || cur.type !== 'group') return; const mine = cur.createdBy === S.me;
    const rows = cur.members.map(u => `<div class="ms-p" style="cursor:default">${avatarOf(u)}<span class="n">${esc(nameOf(u))}${u === S.me ? ' (du)' : ''}${u === cur.createdBy ? ' <small>· Ersteller</small>' : ''}</span>${mine && u !== S.me ? `<button class="ms-ib" style="width:32px;height:32px" data-rm="${esc(u)}" aria-label="Entfernen"><i class="fa-solid fa-user-minus"></i></button>` : ''}</div>`).join('');
    const m = modal(`<h3><i class="fa-solid fa-users"></i>${esc(cur.title || 'Gruppe')}</h3><p class="sub">${cur.members.length} Mitglieder</p>
        ${mine ? `<div style="display:flex;gap:8px;margin-bottom:8px"><input class="ms-in plain" id="gi-t" maxlength="60" value="${esc(cur.title || '')}"><button class="ms-btn" onclick="renameGroup()">Umbenennen</button></div>` : ''}
        <div class="ms-people">${rows}</div>
        ${mine ? '<button class="ms-btn" onclick="openAddMembers()"><i class="fa-solid fa-user-plus"></i> Mitglieder hinzufügen</button>' : ''}
        <div class="ms-acts">${!mine ? '<button class="ms-btn bad" onclick="leaveGroup()">Gruppe verlassen</button>' : ''}<button class="ms-btn" onclick="closeModal()">Schließen</button></div>`);
    m.addEventListener('click', async e => { const r = e.target.closest('[data-rm]'); if (!r || !(await uiConfirm('Dieses Mitglied entfernen?', { danger: true, ok: 'Entfernen' }))) return; try { await M.updateGroup(cur, { members: cur.members.filter(u => u !== r.dataset.rm) }); closeModal(); } catch (x) { toast('Fehlgeschlagen: ' + (x.code || x.message), true); } });
}
async function renameGroup() { const t = $('gi-t').value.trim(); if (!t) return toast('Der Name darf nicht leer sein.', true); try { await M.updateGroup(cur, { title: t.slice(0, 60) }); closeModal(); } catch (e) { toast('Fehlgeschlagen: ' + (e.code || e.message), true); } }
async function leaveGroup() { if (!(await uiConfirm('Gruppe wirklich verlassen?', { danger: true, ok: 'Verlassen' }))) return; try { await M.leaveGroup(cur); closeModal(); closeChat(); } catch (e) { toast('Fehlgeschlagen: ' + (e.code || e.message), true); } }
async function openAddMembers() {
    try { await M.loadDirectory(); } catch (e) {} const c = cur; const free = people().filter(p => !c.members.includes(p.uid));
    modal(`<h3><i class="fa-solid fa-user-plus"></i>Mitglieder hinzufügen</h3><div class="ms-people" id="am-list">${free.map(p => `<button class="ms-p" data-u="${esc(p.uid)}" type="button">${avatarOf(p.uid)}<span class="n">${esc(p.name)}</span><input type="checkbox" tabindex="-1"></button>`).join('') || '<div class="sub">Alle sind schon dabei.</div>'}</div>
        <div class="ms-acts"><button class="ms-btn" onclick="closeModal()">Abbrechen</button><button class="ms-btn go" onclick="addMembers()">Hinzufügen</button></div>`);
    $('am-list').addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (b) { const i = b.querySelector('input'); if (e.target !== i) i.checked = !i.checked; } });
}
async function addMembers() {
    const ids = [...document.querySelectorAll('#am-list .ms-p')].filter(b => b.querySelector('input').checked).map(b => b.dataset.u); if (!ids.length) return closeModal();
    if (cur.members.length + ids.length > 30) return toast('Höchstens 30 Mitglieder.', true);
    try { await M.updateGroup(cur, { members: [...cur.members, ...ids] }); closeModal(); } catch (e) { toast('Fehlgeschlagen: ' + (e.code || e.message), true); }
}

// ---------- Einstellungen ----------
function openSettings() {
    const p = M.prefs(), sw = (id, on, t, s) => `<div class="ms-sw"><div>${t}<small>${s}</small></div><button class="ms-tg${on ? ' on' : ''}" id="${id}" role="switch" aria-checked="${on}" aria-label="${t}"></button></div>`;
    const m = modal(`<h3><i class="fa-solid fa-sliders"></i>Einstellungen</h3><p class="sub">Diese Einstellungen gelten für dein Konto.</p>
        ${sw('st-rec', S.self.receipts !== false, 'Lesebestätigung', 'Andere sehen, wann du ihre Nachrichten gelesen hast (Gelesen-Haken). Schaltest du es aus, siehst du die Haken der anderen auch nicht mehr.')}
        ${sw('st-seen', S.self.showSeen !== false, 'Zuletzt aktiv anzeigen', 'Andere sehen, ob du online bist oder wann du zuletzt aktiv warst.')}
        ${sw('st-snd', p.sound, 'Ton bei neuen Nachrichten', 'Ein kurzer Ton, wenn der Chat nicht im Vordergrund ist. Gilt nur auf diesem Gerät.')}
        ${sw('st-dsk', p.desktop && 'Notification' in window && Notification.permission === 'granted', 'Hinweise im Browser', 'Zeigt eine Benachrichtigung, solange das Portal in einem Tab geöffnet ist. Bei geschlossenem Browser kommt nichts an.')}
        ${sw('st-prv', p.preview, 'Nachrichtentext in Hinweisen zeigen', 'Aus: Es steht nur „Neue Nachricht“ im Hinweis. Besser, wenn andere auf deinen Bildschirm sehen können.')}
        <div class="ms-acts"><button class="ms-btn" onclick="closeModal(); showRules()">Nutzungsregeln</button><button class="ms-btn go" onclick="closeModal()">Fertig</button></div>`);
    m.addEventListener('click', async e => {
        const t = e.target.closest('.ms-tg'); if (!t) return; const on = !t.classList.contains('on');
        try {
            if (t.id === 'st-rec') await M.setSelfPref('receipts', on); else if (t.id === 'st-seen') await M.setSelfPref('showSeen', on);
            else if (t.id === 'st-snd') { M.setPrefs({ sound: on }); if (on) M.beep(); }
            else if (t.id === 'st-prv') M.setPrefs({ preview: on });
            else if (t.id === 'st-dsk') {
                if (on) { if (!('Notification' in window)) return toast('Dein Browser unterstützt keine Hinweise.', true); const r = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission(); if (r !== 'granted') return toast('Hinweise wurden im Browser nicht erlaubt.', true); }
                M.setPrefs({ desktop: on });
            }
            t.classList.toggle('on', on); t.setAttribute('aria-checked', on); renderMessages(0, true);
        } catch (x) { toast('Konnte nicht gespeichert werden: ' + (x.code || x.message), true); }
    });
}
