// OS/app-admin.js – Admin als eigene OS-App: Benutzer & Rechte, Einladungscodes, Nachrichten, Wartungsmodus, Protokoll.
// Gleiche Daten und Regeln wie die Dashboard-Seite admin.html.
(function () {
    'use strict';
    const { esc, modal, toast, errMsg } = OAK;
    const ROLES = {
        admin: { label: 'Admin', perms: { termine: true, pinnwand: true, aufgaben: true, zeit: true, finanzen: true, tresor: true, wand: true, spotify: true, webapps: true, dokumente: true, messenger: true, gruppen: true, admin: true } },
        user: { label: 'Mitglied', perms: { termine: true, pinnwand: true, aufgaben: true, zeit: true, finanzen: true, tresor: true, wand: true, spotify: true, webapps: true, dokumente: true, messenger: false, gruppen: false, admin: false } },
        guest: { label: 'Gast', perms: { termine: true, pinnwand: true, aufgaben: true, zeit: false, finanzen: false, tresor: false, wand: false, spotify: false, webapps: false, dokumente: false, messenger: false, gruppen: false, admin: false } } };
    const PERM_GROUPS = [['Startseite', { termine: 'Kalender & Termine', pinnwand: 'Pinnwand', aufgaben: 'Aufgaben & Einkauf' }], ['Bereiche', { zeit: 'Zeiterfassung', finanzen: 'Finanzen', tresor: 'Passwort-Safe', wand: 'Wandkalender', spotify: 'Spotify', webapps: 'Web-Apps', dokumente: 'Dokumente' }], ['Kommunikation', { messenger: 'Messenger', gruppen: 'Gruppen erstellen' }]];
    const OPT_IN = ['messenger', 'gruppen', 'dokumente'], PERM_KEYS = PERM_GROUPS.flatMap(([, m]) => Object.keys(m)), PERM_LABEL = Object.assign({}, ...PERM_GROUPS.map(([, m]) => m));
    const BADGE = { active: ['Aktiv', '#4ade80'], pending: ['Wartet auf Freigabe', '#fbbf24'], blocked: ['Gesperrt', '#f87171'] };
    const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), x => CODE_CHARS[x % 32]).join(''), showCode = c => c.replace(/(.{5})(?=.)/g, '$1-');
    const fmtDate = t => t && t.toDate ? t.toDate().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–';
    const st = u => u.status || 'active';
    let U = null, API = null;

    function ui(body, win) {
        if (!(typeof isAdmin === 'function' && isAdmin(U))) { body.innerHTML = '<div class="oa"><p class="oa-empty"><i class="fa-solid fa-lock"></i>Nur für Admins.</p></div>'; return; }
        let users = [], invites = [], messages = [], logs = [], logCursor = null, maint = window.MAINT || { pages: {} }, tab = 'users', fText = '', fStatus = 'all', logCat = '', logQ = '', openU = null;
        body.innerHTML = `<div class="oa oa-adm" style="--m:#c084fc;--mr:192,132,252"><div class="oa-h"><span class="oa-ico"><i class="fa-solid fa-user-shield"></i></span><h2>Admin</h2>
            <div class="oa-tabs">${[['users', 'Benutzer'], ['inv', 'Einladungen'], ['msg', 'Nachrichten'], ['maint', 'Wartung'], ['logs', 'Protokoll']].map(([k, t]) => `<button type="button" data-tab="${k}">${t}<em class="ad-bd" data-bd="${k}"></em></button>`).join('')}</div><span class="oa-sp"></span></div><div class="oa-b ad-b"></div></div>`;
        const $ = s => body.querySelector(s), root = $('.oa'), main = $('.ad-b');
        const log = (a, d) => { if (typeof logSystemEvent === 'function') logSystemEvent('admin', a, d || {}); };
        const activeAdmins = () => users.filter(u => isAdmin(u) && st(u) === 'active'), isSelf = u => u.id === U.uid;
        const lastAdmin = (u, what) => { if (isAdmin(u) && st(u) === 'active' && activeAdmins().length <= 1) { toast(root, `Der letzte aktive Admin kann nicht ${what} werden.`, true); return true; } return false; };
        async function update(u, data, msg) {
            try { await db.collection('users').doc(u.id).update(data); log(msg, { ziel: u.email }); const p = data.permissions;
                if (data['permissions.messenger'] === false || (p && p.messenger !== true) || (data.status && data.status !== 'active')) db.collection('directory').doc(u.id).delete().catch(() => {}); }
            catch (x) { toast(root, 'Fehlgeschlagen: ' + errMsg(x), true); render(); }
        }
        function badges() { const pend = users.filter(u => st(u) === 'pending').length, unread = messages.filter(m => !m.read).length, mt = (typeof MAINT_PAGES !== 'undefined' ? MAINT_PAGES : []).filter(p => maintOn(p.key, maint)).length;
            const set = (k, n) => { const el = body.querySelector(`[data-bd="${k}"]`); if (el) { el.textContent = n || ''; el.hidden = !n; } }; set('users', pend); set('msg', unread); set('maint', mt); }
        function render() { body.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); badges(); ({ users: usersView, inv: invView, msg: msgView, maint: maintView, logs: logView }[tab])(); }
        function usersView() {
            const pend = users.filter(u => st(u) === 'pending').length, act = users.filter(u => st(u) === 'active').length;
            const rows = users.filter(u => (fStatus === 'all' || st(u) === fStatus) && (!fText || `${u.displayName || ''} ${u.firstName || ''} ${u.lastName || ''} ${u.email}`.toLowerCase().includes(fText))).sort((a, b) => (st(b) === 'pending') - (st(a) === 'pending') || (a.displayName || a.email).localeCompare(b.displayName || b.email, 'de'));
            main.innerHTML = `<div class="fi-tools"><input class="oa-in ad-q" type="search" placeholder="Name oder E-Mail" value="${esc(fText)}" style="width:240px"><div class="oa-chips">${[['all', 'Alle'], ['pending', 'Wartend'], ['active', 'Aktiv'], ['blocked', 'Gesperrt']].map(([k, t]) => `<button type="button" class="oa-chip${fStatus === k ? ' on' : ''}" data-fs="${k}">${t}</button>`).join('')}</div><span class="oa-sp"></span><span class="oa-note">${act} aktiv / ${users.length}</span>${pend ? `<button type="button" class="btn pri" data-k="approveall"><i class="fa-solid fa-user-check"></i>Alle ${pend} freigeben</button>` : ''}</div>
                <div class="ad-users">${rows.map(u => { const s = st(u), [bl, bc] = BADGE[s] || BADGE.active, nm = u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email, on = openU === u.id;
                    return `<div class="oa-card ad-u${s === 'pending' ? ' pend' : ''}" data-uid="${esc(u.id)}"><div class="ad-uh" data-k="toggleu"><span class="mx-av" style="background:${avatarGradient(u.avatarColor)}">${esc(initialsOf(nm))}</span><span class="ad-un"><b>${esc(nm)}${isSelf(u) ? ' <span class="oa-tag">du</span>' : ''}</b><small>${esc(u.email)} · Letzter Login ${fmtDate(u.lastLogin)}</small></span>
                        <span class="oa-tag" style="color:${bc};background:color-mix(in srgb, ${bc} 15%, transparent)">${bl}</span><select class="oa-in ad-role" data-role${isSelf(u) ? ' disabled' : ''}>${Object.entries(ROLES).map(([k, r]) => `<option value="${k}"${(u.role || 'user') === k ? ' selected' : ''}>${r.label}</option>`).join('')}</select><i class="fa-solid fa-chevron-${on ? 'up' : 'down'} oa-mut"></i></div>
                        ${on || s === 'pending' ? `<div class="ad-perms">${PERM_GROUPS.map(([g, m]) => `<div class="ad-pg"><small>${g}</small><div class="oa-chips">${Object.entries(m).map(([k, l]) => { const admin = isAdmin(u), auto = admin && k === 'dokumente', lock = auto || ((admin || isSelf(u)) && !OPT_IN.includes(k)), val = auto ? true : OPT_IN.includes(k) ? (u.permissions || {})[k] === true : (admin || (u.permissions || {})[k] !== false);
                            return `<label class="oa-chip${val ? ' on' : ''}${lock ? ' lock' : ''}"><input type="checkbox" data-perm="${k}"${val ? ' checked' : ''}${lock ? ' disabled' : ''} hidden>${val ? '<i class="fa-solid fa-check"></i> ' : ''}${l}</label>`; }).join('')}</div></div>`).join('')}
                            <div class="oa-acts" style="justify-content:flex-start">${!isAdmin(u) && !isSelf(u) ? '<button type="button" class="btn" data-ua="all">Alle Rechte</button><button type="button" class="btn" data-ua="none">Keine</button>' : ''}${s !== 'active' ? '<button type="button" class="btn pri" data-ua="approve"><i class="fa-solid fa-user-check"></i>Freigeben</button>' : ''}${s === 'active' && !isSelf(u) ? '<button type="button" class="btn" data-ua="block"><i class="fa-solid fa-ban"></i>Sperren</button>' : ''}${!isSelf(u) ? '<button type="button" class="btn" data-ua="reset"><i class="fa-solid fa-key"></i>Passwort-Reset</button><button type="button" class="btn bad" data-ua="delete">Profil löschen</button>' : ''}</div></div>` : ''}</div>`; }).join('') || '<p class="oa-empty">Keine Benutzer gefunden.</p>'}</div>`;
            const q = $('.ad-q'); q.addEventListener('input', () => { fText = q.value.trim().toLowerCase(); const p = q.selectionStart; usersView(); const n = $('.ad-q'); n.focus(); n.setSelectionRange(p, p); });
        }
        function invView() {
            const now = Date.now();
            main.innerHTML = `<div class="oa-card"><h3><i class="fa-solid fa-ticket"></i>Neuen Einladungscode erzeugen</h3><div class="fi-tools"><input class="oa-in ad-inote" maxlength="60" placeholder="Für wen? (optional)" style="flex:1;min-width:180px"><select class="oa-in ad-iexp"><option value="7">7 Tage gültig</option><option value="30">30 Tage gültig</option><option value="0">unbegrenzt</option></select><button type="button" class="btn pri" data-k="newinv"><i class="fa-solid fa-plus"></i>Erzeugen</button></div></div>
                <div class="oa-card">${invites.map(i => { const exp = i.expiresAt && i.expiresAt.toDate ? i.expiresAt.toDate() : null, expired = !i.used && exp && exp.getTime() < now, who = i.used ? users.find(u => u.id === i.usedBy) : null, open = !i.used && !expired;
                    return `<div class="oa-row${open ? '' : ' oa-mut'}"><code class="ad-code">${esc(showCode(i.id))}</code><span>${i.note ? '<b>' + esc(i.note) + '</b>' : ''}<small>${i.used ? `eingelöst von ${esc(who ? who.displayName || who.email : 'unbekannt')} am ${fmtDate(i.usedAt)}` : expired ? 'abgelaufen' : exp ? 'gültig bis ' + exp.toLocaleDateString('de-DE') : 'unbegrenzt gültig'}</small></span>
                        ${open ? `<button type="button" class="btn" data-ic="${esc(i.id)}">Code kopieren</button><button type="button" class="btn" data-il="${esc(i.id)}"><i class="fa-solid fa-link"></i>Link</button>` : ''}<button type="button" class="mx-ib" data-idel="${esc(i.id)}" aria-label="Löschen"><i class="fa-solid fa-trash-can"></i></button></div>`; }).join('') || '<p class="oa-empty">Noch keine Einladungen.</p>'}</div>`;
        }
        function msgView() {
            const unread = messages.filter(m => !m.read).length;
            main.innerHTML = `<div class="fi-tools"><span class="oa-note">${messages.length} Nachrichten · ${unread} ungelesen</span><span class="oa-sp"></span>${unread ? '<button type="button" class="btn" data-k="readall">Alle gelesen</button>' : ''}</div>
                ${messages.map(m => `<div class="oa-card ad-msg${m.read ? '' : ' new'}"><div class="oa-row" style="padding:0"><span><b>${esc(m.name)}</b>${m.read ? '' : ' <span class="oa-tag">neu</span>'}<small>${m.email ? esc(m.email) : 'keine E-Mail'} · ${fmtDate(m.createdAt)}</small></span>${m.email ? `<a class="btn" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Antwort auf deine Nachricht')}"><i class="fa-solid fa-reply"></i>Antworten</a>` : ''}<button type="button" class="btn" data-mr="${esc(m.id)}">${m.read ? 'Ungelesen' : 'Gelesen'}</button><button type="button" class="mx-ib" data-mdel="${esc(m.id)}" aria-label="Löschen"><i class="fa-solid fa-trash-can"></i></button></div><p>${esc(m.message)}</p></div>`).join('') || '<p class="oa-empty"><i class="fa-solid fa-envelope-open"></i>Noch keine Nachrichten.</p>'}`;
        }
        function maintView() {
            const P = window.MAINT_PAGES || [], sys = maintOn('/', maint);
            const row = (p, s) => `<label class="oa-row ad-mt" style="--c:${p.c}"><span class="fi-ci" style="--c:${p.c}"><i class="fa-solid ${p.icon}"></i></span><span><b>${esc(p.label)}</b><small>${maintOn(p.key, maint) ? 'In Wartung' : s ? 'Nur Admins kommen rein, alle anderen sind ausgesperrt' : 'Läuft normal'}</small></span><input type="checkbox" class="tgl" data-mt="${esc(p.key)}"${maintOn(p.key, maint) ? ' checked' : ''}></label>`;
            main.innerHTML = `<div class="fi-two"><div><div class="oa-card">${P[0] ? row(P[0], true) : ''}</div><div class="oa-card" style="${sys ? 'opacity:.5' : ''}"><h3><i class="fa-solid fa-screwdriver-wrench"></i>Einzelne Seiten</h3>${P.slice(1).map(p => row(p)).join('')}</div></div>
                <div class="oa-card"><h3><i class="fa-solid fa-message"></i>Hinweistext</h3><label class="oa-f">Text auf der Wartungsseite<textarea class="oa-in ad-mmsg" rows="3" maxlength="300" placeholder="${esc(typeof MAINT_DEFAULT_MSG === 'string' ? MAINT_DEFAULT_MSG : '')}">${esc(maint.msg || '')}</textarea></label><label class="oa-f" style="margin-top:10px">Voraussichtlich bis<input class="oa-in ad-muntil" type="datetime-local" value="${esc(maint.until || '')}"></label>
                    <div class="oa-acts"><button type="button" class="btn" data-k="mtoff"><i class="fa-solid fa-power-off"></i>Alle Wartungen beenden</button><button type="button" class="btn pri" data-k="mtsave"><i class="fa-solid fa-check"></i>Text speichern</button></div></div></div>`;
        }
        const detailsOf = l => [l.device, l.details && Object.keys(l.details).length ? JSON.stringify(l.details) : ''].filter(Boolean).join(' · ');
        function logView() {
            const list = logs.filter(l => (!logCat || l.category === logCat) && (!logQ || `${l.userName || ''} ${l.userEmail || ''} ${l.action || ''} ${detailsOf(l)}`.toLowerCase().includes(logQ)));
            main.innerHTML = `<div class="fi-tools"><select class="oa-in ad-lc"><option value="">Alle Bereiche</option>${['auth', 'data', 'admin', 'error', 'system'].map(c => `<option${logCat === c ? ' selected' : ''}>${c}</option>`).join('')}</select><input class="oa-in ad-lq" type="search" placeholder="Suchen" value="${esc(logQ)}" style="width:220px"><span class="oa-sp"></span><span class="oa-note">${list.length} von ${logs.length} geladen</span><button type="button" class="btn" data-k="logreload"><i class="fa-solid fa-rotate"></i>Neu laden</button></div>
                <div class="oa-card" style="padding:0;overflow:auto"><table class="oa-tbl"><thead><tr><th>Zeit</th><th>Bereich</th><th>Wer</th><th>Aktion</th><th>Details</th></tr></thead><tbody>${list.map(l => `<tr><td class="oa-mut" style="white-space:nowrap">${l.timestamp && l.timestamp.toDate ? l.timestamp.toDate().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–'}</td><td><span class="oa-tag">${esc(l.category || '')}</span></td><td>${esc(l.userName || l.userEmail || '–')}</td><td>${esc(l.action || '')}</td><td class="oa-mut ad-det">${esc(detailsOf(l))}</td></tr>`).join('') || '<tr><td colspan="5"><p class="oa-empty">Keine Einträge.</p></td></tr>'}</tbody></table></div>
                ${logCursor ? '<div class="oa-acts" style="justify-content:center"><button type="button" class="btn" data-k="logmore">Ältere laden</button></div>' : ''}`;
            $('.ad-lc').addEventListener('change', e => { logCat = e.target.value; logView(); }); const q = $('.ad-lq'); q.addEventListener('input', () => { logQ = q.value.trim().toLowerCase(); const p = q.selectionStart; logView(); const n = $('.ad-lq'); n.focus(); n.setSelectionRange(p, p); });
        }
        async function loadLogs(reset) { try { let q = db.collection('system_logs').orderBy('timestamp', 'desc'); if (!reset && logCursor) q = q.startAfter(logCursor); const s = await q.limit(100).get(); const rows = s.docs.map(d => ({ id: d.id, ...d.data() })); logs = reset ? rows : logs.concat(rows); logCursor = s.size >= 100 ? s.docs[s.docs.length - 1] : null; if (tab === 'logs') logView(); } catch (x) { toast(root, 'Protokoll: ' + errMsg(x), true); } }
        const copy = t => navigator.clipboard.writeText(t).then(() => toast(root, 'Kopiert')).catch(() => toast(root, 'Kopieren nicht möglich', true));
        body.addEventListener('click', async e => {
            const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; if (tab === 'logs' && !logs.length) loadLogs(true); return render(); }
            const fs = e.target.closest('[data-fs]'); if (fs) { fStatus = fs.dataset.fs; return usersView(); }
            const card = e.target.closest('[data-uid]'), u = card && users.find(x => x.id === card.dataset.uid);
            const ua = e.target.closest('[data-ua]'); if (ua && u) { const a = ua.dataset.ua;
                if (a === 'all' || a === 'none') { const p = {}; PERM_KEYS.forEach(k => { p[k] = a === 'all'; }); p.admin = false; return update(u, { permissions: p }, a === 'all' ? 'Alle Rechte erteilt' : 'Alle Rechte entzogen'); }
                if (a === 'approve') return update(u, { status: 'active' }, 'Benutzer freigegeben / entsperrt');
                if (a === 'block') { if (lastAdmin(u, 'gesperrt')) return; if (await uiConfirm(`${u.email} sperren? Der Zugriff ist sofort beendet.`, { danger: true, ok: 'Sperren' })) update(u, { status: 'blocked' }, 'Benutzer gesperrt'); return; }
                if (a === 'reset') { if (await uiConfirm(`E-Mail zum Zurücksetzen des Passworts an ${u.email} senden?`)) try { await auth.sendPasswordResetEmail(u.email); log('Passwort-Reset gesendet', { ziel: u.email }); toast(root, 'E-Mail wurde versendet'); } catch (x) { toast(root, errMsg(x), true); } return; }
                if (a === 'delete') { if (lastAdmin(u, 'gelöscht')) return; if (await uiConfirm(`Profil von ${u.email} löschen? Das Login-Konto bleibt in Firebase Authentication bestehen.`, { danger: true, ok: 'Löschen' })) try { await db.collection('users').doc(u.id).delete(); log('Benutzerprofil gelöscht', { ziel: u.email }); } catch (x) { toast(root, errMsg(x), true); } return; } }
            if (e.target.closest('[data-k="toggleu"]') && u && !e.target.closest('select')) { openU = openU === u.id ? null : u.id; return usersView(); }
            const ic = e.target.closest('[data-ic]'); if (ic) return copy(showCode(ic.dataset.ic)); const il = e.target.closest('[data-il]'); if (il) return copy(`${location.origin}/?code=${il.dataset.il}`);
            const idl = e.target.closest('[data-idel]'); if (idl) { if (await uiConfirm('Diesen Code löschen?', { danger: true, ok: 'Löschen' })) db.collection('invites').doc(idl.dataset.idel).delete().then(() => log('Einladung gelöscht')).catch(x => toast(root, errMsg(x), true)); return; }
            const mr = e.target.closest('[data-mr]'); if (mr) { const m = messages.find(x => x.id === mr.dataset.mr); db.collection('contact_messages').doc(m.id).update({ read: !m.read }).catch(x => toast(root, errMsg(x), true)); return; }
            const md = e.target.closest('[data-mdel]'); if (md) { if (await uiConfirm('Nachricht endgültig löschen?', { danger: true, ok: 'Löschen' })) db.collection('contact_messages').doc(md.dataset.mdel).delete().catch(x => toast(root, errMsg(x), true)); return; }
            const k = e.target.closest('[data-k]'); if (!k) return;
            const meta = () => ({ updatedBy: U.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            ({ approveall: async () => { const l = users.filter(x => st(x) === 'pending'); if (!l.length || !(await uiConfirm(`${l.length} wartende Konten freigeben?`))) return; try { const b = db.batch(); l.forEach(x => b.update(db.collection('users').doc(x.id), { status: 'active' })); await b.commit(); log('Mehrere Benutzer freigegeben', { anzahl: l.length }); } catch (x) { toast(root, errMsg(x), true); } },
                newinv: async () => { const days = +$('.ad-iexp').value, note = $('.ad-inote').value.trim().slice(0, 60), code = newCode(), d = { createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: U.email, note, used: false }; if (days > 0) d.expiresAt = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + days * 864e5));
                    try { await db.collection('invites').doc(code).set(d); log('Einladung erzeugt', { code: code.slice(0, 4) + '…' }); copy(showCode(code)); } catch (x) { toast(root, errMsg(x), true); } },
                readall: async () => { const l = messages.filter(m => !m.read); try { const b = db.batch(); l.forEach(m => b.update(db.collection('contact_messages').doc(m.id), { read: true })); await b.commit(); } catch (x) { toast(root, errMsg(x), true); } },
                mtoff: async () => { if (!(await uiConfirm('Alle Wartungen beenden?'))) return; try { await maintRef().set({ pages: {}, msg: maint.msg || '', until: maint.until || '', ...meta() }); log('Alle Wartungen beendet'); } catch (x) { toast(root, errMsg(x), true); } },
                mtsave: async () => { try { await maintRef().set({ msg: $('.ad-mmsg').value.trim().slice(0, 300), until: $('.ad-muntil').value || '', ...meta() }, { merge: true }); toast(root, 'Gespeichert'); } catch (x) { toast(root, errMsg(x), true); } },
                logreload: () => loadLogs(true), logmore: () => loadLogs(false) }[k.dataset.k] || (() => {}))();
        });
        body.addEventListener('change', async e => {
            const card = e.target.closest('[data-uid]'), u = card && users.find(x => x.id === card.dataset.uid);
            if (e.target.matches('[data-role]') && u) { const role = e.target.value; if (role !== 'admin' && lastAdmin(u, 'herabgestuft')) return render();
                if (!(await uiConfirm(role === 'admin' ? `${u.email} zum ADMIN machen? Admins haben Zugriff auf alle Bereiche.` : `Rolle von ${u.email} auf „${ROLES[role].label}“ setzen? Die Einzelrechte werden zurückgesetzt.`))) return render();
                return update(u, { role, permissions: ROLES[role].perms }, `Rolle auf „${ROLES[role].label}“ gesetzt`); }
            if (e.target.matches('[data-perm]') && u) { const k = e.target.dataset.perm; if (isSelf(u) && !OPT_IN.includes(k)) return render(); return update(u, { [`permissions.${k}`]: e.target.checked }, `Recht „${PERM_LABEL[k] || k}“ ${e.target.checked ? 'erteilt' : 'entzogen'}`); }
            if (e.target.matches('[data-mt]')) { const key = e.target.dataset.mt, on = e.target.checked;
                if (key === '/' && on && !(await uiConfirm('Ganzes System in Wartung setzen? Alle außer Admins werden sofort ausgesperrt.', { danger: true, ok: 'Sperren' }))) { e.target.checked = false; return; }
                try { await maintRef().set({ pages: { [key]: on }, updatedBy: U.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); log(on ? 'Wartung eingeschaltet' : 'Wartung beendet', { seite: key }); } catch (x) { e.target.checked = !on; toast(root, errMsg(x), true); } }
        });
        const offs = [db.collection('users').onSnapshot(s => { users = s.docs.map(d => ({ id: d.id, ...d.data() })); if (tab === 'users' || tab === 'inv') render(); else badges(); }, x => toast(root, errMsg(x), true)),
            db.collection('invites').orderBy('createdAt', 'desc').limit(60).onSnapshot(s => { invites = s.docs.map(d => ({ id: d.id, ...d.data() })); if (tab === 'inv') render(); }, () => {}),
            db.collection('contact_messages').orderBy('createdAt', 'desc').limit(100).onSnapshot(s => { messages = s.docs.map(d => ({ id: d.id, ...d.data() })); if (tab === 'msg') render(); else badges(); }, () => {}),
            maintRef().onSnapshot(d => { maint = d.exists ? d.data() : { pages: {} }; maint.pages = maint.pages || {}; if (tab === 'maint') render(); else badges(); }, () => {})];
        win.onClose = () => offs.forEach(f => f());
        render();
    }
    JMOS_LAZY.register('admin', { ui, init(api, user) { API = api; U = user; } });
})();
