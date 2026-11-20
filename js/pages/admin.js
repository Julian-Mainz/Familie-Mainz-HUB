// js/pages/admin.js - Seiten-Code von /admin.html (ausgelagert, damit der Browser ihn zwischenspeichern kann)
const ROLES = {
    admin: { label: 'Admin',   perms: { termine: true, pinnwand: true, aufgaben: true, zeit: true,  finanzen: true,  tresor: true,  wand: true,  spotify: true,  webapps: true, dokumente: true,  messenger: true,  gruppen: true,  admin: true } },
    user:  { label: 'Mitglied', perms: { termine: true, pinnwand: true, aufgaben: true, zeit: true,  finanzen: true,  tresor: true,  wand: true,  spotify: true,  webapps: true, dokumente: true,  messenger: false, gruppen: false, admin: false } },
    guest: { label: 'Gast',    perms: { termine: true, pinnwand: true, aufgaben: true, zeit: false, finanzen: false, tresor: false, wand: false, spotify: false, webapps: false, dokumente: false, messenger: false, gruppen: false, admin: false } }
};
// Avatar-Helfer kommen aus drawer.js; fehlt die Datei, bleibt die Liste trotzdem bedienbar
const avGrad = i => (typeof avatarGradient === 'function' ? avatarGradient(i) : '#4f46e5');
const avInner = u => (typeof avatarInner === 'function' ? avatarInner(u) : '');
// Alle einzeln vergebbaren Rechte. Neue Bereiche später hier ergänzen.
const PERM_GROUPS = [
    ['Startseite', { termine: 'Kalender & Termine', pinnwand: 'Pinnwand', aufgaben: 'Aufgaben & Einkauf' }],
    ['Bereiche', { zeit: 'Zeiterfassung', finanzen: 'Finanzen', tresor: 'Passwort-Safe', wand: 'Wandkalender', spotify: 'Spotify', webapps: 'Web-Apps', dokumente: 'Dokumente' }],
    ['Kommunikation', { messenger: 'Messenger', gruppen: 'Gruppen erstellen' }]
];
// Opt-in: gelten nur, wenn ausdrücklich erteilt (auch für Admins, und Admins können sie sich selbst geben)
const OPT_IN = ['messenger', 'gruppen', 'dokumente'];
const PERM_KEYS = PERM_GROUPS.flatMap(([, m]) => Object.keys(m));
const PERM_LABEL = Object.assign({}, ...PERM_GROUPS.map(([, m]) => m));
const BADGE = { active: ['Aktiv', 'g'], pending: ['Wartet auf Freigabe', 'a'], blocked: ['Gesperrt', 'r'] };
const CAT_COLOR = { auth: '#a5b4fc', data: '#6ee7b7', admin: '#fcd34d', visit: '#94a3b8', error: '#fda4af' };
const st = u => u.status || 'active';
const fmtDate = t => t?.toDate ? t.toDate().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–';
const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
const activeAdmins = () => allUsers.filter(u => isAdmin(u) && st(u) === 'active');
const isSelf = u => u.id === currentUser.uid;

let allUsers = [], fText = '', fStatus = 'all', todayLogs = [], logs = [], logCursor = null, logsLoaded = false, sysLoaded = false, reads = 0, started = false;

initAuthGuard(user => {
    if (!user || started) return;
    started = true;
    renderDrawer();
    db.collection('users').onSnapshot(s => { allUsers = s.docs.map(d => ({ id: d.id, ...d.data() })); renderUsers(); renderInvites(); },
        err => { $('admin-user-list').innerHTML = `<div class="ux-card ux-empty neg" style="grid-column:1/-1">Benutzer konnten nicht geladen werden: ${esc(err.message)}</div>`; });
    $('adm-search').addEventListener('input', e => { fText = e.target.value.toLowerCase(); renderUsers(); });
    $('adm-status').addEventListener('change', e => { fStatus = e.target.value; renderUsers(); });
    $('admin-user-list').addEventListener('change', e => { const u = userOf(e.target); if (!u) return; if ('role' in e.target.dataset) setRole(u, e.target.value); if (e.target.dataset.perm) togglePerm(u, e.target.dataset.perm, e.target.checked); });
    $('admin-user-list').addEventListener('click', e => {
        const b = e.target.closest('[data-act]'), u = b && userOf(b); if (!u) return;
        ({ approve: () => setStatus(u, 'active'), block: () => setStatus(u, 'blocked'), delete: () => removeUser(u), reset: () => resetPw(u), allperms: () => setAllPerms(u, true), noperms: () => setAllPerms(u, false) })[b.dataset.act]();
    });
    loadToday(); initMessages(); initInvites(); initMaint();
    showTab(location.hash.slice(1) || 'users');
}, { admin: true });

const userOf = el => allUsers.find(u => u.id === el.closest('[data-uid]')?.dataset.uid);

function showTab(t) {
    if (!$('tab-' + t)) t = 'users';
    ['users', 'logs', 'system', 'messages', 'wartung'].forEach(k => $('tab-' + k).classList.toggle('hidden', k !== t));
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    history.replaceState(null, '', '#' + t);
    if (t === 'logs' && !logsLoaded) loadLogs(true);
    if (t === 'system' && !sysLoaded) loadSystem();
}
function jumpPending() { fStatus = 'pending'; $('adm-status').value = 'pending'; showTab('users'); renderUsers(); }
function jumpFails() { $('log-period').value = '0'; $('log-q').value = 'Fehlgeschlagen'; $('log-cat').value = ''; showTab('logs'); loadLogs(true); }

function jumpErrors() { $('log-period').value = '0'; $('log-q').value = ''; $('log-cat').value = 'error'; showTab('logs'); loadLogs(true); }

// ---------- Kennzahlen ----------
async function loadToday() {
    try {
        const t0 = performance.now(), start = new Date(); start.setHours(0, 0, 0, 0);
        const snap = await db.collection('system_logs').where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(start)).orderBy('timestamp', 'desc').limit(500).get();
        const ms = Math.round(performance.now() - t0); reads += snap.size;
        todayLogs = snap.docs.map(d => d.data());
        $('k-db').innerHTML = `<span class="kdot${ms < 1500 ? '' : ' warn'}"></span>${ms} <small>ms</small>`;
        const fails = todayLogs.filter(l => (l.action || '').includes('Fehlgeschlagen')).length;
        $('k-fail').innerText = fails; $('k-fail').className = 'v ' + (fails ? 'neg' : 'pos');
        const errs = todayLogs.filter(l => l.category === 'error').length;
        $('k-err').innerText = errs ? `${errs} Browser-Fehler heute` : 'keine Browser-Fehler'; $('k-err').className = 'chip ' + (errs ? 'r' : 'g');
        $('k-active').innerText = new Set(todayLogs.filter(l => l.userEmail && l.userEmail !== 'Gast / Anonym').map(l => l.userEmail)).size + ' Personen';
    } catch (e) { $('k-db').innerHTML = '<span class="kdot bad"></span>Fehler'; }
}

// ---------- Einladungen ----------
let invites = [];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';           // ohne leicht verwechselbare Zeichen (0/O, 1/I)
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), x => CODE_CHARS[x % 32]).join('');
const showCode = c => c.replace(/(.{5})(?=.)/g, '$1-');
async function copyText(t, btn) {
    try { await navigator.clipboard.writeText(t); } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); }
    if (btn) { const old = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-check"></i>Kopiert'; setTimeout(() => { btn.innerHTML = old; }, 1400); }
}
function initInvites() {
    db.collection('invites').orderBy('createdAt', 'desc').limit(60).onSnapshot(s => { invites = s.docs.map(d => ({ id: d.id, ...d.data() })); renderInvites(); },
        err => { $('inv-list').innerHTML = `<div class="ux-note neg">Einladungen konnten nicht geladen werden: ${esc(err.message)} (sind die neuen Firestore-Regeln veröffentlicht?)</div>`; });
    $('inv-list').addEventListener('click', async e => {
        const b = e.target.closest('[data-i]'); if (!b) return; const id = b.dataset.id;
        if (b.dataset.i === 'code') copyText(showCode(id), b);
        if (b.dataset.i === 'link') copyText(`${location.origin}/?code=${id}`, b);
        if (b.dataset.i === 'del' && (await uiConfirm('Diesen Code löschen? Ein noch nicht eingelöster Code ist danach ungültig.', { danger: true, ok: 'Löschen' }))) db.collection('invites').doc(id).delete().then(() => logSystemEvent('admin', 'Einladung gelöscht')).catch(x => alert('Fehlgeschlagen: ' + x.message));
    });
}
async function createInvite() {
    const days = +$('inv-exp').value, note = $('inv-note').value.trim().slice(0, 60), code = newCode();
    const data = { createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser.email, note, used: false };
    if (days > 0) data.expiresAt = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + days * 864e5));
    try { await db.collection('invites').doc(code).set(data); $('inv-note').value = ''; logSystemEvent('admin', 'Einladung erzeugt', { code: code.slice(0, 4) + '…', notiz: note }); }
    catch (err) { alert('Fehlgeschlagen: ' + err.message); }
}
function renderInvites() {
    const now = Date.now();
    $('inv-list').innerHTML = invites.length ? invites.map(i => {
        const exp = i.expiresAt && i.expiresAt.toDate ? i.expiresAt.toDate() : null, expired = !i.used && exp && exp.getTime() < now;
        const who = i.used ? allUsers.find(u => u.id === i.usedBy) : null;
        const [lbl, cls] = i.used ? ['Eingelöst', ''] : expired ? ['Abgelaufen', 'r'] : ['Offen', 'g'];
        const info = i.used ? `von ${esc(who ? who.displayName || who.email : 'unbekannt')} am ${fmtDate(i.usedAt)}` : (exp ? `gültig bis ${exp.toLocaleDateString('de-DE')}` : 'unbegrenzt gültig');
        const open = !i.used && !expired;
        return `<div class="inv${open ? ' open' : ''}">
            <b class="code">${esc(showCode(i.id))}</b><span class="chip ${cls}">${lbl}</span>
            <span class="ux-note inote">${i.note ? '<b>' + esc(i.note) + '</b> · ' : ''}${info}</span>
            ${open ? `<button data-i="code" data-id="${esc(i.id)}" class="ux-btn sm">Code kopieren</button><button data-i="link" data-id="${esc(i.id)}" class="ux-btn sm"><i class="fa-solid fa-link"></i>Link kopieren</button>` : ''}
            <button data-i="del" data-id="${esc(i.id)}" class="ux-ib bad" title="Löschen" aria-label="Einladung löschen"><i class="fa-solid fa-trash-can"></i></button></div>`;
    }).join('') : '<div class="ux-note">Noch keine Einladungen. Erzeuge einen Code und schicke ihn der Person.</div>';
}

// ---------- Benutzer ----------
async function update(u, data, msg) {
    try {
        await db.collection('users').doc(u.id).update(data); logSystemEvent('admin', msg, { ziel: u.email });
        // Wer den Messenger nicht mehr nutzen darf (Recht entzogen, gesperrt, Rolle zurückgesetzt), verschwindet aus dem Verzeichnis
        const p = data.permissions;
        if (data['permissions.messenger'] === false || (p && p.messenger !== true) || (data.status && data.status !== 'active')) db.collection('directory').doc(u.id).delete().catch(() => {});
    }
    catch (err) { alert('Fehlgeschlagen: ' + err.message); renderUsers(); }
}
function lastAdminBlocked(u, what) {
    if (isAdmin(u) && st(u) === 'active' && activeAdmins().length <= 1) { alert(`Der letzte aktive Admin kann nicht ${what} werden.`); return true; }
    return false;
}
async function setRole(u, role) {
    if (isSelf(u)) return renderUsers();
    if (role !== 'admin' && lastAdminBlocked(u, 'herabgestuft')) return renderUsers();
    const msg = role === 'admin' ? `${u.email} zum ADMIN machen? Admins haben Zugriff auf alle Bereiche, auch auf diese Seite.` : `Rolle von ${u.email} auf „${ROLES[role].label}“ setzen? Die Einzelrechte werden dabei zurückgesetzt.`;
    if (!(await uiConfirm(msg))) return renderUsers();
    update(u, { role, permissions: ROLES[role].perms }, `Rolle auf „${ROLES[role].label}“ gesetzt`);
}
function setAllPerms(u, on) {
    if (isSelf(u) || isAdmin(u)) return;
    const p = {}; PERM_KEYS.forEach(k => { p[k] = on; }); p.admin = false;
    update(u, { permissions: p }, on ? 'Alle Rechte erteilt' : 'Alle Rechte entzogen');
}
function togglePerm(u, key, checked) { if (isSelf(u) && !OPT_IN.includes(key)) return renderUsers(); update(u, { [`permissions.${key}`]: checked }, `Recht „${PERM_LABEL[key] || key}“ ${checked ? 'erteilt' : 'entzogen'}`); }
async function setStatus(u, status) {
    if (status === 'blocked') {
        if (isSelf(u)) return alert('Du kannst dich nicht selbst sperren.');
        if (lastAdminBlocked(u, 'gesperrt')) return;
        if (!(await uiConfirm(`${u.email} sperren? Der Zugriff ist sofort beendet.`, { danger: true, ok: 'Sperren' }))) return;
    }
    update(u, { status }, status === 'active' ? 'Benutzer freigegeben / entsperrt' : 'Benutzer gesperrt');
}
async function removeUser(u) {
    if (isSelf(u)) return alert('Du kannst dein eigenes Profil nicht löschen.');
    if (lastAdminBlocked(u, 'gelöscht')) return;
    if (!(await uiConfirm(`Profil von ${u.email} löschen?\n\nDer Zugriff ist danach beendet. Das Login-Konto bleibt in Firebase (Authentication) bestehen und muss dort separat gelöscht werden.`, { danger: true, ok: 'Löschen' }))) return;
    try { await db.collection('users').doc(u.id).delete(); logSystemEvent('admin', 'Benutzerprofil gelöscht', { ziel: u.email }); } catch (err) { alert('Fehlgeschlagen: ' + err.message); }
}
async function resetPw(u) {
    if (!(await uiConfirm(`E-Mail zum Zurücksetzen des Passworts an ${u.email} senden?`))) return;
    try { await auth.sendPasswordResetEmail(u.email); logSystemEvent('admin', 'Passwort-Reset gesendet', { ziel: u.email }); alert('E-Mail wurde versendet.'); } catch (err) { alert('Fehlgeschlagen: ' + err.message); }
}
async function approveAll() {
    const list = allUsers.filter(u => st(u) === 'pending');
    if (!list.length || !(await uiConfirm(`${list.length} wartende Konten freigeben?`))) return;
    try { const b = db.batch(); list.forEach(u => b.update(db.collection('users').doc(u.id), { status: 'active' })); await b.commit(); logSystemEvent('admin', 'Mehrere Benutzer freigegeben', { anzahl: list.length }); } catch (err) { alert('Fehlgeschlagen: ' + err.message); }
}

function renderUsers() {
    const pending = allUsers.filter(u => st(u) === 'pending').length, active = allUsers.filter(u => st(u) === 'active').length;
    $('k-pend').innerText = pending; $('k-users').innerText = `${active} aktiv / ${allUsers.length}`;
    $('btn-approve-all').classList.toggle('hidden', !pending); $('btn-approve-all').querySelector('span').innerText = `Alle ${pending} freigeben`;
    const rows = allUsers.filter(u => (fStatus === 'all' || st(u) === fStatus) && (!fText || `${u.displayName || ''} ${u.email}`.toLowerCase().includes(fText)))
        .sort((a, b) => (st(b) === 'pending') - (st(a) === 'pending') || (a.displayName || a.email).localeCompare(b.displayName || b.email, 'de'));
    $('admin-user-list').innerHTML = rows.length ? rows.map(u => {
        const self = isSelf(u), s = st(u), perms = u.permissions || {}, admin = isAdmin(u), [bl, bc] = BADGE[s] || BADGE.active;
        return `<div data-uid="${esc(u.id)}" class="ux-card usr${s === 'pending' ? ' pend' : ''}">
            <div class="uh"><span class="adm-av" style="background:${avGrad(u.avatarColor)}">${avInner({ ...u, name: u.displayName || u.email })}</span>
                <div class="un"><b>${esc(u.displayName || u.email)}</b> ${self ? '<span class="chip">Du</span>' : ''}${u.notificationsEnabled ? ' <i class="fa-solid fa-bell" style="color:#facc15;font-size:11px" title="Push aktiv"></i>' : ''}
                    <small>${esc(u.email)}</small><small class="dim">Registriert: ${fmtDate(u.createdAt)} · Letzter Login: ${fmtDate(u.lastLogin)}</small></div>
                <span class="chip ${bc}">${bl}</span>
                <select data-role class="ux-in rsel" ${self ? 'disabled title="Eigene Rolle kann nicht geändert werden"' : ''}>${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${(u.role || 'user') === k ? 'selected' : ''}>${r.label}</option>`).join('')}</select></div>
            ${s === 'pending' ? '<div class="ux-note pnote">Neue Konten starten nur mit Kalender-Rechten. Wähle eine Rolle oder einzelne Rechte und gib das Konto dann frei.</div>' : ''}
            <div class="pg">${PERM_GROUPS.map(([g, m]) => `<div class="pgrow"><span class="uppercase grp">${g}</span><div class="pgsw">${Object.entries(m).map(([k, l]) => {
                const auto = admin && k === 'dokumente', lock = auto || ((admin || self) && !OPT_IN.includes(k)), on = auto ? true : OPT_IN.includes(k) ? perms[k] === true : (admin || perms[k] !== false);   // Admins haben "Dokumente" automatisch
                return `<label class="sw${lock ? ' lock' : ''}"><input type="checkbox" class="swi" data-perm="${k}" ${on ? 'checked' : ''} ${lock ? 'disabled' : ''}>${l}</label>`; }).join('')}</div></div>`).join('')}</div>
            <div class="ua">
                ${!admin && !self ? '<span class="uset"><button data-act="allperms" class="ux-btn sm">Alle Rechte</button><button data-act="noperms" class="ux-btn sm">Keine</button></span>' : ''}
                ${s !== 'active' ? '<button data-act="approve" class="ux-btn pri sm"><i class="fa-solid fa-user-check"></i>Freigeben</button>' : ''}
                ${s === 'active' && !self ? '<button data-act="block" class="ux-btn sm"><i class="fa-solid fa-ban"></i>Sperren</button>' : ''}
                ${!self ? '<button data-act="reset" class="ux-btn sm"><i class="fa-solid fa-key"></i>Passwort-Reset</button>' : ''}
                ${!self ? '<button data-act="delete" class="ux-btn sm danger">Profil löschen</button>' : ''}</div></div>`;
    }).join('') : '<div class="ux-card ux-empty" style="grid-column:1/-1">Keine Benutzer gefunden.</div>';
}

// ---------- Wartungsmodus (siehe firebase-init.js) ----------
let maint = { pages: {} };
function initMaint() {
    maint = window.MAINT || { pages: {} }; renderMaint(); fillMaintText();
    document.addEventListener('maint-change', e => { maint = e.detail; renderMaint(); });
    watchMaint().then(m => { maint = m; renderMaint(); fillMaintText(); });
    $('mt-list').addEventListener('change', e => e.target.dataset.mt && maintToggle(e.target.dataset.mt, e.target.checked, e.target));
    $('mt-sys').addEventListener('change', e => e.target.dataset.mt && maintToggle(e.target.dataset.mt, e.target.checked, e.target));
    ['mt-msg', 'mt-until'].forEach(id => $(id).addEventListener('input', maintPreview));
}
const mtRow = (p, sys) => { const on = maintOn(p.key, maint);
    return `<label class="mtrow${sys ? ' sys' : ''}" style="--c:${p.c}"><span class="mti"><i class="fa-solid ${p.icon}"></i></span>
        <span class="mtl"><b>${esc(p.label)}</b><small>${on ? 'In Wartung' : sys ? 'Nur Admins können sich anmelden, alle anderen werden ausgesperrt' : 'Läuft normal'}</small></span>
        <input type="checkbox" class="swi" data-mt="${p.key}" ${on ? 'checked' : ''} aria-label="${esc(p.label)} in Wartung"></label>`; };
function renderMaint() {
    const n = MAINT_PAGES.filter(p => maintOn(p.key, maint)).length, sys = maintOn('/', maint);
    $('mt-sys').innerHTML = mtRow(MAINT_PAGES[0], true);
    $('mt-list').innerHTML = MAINT_PAGES.slice(1).map(p => mtRow(p)).join('');
    $('mt-list').style.opacity = sys ? .5 : 1;
    $('mt-badge').classList.toggle('hidden', !n); $('mt-badge').innerText = sys ? 'alles' : n;
    $('mt-off').disabled = !n;
    $('mt-info').innerText = sys ? 'Ganzes System in Wartung' : n ? `${n} ${n === 1 ? 'Seite' : 'Seiten'} in Wartung` : 'Alles läuft normal';
}
function fillMaintText() { $('mt-msg').value = maint.msg || ''; $('mt-msg').placeholder = MAINT_DEFAULT_MSG; $('mt-until').value = maint.until || ''; maintPreview(); }
function maintPreview() {
    $('mt-prev-msg').innerText = $('mt-msg').value.trim() || MAINT_DEFAULT_MSG;
    $('mt-prev-until').innerText = maintUntilText({ until: $('mt-until').value });
}
const maintMeta = () => ({ updatedBy: currentUser.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
async function maintToggle(key, on, el) {
    const p = MAINT_PAGES.find(x => x.key === key);
    if (key === '/' && on && !(await uiConfirm('Ganzes System in Wartung setzen?\n\nAlle, die keine Admins sind, werden sofort ausgesperrt und können sich nicht mehr anmelden. Du selbst kommst weiter rein.', { danger: true, ok: 'Sperren' }))) { el.checked = false; return; }
    try {
        await maintRef().set({ pages: { [key]: on }, ...maintMeta() }, { merge: true });
        logSystemEvent('admin', on ? 'Wartung eingeschaltet' : 'Wartung beendet', { seite: p ? p.label : key });
    } catch (err) { el.checked = !on; alert('Fehlgeschlagen: ' + err.message); }
}
async function maintAllOff() {
    if (!(await uiConfirm('Alle Wartungen beenden? Alle Seiten sind danach wieder für alle erreichbar.'))) return;
    try { await maintRef().set({ pages: {}, msg: maint.msg || '', until: maint.until || '', ...maintMeta() }); logSystemEvent('admin', 'Alle Wartungen beendet'); } catch (err) { alert('Fehlgeschlagen: ' + err.message); }
}
async function saveMaintText() {
    const b = $('mt-save'); b.disabled = true;
    try { await maintRef().set({ msg: $('mt-msg').value.trim().slice(0, 300), until: $('mt-until').value || '', ...maintMeta() }, { merge: true }); b.innerHTML = '<i class="fa-solid fa-check"></i>Gespeichert'; setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-check"></i>Speichern'; }, 1600); }
    catch (err) { alert('Fehlgeschlagen: ' + err.message); }
    b.disabled = false;
}

// ---------- Nachrichten (Kontaktformular der Startseite) ----------
let messages = [];
function initMessages() {
    db.collection('contact_messages').orderBy('createdAt', 'desc').limit(100).onSnapshot(s => { messages = s.docs.map(d => ({ id: d.id, ...d.data() })); renderMessages(); },
        err => { $('msg-list').innerHTML = `<div class="ux-card ux-empty neg">Nachrichten konnten nicht geladen werden: ${esc(err.message)}</div>`; });
    $('msg-list').addEventListener('click', async e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const m = messages.find(x => x.id === b.dataset.id); if (!m) return;
        if (b.dataset.m === 'read') db.collection('contact_messages').doc(m.id).update({ read: !m.read }).catch(x => alert('Fehler: ' + x.message));
        if (b.dataset.m === 'del' && (await uiConfirm('Nachricht endgültig löschen?', { danger: true, ok: 'Löschen' }))) db.collection('contact_messages').doc(m.id).delete().then(() => logSystemEvent('admin', 'Kontaktnachricht gelöscht')).catch(x => alert('Fehler: ' + x.message));
    });
}
function renderMessages() {
    const unread = messages.filter(m => !m.read).length;
    $('msg-badge').innerText = unread; $('msg-badge').classList.toggle('hidden', !unread);
    $('msg-info').innerText = `${messages.length} Nachrichten · ${unread} ungelesen`;
    $('msg-list').innerHTML = messages.length ? messages.map(m => `<div class="ux-card msgc${m.read ? '' : ' new'}">
        <div class="mh"><div><b>${esc(m.name)}</b> ${m.read ? '' : '<span class="chip a">neu</span>'}<small>${m.email ? esc(m.email) : 'keine E-Mail angegeben'} · ${fmtDate(m.createdAt)}</small></div>
            <div class="ma">${m.email ? `<a href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Antwort auf deine Nachricht')}" class="ux-btn sm"><i class="fa-solid fa-reply"></i>Antworten</a>` : ''}
            <button data-m="read" data-id="${esc(m.id)}" class="ux-btn sm">${m.read ? 'Als ungelesen' : 'Gelesen'}</button>
            <button data-m="del" data-id="${esc(m.id)}" class="ux-ib bad" aria-label="Nachricht löschen"><i class="fa-solid fa-trash-can"></i></button></div></div>
        <p>${esc(m.message)}</p></div>`).join('') : '<div class="ux-card ux-empty"><i class="fa-solid fa-envelope-open"></i>Noch keine Nachrichten.</div>';
}
async function markAllRead() {
    const list = messages.filter(m => !m.read); if (!list.length) return;
    try { const b = db.batch(); list.forEach(m => b.update(db.collection('contact_messages').doc(m.id), { read: true })); await b.commit(); } catch (err) { alert('Fehler: ' + err.message); }
}

// ---------- Logs ----------
const detailsOf = l => [l.device, l.details && Object.keys(l.details).length ? JSON.stringify(l.details) : ''].filter(Boolean).join(' · ');
const logTime = l => { if (!l.timestamp?.toDate) return '--'; const d = l.timestamp.toDate(); return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('de-DE')}`; };

async function loadLogs(reset) {
    logsLoaded = true;
    try {
        let q = db.collection('system_logs').orderBy('timestamp', 'desc');
        const p = $('log-period').value;
        if (p !== 'all') { const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - +p); q = db.collection('system_logs').where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(from)).orderBy('timestamp', 'desc'); }
        if (!reset && logCursor) q = q.startAfter(logCursor);
        const snap = await q.limit(100).get(); reads += snap.size;
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        logs = reset ? rows : logs.concat(rows);
        logCursor = snap.docs[snap.docs.length - 1] || logCursor;
        $('log-more').classList.toggle('hidden', snap.size < 100);
        renderLogs();
    } catch (e) { $('logs-body').innerHTML = `<tr><td colspan="5" class="empty neg">Logs konnten nicht geladen werden: ${esc(e.message)}</td></tr>`; }
}
function filteredLogs() {
    const c = $('log-cat').value, q = $('log-q').value.toLowerCase();
    return logs.filter(l => (!c || l.category === c) && (!q || `${l.userName || ''} ${l.userEmail || ''} ${l.action || ''} ${detailsOf(l)}`.toLowerCase().includes(q)));
}
function renderLogs() {
    const list = filteredLogs();
    $('log-info').innerText = `${list.length} von ${logs.length} geladenen Einträgen`;
    $('logs-body').innerHTML = list.length ? list.map(l => `<tr><td class="nw dim">${esc(logTime(l))}</td>
        <td><span class="chip" style="color:${CAT_COLOR[l.category] || '#94a3b8'}">${esc(l.category || 'info')}</span></td>
        <td>${esc(l.userName || 'Unbekannt')}</td><td class="strong">${esc(l.action || '-')}</td>
        <td class="dim trunc" title="${esc(detailsOf(l))}">${esc(detailsOf(l) || '-')}</td></tr>`).join('')
        : '<tr><td colspan="5" class="empty">Keine Logs gefunden.</td></tr>';
}
function exportLogs() {
    const list = filteredLogs(); if (!list.length) return alert('Keine Logs zum Exportieren.');
    const csv = '\uFEFFZeitpunkt;Kategorie;Benutzer;E-Mail;Ereignis;Details\r\n' + list.map(l => [csvCell(logTime(l)), csvCell(l.category), csvCell(l.userName), csvCell(l.userEmail), csvCell(l.action), csvCell(detailsOf(l))].join(';')).join('\r\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })), download: `Logs_${localDate()}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
}
async function clearLogs(days) {
    if (!(await uiConfirm(days ? `Alle Logs löschen, die älter als ${days} Tage sind?` : 'ALLE Logs unwiderruflich löschen?', { danger: true, ok: 'Löschen' }))) return;
    try {
        let n = 0;
        const base = days ? db.collection('system_logs').where('timestamp', '<', firebase.firestore.Timestamp.fromDate(new Date(Date.now() - days * 864e5))) : db.collection('system_logs');
        for (;;) {
            const snap = await base.limit(400).get(); if (snap.empty) break;
            const b = db.batch(); snap.docs.forEach(d => b.delete(d.ref)); await b.commit(); n += snap.size;
        }
        logSystemEvent('admin', 'System-Logs bereinigt', { geloescht: n, aelterAlsTage: days || 'alle' });
        alert(`${n} Logs gelöscht.`); loadLogs(true); loadToday();
    } catch (err) { alert('Fehler beim Bereinigen: ' + err.message); }
}

// ---------- System ----------
// Dritter Wert true = private Daten, die auch Admins laut Regeln nicht sehen dürfen
const COLS = [['users', 'Benutzer'], ['worktime', 'Arbeitszeiten', true], ['active_work', 'Laufende Stempelungen', true], ['finance_transactions', 'Finanz-Buchungen', true], ['fixed_costs', 'Fixkosten', true],
    ['payslips', 'Lohnabrechnungen', true], ['vault', 'Tresor-Einträge', true], ['documents', 'Dokumente', true], ['events', 'Termine'], ['notes', 'Notizen'], ['todos', 'Aufgaben'], ['system_logs', 'System-Logs'], ['contact_messages', 'Nachrichten']];
async function countDocs(q) {
    try { const n = (await q.count().get()).data().count; reads += Math.max(1, Math.ceil(n / 1000)); return n; }
    catch (e) { try { const s = await q.get(); reads += Math.max(1, s.size); return s.size; } catch (e2) { return null; } }
}
async function loadSystem() {
    sysLoaded = true;
    const counts = await Promise.all(COLS.map(([n, , priv]) => priv ? null : countDocs(db.collection(n))));
    $('col-stats').innerHTML = COLS.map(([, label, priv], i) => `<div class="fc"><span>${label}</span><b>${priv ? '<span class="dim">privat</span>' : counts[i] === null ? '–' : counts[i]}</b></div>`).join('');
    await loadToday();
    const by = {};
    todayLogs.filter(l => l.userEmail && l.userEmail !== 'Gast / Anonym').forEach(l => { const p = by[l.userEmail] = by[l.userEmail] || { name: l.userName, n: 0, ua: new Set(), last: l.timestamp }; p.n++; p.ua.add(l.userAgent); });
    $('people-body').innerHTML = Object.values(by).map(p => `<tr><td class="strong">${esc(p.name)}</td><td>${p.n}</td><td>${p.ua.size}</td><td class="dim">${p.last?.toDate ? p.last.toDate().toLocaleTimeString('de-DE') : '–'}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Heute noch keine Aktivität.</td></tr>';
    $('devices-body').innerHTML = todayLogs.slice(0, 25).map(l => `<tr><td class="nw dim">${l.timestamp?.toDate ? l.timestamp.toDate().toLocaleTimeString('de-DE') : '--'}</td><td class="strong">${esc(l.userName || l.userEmail)}</td>
        <td>${esc(l.action || '-')}</td><td style="color:#22d3ee;font-weight:600">${esc(l.device || '-')}</td><td class="dim trunc" title="${esc(l.userAgent || '')}">${esc((l.userAgent || '').slice(0, 60))}</td></tr>`).join('')
        || '<tr><td colspan="5" class="empty">Heute noch keine Aktivität.</td></tr>';
    $('reads-est').innerText = '≈ ' + reads + ' Lesevorgänge'; $('sys-update').innerText = 'Zuletzt aktualisiert: ' + new Date().toLocaleTimeString('de-DE');
}
