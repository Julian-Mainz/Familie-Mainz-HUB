// js/pages/wand.js - Seiten-Code von /wand.html (ausgelagert, damit der Browser ihn zwischenspeichern kann)
const setT = (el, t) => { const n = el.firstChild; if (n && n.nodeType === 3) { if (n.nodeValue !== t) n.nodeValue = t; } else el.textContent = t; };
let pub = [], mine = [], events = [], todos = [], notes = [], started = false, lastMin = -1, lastDay = '', lock = null;

initAuthGuard(user => {
    if (!user || started) return;
    started = true;
    const list = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
    const merge = () => { const m = new Map(); [...pub, ...mine].forEach(e => m.set(e.id, e)); events = [...m.values()]; renderCalendar(); renderAgenda(); };
    // Nur anzeigen und laden, wofür dieses Konto Rechte hat
    const P = { termine: can(currentUser, 'termine'), aufgaben: can(currentUser, 'aufgaben'), pinnwand: can(currentUser, 'pinnwand') };
    if (!P.termine) { $('cal').closest('.panel').classList.add('hidden'); $('agenda').closest('.panel').classList.add('hidden'); }
    if (!P.aufgaben) { $('shop').closest('.panel').classList.add('hidden'); $('tasks').closest('.panel').classList.add('hidden'); }
    if (!P.pinnwand) $('notes').closest('.panel').classList.add('hidden');
    if (P.termine) {
        db.collection('events').where('isPublic', '==', true).onSnapshot(s => { pub = list(s); merge(); }, () => {});
        db.collection('events').where('owner', '==', currentUser.email).onSnapshot(s => { mine = list(s); merge(); }, () => {});
    }
    if (P.aufgaben) db.collection('todos').orderBy('createdAt', 'desc').onSnapshot(s => { todos = list(s); renderLists(); }, () => {});
    if (P.pinnwand) db.collection('notes').orderBy('createdAt', 'desc').limit(8).onSnapshot(s => { notes = list(s); renderNotes(); }, () => {});
    ['shop', 'tasks'].forEach(id => $(id).addEventListener('click', e => {
        const b = e.target.closest('[data-id]'); if (!b) return;
        db.collection('todos').doc(b.dataset.id).update({ done: b.dataset.done !== 'true' }).catch(err => alert('Fehler: ' + err.message));
    }));
    tick(); setInterval(tick, 1000); loadWeather(); setInterval(loadWeather, 15 * 60 * 1000);
    keepAwake(); document.addEventListener('click', keepAwake, { once: true });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
    ['mousemove', 'touchstart', 'keydown'].forEach(ev => document.addEventListener(ev, wake, { passive: true })); wake();
}, { perm: 'wand' });

// ---------- Uhr, Datum, Nachtmodus ----------
function tick() {
    const now = new Date();
    setT($('clock'), now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    if (now.getMinutes() === lastMin) return;
    lastMin = now.getMinutes();
    $('date').innerText = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const t = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    $('kw').innerText = `Kalenderwoche ${Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7)}`;
    $('dim').style.opacity = (now.getHours() >= 22 || now.getHours() < 6) ? '0.7' : '0';
    const day = localDate(); if (day !== lastDay) { lastDay = day; renderCalendar(); renderAgenda(); }
    if (now.getHours() === 3 && now.getMinutes() === 30) location.reload();   // nächtlicher Neustart: frische Version, kein Speicherstau
}

// ---------- Wetter ----------
const WX = [[0, 'Klar', 'fa-sun text-amber-400'], [3, 'Leicht bewölkt', 'fa-cloud-sun text-amber-300'], [48, 'Nebelig', 'fa-smog text-slate-400'], [67, 'Regnerisch', 'fa-cloud-rain text-cyan-400'],
    [77, 'Schnee', 'fa-snowflake text-indigo-300'], [82, 'Regenschauer', 'fa-cloud-showers-heavy text-cyan-400'], [86, 'Schneeschauer', 'fa-snowflake text-indigo-300'], [99, 'Gewitter', 'fa-cloud-bolt text-amber-500']];
const wx = c => WX.find(w => c <= w[0]) || WX[WX.length - 1];
async function loadWeather() {
    try {
        const j = await (await fetch('https://api.open-meteo.com/v1/forecast?latitude=50.8021&longitude=6.4836&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=4&timezone=auto')).json();
        const c = j.current, d = j.daily, w = wx(c.weather_code);
        $('w-temp').innerText = `${Math.round(c.temperature_2m)}°`; $('w-cond').innerText = `${w[1]} · Düren`; $('w-icon').className = `fa-solid ${w[2]} text-6xl`;
        $('w-rain').innerText = ` ${d.precipitation_probability_max[0] ?? '–'} %`; $('w-wind').innerText = ` ${Math.round(c.wind_speed_10m)} km/h`;
        $('w-fc').innerHTML = [1, 2, 3].map(i => { const f = wx(d.weather_code[i]); return `<div class="text-center"><div class="text-sm text-slate-500">${new Date(d.time[i]).toLocaleDateString('de-DE', { weekday: 'long' })}</div>
            <i class="fa-solid ${f[2]} text-3xl my-2"></i><div class="text-lg"><b>${Math.round(d.temperature_2m_max[i])}°</b> <span class="text-slate-500">${Math.round(d.temperature_2m_min[i])}°</span></div>
            <div class="text-xs text-slate-500"><i class="fa-solid fa-umbrella mr-1"></i>${d.precipitation_probability_max[i] ?? '–'} %</div></div>`; }).join('');
    } catch (e) { $('w-cond').innerText = 'Wetter offline'; }
}

// ---------- Monatskalender ----------
function renderCalendar() {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth(), today = localDate(), first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    const cnt = {}; CAL.expand(events, `${y}-${String(m + 1).padStart(2, '0')}-01`, `${y}-${String(m + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`).forEach(o => { cnt[o.date] = (cnt[o.date] || 0) + 1; });
    $('cal-title').innerText = now.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    let h = '<div></div>'.repeat(first);
    for (let d = 1; d <= days; d++) {
        const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, n = cnt[ds] || 0, we = [0, 6].includes(new Date(y, m, d).getDay());
        h += `<div class="flex flex-col items-center justify-center rounded-xl text-base ${ds === today ? 'bg-indigo-600 text-white font-bold' : we ? 'text-slate-500' : 'text-slate-300'} ${ds < today ? 'opacity-60' : ''}">${d}
            <span class="h-1.5 flex gap-0.5">${n ? '<i class="w-1.5 h-1.5 rounded-full bg-cyan-400"></i>' : ''}${n > 1 ? '<i class="w-1.5 h-1.5 rounded-full bg-cyan-400"></i>' : ''}</span></div>`;
    }
    $('cal').innerHTML = h;
}

// ---------- Termine der Woche ----------
function renderAgenda() {
    let h = '', any = false; const occ = CAL.expand(events, localDate(), CAL.addDays(localDate(), 6));
    for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() + i); const ds = localDate(d), list = occ.filter(o => o.date === ds);
        if (!list.length && i > 0) continue;
        if (list.length) any = true;
        const label = i === 0 ? 'Heute' : i === 1 ? 'Morgen' : d.toLocaleDateString('de-DE', { weekday: 'long' });
        h += `<div><div class="flex items-baseline gap-2 mb-1.5"><span class="text-lg font-bold ${i === 0 ? 'text-indigo-300' : 'text-slate-200'}">${label}</span><span class="text-sm text-slate-500">${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}.</span></div>
            ${list.length ? list.map(e => `<div class="item"><i class="fa-solid ${e.isPublic ? 'fa-calendar-day text-cyan-400' : 'fa-lock text-slate-500'} text-sm"${CAL.colorOf(e) ? ` style="color:${CAL.colorOf(e)}"` : ''}></i>${e.time ? `<span class="font-mono text-cyan-300 text-sm shrink-0">${esc(e.time)}</span>` : ''}<span class="truncate">${esc(e.title)}</span>${e.recurring ? '<i class="fa-solid fa-repeat text-slate-500 text-xs ml-auto"></i>' : ''}</div>`).join('<div class="h-1.5"></div>') : '<div class="text-slate-500 text-sm pl-1">Keine Termine</div>'}</div>`;
    }
    $('agenda').innerHTML = h;
    if (!any) $('agenda').innerHTML += '<div class="text-slate-500 text-sm">In den nächsten 7 Tagen sind keine weiteren Termine eingetragen.</div>';
}

// ---------- Einkauf & Aufgaben (Antippen = abhaken) ----------
function renderLists() {
    const fill = (id, nId, list) => {
        const open = list.filter(t => !t.done), done = list.filter(t => t.done).slice(0, 3);
        $(nId).innerText = open.length ? `${open.length} offen` : '';
        const row = (t, d) => `<button data-id="${esc(t.id)}" data-done="${d}" class="item ${d ? 'opacity-40' : ''}"><i class="fa-regular ${d ? 'fa-square-check text-emerald-400' : 'fa-square text-slate-500'}"></i><span class="truncate ${d ? 'line-through' : ''}">${esc(t.text)}</span></button>`;
        $(id).innerHTML = (open.map(t => row(t, false)).join('') + done.map(t => row(t, true)).join('')) || '<div class="text-slate-500 text-sm">Alles erledigt 🎉</div>';
    };
    fill('shop', 'shop-n', todos.filter(t => t.kind === 'shop'));
    fill('tasks', 'task-n', todos.filter(t => t.kind !== 'shop'));
}
function renderNotes() {
    $('notes').innerHTML = notes.length ? notes.map(n => `<div class="item"><i class="fa-solid fa-thumbtack text-amber-400 text-sm"></i><div class="min-w-0"><div class="truncate">${esc(n.text)}</div><div class="text-[11px] text-slate-500">${esc(n.author || 'Mitglied')}</div></div></div>`).join('') : '<div class="text-slate-500 text-sm">Keine Notizen.</div>';
}

// ---------- Vollbild, Bildschirm wach halten, Bedienelemente ausblenden ----------
function toggleFs() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }
document.addEventListener('fullscreenchange', () => { $('fs-icon').className = 'fa-solid ' + (document.fullscreenElement ? 'fa-compress' : 'fa-expand'); });
async function keepAwake() {
    try {
        if (!('wakeLock' in navigator) || lock) return;
        lock = await navigator.wakeLock.request('screen'); $('wl').classList.remove('hidden');
        lock.addEventListener('release', () => { lock = null; $('wl').classList.add('hidden'); });
    } catch (e) { lock = null; }
}
let idleT; function wake() { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add('idle'), 5000); }
