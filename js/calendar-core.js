// js/calendar-core.js - gemeinsame Termin-Logik (Wiederholungen, Beschriftungen, Prüfung, Löschen).
// Reine Funktionen ohne Oberfläche. Wird von der Startseite, dem Wandkalender und der Suche genutzt.
//
// Ein Termin ist ein Datenbank-Dokument:
//   { title, date:'JJJJ-MM-TT', time:'' | 'HH:MM', endTime:'' | 'HH:MM', isPublic, owner,
//     repeat:'none'|'daily'|'weekly'|'monthly'|'yearly', interval:1..99, until:'' | 'JJJJ-MM-TT', exceptions:['JJJJ-MM-TT', ...] }
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

    const REPEATS = { none: 'Keine Wiederholung', daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich', yearly: 'Jährlich' };
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
        if (rep === 'daily' || rep === 'weekly') {
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
            for (const d of occurrencesOf(ev, from, to)) out.push({ id: ev.id, key: ev.id + '@' + d, date: d, time: ev.time || '', endTime: ev.endTime || '', title: ev.title, isPublic: !!ev.isPublic, owner: ev.owner, recurring: rec, ev });
        }
        return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '') || String(a.title).localeCompare(String(b.title), 'de'));
    }
    const nextOccurrences = (events, fromStr, limit, horizonDays) => expand(events, fromStr, addDays(fromStr, horizonDays || 180)).slice(0, limit || 8);

    function repeatLabel(ev) {
        const r = repOf(ev); if (r === 'none') return '';
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

    root.CAL = { occurrencesOf, expand, nextOccurrences, repeatLabel, timeLabel, validate, deleteOne, deleteFollowing, isRecurring, addDays, germanDate, REPEATS };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.CAL;
})(typeof window !== 'undefined' ? window : globalThis);
