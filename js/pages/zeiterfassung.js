// js/pages/zeiterfassung.js - Seiten-Code von /zeiterfassung.html (ausgelagert, damit der Browser ihn zwischenspeichern kann)
const openModal = id => $(id).classList.remove('hidden'), closeModal = id => $(id).classList.add('hidden');
const run = async fn => { try { await fn(); } catch (e) { alert('Fehler: ' + e.message); } };
const fmtT = d => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const monthLabel = ym => new Date(+ym.slice(0, 4), +ym.slice(5) - 1, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
const parse = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const netOf = (s, e, p) => { let d = toMin(e) - toMin(s); if (d < 0) d += 1440; return Math.max(0, d - p); };
const hm = min => { const s = min < 0 ? '-' : ''; min = Math.abs(Math.round(min)); return `${s}${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} Std`; };
const sg = min => (min > 0 ? '+' : '') + hm(min);
const tone = min => (min > 0 ? 'pos' : min < 0 ? 'neg' : '');
const disp = s => String(s).replace(/^-/, '−');        // schönes Minuszeichen nur für die Anzeige
const pauseOf = e => Number(e.pauseMinutes) || 0, typeOf = e => e.type || 'work';
// Art: [Name, Symbol, Farbe, Farbe als r,g,b, Chip-Farbe, Balkenfarbe]
const TYPES = {
    work: ['Arbeit', 'fa-business-time', '#34d399', '52,211,153', 'g', ''],
    vacation: ['Urlaub', 'fa-umbrella-beach', '#eab308', '234,179,8', 'a', 'linear-gradient(180deg,#fde047,#eab308)'],
    sick: ['Krank', 'fa-notes-medical', '#ef4444', '239,68,68', 'r', 'linear-gradient(180deg,#fca5a5,#ef4444)'],
    flex: ['Überstundenabbau', 'fa-hourglass-half', '#a855f7', '168,85,247', 'p', 'linear-gradient(180deg,#d8b4fe,#a855f7)']
};
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };

// ---------- Anpassbares Layout (js/layout.js) ----------
// [Kennung, Name, Standardbreite in Zwölfteln]
const LAY = [['stamp', 'Stempeluhr', 4], ['cal', 'Monatskalender', 5], ['konto', 'Überstundenkonto', 3], ['saldo', 'Saldo im Monat', 3], ['vleft', 'Urlaub übrig', 3], ['week', 'Diese Woche', 5], ['days', 'Tage im Monat', 7], ['ist', 'Ist im Monat', 3], ['soll', 'Soll (bis heute)', 3]];
let curTab = 'ov';
const TABS = [['ov', 'Übersicht'], ['zeiten', 'Zeiten'], ['abw', 'Abwesenheit']];
const LAY_PRESETS = {
    'Standard': {},
    'Kompakt': { order: ['cal', 'konto', 'saldo', 'vleft', 'stamp', 'ist', 'soll'], hidden: ['week'], width: { cal: 6, konto: 3, saldo: 3, vleft: 3, stamp: 3, ist: 3, soll: 3 } },
    'Fokus Stempeluhr': { order: ['stamp', 'konto', 'saldo', 'week', 'cal'], hidden: ['ist', 'soll', 'vleft'], width: { stamp: 6, konto: 3, saldo: 3, week: 6, cal: 6 } }
};
Layout.init({ key: 'zeit', root: $('tab-ov'), modules: LAY.map(([id, title, w]) => ({ id, title, w, el: $('mod-' + id) })), presets: LAY_PRESETS,
    tabs: { items: TABS.map(([id, title]) => ({ id, title, el: document.querySelector(`.tab[data-tab="${id}"]`) })) }, onTabs: () => { if (Layout.tabHidden(curTab)) showTab(curTab); },
    onEdit: on => { if (on && curTab !== 'ov') showTab('ov'); }, save: async l => {
    await db.collection('users').doc(currentUser.uid).update({ 'userPrefs.layouts.zeit2': l });
    currentUser.userPrefs = { ...(currentUser.userPrefs || {}), layouts: { ...((currentUser.userPrefs || {}).layouts || {}), zeit2: l } }; logSystemEvent('data', 'Layout gespeichert', { seite: 'zeit' });
} });

// ---------- Reiter ----------
function showTab(t) {
    if (!$('tab-' + t) || Layout.tabHidden(t)) t = Layout.firstTab() || 'ov';          // ausgeblendete Reiter öffnen nicht
    curTab = t; closeCalPop();
    TABS.forEach(([k]) => $('tab-' + k).classList.toggle('hidden', k !== t));
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    history.replaceState(null, '', '#' + t);
    if (t === 'ov') Layout.refresh();
}
window.addEventListener('hashchange', () => showTab(location.hash.slice(1) || 'ov'));

// ---------- Einstellungen ----------
const W = () => ({ pause: 60, after: 6, weekly: 40, vacation: 30, carry: 0, carryYear: 0, ...(currentUser.userPrefs?.work || {}) });
// Sollzeit: pro Wochentag einstellbar (userPrefs.work.days), Feiertage nach Bundesland (Kalender-Einstellungen)
const region = () => CAL.prefs(currentUser).region;
const dayMinOf = d => CAL.workDayMin(W(), typeof d === 'string' ? d : localDate(d), region());
const dayMin = () => CAL.workAvg(W());
// Arbeitstage: sieben Felder Mo … So (Stunden); gespeichert als days = [So, Mo, …, Sa]
const WDN = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], WDO = [1, 2, 3, 4, 5, 6, 0];
function paintDays(days) {
    $('set-days').innerHTML = WDO.map(d => `<label class="${days[d] > 0 ? '' : 'off'}">${WDN[d]}<input type="number" min="0" max="24" step="0.25" class="ux-in" data-d="${d}" value="${+days[d] || 0}" aria-label="Sollstunden ${WDN[d]}"></label>`).join('');
    sumDays();
}
function readDays() { const a = [0, 0, 0, 0, 0, 0, 0]; $('set-days').querySelectorAll('input').forEach(i => { a[+i.dataset.d] = Math.max(0, Math.min(24, Math.round((+i.value || 0) * 4) / 4)); }); return a; }
function sumDays() { const a = readDays(), n = a.filter(x => x > 0).length, t = a.reduce((x, y) => x + y, 0); $('set-sum').textContent = `${n} Arbeitstag${n === 1 ? '' : 'e'} · ${String(t).replace('.', ',')} Std pro Woche`; $('set-days').querySelectorAll('label').forEach(l => l.classList.toggle('off', !(+l.querySelector('input').value > 0))); }
$('set-days').addEventListener('input', sumDays);
document.querySelector('#modal-settings').addEventListener('click', e => { const b = e.target.closest('[data-wd]'); if (!b) return; const [n, h] = b.dataset.wd.split('x').map(Number), a = [0, 0, 0, 0, 0, 0, 0]; (n === 3 ? [1, 3, 5] : WDO.slice(0, n)).forEach(d => { a[d] = h; }); paintDays(a); });
$('set-region').innerHTML = CAL.REGIONS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
function sollText() {
    const a = [0, 1, 2, 3, 4, 5, 6].map(d => CAL.workBase(W(), d)), on = WDO.filter(d => a[d] > 0), same = on.every(d => a[d] === a[on[0]]);
    if (!on.length) return 'kein Soll';
    const days = on.length === 5 && on.join() === '1,2,3,4,5' ? 'Mo–Fr' : on.map(d => WDN[d]).join(', ');
    return same ? `${days} · ${hm(a[on[0]])}` : `${days} · Ø ${hm(dayMin())}`;
}
function openSettings(focus) {
    const w = W(), cy = new Date().getFullYear(); $('set-pause').value = w.pause; $('set-after').value = w.after; paintDays([0, 1, 2, 3, 4, 5, 6].map(d => CAL.workBase(w, d) / 60)); $('set-region').value = region(); $('set-vac').value = w.vacation; $('set-carry').value = w.carryYear === cy ? w.carry : 0;
    $('set-pre').value = (w.vacPre || {})[cy] || 0; $('set-pre-year').textContent = cy; openModal('modal-settings'); if (focus === 'vac') setTimeout(() => $('set-vac').focus(), 50);
}
function saveSettings(e) {
    e.preventDefault();
    const work = { ...(currentUser.userPrefs?.work || {}), pause: Math.max(0, +$('set-pause').value), after: Math.max(0, +$('set-after').value), days: readDays(), weekly: readDays().reduce((a, b) => a + b, 0), vacation: Math.max(0, +$('set-vac').value), carry: Math.max(0, +$('set-carry').value), carryYear: new Date().getFullYear(),
        vacPre: { ...(currentUser.userPrefs?.work?.vacPre || {}), [new Date().getFullYear()]: Math.max(0, +$('set-pre').value || 0) } };
    run(async () => {
        const cal = { ...CAL.prefs(currentUser), ...(currentUser.userPrefs?.cal || {}), region: $('set-region').value };
        await db.collection('users').doc(currentUser.uid).update({ 'userPrefs.work': work, 'userPrefs.cal': cal });
        currentUser.userPrefs = { ...(currentUser.userPrefs || {}), work, cal };
        closeModal('modal-settings'); applyConfig(); renderAll(false); logSystemEvent('data', 'Zeiterfassung: Einstellungen geändert', work);
    });
}
function applyConfig() {
    const w = W();
    $('cfg-day').innerText = sollText(); $('cfg-pause').innerText = w.pause + ' Min';
    $('pause-hint').innerText = w.after > 0 ? `Wird abgezogen, wenn du mindestens ${w.after} Std. arbeitest.` : 'Wird immer abgezogen.';
}

// ---------- Stundenzettel aus der Firmen-Vorlage (Modul js/timesheet.js wird erst bei Bedarf geladen) ----------
function openTimesheet() {
    openModal('modal-ts');
    const go = () => Timesheet.open({ db, user: currentUser, entries: () => workEntries, holiday: k => holidays(+k.slice(0, 4)).has(k), isWorkday: k => CAL.workBase(W(), parse(k).getDay()) > 0,
        log: ym => logSystemEvent('data', 'Stundenzettel erstellt', { monat: ym }) });
    if (window.Timesheet) return go();
    const s = document.createElement('script'); s.src = (window.assetUrl || (p => p))('/js/timesheet.js'); s.onload = go; s.onerror = () => { $('ts-body').textContent = 'Das Modul konnte nicht geladen werden.'; }; document.head.appendChild(s);
}

// ---------- Feiertage (Bundesland) & Soll ----------
const holidays = y => CAL.holidays(y, region());
const isWork = d => dayMinOf(d) > 0;
const sollMin = (from, to) => CAL.workSoll(W(), from, to, region());

// ---------- Zustand ----------
let vacYear = new Date().getFullYear();
let workEntries = [], active = null, timerId = null, tickN = 0, busy = false, started = false;
let entFilter = 'all';
let todayStr = localDate().slice(0, 7);
setInterval(() => { todayStr = localDate().slice(0, 7); }, 60000);

initAuthGuard(user => {
    if (!user || started) return;
    started = true;
    renderDrawer(); applyConfig(); headDate(); setInterval(headDate, 60000); Layout.load(currentUser.userPrefs?.layouts?.zeit2); showTab(location.hash.slice(1) || Layout.firstTab() || 'ov');
    $('cal-grid').addEventListener('click', e => { const c = e.target.closest('[data-day]'); if (c) openCalPop(c.dataset.day, c); });
    $('ent-filters').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { entFilter = b.dataset.f; renderTable(); } });
    $('custom-start-time').value = fmtT(new Date());
    updateUI(false);
    db.collection('worktime').where('owner', '==', currentUser.email).onSnapshot(s => { workEntries = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
    db.collection('active_work').doc(currentUser.uid).onSnapshot(doc => {
        active = doc.exists ? doc.data() : null;
        if (active?.startTime) { startTimer(active.startTime.toDate()); $('live-pause').value = active.pauseMinutes ?? W().pause; } else stopTimer();
        updateUI(!!active); renderSummary();
    });
    document.querySelector('.ot-sign').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) setOtSign(+b.dataset.s); });
    ['ot-h', 'ot-m', 'ot-month'].forEach(i => { $(i).addEventListener('input', otPreview); $(i).addEventListener('change', otPreview); });
    ['cl-h', 'cl-m'].forEach(i => $(i).addEventListener('input', clPreview)); $('cl-month').addEventListener('change', clFill);
    $('cl-soll').addEventListener('click', () => clSet(sollMin(`${$('cl-month').value}-01`, monthEnd($('cl-month').value))));
    $('cl-ist').addEventListener('click', () => clSet(istOf($('cl-month').value)));
    $('days-list').addEventListener('click', e => { const r = e.target.closest('[data-day]'); if (r) openCalPop(r.dataset.day, r); });
    $('worktime-table-body').addEventListener('click', e => {
        const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
        if (ed) openWorkModal(ed.dataset.edit); if (del) deleteEntry(del.dataset.del);
    });
}, { perm: 'zeit' });

// ---------- Stempeluhr ----------
const livePause = () => Math.max(0, parseInt($('live-pause').value, 10) || 0);
function setLivePause(v) { $('live-pause').value = v; saveLivePause(); }
function saveLivePause() { if (active) db.collection('active_work').doc(currentUser.uid).update({ pauseMinutes: livePause() }).catch(() => {}); renderSummary(); }

function liveGross() { return active?.startTime ? Math.max(0, Math.round((Date.now() - active.startTime.toDate()) / 60000)) : 0; }
function liveNet() { const g = liveGross(); return Math.max(0, g - (g >= W().after * 60 ? livePause() : 0)); }

function updateUI(on) {
    const btn = $('btn-toggle-work'), badge = $('work-status-badge');
    $('start-time-container').classList.toggle('hidden', on); $('live-pause-container').classList.toggle('hidden', !on);
    badge.className = 'chip' + (on ? ' g' : ''); badge.innerHTML = on ? '<span class="dot"></span>Aktiv am Arbeiten' : 'Inaktiv';
    btn.className = 'ux-btn wide ' + (on ? 'stop run' : 'pri'); btn.innerHTML = on ? '<i class="fa-solid fa-stop"></i>Ausstempeln' : '<i class="fa-solid fa-play"></i>Einstempeln';
    if (!on) { $('work-start-hint').innerText = 'Nicht eingestempelt'; $('work-active-timer').innerText = '00:00:00'; $('eta').innerText = ''; }
}
function startTimer(start) {
    stopTimer(); $('work-start-hint').innerText = `Eingestempelt seit ${fmtT(start)} Uhr`;
    const tick = () => {
        const ms = Math.max(0, Date.now() - start), p = n => String(n).padStart(2, '0');
        const el = $('work-active-timer'), v = `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms % 3600000 / 60000))}:${p(Math.floor(ms % 60000 / 1000))}`; if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.nodeValue = v; else el.textContent = v;
        if (tickN++ % 30 === 0) renderSummary();
    };
    tick(); timerId = setInterval(tick, 1000);
}
function stopTimer() { clearInterval(timerId); timerId = null; }

async function toggleWorkSession() {
    if (busy) return; busy = true; $('btn-toggle-work').disabled = true;
    await run(async () => {
        if (active) {
            const start = active.startTime ? active.startTime.toDate() : new Date(), end = new Date();
            const total = Math.max(0, Math.round((end - start) / 60000));
            const pause = Math.min(total, total >= W().after * 60 ? livePause() : 0);
            await db.collection('worktime').add({ type: 'work', date: localDate(start), start: fmtT(start), end: fmtT(end), pauseMinutes: pause, netMinutes: total - pause, note: 'Live erfasst', owner: currentUser.email, createdAt: TS() });
            await db.collection('active_work').doc(currentUser.uid).delete();
            logSystemEvent('data', 'Ausgestempelt', { netMinutes: total - pause, pause });
        } else {
            const start = new Date(), v = $('custom-start-time').value;
            if (v) { const [h, m] = v.split(':').map(Number); start.setHours(h, m, 0, 0); }
            if (start > new Date()) start.setTime(Date.now());
            await db.collection('active_work').doc(currentUser.uid).set({ startTime: firebase.firestore.Timestamp.fromDate(start), pauseMinutes: W().pause, owner: currentUser.email });
            logSystemEvent('data', 'Eingestempelt', { start: fmtT(start) });
        }
    });
    busy = false; $('btn-toggle-work').disabled = false;
}

// ---------- Auswertung ----------
const selMonth = () => $('work-filter-month').value || todayStr;
const sumNet = list => list.reduce((s, e) => s + (e.netMinutes || 0), 0);
const inRange = (a, b) => workEntries.filter(w => w.date >= a && w.date <= b);

function renderAll(refreshMonths = true) {
    if (refreshMonths) {
        const sel = $('work-filter-month'), prev = sel.value, ym = workEntries.map(w => w.date?.slice(0, 7)).filter(m => m && m.length === 7).sort();
        const addM = (m, n) => { const d = new Date(+m.slice(0, 4), +m.slice(5) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
        let lo = ym[0] && ym[0] < todayStr ? ym[0] : todayStr, hi = addM(todayStr, 12); if (ym.length && ym[ym.length - 1] > hi) hi = ym[ym.length - 1];
        if (lo < addM(todayStr, -120)) lo = addM(todayStr, -120);
        const sorted = []; for (let m = hi; m >= lo; m = addM(m, -1)) sorted.push(m);
        sel.innerHTML = sorted.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
        sel.value = sorted.includes(prev) ? prev : todayStr;      // beim Öffnen der aktuelle Monat (nicht der neueste mit geplantem Urlaub)
    }
    renderSummary(); renderTable(); renderChart(); renderVacation(); renderCal(); renderAbs(); renderDays();
}

function renderSummary() {
    if (!currentUser) return;
    const today = localDate(), live = liveNet(), now = new Date();
    // Heute (Ring um die Uhr)
    const bookedToday = sumNet(inRange(today, today)), dIst = bookedToday + live, dSoll = dayMinOf(now);
    $('day-txt').innerText = dSoll ? `${hm(dIst)} von ${hm(dSoll)}` : `${hm(dIst)} · kein Sollarbeitstag`; UX.ring($('ring-arc'), dSoll ? dIst / dSoll : 0);
    // Woche
    const mon = new Date(now); mon.setDate(now.getDate() - (now.getDay() + 6) % 7);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const wIst = sumNet(inRange(localDate(mon), localDate(sun))) + live, wSoll = sollMin(localDate(mon), localDate(sun));
    $('week-txt').innerText = `${hm(wIst)} von ${hm(wSoll)}`; $('week-bar').style.width = Math.min(100, wSoll ? wIst / wSoll * 100 : 0) + '%'; renderWeek();
    // Feierabend-Prognose
    if (active?.startTime) {
        const rest = dayMinOf(now) - bookedToday, pause = rest >= W().after * 60 ? livePause() : 0;
        const eta = new Date(active.startTime.toDate().getTime() + (rest + pause) * 60000);
        $('eta').innerHTML = dSoll && dIst >= dSoll ? `<i class="fa-solid fa-circle-check"></i> Tagessoll erreicht (${sg(dIst - dSoll)})` : dSoll ? `Tagessoll erreicht um <b>${fmtT(eta)} Uhr</b>` : 'Heute kein Sollarbeitstag';
    }
    // Monat
    const m = selMonth(), last = `${m}-${String(new Date(+m.slice(0, 4), +m.slice(5), 0).getDate()).padStart(2, '0')}`, to = last < today ? last : today;
    const mist = sumNet(inRange(`${m}-01`, to)), msoll = sollMin(`${m}-01`, to), mw = workEntries.filter(w => w.date?.startsWith(m) && typeOf(w) === 'work');
    const wd = new Set(mw.map(w => w.date)).size, diff = mist - msoll;
    UX.setNum($('m-ist'), hm(mist)); UX.setNum($('m-soll'), hm(msoll)); UX.setNum($('m-saldo'), disp(sg(diff)), tone(diff));
    $('m-days').innerText = wd ? `${wd} ${wd === 1 ? 'Arbeitstag' : 'Arbeitstage'} · Ø ${hm(sumNet(mw) / wd)}` : 'Noch keine Arbeitstage';
    const sc = $('m-saldo-chip'); sc.innerText = diff > 0 ? 'über Soll' : diff < 0 ? 'unter Soll' : 'genau im Soll'; sc.className = 'chip ' + (diff > 0 ? 'g' : diff < 0 ? 'r' : '');
    // Gesamtkonto
    renderAccount();
}

function renderChart() {
    const m = selMonth(), n = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate(), per = {}, todayKey = localDate();
    workEntries.filter(w => w.date?.startsWith(m)).forEach(w => {
        const d = +w.date.slice(8); per[d] = per[d] || { min: 0, type: 'work' };
        per[d].min += w.netMinutes || 0; if (typeOf(w) !== 'work') per[d].type = typeOf(w);
    });
    const top = Math.max(dayMin() * 1.3, ...Object.values(per).map(p => p.min), 60);
    let h = '';
    for (let d = 1; d <= n; d++) {
        const dt = new Date(+m.slice(0, 4), +m.slice(5) - 1, d), p = per[d], off = !isWork(dt), key = `${m}-${String(d).padStart(2, '0')}`;
        h += `<div class="col${off ? ' off' : ''}${key === todayKey ? ' today' : ''}" title="${d}.${m.slice(5)}.: ${p ? hm(p.min) : (off ? 'frei' : '–')}"><div class="bw">
            <i style="height:${p ? Math.max(3, p.min / top * 100) : off ? 3 : 2}%;--i:${d};${p && TYPES[p.type][5] ? '--bc:' + TYPES[p.type][5] : ''}"></i></div><span>${d}</span></div>`;
    }
    $('chart').innerHTML = h + `<div class="tgt" style="bottom:calc(17px + (100% - 35px) * ${Math.min(1, dayMin() / top)})"><span>Tagessoll ${hm(dayMin())}</span></div>`;
}

// Wochenansicht Mo bis So. Nur bei Änderung neu zeichnen, damit die Balken nicht jede halbe Minute neu wachsen.
function renderWeek() {
    const now = new Date(), mon = new Date(now); mon.setDate(now.getDate() - (now.getDay() + 6) % 7);
    const live = liveNet(), todayKey = localDate(), days = []; let top = Math.max(dayMin() * 1.3, 60);
    for (let i = 0; i < 7; i++) {
        const d = new Date(mon); d.setDate(mon.getDate() + i); const key = localDate(d), es = workEntries.filter(w => w.date === key), other = es.find(x => typeOf(x) !== 'work');
        const min = sumNet(es) + (key === todayKey ? live : 0); top = Math.max(top, min); days.push({ d, key, min, off: !isWork(d), type: other ? typeOf(other) : 'work' });
    }
    const sig = days.map(x => x.min + x.type).join('|') + top + dayMin(); if (renderWeek.sig === sig) return; renderWeek.sig = sig;
    $('week-chart').innerHTML = days.map((x, i) => `<div class="col${x.off ? ' off' : ''}${x.key === todayKey ? ' today' : ''}" title="${esc(x.key.split('-').reverse().join('.'))}: ${x.min ? hm(x.min) : (x.off ? 'frei' : '–')}"><div class="bw"><i style="height:${x.min ? Math.max(5, x.min / top * 100) : 4}%;--i:${i * 4};${TYPES[x.type][5] ? '--bc:' + TYPES[x.type][5] : ''}"></i></div><span>${WD[x.d.getDay()]}</span><em>${x.min ? hm(x.min).replace(' Std', '') : '–'}</em></div>`).join('')
        + `<div class="tgt" style="bottom:calc(36px + (100% - 54px) * ${Math.min(1, dayMin() / top)})"><span>Soll ${hm(dayMin())}</span></div>`;
}
function monthShift(dir) { const s = $('work-filter-month'), i = s.selectedIndex + dir; if (i >= 0 && i < s.options.length) { s.selectedIndex = i; renderAll(false); } }
function headDate() { const d = new Date(); $('ux-date').textContent = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · Kalenderwoche ' + UX.kw(d); }

function renderTable() {
    const all = workEntries.filter(w => w.date?.startsWith(selMonth())).sort((a, b) => b.date.localeCompare(a.date) || (b.start || '').localeCompare(a.start || ''));
    const list = entFilter === 'all' ? all : all.filter(e => typeOf(e) === entFilter), today = localDate();
    $('work-table-count').innerText = entFilter === 'all' ? `${all.length} ${all.length === 1 ? 'Eintrag' : 'Einträge'}` : `${list.length} von ${all.length}`;
    document.querySelectorAll('#ent-filters [data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === entFilter));
    let lastDay = '', html = '';
    list.forEach((e, i) => {
        const t = typeOf(e), net = e.netMinutes || 0, T = TYPES[t];
        if (e.date !== lastDay) { lastDay = e.date; html += `<div class="day">${e.date === today ? 'Heute · ' : ''}${WD[parse(e.date).getDay()]}., ${esc(e.date.split('-').reverse().slice(0, 2).join('.'))}.</div>`; }
        const name = t === 'work' ? (e.note && e.note !== '-' ? e.note : 'Arbeitszeit') : T[0] + (e.note && e.note !== T[0] ? ' · ' + e.note : '');
        const info = t === 'work' ? `${esc(e.start || '--:--')} – ${esc(e.end || '--:--')} · Pause ${pauseOf(e)} Min` : t === 'flex' ? 'Soll bleibt bestehen' : 'ganzer Tag';
        html += `<div class="row" style="--c:${T[2]};--cr:${T[3]};animation-delay:${Math.min(i, 10) * 25}ms"><div class="tile"><i class="fa-solid ${T[1]}"></i></div>
            <div class="n"><div class="ell">${esc(name)}</div><small>${info}</small></div>${t !== 'work' ? `<span class="chip ${T[4]}">${T[0]}</span>` : ''}
            <div class="a ${net ? '' : 'mut'}">${hm(net)}</div><div class="acts">${t === 'work' ? `<button class="ux-ib" data-edit="${esc(e.id)}" title="Bearbeiten" aria-label="Bearbeiten"><i class="fa-solid fa-pen-to-square"></i></button>` : ''}
            <button class="ux-ib bad" data-del="${esc(e.id)}" title="Löschen" aria-label="Löschen"><i class="fa-solid fa-trash-can"></i></button></div></div>`;
    });
    $('worktime-table-body').innerHTML = html || `<div class="ux-empty"><i class="fa-solid fa-calendar-day"></i>${all.length ? 'Keine Einträge in dieser Auswahl.' : 'Keine Einträge für diesen Monat.'}</div>`;
}

// ---------- Erfassen / Bearbeiten / Abwesenheit ----------
function openWorkModal(id = '') {
    const e = id ? workEntries.find(w => w.id === id) : null;
    $('work-modal-title').innerText = e ? 'Arbeitszeit bearbeiten' : 'Arbeitszeit erfassen';
    $('work-id').value = e ? e.id : ''; $('work-date').value = e ? e.date : localDate();
    $('work-start').value = e ? (e.start || '08:00') : '08:00'; $('work-end').value = e ? (e.end || '17:00') : '17:00';
    $('work-pause').value = e ? pauseOf(e) : W().pause; $('work-note').value = e ? (e.note || '') : '';
    openModal('modal-work');
}
function saveWorkTime(ev) {
    ev.preventDefault();
    const id = $('work-id').value, date = $('work-date').value, start = $('work-start').value, end = $('work-end').value, pause = Math.max(0, parseInt($('work-pause').value || 0, 10));
    const data = { type: 'work', date, start, end, pauseMinutes: pause, netMinutes: netOf(start, end, pause), note: $('work-note').value.trim() };
    run(async () => {
        if (id) await db.collection('worktime').doc(id).update({ ...data, updatedAt: TS() }); else await db.collection('worktime').add({ ...data, owner: currentUser.email, createdAt: TS() });
        closeModal('modal-work'); logSystemEvent('data', id ? 'Arbeitszeit bearbeitet' : 'Arbeitszeit manuell erfasst', { date, netMinutes: data.netMinutes });
    });
}
async function deleteEntry(id) {
    if (!(await uiConfirm('Diesen Eintrag wirklich löschen?', { danger: true, ok: 'Löschen' }))) return;
    run(async () => { await db.collection('worktime').doc(id).delete(); logSystemEvent('data', 'Arbeitszeit gelöscht', { id }); });
}
function openAbsence(type) { $('ab-type').value = type || 'vacation'; $('ab-from').value = $('ab-to').value = localDate(); $('ab-note').value = ''; openModal('modal-absence'); }
async function saveAbsence(e) {
    e.preventDefault();
    const type = $('ab-type').value, from = $('ab-from').value, to = $('ab-to').value, note = $('ab-note').value.trim();
    if (to < from) return alert('Das Enddatum liegt vor dem Startdatum.');
    const days = []; for (const d = parse(from), end = parse(to); d <= end && days.length < 62; d.setDate(d.getDate() + 1)) if (isWork(d)) days.push(localDate(d));
    if (!days.length) return alert('Im Zeitraum liegt kein Arbeitstag (Wochenende oder Feiertag).');
    const have = new Set(workEntries.filter(w => typeOf(w) === type).map(w => w.date)), todo = days.filter(d => !have.has(d));
    if (!todo.length) return alert('Für diesen Zeitraum gibt es diese Abwesenheit schon.');
    if (type === 'vacation') {
        const byYear = {}; todo.forEach(d => { byYear[d.slice(0, 4)] = (byYear[d.slice(0, 4)] || 0) + 1; });
        for (const [y, n] of Object.entries(byYear)) { const st = vacStats(+y); if (st.left - n < 0 && !(await uiConfirm(`Mit diesen ${n} Tagen überschreitest du deinen Urlaubsanspruch ${y} um ${n - Math.max(0, st.left)} Tage. Trotzdem eintragen?`))) return; }
    }
    run(async () => {
        const b = db.batch();
        todo.forEach(date => b.set(db.collection('worktime').doc(), { type, date, start: '', end: '', pauseMinutes: 0, netMinutes: type === 'flex' ? 0 : dayMinOf(date), note: note || TYPES[type][0], owner: currentUser.email, createdAt: TS() }));
        await b.commit(); closeModal('modal-absence'); logSystemEvent('data', 'Abwesenheit eingetragen', { type, tage: todo.length });
    });
}

// ---------- Urlaubskonto ----------
const nextWork = ds => { const d = parse(ds); do d.setDate(d.getDate() + 1); while (!isWork(d)); return localDate(d); };
const gdShort = d => d.split('-').reverse().slice(0, 2).join('.') + '.';
function vacStats(year) {
    const w = W(), today = localDate(), dates = [...new Set(workEntries.filter(e => typeOf(e) === 'vacation' && e.date?.startsWith(String(year))).map(e => e.date))].sort();
    const pre = Math.max(0, +((w.vacPre || {})[year]) || 0);                    // vor dem Start schon genommen, aber nicht eingetragen
    const total = w.vacation + (w.carryYear === year ? w.carry : 0), done = dates.filter(d => d <= today).length, taken = done + pre, planned = dates.length - done;
    return { total, taken, planned, pre, left: total - taken - planned, carry: w.carryYear === year ? w.carry : 0, dates };
}
const fmtDays = n => String(Math.round(n * 2) / 2).replace('.', ',');
function vacShift(d) { vacYear += d; renderVacation(); renderAbs(); }
function renderVacation() {
    if (!currentUser) return;
    const st = vacStats(vacYear), today = localDate();
    $('vac-year').innerText = vacYear;
    const cy = new Date().getFullYear(), cs = cy === vacYear ? st : vacStats(cy);          // Kachel "Urlaub übrig" immer fürs laufende Jahr
    $('vl-year').innerText = cy; UX.setNum($('vl-left'), String(Math.round(cs.left * 2) / 2).replace('.', ',') + ' Tage', cs.left < 0 ? 'neg' : cs.left <= 3 ? 'warn' : '');
    $('vl-chip').innerText = cs.planned ? `${cs.planned} geplant · ${cs.taken} genommen` : `${cs.taken} von ${cs.total} genommen`; $('vl-chip').className = 'chip' + (cs.planned ? ' a' : '');
    UX.setNum($('vac-left'), String(Math.round(st.left * 2) / 2).replace('.', ','), st.left < 0 ? 'neg' : st.left <= 3 ? 'warn' : '');
    $('vac-sub').innerHTML = `<div><i style="background:rgba(148,163,184,.5)"></i>Anspruch<b>${st.total - st.carry}${st.carry ? ' + ' + st.carry + ' Rest' : ''}</b></div><div><i style="background:#06b6d4"></i>Genommen<b>${fmtDays(st.taken)}${st.pre ? ` <small class="mut" style="font-weight:500">(${fmtDays(st.pre)} vorher)</small>` : ''}</b></div><div><i style="background:#fde047"></i>Geplant<b>${st.planned}</b></div>`;
    const pct = n => st.total > 0 ? Math.min(1, n / st.total) : 0, pt = pct(st.taken);
    UX.ring($('vac-arc-taken'), pt); UX.ring($('vac-arc-plan'), Math.min(1 - pt, pct(st.planned)), pt);
    const ranges = []; st.dates.forEach(d => { const l = ranges[ranges.length - 1]; if (l && nextWork(l.to) === d) { l.to = d; l.n++; } else ranges.push({ from: d, to: d, n: 1 }); });
    $('vac-ranges').innerHTML = ranges.length ? ranges.map(r => `<div class="vr"><span class="d ${r.to < today ? 'mut' : ''}"><i class="fa-solid fa-umbrella-beach" style="color:${r.to < today ? '#64748b' : '#eab308'};margin-right:7px"></i>${gdShort(r.from)}${r.from !== r.to ? ' – ' + gdShort(r.to) : ''} · ${r.n} ${r.n === 1 ? 'Tag' : 'Tage'}</span>
        <span class="acts"><button onclick="openVacReq('${r.from}','${r.to}')" class="ux-ib" title="Urlaubsantrag drucken" aria-label="Urlaubsantrag drucken"><i class="fa-solid fa-print"></i></button>
        <button onclick="delVacRange('${r.from}','${r.to}')" class="ux-ib bad" title="Zeitraum löschen" aria-label="Zeitraum löschen"><i class="fa-solid fa-trash-can"></i></button></span></div>`).join('')
        : '<div class="ux-note" style="margin-top:8px">Noch kein Urlaub eingetragen.</div>';
}
async function delVacRange(from, to) {
    const list = workEntries.filter(e => typeOf(e) === 'vacation' && e.date >= from && e.date <= to);
    if (!list.length || !(await uiConfirm(`Urlaub vom ${gdShort(from)} bis ${gdShort(to)} (${list.length} Einträge) löschen?`, { danger: true, ok: 'Löschen' }))) return;
    run(async () => { const b = db.batch(); list.forEach(e => b.delete(db.collection('worktime').doc(e.id))); await b.commit(); logSystemEvent('data', 'Urlaub gelöscht', { von: from, bis: to }); });
}

// ---------- Überstundenkonto: Startstand und Monatsabschlüsse ----------
// Das Konto ändert sich nur, wenn ein Monat abgeschlossen wird: neuer Stand = alter Stand + (gearbeitet − ausgezahlt).
// Gespeichert in userPrefs.work: ot = { min, upto: letzter Tag des Startmonats }, closings = { 'JJJJ-MM': { paid: Minuten, at } }
const dayAfter = ds => { const d = parse(ds); d.setDate(d.getDate() + 1); return localDate(d); };
const gdFull = ds => ds.split('-').reverse().join('.');
const addMon = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const monthEnd = ym => `${ym}-${String(new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate()).padStart(2, '0')}`;
const monName = ym => new Date(+ym.slice(0, 4), +ym.slice(5) - 1, 1).toLocaleString('de-DE', { month: 'long' });
const istOf = ym => sumNet(inRange(`${ym}-01`, monthEnd(ym)));
const closings = () => { const c = W().closings; return c && typeof c === 'object' ? c : {}; };
const paidOf = ym => { const c = closings()[ym]; return c && Number.isFinite(+c.paid) ? Math.round(+c.paid) : null; };
const otOf = () => { const o = W().ot; return o && /^\d{4}-\d{2}-\d{2}$/.test(o.upto || '') && Number.isFinite(+o.min) ? { min: Math.round(+o.min), upto: o.upto } : null; };
// o.ot: anderer Startstand (Vorschau), o.skip: diesen Monat nicht mitrechnen (Vorschau beim Abschließen)
function account(o = {}) {
    const ot = 'ot' in o ? o.ot : otOf(), today = localDate(), cur = today.slice(0, 7);
    let min = ot ? ot.min : 0, start;
    if (ot) {
        const am = ot.upto.slice(0, 7), me = monthEnd(am); start = addMon(am, 1);
        // Älterer Stand mitten im Monat: den Rest dieses Monats wie früher gegen das Soll rechnen, sobald der Monat vorbei ist
        if (ot.upto < me && today > me) min += sumNet(inRange(dayAfter(ot.upto), me)) - sollMin(dayAfter(ot.upto), me);
    } else { const first = workEntries.reduce((a, w) => (w.date && (!a || w.date < a) ? w.date : a), ''); start = first ? first.slice(0, 7) : cur; }
    let last = ''; const months = [];
    for (let m = start, i = 0; m <= cur && i < 240; m = addMon(m, 1), i++) {
        const paid = paidOf(m); months.push({ ym: m, paid });
        if (paid !== null && m !== o.skip) { min += istOf(m) - paid; last = m; }
    }
    return { min, ot, start, last, months, open: months.filter(x => x.paid === null).map(x => x.ym) };
}
function renderAccount() {
    const ac = account(), cur = localDate().slice(0, 7), past = ac.open.filter(m => m < cur);
    UX.setNum($('acct'), disp(sg(ac.min)), tone(ac.min));
    $('acct-since').innerText = ac.last ? `Stand nach ${monthLabel(ac.last)}` : ac.ot ? `Startstand nach ${monthLabel(ac.ot.upto.slice(0, 7))}` : 'Noch kein Monat abgeschlossen';
    $('acct-open').innerHTML = past.length
        ? `<span class="chip a">${esc(monName(past[0]))}${past.length > 1 ? ` + ${past.length - 1} weitere` : ''} offen</span><button type="button" class="ux-btn pri" onclick="openClose()"><i class="fa-solid fa-calendar-check"></i>Abschließen</button>`
        : ac.open.includes(cur) ? `<button type="button" class="ux-btn" onclick="openClose()"><i class="fa-solid fa-calendar-check"></i>${esc(monName(cur))} abschließen</button>`
        : ac.months.length ? `<button type="button" class="ux-btn" onclick="openClose()"><i class="fa-solid fa-calendar-check"></i>Abschlüsse ansehen</button>` : '';
}

// Fenster "Monat abschließen"
function openClose(ym) {
    const ac = account(), cur = localDate().slice(0, 7);
    if (!ac.months.length) return alert('Noch kein Monat zum Abschließen. Trag zuerst einen Startstand ein oder erfasse Zeiten.');
    $('cl-month').innerHTML = ac.months.slice().reverse().map(x => `<option value="${x.ym}">${monthLabel(x.ym)}${x.paid !== null ? ' · abgeschlossen' : x.ym === cur ? ' · läuft noch' : ' · offen'}</option>`).join('');
    const past = ac.open.filter(m => m < cur);
    $('cl-month').value = ym || past[0] || (ac.open.includes(cur) ? cur : ac.months[ac.months.length - 1].ym);
    clFill(); openModal('modal-close'); setTimeout(() => $('cl-h').select(), 50);
}
const clVal = () => Math.max(0, parseInt($('cl-h').value, 10) || 0) * 60 + Math.min(59, Math.max(0, parseInt($('cl-m').value, 10) || 0));
function clSet(min) { min = Math.max(0, Math.round(min)); $('cl-h').value = Math.floor(min / 60); $('cl-m').value = min % 60; clPreview(); }
function clFill() {
    const ym = $('cl-month').value, paid = paidOf(ym), ist = istOf(ym), soll = sollMin(`${ym}-01`, monthEnd(ym));
    const hol = [...holidays(+ym.slice(0, 4))].filter(d => d.startsWith(ym) && parse(d).getDay() % 6 !== 0).length, today = localDate();
    $('cl-sum').innerHTML = `<div><span>Gearbeitet</span><b>${hm(ist).replace(' Std', '')}</b></div><div><span>Soll</span><b>${hm(soll).replace(' Std', '')}</b></div><div><span>Feiertage</span><b>${hol}</b></div>`;
    $('cl-note').textContent = 'Gearbeitet zählt Arbeitszeit, Urlaub und Krankheit, Feiertage nicht.' + (ym === today.slice(0, 7) && today < monthEnd(ym) ? ' Der Monat läuft noch: Zeiten, die du danach einträgst, verändern das Konto weiterhin.' : '');
    const last = Object.keys(closings()).filter(k => k < ym && paidOf(k) !== null).sort().pop();
    clSet(paid !== null ? paid : last ? paidOf(last) : soll);                            // Vorschlag: wie im letzten abgeschlossenen Monat, sonst das Soll
    $('cl-undo').classList.toggle('hidden', paid === null); $('cl-save').textContent = paid === null ? 'Abschließen' : 'Speichern';
}
function clPreview() {
    const ym = $('cl-month').value; if (!ym) return;
    const before = account({ skip: ym }).min, d = istOf(ym) - clVal(), after = before + d;
    $('cl-info').innerHTML = `Überstundenkonto: <b class="${tone(before)}">${disp(sg(before))}</b> wird zu <b class="${tone(after)}">${disp(sg(after))}</b> <span class="mut">(${d ? disp(sg(d)) : 'keine Änderung'})</span>`;
}
function setClosings(c) { const work = { ...(currentUser.userPrefs?.work || {}), closings: c }; currentUser.userPrefs = { ...(currentUser.userPrefs || {}), work }; }
function saveClose(e) {
    e.preventDefault();
    const ym = $('cl-month').value; if (!/^\d{4}-\d{2}$/.test(ym)) return;
    const data = { paid: clVal(), at: new Date().toISOString() };
    run(async () => {
        await db.collection('users').doc(currentUser.uid).update({ ['userPrefs.work.closings.' + ym]: data });
        setClosings({ ...closings(), [ym]: data }); closeModal('modal-close'); renderSummary();
        if (UX.toast) UX.toast(`${monthLabel(ym)} abgeschlossen`); logSystemEvent('data', 'Monat abgeschlossen', { monat: ym, ausgezahlt: data.paid });
    });
}
async function undoClose() {
    const ym = $('cl-month').value; if (!(await uiConfirm(`Abschluss für ${monthLabel(ym)} aufheben? Das Konto rechnet den Monat dann nicht mehr mit.`, { danger: true, ok: 'Aufheben' }))) return;
    run(async () => {
        await db.collection('users').doc(currentUser.uid).update({ ['userPrefs.work.closings.' + ym]: firebase.firestore.FieldValue.delete() });
        const c = { ...closings() }; delete c[ym]; setClosings(c); closeModal('modal-close'); renderSummary(); logSystemEvent('data', 'Monatsabschluss aufgehoben', { monat: ym });
    });
}

// Fenster "Startstand"
let otSign = 1;
function setOtSign(v) { otSign = v; document.querySelectorAll('.ot-sign button').forEach(b => b.classList.toggle('on', +b.dataset.s === v)); otPreview(); }
function otVal() { return otSign * ((Math.max(0, parseInt($('ot-h').value, 10) || 0)) * 60 + Math.min(59, Math.max(0, parseInt($('ot-m').value, 10) || 0))); }
function otPreview() {
    const ym = $('ot-month').value; if (!ym) { $('ot-info').innerText = ''; return; }
    const tot = account({ ot: { min: otVal(), upto: monthEnd(ym) } }).min;
    $('ot-info').innerHTML = `Ab ${monthLabel(addMon(ym, 1))} zählt jeder Monatsabschluss. Kontostand mit deinen bisherigen Abschlüssen: <b class="${tone(tot)}">${disp(sg(tot))}</b>`;
}
function openOt() {
    const ot = otOf(), cur = localDate().slice(0, 7), base = ot ? ot.min : account().min, months = [];
    for (let i = 0; i < 36; i++) months.push(addMon(cur, -i));
    $('ot-month').innerHTML = months.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
    setOtSign(base < 0 ? -1 : 1); $('ot-h').value = Math.floor(Math.abs(base) / 60); $('ot-m').value = Math.abs(base) % 60;
    const sel = ot ? ot.upto.slice(0, 7) : addMon(cur, -1); if (!months.includes(sel)) $('ot-month').insertAdjacentHTML('beforeend', `<option value="${sel}">${monthLabel(sel)}</option>`); $('ot-month').value = sel;
    $('ot-reset').classList.toggle('hidden', !ot); otPreview(); openModal('modal-ot'); setTimeout(() => $('ot-h').select(), 50);
}
function saveOt(e) {
    e.preventDefault();
    const ym = $('ot-month').value; if (!/^\d{4}-\d{2}$/.test(ym)) return alert('Bitte einen Monat wählen.');
    const ot = { min: otVal(), upto: monthEnd(ym) };
    run(async () => {
        await db.collection('users').doc(currentUser.uid).update({ 'userPrefs.work.ot': ot });
        currentUser.userPrefs = { ...(currentUser.userPrefs || {}), work: { ...(currentUser.userPrefs?.work || {}), ot } };
        closeModal('modal-ot'); renderSummary(); logSystemEvent('data', 'Überstundenkonto: Startstand gespeichert', ot);
    });
}
async function resetOt() {
    if (!(await uiConfirm('Startstand entfernen? Das Konto zählt dann nur noch deine Monatsabschlüsse ab deinem ersten Eintrag.', { danger: true, ok: 'Entfernen' }))) return;
    run(async () => {
        await db.collection('users').doc(currentUser.uid).update({ 'userPrefs.work.ot': firebase.firestore.FieldValue.delete() });
        const work = { ...(currentUser.userPrefs?.work || {}) }; delete work.ot; currentUser.userPrefs = { ...(currentUser.userPrefs || {}), work };
        closeModal('modal-ot'); renderSummary(); logSystemEvent('data', 'Überstundenkonto: Startstand entfernt');
    });
}

// ---------- Tage im Monat (Liste auf der Übersicht) ----------
function renderDays() {
    if (!currentUser) return;
    const m = selMonth(), today = localDate(), last = monthEnd(m), upto = last < today ? last : today, by = {};
    workEntries.forEach(w => { if (w.date?.startsWith(m)) (by[w.date] = by[w.date] || []).push(w); });
    const keys = new Set(Object.keys(by));
    for (const d = parse(`${m}-01`); localDate(d) <= upto; d.setDate(d.getDate() + 1)) { const k = localDate(d); if (isWork(d) || (d.getDay() % 6 !== 0 && holName(d.getFullYear()).has(k))) keys.add(k); }
    let total = 0, n = 0;
    const html = [...keys].sort().reverse().map(key => {
        const d = parse(key), es = by[key] || [], at = absOf(es), hn = holName(d.getFullYear()).get(key), work = es.filter(e => typeOf(e) === 'work').sort((a, b) => (a.start || '').localeCompare(b.start || ''));
        const live = key === today ? liveNet() : 0, net = sumNet(es) + live, soll = dayMinOf(d), fut = key > today, miss = !net && !at && !hn && !fut;
        if (net) { total += net; n++; }
        const what = at ? TYPES[at][0] : work.length ? work.map(w => `${w.start || '--:--'} – ${w.end || '--:--'}`).join(', ') + (live ? ' · läuft' : '') : live ? 'Läuft gerade' : hn ? hn : fut ? 'geplant' : 'Keine Zeit erfasst';
        const sub = at ? (es.find(e => typeOf(e) === at)?.note && es.find(e => typeOf(e) === at).note !== TYPES[at][0] ? es.find(e => typeOf(e) === at).note : (at === 'flex' ? 'Soll bleibt' : 'ganzer Tag'))
            : work.length ? `Pause ${work.reduce((s, w) => s + pauseOf(w), 0)} Min${work.some(w => w.note && w.note !== '-' && w.note !== 'Live erfasst') ? ' · ' + work.filter(w => w.note && w.note !== '-' && w.note !== 'Live erfasst').map(w => w.note).join(', ') : ''}` : hn ? 'Feiertag' : '';
        const rgb = at ? TYPES[at][3] : hn ? '59,130,246' : '52,211,153', diff = net - soll, showDiff = !fut && soll && (net || key < today);
        return `<button type="button" class="dr${miss ? ' miss' : ''}${fut ? ' fut' : ''}${key === today ? ' today' : ''}" data-day="${key}" style="--c:${rgb}" aria-label="${esc(WD[d.getDay()] + ' ' + gdShort(key) + ': ' + what)}">`
            + `<span class="dd"><b>${String(d.getDate()).padStart(2, '0')}</b><small>${WD[d.getDay()]}</small></span><span class="dw"><span class="ell">${esc(what)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</span>`
            + `<span class="dn">${net ? hm(net).replace(' Std', '') : '–'}</span><span class="df ${showDiff ? tone(diff) : ''}">${showDiff ? disp(sg(diff)).replace(' Std', '') : ''}</span></button>`;
    }).join('');
    $('days-list').innerHTML = html || '<div class="ux-empty"><i class="fa-solid fa-calendar-day"></i>Keine Tage in diesem Monat.</div>';
    $('days-sum').textContent = n ? `${n} ${n === 1 ? 'Tag' : 'Tage'} · ${hm(total)}` : '';
}

// ---------- Monatskalender ----------
const holName = y => CAL.holidayMap(y, region());
const ABS_ORDER = ['sick', 'vacation', 'flex'], ABS_ICON = { vacation: 'fa-umbrella-beach', sick: 'fa-plus', flex: 'fa-hourglass-half' };
const absOf = es => ABS_ORDER.find(t => es.some(e => typeOf(e) === t)) || '';
function renderCal() {
    const m = selMonth(), y = +m.slice(0, 4), mo = +m.slice(5) - 1, first = new Date(y, mo, 1), lastD = new Date(y, mo + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
    const weeks = Math.ceil((lead + lastD) / 7), today = localDate(), by = {};
    workEntries.forEach(w => { if (w.date) (by[w.date] = by[w.date] || []).push(w); });
    let h = '<span></span>' + ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w, i) => `<div class="wd${i > 4 ? ' we' : ''}">${w}</div>`).join('');
    for (let i = 0; i < weeks * 7; i++) {
        const d = new Date(y, mo, 1 - lead + i), key = localDate(d), es = by[key] || [], out = d.getMonth() !== mo;
        if (i % 7 === 0) h += `<div class="kw">KW ${UX.kw(d)}</div>`;
        const at = absOf(es), hn = holName(d.getFullYear()).get(key), we = d.getDay() % 6 === 0, cls = at || (hn ? 'hol' : we ? 'we' : '');
        const net = sumNet(es.filter(e => typeOf(e) === 'work')), ico = at ? ABS_ICON[at] : hn ? 'fa-star' : '';
        const what = at ? TYPES[at][0] : hn || (we ? 'Wochenende' : net ? 'Arbeit ' + hm(net) : 'Arbeitstag');
        h += `<button type="button" class="cd ${cls}${out ? ' out' : ''}${key === today ? ' today' : ''}${!cls && !out && key > today ? ' fut' : ''}" data-day="${key}" title="${d.getDate()}.${d.getMonth() + 1}.: ${esc(what)}" aria-label="${d.getDate()}. ${esc(what)}">`
            + `${String(d.getDate()).padStart(2, '0')}${net && !at ? `<em>${hm(net).replace(' Std', '')}</em>` : ''}${ico ? `<i class="fa-solid ${ico}"></i>` : ''}</button>`;
    }
    $('cal-grid').innerHTML = h;
    $('cal-title').innerText = monthLabel(m);
    let n = 0; for (let i = 1; i <= lastD; i++) if (dayMinOf(`${m}-${String(i).padStart(2, '0')}`) > 0) n++; $('cal-soll').innerText = `${n} Soll-Tage`;
}
// Tagesmenü
let popDay = '';
function openCalPop(key, el) {
    const p = $('cal-pop');
    if (popDay === key && !p.classList.contains('hidden')) return closeCalPop();
    popDay = key;
    const d = parse(key), es = workEntries.filter(w => w.date === key), work = es.filter(w => typeOf(w) === 'work').sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    const at = absOf(es), hn = holName(d.getFullYear()).get(key), we = d.getDay() % 6 === 0, wd = isWork(d), today = localDate(), net = sumNet(work);
    const head = at ? TYPES[at][0] : hn ? 'Feiertag' : we ? 'Wochenende' : 'Arbeitstag';
    const note = at ? (at === 'flex' ? '0 Std · Soll bleibt, baut Überstunden ab' : 'Ganzer Tag · Tagessoll gutgeschrieben') + (net ? ` · zusätzlich ${hm(net)} gearbeitet` : '')
        : net ? `Gearbeitet: <b>${hm(net)}</b>` + (wd ? ` · Soll ${hm(dayMinOf(d))}` : '') : hn ? esc(hn) + ' · kein Sollarbeitstag' : we ? 'Kein Sollarbeitstag' : key > today ? 'Noch nichts eingetragen' : 'Keine Zeit erfasst';
    let a = work.map(w => `<button type="button" data-a="edit" data-id="${esc(w.id)}"><i class="fa-solid fa-pen-to-square" style="color:#34d399"></i>${esc(w.start || '--:--')} – ${esc(w.end || '--:--')}<small>${hm(w.netMinutes || 0)}</small></button>`).join('');
    a += `<button type="button" data-a="add"><i class="fa-solid fa-plus" style="color:#34d399"></i>Arbeitszeit erfassen</button>`;
    if (wd) a += ABS_ORDER.map(t => { const T = TYPES[t], cur = at === t; return `<button type="button" data-a="set" data-t="${t}"${cur ? ' class="cur" disabled' : ''}><i class="fa-solid ${ABS_ICON[t]}" style="color:${T[2]}"></i>${cur ? T[0] + ' (eingetragen)' : (at ? 'Auf ' + T[0] + ' ändern' : T[0])}</button>`; }).join('');
    if (at) a += `<button type="button" data-a="clear"><i class="fa-solid fa-trash-can" style="color:#fda4af"></i>${TYPES[at][0]} entfernen</button>`;
    p.innerHTML = `<h4>${WD[d.getDay()]}, ${gdShort(key)} · ${head}<button class="ux-ib" type="button" data-a="close" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button></h4><div class="ux-note">${note}</div><div class="acts">${a}</div>`;
    p.classList.remove('hidden');
    const r = el.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight;
    let left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), innerWidth - pw - 12), top = r.bottom + 8;
    if (top + ph > innerHeight - 12) top = Math.max(12, r.top - ph - 8);
    p.style.left = left + 'px'; p.style.top = top + 'px';
    const f = p.querySelector('.acts button:not([disabled])'); if (f && matchMedia('(pointer: fine)').matches) f.focus({ preventScroll: true });
}
function closeCalPop() { const p = $('cal-pop'); if (p) p.classList.add('hidden'); popDay = ''; }
$('cal-pop').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const key = popDay;
    if (b.dataset.a === 'close') return closeCalPop();
    closeCalPop();
    if (b.dataset.a === 'edit') openWorkModal(b.dataset.id);
    else if (b.dataset.a === 'add') { openWorkModal(); $('work-date').value = key; }
    else if (b.dataset.a === 'set') setDayType(key, b.dataset.t);
    else if (b.dataset.a === 'clear') clearDayAbs(key);
});
document.addEventListener('pointerdown', e => { if (popDay && !e.target.closest('#cal-pop') && !e.target.closest('[data-day]')) closeCalPop(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && popDay) closeCalPop(); });
window.addEventListener('scroll', () => { if (popDay && !matchMedia('(max-width: 600px)').matches) closeCalPop(); }, { passive: true });
window.addEventListener('resize', () => { if (popDay) closeCalPop(); });
async function setDayType(key, t) {
    const old = workEntries.filter(w => w.date === key && typeOf(w) !== 'work');
    if (t === 'vacation' && !old.some(o => typeOf(o) === 'vacation')) { const st = vacStats(+key.slice(0, 4)); if (st.left - 1 < 0 && !(await uiConfirm(`Damit überschreitest du deinen Urlaubsanspruch ${key.slice(0, 4)}. Trotzdem eintragen?`))) return; }
    run(async () => {
        const b = db.batch(); old.forEach(o => b.delete(db.collection('worktime').doc(o.id)));
        b.set(db.collection('worktime').doc(), { type: t, date: key, start: '', end: '', pauseMinutes: 0, netMinutes: t === 'flex' ? 0 : dayMinOf(key), note: TYPES[t][0], owner: currentUser.email, createdAt: TS() });
        await b.commit(); logSystemEvent('data', 'Abwesenheit im Kalender gesetzt', { date: key, type: t });
    });
}
function clearDayAbs(key) {
    const old = workEntries.filter(w => w.date === key && typeOf(w) !== 'work'); if (!old.length) return;
    run(async () => { const b = db.batch(); old.forEach(o => b.delete(db.collection('worktime').doc(o.id))); await b.commit(); logSystemEvent('data', 'Abwesenheit im Kalender entfernt', { date: key }); });
}

// ---------- Abwesenheiten im Jahr ----------
function renderAbs() {
    if (!currentUser) return;
    const y = String(vacYear), today = localDate(), cnt = {}, ranges = [];
    ABS_ORDER.forEach(t => {
        const dates = [...new Set(workEntries.filter(e => typeOf(e) === t && e.date?.startsWith(y)).map(e => e.date))].sort(); cnt[t] = dates.length;
        dates.forEach(d => { const l = ranges.find(r => r.t === t && nextWork(r.to) === d); if (l) { l.to = d; l.n++; } else ranges.push({ t, from: d, to: d, n: 1 }); });
    });
    $('abs-year').innerText = y;
    $('abs-kpis').innerHTML = ['vacation', 'sick', 'flex'].map(t => `<div style="--c:${TYPES[t][3]}"><small><i class="fa-solid ${ABS_ICON[t]}" style="color:${TYPES[t][2]}"></i>${TYPES[t][0]}</small><b>${cnt[t]}</b><small>${cnt[t] === 1 ? 'Tag' : 'Tage'}</small></div>`).join('');
    ranges.sort((a, b) => b.from.localeCompare(a.from));
    $('abs-list').innerHTML = ranges.length ? ranges.map(r => { const T = TYPES[r.t], past = r.to < today; return `<div class="vr"><span class="d ${past ? 'mut' : ''}"><i class="fa-solid ${ABS_ICON[r.t]}" style="color:${past ? '#64748b' : T[2]};margin-right:7px"></i>${gdShort(r.from)}${r.from !== r.to ? ' – ' + gdShort(r.to) : ''} · ${r.n} ${r.n === 1 ? 'Tag' : 'Tage'}</span>
        <span class="chip ${T[4]}">${T[0]}</span><span class="acts"><button onclick="delAbsRange('${r.t}','${r.from}','${r.to}')" class="ux-ib bad" title="Zeitraum löschen" aria-label="Zeitraum löschen"><i class="fa-solid fa-trash-can"></i></button></span></div>`; }).join('')
        : `<div class="ux-empty"><i class="fa-solid fa-calendar-check"></i>Keine Abwesenheiten in ${y}.</div>`;
}
async function delAbsRange(t, from, to) {
    const list = workEntries.filter(e => typeOf(e) === t && e.date >= from && e.date <= to);
    if (!list.length || !(await uiConfirm(`${TYPES[t][0]} vom ${gdShort(from)} bis ${gdShort(to)} (${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'}) löschen?`, { danger: true, ok: 'Löschen' }))) return;
    run(async () => { const b = db.batch(); list.forEach(e => b.delete(db.collection('worktime').doc(e.id))); await b.commit(); logSystemEvent('data', 'Abwesenheit gelöscht', { type: t, von: from, bis: to }); });
}

// ---------- Urlaubsantrag ----------
const wdays = (a, b) => { const out = []; for (const d = parse(a), e = parse(b); d <= e; d.setDate(d.getDate() + 1)) if (isWork(d)) out.push(localDate(d)); return out; };
const longDate = ds => parse(ds).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const vacDays = () => new Set(workEntries.filter(x => typeOf(x) === 'vacation').map(x => x.date));

function openVacReq(from, to) {
    $('vr-from').value = from || localDate(); $('vr-to').value = to || from || localDate();
    $('vr-type').value = 'Erholungsurlaub'; $('vr-dept').value = lsGet('vr_dept'); $('vr-boss').value = lsGet('vr_boss');
    ['vr-sub', 'vr-contact', 'vr-note'].forEach(i => $(i).value = ''); $('vr-book').checked = true; $('vr-book').disabled = false;
    updateVacReq(); openModal('modal-vacreq');
}
function updateVacReq() {
    const from = $('vr-from').value, to = $('vr-to').value, box = $('vr-info');
    if (!from || !to || to < from) { box.innerText = 'Bitte einen gültigen Zeitraum wählen.'; return; }
    const days = wdays(from, to), year = +from.slice(0, 4), st = vacStats(year), have = vacDays();
    const inYear = days.filter(d => d.startsWith(String(year))), already = inYear.filter(d => have.has(d)).length, before = st.left + already, after = before - inYear.length;
    box.innerHTML = days.length ? `<b>${days.length} Arbeitstage</b> · Resturlaub ${year}: vorher ${before}, nachher <b class="${after < 0 ? 'neg' : ''}">${after}</b>${after < 0 ? ' (Anspruch überschritten)' : ''}` : 'Im Zeitraum liegt kein Arbeitstag (Wochenende oder Feiertag).';
    const newDays = days.filter(d => !have.has(d)), bookable = $('vr-type').value === 'Erholungsurlaub' && newDays.length > 0;
    if (bookable && $('vr-book').disabled) $('vr-book').checked = true;
    $('vr-book').disabled = !bookable; if (!bookable) $('vr-book').checked = false;
    $('vr-book-wrap').classList.toggle('dim', !bookable);
}
async function bookVacation(days) {
    const b = db.batch();
    days.forEach(date => b.set(db.collection('worktime').doc(), { type: 'vacation', date, start: '', end: '', pauseMinutes: 0, netMinutes: dayMinOf(date), note: 'Urlaub', owner: currentUser.email, createdAt: TS() }));
    await b.commit(); return days.length;
}
async function submitVacReq(e) {
    e.preventDefault();
    const from = $('vr-from').value, to = $('vr-to').value;
    if (to < from) return alert('Das Enddatum liegt vor dem Startdatum.');
    const days = wdays(from, to); if (!days.length) return alert('Im Zeitraum liegt kein Arbeitstag.');
    const w = window.open('', '_blank');          // sofort öffnen, sonst blockiert der Browser das Fenster
    if (!w) return alert('Das Druckfenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.');
    const f = { type: $('vr-type').value, dept: $('vr-dept').value.trim(), boss: $('vr-boss').value.trim(), sub: $('vr-sub').value.trim(), contact: $('vr-contact').value.trim(), note: $('vr-note').value.trim() };
    lsSet('vr_dept', f.dept); lsSet('vr_boss', f.boss);
    const year = from.slice(0, 4), st = vacStats(+year), have = vacDays(), inYear = days.filter(d => d.startsWith(year));
    const already = inYear.filter(d => have.has(d)).length, info = { year, total: st.total, used: st.taken + st.planned - already, before: st.left + already, req: inYear.length };
    let booked = 0;
    if ($('vr-book').checked && !$('vr-book').disabled) {
        const newDays = days.filter(d => !have.has(d)), nIn = newDays.filter(d => d.startsWith(year)).length;
        if (st.left - nIn < 0 && !(await uiConfirm(`Mit diesen ${nIn} Tagen überschreitest du deinen Urlaubsanspruch ${year}. Trotzdem vormerken?`))) { w.close(); return; }
        try { booked = await bookVacation(newDays); } catch (err) { w.close(); return alert('Fehler: ' + err.message); }
    }
    printVacReq(w, from, to, days, f, info);
    closeModal('modal-vacreq');
    logSystemEvent('data', 'Urlaubsantrag erstellt', { von: from, bis: to, tage: days.length, vorgemerkt: booked });
}
function printVacReq(w, from, to, days, f, k) {
    const row = (a, b) => `<tr><th>${a}</th><td colspan="3">${b || '&nbsp;'}</td></tr>`, after = k.before - k.req;
    w.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Urlaubsantrag_${esc(currentUser.name)}_${from}</title>
    <style>@page{size:A4;margin:16mm}body{font-family:system-ui,Arial,sans-serif;color:#0f172a;font-size:13px;line-height:1.45}h1{font-size:28px;margin:0 0 2px}.sub{color:#475569;margin-bottom:6px}
    h2{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:#475569;margin:22px 0 6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px}table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #cbd5e1;padding:7px 9px;text-align:left;vertical-align:top}th{background:#f1f5f9;width:23%;font-weight:600;font-size:12px}.num{text-align:right;font-variant-numeric:tabular-nums}
    .sig{display:flex;gap:40px;margin-top:48px}.sig div{flex:1;border-top:1px solid #0f172a;padding-top:4px;font-size:11px;color:#475569}.box{display:inline-block;width:13px;height:13px;border:1.5px solid #0f172a;margin:0 6px -2px 0}
    .line{border-bottom:1px solid #94a3b8;height:24px}small{color:#64748b}@media print{.noprint{display:none}}</style></head><body>
    <button class="noprint" onclick="window.print()" style="background:#0284c7;color:#fff;border:0;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;margin-bottom:14px">Drucken / Als PDF speichern</button>
    <h1>Urlaubsantrag</h1><div class="sub">${esc(f.type)}</div>
    <table>${`<tr><th>Name</th><td>${esc(currentUser.name)}</td><th>Abteilung / Personal-Nr.</th><td>${esc(f.dept) || '&nbsp;'}</td></tr>`}${row('An', esc(f.boss))}</table>
    <h2>Beantragter Urlaub</h2>
    <table><tr><th>Von</th><td>${longDate(from)}</td><th>Bis (einschließlich)</th><td>${longDate(to)}</td></tr>
    <tr><th>Arbeitstage</th><td><b>${days.length}</b><br><small>ohne Wochenenden und gesetzliche Feiertage (NRW)</small></td><th>Erster Arbeitstag danach</th><td>${longDate(nextWork(to))}</td></tr>
    ${row('Vertretung', esc(f.sub))}${row('Erreichbar unter', esc(f.contact))}${row('Bemerkung', esc(f.note))}</table>
    <h2>Urlaubskonto ${k.year}</h2>
    <table><tr><th>Anspruch (inkl. Resturlaub Vorjahr)</th><td class="num">${k.total} Tage</td><th>Bereits genommen / eingeplant</th><td class="num">${k.used} Tage</td></tr>
    <tr><th>Resturlaub vor diesem Antrag</th><td class="num">${k.before} Tage</td><th>Beantragt</th><td class="num">${k.req} Tage</td></tr>
    <tr><th>Resturlaub nach Genehmigung</th><td class="num" colspan="3"><b>${after} Tage</b></td></tr></table>
    <div class="sig"><div>Ort, Datum</div><div>Unterschrift Antragsteller/in</div></div>
    <h2>Entscheidung des/der Vorgesetzten</h2>
    <p><span class="box"></span>genehmigt &nbsp;&nbsp;&nbsp; <span class="box"></span>abgelehnt &nbsp;&nbsp;&nbsp; <span class="box"></span>mit Änderung</p>
    <div class="line"></div><div class="line"></div>
    <div class="sig"><div>Ort, Datum</div><div>Unterschrift Vorgesetzte/r</div></div>
    <p style="margin-top:28px;color:#94a3b8;font-size:10px">Erstellt am ${new Date().toLocaleDateString('de-DE')} mit dem J.Mainz Dashboard</p></body></html>`);
    w.document.close();
}

// ---------- Export ----------
function monthData() {
    const m = selMonth(), list = workEntries.filter(w => w.date?.startsWith(m)).sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''));
    const last = `${m}-${String(new Date(+m.slice(0, 4), +m.slice(5), 0).getDate()).padStart(2, '0')}`, to = last < localDate() ? last : localDate();
    const ist = sumNet(list.filter(w => w.date <= to)), soll = sollMin(`${m}-01`, to);
    return { m, list, ist, soll, saldo: ist - soll, days: new Set(list.filter(w => typeOf(w) === 'work').map(w => w.date)).size };
}
const gd = d => d.split('-').reverse().join('.');

function exportWorkCSV() {
    const { m, list, ist, soll, saldo, days } = monthData();
    if (!list.length) return alert('Keine Einträge für den ausgewählten Monat vorhanden.');
    let csv = `\uFEFFARBEITSZEITNACHWEIS / STUNDENZETTEL\r\nMitarbeiter:;${csvCell(currentUser.name)}\r\nAbrechnungsmonat:;${monthLabel(m)}\r\nErstellt am:;${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')} Uhr\r\n\r\n`;
    csv += 'Wochentag;Datum;Beginn;Ende;Pause (Min);Netto-Arbeitszeit;Stunden (Dezimal);Art;Tätigkeit / Projekt\r\n';
    list.forEach(e => {
        const net = e.netMinutes || 0, t = typeOf(e);
        csv += `${WD[parse(e.date).getDay()]};${gd(e.date)};${csvCell(e.start)};${csvCell(e.end)};${t === 'work' ? pauseOf(e) : ''};${Math.floor(net / 60)}:${String(net % 60).padStart(2, '0')};${(net / 60).toFixed(2).replace('.', ',')};${TYPES[t][0]};${csvCell(e.note)}\r\n`;
    });
    csv += `\r\n;;;;ISTSTUNDEN;${hm(ist)};${(ist / 60).toFixed(2).replace('.', ',')}\r\n;;;;SOLLSTUNDEN;${hm(soll)};${(soll / 60).toFixed(2).replace('.', ',')}\r\n;;;;DIFFERENZ;${sg(saldo)}\r\n;;;;ARBEITSTAGE;${days}\r\n\r\n\r\n`;
    csv += 'Bestätigung der Arbeitszeiten:\r\n\r\n__________________________________;;;;__________________________________\r\nUnterschrift Arbeitnehmer;;;;Unterschrift Arbeitgeber\r\n';
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })), download: `Stundenzettel_${currentUser.name.replace(/\s+/g, '_')}_${m}.csv` });
    document.body.appendChild(a); a.click(); a.remove(); logSystemEvent('data', 'Stundenzettel als CSV exportiert', { monat: m });
}

function printWorkTimesheet() {
    const { m, list, ist, soll, saldo, days } = monthData();
    if (!list.length) return alert('Keine Einträge für den ausgewählten Monat vorhanden.');
    const rows = list.map(e => {
        const t = typeOf(e), net = e.netMinutes || 0;
        return `<tr><td>${WD[parse(e.date).getDay()]}</td><td><b>${gd(e.date)}</b></td><td>${t === 'work' ? esc(e.start || '') : '—'}</td><td>${t === 'work' ? esc(e.end || '') : '—'}</td><td>${t === 'work' ? pauseOf(e) + ' Min' : '—'}</td><td><b>${hm(net)}</b></td><td>${t !== 'work' ? '<i>' + TYPES[t][0] + '</i> ' : ''}${esc(t === 'work' ? e.note || '' : (e.note !== TYPES[t][0] ? e.note : ''))}</td></tr>`;
    }).join('');
    const w = window.open('', '_blank');
    if (!w) return alert('Das Druckfenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.');
    w.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Stundenzettel_${esc(currentUser.name)}_${esc(m)}</title>
        <style>body{font-family:system-ui,sans-serif;color:#0f172a;padding:30px}h1{margin:0 0 4px;font-size:24px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:15px;margin-bottom:25px;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:30px}th{background:#f1f5f9;padding:10px;text-align:left;border-bottom:2px solid #cbd5e1}td{padding:8px 10px;border-bottom:1px solid #e2e8f0}
        .sum{display:flex;justify-content:space-around;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:15px;margin-bottom:40px;text-align:center}.sum b{display:block;font-size:19px}.sum span{font-size:11px;text-transform:uppercase;color:#64748b}
        .sig{display:flex;justify-content:space-between;margin-top:60px;font-size:12px}.sig div{width:220px;border-top:1px solid #0f172a;padding-top:6px;text-align:center}@media print{button{display:none}body{padding:0}}</style></head><body>
        <button onclick="window.print()" style="background:#2563eb;color:#fff;border:0;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;margin-bottom:15px">Drucken / Als PDF speichern</button>
        <div class="head"><div><h1>MONATLICHER STUNDENZETTEL</h1><div style="color:#2563eb;font-weight:600">J.Mainz Dashboard &bull; Zeiterfassung</div></div>
        <div style="text-align:right"><div><b>Mitarbeiter:</b> ${esc(currentUser.name)}</div><div><b>Abrechnungsmonat:</b> ${esc(monthLabel(m))}</div><div><b>Gedruckt am:</b> ${new Date().toLocaleDateString('de-DE')}</div></div></div>
        <div class="sum"><div><span>Ist</span><b>${hm(ist)}</b></div><div><span>Soll</span><b>${hm(soll)}</b></div><div><span>Differenz</span><b>${sg(saldo)}</b></div><div><span>Arbeitstage</span><b>${days}</b></div></div>
        <table><thead><tr><th>Tag</th><th>Datum</th><th>Kommen</th><th>Gehen</th><th>Pause</th><th>Netto</th><th>Tätigkeit / Art</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="sig"><div>Datum, Unterschrift Arbeitnehmer</div><div>Datum, Unterschrift Arbeitgeber</div></div></body></html>`);
    w.document.close(); logSystemEvent('data', 'Stundenzettel gedruckt', { monat: m });
}
