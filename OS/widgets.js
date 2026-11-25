// OS/widgets.js – Widgets für den Desktop von J.Mainz OS.
// Jedes Widget zeigt echte Daten aus dem Dashboard (gleiche Datenbank, gleiche Berechtigungen wie auf der Startseite).
// Verschieben per Ziehen, Größe klein/mittel/groß und Entfernen über das ⋯-Menü. Gespeichert wird im Profil (siehe os.js).
(function () {
    'use strict';
    const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pad = n => String(n).padStart(2, '0');
    let API = null, U = null;

    // ---------- Datenquellen (werden erst gestartet, wenn ein Widget sie braucht) ----------
    const SRC = {};
    function use(name, fn) {
        const s = SRC[name] || (SRC[name] = { data: undefined, fns: new Set(), on: false });
        s.fns.add(fn); if (s.data !== undefined) fn(s.data);
        if (!s.on) { s.on = true; START[name](d => { s.data = d; s.fns.forEach(f => { try { f(d); } catch (x) { console.warn(x); } }); }); }
        return () => s.fns.delete(fn);
    }
    const docs = q => q.docs.map(d => ({ id: d.id, ...d.data() }));
    const START = {
        zeit(set) {
            let active = null, entries = [];
            db.collection('active_work').doc(U.uid).onSnapshot(d => { const x = d.exists ? d.data() : null; active = x && x.startTime ? { start: x.startTime.toDate ? x.startTime.toDate() : new Date((x.startTime.seconds || 0) * 1000), pause: x.pauseMinutes } : null; set({ active, entries }); }, () => {});
            db.collection('worktime').where('owner', '==', U.email).onSnapshot(s => { entries = s.docs.map(d => d.data()); set({ active, entries }); }, () => set({ active, entries }));
        },
        events(set) {
            let pub = [], mine = [];
            const merge = () => { const m = new Map(); [...pub, ...mine].forEach(ev => m.set(ev.id, ev)); set([...m.values()]); };
            db.collection('events').where('isPublic', '==', true).onSnapshot(s => { pub = docs(s); merge(); }, () => merge());
            db.collection('events').where('owner', '==', U.email).onSnapshot(s => { mine = docs(s); merge(); }, () => merge());
        },
        todos(set) { db.collection('todos').orderBy('createdAt', 'desc').onSnapshot(s => set(docs(s)), () => set([])); },
        notes(set) { db.collection('notes').orderBy('createdAt', 'desc').limit(30).onSnapshot(s => set(docs(s)), () => set([])); },
        fin(set) {
            let tx = [], inv = [];
            db.collection('finance_transactions').where('owner', '==', U.email).onSnapshot(s => { tx = docs(s); set({ tx, inv }); }, () => set({ tx, inv }));
            db.collection('invoices').where('owner', '==', U.email).onSnapshot(s => { inv = docs(s); set({ tx, inv }); }, () => set({ tx, inv }));
        },
        wx(set) {
            const DEF = { name: 'Düren', lat: 50.8021, lon: 6.4836 }, l0 = (U.userPrefs?.home || {}).weather, l = l0 && isFinite(l0.lat) && isFinite(l0.lon) ? l0 : DEF;
            const load = async () => {
                try {
                    const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${l.lat}&longitude=${l.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=4&timezone=auto`)).json();
                    set({ place: l.name, c: j.current, d: j.daily });
                } catch (x) { set({ place: l.name, err: true }); }
            };
            load(); setInterval(load, 30 * 60000);
        },
    };

    // ---------- Rechnen wie auf der Startseite (Zeiterfassung) ----------
    const HOL = {};
    function holidays(y) {
        if (HOL[y]) return HOL[y];
        const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), f0 = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * f0 + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
        const ea = n => { const x = new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, (h + l - 7 * m + 114) % 31 + 1); x.setDate(x.getDate() + n); return localDate(x); };
        return HOL[y] = new Set([`${y}-01-01`, ea(-2), ea(1), `${y}-05-01`, ea(39), ea(50), ea(60), `${y}-10-03`, `${y}-11-01`, `${y}-12-25`, `${y}-12-26`]);
    }
    const W = () => ({ pause: 60, after: 6, weekly: 40, vacation: 30, carry: 0, carryYear: 0, ...(U.userPrefs?.work || {}) });
    const dayMin = () => Math.round(W().weekly / 5 * 60);
    const pDate = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const isWork = d => d.getDay() % 6 !== 0 && !holidays(d.getFullYear()).has(localDate(d));
    const sollMin = (from, to) => { if (to < from) return 0; let n = 0; for (const d = pDate(from), end = pDate(to); d <= end; d.setDate(d.getDate() + 1)) if (isWork(d)) n++; return n * dayMin(); };
    const hh = min => { const s = min < 0 ? '-' : ''; min = Math.abs(Math.round(min)); return `${s}${Math.floor(min / 60)}:${pad(min % 60)} h`; };
    function zeitKpis({ active, entries }) {
        const now = new Date(), today = localDate(now), sum = (a, b) => entries.reduce((x, en) => x + (en.date >= a && en.date <= b ? Number(en.netMinutes) || 0 : 0), 0);
        let live = 0; if (active) { const g = Math.max(0, (Date.now() - active.start) / 60000), p = active.pause ?? W().pause; live = Math.max(0, g - (g >= W().after * 60 ? p : 0)); }
        const mon = new Date(now); mon.setDate(now.getDate() - (now.getDay() + 6) % 7); const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const day = sum(today, today) + live, week = sum(localDate(mon), localDate(sun)) + live;
        // Überstundenkonto: Startstand + abgeschlossene Monate (wie Startseite/Zeiterfassung)
        const w = W(), ot = w.ot, cl = w.closings || {}, cur = today.slice(0, 7), otOk = ot && /^\d{4}-\d{2}-\d{2}$/.test(ot.upto || '') && Number.isFinite(+ot.min);
        const addM = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5) - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
        const mEnd = ym => `${ym}-${pad(new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate())}`;
        const first = entries.reduce((x, en) => (en.date && (!x || en.date < x) ? en.date : x), '');
        let acc = null;
        if (otOk || first) {
            acc = otOk ? Math.round(+ot.min) : 0; const start = otOk ? addM(ot.upto.slice(0, 7), 1) : first.slice(0, 7);
            if (otOk && ot.upto < mEnd(ot.upto.slice(0, 7)) && today > mEnd(ot.upto.slice(0, 7))) { const nx = pDate(ot.upto); nx.setDate(nx.getDate() + 1); const f = localDate(nx), me = mEnd(ot.upto.slice(0, 7)); acc += sum(f, me) - sollMin(f, me); }
            for (let m = start, i = 0; m <= cur && i < 240; m = addM(m, 1), i++) { const c = cl[m]; if (c && Number.isFinite(+c.paid)) acc += sum(`${m}-01`, mEnd(m)) - Math.round(+c.paid); }
        }
        const y = now.getFullYear(), total = w.vacation + (w.carryYear === y ? w.carry : 0);
        const used = new Set(entries.filter(en => (en.type || 'work') === 'vacation' && en.date && en.date.startsWith(String(y))).map(en => en.date)).size + Math.max(0, +((w.vacPre || {})[y]) || 0);
        return { day, daySoll: isWork(now) ? dayMin() : 0, week, weekSoll: sollMin(localDate(mon), localDate(sun)), ot: acc, vac: total - used, vacTotal: total };
    }

    // ---------- Wetter-Symbole (wie Startseite) ----------
    const WX = [[0, 'Klar', 'fa-sun', '#fbbf24'], [3, 'Leicht bewölkt', 'fa-cloud-sun', '#fcd34d'], [48, 'Nebelig', 'fa-smog', '#94a3b8'], [67, 'Regnerisch', 'fa-cloud-rain', '#22d3ee'],
        [77, 'Schnee', 'fa-snowflake', '#a5b4fc'], [82, 'Regenschauer', 'fa-cloud-showers-heavy', '#22d3ee'], [86, 'Schneeschauer', 'fa-snowflake', '#a5b4fc'], [99, 'Gewitter', 'fa-cloud-bolt', '#f59e0b']];
    const wx = c => WX.find(w => c <= w[0]) || WX[WX.length - 1];
    const eur = n => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    const dayLbl = s => { const t = localDate(), tm = new Date(); tm.setDate(tm.getDate() + 1); return s === t ? 'Heute' : s === localDate(tm) ? 'Morgen' : pDate(s).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }); };
    const dayDiff = s => Math.round((pDate(s) - pDate(localDate())) / 864e5);

    // ---------- Widget-Arten ----------
    const TYPES = {
        clock: { name: 'Uhr & Datum', icon: 'fa-clock', c: '#818cf8', desc: 'Analoguhr, Uhrzeit, Datum und Kalenderwoche', sizes: { s: [230, 130], m: [260, 300], l: [320, 360] },
            mount(b, w) {
                const R = w.size === 's' ? 0 : w.size === 'l' ? 104 : 86;
                b.innerHTML = `<div class="wg-clock ${w.size}">${R ? `<svg viewBox="-100 -100 200 200" class="ana" style="width:${R * 2}px;height:${R * 2}px" aria-hidden="true"><circle r="96" class="face"/>${Array.from({ length: 60 }, (_, i) => `<line class="${i % 5 ? 'mi' : 'hr'}" x1="0" y1="${i % 5 ? -88 : -84}" x2="0" y2="-93" transform="rotate(${i * 6})"/>`).join('')}<line class="h" x1="0" y1="8" x2="0" y2="-50"/><line class="m" x1="0" y1="12" x2="0" y2="-74"/><line class="s" x1="0" y1="16" x2="0" y2="-82"/><circle r="5" class="dot"/></svg>` : ''}<b class="t"></b><span class="d"></span></div>`;
                const tick = () => { const d = new Date();
                    b.querySelector('.t').textContent = d.toLocaleTimeString('de-DE', w.size === 's' ? { hour: '2-digit', minute: '2-digit' } : undefined);
                    const kw = (() => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); })();
                    b.querySelector('.d').textContent = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }) + (w.size !== 's' ? ` · KW ${kw}` : '');
                    if (R) { const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = d.getHours() % 12 + m / 60;
                        b.querySelector('.h').setAttribute('transform', `rotate(${h * 30})`); b.querySelector('.m').setAttribute('transform', `rotate(${m * 6})`); b.querySelector('.s').setAttribute('transform', `rotate(${s * 6})`); }
                };
                tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
            } },
        weather: { name: 'Wetter', icon: 'fa-cloud-sun', c: '#fbbf24', desc: 'Aktuelles Wetter und Vorschau für deinen Ort von der Startseite', sizes: { s: [230, 130], m: [300, 190], l: [320, 290] },
            mount(b, w) {
                return use('wx', x => {
                    if (!x.c) { b.innerHTML = `<div class="wg-empty"><i class="fa-solid fa-cloud-sun"></i>${x.err ? 'Wetter gerade nicht erreichbar' : 'Lädt …'}</div>`; return; }
                    const c = x.c, d = x.d, k = wx(c.weather_code);
                    b.innerHTML = `<div class="wg-wx ${w.size}"><div class="now"><i class="fa-solid ${k[2]}" style="color:${k[3]}"></i><div><b>${Math.round(c.temperature_2m)}°</b><span>${e(k[1])}</span></div><small class="pl"><i class="fa-solid fa-location-dot"></i>${e(x.place)}</small></div>
                        ${w.size !== 's' ? `<div class="meta"><span><i class="fa-solid fa-wind"></i>${Math.round(c.wind_speed_10m)} km/h</span><span><i class="fa-solid fa-droplet"></i>${c.relative_humidity_2m} %</span><span><i class="fa-solid fa-umbrella"></i>${d.precipitation_probability_max[0] ?? '–'} %</span></div>` : ''}
                        ${w.size === 'l' ? `<div class="fc">${[1, 2, 3].map(i => { const f = wx(d.weather_code[i]); return `<div><span>${new Date(d.time[i] + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short' })}</span><i class="fa-solid ${f[2]}" style="color:${f[3]}" title="${e(f[1])}"></i><b>${Math.round(d.temperature_2m_max[i])}°<small> / ${Math.round(d.temperature_2m_min[i])}°</small></b></div>`; }).join('')}</div>` : ''}</div>`;
                });
            } },
        stamp: { name: 'Stempeluhr', icon: 'fa-business-time', c: '#34d399', perm: 'zeit', app: 'zeiterfassung', desc: 'Ein- und ausstempeln direkt vom Desktop, dazu Heute, Woche und Überstunden', sizes: { s: [250, 160], m: [300, 320], l: [330, 390] },
            mount(b, w) {
                b.innerHTML = `<div class="wg-st ${w.size}"><div class="top"><span class="dot"></span><span class="lbl">…</span></div><b class="tm">–</b><button type="button" class="wg-btn go"></button>${w.size !== 's' ? '<div class="kp"></div>' : ''}</div>`;
                let st = null, busy = false;
                const draw = () => {
                    if (!st) return; const on = !!st.active, k = zeitKpis(st), el = b.firstChild;
                    el.classList.toggle('on', on);
                    el.querySelector('.lbl').textContent = on ? `Eingestempelt seit ${st.active.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr` : 'Nicht eingestempelt';
                    if (on) { const ms = Math.max(0, Date.now() - st.active.start); el.querySelector('.tm').textContent = `${Math.floor(ms / 3600000)}:${pad(Math.floor(ms % 3600000 / 60000))}:${pad(Math.floor(ms % 60000 / 1000))}`; }
                    else el.querySelector('.tm').textContent = hh(k.day).replace(' h', '') + ' h heute';
                    const bt = el.querySelector('.go'), bh = on ? '<i class="fa-solid fa-stop"></i>Ausstempeln' : '<i class="fa-solid fa-play"></i>Einstempeln';
                    if (bt.dataset.h !== bh) { bt.innerHTML = bh; bt.dataset.h = bh; } bt.classList.toggle('stop', on); bt.disabled = busy;      // nur bei Änderung neu, sonst gehen Klicks verloren
                    const kp = el.querySelector('.kp'); if (!kp) return;
                    const bar = (a, s) => `<i style="width:${Math.min(100, s ? a / s * 100 : 0)}%"></i>`;
                    const kh = `<div><span>Heute</span><b>${hh(k.day)}</b><small>${k.daySoll ? 'von ' + hh(k.daySoll) : 'kein Arbeitstag'}</small><em>${bar(k.day, k.daySoll || k.day)}</em></div>
                        <div><span>Woche</span><b>${hh(k.week)}</b><small>von ${hh(k.weekSoll)}</small><em>${bar(k.week, k.weekSoll)}</em></div>
                        ${k.ot !== null ? `<div><span>Überstunden</span><b class="${k.ot >= 0 ? 'g' : 'r'}">${k.ot > 0 ? '+' : ''}${hh(k.ot)}</b></div>` : ''}
                        ${w.size === 'l' ? `<div><span>Resturlaub</span><b class="bl">${String(k.vac).replace('.', ',')} ${Math.abs(k.vac) === 1 ? 'Tag' : 'Tage'}</b><small>von ${String(k.vacTotal).replace('.', ',')}</small></div>` : ''}`;
                    if (kp.dataset.h !== kh) { kp.innerHTML = kh; kp.dataset.h = kh; }
                };
                b.querySelector('.go').addEventListener('click', async () => {
                    if (!st || busy) return;
                    if (st.active && !(await uiConfirm('Jetzt ausstempeln? Die Zeit wird als Eintrag in der Zeiterfassung gespeichert.', { ok: 'Ausstempeln', title: 'Ausstempeln' }))) return;
                    busy = true; draw();
                    try {
                        const fmt = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        if (st.active) {
                            const start = st.active.start, end = new Date(), total = Math.max(0, Math.round((end - start) / 60000));
                            const pause = Math.min(total, total >= W().after * 60 ? (st.active.pause ?? W().pause) : 0);
                            await db.collection('worktime').add({ type: 'work', date: localDate(start), start: fmt(start), end: fmt(end), pauseMinutes: pause, netMinutes: total - pause, note: 'Live erfasst (Desktop)', owner: U.email, createdAt: TS() });
                            await db.collection('active_work').doc(U.uid).delete();
                            logSystemEvent('data', 'Ausgestempelt', { netMinutes: total - pause, pause });
                        } else {
                            await db.collection('active_work').doc(U.uid).set({ startTime: firebase.firestore.Timestamp.fromDate(new Date()), pauseMinutes: W().pause, owner: U.email });
                            logSystemEvent('data', 'Eingestempelt', { start: fmt(new Date()) });
                        }
                    } catch (x) { uiAlert('Stempeln fehlgeschlagen: ' + (x.message || x)); }
                    busy = false; draw();
                });
                const off = use('zeit', d => { st = d; draw(); }), id = setInterval(draw, 1000);
                return () => { off(); clearInterval(id); };
            } },
        events: { name: 'Nächste Termine', icon: 'fa-calendar-day', c: '#818cf8', perm: 'termine', app: 'menu', desc: 'Die nächsten Termine aus dem Kalender', sizes: { s: [280, 200], m: [300, 300], l: [330, 420] },
            mount(b, w) {
                const n = { s: 3, m: 5, l: 8 }[w.size];
                const draw = evs => {
                    if (typeof CAL === 'undefined') { b.innerHTML = '<div class="wg-empty">Kalender nicht geladen</div>'; return; }
                    const t = localDate(), now = new Date(), hn = now.getHours() + now.getMinutes() / 60, tmv = s => { const [h, m] = String(s).split(':').map(Number); return (h || 0) + (m || 0) / 60; };
                    const list = CAL.nextOccurrences(evs, t, 20, 120).filter(o => o.date !== t || !o.time || (o.endTime ? tmv(o.endTime) : tmv(o.time) + 1) > hn).slice(0, n);
                    b.innerHTML = list.length ? `<div class="wg-list">${list.map(o => { const c = CAL.colorOf(o) || (o.isPublic ? '#818cf8' : '#a78bfa');
                        return `<button type="button" class="ev" style="--ec:${c}" data-open="1"><span class="bar"></span><span><small>${e(dayLbl(o.date))} · ${o.time ? e(CAL.timeLabel(o)) : 'ganztägig'}${o.recurring ? ' <i class="fa-solid fa-repeat"></i>' : ''}</small><b>${e(o.title)}</b></span></button>`; }).join('')}</div>`
                        : '<div class="wg-empty"><i class="fa-solid fa-calendar-check"></i>Keine anstehenden Termine</div>';
                };
                b.addEventListener('click', ev => { if (ev.target.closest('[data-open]')) API.openApp('menu'); });
                const off = use('events', draw), id = setInterval(() => { if (SRC.events?.data) draw(SRC.events.data); }, 5 * 60000);
                return () => { off(); clearInterval(id); };
            } },
        todos: { name: 'Aufgaben & Einkauf', icon: 'fa-list-check', c: '#34d399', perm: 'aufgaben', app: 'menu', desc: 'Aufgaben und Einkaufsliste abhaken und neue hinzufügen', sizes: { s: [280, 250], m: [300, 340], l: [330, 460] },
            mount(b, w) {
                let f = w.f || 'all', all = [], kind = 'task';
                b.innerHTML = `<div class="wg-td"><div class="chips">${[['all', 'Alle'], ['task', 'Aufgaben'], ['shop', 'Einkauf']].map(c => `<button type="button" data-f="${c[0]}">${c[1]}</button>`).join('')}<span class="cnt"></span></div><div class="lst"></div>
                    <form class="add"><button type="button" class="kd" title="Aufgabe oder Einkauf"><i class="fa-solid fa-circle-check"></i></button><input maxlength="200" placeholder="Neue Aufgabe …" aria-label="Neuer Eintrag"><button type="submit" class="ok" aria-label="Hinzufügen"><i class="fa-solid fa-plus"></i></button></form></div>`;
                const kindOf = t => t.kind === 'shop' ? 'shop' : 'task';
                const setKind = k => { kind = k; b.querySelector('.kd').innerHTML = `<i class="fa-solid ${k === 'shop' ? 'fa-cart-shopping' : 'fa-circle-check'}" style="color:${k === 'shop' ? '#facc15' : '#34d399'}"></i>`; b.querySelector('.add input').placeholder = k === 'shop' ? 'Einkauf, z. B. Milch …' : 'Neue Aufgabe …'; };
                const draw = () => {
                    b.querySelectorAll('[data-f]').forEach(c => c.classList.toggle('on', c.dataset.f === f));
                    const list = all.filter(t => f === 'all' || kindOf(t) === f).sort((a, c) => (a.done ? 1 : 0) - (c.done ? 1 : 0));
                    b.querySelector('.cnt').textContent = list.filter(t => !t.done).length + ' offen';
                    b.querySelector('.lst').innerHTML = list.length ? list.map(t => `<label class="tk${t.done ? ' done' : ''}"><input type="checkbox" data-id="${e(t.id)}" ${t.done ? 'checked' : ''}><span class="cb"><i class="fa-solid fa-check"></i></span><span class="tx">${e(t.text)}</span>${kindOf(t) === 'shop' ? '<i class="fa-solid fa-cart-shopping sh"></i>' : ''}<button type="button" class="x" data-del="${e(t.id)}" aria-label="Löschen"><i class="fa-solid fa-xmark"></i></button></label>`).join('')
                        : `<div class="wg-empty">${f === 'shop' ? 'Nichts auf der Einkaufsliste' : 'Alles erledigt 🎉'}</div>`;
                };
                b.addEventListener('click', ev => {
                    const c = ev.target.closest('[data-f]'); if (c) { f = c.dataset.f; w.f = f; API.save(); if (f !== 'all') setKind(f); draw(); }
                    const d = ev.target.closest('[data-del]'); if (d) { ev.preventDefault(); db.collection('todos').doc(d.dataset.del).delete().catch(x => uiAlert('Löschen fehlgeschlagen: ' + x.message)); }
                    if (ev.target.closest('.kd')) setKind(kind === 'task' ? 'shop' : 'task');
                });
                b.addEventListener('change', ev => { const id = ev.target.dataset.id; if (id) db.collection('todos').doc(id).update({ done: ev.target.checked }).catch(() => {}); });
                b.querySelector('.add').addEventListener('submit', ev => {
                    ev.preventDefault(); const i = b.querySelector('.add input'), text = i.value.trim(); if (!text) return;
                    db.collection('todos').add({ text, kind, done: false, author: U.firstName || '', owner: U.email, createdAt: TS() }).then(() => { i.value = ''; }).catch(x => uiAlert('Speichern fehlgeschlagen: ' + x.message));
                });
                setKind(f === 'shop' ? 'shop' : 'task');
                return use('todos', d => { all = d; draw(); });
            } },
        fin: { name: 'Finanzen', icon: 'fa-coins', c: '#facc15', perm: 'finanzen', app: 'finanzen', desc: 'Saldo im Monat und die nächsten fälligen Rechnungen', sizes: { s: [260, 150], m: [300, 310], l: [330, 410] },
            mount(b, w) {
                return use('fin', ({ tx, inv }) => {
                    const ym = localDate().slice(0, 7), mt = tx.filter(t => t.date?.startsWith(ym)), inc = mt.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0), out = mt.filter(t => t.amount < 0).reduce((a, t) => a + t.amount, 0), sal = inc + out;
                    const open = inv.filter(v => v.status !== 'paid').sort((a, c) => (a.due || '9999') < (c.due || '9999') ? -1 : 1).slice(0, w.size === 'l' ? 4 : 2);
                    const dueTxt = v => { if (!v.due) return ['Fälligkeit unbekannt', 'u']; const d = dayDiff(v.due); return [d < -1 ? `seit ${-d} Tagen überfällig` : d === -1 ? 'seit gestern überfällig' : d === 0 ? 'heute fällig' : d === 1 ? 'morgen fällig' : `in ${d} Tagen`, d < 0 ? 'r' : d <= 7 ? 'y' : 'b']; };
                    b.innerHTML = `<div class="wg-fin ${w.size}"><span class="l">Saldo ${new Date().toLocaleDateString('de-DE', { month: 'long' })}</span><b class="${sal >= 0 ? 'g' : 'r'}">${eur(sal)}</b><small>Einnahmen ${eur(inc)} · Ausgaben ${eur(-out)}</small>
                        ${w.size !== 's' ? `<div class="iv"><span class="l">Nächste Rechnungen <em>${inv.filter(v => v.status !== 'paid').length} offen</em></span>${open.length ? open.map(v => { const [t, c] = dueTxt(v); return `<div class="rw"><span><b>${e(v.vendor || 'Rechnung')}</b><small class="${c}">${e(t)}</small></span><b>${v.amount ? eur(v.amount) : '–'}</b></div>`; }).join('') : '<div class="ok"><i class="fa-solid fa-circle-check"></i>Keine offenen Rechnungen</div>'}</div>` : ''}</div>`;
                });
            } },
        notes: { name: 'Pinnwand', icon: 'fa-thumbtack', c: '#f59e0b', perm: 'pinnwand', app: 'menu', desc: 'Notizen der Familie lesen und neue anpinnen', sizes: { s: [280, 250], m: [320, 340], l: [380, 460] },
            mount(b, w) {
                b.innerHTML = `<div class="wg-pin"><div class="lst"></div><form class="add"><input maxlength="300" placeholder="Notiz anpinnen …" aria-label="Neue Notiz"><button type="submit" class="ok" aria-label="Anpinnen"><i class="fa-solid fa-thumbtack"></i></button></form></div>`;
                b.addEventListener('click', ev => { const d = ev.target.closest('[data-del]'); if (d) db.collection('notes').doc(d.dataset.del).delete().catch(x => uiAlert('Löschen fehlgeschlagen: ' + x.message)); });
                b.querySelector('.add').addEventListener('submit', ev => {
                    ev.preventDefault(); const i = b.querySelector('.add input'), text = i.value.trim(); if (!text) return;
                    db.collection('notes').add({ text, author: U.firstName || '', owner: U.email, createdAt: TS() }).then(() => { i.value = ''; }).catch(x => uiAlert('Speichern fehlgeschlagen: ' + x.message));
                });
                return use('notes', list => {
                    const ago = n => { const t = n.createdAt?.toDate ? n.createdAt.toDate() : null; if (!t) return ''; const d = Math.round((pDate(localDate()) - pDate(localDate(t))) / 864e5); return d === 0 ? 'heute' : d === 1 ? 'gestern' : t.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); };
                    b.querySelector('.lst').innerHTML = list.length ? list.map(n => `<div class="pn"><p>${e(n.text)}</p><small>${e([n.author, ago(n)].filter(Boolean).join(' · '))}</small>${n.owner === U.email || isAdmin(U) ? `<button type="button" class="x" data-del="${e(n.id)}" aria-label="Notiz entfernen"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`).join('') : '<div class="wg-empty">Noch nichts angepinnt</div>';
                });
            } },
        sticky: { name: 'Notiz', icon: 'fa-note-sticky', c: '#facc15', desc: 'Ein Zettel direkt auf dem Desktop (wird in deinem Profil gespeichert)', sizes: { s: [210, 190], m: [260, 250], l: [330, 330] }, bare: true,
            mount(b, w) {
                b.innerHTML = `<textarea class="wg-sticky" maxlength="2000" placeholder="Schreib was auf …" aria-label="Notiz"></textarea>`;
                const ta = b.firstChild; ta.value = w.text || ''; let t = 0;
                ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { w.text = ta.value; API.save(); }, 500); });
            } },
        cal: { name: 'Kalender', icon: 'fa-calendar-days', c: '#a78bfa', desc: 'Monatsübersicht, Tage mit Terminen sind markiert', sizes: { s: [250, 260], m: [300, 300], l: [340, 340] },
            mount(b, w) {
                let ref = new Date(); ref.setDate(1); let evs = [];
                const draw = () => {
                    const t = localDate(), y = ref.getFullYear(), m = ref.getMonth(), start = new Date(y, m, 1 - ((ref.getDay() + 6) % 7)), last = new Date(start); last.setDate(start.getDate() + 41);
                    const busy = new Set(typeof CAL !== 'undefined' && evs.length ? CAL.expand(evs, localDate(start), localDate(last)).map(o => o.date) : []);
                    let h = ''; for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); const s = localDate(d);
                        h += `<span class="${d.getMonth() !== m ? 'o' : ''}${s === t ? ' t' : ''}${i % 7 > 4 ? ' we' : ''}${holidays(d.getFullYear()).has(s) ? ' ft' : ''}">${d.getDate()}${busy.has(s) ? '<i></i>' : ''}</span>`; }
                    b.innerHTML = `<div class="wg-cal"><div class="nv"><button type="button" data-m="-1" aria-label="Vorheriger Monat"><i class="fa-solid fa-chevron-left"></i></button><b>${ref.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</b><button type="button" data-m="1" aria-label="Nächster Monat"><i class="fa-solid fa-chevron-right"></i></button></div><div class="gr">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(x => `<em>${x}</em>`).join('')}${h}</div></div>`;
                };
                b.addEventListener('click', ev => { const n = ev.target.closest('[data-m]'); if (n) { ref.setMonth(ref.getMonth() + +n.dataset.m); draw(); } });
                draw();
                if (can(U, 'termine')) return use('events', d => { evs = d; draw(); });
            } },
    };

    // ---------- Rahmen: Anlegen, Verschieben, Größe, Entfernen ----------
    const LIVE = new Map();             // id -> Aufräumfunktion
    const allowed = t => !TYPES[t].perm || can(U, TYPES[t].perm);
    const box = () => document.getElementById('widgets');
    const area = () => { const d = document.getElementById('desk'); return { w: d.clientWidth, h: d.clientHeight }; };
    function clampPos(w) { const [ww, wh] = TYPES[w.type].sizes[w.size], a = area(); w.x = Math.max(4, Math.min(a.w - ww - 4, w.x)); w.y = Math.max(4, Math.min(a.h - wh - 4, w.y)); }
    function render() {
        LIVE.forEach(off => { try { off && off(); } catch (x) {} }); LIVE.clear();
        const S = API.state(); S.widgets = (S.widgets || []).filter(w => TYPES[w.type] && allowed(w.type));
        box().innerHTML = '';
        S.widgets.forEach(mount);
    }
    function mount(w) {
        const T = TYPES[w.type]; if (!T.sizes[w.size]) w.size = 'm'; clampPos(w);
        const [ww, wh] = T.sizes[w.size], el = document.createElement('section');
        el.className = `wg wgt-${w.type}${T.bare ? ' bare' : ''}`; el.dataset.id = w.id; el.setAttribute('aria-label', T.name);
        Object.assign(el.style, { left: w.x + 'px', top: w.y + 'px', width: ww + 'px', height: wh + 'px', '--c': T.c });
        el.innerHTML = `<header><i class="fa-solid ${T.icon}"></i><span>${e(T.name)}</span>${T.app && API.hasApp(T.app) ? `<button type="button" class="wg-b" data-a="open" title="${e(API.appName(T.app))} öffnen" aria-label="App öffnen"><i class="fa-solid fa-up-right-from-square"></i></button>` : ''}<button type="button" class="wg-b" data-a="menu" title="Optionen" aria-label="Widget-Optionen"><i class="fa-solid fa-ellipsis"></i></button></header><div class="wg-body"></div>`;
        box().appendChild(el);
        LIVE.set(w.id, T.mount(el.querySelector('.wg-body'), w));
        el.querySelector('header').addEventListener('click', ev => {
            const b = ev.target.closest('[data-a]'); if (!b) return; const r = b.getBoundingClientRect();
            if (b.dataset.a === 'open') return API.openApp(T.app);
            API.ctx(r.left, r.bottom + 4, [
                ['fa-table-cells-large', `Klein${w.size === 's' ? ' ✓' : ''}`, () => resize(w, 's')], ['fa-table-cells-large', `Mittel${w.size === 'm' ? ' ✓' : ''}`, () => resize(w, 'm')], ['fa-table-cells-large', `Groß${w.size === 'l' ? ' ✓' : ''}`, () => resize(w, 'l')], null,
                T.app && API.hasApp(T.app) && ['fa-up-right-from-square', API.appName(T.app) + ' öffnen', () => API.openApp(T.app)],
                ['fa-xmark', 'Widget entfernen', () => remove(w)]]);
        });
        drag(el, w);
    }
    function drag(el, w) {
        el.addEventListener('pointerdown', ev => {
            if (ev.button > 0 || ev.target.closest('button, input, textarea, label, a, select, .lst, .wg-list')) return;
            ev.preventDefault(); el.setPointerCapture(ev.pointerId); API.closePops();
            const sx = ev.clientX, sy = ev.clientY, ox = w.x, oy = w.y; let moved = false;
            const mv = m => { const dx = m.clientX - sx, dy = m.clientY - sy; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true; el.classList.add('dragging');
                w.x = Math.round((ox + dx) / 8) * 8; w.y = Math.round((oy + dy) / 8) * 8; clampPos(w); el.style.left = w.x + 'px'; el.style.top = w.y + 'px'; };
            const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.classList.remove('dragging'); if (moved) { bringFront(w); API.save(); } };
            el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
        });
    }
    function bringFront(w) { const S = API.state(); S.widgets.splice(S.widgets.indexOf(w), 1); S.widgets.push(w); const el = box().querySelector(`[data-id="${w.id}"]`); if (el) box().appendChild(el); }
    function resize(w, size) {
        w.size = size; const S = API.state(), [ww, wh] = TYPES[w.type].sizes[size];
        const overlap = S.widgets.some(o => { if (o === w) return false; const [ow, oh] = TYPES[o.type].sizes[o.size]; return w.x < o.x + ow && w.x + ww > o.x && w.y < o.y + oh && w.y + wh > o.y; });
        if (overlap) { const rest = S.widgets; S.widgets = rest.filter(o => o !== w); Object.assign(w, freeSpot(w.type, size)); S.widgets = rest; }   // größer geworden und verdeckt etwas: freien Platz suchen
        const old = box().querySelector(`[data-id="${w.id}"]`); const off = LIVE.get(w.id); try { off && off(); } catch (x) {} LIVE.delete(w.id); old && old.remove(); mount(w); API.save(); }
    function remove(w) { const S = API.state(), el = box().querySelector(`[data-id="${w.id}"]`); const off = LIVE.get(w.id); try { off && off(); } catch (x) {} LIVE.delete(w.id); S.widgets = S.widgets.filter(x => x !== w); if (el) { el.classList.add('bye'); setTimeout(() => el.remove(), 180); } API.save(); }
    // Freien Platz suchen: von rechts oben nach unten, dann weiter links
    function freeSpot(type, size) {
        const [ww, wh] = TYPES[type].sizes[size], a = area(), S = API.state(), G = 16;
        const hit = (x, y) => S.widgets.some(o => { const [ow, oh] = TYPES[o.type].sizes[o.size]; return x < o.x + ow + 8 && x + ww + 8 > o.x && y < o.y + oh + 8 && y + wh + 8 > o.y; });
        for (let x = a.w - ww - G; x > 240; x -= 40) for (let y = G; y + wh < a.h - 8; y += 24) if (!hit(x, y)) return { x, y };
        return { x: Math.max(240, a.w - ww - G), y: G };
    }
    function add(type, size = 'm') {
        const S = API.state(); S.widgets = S.widgets || [];
        const w = { id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type, size, ...freeSpot(type, size) };
        S.widgets.push(w); mount(w); API.save();
        const el = box().querySelector(`[data-id="${w.id}"]`); if (el) { el.classList.add('new'); setTimeout(() => el.classList.remove('new'), 900); }
    }
    // Auswahl-Fenster "Widgets hinzufügen"
    function picker() {
        const pk = document.getElementById('wg-pick');
        if (!pk.hidden) { pk.hidden = true; return; }
        API.closePops();
        const types = Object.keys(TYPES).filter(allowed), S = API.state();
        pk.innerHTML = `<div class="pk-h"><b>Widgets</b><small>Zum Hinzufügen anklicken. Danach kannst du sie frei verschieben.</small><button type="button" class="pk-x" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="pk-g">${types.map(t => { const T = TYPES[t], n = (S.widgets || []).filter(w => w.type === t).length;
                return `<button type="button" class="pk-i" data-t="${t}" style="--c:${T.c}"><span class="ico-t" style="--c:${T.c}"><i class="fa-solid ${T.icon}"></i></span><span><b>${e(T.name)}</b><small>${e(T.desc)}</small></span>${n ? `<em>${n}× auf dem Desktop</em>` : ''}<i class="fa-solid fa-plus pl"></i></button>`; }).join('')}</div>`;
        pk.hidden = false;
        pk.onclick = ev => { if (ev.target.closest('.pk-x')) { pk.hidden = true; return; } const b = ev.target.closest('[data-t]'); if (b) { add(b.dataset.t); pk.hidden = true; } };
    }
    function defaults() {
        const a = area(), list = [['clock', 'm'], ['weather', 'm'], ...(can(U, 'zeit') ? [['stamp', 'm']] : []), ...(can(U, 'termine') ? [['events', 'm']] : [])];
        const S = API.state(); S.widgets = [];
        list.forEach(([t, s]) => S.widgets.push({ id: 'g' + t, type: t, size: s, ...freeSpot(t, s) }));
        void a;
    }

    window.JMOS_WIDGETS = {
        init(api, user) { API = api; U = user; const S = API.state(); if (!Array.isArray(S.widgets)) defaults(); render(); addEventListener('resize', () => { clearTimeout(this.t); this.t = setTimeout(() => { API.state().widgets.forEach(w => { const el = box().querySelector(`[data-id="${w.id}"]`); clampPos(w); if (el) { el.style.left = w.x + 'px'; el.style.top = w.y + 'px'; } }); }, 200); }); },
        picker, render, TYPES,
    };
})();
