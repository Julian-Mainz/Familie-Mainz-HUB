// OS/app-kalender.js – Kalender als eigene OS-App: Monat, Woche, Liste; Termine anlegen, Serien, Einladungen, gemeinsame Kalender.
// Gleiche Daten wie im Dashboard (events, calendars) und gleiche Regeln über js/calendar-core.js (CAL).
(function () {
    'use strict';
    const { esc, modal, toast, iso, errMsg } = OAK;
    const TS = () => firebase.firestore.FieldValue.serverTimestamp();
    const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const WDL = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const pD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const kw = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); };
    const monday = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
    const autoColor = t => { let h = 0; for (const c of String(t || '')) h = (h * 31 + c.charCodeAt(0)) | 0; return CAL.COLORS[Math.abs(h) % (CAL.COLORS.length - 1)][0]; };
    let U = null, API = null;

    function ui(body, win) {
        if (!can(U, 'termine')) { body.innerHTML = '<div class="oa"><p class="oa-empty"><i class="fa-solid fa-lock"></i>Für den Kalender brauchst du die Berechtigung „Termine“.</p></div>'; return; }
        const prefs = CAL.prefs(U), S = API.state(); S.calHide = S.calHide || [];
        let events = [], allEv = [], cals = [], dir = {}, view = S.calView || 'month', cur = new Date(), sel = iso(new Date()), q = '';
        body.innerHTML = `<div class="oa oa-cal" style="--m:#22d3ee;--mr:34,211,238">
            <div class="oa-h"><button type="button" class="btn pri" data-k="new"><i class="fa-solid fa-plus"></i>Termin</button>
                <button type="button" class="btn" data-k="today">Heute</button><button type="button" class="mx-ib" data-k="prev" aria-label="Zurück"><i class="fa-solid fa-chevron-left"></i></button><button type="button" class="mx-ib" data-k="next" aria-label="Weiter"><i class="fa-solid fa-chevron-right"></i></button>
                <h2 class="kc-title"></h2><span class="oa-sp"></span><input class="oa-in" type="search" placeholder="Termine suchen" aria-label="Termine suchen" style="width:190px">
                <div class="oa-tabs">${[['month', 'Monat'], ['week', 'Woche'], ['list', 'Liste']].map(([k, t]) => `<button type="button" data-v="${k}">${t}</button>`).join('')}</div></div>
            <div class="oa-cols"><aside class="kc-side"></aside><div class="kc-main"></div></div></div>`;
        const $ = s => body.querySelector(s), root = body.querySelector('.oa');
        const visibleEv = () => events.filter(ev => !(ev.calendarId && S.calHide.includes(ev.calendarId)) && !(S.calHide.includes('_pub') && CAL.shareOf(ev) === 'public' && ev.owner !== U.email) && (!q || [ev.title, ev.location, ev.notes].join(' ').toLowerCase().includes(q)));
        const colorOf = o => CAL.colorOf(o) || (o.ev && o.ev.calendarId && (cals.find(c => c.id === o.ev.calendarId) || {}).color) || autoColor(o.title);
        const nameOf = uid => (dir[uid] && dir[uid].name) || 'Mitglied';
        const range = () => {
            if (view === 'month') { const f = monday(new Date(cur.getFullYear(), cur.getMonth(), 1)); const t = new Date(f); t.setDate(t.getDate() + 41); return [iso(f), iso(t)]; }
            if (view === 'week') { const f = monday(cur), t = new Date(f); t.setDate(t.getDate() + 6); return [iso(f), iso(t)]; }
            const f = new Date(cur); const t = new Date(f); t.setDate(t.getDate() + 90); return [iso(f), iso(t)];
        };
        const evHtml = o => `<button type="button" class="kc-ev${o.time ? '' : ' all'}${CAL.isInvite(o.ev, U) && !CAL.rsvpOf(o.ev, U.uid) ? ' inv' : ''}" data-ev="${esc(o.id)}" data-occ="${o.date}" style="--c:${colorOf(o)}" title="${esc(o.title)}${o.time ? ' · ' + esc(CAL.timeLabel(o)) : ''}">${o.time ? `<b>${esc(o.time)}</b>` : ''}${esc(o.title)}${o.recurring ? ' <i class="fa-solid fa-repeat"></i>' : ''}</button>`;
        function render() {
            body.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === view));
            const [from, to] = range(), occ = CAL.expand(visibleEv(), from, to), spec = CAL.specialDays(from, to, prefs), today = iso(new Date());
            const byDay = {}; occ.forEach(o => (byDay[o.date] = byDay[o.date] || []).push(o)); const sp = {}; spec.forEach(s => (sp[s.date] = sp[s.date] || []).push(s));
            const main = $('.kc-main');
            if (view === 'month') {
                $('.kc-title').textContent = `${MON[cur.getMonth()]} ${cur.getFullYear()}`;
                let h = `<div class="kc-mh">${WDL.map(d => `<span>${d}</span>`).join('')}</div><div class="kc-month">`; const f = pD(from);
                for (let i = 0; i < 42; i++) { const d = new Date(f); d.setDate(f.getDate() + i); const s = iso(d), list = byDay[s] || [], other = d.getMonth() !== cur.getMonth();
                    h += `<div class="kc-day${other ? ' other' : ''}${s === today ? ' today' : ''}${s === sel ? ' sel' : ''}${(sp[s] || []).some(x => x.kind === 'hol') ? ' hol' : ''}" data-day="${s}"><div class="kc-dn">${i % 7 === 0 ? `<em>KW ${kw(d)}</em>` : ''}<span>${d.getDate()}</span></div>
                        ${(sp[s] || []).slice(0, 1).map(x => `<div class="kc-sp ${x.kind}">${esc(x.title)}</div>`).join('')}${list.slice(0, 4).map(evHtml).join('')}${list.length > 4 ? `<button type="button" class="kc-more" data-day="${s}">+${list.length - 4} weitere</button>` : ''}</div>`; }
                main.innerHTML = h + '</div>';
            } else if (view === 'week') {
                const f = pD(from); $('.kc-title').textContent = `KW ${kw(f)} · ${f.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${pD(to).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                let h = '<div class="kc-week">';
                for (let i = 0; i < 7; i++) { const d = new Date(f); d.setDate(f.getDate() + i); const s = iso(d), list = byDay[s] || [];
                    h += `<div class="kc-wd${s === today ? ' today' : ''}" data-day="${s}"><div class="kc-wh"><span>${WDL[i]}</span><b>${d.getDate()}</b></div>${(sp[s] || []).map(x => `<div class="kc-sp ${x.kind}">${esc(x.title)}</div>`).join('')}
                        ${list.map(o => `<button type="button" class="kc-wev" data-ev="${esc(o.id)}" data-occ="${o.date}" style="--c:${colorOf(o)}"><small>${o.time ? esc(CAL.timeLabel(o)) : 'ganztägig'}</small><b>${esc(o.title)}</b>${o.ev.location ? `<small><i class="fa-solid fa-location-dot"></i> ${esc(o.ev.location)}</small>` : ''}</button>`).join('') || '<p class="kc-free">frei</p>'}</div>`; }
                main.innerHTML = h + '</div>';
            } else {
                $('.kc-title').textContent = 'Nächste 90 Tage';
                const days = [...new Set([...Object.keys(byDay), ...Object.keys(sp)])].sort();
                main.innerHTML = `<div class="oa-b">${days.map(s => `<div class="kc-ld"><div class="kc-ldh${s === today ? ' today' : ''}">${pD(s).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}${(sp[s] || []).map(x => ` <span class="kc-sp ${x.kind}">${esc(x.title)}</span>`).join('')}</div>
                    ${(byDay[s] || []).map(o => `<button type="button" class="oa-row kc-lr" data-ev="${esc(o.id)}" data-occ="${o.date}"><i class="kc-dot" style="background:${colorOf(o)}"></i><b class="kc-lt">${o.time ? esc(CAL.timeLabel(o)) : 'ganztägig'}</b><span>${esc(o.title)}<small>${[o.ev.location, o.recurring ? CAL.repeatLabel(o.ev) : '', CAL.shareOf(o.ev) === 'private' ? 'privat' : ''].filter(Boolean).map(esc).join(' · ')}</small></span></button>`).join('')}</div>`).join('') || '<p class="oa-empty"><i class="fa-regular fa-calendar"></i>Keine Termine.</p>'}</div>`;
            }
            side(occ);
        }
        function side() {
            const t = iso(new Date()), next = CAL.nextOccurrences(visibleEv(), t, 6, 60), inv = allEv.filter(ev => CAL.isInvite(ev, U) && !CAL.rsvpOf(ev, U.uid));
            const sd = pD(sel), selList = CAL.expand(visibleEv(), sel, sel);
            $('.kc-side').innerHTML = `${inv.length ? `<div class="oa-card kc-inv"><h3><i class="fa-solid fa-envelope-open-text"></i>${inv.length === 1 ? 'Neue Einladung' : inv.length + ' Einladungen'}</h3>${inv.slice(0, 4).map(ev => `<button type="button" class="oa-row" data-ev="${esc(ev.id)}" data-occ="${ev.date}"><span>${esc(ev.title)}<small>${CAL.germanDate(ev.date)} · von ${esc(ev.ownerName || 'Mitglied')}</small></span></button>`).join('')}</div>` : ''}
                <div class="oa-card"><h3><i class="fa-regular fa-calendar"></i>${sd.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>${selList.map(o => `<button type="button" class="oa-row" data-ev="${esc(o.id)}" data-occ="${o.date}"><i class="kc-dot" style="background:${colorOf(o)}"></i><span>${esc(o.title)}<small>${o.time ? esc(CAL.timeLabel(o)) : 'ganztägig'}</small></span></button>`).join('') || '<p class="oa-note">Nichts geplant. Doppelklick auf einen Tag legt einen Termin an.</p>'}</div>
                <div class="oa-card"><h3><i class="fa-solid fa-forward"></i>Demnächst</h3>${next.map(o => `<button type="button" class="oa-row" data-ev="${esc(o.id)}" data-occ="${o.date}"><i class="kc-dot" style="background:${colorOf(o)}"></i><span>${esc(o.title)}<small>${CAL.germanDate(o.date).slice(0, 6)} ${o.time ? '· ' + esc(o.time) : ''}</small></span></button>`).join('') || '<p class="oa-note">Keine Termine in den nächsten 60 Tagen.</p>'}</div>
                <div class="oa-card"><h3><i class="fa-solid fa-layer-group"></i>Kalender</h3>
                    <label class="kc-cl"><input type="checkbox" data-hide="_pub"${S.calHide.includes('_pub') ? '' : ' checked'}><i class="kc-dot" style="background:#94a3b8"></i><span>Öffentliche Termine</span></label>
                    ${cals.map(c => `<label class="kc-cl"><input type="checkbox" data-hide="${esc(c.id)}"${S.calHide.includes(c.id) ? '' : ' checked'}><i class="kc-dot" style="background:${esc(CAL.colorOf({ color: c.color }) || '#22d3ee')}"></i><span>${esc(c.name)}</span><button type="button" class="mx-ib" data-cal="${esc(c.id)}" aria-label="Kalender bearbeiten"><i class="fa-solid fa-ellipsis"></i></button></label>`).join('')}
                    <button type="button" class="btn kc-newcal" data-k="newcal"><i class="fa-solid fa-plus"></i>Gemeinsamer Kalender</button></div>`;
        }

        // ---------- Termin anlegen / bearbeiten ----------
        async function people() { if (Object.keys(dir).length) return dir; try { const s = await db.collection('directory').get(); s.docs.forEach(d => { dir[d.id] = { uid: d.id, name: d.data().name || 'Mitglied' }; }); } catch (x) {} return dir; }
        async function editor(id, occ, date, time) {
            const ev = id ? allEv.find(x => x.id === id) : null; if (id && !ev) return;
            const mine = !ev || ev.owner === U.email, rec = ev && CAL.isRecurring(ev), f = ev || { title: '', date: date || sel, time: time || '', endTime: '', repeat: 'none', interval: 1, until: '', days: [], location: '', notes: '', remind: null, share: 'private', members: [], calendarId: '', color: '' };
            await people(); const sh = CAL.shareOf(f), ppl = Object.values(dir).filter(p => p.uid !== U.uid).sort((a, b) => a.name.localeCompare(b.name, 'de'));
            const ro = mine ? '' : ' disabled', inv = ev && CAL.isInvite(ev, U), rsvp = ev ? CAL.rsvpOf(ev, U.uid) : '';
            const m = modal(root, `<form class="kc-form"><h3><i class="fa-solid fa-calendar-plus"></i>${!ev ? 'Neuer Termin' : mine ? 'Termin bearbeiten' : esc(ev.title)}</h3>
                ${inv ? `<div class="kc-rsvp"><span>${rsvp === 'yes' ? 'Du hast zugesagt.' : rsvp === 'no' ? 'Du hast abgesagt.' : `<b>${esc(ev.ownerName || 'Jemand')}</b> lädt dich ein.`}</span><button type="button" class="btn${rsvp === 'yes' ? ' pri' : ''}" data-r="yes"><i class="fa-solid fa-check"></i>Zusagen</button><button type="button" class="btn" data-r="no"><i class="fa-solid fa-xmark"></i>Absagen</button></div>` : ''}
                ${!mine && !inv ? `<p class="oa-note">Von ${esc(ev.ownerName || ev.owner)} – nur ansehen.</p>` : ''}
                ${rec && mine ? `<div class="oa-tabs kc-scope"><button type="button" class="on" data-scope="all">Ganze Serie</button><button type="button" data-scope="one">Nur diesen Termin (${CAL.germanDate(occ)})</button></div>` : ''}
                <div class="oa-form"><label class="oa-f w">Titel<input class="oa-in" name="title" maxlength="120" value="${esc(f.title)}" required${ro}></label>
                <label class="oa-f">Datum<input class="oa-in" type="date" name="date" value="${esc(f.date)}"${ro}></label>
                <label class="oa-f kc-allday"><span><input type="checkbox" name="allday"${f.time ? '' : ' checked'}${ro}> Ganztägig</span></label>
                <label class="oa-f kc-t">Beginn<input class="oa-in" type="time" name="time" value="${esc(f.time || '')}"${ro}></label><label class="oa-f kc-t">Ende<input class="oa-in" type="time" name="endTime" value="${esc(f.endTime || '')}"${ro}></label>
                <div class="kc-rep w oa-form"><label class="oa-f">Wiederholung<select class="oa-in" name="repeat"${ro}>${Object.entries(CAL.REPEATS).map(([k, t]) => `<option value="${k}"${(f.repeat || 'none') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
                    <label class="oa-f kc-iv">Alle … (Intervall)<input class="oa-in" type="number" min="1" max="99" name="interval" value="${f.interval || 1}"${ro}></label>
                    <div class="oa-f w kc-days">Wochentage<div class="oa-chips">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="oa-chip"><input type="checkbox" name="days" value="${d}"${(f.days || []).includes(d) ? ' checked' : ''}${ro} hidden>${CAL.WD[d]}</label>`).join('')}</div></div>
                    <label class="oa-f kc-un">Endet am (optional)<input class="oa-in" type="date" name="until" value="${esc(f.until || '')}"${ro}></label></div>
                <label class="oa-f w">Ort<input class="oa-in" name="location" maxlength="200" value="${esc(f.location || '')}"${ro}></label>
                <label class="oa-f w">Notizen<textarea class="oa-in" name="notes" rows="2" maxlength="2000"${ro}>${esc(f.notes || '')}</textarea></label>
                <label class="oa-f">Erinnerung<select class="oa-in" name="remind"${ro}>${CAL.REMINDS.map(([v, t]) => `<option value="${v === null ? '' : v}"${(f.remind === undefined ? null : f.remind) === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
                <label class="oa-f">Wer sieht ihn?<select class="oa-in" name="share"${ro}><option value="private"${sh === 'private' ? ' selected' : ''}>Nur ich</option><option value="public"${sh === 'public' ? ' selected' : ''}>Alle Mitglieder</option><option value="people"${sh === 'people' ? ' selected' : ''}>Bestimmte Personen einladen</option>${cals.length ? `<option value="calendar"${sh === 'calendar' ? ' selected' : ''}>Gemeinsamer Kalender</option>` : ''}</select></label>
                <div class="oa-f w kc-ppl">Einladen<div class="oa-chips">${ppl.map(p => `<label class="oa-chip"><input type="checkbox" name="members" value="${esc(p.uid)}"${(f.members || []).includes(p.uid) ? ' checked' : ''}${ro} hidden>${esc(p.name)}${ev && sh === 'people' ? { yes: ' ✓', no: ' ✗' }[CAL.rsvpOf(ev, p.uid)] || '' : ''}</label>`).join('') || '<span class="oa-note">Niemand im Verzeichnis (Messenger-Berechtigung nötig).</span>'}</div></div>
                <label class="oa-f w kc-calsel">Kalender<select class="oa-in" name="calendarId"${ro}>${cals.map(c => `<option value="${esc(c.id)}"${f.calendarId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
                <div class="oa-f w">Farbe<div class="oa-chips kc-cols"><label class="oa-chip"><input type="radio" name="color" value=""${!f.color ? ' checked' : ''}${ro} hidden>Automatisch</label>${CAL.COLORS.map(([c, n]) => `<label class="oa-chip kc-col" title="${n}" style="--c:${c}"><input type="radio" name="color" value="${c}"${f.color === c ? ' checked' : ''}${ro} hidden><i></i></label>`).join('')}</div></div></div>
                <div class="oa-acts">${ev && mine ? '<button type="button" class="btn bad" data-del><i class="fa-solid fa-trash-can"></i>Löschen</button><span class="oa-sp"></span>' : ''}<button type="button" class="btn" data-close>${mine ? 'Abbrechen' : 'Schließen'}</button>${mine ? '<button type="submit" class="btn pri"><i class="fa-solid fa-check"></i>Speichern</button>' : ''}</div></form>`, { w: 620 });
            const fm = m.box.querySelector('form'); let scope = 'all';
            const sync = () => { const ad = fm.allday.checked, rep = fm.repeat.value, shv = fm.share.value; fm.querySelectorAll('.kc-t').forEach(x => { x.hidden = ad; });
                fm.querySelector('.kc-iv').hidden = rep === 'none' || rep === 'workdays'; fm.querySelector('.kc-days').hidden = rep !== 'weekly'; fm.querySelector('.kc-un').hidden = rep === 'none';
                fm.querySelector('.kc-rep').hidden = scope === 'one'; fm.querySelector('.kc-ppl').hidden = shv !== 'people'; fm.querySelector('.kc-calsel').hidden = shv !== 'calendar';
                fm.querySelectorAll('.oa-chip').forEach(c => { const i = c.querySelector('input'); if (i) c.classList.toggle('on', i.checked); }); };
            fm.addEventListener('change', sync); sync();
            m.box.addEventListener('click', async ev2 => {
                const sc = ev2.target.closest('[data-scope]'); if (sc) { scope = sc.dataset.scope; m.box.querySelectorAll('[data-scope]').forEach(b => b.classList.toggle('on', b === sc)); fm.date.value = scope === 'one' ? occ : ev.date; sync(); return; }
                const r = ev2.target.closest('[data-r]'); if (r) { try { await db.collection('events').doc(id).update({ ['rsvp.' + U.uid]: r.dataset.r }); m.close(); toast(root, r.dataset.r === 'yes' ? 'Zugesagt' : 'Abgesagt – der Termin wird ausgeblendet'); } catch (x) { toast(root, errMsg(x), true); } return; }
                if (ev2.target.closest('[data-del]')) { m.close(); del(ev, occ); }
            });
            fm.addEventListener('submit', async e2 => {
                e2.preventDefault(); const rep = fm.repeat.value, shv = fm.share.value, cal = shv === 'calendar' ? cals.find(c => c.id === fm.calendarId.value) : null;
                const days = rep === 'weekly' ? [...fm.querySelectorAll('[name="days"]:checked')].map(i => +i.value) : [];
                const d = { title: fm.title.value.trim(), date: fm.date.value, time: fm.allday.checked ? '' : fm.time.value, endTime: fm.allday.checked ? '' : fm.endTime.value, repeat: rep,
                    interval: rep === 'none' || rep === 'workdays' ? 1 : Math.max(1, Math.min(99, parseInt(fm.interval.value, 10) || 1)), until: rep === 'none' ? '' : fm.until.value,
                    days: days.length > 1 || (days.length === 1 && days[0] !== pD(fm.date.value || iso(new Date())).getDay()) ? days : [], location: fm.location.value.trim(), notes: fm.notes.value.trim(), remind: fm.remind.value === '' ? null : +fm.remind.value,
                    share: shv, isPublic: shv === 'public', members: shv === 'people' ? [...fm.querySelectorAll('[name="members"]:checked')].map(i => i.value) : cal ? [...(cal.members || [])] : [], calendarId: cal ? cal.id : '',
                    color: CAL.colorOf({ color: (fm.querySelector('[name="color"]:checked') || {}).value }) || (cal && CAL.colorOf({ color: cal.color })) || '' };
                const err = CAL.validate(d); if (err) return toast(root, err, true);
                d.rsvp = {}; if (d.share === 'people' && ev && ev.rsvp) d.members.forEach(u => { if (ev.rsvp[u]) d.rsvp[u] = ev.rsvp[u]; });
                try {
                    if (!ev) await db.collection('events').add({ ...d, owner: U.email, ownerName: U.name, createdAt: TS() });
                    else if (rec && scope === 'one') { const b = db.batch(); b.update(db.collection('events').doc(id), { ...CAL.deleteOne(ev, occ).data, updatedAt: TS() }); b.set(db.collection('events').doc(), { ...d, repeat: 'none', interval: 1, until: '', owner: U.email, ownerName: U.name, createdAt: TS() }); await b.commit(); }
                    else await db.collection('events').doc(id).update({ ...d, ownerName: U.name, updatedAt: TS() });
                    m.close(); sel = d.date;
                } catch (x) { toast(root, 'Speichern fehlgeschlagen: ' + errMsg(x), true); }
            });
        }
        async function del(ev, occ) {
            let scope = 'all';
            if (CAL.isRecurring(ev)) { scope = await new Promise(res => { const m = modal(root, `<h3><i class="fa-solid fa-trash-can"></i>Serie löschen</h3><p class="oa-note">„${esc(ev.title)}“ wiederholt sich (${esc(CAL.repeatLabel(ev))}).</p>
                <div class="oa-acts"><button type="button" class="btn" data-s="one">Nur ${CAL.germanDate(occ)}</button><button type="button" class="btn" data-s="following">Ab diesem Termin</button><button type="button" class="btn bad" data-s="all">Ganze Serie</button></div>`);
                m.box.addEventListener('click', e2 => { const b = e2.target.closest('[data-s]'); if (b) { m.close(); res(b.dataset.s); } }); }); }
            else if (!(await uiConfirm(`„${ev.title}“ löschen?`, { danger: true, ok: 'Löschen' }))) return;
            if (!scope) return;
            try { const r = scope === 'one' ? CAL.deleteOne(ev, occ) : scope === 'following' ? CAL.deleteFollowing(ev, occ) : { op: 'delete' }, ref = db.collection('events').doc(ev.id);
                if (r.op === 'delete') await ref.delete(); else await ref.update({ ...r.data, updatedAt: TS() }); } catch (x) { toast(root, 'Löschen fehlgeschlagen: ' + errMsg(x), true); }
        }
        async function calEditor(id) {
            const c = id ? cals.find(x => x.id === id) : null, own = !c || c.owner === U.uid; await people();
            const ppl = Object.values(dir).filter(p => p.uid !== U.uid).sort((a, b) => a.name.localeCompare(b.name, 'de'));
            const m = modal(root, `<form><h3><i class="fa-solid fa-layer-group"></i>${c ? esc(c.name) : 'Gemeinsamer Kalender'}</h3>
                <p class="oa-note">Termine in diesem Kalender sehen alle Mitglieder automatisch – z. B. „Freunde“ oder „WG“.</p>
                <div class="oa-form"><label class="oa-f w">Name<input class="oa-in" name="name" maxlength="40" value="${esc(c ? c.name : '')}" required${own ? '' : ' disabled'}></label>
                <div class="oa-f w">Farbe<div class="oa-chips">${CAL.COLORS.map(([col, n]) => `<label class="oa-chip kc-col${(c ? c.color : '#22d3ee') === col ? ' on' : ''}" title="${n}" style="--c:${col}"><input type="radio" name="color" value="${col}"${(c ? c.color : CAL.COLORS[1][0]) === col ? ' checked' : ''} hidden${own ? '' : ' disabled'}><i></i></label>`).join('')}</div></div>
                <div class="oa-f w">Mitglieder<div class="oa-chips">${ppl.map(p => `<label class="oa-chip${c && (c.members || []).includes(p.uid) ? ' on' : ''}"><input type="checkbox" name="members" value="${esc(p.uid)}"${c && (c.members || []).includes(p.uid) ? ' checked' : ''} hidden${own ? '' : ' disabled'}>${esc(p.name)}</label>`).join('')}</div></div></div>
                <div class="oa-acts">${c && own ? '<button type="button" class="btn bad" data-cdel>Löschen</button>' : c ? '<button type="button" class="btn bad" data-cleave>Verlassen</button>' : ''}<span class="oa-sp"></span><button type="button" class="btn" data-close>Abbrechen</button>${own ? '<button type="submit" class="btn pri">Speichern</button>' : ''}</div></form>`);
            const fm = m.box.querySelector('form'); fm.addEventListener('change', () => fm.querySelectorAll('.oa-chip').forEach(x => x.classList.toggle('on', x.querySelector('input').checked)));
            const syncEv = async (cid, members) => { const s = await db.collection('events').where('calendarId', '==', cid).where('members', 'array-contains', U.uid).get(); for (let i = 0; i < s.docs.length; i += 400) { const b = db.batch(); s.docs.slice(i, i + 400).forEach(d => b.update(d.ref, { members, updatedAt: TS() })); await b.commit(); } };
            m.box.addEventListener('click', async e2 => {
                try { if (e2.target.closest('[data-cdel]')) { if (!(await uiConfirm('Kalender löschen? Die Termine bleiben bei ihren Besitzern, werden aber nicht mehr geteilt.', { danger: true, ok: 'Löschen' }))) return; await syncEv(id, []); await db.collection('calendars').doc(id).delete(); m.close(); }
                    if (e2.target.closest('[data-cleave]')) { if (!(await uiConfirm('Diesen Kalender verlassen?', { ok: 'Verlassen' }))) return; await db.collection('calendars').doc(id).update({ members: firebase.firestore.FieldValue.arrayRemove(U.uid) }); m.close(); } } catch (x) { toast(root, errMsg(x), true); } });
            fm.addEventListener('submit', async e2 => { e2.preventDefault(); const name = fm.name.value.trim(); if (!name) return; const color = (fm.querySelector('[name="color"]:checked') || {}).value || '', members = [U.uid, ...[...fm.querySelectorAll('[name="members"]:checked')].map(i => i.value)];
                try { if (id) { await db.collection('calendars').doc(id).update({ name, color, members, updatedAt: TS() }); await syncEv(id, members); } else await db.collection('calendars').add({ name, color, members, owner: U.uid, createdAt: TS() }); m.close(); } catch (x) { toast(root, 'Speichern fehlgeschlagen: ' + errMsg(x), true); } });
        }

        // ---------- Bedienung ----------
        const step = d => { if (view === 'month') cur = new Date(cur.getFullYear(), cur.getMonth() + d, 1); else if (view === 'week') cur.setDate(cur.getDate() + 7 * d); else cur.setDate(cur.getDate() + 30 * d); cur = new Date(cur); render(); };
        body.addEventListener('click', ev => {
            const e1 = ev.target.closest('[data-ev]'); if (e1) return editor(e1.dataset.ev, e1.dataset.occ);
            const mo = ev.target.closest('.kc-more'); if (mo) { sel = mo.dataset.day; cur = pD(sel); view = 'week'; return render(); }
            const ca = ev.target.closest('[data-cal]'); if (ca) { ev.preventDefault(); return calEditor(ca.dataset.cal); }
            const v = ev.target.closest('[data-v]'); if (v) { view = S.calView = v.dataset.v; API.save(); return render(); }
            const dd = ev.target.closest('[data-day]'); if (dd) { sel = dd.dataset.day; body.querySelectorAll('.kc-day.sel').forEach(x => x.classList.remove('sel')); if (dd.classList.contains('kc-day')) dd.classList.add('sel'); return side(); }          // nicht neu zeichnen, sonst geht der Doppelklick verloren
            const k = ev.target.closest('[data-k]'); if (!k) return;
            ({ new: () => editor(null, null, sel), today: () => { cur = new Date(); sel = iso(cur); render(); }, prev: () => step(-1), next: () => step(1), newcal: () => calEditor(null) }[k.dataset.k] || (() => {}))();
        });
        body.addEventListener('dblclick', ev => { const dd = ev.target.closest('[data-day]'); if (dd && !ev.target.closest('[data-ev]')) editor(null, null, dd.dataset.day); });
        body.addEventListener('change', ev => { const h = ev.target.closest('[data-hide]'); if (!h) return; const k = h.dataset.hide; S.calHide = h.checked ? S.calHide.filter(x => x !== k) : [...S.calHide, k]; API.save(); render(); });
        body.addEventListener('contextmenu', ev => { const e1 = ev.target.closest('[data-ev]'), dd = ev.target.closest('[data-day]');
            if (e1) { ev.preventDefault(); const x = allEv.find(y => y.id === e1.dataset.ev); if (!x) return; const mine = x.owner === U.email;
                API.ctx(ev.clientX, ev.clientY, [['fa-pen', mine ? 'Bearbeiten' : 'Ansehen', () => editor(x.id, e1.dataset.occ)], ['fa-copy', 'Duplizieren', () => editor(null, null, e1.dataset.occ, x.time)], mine && null, mine && ['fa-trash-can', 'Löschen', () => del(x, e1.dataset.occ)]].filter(v => v !== false)); }
            else if (dd) { ev.preventDefault(); API.ctx(ev.clientX, ev.clientY, [['fa-plus', 'Neuer Termin an diesem Tag', () => editor(null, null, dd.dataset.day)]]); } });
        $('.oa-h input').addEventListener('input', e2 => { q = e2.target.value.trim().toLowerCase(); render(); });
        body.addEventListener('keydown', ev => { if (ev.target.closest('input, textarea, select') || body.querySelector('.oa-mod')) return;
            if (ev.key === 'ArrowLeft') step(-1); else if (ev.key === 'ArrowRight') step(1); else if (ev.key.toLowerCase() === 't') { cur = new Date(); sel = iso(cur); render(); } else if (ev.key.toLowerCase() === 'n') editor(null, null, sel); });
        body.tabIndex = -1;
        const off = CAL.subscribe(db, U, (vis, all) => { events = vis; allEv = all; render(); }, x => toast(root, 'Termine: ' + errMsg(x), true));
        const offCal = db.collection('calendars').where('members', 'array-contains', U.uid).onSnapshot(s => { cals = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name), 'de')); render(); }, () => {});
        if (prefs.fer) CAL.loadFerien(prefs.region).then(render).catch(() => {});
        people().then(render);
        const tickIv = setInterval(() => { if (!win.el.isConnected) return clearInterval(tickIv); render(); }, 5 * 60000);
        win.onClose = () => { off(); offCal(); clearInterval(tickIv); };
        win.onParams = p => { if (p && p.date) { sel = p.date; cur = pD(p.date); render(); } if (p && p.ev) editor(p.ev, p.occ); };
        render();
    }
    JMOS_LAZY.register('wand', { ui, init(api, user) { API = api; U = user; } });
})();
