// OS/app-zeit.js – Zeiterfassung als eigene OS-App: Stempeluhr, Monat (Ist/Soll/Saldo), Überstundenkonto mit Monatsabschluss,
// Kalender mit Urlaub/Krank/Abbau, Einträge, Urlaubskonto, CSV und Stundenzettel aus der Firmenvorlage.
// Gleiche Daten und Rechnungen wie im Dashboard: worktime, active_work, userPrefs.work; Soll über js/calendar-core.js.
(function () {
    'use strict';
    const { esc, modal, toast, errMsg, iso } = OAK;
    const TS = () => firebase.firestore.FieldValue.serverTimestamp();
    const TYPES = { work: ['Arbeit', 'fa-business-time', '#34d399'], vacation: ['Urlaub', 'fa-umbrella-beach', '#eab308'], sick: ['Krank', 'fa-notes-medical', '#ef4444'], flex: ['Überstundenabbau', 'fa-hourglass-half', '#a855f7'] };
    const ABS = ['vacation', 'sick', 'flex'];
    const fmtT = d => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const pD = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
    const netOf = (s, e, p) => { let d = toMin(e) - toMin(s); if (d < 0) d += 1440; return Math.max(0, d - p); };
    const hm = min => { const s = min < 0 ? '−' : ''; min = Math.abs(Math.round(min)); return `${s}${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`; };
    const sg = min => (min > 0 ? '+' : '') + hm(min);
    const tone = min => min > 0 ? 'oa-pos' : min < 0 ? 'oa-neg' : '';
    const typeOf = e => e.type || 'work';
    const addMon = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
    const monthEnd = ym => `${ym}-${String(new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate()).padStart(2, '0')}`;
    const monthLabel = ym => new Date(+ym.slice(0, 4), +ym.slice(5) - 1, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    const dayAfter = ds => { const d = pD(ds); d.setDate(d.getDate() + 1); return iso(d); };
    const gd = d => d.split('-').reverse().join('.');
    let U = null, API = null;

    function ui(body, win) {
        if (!can(U, 'zeit')) { body.innerHTML = '<div class="oa"><p class="oa-empty"><i class="fa-solid fa-lock"></i>Für die Zeiterfassung fehlt die Berechtigung.</p></div>'; return; }
        let entries = [], active = null, ym = iso(new Date()).slice(0, 7), tab = 'ov', filter = 'all', vacYear = new Date().getFullYear(), busy = false;
        const W = () => ({ pause: 60, after: 6, weekly: 40, vacation: 30, carry: 0, carryYear: 0, ...((U.userPrefs || {}).work || {}) });
        const region = () => CAL.prefs(U).region;
        const dayMinOf = d => CAL.workDayMin(W(), typeof d === 'string' ? d : iso(d), region());
        const isWork = d => dayMinOf(d) > 0;
        const sollMin = (a, b) => CAL.workSoll(W(), a, b, region());
        const sumNet = l => l.reduce((s, e) => s + (e.netMinutes || 0), 0);
        const inRange = (a, b) => entries.filter(w => w.date >= a && w.date <= b);
        const istOf = m => sumNet(inRange(`${m}-01`, monthEnd(m)));
        const closings = () => { const c = W().closings; return c && typeof c === 'object' ? c : {}; };
        const paidOf = m => { const c = closings()[m]; return c && Number.isFinite(+c.paid) ? Math.round(+c.paid) : null; };
        const otOf = () => { const o = W().ot; return o && /^\d{4}-\d{2}-\d{2}$/.test(o.upto || '') && Number.isFinite(+o.min) ? { min: Math.round(+o.min), upto: o.upto } : null; };
        function account(o = {}) {
            const ot = 'ot' in o ? o.ot : otOf(), today = iso(new Date()), cur = today.slice(0, 7); let min = ot ? ot.min : 0, start;
            if (ot) { const am = ot.upto.slice(0, 7), me = monthEnd(am); start = addMon(am, 1); if (ot.upto < me && today > me) min += sumNet(inRange(dayAfter(ot.upto), me)) - sollMin(dayAfter(ot.upto), me); }
            else { const first = entries.reduce((a, w) => (w.date && (!a || w.date < a) ? w.date : a), ''); start = first ? first.slice(0, 7) : cur; }
            let last = ''; const months = [];
            for (let m = start, i = 0; m <= cur && i < 240; m = addMon(m, 1), i++) { const paid = paidOf(m); months.push({ ym: m, paid }); if (paid !== null && m !== o.skip) { min += istOf(m) - paid; last = m; } }
            return { min, ot, last, months, open: months.filter(x => x.paid === null).map(x => x.ym) };
        }
        function vacStats(year) {
            const w = W(), today = iso(new Date()), dates = [...new Set(entries.filter(e => typeOf(e) === 'vacation' && (e.date || '').startsWith(String(year))).map(e => e.date))].sort();
            const pre = Math.max(0, +((w.vacPre || {})[year]) || 0), total = w.vacation + (w.carryYear === year ? w.carry : 0), done = dates.filter(d => d <= today).length, planned = dates.length - done;
            return { total, taken: done + pre, planned, left: total - done - pre - planned };
        }
        const liveGross = () => active && active.startTime ? Math.max(0, Math.round((Date.now() - active.startTime.toDate()) / 60000)) : 0;
        const livePause = () => active ? (active.pauseMinutes ?? W().pause) : W().pause;
        const liveNet = () => { const g = liveGross(); return Math.max(0, g - (g >= W().after * 60 ? livePause() : 0)); };

        body.innerHTML = `<div class="oa oa-zt" style="--m:#34d399;--mr:52,211,153"><div class="oa-h"><span class="oa-ico"><i class="fa-solid fa-business-time"></i></span><div><h2>Zeiterfassung</h2><small class="zt-sub"></small></div>
            <div class="oa-tabs">${[['ov', 'Übersicht'], ['zeiten', 'Zeiten'], ['abw', 'Abwesenheit']].map(([k, t]) => `<button type="button" data-tab="${k}">${t}</button>`).join('')}</div><span class="oa-sp"></span>
            <button type="button" class="mx-ib" data-k="mprev" aria-label="Vorheriger Monat"><i class="fa-solid fa-chevron-left"></i></button><b class="zt-month"></b><button type="button" class="mx-ib" data-k="mnext" aria-label="Nächster Monat"><i class="fa-solid fa-chevron-right"></i></button>
            <button type="button" class="btn pri" data-k="add"><i class="fa-solid fa-plus"></i>Zeit</button><button type="button" class="btn" data-k="abs"><i class="fa-solid fa-umbrella-beach"></i>Abwesenheit</button><button type="button" class="mx-ib" data-k="more" aria-label="Mehr"><i class="fa-solid fa-ellipsis"></i></button></div>
            <div class="oa-b zt-b"></div></div>`;
        const $ = s => body.querySelector(s), root = $('.oa'), main = $('.zt-b');
        const run = async (fn, okMsg) => { try { await fn(); if (okMsg) toast(root, okMsg); } catch (x) { toast(root, 'Fehler: ' + errMsg(x), true); } };
        const log = (a, d) => { if (typeof logSystemEvent === 'function') logSystemEvent('data', a, d || {}); };

        function render() {
            body.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); $('.zt-month').textContent = monthLabel(ym);
            const w = W(); $('.zt-sub').textContent = `Soll ${hm(CAL.workAvg(w))} Std/Tag · Pause ${w.pause} Min ab ${w.after} Std`;
            if (tab === 'ov') ov(); else if (tab === 'zeiten') table(); else absView();
        }
        function ov() {
            const today = iso(new Date()), last = monthEnd(ym), to = last < today ? last : today, mist = sumNet(inRange(`${ym}-01`, to)), msoll = sollMin(`${ym}-01`, to), diff = mist - msoll, ac = account(), vs = vacStats(+ym.slice(0, 4));
            const live = liveNet(), dIst = sumNet(inRange(today, today)) + live, dSoll = dayMinOf(today), cur = today.slice(0, 7), pastOpen = ac.open.filter(m => m < cur);
            main.innerHTML = `<div class="zt-top"><div class="oa-card zt-clock${active ? ' on' : ''}"><div class="zt-ring" style="--p:${Math.min(100, dSoll ? dIst / dSoll * 100 : 0)}"><span><b class="zt-live">${active ? hm(live) : hm(dIst)}</b><small>${dSoll ? 'von ' + hm(dSoll) + ' heute' : 'kein Sollarbeitstag'}</small></span></div>
                    <div class="zt-cc"><h3><i class="fa-solid fa-stopwatch"></i>Stempeluhr</h3>${active ? `<p class="oa-note">Seit ${fmtT(active.startTime.toDate())} Uhr eingestempelt</p><label class="oa-f">Pause (Min)<input class="oa-in zt-lp" type="number" min="0" max="600" value="${livePause()}"></label>` : `<label class="oa-f">Beginn<input class="oa-in zt-st" type="time" value="${fmtT(new Date())}"></label>`}
                        <button type="button" class="btn ${active ? 'bad' : 'pri'} zt-tg" data-k="toggle"><i class="fa-solid fa-${active ? 'stop' : 'play'}"></i>${active ? 'Ausstempeln' : 'Einstempeln'}</button></div></div>
                <div class="oa-grid zt-kpis"><div class="oa-kpi"><small>Gearbeitet im ${esc(monthLabel(ym).split(' ')[0])}</small><b>${hm(mist)}</b><em>Soll bis heute ${hm(msoll)}</em></div>
                    <div class="oa-kpi"><small>Saldo im Monat</small><b class="${tone(diff)}">${sg(diff)}</b><em>${diff > 0 ? 'über Soll' : diff < 0 ? 'unter Soll' : 'genau im Soll'}</em></div>
                    <div class="oa-kpi zt-acct"><small>Überstundenkonto</small><b class="${tone(ac.min)}">${sg(ac.min)}</b><em>${ac.last ? 'Stand nach ' + monthLabel(ac.last) : ac.ot ? 'Startstand nach ' + monthLabel(ac.ot.upto.slice(0, 7)) : 'noch kein Monat abgeschlossen'}</em>
                        <span class="zt-ab"><button type="button" class="btn${pastOpen.length ? ' pri' : ''}" data-k="close"><i class="fa-solid fa-calendar-check"></i>${pastOpen.length ? `${pastOpen.length} offen – abschließen` : 'Abschließen'}</button><button type="button" class="btn" data-k="ot">Startstand</button></span></div>
                    <div class="oa-kpi"><small>Urlaub ${ym.slice(0, 4)}</small><b>${vs.left}</b><em>übrig von ${vs.total} · ${vs.planned} geplant</em></div></div></div>
                <div class="oa-card"><h3><i class="fa-solid fa-calendar-days"></i>${esc(monthLabel(ym))}<span class="oa-sp"></span><span class="zt-leg">${Object.entries(TYPES).map(([k, t]) => `<i style="background:${t[2]}"></i>${t[0]}`).join('')}</span></h3><div class="zt-cal"></div></div>`;
            cal();
        }
        function cal() {
            const box = $('.zt-cal'); if (!box) return; const first = pD(`${ym}-01`), off = (first.getDay() + 6) % 7, n = +monthEnd(ym).slice(8), today = iso(new Date()), hol = CAL.holidayMap(+ym.slice(0, 4), region());
            let h = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<span class="zt-wd">${d}</span>`).join('') + '<span></span>'.repeat(off);
            for (let i = 1; i <= n; i++) { const k = `${ym}-${String(i).padStart(2, '0')}`, es = entries.filter(e => e.date === k), abs = ABS.find(t => es.some(e => typeOf(e) === t)), work = es.filter(e => typeOf(e) === 'work'), net = sumNet(work), soll = dayMinOf(k);
                h += `<button type="button" class="zt-d${k === today ? ' today' : ''}${!soll ? ' free' : ''}${abs ? ' abs' : ''}" data-day="${k}" style="${abs ? `--c:${TYPES[abs][2]}` : work.length ? '--c:#34d399' : ''}" title="${esc(hol.get(k) || '')}"><b>${i}</b><small>${abs ? TYPES[abs][0] : work.length ? hm(net) : hol.get(k) ? esc(hol.get(k)) : ''}</small></button>`; }
            box.innerHTML = h;
        }
        function table() {
            const list = entries.filter(e => (e.date || '').startsWith(ym) && (filter === 'all' || typeOf(e) === filter)).sort((a, b) => (b.date + (b.start || '')).localeCompare(a.date + (a.start || '')));
            main.innerHTML = `<div class="oa-chips zt-f">${[['all', 'Alle'], ...Object.entries(TYPES).map(([k, t]) => [k, t[0]])].map(([k, t]) => `<button type="button" class="oa-chip${filter === k ? ' on' : ''}" data-f="${k}">${t}</button>`).join('')}<span class="oa-sp"></span><span class="oa-note">Summe: <b>${hm(sumNet(list))} Std</b></span></div>
                <div class="oa-card" style="padding:0;overflow:auto"><table class="oa-tbl"><thead><tr><th>Datum</th><th>Art</th><th>Beginn</th><th>Ende</th><th class="r">Pause</th><th class="r">Netto</th><th>Notiz</th><th></th></tr></thead><tbody>
                ${list.map(e => { const t = TYPES[typeOf(e)] || TYPES.work; return `<tr data-id="${esc(e.id)}"><td>${pD(e.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</td><td><span class="oa-tag" style="color:${t[2]};background:color-mix(in srgb, ${t[2]} 15%, transparent)"><i class="fa-solid ${t[1]}"></i>${t[0]}</span></td><td>${esc(e.start || '–')}</td><td>${esc(e.end || '–')}</td><td class="r">${e.pauseMinutes ? e.pauseMinutes + ' Min' : '–'}</td><td class="r"><b>${hm(e.netMinutes || 0)}</b></td><td class="oa-mut">${esc(e.note || '')}</td><td class="r"><button type="button" class="mx-ib" data-edit="${esc(e.id)}" aria-label="Bearbeiten"><i class="fa-solid fa-pen"></i></button><button type="button" class="mx-ib" data-del="${esc(e.id)}" aria-label="Löschen"><i class="fa-solid fa-trash-can"></i></button></td></tr>`; }).join('') || '<tr><td colspan="8"><p class="oa-empty">Keine Einträge in diesem Monat.</p></td></tr>'}</tbody></table></div>`;
        }
        function absView() {
            const y = String(vacYear), vs = vacStats(vacYear), today = iso(new Date()), cnt = {}, ranges = [];
            const nextWork = ds => { const d = pD(ds); let c = 0; do { d.setDate(d.getDate() + 1); c++; } while (!isWork(iso(d)) && c < 14); return iso(d); };
            ABS.forEach(t => { const ds = [...new Set(entries.filter(e => typeOf(e) === t && (e.date || '').startsWith(y)).map(e => e.date))].sort(); cnt[t] = ds.length; ds.forEach(d => { const l = ranges.find(r => r.t === t && nextWork(r.to) === d); if (l) { l.to = d; l.n++; } else ranges.push({ t, from: d, to: d, n: 1 }); }); });
            ranges.sort((a, b) => b.from.localeCompare(a.from));
            main.innerHTML = `<div class="zt-yh"><button type="button" class="mx-ib" data-k="yprev" aria-label="Vorheriges Jahr"><i class="fa-solid fa-chevron-left"></i></button><b>${y}</b><button type="button" class="mx-ib" data-k="ynext" aria-label="Nächstes Jahr"><i class="fa-solid fa-chevron-right"></i></button></div>
                <div class="oa-grid"><div class="oa-kpi"><small>Urlaubsanspruch</small><b>${vs.total}</b><em>Tage inkl. Übertrag</em></div><div class="oa-kpi"><small>Genommen</small><b>${vs.taken}</b><em>${vs.planned} geplant</em></div><div class="oa-kpi"><small>Übrig</small><b class="${vs.left < 0 ? 'oa-neg' : 'oa-pos'}">${vs.left}</b><em>Tage</em></div>${ABS.slice(1).map(t => `<div class="oa-kpi"><small>${TYPES[t][0]}</small><b>${cnt[t]}</b><em>Tage</em></div>`).join('')}</div>
                <div class="oa-card" style="margin-top:12px"><h3><i class="fa-solid fa-list"></i>Abwesenheiten ${y}</h3>${ranges.map(r => { const t = TYPES[r.t]; return `<div class="oa-row${r.to < today ? ' oa-mut' : ''}"><i class="fa-solid ${t[1]}" style="color:${t[2]}"></i><span>${gd(r.from).slice(0, 6)}${r.from !== r.to ? ' – ' + gd(r.to).slice(0, 6) : ''} · ${r.n} ${r.n === 1 ? 'Tag' : 'Tage'}<small>${t[0]}</small></span><button type="button" class="mx-ib" data-delr="${r.t}|${r.from}|${r.to}" aria-label="Zeitraum löschen"><i class="fa-solid fa-trash-can"></i></button></div>`; }).join('') || '<p class="oa-empty">Keine Abwesenheiten.</p>'}</div>`;
        }

        // ---------- Aktionen ----------
        async function toggle() {
            if (busy) return; busy = true;
            await run(async () => {
                if (active) { const start = active.startTime.toDate(), end = new Date(), total = Math.max(0, Math.round((end - start) / 60000)), pause = Math.min(total, total >= W().after * 60 ? livePause() : 0);
                    await db.collection('worktime').add({ type: 'work', date: iso(start), start: fmtT(start), end: fmtT(end), pauseMinutes: pause, netMinutes: total - pause, note: 'Live erfasst', owner: U.email, createdAt: TS() });
                    await db.collection('active_work').doc(U.uid).delete(); log('Ausgestempelt', { netMinutes: total - pause }); }
                else { const start = new Date(), v = ($('.zt-st') || {}).value; if (v) { const [h, m] = v.split(':').map(Number); start.setHours(h, m, 0, 0); } if (start > new Date()) start.setTime(Date.now());
                    await db.collection('active_work').doc(U.uid).set({ startTime: firebase.firestore.Timestamp.fromDate(start), pauseMinutes: W().pause, owner: U.email }); log('Eingestempelt', { start: fmtT(start) }); }
            });
            busy = false;
        }
        function editWork(id, date) {
            const e = id ? entries.find(w => w.id === id) : null; if (e && typeOf(e) !== 'work') return toast(root, 'Abwesenheiten änderst du im Kalender (Klick auf den Tag) oder unter „Abwesenheit“.');
            const m = modal(root, `<form><h3><i class="fa-solid fa-business-time"></i>${e ? 'Arbeitszeit bearbeiten' : 'Arbeitszeit erfassen'}</h3><div class="oa-form">
                <label class="oa-f w">Datum<input class="oa-in" type="date" name="date" value="${e ? e.date : date || iso(new Date())}" required></label>
                <label class="oa-f">Beginn<input class="oa-in" type="time" name="start" value="${e ? e.start || '08:00' : '08:00'}" required></label><label class="oa-f">Ende<input class="oa-in" type="time" name="end" value="${e ? e.end || '17:00' : '17:00'}" required></label>
                <label class="oa-f">Pause (Minuten)<input class="oa-in" type="number" min="0" max="600" name="pause" value="${e ? e.pauseMinutes || 0 : W().pause}"></label><label class="oa-f">Netto<input class="oa-in zt-net" disabled></label>
                <label class="oa-f w">Notiz<input class="oa-in" name="note" maxlength="200" value="${esc(e ? e.note || '' : '')}"></label></div>
                <div class="oa-acts"><button type="button" class="btn" data-close>Abbrechen</button><button type="submit" class="btn pri"><i class="fa-solid fa-check"></i>Speichern</button></div></form>`);
            const fm = m.box.querySelector('form'), upd = () => { fm.querySelector('.zt-net').value = hm(netOf(fm.start.value, fm.end.value, +fm.pause.value || 0)) + ' Std'; }; fm.addEventListener('input', upd); upd();
            fm.addEventListener('submit', ev => { ev.preventDefault(); const p = Math.max(0, parseInt(fm.pause.value || 0, 10)), d = { type: 'work', date: fm.date.value, start: fm.start.value, end: fm.end.value, pauseMinutes: p, netMinutes: netOf(fm.start.value, fm.end.value, p), note: fm.note.value.trim() };
                run(async () => { if (e) await db.collection('worktime').doc(e.id).update({ ...d, updatedAt: TS() }); else await db.collection('worktime').add({ ...d, owner: U.email, createdAt: TS() }); m.close(); log(e ? 'Arbeitszeit bearbeitet' : 'Arbeitszeit manuell erfasst', { date: d.date }); }); });
        }
        async function del(id) { if (await uiConfirm('Diesen Eintrag löschen?', { danger: true, ok: 'Löschen' })) run(async () => { await db.collection('worktime').doc(id).delete(); log('Arbeitszeit gelöscht', { id }); }); }
        function absence(type, from) {
            const m = modal(root, `<form><h3><i class="fa-solid fa-umbrella-beach"></i>Abwesenheit eintragen</h3><div class="oa-form">
                <label class="oa-f w">Art<select class="oa-in" name="type">${ABS.map(t => `<option value="${t}"${t === (type || 'vacation') ? ' selected' : ''}>${TYPES[t][0]}</option>`).join('')}</select></label>
                <label class="oa-f">Von<input class="oa-in" type="date" name="from" value="${from || iso(new Date())}" required></label><label class="oa-f">Bis<input class="oa-in" type="date" name="to" value="${from || iso(new Date())}" required></label>
                <label class="oa-f w">Notiz (optional)<input class="oa-in" name="note" maxlength="200"></label></div><p class="oa-note zt-absinfo"></p>
                <div class="oa-acts"><button type="button" class="btn" data-close>Abbrechen</button><button type="submit" class="btn pri">Eintragen</button></div></form>`);
            const fm = m.box.querySelector('form'), days = () => { const out = []; for (const d = pD(fm.from.value), e = pD(fm.to.value); d <= e && out.length < 62; d.setDate(d.getDate() + 1)) if (isWork(iso(d))) out.push(iso(d)); return out; };
            const info = () => { if (fm.to.value < fm.from.value) fm.to.value = fm.from.value; const n = days().length; m.box.querySelector('.zt-absinfo').textContent = `${n} Arbeitstag${n === 1 ? '' : 'e'} (Wochenenden und Feiertage zählen nicht)`; }; fm.addEventListener('input', info); info();
            fm.addEventListener('submit', async ev => { ev.preventDefault(); const t = fm.type.value, have = new Set(entries.filter(w => typeOf(w) === t).map(w => w.date)), todo = days().filter(d => !have.has(d));
                if (!todo.length) return toast(root, 'Im Zeitraum gibt es keinen freien Arbeitstag dafür.', true);
                if (t === 'vacation') { const by = {}; todo.forEach(d => { by[d.slice(0, 4)] = (by[d.slice(0, 4)] || 0) + 1; }); for (const [y, n] of Object.entries(by)) { const st = vacStats(+y); if (st.left - n < 0 && !(await uiConfirm(`Damit überschreitest du deinen Urlaubsanspruch ${y} um ${n - Math.max(0, st.left)} Tage. Trotzdem eintragen?`))) return; } }
                run(async () => { const b = db.batch(); todo.forEach(date => b.set(db.collection('worktime').doc(), { type: t, date, start: '', end: '', pauseMinutes: 0, netMinutes: t === 'flex' ? 0 : dayMinOf(date), note: fm.note.value.trim() || TYPES[t][0], owner: U.email, createdAt: TS() })); await b.commit(); m.close(); log('Abwesenheit eingetragen', { type: t, tage: todo.length }); }); });
        }
        async function setDay(k, t) {
            const old = entries.filter(w => w.date === k && typeOf(w) !== 'work');
            if (t === 'vacation' && !old.some(o => typeOf(o) === 'vacation')) { const st = vacStats(+k.slice(0, 4)); if (st.left - 1 < 0 && !(await uiConfirm(`Damit überschreitest du deinen Urlaubsanspruch ${k.slice(0, 4)}. Trotzdem eintragen?`))) return; }
            run(async () => { const b = db.batch(); old.forEach(o => b.delete(db.collection('worktime').doc(o.id))); if (t) b.set(db.collection('worktime').doc(), { type: t, date: k, start: '', end: '', pauseMinutes: 0, netMinutes: t === 'flex' ? 0 : dayMinOf(k), note: TYPES[t][0], owner: U.email, createdAt: TS() }); await b.commit(); });
        }
        function dayMenu(k, x, y) { const es = entries.filter(e => e.date === k), abs = es.some(e => typeOf(e) !== 'work');
            API.ctx(x, y, [['fa-plus', 'Arbeitszeit erfassen', () => editWork(null, k)], ...es.filter(e => typeOf(e) === 'work').map(e => ['fa-pen', `${e.start}–${e.end} bearbeiten`, () => editWork(e.id)]), null,
                ...ABS.map(t => [TYPES[t][1], TYPES[t][0], () => setDay(k, t)]), abs && ['fa-eraser', 'Abwesenheit entfernen', () => setDay(k, '')]].filter(v => v !== false)); }
        async function closeMonth(m0) {
            const ac = account(), cur = iso(new Date()).slice(0, 7); if (!ac.months.length) return toast(root, 'Noch kein Monat zum Abschließen. Erfasse zuerst Zeiten oder trag einen Startstand ein.', true);
            const past = ac.open.filter(m => m < cur), sel0 = m0 || past[0] || (ac.open.includes(cur) ? cur : ac.months[ac.months.length - 1].ym);
            const mo = modal(root, `<form><h3><i class="fa-solid fa-calendar-check"></i>Monat abschließen</h3><p class="oa-note">Trag ein, wie viele Stunden laut Lohnabrechnung bezahlt wurden. Die Differenz zu „Gearbeitet“ wandert aufs Überstundenkonto.</p>
                <div class="oa-form"><label class="oa-f w">Monat<select class="oa-in" name="m">${ac.months.slice().reverse().map(x => `<option value="${x.ym}"${x.ym === sel0 ? ' selected' : ''}>${monthLabel(x.ym)}${x.paid !== null ? ' · abgeschlossen' : x.ym === cur ? ' · läuft noch' : ' · offen'}</option>`).join('')}</select></label>
                <div class="w zt-cs"></div><label class="oa-f">Bezahlt – Stunden<input class="oa-in" type="number" min="0" name="h"></label><label class="oa-f">Minuten<input class="oa-in" type="number" min="0" max="59" name="mi"></label>
                <div class="w oa-chips"><button type="button" class="oa-chip" data-set="soll">= Soll</button><button type="button" class="oa-chip" data-set="ist">= Gearbeitet</button></div><p class="w oa-note zt-ci"></p></div>
                <div class="oa-acts"><button type="button" class="btn bad zt-undo" hidden>Abschluss aufheben</button><span class="oa-sp"></span><button type="button" class="btn" data-close>Abbrechen</button><button type="submit" class="btn pri">Abschließen</button></div></form>`);
            const fm = mo.box.querySelector('form'), val = () => Math.max(0, parseInt(fm.h.value, 10) || 0) * 60 + Math.min(59, Math.max(0, parseInt(fm.mi.value, 10) || 0)), set = v => { v = Math.max(0, Math.round(v)); fm.h.value = Math.floor(v / 60); fm.mi.value = v % 60; prev(); };
            const prev = () => { const m = fm.m.value, before = account({ skip: m }).min, d = istOf(m) - val(), after = before + d; mo.box.querySelector('.zt-ci').innerHTML = `Konto: <b class="${tone(before)}">${sg(before)}</b> → <b class="${tone(after)}">${sg(after)}</b> (${d ? sg(d) : 'keine Änderung'})`; };
            const fill = () => { const m = fm.m.value, paid = paidOf(m), ist = istOf(m), soll = sollMin(`${m}-01`, monthEnd(m)); mo.box.querySelector('.zt-cs').innerHTML = `<div class="oa-grid"><div class="oa-kpi"><small>Gearbeitet</small><b>${hm(ist)}</b></div><div class="oa-kpi"><small>Soll</small><b>${hm(soll)}</b></div></div>`;
                const last = Object.keys(closings()).filter(k => k < m && paidOf(k) !== null).sort().pop(); set(paid !== null ? paid : last ? paidOf(last) : soll); mo.box.querySelector('.zt-undo').hidden = paid === null; };
            fm.m.addEventListener('change', fill); fm.h.addEventListener('input', prev); fm.mi.addEventListener('input', prev); fill();
            mo.box.addEventListener('click', async ev => { const s = ev.target.closest('[data-set]'); if (s) { const m = fm.m.value; set(s.dataset.set === 'soll' ? sollMin(`${m}-01`, monthEnd(m)) : istOf(m)); }
                if (ev.target.closest('.zt-undo')) { const m = fm.m.value; if (!(await uiConfirm(`Abschluss für ${monthLabel(m)} aufheben?`, { danger: true, ok: 'Aufheben' }))) return; await saveWork({ ['closings.' + m]: firebase.firestore.FieldValue.delete() }, w => { const c = { ...(w.closings || {}) }; delete c[m]; w.closings = c; }); mo.close(); } });
            fm.addEventListener('submit', async ev => { ev.preventDefault(); const m = fm.m.value, d = { paid: val(), at: new Date().toISOString() }; await saveWork({ ['closings.' + m]: d }, w => { w.closings = { ...(w.closings || {}), [m]: d }; }); mo.close(); toast(root, monthLabel(m) + ' abgeschlossen'); log('Monat abgeschlossen', { monat: m }); });
        }
        async function saveWork(patch, local) {
            const up = {}; Object.entries(patch).forEach(([k, v]) => { up['userPrefs.work.' + k] = v; });
            try { await db.collection('users').doc(U.uid).update(up); U.userPrefs = U.userPrefs || {}; const w = { ...(U.userPrefs.work || {}) }; local(w); U.userPrefs.work = w; render(); } catch (x) { toast(root, 'Speichern fehlgeschlagen: ' + errMsg(x), true); }
        }
        function startStand() {
            const ot = otOf(), cur = iso(new Date()).slice(0, 7), base = ot ? ot.min : account().min, months = []; for (let i = 0; i < 36; i++) months.push(addMon(cur, -i));
            const mo = modal(root, `<form><h3><i class="fa-solid fa-scale-balanced"></i>Startstand Überstundenkonto</h3><p class="oa-note">Kontostand laut Firma zu einem Monatsende. Danach zählt jeder Monatsabschluss.</p><div class="oa-form">
                <label class="oa-f w">Stand nach<select class="oa-in" name="m">${months.map(m => `<option value="${m}"${m === (ot ? ot.upto.slice(0, 7) : addMon(cur, -1)) ? ' selected' : ''}>${monthLabel(m)}</option>`).join('')}</select></label>
                <label class="oa-f">Vorzeichen<select class="oa-in" name="s"><option value="1"${base >= 0 ? ' selected' : ''}>Plus</option><option value="-1"${base < 0 ? ' selected' : ''}>Minus</option></select></label><span></span>
                <label class="oa-f">Stunden<input class="oa-in" type="number" min="0" name="h" value="${Math.floor(Math.abs(base) / 60)}"></label><label class="oa-f">Minuten<input class="oa-in" type="number" min="0" max="59" name="mi" value="${Math.abs(base) % 60}"></label></div>
                <div class="oa-acts">${ot ? '<button type="button" class="btn bad zt-rot">Entfernen</button>' : ''}<span class="oa-sp"></span><button type="button" class="btn" data-close>Abbrechen</button><button type="submit" class="btn pri">Speichern</button></div></form>`);
            const fm = mo.box.querySelector('form');
            fm.addEventListener('submit', async ev => { ev.preventDefault(); const o = { min: (+fm.s.value) * ((Math.max(0, parseInt(fm.h.value, 10) || 0)) * 60 + Math.min(59, Math.max(0, parseInt(fm.mi.value, 10) || 0))), upto: monthEnd(fm.m.value) }; await saveWork({ ot: o }, w => { w.ot = o; }); mo.close(); });
            const r = mo.box.querySelector('.zt-rot'); if (r) r.addEventListener('click', async () => { if (!(await uiConfirm('Startstand entfernen?', { danger: true, ok: 'Entfernen' }))) return; await saveWork({ ot: firebase.firestore.FieldValue.delete() }, w => { delete w.ot; }); mo.close(); });
        }
        function settings() {
            const w = W(), cy = new Date().getFullYear(), days = [0, 1, 2, 3, 4, 5, 6].map(d => CAL.workBase(w, d) / 60);
            const mo = modal(root, `<form><h3><i class="fa-solid fa-sliders"></i>Einstellungen Zeiterfassung</h3><div class="oa-form">
                <div class="oa-f w">Stunden pro Wochentag<div class="zt-days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label>${CAL.WD[d]}<input class="oa-in" type="number" min="0" max="24" step="0.25" data-d="${d}" value="${days[d]}"></label>`).join('')}</div></div>
                <label class="oa-f">Pause (Minuten)<input class="oa-in" type="number" min="0" name="pause" value="${w.pause}"></label><label class="oa-f">Pause ab (Stunden Arbeit)<input class="oa-in" type="number" min="0" step="0.5" name="after" value="${w.after}"></label>
                <label class="oa-f">Urlaubstage pro Jahr<input class="oa-in" type="number" min="0" name="vac" value="${w.vacation}"></label><label class="oa-f">Übertrag ${cy}<input class="oa-in" type="number" min="0" name="carry" value="${w.carryYear === cy ? w.carry : 0}"></label>
                <label class="oa-f">Vor dem Start schon genommen (${cy})<input class="oa-in" type="number" min="0" name="pre" value="${(w.vacPre || {})[cy] || 0}"></label>
                <label class="oa-f">Bundesland (Feiertage)<select class="oa-in" name="region">${CAL.REGIONS.map(([k, n]) => `<option value="${k}"${region() === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
                <p class="oa-note">Gilt genauso im Dashboard.</p><div class="oa-acts"><button type="button" class="btn" data-close>Abbrechen</button><button type="submit" class="btn pri">Speichern</button></div></form>`, { w: 560 });
            const fm = mo.box.querySelector('form');
            fm.addEventListener('submit', async ev => { ev.preventDefault(); const a = [0, 0, 0, 0, 0, 0, 0]; fm.querySelectorAll('[data-d]').forEach(i => { a[+i.dataset.d] = Math.max(0, Math.min(24, Math.round((+i.value || 0) * 4) / 4)); });
                const work = { ...((U.userPrefs || {}).work || {}), pause: Math.max(0, +fm.pause.value), after: Math.max(0, +fm.after.value), days: a, weekly: a.reduce((x, y) => x + y, 0), vacation: Math.max(0, +fm.vac.value), carry: Math.max(0, +fm.carry.value), carryYear: cy, vacPre: { ...(((U.userPrefs || {}).work || {}).vacPre || {}), [cy]: Math.max(0, +fm.pre.value || 0) } };
                const calP = { ...CAL.prefs(U), ...((U.userPrefs || {}).cal || {}), region: fm.region.value };
                try { await db.collection('users').doc(U.uid).update({ 'userPrefs.work': work, 'userPrefs.cal': calP }); U.userPrefs = { ...(U.userPrefs || {}), work, cal: calP }; mo.close(); render(); } catch (x) { toast(root, errMsg(x), true); } });
        }
        function csv() {
            const cell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
            const list = entries.filter(e => (e.date || '').startsWith(ym)).sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
            const rows = [['Datum', 'Art', 'Beginn', 'Ende', 'Pause (Min)', 'Netto (Std)', 'Notiz'], ...list.map(e => [gd(e.date), (TYPES[typeOf(e)] || TYPES.work)[0], e.start || '', e.end || '', e.pauseMinutes || 0, ((e.netMinutes || 0) / 60).toFixed(2).replace('.', ','), e.note || ''])];
            const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })), download: `Arbeitszeiten_${ym}.csv` }); document.body.appendChild(a); a.click(); a.remove();
        }
        function timesheet() {
            const mo = modal(root, `<h3><i class="fa-solid fa-file-excel"></i>Stundenzettel aus Firmenvorlage</h3><div id="ts-body" class="zt-ts"><p class="oa-empty"><i class="fa-solid fa-spinner fa-spin"></i>Lädt …</p></div><div class="oa-acts"><button type="button" class="btn" data-close>Schließen</button></div>`, { w: 1100 });
            if (document.querySelectorAll('#ts-body').length > 1) { mo.close(); return toast(root, 'Der Stundenzettel ist schon in einem anderen Fenster offen.', true); }
            Timesheet.open({ db, user: U, entries: () => entries, holiday: k => CAL.holidays(+k.slice(0, 4), region()).has(k), isWorkday: k => CAL.workBase(W(), pD(k).getDay()) > 0, log: m => log('Stundenzettel erstellt', { monat: m }) });
        }
        // ---------- Bedienung ----------
        body.addEventListener('click', ev => {
            const t = ev.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; return render(); }
            const f = ev.target.closest('[data-f]'); if (f) { filter = f.dataset.f; return render(); }
            const d = ev.target.closest('[data-day]'); if (d) { const r = d.getBoundingClientRect(); return dayMenu(d.dataset.day, r.left + 10, r.bottom); }
            const ed = ev.target.closest('[data-edit]'); if (ed) return editWork(ed.dataset.edit); const dl = ev.target.closest('[data-del]'); if (dl) return del(dl.dataset.del);
            const dr = ev.target.closest('[data-delr]'); if (dr) { const [ty, a, b] = dr.dataset.delr.split('|'), list = entries.filter(e => typeOf(e) === ty && e.date >= a && e.date <= b); return uiConfirm(`${TYPES[ty][0]} ${gd(a)}${a !== b ? ' – ' + gd(b) : ''} löschen?`, { danger: true, ok: 'Löschen' }).then(ok => ok && run(async () => { const bt = db.batch(); list.forEach(e => bt.delete(db.collection('worktime').doc(e.id))); await bt.commit(); })); }
            const k = ev.target.closest('[data-k]'); if (!k) return;
            ({ toggle, add: () => editWork(null), abs: () => absence(), close: () => closeMonth(), ot: startStand, mprev: () => { ym = addMon(ym, -1); render(); }, mnext: () => { ym = addMon(ym, 1); render(); }, yprev: () => { vacYear--; render(); }, ynext: () => { vacYear++; render(); },
                more: () => { const r = k.getBoundingClientRect(); API.ctx(r.left - 180, r.bottom + 4, [['fa-file-excel', 'Stundenzettel (Firmenvorlage) …', timesheet], ['fa-file-csv', `CSV-Export ${monthLabel(ym)}`, csv], null, ['fa-sliders', 'Einstellungen …', settings]]); } }[k.dataset.k] || (() => {}))();
        });
        body.addEventListener('contextmenu', ev => { const d = ev.target.closest('[data-day]'); if (d) { ev.preventDefault(); return dayMenu(d.dataset.day, ev.clientX, ev.clientY); } const r = ev.target.closest('tr[data-id]'); if (r) { ev.preventDefault(); API.ctx(ev.clientX, ev.clientY, [['fa-pen', 'Bearbeiten', () => editWork(r.dataset.id)], ['fa-trash-can', 'Löschen', () => del(r.dataset.id)]]); } });
        body.addEventListener('change', ev => { if (ev.target.closest('.zt-lp') && active) db.collection('active_work').doc(U.uid).update({ pauseMinutes: Math.max(0, parseInt(ev.target.value, 10) || 0) }).catch(() => {}); });
        const off1 = db.collection('worktime').where('owner', '==', U.email).onSnapshot(s => { entries = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, x => toast(root, errMsg(x), true));
        const off2 = db.collection('active_work').doc(U.uid).onSnapshot(d => { active = d.exists ? d.data() : null; if (tab === 'ov') render(); }, () => {});
        const iv = setInterval(() => { if (!win.el.isConnected) return clearInterval(iv); const l = $('.zt-live'); if (l && active) l.textContent = hm(liveNet()); }, 15000);
        win.onClose = () => { off1(); off2(); clearInterval(iv); };
        render();
    }
    JMOS_LAZY.register('zeiterfassung', { ui, init(api, user) { API = api; U = user; } });
})();
