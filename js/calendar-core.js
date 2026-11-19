// js/calendar-core.js - gemeinsame Termin-Logik (Wiederholungen, Beschriftungen, Prüfung, Löschen).
// Reine Funktionen ohne Oberfläche. Wird von der Startseite, dem Wandkalender und der Suche genutzt.
//
// Ein Termin ist ein Datenbank-Dokument:
//   { title, date:'JJJJ-MM-TT', time:'' | 'HH:MM', endTime:'' | 'HH:MM', isPublic, owner,
//     repeat:'none'|'daily'|'workdays'|'weekly'|'monthly'|'yearly', interval:1..99, until:'' | 'JJJJ-MM-TT', exceptions:['JJJJ-MM-TT', ...],
//     color:'' | '#rrggbb' (eigene Farbe, leer = automatisch nach Titel) }
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
    // Gesetzliche Feiertage NRW (wie in der Zeiterfassung)
    const HOL = {};
    function holidays(y) {
        if (HOL[y]) return HOL[y];
        const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
        const easter = Date.UTC(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, (h + l - 7 * m + 114) % 31 + 1), ea = n => toStr(easter + n * DAY);
        return HOL[y] = new Set([y + '-01-01', ea(-2), ea(1), y + '-05-01', ea(39), ea(50), ea(60), y + '-10-03', y + '-11-01', y + '-12-25', y + '-12-26']);
    }
    const isWorkday = s => { const wd = new Date(toMs(s)).getUTCDay(); return wd !== 0 && wd !== 6 && !holidays(+s.slice(0, 4)).has(s); };
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
        return (n === 1 ? u[0] : 'alle ' + n + ' ' + u[1]) + (ev.until ? ' bis ' + germanDate(ev.until) : '');
    }
    const timeLabel = ev => (ev && ev.time ? (ev.endTime ? ev.time + '–' + ev.endTime : ev.time) : '');

    // Prüft die Eingaben eines Termins. Gibt eine Fehlermeldung zurück oder '' wenn alles passt.
    function validate(f) {
        if (!f.title || !String(f.title).trim()) return 'Bitte einen Titel eingeben.';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '')) return 'Bitte ein Datum wählen.';
        if (f.endTime && !f.time) return 'Für ein Ende braucht es auch einen Beginn.';
        if (f.time && f.endTime && f.endTime <= f.time) return 'Das Ende muss nach dem Beginn liegen.';
        if (repOf(f) !== 'none' && f.until && f.until < f.date) return 'Das Enddatum der Wiederholung liegt vor dem Beginn.';
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

    root.CAL = { occurrencesOf, expand, nextOccurrences, repeatLabel, timeLabel, validate, deleteOne, deleteFollowing, isRecurring, addDays, germanDate, REPEATS, COLORS, colorOf, isWorkday };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.CAL;
})(typeof window !== 'undefined' ? window : globalThis);
