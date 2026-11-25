// js/calendar-core.js - gemeinsame Termin-Logik (Wiederholungen, Beschriftungen, Prüfung, Löschen).
// Reine Funktionen ohne Oberfläche. Wird von der Startseite, dem Wandkalender und der Suche genutzt.
//
// Ein Termin ist ein Datenbank-Dokument:
//   { title, date:'JJJJ-MM-TT', time:'' | 'HH:MM', endTime:'' | 'HH:MM', isPublic, owner,
//     repeat:'none'|'daily'|'workdays'|'weekly'|'monthly'|'yearly', interval:1..99, until:'' | 'JJJJ-MM-TT', exceptions:['JJJJ-MM-TT', ...],
//     color:'' | '#rrggbb' (eigene Farbe, leer = automatisch nach Titel),
//     days:[0..6] (nur bei weekly: Wochentage, 0 = Sonntag; leer = Wochentag des Beginns),
//     location:'', notes:'', remind: null (Standard des Nutzers) | 0 (keine) | Minuten vorher,
//     share:'private'|'public'|'people'|'calendar', members:[uid] (wer den Termin außer dem Besitzer sieht), calendarId:'', rsvp:{uid:'yes'|'no'} }
// "workdays" = Montag bis Freitag ohne gesetzliche Feiertage in NRW (z. B. für "Arbeiten"); interval spielt dabei keine Rolle.
// Alte Termine (nur title/date/isPublic/owner) funktionieren unverändert als eintägige Termine.
(function (root) {
    'use strict';
    const DAY = 864e5;
    const pad = n => String(n).padStart(2, '0');
    // Alle Datumsrechnungen laufen über UTC, damit Sommer-/Winterzeit nie einen Tag verschiebt.
    const toMs = s => { const p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); };
    const toStr = ms => { const d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
    const daysIn = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
    const addDays = (s, n) => toStr(toMs(s) + n * DAY);
    const germanDate = s => s.split('-').reverse().join('.');

    const REPEATS = { none: 'Keine Wiederholung', daily: 'Täglich', workdays: 'Werktags (Mo–Fr, ohne Feiertage)', weekly: 'Wöchentlich', monthly: 'Monatlich', yearly: 'Jährlich' };
    // ---------- Gesetzliche Feiertage je Bundesland ----------
    const REGIONS = [['BW', 'Baden-Württemberg'], ['BY', 'Bayern'], ['BE', 'Berlin'], ['BB', 'Brandenburg'], ['HB', 'Bremen'], ['HH', 'Hamburg'], ['HE', 'Hessen'], ['MV', 'Mecklenburg-Vorpommern'],
        ['NI', 'Niedersachsen'], ['NW', 'Nordrhein-Westfalen'], ['RP', 'Rheinland-Pfalz'], ['SL', 'Saarland'], ['SN', 'Sachsen'], ['ST', 'Sachsen-Anhalt'], ['SH', 'Schleswig-Holstein'], ['TH', 'Thüringen']];
    const regionOk = r => (REGIONS.some(x => x[0] === r) ? r : 'NW');
    const HOL = {};
    function holidayMap(y, region) {
        region = regionOk(region); const key = y + region; if (HOL[key]) return HOL[key];
        const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
        const easter = Date.UTC(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, (h + l - 7 * m + 114) % 31 + 1), ea = n => toStr(easter + n * DAY);
        const in_ = (...r) => r.includes(region), M = new Map();
        const add = (d, n) => M.set(d, n);
        add(y + '-01-01', 'Neujahr');
        if (in_('BW', 'BY', 'ST')) add(y + '-01-06', 'Heilige Drei Könige');
        if (in_('BE', 'MV')) add(y + '-03-08', 'Internationaler Frauentag');
        add(ea(-2), 'Karfreitag');
        if (in_('BB')) add(ea(0), 'Ostersonntag');
        add(ea(1), 'Ostermontag'); add(y + '-05-01', 'Tag der Arbeit'); add(ea(39), 'Christi Himmelfahrt');
        if (in_('BB')) add(ea(49), 'Pfingstsonntag');
        add(ea(50), 'Pfingstmontag');
        if (in_('BW', 'BY', 'HE', 'NW', 'RP', 'SL')) add(ea(60), 'Fronleichnam');
        if (in_('SL')) add(y + '-08-15', 'Mariä Himmelfahrt');
        if (in_('TH')) add(y + '-09-20', 'Weltkindertag');
        add(y + '-10-03', 'Tag der Deutschen Einheit');
        if (in_('BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH')) add(y + '-10-31', 'Reformationstag');
        if (in_('BW', 'BY', 'NW', 'RP', 'SL')) add(y + '-11-01', 'Allerheiligen');
        if (in_('SN')) { let ms = Date.UTC(y, 10, 22); while (new Date(ms).getUTCDay() !== 3) ms -= DAY; add(toStr(ms), 'Buß- und Bettag'); }     // Mittwoch vor dem 23.11.
        add(y + '-12-25', '1. Weihnachtstag'); add(y + '-12-26', '2. Weihnachtstag');
        return HOL[key] = M;
    }
    const holidays = (y, region) => new Set(holidayMap(y, region).keys());
    const holidayName = (s, region) => holidayMap(+s.slice(0, 4), region).get(s) || '';
    const isWorkday = (s, region) => { const wd = new Date(toMs(s)).getUTCDay(); return wd !== 0 && wd !== 6 && !holidayMap(+s.slice(0, 4), region).has(s); };
    const repOf = ev => (ev && REPEATS[ev.repeat] && ev.repeat !== 'none' ? ev.repeat : 'none');
    const stepOf = ev => Math.max(1, Math.min(99, Math.floor(+ev.interval) || 1));
    const isRecurring = ev => repOf(ev) !== 'none';

    // Alle Termintage eines Termins zwischen from und to (beide einschließlich, Format JJJJ-MM-TT).
    function occurrencesOf(ev, from, to) {
        const start = ev && ev.date, out = [];
        if (!start || to < start) return out;
        const rep = repOf(ev);
        if (rep === 'none') { if (start >= from && start <= to) out.push(start); return out; }
        const n = stepOf(ev), skip = new Set(ev.exceptions || []), lim = ev.until && ev.until < to ? ev.until : to;
        const push = d => { if (d >= from && d <= lim && !skip.has(d)) out.push(d); };
        const [sy, sm, sd] = start.split('-').map(Number), [fy, fm] = from.split('-').map(Number);
        if (rep === 'workdays') {
            for (let ms = Math.max(toMs(start), toMs(from)), c = 0; c < 4000; c++, ms += DAY) { const d = toStr(ms); if (d > lim) break; if (isWorkday(d)) push(d); }
        } else if (rep === 'weekly' && Array.isArray(ev.days) && ev.days.length) {
            // wöchentlich an mehreren Tagen: Woche für Woche (Montag als Wochenbeginn), im Abstand von n Wochen
            const wd0 = (new Date(toMs(start)).getUTCDay() + 6) % 7, mon0 = toMs(start) - wd0 * DAY, offs = [...new Set(ev.days.map(d => (+d + 6) % 7))].filter(x => x >= 0 && x < 7).sort((a, b) => a - b);
            const f = toMs(from); let k = f > mon0 ? Math.floor((f - mon0) / (7 * n * DAY)) : 0;
            for (let c = 0; c < 800; c++, k++) {
                const mon = mon0 + k * 7 * n * DAY; if (toStr(mon) > lim) break;
                for (const o of offs) { const d = toStr(mon + o * DAY); if (d >= start) push(d); }
            }
        } else if (rep === 'daily' || rep === 'weekly') {
            const step = (rep === 'weekly' ? 7 : 1) * n * DAY, s0 = toMs(start), f = toMs(from);
            let k = f > s0 ? Math.ceil((f - s0) / step) : 0;
            for (let c = 0; c < 1500; c++, k++) { const d = toStr(s0 + k * step); if (d > lim) break; push(d); }
        } else if (rep === 'monthly') {
            let k = Math.max(0, Math.floor(((fy - sy) * 12 + (fm - sm)) / n) - 1);
            for (let c = 0; c < 1500; c++, k++) {
                const idx = (sm - 1) + k * n, y = sy + Math.floor(idx / 12), m0 = idx % 12;
                const d = y + '-' + pad(m0 + 1) + '-' + pad(Math.min(sd, daysIn(y, m0)));   // 31. im Monat ohne 31 → letzter Tag
                if (d > lim) break; push(d);
            }
        } else {
            let k = Math.max(0, Math.floor((fy - sy) / n) - 1);
            for (let c = 0; c < 1500; c++, k++) {
                const y = sy + k * n, d = y + '-' + pad(sm) + '-' + pad(Math.min(sd, daysIn(y, sm - 1)));   // 29.2. im Nicht-Schaltjahr → 28.2.
                if (d > lim) break; push(d);
            }
        }
        return out;
    }

    // Alle Vorkommen mehrerer Termine im Zeitraum, sortiert nach Tag, dann ganztägig vor Uhrzeit, dann Titel.
    function expand(events, from, to) {
        const out = [];
        for (const ev of events || []) {
            const rec = isRecurring(ev);
            for (const d of occurrencesOf(ev, from, to)) out.push({ id: ev.id, key: ev.id + '@' + d, date: d, time: ev.time || '', endTime: ev.endTime || '', title: ev.title, isPublic: !!ev.isPublic, owner: ev.owner, recurring: rec, color: ev.color || '', ev });
        }
        return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '') || String(a.title).localeCompare(String(b.title), 'de'));
    }
    const nextOccurrences = (events, fromStr, limit, horizonDays) => expand(events, fromStr, addDays(fromStr, horizonDays || 180)).slice(0, limit || 8);

    function repeatLabel(ev) {
        const r = repOf(ev); if (r === 'none') return '';
        if (r === 'workdays') return 'werktags' + (ev.until ? ' bis ' + germanDate(ev.until) : '');
        const n = stepOf(ev), u = { daily: ['täglich', 'Tage'], weekly: ['wöchentlich', 'Wochen'], monthly: ['monatlich', 'Monate'], yearly: ['jährlich', 'Jahre'] }[r];
        const dd = r === 'weekly' && Array.isArray(ev.days) && ev.days.length ? ' am ' + [1, 2, 3, 4, 5, 6, 0].filter(d => ev.days.includes(d)).map(d => WD[d]).join(', ') : '';
        return (n === 1 ? u[0] : 'alle ' + n + ' ' + u[1]) + dd + (ev.until ? ' bis ' + germanDate(ev.until) : '');
    }
    const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const timeLabel = ev => (ev && ev.time ? (ev.endTime ? ev.time + '–' + ev.endTime : ev.time) : '');

    // Prüft die Eingaben eines Termins. Gibt eine Fehlermeldung zurück oder '' wenn alles passt.
    function validate(f) {
        if (!f.title || !String(f.title).trim()) return 'Bitte einen Titel eingeben.';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '')) return 'Bitte ein Datum wählen.';
        if (f.endTime && !f.time) return 'Für ein Ende braucht es auch einen Beginn.';
        if (f.time && f.endTime && f.endTime <= f.time) return 'Das Ende muss nach dem Beginn liegen.';
        if (repOf(f) !== 'none' && f.until && f.until < f.date) return 'Das Enddatum der Wiederholung liegt vor dem Beginn.';
        if (f.days && (!Array.isArray(f.days) || f.days.some(d => !(d >= 0 && d <= 6)))) return 'Ungültige Wochentage.';
        if (f.location && String(f.location).length > 200) return 'Der Ort ist zu lang (höchstens 200 Zeichen).';
        if (f.notes && String(f.notes).length > 2000) return 'Die Notizen sind zu lang (höchstens 2000 Zeichen).';
        if (f.share === 'people' && !(f.members || []).length) return 'Bitte mindestens eine Person auswählen.';
        if (f.share === 'calendar' && !f.calendarId) return 'Bitte einen gemeinsamen Kalender auswählen.';
        return '';
    }

    // Löschen: Ergebnis ist { op: 'delete' } (ganzes Dokument) oder { op: 'update', data: {...} } (Serie wird angepasst).
    function deleteOne(ev, date) {
        if (!isRecurring(ev)) return { op: 'delete' };
        return { op: 'update', data: { exceptions: Array.from(new Set([...(ev.exceptions || []), date])).sort() } };
    }
    function deleteFollowing(ev, date) {
        if (!isRecurring(ev) || date <= ev.date) return { op: 'delete' };
        const end = addDays(date, -1);
        return { op: 'update', data: { until: end, exceptions: (ev.exceptions || []).filter(x => x <= end) } };
    }

    // Wählbare Terminfarben (dunkler und heller Hintergrund)
    const COLORS = [['#60a5fa', 'Blau'], ['#2dd4bf', 'Türkis'], ['#4ade80', 'Grün'], ['#facc15', 'Gelb'], ['#fb923c', 'Orange'], ['#f87171', 'Rot'], ['#f472b6', 'Pink'], ['#a78bfa', 'Lila'], ['#94a3b8', 'Grau']];
    const colorOf = ev => { const c = ev && (ev.color || (ev.ev && ev.ev.color)); return COLORS.some(x => x[0] === c) ? c : ''; };

    // ---------- Schulferien (OpenHolidays API, im Browser 14 Tage zwischengespeichert) ----------
    const FER = {};
    const ferKey = r => 'jm-ferien-' + regionOk(r);
    function ferienCached(region) {
        const k = ferKey(region); if (FER[k]) return FER[k];
        try { const v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && Array.isArray(v.list)) return FER[k] = v.list; } catch (x) { }
        return [];
    }
    async function loadFerien(region) {
        const k = ferKey(region);
        try { const v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && Date.now() - v.at < 14 * DAY && Array.isArray(v.list)) return FER[k] = v.list; } catch (x) { }
        const y = new Date().getFullYear();
        const url = `https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&subdivisionCode=DE-${regionOk(region)}&languageIsoCode=DE&validFrom=${y - 1}-01-01&validTo=${y + 1}-12-31`;
        const r = await fetch(url, { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error('Ferien konnten nicht geladen werden (' + r.status + ').');
        const list = (await r.json()).map(h => ({ s: h.startDate, e: h.endDate, name: ((h.name || []).find(n => n.language === 'DE') || (h.name || [])[0] || {}).text || 'Ferien' })).filter(h => /^\d{4}-\d{2}-\d{2}$/.test(h.s) && /^\d{4}-\d{2}-\d{2}$/.test(h.e));
        try { localStorage.setItem(k, JSON.stringify({ at: Date.now(), list })); } catch (x) { }
        return FER[k] = list;
    }
    // Feiertage und Ferien im Zeitraum als Liste { date, title, kind:'hol'|'fer', first, range }
    function specialDays(from, to, o) {
        o = o || {}; const out = [], region = regionOk(o.region);
        if (o.hol !== false) for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) holidayMap(y, region).forEach((n, d) => { if (d >= from && d <= to) out.push({ date: d, title: n, kind: 'hol' }); });
        if (o.fer) ferienCached(region).forEach(h => {
            if (h.e < from || h.s > to) return;
            for (let ms = Math.max(toMs(h.s), toMs(from)), c = 0; c < 400 && toStr(ms) <= h.e && toStr(ms) <= to; c++, ms += DAY) { const d = toStr(ms); out.push({ date: d, title: h.name, kind: 'fer', first: d === h.s, range: germanDate(h.s).slice(0, 6) + '–' + germanDate(h.e) }); }
        });
        return out.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'hol' ? -1 : 1));
    }

    // ---------- Einstellungen des Nutzers (userPrefs.cal) ----------
    const REMINDS = [[null, 'Standard'], [0, 'Keine Erinnerung'], [10, '10 Minuten vorher'], [30, '30 Minuten vorher'], [60, '1 Stunde vorher'], [120, '2 Stunden vorher'], [1440, '1 Tag vorher'], [2880, '2 Tage vorher']];
    function prefs(user) {
        const p = (user && user.userPrefs && user.userPrefs.cal) || {};
        return { region: regionOk(p.region), hol: p.hol !== false, fer: !!p.fer, remind: p.remind === undefined ? 60 : +p.remind };
    }
    // Wann erinnern? Minuten vor Beginn oder null für keine Erinnerung.
    // Die Standard-Erinnerung gilt nur für Termine mit Uhrzeit; ganztägige Termine (Beginn = 8 Uhr) erinnern nur, wenn es im Termin eingestellt ist.
    function remindAt(o, def) {
        const own = o.ev && o.ev.remind !== undefined && o.ev.remind !== null, m = own ? +o.ev.remind : (o.time ? def : 0); if (!m) return null;
        const [y, mo, d] = o.date.split('-').map(Number), [hh, mm] = o.time ? o.time.split(':').map(Number) : [8, 0];
        return new Date(y, mo - 1, d, hh, mm).getTime() - m * 60000;
    }

    // ---------- Sollarbeitszeit (Zeiterfassung) ----------
    // work = userPrefs.work: days = [So, Mo, …, Sa] in Stunden (eigene Arbeitstage); fehlt days, gilt Wochenstunden / 5 an Mo–Fr.
    function workBase(work, wd) {
        const w = work || {};
        if (Array.isArray(w.days) && w.days.length === 7) return Math.round(Math.max(0, Math.min(24, +w.days[wd] || 0)) * 60);
        return wd >= 1 && wd <= 5 ? Math.round((+w.weekly || 40) / 5 * 60) : 0;
    }
    // Soll an einem Tag in Minuten (0 an Feiertagen und freien Tagen)
    const workDayMin = (work, s, region) => (holidayMap(+s.slice(0, 4), region).has(s) ? 0 : workBase(work, new Date(toMs(s)).getUTCDay()));
    function workSoll(work, from, to, region) { if (to < from) return 0; let n = 0; for (let ms = toMs(from), c = 0; c < 4000 && toStr(ms) <= to; c++, ms += DAY) n += workDayMin(work, toStr(ms), region); return n; }
    // durchschnittliches Tagessoll an Arbeitstagen (für Hinweise und Diagramm-Linien)
    function workAvg(work) { const v = [0, 1, 2, 3, 4, 5, 6].map(d => workBase(work, d)).filter(x => x > 0); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; }

    // ---------- Wer sieht was? ----------
    const shareOf = ev => (ev && ev.share) || (ev && ev.isPublic ? 'public' : 'private');
    const rsvpOf = (ev, uid) => (ev && ev.rsvp && ev.rsvp[uid]) || '';
    const isInvite = (ev, user) => !!(ev && user && ev.owner !== user.email && shareOf(ev) === 'people' && (ev.members || []).includes(user.uid));
    // Abgelehnte Einladungen blendet der Kalender aus
    const visible = (ev, user) => !(isInvite(ev, user) && rsvpOf(ev, user.uid) === 'no');
    // Alle Termine, die der Nutzer sehen darf: öffentliche, eigene und geteilte (Einladungen, gemeinsame Kalender)
    function subscribe(db, user, cb, onErr) {
        const parts = { pub: [], mine: [], shared: [] }, offs = [], list = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
        const merge = () => { const m = new Map(); [...parts.pub, ...parts.mine, ...parts.shared].forEach(ev => m.set(ev.id, ev)); cb([...m.values()].filter(ev => visible(ev, user)), [...m.values()]); };
        const on = (k, q) => offs.push(q.onSnapshot(s => { parts[k] = list(s); merge(); }, e => { if (onErr) onErr(e); merge(); }));
        on('pub', db.collection('events').where('isPublic', '==', true));
        on('mine', db.collection('events').where('owner', '==', user.email));
        on('shared', db.collection('events').where('members', 'array-contains', user.uid));
        return () => offs.forEach(f => f());
    }

    root.CAL = { occurrencesOf, expand, nextOccurrences, repeatLabel, timeLabel, validate, deleteOne, deleteFollowing, isRecurring, addDays, germanDate, REPEATS, COLORS, colorOf, isWorkday,
        workBase, workDayMin, workSoll, workAvg, REGIONS, holidays, holidayName, holidayMap, specialDays, loadFerien, ferienCached, REMINDS, prefs, remindAt, shareOf, rsvpOf, isInvite, visible, subscribe, WD };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.CAL;
})(typeof window !== 'undefined' ? window : globalThis);
