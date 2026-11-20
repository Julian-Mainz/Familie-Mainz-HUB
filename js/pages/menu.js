// js/pages/menu.js - Seiten-Code von /menu.html (ausgelagert, damit der Browser ihn zwischenspeichern kann)
const openModal = id => $(id).classList.remove('hidden'), closeModal = id => $(id).classList.add('hidden');
const run = async fn => { try { await fn(); } catch (e) { alert('Fehler: ' + e.message); } };
const hm = min => `${Math.floor(Math.max(0, min) / 60)}:${String(Math.round(Math.max(0, min)) % 60).padStart(2, '0')} Std`;


let pubEvents = [], myEvents = [], calendarEvents = [], familyNotes = [], familyTodos = [], started = false;
let todoFilter = 'all', todoKind = 'task';

initAuthGuard(user => {
    if (!user || started) return;
    started = true;
    renderDrawer(); initLayout(); setupQuickKinds(); initClock();
    if (can(currentUser, 'termine')) initCalendar();
    if (can(currentUser, 'pinnwand')) initNotes();
    if (can(currentUser, 'aufgaben')) initTodos();
    initStamp(); initWeather();
    if (isAdmin(currentUser)) countPending();
    handleQuickHash();
});

// ---------- Eigene Einstellungen der Startseite (userPrefs.home.*) ----------
const HP = () => (currentUser.userPrefs && currentUser.userPrefs.home) || {};
async function savePref(key, val) {
    currentUser.userPrefs = { ...(currentUser.userPrefs || {}), home: { ...HP(), [key]: val } };
    try { await db.collection('users').doc(currentUser.uid).update({ ['userPrefs.home.' + key]: val }); } catch (e) { toast('Speichern fehlgeschlagen: ' + (e.code || e.message)); }
}
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
// Kleine Einstellungs-Felder in einer Karte auf- und zuklappen
function togglePop(id, btn) {
    const p = $(id), open = p.classList.contains('hidden'); p.classList.toggle('hidden', !open); btn.setAttribute('aria-expanded', open);
    if (open && id === 'wx-loc') setTimeout(() => $('wx-q').focus(), 30);
    Layout.refresh();
}

// ---------- Module anpassen (js/layout.js) ----------
// Kennung: [Name, Breite in Zwölfteln, ausgeblendet]
const WIDGETS = { hero: ['Uhr', 4], stamp: ['Zeiterfassung', 8], weather: ['Wetter', 4], calendar: ['Kalender', 8], todos: ['Aufgaben', 4], notes: ['Pinnwand', 8], upcoming: ['Nächste Termine', 4, true] };
// Welches Recht ein Modul braucht (ohne Eintrag: für alle)
const WIDGET_PERM = { stamp: 'zeit', notes: 'pinnwand', todos: 'aufgaben', upcoming: 'termine', calendar: 'termine' };
const allowed = id => !WIDGET_PERM[id] || can(currentUser, WIDGET_PERM[id]);
const HOME_PRESETS = {
    'Standard': {},
    'Kompakt': { order: ['hero', 'stamp', 'todos', 'calendar', 'weather', 'notes', 'upcoming'], hidden: ['weather', 'notes', 'upcoming'], width: { hero: 4, stamp: 8, todos: 4, calendar: 8 } },
    'Fokus Kalender': { order: ['calendar', 'hero', 'todos', 'upcoming', 'stamp', 'weather', 'notes'], hidden: ['stamp', 'weather', 'notes'], width: { calendar: 12, hero: 4, todos: 4, upcoming: 4 } },
    'Fokus Arbeit': { order: ['stamp', 'hero', 'todos', 'calendar', 'weather', 'notes', 'upcoming'], hidden: ['weather', 'notes', 'upcoming'], width: { stamp: 12, hero: 4, todos: 4, calendar: 4 } }
};
function initLayout() {
    Layout.init({
        key: 'start', root: $('widgets'), toast, presets: HOME_PRESETS,
        modules: Object.entries(WIDGETS).map(([id, [title, w, off]]) => ({ id, title, w, off, el: `[data-w="${id}"]` })),
        save: async l => {
            await db.collection('users').doc(currentUser.uid).update({ 'userPrefs.layouts.start': l });
            currentUser.userPrefs = { ...(currentUser.userPrefs || {}), layouts: { ...((currentUser.userPrefs || {}).layouts || {}), start: l } };
        },
        onEdit: on => { if (on) ['clk-pop', 'wx-loc'].forEach(id => { $(id).classList.add('hidden'); }); }
    });
    // Module ohne Berechtigung bleiben immer verborgen
    Object.keys(WIDGETS).forEach(id => { const el = document.querySelector(`[data-w="${id}"]`); if (el) el.toggleAttribute('data-na', !allowed(id)); });
    Layout.load(currentUser.userPrefs?.layouts?.start);
}

// ---------- Uhr & Begrüßung ----------
const setT = (el, t) => { const n = el.firstChild; if (n && n.nodeType === 3) { if (n.nodeValue !== t) n.nodeValue = t; } else el.textContent = t; };
let lastMinute = -1, clockCfg = { mode: 'both', sec: false };
function initClock() {
    let h = ''; for (let i = 0; i < 60; i++) { const big = i % 5 === 0, a = i * 6 * Math.PI / 180, r1 = big ? 72 : 80, r2 = 86, f = n => n.toFixed(2); h += `<line x1="${f(100 + r1 * Math.sin(a))}" y1="${f(100 - r1 * Math.cos(a))}" x2="${f(100 + r2 * Math.sin(a))}" y2="${f(100 - r2 * Math.cos(a))}" stroke-width="${big ? 3 : 1}" opacity="${big ? .95 : .35}"/>`; }
    $('ticks').innerHTML = h;
    clockCfg = { ...clockCfg, ...(HP().clock || {}) }; applyClock();
    $('clk-modes').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; clockCfg.mode = b.dataset.m; applyClock(); savePref('clock', { ...clockCfg }); });
    $('clk-sec').addEventListener('change', e => { clockCfg.sec = e.target.checked; applyClock(); savePref('clock', { ...clockCfg }); });
    updateClock(); setInterval(() => { if (!document.hidden) updateClock(); }, 1000); document.addEventListener('visibilitychange', () => { if (!document.hidden) updateClock(); });   // im Hintergrund-Tab nicht zeichnen
}
function applyClock() {
    if (!['both', 'digital', 'analog'].includes(clockCfg.mode)) clockCfg.mode = 'both';
    $('clk').className = `clk m-${clockCfg.mode}${clockCfg.sec ? '' : ' nosec'}`; $('clk-sec').checked = !!clockCfg.sec;
    document.querySelectorAll('#clk-modes [data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === clockCfg.mode));
    lastMinute = -1; updateClock(); Layout.refresh();
}
function updateClock() {
    const now = new Date(), s = now.getSeconds(), m = now.getMinutes(), hr = now.getHours();
    setT($('dash-time'), now.toLocaleTimeString('de-DE', clockCfg.sec ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : { hour: '2-digit', minute: '2-digit' }));
    const rot = (id, a) => $(id).setAttribute('transform', `rotate(${a.toFixed(2)} 100 100)`);
    rot('h-h', (hr % 12 + m / 60) * 30); rot('h-m', (m + s / 60) * 6); if (clockCfg.sec) rot('h-s', s * 6);
    if (m !== lastMinute) {
        lastMinute = m;
        $('dash-date').innerText = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        $('dash-week').innerText = 'KW ' + isoWeek(now);
        $('greet').innerText = hr < 5 ? 'Gute Nacht' : hr < 11 ? 'Guten Morgen' : hr < 18 ? 'Guten Tag' : 'Guten Abend';
        $('greet-emoji').innerText = hr < 5 ? '🌙' : hr < 11 ? '☀️' : hr < 18 ? '👋' : '🌆';
        if (calView === 'week' && calReady) renderCal();          // rote Linie "jetzt" mitführen
    }
    if (active) tickStamp();
}
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); }

// ---------- Zeiterfassung (nur Anzeige, gestempelt wird auf der Seite Zeiterfassung) ----------
let workEntries = [], active = null, stOffset = 0;
const W = () => ({ pause: 60, after: 6, weekly: 40, vacation: 30, carry: 0, carryYear: 0, ...(currentUser.userPrefs?.work || {}) });
const dayMin = () => Math.round(W().weekly / 5 * 60);
const hh = min => { const s = min < 0 ? '-' : ''; min = Math.abs(Math.round(min)); return `${s}${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} h`; };
const pDate = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const HOL = {};
function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    return new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, (h + l - 7 * m + 114) % 31 + 1);
}
function holidays(y) {      // gesetzliche Feiertage NRW (wie auf der Seite Zeiterfassung)
    if (HOL[y]) return HOL[y];
    const add = n => { const d = easter(y); d.setDate(d.getDate() + n); return localDate(d); };
    return HOL[y] = new Set([`${y}-01-01`, add(-2), add(1), `${y}-05-01`, add(39), add(50), add(60), `${y}-10-03`, `${y}-11-01`, `${y}-12-25`, `${y}-12-26`]);
}
const isWork = d => d.getDay() % 6 !== 0 && !holidays(d.getFullYear()).has(localDate(d));
function sollMin(from, to) { if (to < from) return 0; let n = 0; for (const d = pDate(from), end = pDate(to); d <= end; d.setDate(d.getDate() + 1)) if (isWork(d)) n++; return n * dayMin(); }
const typeOf = e => e.type || 'work';
const sumNet = (from, to) => workEntries.reduce((a, e) => a + (e.date >= from && e.date <= to ? Number(e.netMinutes) || 0 : 0), 0);
function liveNet() {
    if (!active) return 0; const g = Math.max(0, (Date.now() - active.start) / 60000), p = active.pause ?? W().pause;
    return Math.max(0, g - (g >= W().after * 60 ? p : 0));
}
function initStamp() {
    if (!can(currentUser, 'zeit')) return;
    db.collection('active_work').doc(currentUser.uid).onSnapshot(d => {
        const x = d.exists ? d.data() : null;
        active = x && x.startTime ? { start: x.startTime.toDate(), pause: x.pauseMinutes } : null;
        const on = !!active; $('st-ring').classList.toggle('off', !on);
        $('st-state').innerText = on ? 'Läuft' : 'Nicht eingestempelt';
        $('st-sub').innerText = on ? `seit ${active.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr` : 'Stempeln in der Zeiterfassung';
        if (!on) $('st-timer').innerText = '–';
        tickStamp(); renderStampKpis();
    }, () => {});
    db.collection('worktime').where('owner', '==', currentUser.email).onSnapshot(s => { workEntries = s.docs.map(d => d.data()); renderStampKpis(); }, () => {});
    setInterval(renderStampKpis, 60000);
}
function tickStamp() {
    if (!active) return; const ms = Math.max(0, Date.now() - active.start), p = n => String(n).padStart(2, '0');
    setT($('st-timer'), `${Math.floor(ms / 3600000)}:${p(Math.floor(ms % 3600000 / 60000))}:${p(Math.floor(ms % 60000 / 1000))}`);
    if (new Date().getSeconds() === 0) renderStampKpis();
}
function stWeek(d) { stOffset = Math.min(0, stOffset + d); renderStampKpis(); }
function renderStampKpis() {
    if (!currentUser || !can(currentUser, 'zeit')) return;
    const now = new Date(), today = localDate(now), live = liveNet(), pct = (a, b) => Math.min(100, b ? a / b * 100 : 0) + '%';
    // Heute
    const dIst = sumNet(today, today) + live, dSoll = isWork(now) ? dayMin() : 0;
    setT($('k-day'), hh(dIst)); $('k-day-s').innerText = dSoll ? `von ${hh(dSoll)}` : 'kein Arbeitstag'; $('k-day-b').style.width = pct(dIst, dSoll || dIst);
    // Woche (mit den Pfeilen auch frühere Wochen)
    const mon = new Date(now); mon.setDate(now.getDate() - (now.getDay() + 6) % 7 + stOffset * 7); const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const a = localDate(mon), b = localDate(sun), wIst = sumNet(a, b) + (stOffset === 0 ? live : 0), wSoll = sollMin(a, b);
    const lbl = stOffset === 0 ? 'Diese Woche' : stOffset === -1 ? 'Letzte Woche' : 'KW ' + isoWeek(mon);
    $('st-wl').innerText = lbl; $('k-wk-l').innerText = stOffset === 0 ? 'Diese Woche' : `${lbl} · ${mon.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}–${sun.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`; $('st-wn').disabled = stOffset >= 0;
    setT($('k-wk'), hh(wIst)); $('k-wk-s').innerText = `von ${hh(wSoll)}`; $('k-wk-b').style.width = pct(wIst, wSoll);
    // Überstundenkonto wie auf der Seite Zeiterfassung: Startstand + abgeschlossene Monate (gearbeitet − ausgezahlt)
    const ot = W().ot, cl = W().closings || {}, cur = today.slice(0, 7), otOk = ot && /^\d{4}-\d{2}-\d{2}$/.test(ot.upto || '') && Number.isFinite(+ot.min);
    const addM = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
    const mEnd = ym => `${ym}-${String(new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate()).padStart(2, '0')}`;
    const first = workEntries.reduce((x, e) => (e.date && (!x || e.date < x) ? e.date : x), '');
    if (otOk || first) {
        let acc = otOk ? Math.round(+ot.min) : 0, start = otOk ? addM(ot.upto.slice(0, 7), 1) : first.slice(0, 7), last = '';
        if (otOk && ot.upto < mEnd(ot.upto.slice(0, 7)) && today > mEnd(ot.upto.slice(0, 7))) { const nx = pDate(ot.upto); nx.setDate(nx.getDate() + 1); const f = localDate(nx), me = mEnd(ot.upto.slice(0, 7)); acc += sumNet(f, me) - sollMin(f, me); }
        for (let m = start, i = 0; m <= cur && i < 240; m = addM(m, 1), i++) { const c = cl[m]; if (c && Number.isFinite(+c.paid)) { acc += sumNet(`${m}-01`, mEnd(m)) - Math.round(+c.paid); last = m; } }
        const ml = ym => new Date(+ym.slice(0, 4), +ym.slice(5) - 1, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
        setT($('k-ot'), (acc > 0 ? '+' : '') + hh(acc)); $('k-ot').className = 'v ' + (acc >= 0 ? 'g' : 'r');
        $('k-ot-s').innerText = last ? 'nach ' + ml(last) : otOk ? 'Startstand nach ' + ml(ot.upto.slice(0, 7)) : 'noch kein Monat abgeschlossen';
    } else { setT($('k-ot'), '–'); $('k-ot').className = 'v'; $('k-ot-s').innerText = 'Noch keine Einträge'; }
    // Resturlaub im laufenden Jahr
    const w = W(), y = now.getFullYear(), total = w.vacation + (w.carryYear === y ? w.carry : 0);
    const used = new Set(workEntries.filter(e => typeOf(e) === 'vacation' && e.date && e.date.startsWith(String(y))).map(e => e.date)).size + Math.max(0, +((w.vacPre || {})[y]) || 0), left = total - used, nf = n => String(n).replace('.', ',');
    setT($('k-vac'), `${nf(left)} ${Math.abs(left) === 1 ? 'Tag' : 'Tage'}`); $('k-vac').className = 'v ' + (left < 0 ? 'r' : 'b'); $('k-vac-s').innerText = `von ${nf(total)} Tagen`;
}

// ---------- Wetter (Ort frei wählbar) ----------
const WX = [[0, 'Klar', 'fa-sun', '#fbbf24'], [3, 'Leicht bewölkt', 'fa-cloud-sun', '#fcd34d'], [48, 'Nebelig', 'fa-smog', '#94a3b8'], [67, 'Regnerisch', 'fa-cloud-rain', '#22d3ee'],
    [77, 'Schnee', 'fa-snowflake', '#a5b4fc'], [82, 'Regenschauer', 'fa-cloud-showers-heavy', '#22d3ee'], [86, 'Schneeschauer', 'fa-snowflake', '#a5b4fc'], [99, 'Gewitter', 'fa-cloud-bolt', '#f59e0b']];
const wx = c => WX.find(w => c <= w[0]) || WX[WX.length - 1];
const DEF_LOC = { name: 'Düren', sub: 'Nordrhein-Westfalen, Deutschland', lat: 50.8021, lon: 6.4836 };
const loc = () => { const l = HP().weather; return l && isFinite(l.lat) && isFinite(l.lon) ? l : DEF_LOC; };
let wxHits = [], wxTimer = 0, wxSeq = 0;
function initWeather() {
    loadWeather(); setInterval(loadWeather, 30 * 60000);
    $('wx-q').addEventListener('input', () => { clearTimeout(wxTimer); wxTimer = setTimeout(searchPlace, 280); });
    $('wx-q').addEventListener('keydown', e => {
        const items = [...$('wx-res').querySelectorAll('.lr')], i = items.indexOf(document.activeElement);
        if (e.key === 'Enter') { e.preventDefault(); if (wxHits[0]) pickPlace(0); }
        else if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); items[0].focus(); }
        else if (e.key === 'Escape') togglePop('wx-loc', $('wx-gear'));
        void i;
    });
    $('wx-res').addEventListener('keydown', e => {
        const items = [...$('wx-res').querySelectorAll('.lr')], i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[i]).focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || $('wx-q')).focus(); }
    });
    $('wx-res').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) pickPlace(+b.dataset.i); });
}
async function searchPlace() {
    const q = $('wx-q').value.trim(), seq = ++wxSeq, box = $('wx-res');
    if (q.length < 2) { wxHits = []; box.innerHTML = ''; Layout.refresh(); return; }
    try {
        const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=de&format=json`)).json();
        if (seq !== wxSeq) return;
        wxHits = (j.results || []).map(r => ({ name: r.name, sub: [r.admin1, r.country].filter(Boolean).join(', '), lat: +r.latitude.toFixed(4), lon: +r.longitude.toFixed(4) }));
        box.innerHTML = wxHits.length ? wxHits.map((h, i) => `<button type="button" role="option" class="lr${i ? '' : ' on'}" data-i="${i}"><b>${esc(h.name)}</b><small>${esc(h.sub)}</small></button>`).join('') : '<div class="lnote">Kein Ort gefunden.</div>';
    } catch (e) { if (seq === wxSeq) box.innerHTML = '<div class="lnote">Suche gerade nicht erreichbar.</div>'; }
    Layout.refresh();
}
async function setPlace(p) {
    await savePref('weather', p); $('wx-q').value = ''; $('wx-res').innerHTML = ''; wxHits = [];
    $('wx-loc').classList.add('hidden'); $('wx-gear').setAttribute('aria-expanded', 'false'); loadWeather(); toast('Standort: ' + p.name);
}
function pickPlace(i) { const h = wxHits[i]; if (h) setPlace(h); }
function useMyLocation() {
    if (!navigator.geolocation) return toast('Dein Browser kann den Standort nicht bestimmen.');
    navigator.geolocation.getCurrentPosition(p => setPlace({ name: 'Mein Standort', sub: 'Gerätestandort (auf ca. 1 km gerundet)', lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2) }),
        e => toast(e.code === 1 ? 'Standort-Zugriff wurde nicht erlaubt.' : 'Standort konnte nicht bestimmt werden.'), { timeout: 12000, maximumAge: 600000 });
}
async function loadWeather() {
    const l = loc(); $('wx-name').innerText = l.name; $('wx-name').title = l.sub || '';
    try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${l.lat}&longitude=${l.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=4&timezone=auto`);
        const j = await r.json(), c = j.current, d = j.daily, w = wx(c.weather_code);
        $('weather-temp').innerText = `${Math.round(c.temperature_2m)} °C`; $('weather-condition').innerText = w[1]; $('weather-icon').className = `fa-solid ${w[2]} sun`; $('weather-icon').style.color = w[3];
        $('weather-wind').innerText = `${Math.round(c.wind_speed_10m)} km/h`; $('weather-hum').innerText = `${c.relative_humidity_2m} %`; $('weather-rain').innerText = `${d.precipitation_probability_max[0] ?? '–'} %`;
        $('forecast').innerHTML = [1, 2, 3].map(i => { const f = wx(d.weather_code[i]);
            return `<div>${new Date(d.time[i] + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short' })}<i class="fa-solid ${f[2]}" style="color:${f[3]}" title="${f[1]}"></i><b>${Math.round(d.temperature_2m_max[i])}° <span>/ ${Math.round(d.temperature_2m_min[i])}°</span></b></div>`; }).join('');
    } catch (e) { $('weather-condition').innerText = 'Wetter offline'; }
}

// ---------- Kalender: Woche, Monat, Liste ----------
const evOf = id => calendarEvents.find(e => e.id === id);
const pad2 = n => String(n).padStart(2, '0');
// Symbol und Farbe eines Termins aus dem Titel (Arzt, Sport, Geburtstag …)
const EVK = [[/geburtstag|b-?day|jubil/i, 'fa-cake-candles', '#a78bfa'], [/arzt|ärzt|physio|zahn|praxis|klinik|kranken|therap|impf/i, 'fa-heart-pulse', '#f472b6'],
    [/gym|training|sport|fitness|lauf|joggen|fußball|schwimm|yoga|rad/i, 'fa-dumbbell', '#22d3ee'], [/essen|mittag|frühstück|brunch|restaurant|grill|kaffee|café/i, 'fa-utensils', '#fb923c'],
    [/einkauf|shopping|markt|besorg/i, 'fa-cart-shopping', '#34d399'], [/urlaub|reise|flug|ferien|trip|hotel/i, 'fa-plane', '#38bdf8'],
    [/schule|kita|uni|prüfung|klausur|kurs|seminar/i, 'fa-graduation-cap', '#facc15'], [/party|feier|hochzeit|fest|konzert|kino/i, 'fa-champagne-glasses', '#f472b6'],
    [/arbeit|meeting|büro|besprechung|call|schicht|dienst/i, 'fa-briefcase', '#94a3b8'], [/auto|werkstatt|tüv|reifen/i, 'fa-car', '#94a3b8']];
const evStyle = o => { const k = EVK.find(x => x[0].test(o.title || '')), c = CAL.colorOf(o); return k ? [k[1], c || k[2]] : ['fa-calendar-day', c || (o.isPublic ? '#818cf8' : '#a78bfa')]; };
const tm = t => { const [h, m] = String(t).split(':').map(Number); return (h || 0) + (m || 0) / 60; };
const endOf = o => { const s = tm(o.time); let e = o.endTime ? tm(o.endTime) : s + 1; if (e <= s) e = Math.min(24, s + 1); return e; };
const dShort = s => pDate(s).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const dayLbl = s => { const t = localDate(); return s === t ? 'Heute' : s === CAL.addDays(t, 1) ? 'Morgen' : pDate(s).toLocaleDateString('de-DE', { weekday: 'short' }) + (s > CAL.addDays(t, 6) ? ' ' + pDate(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : ''); };
const dow = s => pDate(s).getDay();
let calView = 'week', calRef = localDate(), calNarrow = false, calReady = false;

function initCalendar() {
    const merge = () => { const m = new Map(); [...pubEvents, ...myEvents].forEach(ev => m.set(ev.id, ev)); calendarEvents = [...m.values()]; renderCal(); renderUpcoming(); };
    const list = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
    db.collection('events').where('isPublic', '==', true).onSnapshot(s => { pubEvents = list(s); merge(); }, () => renderCal());
    db.collection('events').where('owner', '==', currentUser.email).onSnapshot(s => { myEvents = list(s); merge(); }, () => renderCal());
    const v = lsGet('home_calview'); calView = ['week', 'month', 'list'].includes(v) ? v : 'week';
    $('cal-tabs').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) setCalView(b.dataset.v); });
    $('cal-prev').onclick = () => calShift(-1); $('cal-next').onclick = () => calShift(1); $('cal-today').onclick = () => { calRef = localDate(); renderCal(); };
    const open = e => { const v = e.target.closest('[data-ev]'); if (v) { openEditEvent(v.dataset.ev, v.dataset.occ); return true; } };
    $('cal-body').addEventListener('click', e => {
        if (open(e)) return; const a = e.target.closest('[data-add]'); if (a) return openEventModal(a.dataset.add);
        const col = e.target.closest('.wcol'); if (!col) return;         // Klick in eine freie Stelle der Woche: neuer Termin zu dieser Uhrzeit
        const r = col.getBoundingClientRect(), ph = +col.dataset.ph, h = +col.dataset.from + Math.floor((e.clientY - r.top) / ph * 2) / 2;
        openEventModal(col.dataset.d, `${pad2(Math.floor(h))}:${h % 1 ? '30' : '00'}`);
    });
    ['nx-list', 'up-list'].forEach(id => $(id).addEventListener('click', open));
    $('evdel-btns').addEventListener('click', e => { const b = e.target.closest('[data-scope]'); if (b) doDeleteEvent(b.dataset.scope); });
    // Schmale Karte: Woche zeigt 3 Tage
    new ResizeObserver(() => { const n = $('cal-body').clientWidth < 400; if (n !== calNarrow) { calNarrow = n; if (calView === 'week') renderCal(); } }).observe($('cal-body'));
    calReady = true; renderCal();
}
function setCalView(v) { calView = v; lsSet('home_calview', v); calRef = localDate(); renderCal(); }
function calShift(d) {
    if (calView === 'month') { const x = pDate(calRef); x.setDate(1); x.setMonth(x.getMonth() + d); calRef = localDate(x); }
    else calRef = CAL.addDays(calRef, d * (calNarrow ? 3 : 7));
    renderCal();
}
function renderCal() {
    document.querySelectorAll('#cal-tabs [data-v]').forEach(b => { b.classList.toggle('on', b.dataset.v === calView); b.setAttribute('aria-selected', b.dataset.v === calView); });
    ['cal-prev', 'cal-next', 'cal-today'].forEach(id => { $(id).hidden = calView === 'list'; });
    if (calView === 'month') renderMonth(); else if (calView === 'list') renderList(); else renderWeek();
    Layout.refresh();
}
function renderWeek() {
    const n = calNarrow ? 3 : 7, start = n === 7 ? CAL.addDays(calRef, -((dow(calRef) + 6) % 7)) : calRef, days = Array.from({ length: n }, (_, i) => CAL.addDays(start, i));
    const today = localDate(), occ = CAL.expand(calendarEvents, days[0], days[n - 1]), timed = occ.filter(o => o.time), allday = occ.filter(o => !o.time);
    let from = 6, to = 22; timed.forEach(o => { from = Math.min(from, Math.floor(tm(o.time))); to = Math.max(to, Math.ceil(endOf(o))); }); to = Math.min(24, to);
    const PH = 30, H = (to - from) * PH, px = h => (h - from) * PH, s0 = pDate(days[0]), s1 = pDate(days[n - 1]);
    const f = (d, o) => d.toLocaleDateString('de-DE', o);
    $('cal-title').innerText = n === 7 ? `KW ${isoWeek(s0)} · ${f(s0, { day: '2-digit' })}. – ${f(s1, { day: '2-digit', month: 'long', year: 'numeric' })}` : `${f(s0, { day: '2-digit', month: '2-digit' })} – ${f(s1, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    const cols = `44px repeat(${n}, minmax(0, 1fr))`;
    let h = `<div class="wgrid" style="grid-template-columns:${cols}"><div></div>` + days.map(d => `<div class="dh${d === today ? ' td' : ''}${[0, 6].includes(dow(d)) ? ' we' : ''}">${f(pDate(d), { weekday: 'short' })}<small>${f(pDate(d), { day: '2-digit', month: '2-digit' })}</small></div>`).join('');
    if (allday.length) h += '<div class="adl">ganzt.</div>' + days.map(d => `<div class="wad">${allday.filter(o => o.date === d).map(o => { const [, c] = evStyle(o); return `<button type="button" data-ev="${esc(o.id)}" data-occ="${o.date}" style="--ec:${c}" title="${esc(o.title)}">${esc(o.title)}</button>`; }).join('')}</div>`).join('');
    h += `<div class="tl" style="height:${H}px">${Array.from({ length: to - from + 1 }, (_, i) => from + i).filter(x => x % 2 === 0 && x < 24).map(x => `<span style="top:${px(x)}px">${pad2(x)}:00</span>`).join('')}</div>`;
    const nowH = new Date().getHours() + new Date().getMinutes() / 60;
    h += days.map(d => {
        const ev = lanes(timed.filter(o => o.date === d), PH);
        return `<div class="wcol${d === today ? ' td' : ''}" style="height:${H}px;--ph:${PH}px" data-d="${d}" data-from="${from}" data-ph="${PH}" title="Klicken für einen neuen Termin">${ev.map(x => { const [, c] = evStyle(x.o), t = Math.max(38, (x.e0 - x.s) * PH);
            return `<button type="button" class="ev" data-ev="${esc(x.o.id)}" data-occ="${x.o.date}" style="--ec:${c};top:${px(x.s)}px;height:${t - 2}px;left:calc(${x.lane / x.n * 100}% + 3px);width:calc(${100 / x.n}% - 6px)" title="${esc(x.o.title)} · ${esc(CAL.timeLabel(x.o))}"><b>${esc(x.o.title)}</b><span>${esc(CAL.timeLabel(x.o))}</span></button>`; }).join('')}${d === today && nowH >= from && nowH <= to ? `<div class="now" style="top:${px(nowH)}px"></div>` : ''}</div>`;
    }).join('');
    $('cal-body').innerHTML = h + '</div>';
}
// Überschneidende Termine nebeneinander legen
function lanes(list, PH) {
    const out = []; let cl = [], end = -1;
    const flush = () => { const n = Math.max(1, ...cl.map(x => x.lane + 1)); cl.forEach(x => { x.n = n; }); cl = []; end = -1; };
    list.sort((a, b) => tm(a.time) - tm(b.time)).forEach(o => {
        const s = tm(o.time), e0 = endOf(o), e = Math.max(e0, s + 38 / PH);
        if (cl.length && s >= end) flush();
        const used = cl.filter(x => x.e > s).map(x => x.lane); let l = 0; while (used.includes(l)) l++;
        const it = { o, s, e, e0, lane: l, n: 1 }; cl.push(it); out.push(it); end = Math.max(end, e);
    });
    if (cl.length) flush(); return out;
}
function renderMonth() {
    const r = pDate(calRef), y = r.getFullYear(), mo = r.getMonth(), today = localDate();
    $('cal-title').innerText = new Date(y, mo, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    const first = (new Date(y, mo, 1).getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate();
    const byDay = {}; CAL.expand(calendarEvents, `${y}-${pad2(mo + 1)}-01`, `${y}-${pad2(mo + 1)}-${pad2(days)}`).forEach(o => (byDay[o.date] = byDay[o.date] || []).push(o));
    let h = '<div class="cal-d pad"></div>'.repeat(first);
    for (let d = 1; d <= days; d++) {
        const ds = `${y}-${pad2(mo + 1)}-${pad2(d)}`, we = [0, 6].includes(new Date(y, mo, d).getDay());
        const evs = (byDay[ds] || []).map(o => `<div data-ev="${esc(o.id)}" data-occ="${o.date}" title="${esc(o.title)}${o.time ? ' · ' + esc(CAL.timeLabel(o)) : ''}" class="cal-e" style="--ec:${evStyle(o)[1]}">${o.time ? `<b>${esc(o.time)}</b>` : ''}<span>${esc(o.title)}</span></div>`).join('');
        h += `<div class="cal-d${we ? ' we' : ''}${ds === today ? ' today' : ''}"><div class="cal-n"><b>${d}</b><button data-add="${ds}" title="Termin hinzufügen" aria-label="Termin am ${d}. hinzufügen"><i class="fa-solid fa-plus"></i></button></div><div class="cal-es">${evs}</div></div>`;
    }
    $('cal-body').innerHTML = `<div class="cal-wrap"><div class="cal-in"><div class="cal-h"><div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div></div><div class="cal-g">${h}</div></div></div>`;
}
function renderList() {
    const today = localDate(), list = upcoming(CAL.expand(calendarEvents, today, CAL.addDays(today, 90))).slice(0, 80);
    $('cal-title').innerText = 'Die nächsten 90 Tage';
    const by = []; list.forEach(o => { const g = by[by.length - 1]; if (g && g.d === o.date) g.l.push(o); else by.push({ d: o.date, l: [o] }); });
    $('cal-body').innerHTML = by.length ? by.map(g => `<div class="lday"><h4${g.d === today ? ' class="td"' : ''}>${g.d === today ? 'Heute · ' : g.d === CAL.addDays(today, 1) ? 'Morgen · ' : ''}${pDate(g.d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</h4>${g.l.map(neRow).join('')}</div>`).join('') : '<div class="empty">Keine Termine in den nächsten 90 Tagen.</div>';
}
// Vorbei ist vorbei: heutige Termine verschwinden, wenn sie zu Ende sind
function upcoming(list) { const t = localDate(), n = new Date(), now = n.getHours() + n.getMinutes() / 60; return list.filter(o => o.date !== t || !o.time || endOf(o) > now); }
function neRow(o) {
    const [ic, c] = evStyle(o);
    return `<button type="button" class="ne" style="--ec:${c}" data-ev="${esc(o.id)}" data-occ="${o.date}"><span class="ei"><i class="fa-solid ${ic}"></i></span><div><small>${dayLbl(o.date)} · ${o.time ? esc(CAL.timeLabel(o)) : 'ganztägig'}${o.recurring ? ' · <i class="fa-solid fa-repeat"></i>' : ''}</small><b>${esc(o.title)}</b></div></button>`;
}
function renderUpcoming() {
    const list = upcoming(CAL.nextOccurrences(calendarEvents, localDate(), 12, 120)), html = n => (list.length ? list.slice(0, n).map(neRow).join('') : '<div class="empty">Keine anstehenden Termine.</div>');
    $('nx-list').innerHTML = html(4); $('up-list').innerHTML = html(8); Layout.refresh();
}
setInterval(() => { if (calendarEvents.length) renderUpcoming(); }, 5 * 60000);

// ---------- Schnell-Erfassung ----------
const QK = { task: ['Neue Aufgabe...', 'Aufgabe'], shop: ['Einkauf, z. B. Milch...', 'Einkauf'], note: ['Notiz an die Pinnwand...', 'Notiz'], event: ['Titel des Termins...', 'Termin'] };
let quickKind = 'task';
function setQuick(k) {
    quickKind = k;
    document.querySelectorAll('#q-kinds [data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    $('q-text').placeholder = QK[k][0]; $('q-event-opts').classList.toggle('hidden', k !== 'event');
}
// Welches Recht eine Art der Schnell-Erfassung braucht
const KIND_PERM = { task: 'aufgaben', shop: 'aufgaben', note: 'pinnwand', event: 'termine' };
const allowedKinds = () => Object.keys(KIND_PERM).filter(k => can(currentUser, KIND_PERM[k]));
function setupQuickKinds() {
    document.querySelectorAll('#q-kinds [data-k]').forEach(b => b.classList.toggle('hidden', !can(currentUser, KIND_PERM[b.dataset.k])));
    $('fab').classList.toggle('hidden', !allowedKinds().length);
    if (!allowedKinds().includes(quickKind)) quickKind = allowedKinds()[0] || 'task';
}
function openQuick(kind) { const ak = allowedKinds(); if (!ak.length) return; kind = ak.includes(kind) ? kind : (ak.includes(quickKind) ? quickKind : ak[0]); setQuick(QK[kind] ? kind : quickKind); $('q-text').value = ''; $('q-date').value = localDate(); $('q-time').value = ''; openModal('modal-quick'); setTimeout(() => $('q-text').focus(), 40); }
async function saveQuick(e) {
    e.preventDefault();
    const text = $('q-text').value.trim(); if (!text) return;
    const base = { owner: currentUser.email, createdAt: TS() };
    try {
        if (quickKind === 'task' || quickKind === 'shop') await db.collection('todos').add({ text, kind: quickKind, done: false, author: currentUser.firstName, ...base });
        else if (quickKind === 'note') await db.collection('notes').add({ text, author: currentUser.firstName, ...base });
        else await db.collection('events').add({ title: text, date: $('q-date').value, time: $('q-time').value || '', isPublic: $('q-public').checked, ...base });
        logSystemEvent('data', quickKind === 'event' ? 'Termin erstellt' : 'Schnell-Erfassung: ' + QK[quickKind][1]);
        closeModal('modal-quick'); toast(QK[quickKind][1] + ' gespeichert ✓');
    } catch (err) { alert('Fehler: ' + err.message); }
}
function toast(msg) { UX.toast(msg); }
// Aus der Suche: /menu.html#neu-task usw. öffnet die Schnell-Erfassung
function handleQuickHash() { const m = /^#neu-(task|shop|note|event)$/.exec(location.hash); if (m) { history.replaceState(null, '', location.pathname); openQuick(m[1]); } }
window.addEventListener('hashchange', handleQuickHash);
const MODALS = ['modal-event', 'modal-quick', 'modal-settings', 'search-box'];
const anyModal = () => MODALS.some(id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); });
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal('modal-quick'); return; }
    if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !anyModal()) { e.preventDefault(); openQuick(); }
});

async function countOf(q) { try { return (await q.count().get()).data().count; } catch (e) { try { return (await q.get()).size; } catch (e2) { return 0; } } }
async function countPending() {
    const [p, m] = await Promise.all([countOf(db.collection('users').where('status', '==', 'pending')), countOf(db.collection('contact_messages').where('read', '==', false))]);
    const parts = [];
    if (p) parts.push(p === 1 ? '1 Konto wartet auf Freigabe' : `${p} Konten warten auf Freigabe`);
    if (m) parts.push(m === 1 ? '1 neue Nachricht' : `${m} neue Nachrichten`);
    if (!parts.length) return;
    $('pending-text').innerText = parts.join(' · '); $('pending-banner').href = p ? '/admin.html#users' : '/admin.html#messages';
    $('pending-banner').classList.remove('hidden');
}

// ---------- Termin anlegen, ansehen, bearbeiten, löschen ----------
// ---------- Termin anlegen, ansehen, bearbeiten, löschen ----------
const UNITS = { daily: 'Tag(e)', weekly: 'Woche(n)', monthly: 'Monat(e)', yearly: 'Jahr(e)' };
function toggleAllDay() { $('ev-times').classList.toggle('hidden', $('ev-allday').checked); }
function toggleRepeat() { const r = $('ev-repeat').value; $('ev-repeat-opts').classList.toggle('hidden', r === 'none'); $('ev-int-wrap').classList.toggle('hidden', r === 'workdays'); if (UNITS[r]) $('ev-unit').textContent = UNITS[r]; }
// Farbauswahl: "Automatisch" (nach Titel) oder eine feste Farbe
$('ev-cols').innerHTML = `<label title="Automatisch nach Titel"><input type="radio" name="evcol" value="" aria-label="Automatisch nach Titel"><span class="sw auto"><i class="fa-solid fa-wand-magic-sparkles"></i></span></label>`
    + CAL.COLORS.map(([c, n]) => `<label title="${n}"><input type="radio" name="evcol" value="${c}" aria-label="${n}"><span class="sw" style="--c:${c}"><i class="fa-solid fa-check"></i></span></label>`).join('');
const setEvColor = c => { const r = document.querySelector(`input[name="evcol"][value="${CAL.colorOf({ color: c }) || ''}"]`); if (r) r.checked = true; };
function setEventForm(f, readOnly) {
    $('ev-title').value = f.title || ''; $('ev-date').value = f.date || ''; $('ev-allday').checked = !f.time; $('ev-time').value = f.time || ''; $('ev-end').value = f.endTime || '';
    $('ev-repeat').value = CAL.isRecurring(f) ? f.repeat : 'none'; $('ev-interval').value = f.interval || 1; $('ev-until').value = f.until || ''; $('ev-public').checked = f.isPublic !== false; setEvColor(f.color);
    toggleAllDay(); toggleRepeat(); $('ev-repeat-box').classList.remove('hidden'); $('ev-date-label').textContent = 'Datum';
    $('ev-form').querySelectorAll('input:not([type=hidden]), select').forEach(el => { el.disabled = readOnly; });
}
function openEventModal(d = '', time = '') {
    $('ev-heading').textContent = 'Neuen Termin eintragen'; $('ev-id').value = ''; $('ev-occ').value = '';
    setEventForm({ date: d || localDate(), time, isPublic: true }, false);
    $('ev-scope').classList.add('hidden'); $('ev-del').classList.add('hidden'); $('ev-ro').classList.add('hidden'); $('ev-save').classList.remove('hidden');
    openModal('modal-event'); setTimeout(() => $('ev-title').focus(), 40);
}
function openEditEvent(id, occ) {
    const ev = evOf(id); if (!ev) return;
    const mine = ev.owner === currentUser.email, rec = CAL.isRecurring(ev);
    $('ev-heading').textContent = mine ? 'Termin bearbeiten' : 'Termin';
    $('ev-id').value = id; $('ev-occ').value = occ || ev.date; setEventForm(ev, !mine);
    $('ev-scope').classList.toggle('hidden', !(mine && rec));
    if (rec) { document.querySelector('input[name="evscope"][value="all"]').checked = true; $('ev-scope-info').textContent = '(' + CAL.repeatLabel(ev) + ')'; }
    $('ev-del').classList.toggle('hidden', !mine); $('ev-save').classList.toggle('hidden', !mine); $('ev-ro').classList.toggle('hidden', mine);
    applyScope(); openModal('modal-event');
}
// Bei Serien: "Nur diesen Termin" ändert genau dieses Vorkommen, "Ganze Serie" den Beginn und die Regel der Serie
function applyScope() {
    const ev = $('ev-id').value && evOf($('ev-id').value);
    if (!ev || !CAL.isRecurring(ev) || $('ev-scope').classList.contains('hidden')) return;
    const one = document.querySelector('input[name="evscope"]:checked').value === 'one';
    $('ev-date').value = one ? $('ev-occ').value : ev.date; $('ev-date-label').textContent = one ? 'Datum dieses Termins' : 'Beginn der Serie'; $('ev-repeat-box').classList.toggle('hidden', one);
}
function readEventForm() {
    const allDay = $('ev-allday').checked, rep = $('ev-repeat').value;
    return { title: $('ev-title').value.trim(), date: $('ev-date').value, time: allDay ? '' : $('ev-time').value, endTime: allDay ? '' : $('ev-end').value, isPublic: $('ev-public').checked,
        repeat: rep, interval: rep === 'none' || rep === 'workdays' ? 1 : Math.max(1, Math.min(99, parseInt($('ev-interval').value, 10) || 1)), until: rep === 'none' ? '' : $('ev-until').value,
        color: CAL.colorOf({ color: (document.querySelector('input[name="evcol"]:checked') || {}).value }) };
}
function saveCalendarEvent(e) {
    e.preventDefault();
    const id = $('ev-id').value, occ = $('ev-occ').value, f = readEventForm(), err = CAL.validate(f);
    if (err) return alert(err);
    const owner = currentUser.email;
    run(async () => {
        if (!id) { await db.collection('events').add({ ...f, owner, createdAt: TS() }); logSystemEvent('data', 'Termin erstellt', { title: f.title, date: f.date, repeat: f.repeat }); }
        else {
            const ev = evOf(id), one = ev && CAL.isRecurring(ev) && document.querySelector('input[name="evscope"]:checked').value === 'one';
            if (one) {      // nur dieses Vorkommen: Serie überspringt den Tag, dafür entsteht ein eigener Einzeltermin
                const b = db.batch();
                b.update(db.collection('events').doc(id), { ...CAL.deleteOne(ev, occ).data, updatedAt: TS() });
                b.set(db.collection('events').doc(), { ...f, repeat: 'none', interval: 1, until: '', owner, createdAt: TS() });
                await b.commit();
            } else await db.collection('events').doc(id).update({ ...f, updatedAt: TS() });
            logSystemEvent('data', 'Termin geändert', { id, nurDieser: !!one });
        }
        closeModal('modal-event');
    });
}
async function askDeleteEvent() {
    const id = $('ev-id').value, ev = evOf(id); if (!ev) return;
    if (!CAL.isRecurring(ev)) { if ((await uiConfirm('Diesen Termin wirklich löschen?', { danger: true, ok: 'Löschen' }))) doDeleteEvent('all'); return; }
    $('evdel-text').textContent = `„${ev.title}“ wiederholt sich (${CAL.repeatLabel(ev)}). Was soll gelöscht werden?`; openModal('modal-evdel');
}
function doDeleteEvent(scope) {
    const id = $('ev-id').value, occ = $('ev-occ').value, ev = evOf(id); if (!ev) return;
    run(async () => {
        const r = scope === 'one' ? CAL.deleteOne(ev, occ) : scope === 'following' ? CAL.deleteFollowing(ev, occ) : { op: 'delete' };
        const ref = db.collection('events').doc(id);
        if (r.op === 'delete') await ref.delete(); else await ref.update({ ...r.data, updatedAt: TS() });
        closeModal('modal-evdel'); closeModal('modal-event'); logSystemEvent('data', 'Termin gelöscht', { id, umfang: scope });
    });
}

// ---------- Pinnwand ----------
function initNotes() {
    db.collection('notes').orderBy('createdAt', 'desc').onSnapshot(s => {
        familyNotes = s.docs.map(d => ({ id: d.id, ...d.data() })); $('note-count').innerText = familyNotes.length;
        const when = n => { const d = n.createdAt && n.createdAt.toDate ? n.createdAt.toDate() : null; if (!d) return ''; const ds = localDate(d); return ' · ' + (ds === localDate() ? 'heute' : ds === CAL.addDays(localDate(), -1) ? 'gestern' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })); };
        $('notes-list').innerHTML = familyNotes.length ? familyNotes.map(n => `<div>${esc(n.text)}<small>${esc(n.author || 'Mitglied')}${when(n)}</small>
            ${n.owner === currentUser.email || isAdmin(currentUser) ? `<button data-del="${esc(n.id)}" class="xd" title="Löschen" aria-label="Notiz löschen"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`).join('') : '<p class="empty">Keine Notizen vorhanden.</p>';
        Layout.refresh();
    }, () => {});
    $('notes-list').addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) run(() => db.collection('notes').doc(d.dataset.del).delete()); });
}
function saveNewNote(e) {
    e.preventDefault(); const i = $('new-note-input'), text = i.value.trim(); if (!text) return;
    run(async () => { await db.collection('notes').add({ text, author: currentUser.firstName, owner: currentUser.email, createdAt: TS() }); i.value = ''; });
}

// ---------- Aufgaben & Einkauf ----------
const kindOf = t => t.kind || 'task';
function initTodos() {
    db.collection('todos').orderBy('createdAt', 'desc').onSnapshot(s => { familyTodos = s.docs.map(d => ({ id: d.id, ...d.data() })); renderTodos(); }, () => {});
    $('todos-list').addEventListener('change', e => { if (e.target.dataset.id) run(() => db.collection('todos').doc(e.target.dataset.id).update({ done: e.target.checked })); });
    $('todos-list').addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) run(() => db.collection('todos').doc(d.dataset.del).delete()); });
    $('todo-filters').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) setFilter(b.dataset.f); });
    $('new-todo-input').addEventListener('keydown', e => { if (e.key === 'Escape') hideTodoForm(); });
}
function renderTodos() {
    const list = familyTodos.filter(t => todoFilter === 'all' || kindOf(t) === todoFilter).sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
    $('todo-count').innerText = familyTodos.filter(t => !t.done && (todoFilter === 'all' || kindOf(t) === todoFilter)).length;
    $('todos-list').innerHTML = list.length ? list.map(t => { const shop = kindOf(t) === 'shop';
        return `<div class="tk${t.done ? ' done' : ''}"><label title="${esc(t.author ? 'von ' + t.author : '')}"><input type="checkbox" data-id="${esc(t.id)}" ${t.done ? 'checked' : ''} aria-label="${esc(t.text)} erledigt"><span class="cb"><i class="fa-solid fa-check"></i></span><span class="tx">${esc(t.text)}</span></label>
        ${shop ? '<i class="fa-solid fa-cart-shopping tg" style="--tc:#facc15" title="Einkauf"></i>' : ''}<button data-del="${esc(t.id)}" class="xd" title="Löschen" aria-label="${esc(t.text)} löschen"><i class="fa-solid fa-xmark"></i></button></div>`; }).join('')
        : `<p class="empty">${todoFilter === 'shop' ? 'Nichts auf der Einkaufsliste.' : 'Alles erledigt! 🎉'}</p>`;
    Layout.refresh();
}
function setFilter(f) {
    todoFilter = f; document.querySelectorAll('#todo-filters [data-f]').forEach(c => c.classList.toggle('on', c.dataset.f === f));
    $('todo-add').querySelector('span').innerText = f === 'shop' ? 'Einkauf hinzufügen' : 'Aufgabe hinzufügen'; renderTodos();
}
function setKind(k) {
    todoKind = k;
    $('kind-btn').innerHTML = `<i class="fa-solid ${k === 'shop' ? 'fa-cart-shopping' : 'fa-circle-check'}" style="color:${k === 'shop' ? '#facc15' : '#34d399'}"></i>`;
    $('new-todo-input').placeholder = k === 'shop' ? 'Einkauf, z. B. Milch …' : 'Neue Aufgabe …';
}
const toggleKind = () => setKind(todoKind === 'task' ? 'shop' : 'task');
function showTodoForm() { setKind(todoFilter === 'shop' ? 'shop' : 'task'); $('todo-add').classList.add('hidden'); $('todo-form').classList.remove('hidden'); $('new-todo-input').focus(); Layout.refresh(); }
function hideTodoForm() { $('todo-form').classList.add('hidden'); $('todo-add').classList.remove('hidden'); $('new-todo-input').value = ''; Layout.refresh(); }
function saveNewTodo(e) {
    e.preventDefault(); const i = $('new-todo-input'), text = i.value.trim(); if (!text) return;
    run(async () => { await db.collection('todos').add({ text, kind: todoKind, done: false, author: currentUser.firstName, owner: currentUser.email, createdAt: TS() }); i.value = ''; i.focus(); });
}
async function clearDone() {
    const done = familyTodos.filter(t => t.done && (todoFilter === 'all' || kindOf(t) === todoFilter));
    if (!done.length) return toast('Keine erledigten Einträge.');
    if (!(await uiConfirm(`${done.length} erledigte Einträge löschen?`, { danger: true, ok: 'Löschen' }))) return;
    run(async () => { const b = db.batch(); done.forEach(t => b.delete(db.collection('todos').doc(t.id))); await b.commit(); });
}
