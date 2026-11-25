// js/pages/finanzen.js - Seiten-Code von /finanzen.html (ausgelagert, damit der Browser ihn zwischenspeichern kann)
const openModal = id => $(id).classList.remove('hidden'), closeModal = id => $(id).classList.add('hidden');
const run = async fn => { try { await fn(); } catch (e) { alert('Fehler: ' + e.message); } };
const eur = n => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const sgn = n => (n > 0 ? '+' : '') + eur(n);
const monthLabel = ym => new Date(+ym.slice(0, 4), +ym.slice(5) - 1, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
// Kategorien: zwei für Einnahmen, elf für Ausgaben. „Sparen“ und „Schulden“ lassen sich mit einem Sparglas bzw. einer Schuld verknüpfen.
const SAVE = 'Sparen / Rücklagen', DEBT = 'Schulden / Rückzahlungen';
const CAT_IN = ['Einnahmen', 'Sonstige Einnahmen'];
const CAT_OUT = ['Wohnen', 'Versicherungen', 'Abos', 'Gesundheit', 'Auto', 'Lebensmittel', 'Freizeit', 'Gastro', SAVE, DEBT, 'Sonstiges'];
const CATS = [...CAT_IN, ...CAT_OUT];
const CAT_HINT = { 'Einnahmen': 'Gehalt, Lohn, Rente', 'Sonstige Einnahmen': 'Rückzahlungen, Verkäufe, Geschenke', 'Wohnen': 'Miete, Strom, Internet', 'Versicherungen': 'Haftpflicht, Hausrat …', 'Abos': 'Streaming, Handy, Fitness',
    'Gesundheit': 'Medikamente, Zuzahlungen', 'Auto': 'Rate, Versicherung, Tanken, Reparaturen', 'Lebensmittel': 'Supermarkt, Bäcker, Drogerie', 'Freizeit': 'Games, Shopping', 'Gastro': 'Restaurant, Lieferdienst, Café',
    [SAVE]: 'in ein Sparglas', [DEBT]: 'an eine offene Schuld', 'Sonstiges': '' };
// [Farbe, Farbe als r,g,b, Symbol]
const CATM = {
    'Einnahmen': ['#facc15', '250,204,21', 'fa-coins'], 'Sonstige Einnahmen': ['#a3e635', '163,230,53', 'fa-hand-holding-dollar'], 'Wohnen': ['#818cf8', '129,140,248', 'fa-house'],
    'Versicherungen': ['#22d3ee', '34,211,238', 'fa-shield-halved'], 'Abos': ['#c084fc', '192,132,252', 'fa-film'], 'Gesundheit': ['#f87171', '248,113,113', 'fa-heart-pulse'], 'Auto': ['#fb923c', '251,146,60', 'fa-car'],
    'Lebensmittel': ['#34d399', '52,211,153', 'fa-cart-shopping'], 'Freizeit': ['#f472b6', '244,114,182', 'fa-gamepad'], 'Gastro': ['#fbbf24', '251,191,36', 'fa-utensils'],
    [SAVE]: ['#2dd4bf', '45,212,191', 'fa-piggy-bank'], [DEBT]: ['#fb7185', '251,113,133', 'fa-hand-holding-dollar'], 'Sonstiges': ['#94a3b8', '148,163,184', 'fa-wallet']
};
const catM = c => CATM[c] || CATM['Sonstiges'];
// Alte Kategorien (bis November 2026) werden beim Lesen auf die neuen umgestellt
const OLDCAT = { 'Supermarkt': 'Lebensmittel', 'Gehalt': 'Einnahmen', 'Miete / Wohnen': 'Wohnen', 'Tanken / Auto': 'Auto', 'Freizeit / Abo': 'Freizeit', 'Versicherung': 'Versicherungen' };
const normCat = (c, amt) => { c = OLDCAT[c] || c || ''; if (amt > 0 && (!CAT_IN.includes(c))) return c === 'Sonstiges' || !CATS.includes(c) ? 'Sonstige Einnahmen' : c; return CATS.includes(c) ? c : 'Sonstiges'; };
const catOpts = (kind, val) => (kind === 'in' ? CAT_IN : CAT_OUT).map(c => `<option value="${c}"${c === val ? ' selected' : ''}>${c}${CAT_HINT[c] ? ' – ' + CAT_HINT[c] : ''}</option>`).join('');
const tone = n => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const INT = { 1: 'monatlich', 3: 'vierteljährlich', 6: 'halbjährlich', 12: 'jährlich' };
const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };

let tx = [], pays = [], fixes = [], invs = [], budgets = {}, goals = [], debts = [], started = false;
let todayStr = localDate().slice(0, 7);
setInterval(() => { todayStr = localDate().slice(0, 7); }, 60000);

// ---------- Anpassbares Layout (js/layout.js) ----------
// [Kennung, Name, Standardbreite in Zwölfteln]
const LAY = [['hero', 'Saldo', 4], ['inc', 'Einnahmen', 4], ['exp', 'Ausgaben', 4], ['fix', 'Fixkosten pro Monat', 4], ['sav', 'Sparen & Schulden pro Monat', 4], ['trend', 'Die letzten 6 Monate', 8], ['cat', 'Ausgaben nach Kategorie', 4], ['bud', 'Budgets', 8], ['fc', 'Prognose Monatsende', 4], ['top', 'Größte Ausgaben', 4], ['inv', 'Nächste Rechnungen', 4]];
const LAY_PRESETS = {
    'Standard': {},
    'Kompakt': { order: ['hero', 'inc', 'exp', 'fix', 'bud', 'cat'], hidden: ['trend', 'fc', 'top'], width: { hero: 6, inc: 3, exp: 3, fix: 6, bud: 6, cat: 6 } },
    'Fokus Budgets': { order: ['bud', 'hero', 'cat', 'fc', 'inc', 'exp'], hidden: ['fix', 'trend', 'top'], width: { bud: 8, hero: 4, cat: 6, fc: 6, inc: 6, exp: 6 } }
};
Layout.init({
    key: 'fin', root: $('tab-ov'), modules: LAY.map(([id, title, w]) => ({ id, title, w, el: $('mod-' + id) })), presets: LAY_PRESETS,
    tabs: { items: [['ov', 'Übersicht'], ['tx', 'Buchungen'], ['fix', 'Fixkosten'], ['sav', 'Sparen & Schulden'], ['inv', 'Rechnungen'], ['pay', 'Lohn']].map(([id, title]) => ({ id, title, el: document.querySelector(`.tab[data-tab="${id}"]`) })) },
    onTabs: () => { if (started) showTab(curTab); }, onEdit: on => { if (on && started) showTab('ov'); },
    save: async l => {
        await db.collection('users').doc(currentUser.uid).update({ 'userPrefs.layouts.fin': l });
        currentUser.userPrefs = { ...(currentUser.userPrefs || {}), layouts: { ...((currentUser.userPrefs || {}).layouts || {}), fin: l } }; logSystemEvent('data', 'Layout gespeichert', { seite: 'fin' });
    }
});

initAuthGuard(user => {
    if (!user || started) return;
    started = true;
    renderDrawer();
    const mine = c => db.collection(c).where('owner', '==', currentUser.email);
    const list = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
    $('tx-cat').innerHTML = '<option value="">Alle Kategorien</option>' + CATS.map(c => `<option>${c}</option>`).join('');
    $('iv-category').innerHTML = CAT_OUT.map(c => `<option>${c}</option>`).join('');
    $('tx-kind').addEventListener('change', () => { $('tx-category').innerHTML = catOpts($('tx-kind').value, $('tx-kind').value === 'in' ? 'Einnahmen' : 'Sonstiges'); linkUI('tx'); });
    $('fx-kind').addEventListener('change', () => { $('fx-category').innerHTML = catOpts($('fx-kind').value, $('fx-kind').value === 'in' ? 'Einnahmen' : 'Wohnen'); linkUI('fx'); });
    $('tx-category').addEventListener('change', () => linkUI('tx')); $('fx-category').addEventListener('change', () => linkUI('fx'));
    $('goal-list').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) goalAction(b.dataset.g, b.dataset.id); });
    $('debt-list').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) debtAction(b.dataset.d, b.dataset.id); });
    goalPicsWire();
    invWire();
    $('fx-start').innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${new Date(2000, i, 1).toLocaleString('de-DE', { month: 'long' })}</option>`).join('');
    $('tx-body').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) b.dataset.act === 'edit' ? openTx(b.dataset.id) : delTx(b.dataset.id); });
    $('fix-list').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) fixAction(b.dataset.act, b.dataset.id); });
    $('pay-list').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) delPayslip(b.dataset.del); });
    const want = location.hash.slice(1);                       // Adresse merken, bevor das Layout die Reiter neu ordnet
    Layout.load(currentUser.userPrefs?.layouts?.fin);
    showTab(want || Layout.firstTab() || 'ov');
    mine('finance_transactions').onSnapshot(s => { tx = list(s).map(t => ({ ...t, category: normCat(t.category, t.amount) })); renderAll(); });
    mine('finance_goals').onSnapshot(s => { goals = list(s).sort((a, b) => String(a.name).localeCompare(String(b.name), 'de')); renderAll(false); }, () => {});
    mine('finance_debts').onSnapshot(s => { debts = list(s).sort((a, b) => String(a.name).localeCompare(String(b.name), 'de')); renderAll(false); }, () => {});
    mine('payslips').onSnapshot(s => { pays = list(s); renderAll(); });
    mine('fixed_costs').onSnapshot(s => { fixes = list(s).map(f => ({ ...f, category: normCat(f.category, f.amount) })); renderAll(); }, () => {});
    mine('invoices').onSnapshot(s => { invs = list(s); renderInv(); }, () => { invs = []; renderInv(); });
    db.collection('finance_settings').doc(currentUser.uid).onSnapshot(d => { const raw = d.exists ? (d.data().budgets || {}) : {}; budgets = {}; Object.entries(raw).forEach(([k, v]) => { const n = normCat(k, -1); budgets[n] = (budgets[n] || 0) + v; }); renderAll(); }, () => {});
}, { perm: 'finanzen' });

let curTab = 'ov';
function showTab(t) {
    if (!$('tab-' + t) || Layout.tabHidden(t)) t = Layout.firstTab() || 'ov';          // ausgeblendete Reiter öffnen nicht
    curTab = t;
    ['ov', 'tx', 'fix', 'sav', 'inv', 'pay'].forEach(k => $('tab-' + k).classList.toggle('hidden', k !== t));
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    history.replaceState(null, '', '#' + t);
    if (t === 'ov') Layout.refresh();
}

window.addEventListener('hashchange', () => showTab(location.hash.slice(1) || 'ov'));

// ---------- Helfer ----------
const ym = () => $('fm').value || todayStr;
const monthTx = m => tx.filter(t => t.date?.startsWith(m));
const sums = list => list.reduce((s, t) => { if (t.amount > 0) s.inc += t.amount; else s.exp += -t.amount; return s; }, { inc: 0, exp: 0 });
const isDue = (f, m) => f.active !== false && ((+m.slice(5) - f.startMonth + 12) % 12) % f.interval === 0;
const dueDate = (f, m) => `${m}-${String(Math.min(f.day, new Date(+m.slice(0, 4), +m.slice(5), 0).getDate())).padStart(2, '0')}`;
const fixTxId = (f, m) => `fix_${f.id}_${m}`;
const isBooked = (f, m) => tx.some(t => t.id === fixTxId(f, m));
const nextDue = f => { for (let i = 0; i < 12; i++) { const m = localDate(new Date(+todayStr.slice(0, 4), +todayStr.slice(5) - 1 + i, 1)).slice(0, 7); if (isDue(f, m)) return m; } return null; };

const shiftMonth = (m, d) => localDate(new Date(+m.slice(0, 4), +m.slice(5) - 1 + d, 1)).slice(0, 7);
function monthShift(dir) { const s = $('fm'), i = s.selectedIndex + dir; if (i >= 0 && i < s.options.length) { s.selectedIndex = i; renderAll(false); } }

function renderAll(refreshMonths = true) {
    queueMicrotask(renderInv);
    if (refreshMonths) {
        const sel = $('fm'), prev = sel.value, set = new Set([todayStr]);
        tx.forEach(t => { if (t.date?.length >= 7) set.add(t.date.slice(0, 7)); });
        pays.forEach(p => { if (p.month) set.add(p.month); });
        const sorted = [...set].sort().reverse();
        sel.innerHTML = sorted.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
        sel.value = sorted.includes(prev) ? prev : todayStr;      // beim Öffnen der aktuelle Monat (nicht ein späterer mit Lohnabrechnung)
    }
    const m = ym(), cur = monthTx(m), { inc, exp } = sums(cur), bal = inc - exp, prevTx = monthTx(shiftMonth(m, -1)), P = sums(prevTx);
    const fixOut = fixes.filter(f => f.active !== false && f.amount < 0).reduce((s, f) => s - f.amount / f.interval, 0);
    $('ux-sub').textContent = 'Dein Überblick für ' + monthLabel(m);
    UX.setMoney($('k-bal'), bal, { signed: true, tone: bal >= 0 ? 'pos' : 'neg' }); UX.setMoney($('k-inc'), inc); UX.setMoney($('k-exp'), exp); UX.setMoney($('k-fix'), fixOut);
    $('k-sum').innerText = `Einnahmen ${eur(inc)} · Ausgaben ${eur(exp)}`;
    const rate = inc > 0 ? bal / inc : null; $('k-rate').innerText = rate === null ? '–' : Math.round(rate * 100) + ' %'; UX.ring($('rate-arc'), rate > 0 ? rate : 0);
    const dl = $('k-delta'); if (prevTx.length) { const d = bal - (P.inc - P.exp); dl.innerText = `${sgn(d)} zum Vormonat`; dl.className = 'chip ' + (d >= 0 ? 'g' : 'r'); } else { dl.innerText = 'kein Vormonat'; dl.className = 'chip'; }
    const ec = $('k-exp-chip'); if (P.exp > 0) { const p = Math.round((exp - P.exp) / P.exp * 100); ec.innerText = `${p > 0 ? '+' : ''}${p} % zum Vormonat`; ec.className = 'chip ' + (p > 0 ? 'r' : 'g'); } else { { const n = cur.filter(t => t.amount < 0).length; ec.innerText = `${n} ${n === 1 ? 'Ausgabe' : 'Ausgaben'}`; } ec.className = 'chip'; }
    { const n = cur.filter(t => t.amount > 0).length; $('k-inc-chip').innerText = `${n} ${n === 1 ? 'Einnahme' : 'Einnahmen'}`; }
    const open = fixes.filter(f => isDue(f, m) && !isBooked(f, m)).length, fc = $('k-fix-chip'); fc.innerText = open ? `${open} noch offen` : 'alles gebucht'; fc.className = 'chip ' + (open ? 'a' : 'g');
    renderOverview(m, inc, exp, bal); renderTx(); renderFix(); renderPays(); renderSav(m);
}

// ---------- Übersicht ----------
function renderOverview(m, inc, exp, bal) {
    // Verlauf des Saldos im Monat (Linie mit Fläche)
    const dim = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate(), lastDay = m === todayStr ? +localDate().slice(8) : dim, perDay = {};
    monthTx(m).forEach(t => { const d = +t.date.slice(8); perDay[d] = (perDay[d] || 0) + t.amount; });
    const cum = []; let acc = 0; for (let d = 1; d <= lastDay; d++) { acc += perDay[d] || 0; cum.push(acc); }
    const lo = Math.min(0, ...cum), hi = Math.max(0, ...cum), span = hi - lo || 1, Y = v => 80 - (v - lo) / span * 68;
    const pts = cum.length > 1 ? cum.map((v, i) => [i / (cum.length - 1) * 400, Y(v)]) : [[0, Y(cum[0] || 0)], [400, Y(cum[0] || 0)]];
    const line = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L'), end = pts[pts.length - 1];
    $('hero-line').setAttribute('d', line); $('hero-fill').setAttribute('d', line + ' L400 90 L0 90 Z'); $('hero-dot').setAttribute('cx', end[0].toFixed(1)); $('hero-dot').setAttribute('cy', end[1].toFixed(1));

    // Ausgaben nach Kategorie: Donut und Legende
    const byCat = {};
    monthTx(m).filter(t => t.amount < 0).forEach(t => { const c = t.category || 'Sonstiges'; byCat[c] = (byCat[c] || 0) - t.amount; });
    const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]), total = rows.reduce((s, r) => s + r[1], 0);
    $('donut').innerHTML = '<circle class="trk" cx="85" cy="85" r="64" stroke-width="22"/>' + rows.map(([c, v]) => `<circle class="arc" data-c="${esc(c)}" cx="85" cy="85" r="64" stroke="${catM(c)[0]}" stroke-width="22" style="stroke-linecap:butt"/>`).join('');
    let off = 0; $('donut').querySelectorAll('.arc').forEach((el, i) => { const f = rows[i][1] / total; UX.ring(el, f, off); off += f; });
    $('donut-total').innerText = total ? eur(total) : '–';
    $('cat-legend').innerHTML = rows.length ? rows.map(([c, v]) => `<div title="${esc(eur(v))}"><i style="background:${catM(c)[0]}"></i>${esc(c)}<b>${Math.round(v / total * 100)} %</b></div>`).join('') : '<div class="ux-note">Keine Ausgaben in diesem Monat.</div>';

    // Budgets
    const bl = CATS.filter(c => budgets[c] > 0);
    $('bud-list').innerHTML = bl.length ? bl.map(c => {
        const v = byCat[c] || 0, b = budgets[c], pct = v / b, col = pct >= 1 ? 'linear-gradient(90deg,#e11d48,#fb7185)' : pct >= .8 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#10b981,#34d399)';
        return `<div class="bud" style="--bb:${col}"><div class="h"><i class="fa-solid ${catM(c)[2]}" style="color:${catM(c)[0]}"></i>${esc(c)}<span class="${pct >= 1 ? 'neg' : ''}">${eur(v)} von ${eur(b)}</span></div>
            <div class="bar"><i style="width:${Math.min(100, pct * 100).toFixed(1)}%"></i></div><div class="ux-note" style="margin-top:5px">${pct >= 1 ? 'überschritten um ' + eur(v - b) : 'noch ' + eur(b - v)}</div></div>`;
    }).join('') : '<div class="ux-note">Noch keine Budgets. Lege pro Kategorie ein Limit fest, dann siehst du hier, wie viel noch übrig ist.</div>';

    // Prognose
    const open = fixes.filter(f => isDue(f, m) && !isBooked(f, m)), openSum = open.reduce((s, f) => s + f.amount, 0);
    $('forecast').innerHTML = m !== todayStr ? '<div class="ux-note">Die Prognose gibt es nur für den laufenden Monat.</div>' : `
        <div class="fc"><span>Aktueller Saldo</span><b class="${tone(bal)}">${sgn(bal)}</b></div>
        <div class="fc"><span>Offene Fixkosten (${open.length})</span><b class="${tone(openSum)}">${sgn(openSum)}</b></div>
        <div class="fc sum"><span>Erwartetes Monatsende</span><b class="${tone(bal + openSum)}">${sgn(bal + openSum)}</b></div>`;

    // Letzte 6 Monate
    const months = Array.from({ length: 6 }, (_, i) => shiftMonth(m, -(5 - i)));
    const data = months.map(k => ({ k, ...sums(monthTx(k)) })), top = Math.max(1, ...data.flatMap(d => [d.inc, d.exp]));
    $('trend').innerHTML = data.map((d, i) => `<div class="col${d.k === m ? ' now' : ''}" title="${esc(monthLabel(d.k))}: +${eur(d.inc)} / −${eur(d.exp)}"><div class="bw">
        <i style="height:${d.inc ? Math.max(4, d.inc / top * 100) : 0}%;--i:${i * 4};--bc:linear-gradient(180deg,#4ade80,#16a34a)"></i><i style="height:${d.exp ? Math.max(4, d.exp / top * 100) : 0}%;--i:${i * 4 + 2};--bc:linear-gradient(180deg,#fb7185,#e11d48)"></i></div>
        <span>${new Date(2000, +d.k.slice(5) - 1, 1).toLocaleString('de-DE', { month: 'short' }).replace('.', '')}</span></div>`).join('');

    // Größte Ausgaben
    const big = monthTx(m).filter(t => t.amount < 0).sort((a, b) => a.amount - b.amount).slice(0, 5);
    $('top-exp').innerHTML = big.length ? big.map((t, i) => `<div class="row"><div class="rank">${i + 1}</div><div class="n"><div class="ell">${esc(t.partner)}</div><small>${esc(t.category || 'Sonstiges')}</small></div><div class="a neg">${eur(-t.amount)}</div></div>`).join('') : '<div class="ux-note">Keine Ausgaben.</div>';
}

// ---------- Buchungen ----------
function dayName(d) {
    const today = localDate(), y = localDate(new Date(Date.now() - 864e5)); const p = d.split('-');
    return (d === today ? 'Heute · ' : d === y ? 'Gestern · ' : '') + WD[new Date(+p[0], +p[1] - 1, +p[2]).getDay()] + '., ' + p[2] + '.' + p[1] + '.';
}
function txShown() {
    const q = $('tx-q').value.toLowerCase(), c = $('tx-cat').value, ty = $('tx-type').value;
    return monthTx(ym()).filter(t => (!c || (t.category || 'Sonstiges') === c) && (!ty || (ty === 'in') === (t.amount > 0)) && (!q || `${t.partner} ${t.purpose || ''}`.toLowerCase().includes(q)));
}
function renderTx() {
    const list = txShown().sort((a, b) => b.date.localeCompare(a.date));
    let last = '', html = '';
    list.forEach((t, i) => {
        if (t.date !== last) { last = t.date; html += `<div class="day">${esc(dayName(t.date))}</div>`; }
        const [col, cr, ic] = catM(t.category || 'Sonstiges');
        html += `<div class="row" style="--c:${col};--cr:${cr};animation-delay:${Math.min(i, 10) * 20}ms"><div class="tile"><i class="fa-solid ${ic}"></i></div>
            <div class="n"><div class="ell" title="${esc(t.purpose || '')}">${t.fixedId ? '<i class="fa-solid fa-repeat" style="color:#22d3ee;font-size:11px;margin-right:6px"></i>' : ''}${esc(t.partner)}</div><small>${esc(t.category || 'Sonstiges')}${t.label ? ' · <b>' + esc(t.label) + '</b>' : ''}${linkName(t) ? ' · <i class="fa-solid fa-link"></i> ' + esc(linkName(t)) : ''}${t.purpose ? ' · ' + esc(t.purpose) : ''}</small></div>
            <div class="a ${t.amount > 0 ? 'pos' : 'neg'}">${sgn(t.amount)}</div>
            <div class="acts"><button data-act="edit" data-id="${esc(t.id)}" class="ux-ib" title="Bearbeiten" aria-label="Bearbeiten"><i class="fa-solid fa-pen-to-square"></i></button>
            <button data-act="del" data-id="${esc(t.id)}" class="ux-ib bad" title="Löschen" aria-label="Löschen"><i class="fa-solid fa-trash-can"></i></button></div></div>`;
    });
    $('tx-body').innerHTML = html || '<div class="ux-empty"><i class="fa-solid fa-wallet"></i>Keine Buchungen gefunden.</div>';
    const s = sums(list);
    $('tx-sum').innerText = `${list.length} ${list.length === 1 ? 'Buchung' : 'Buchungen'} · Einnahmen ${eur(s.inc)} · Ausgaben ${eur(s.exp)}`;
}

function openTx(id = '') {
    const t = id ? tx.find(x => x.id === id) : null;
    $('tx-title').innerText = t ? 'Buchung bearbeiten' : 'Neue Buchung';
    $('tx-id').value = t ? t.id : ''; $('tx-date').value = t ? t.date : localDate();
    $('tx-kind').value = t && t.amount > 0 ? 'in' : 'out'; $('tx-partner').value = t ? t.partner : '';
    $('tx-category').innerHTML = catOpts($('tx-kind').value, t ? t.category : 'Sonstiges'); $('tx-amount').value = t ? Math.abs(t.amount) : '';
    $('tx-label').value = t ? (t.label || '') : ''; $('tx-labels').innerHTML = [...new Set(tx.map(x => x.label).filter(Boolean))].slice(0, 80).map(l => `<option value="${esc(l)}">`).join('');
    linkUI('tx', t ? (t.goalId || t.debtId || '') : ''); openModal('m-tx');
}
function saveTx(e) {
    e.preventDefault();
    const id = $('tx-id').value, amt = Math.abs(parseFloat($('tx-amount').value)), amount = $('tx-kind').value === 'in' ? amt : -amt;
    if (isNaN(amount)) return;
    const data = { date: $('tx-date').value, partner: $('tx-partner').value.trim(), category: $('tx-category').value, amount, label: $('tx-label').value.trim().slice(0, 60), ...linkOf('tx') };
    run(async () => {
        if (id) await db.collection('finance_transactions').doc(id).update({ ...data, goalId: data.goalId || firebase.firestore.FieldValue.delete(), debtId: data.debtId || firebase.firestore.FieldValue.delete(), updatedAt: TS() });
        else { const clean = { ...data }; if (!clean.goalId) delete clean.goalId; if (!clean.debtId) delete clean.debtId; await db.collection('finance_transactions').add({ ...clean, purpose: 'Manuelle Buchung', owner: currentUser.email, createdAt: TS() }); }
        closeModal('m-tx'); logSystemEvent('data', id ? 'Buchung bearbeitet' : 'Buchung angelegt', { amount });
    });
}
// Mehrere Buchungen auf einmal löschen: die angezeigten (Monat + Filter) oder alle
function openTxDel() {
    const shown = txShown(), filt = $('tx-q').value || $('tx-cat').value || $('tx-type').value;
    $('txdel-view').innerHTML = `<i class="fa-solid fa-list"></i><span><b>Angezeigte Buchungen löschen (${shown.length})</b><br><small>${esc(monthLabel(ym()))}${filt ? ' · mit deinem aktuellen Filter' : ''}</small></span>`;
    $('txdel-view').disabled = !shown.length;
    $('txdel-all').innerHTML = `<i class="fa-solid fa-trash-can"></i><span><b>Alle Buchungen löschen (${tx.length})</b><br><small>aus allen Monaten</small></span>`;
    $('txdel-all').disabled = !tx.length; openModal('m-txdel');
}
async function txDelete(what) {
    const list = what === 'all' ? [...tx] : txShown(); if (!list.length) return;
    if (!(await uiConfirm(what === 'all' ? `Wirklich ALLE ${list.length} Buchungen aus allen Monaten löschen? Das kann nicht rückgängig gemacht werden.` : `${list.length} Buchung${list.length === 1 ? '' : 'en'} aus ${monthLabel(ym())} wirklich löschen?`, { danger: true, ok: 'Löschen' }))) return;
    run(async () => {
        const ids = new Set(list.map(t => t.id));
        for (let i = 0; i < list.length; i += 400) { const b = db.batch(); list.slice(i, i + 400).forEach(t => b.delete(db.collection('finance_transactions').doc(t.id))); await b.commit(); }
        // Rechnungen, deren Buchung gelöscht wurde, verlieren den Verweis (bleiben aber bezahlt)
        for (const v of invs.filter(v => v.txId && ids.has(v.txId))) await db.collection('invoices').doc(v.id).update({ txId: firebase.firestore.FieldValue.delete() }).catch(() => {});
        closeModal('m-txdel'); UX.toast(`${list.length} Buchung${list.length === 1 ? '' : 'en'} gelöscht`); logSystemEvent('data', 'Buchungen gelöscht', { anzahl: list.length, umfang: what });
    });
}
async function delTx(id) {
    if (!(await uiConfirm('Diese Buchung wirklich löschen?', { danger: true, ok: 'Löschen' }))) return;
    run(async () => { await db.collection('finance_transactions').doc(id).delete(); logSystemEvent('data', 'Buchung gelöscht', { id }); });
}
function exportMonthCSV() {
    const list = monthTx(ym()).sort((a, b) => a.date.localeCompare(b.date));
    if (!list.length) return alert('Keine Buchungen in diesem Monat.');
    const csv = '\uFEFFDatum;Partner;Kategorie;Betrag;Verwendungszweck\r\n' + list.map(t => [csvCell(t.date), csvCell(t.partner), csvCell(t.category), String(t.amount).replace('.', ','), csvCell(t.purpose)].join(';')).join('\r\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })), download: `Buchungen_${ym()}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    logSystemEvent('data', 'Buchungen exportiert', { monat: ym() });
}

// ---------- Fixkosten ----------
function renderFix() {
    const m = ym();
    $('fix-list').innerHTML = fixes.length ? [...fixes].sort((a, b) => a.amount - b.amount).map(f => {
        const due = isDue(f, m), booked = isBooked(f, m), nd = nextDue(f), paused = f.active === false, [col, cr, ic] = catM(f.category);
        const st = paused ? ['pausiert', ''] : booked ? ['gebucht', 'g'] : due ? ['offen', 'a'] : ['nicht fällig', ''];
        return `<div class="ux-card fx${paused ? ' paused' : ''}" style="--c:${col};--cr:${cr}"><div class="top"><div class="tile"><i class="fa-solid ${ic}"></i></div>
            <div class="nm"><div class="ell">${esc(f.name)}</div><small>${esc(f.category)}${linkName(f) ? ' → ' + esc(linkName(f)) : ''} · ${INT[f.interval]} · am ${f.day}.</small></div><span class="chip ${st[1]}">${st[0]}</span></div>
            <div class="bt"><div><div class="amt ${f.amount < 0 ? 'neg' : 'pos'}">${sgn(f.amount)}</div><small>${f.interval > 1 ? '≈ ' + eur(f.amount / f.interval) + ' / Monat · ' : ''}${nd ? 'nächste: ' + monthLabel(nd) : ''}</small></div>
            <div class="acts">${due && !booked && !paused ? `<button data-act="book" data-id="${esc(f.id)}" class="ux-ib" style="color:#86efac" title="Jetzt buchen" aria-label="Jetzt buchen"><i class="fa-solid fa-circle-check"></i></button>` : ''}
            <button data-act="toggle" data-id="${esc(f.id)}" class="ux-ib" title="${paused ? 'Fortsetzen' : 'Pausieren'}" aria-label="${paused ? 'Fortsetzen' : 'Pausieren'}"><i class="fa-solid ${paused ? 'fa-play' : 'fa-pause'}"></i></button>
            <button data-act="edit" data-id="${esc(f.id)}" class="ux-ib" title="Bearbeiten" aria-label="Bearbeiten"><i class="fa-solid fa-pen-to-square"></i></button>
            <button data-act="del" data-id="${esc(f.id)}" class="ux-ib bad" title="Löschen" aria-label="Löschen"><i class="fa-solid fa-trash-can"></i></button></div></div></div>`;
    }).join('') : '<div class="ux-card ux-empty" style="grid-column:1/-1"><i class="fa-solid fa-repeat"></i>Noch keine Fixkosten. Lege Miete, Versicherungen, Abos oder dein Gehalt an, dann siehst du Prognose und Fixkostenlast.</div>';
}

function openFix(id = '') {
    const f = id ? fixes.find(x => x.id === id) : null;
    $('fx-title').innerText = f ? 'Fixkosten bearbeiten' : 'Neue Fixkosten';
    $('fx-id').value = f ? f.id : ''; $('fx-name').value = f ? f.name : ''; $('fx-kind').value = f && f.amount > 0 ? 'in' : 'out';
    $('fx-amount').value = f ? Math.abs(f.amount) : ''; $('fx-category').innerHTML = catOpts($('fx-kind').value, f ? f.category : 'Wohnen'); linkUI('fx', f ? (f.goalId || f.debtId || '') : '');
    $('fx-int').value = f ? f.interval : 1; $('fx-start').value = f ? f.startMonth : +todayStr.slice(5); $('fx-day').value = f ? f.day : 1;
    openModal('m-fix');
}
function saveFix(e) {
    e.preventDefault();
    const id = $('fx-id').value, amt = Math.abs(parseFloat($('fx-amount').value)), day = Math.min(31, Math.max(1, +$('fx-day').value));
    if (isNaN(amt)) return;
    const data = { name: $('fx-name').value.trim(), amount: $('fx-kind').value === 'in' ? amt : -amt, category: $('fx-category').value, interval: +$('fx-int').value, startMonth: +$('fx-start').value, day, goalId: '', debtId: '', ...linkOf('fx') };
    run(async () => {
        if (id) await db.collection('fixed_costs').doc(id).update(data);
        else await db.collection('fixed_costs').add({ ...data, active: true, owner: currentUser.email, createdAt: TS() });
        closeModal('m-fix'); logSystemEvent('data', id ? 'Fixkosten bearbeitet' : 'Fixkosten angelegt', { name: data.name });
    });
}
async function fixAction(act, id) {
    const f = fixes.find(x => x.id === id); if (!f) return;
    if (act === 'edit') openFix(id);
    if (act === 'book') bookDue(f);
    if (act === 'toggle') run(() => db.collection('fixed_costs').doc(id).update({ active: f.active === false }));
    if (act === 'del' && (await uiConfirm(`„${f.name}“ löschen? Bereits gebuchte Zahlungen bleiben bestehen.`, { danger: true, ok: 'Löschen' })))
        run(async () => { await db.collection('fixed_costs').doc(id).delete(); logSystemEvent('data', 'Fixkosten gelöscht', { name: f.name }); });
}
// Bucht fällige Fixkosten des gewählten Monats. Feste IDs verhindern Doppelbuchungen.
async function bookDue(only) {
    const m = ym(), list = (only ? [only] : fixes).filter(f => isDue(f, m) && !isBooked(f, m));
    if (!list.length) return alert('Für ' + monthLabel(m) + ' ist nichts offen.');
    if (!(await uiConfirm(`${list.length} Fixkosten für ${monthLabel(m)} buchen?`))) return;
    run(async () => {
        const b = db.batch();
        list.forEach(f => b.set(db.collection('finance_transactions').doc(fixTxId(f, m)), { date: dueDate(f, m), partner: f.name, purpose: 'Fixkosten (' + INT[f.interval] + ')', amount: f.amount, category: f.category, fixedId: f.id, ...(f.goalId && f.category === SAVE ? { goalId: f.goalId } : {}), ...(f.debtId && f.category === DEBT ? { debtId: f.debtId } : {}), owner: currentUser.email, createdAt: TS() }));
        await b.commit(); logSystemEvent('data', 'Fixkosten gebucht', { monat: m, anzahl: list.length });
    });
}

// ---------- Sparziele und Schulden ----------
// Sparglas: start (schon vorhanden) + alle Sparbuchungen mit goalId. Schuld: total (beim Anlegen offen) − alle Rückzahlungen mit debtId.
const goalSaved = g => (+g.start || 0) + tx.reduce((a, t) => a + (t.goalId === g.id && t.amount < 0 ? -t.amount : 0), 0);
const debtPaid = d => tx.reduce((a, t) => a + (t.debtId === d.id && t.amount < 0 ? -t.amount : 0), 0);
const debtLeft = d => Math.max(0, (+d.total || 0) - debtPaid(d));
const monthlyOf = (pred) => fixes.filter(f => f.active !== false && f.amount < 0 && pred(f)).reduce((a, f) => a - f.amount / f.interval, 0);
const linkName = o => { if (o.category === SAVE && o.goalId) { const g = goals.find(x => x.id === o.goalId); return g ? g.name : ''; } if (o.category === DEBT && o.debtId) { const d = debts.find(x => x.id === o.debtId); return d ? d.name : ''; } return ''; };
// Auswahl „Sparziel“ bzw. „Schuld“ im Buchungs- und Fixkosten-Fenster
function linkUI(p, val) {
    const cat = $(p + '-category').value, w = $(p + '-link-w'), sel = $(p + '-link');
    if (val === undefined) val = sel.value;
    const list = cat === SAVE ? goals : cat === DEBT ? debts : null;
    w.classList.toggle('hidden', !list); if (!list) return;
    $(p + '-link-l').textContent = cat === SAVE ? 'In welches Sparglas?' : 'Welche Schuld wird zurückgezahlt?';
    sel.innerHTML = `<option value="">${list.length ? '– keins –' : cat === SAVE ? 'Noch kein Sparziel angelegt' : 'Noch keine Schuld angelegt'}</option>` + list.map(x => `<option value="${esc(x.id)}">${esc(x.name)}${cat === DEBT ? ' (offen ' + eur(debtLeft(x)) + ')' : ''}</option>`).join('');
    sel.value = list.some(x => x.id === val) ? val : '';
}
const linkOf = p => { const cat = $(p + '-category').value, v = $(p + '-link').value; return cat === SAVE && v ? { goalId: v } : cat === DEBT && v ? { debtId: v } : {}; };

// Planeten als Platzhalter-Bilder (bis eigene Bilder da sind)
const PLANETS = [['#60a5fa', '#1e3a8a', 0], ['#f472b6', '#831843', 1], ['#fbbf24', '#92400e', 1], ['#34d399', '#065f46', 0], ['#a78bfa', '#4c1d95', 1], ['#fb923c', '#7c2d12', 0], ['#22d3ee', '#164e63', 1], ['#f87171', '#7f1d1d', 0]];
function planet(i) {
    const [a, b, ring] = PLANETS[((+i || 0) % PLANETS.length + PLANETS.length) % PLANETS.length], id = 'pl' + i + Math.random().toString(36).slice(2, 7);
    const rg = `<g transform="rotate(-16 60 62)"><ellipse cx="60" cy="62" rx="54" ry="13" fill="none" stroke="${a}" stroke-opacity=".75" stroke-width="5"/></g>`;
    return `<svg viewBox="0 0 120 120" class="planet" aria-hidden="true"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".18" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>
        <clipPath id="${id}c"><g transform="rotate(-16 60 62)"><rect x="0" y="62" width="120" height="60"/></g></clipPath></defs>
        <circle cx="20" cy="22" r="1.4" fill="#fff" opacity=".7"/><circle cx="100" cy="30" r="1" fill="#fff" opacity=".6"/><circle cx="92" cy="98" r="1.6" fill="#fff" opacity=".5"/><circle cx="14" cy="90" r="1" fill="#fff" opacity=".6"/>
        ${ring ? rg : ''}<circle cx="60" cy="60" r="34" fill="url(#${id})"/><path d="M30 52 q15 -6 30 0 t30 0" stroke="#fff" stroke-opacity=".18" stroke-width="5" fill="none"/><path d="M32 70 q14 5 28 0 t28 0" stroke="#000" stroke-opacity=".12" stroke-width="6" fill="none"/>
        ${ring ? `<g clip-path="url(#${id}c)">${rg}</g>` : ''}</svg>`;
}
const goalPic = g => (g.image ? `<img src="${esc(g.image)}" alt="" class="gl-img">` : planet(g.planet));

function renderSav(m) {
    const planS = monthlyOf(f => f.category === SAVE), planD = monthlyOf(f => f.category === DEBT) || debts.filter(d => debtLeft(d) > 0 && !fixes.some(f => f.debtId === d.id)).reduce((a, d) => a + (+d.rate || 0), 0) + monthlyOf(f => false);
    const cur = monthTx(m), gotS = cur.reduce((a, t) => a + (t.category === SAVE && t.amount < 0 ? -t.amount : 0), 0), gotD = cur.reduce((a, t) => a + (t.category === DEBT && t.amount < 0 ? -t.amount : 0), 0);
    const totS = goals.reduce((a, g) => a + goalSaved(g), 0), totD = debts.reduce((a, d) => a + debtLeft(d), 0);
    // Übersicht: Kachel unter den Fixkosten
    $('sav-ov').innerHTML = `<div class="sv2"><div class="pos"><small>Sparen</small><b>+ ${eur(planS)}</b><span>pro Monat geplant</span></div><div class="neg"><small>Schulden</small><b>− ${eur(planD)}</b><span>pro Monat geplant</span></div></div>
        <div class="sv-line"><span>Diesen Monat gebucht</span><b class="pos">+ ${eur(gotS)}</b><b class="neg">− ${eur(gotD)}</b></div>
        <div class="sv-line"><span>In allen Gläsern</span><b class="pos">${eur(totS)}</b><span>Offene Schulden</span><b class="neg">${eur(totD)}</b></div>`;
    // Reiter „Sparen & Schulden“
    $('sv-sum').innerHTML = `<div><small>In allen Sparzielen</small><b class="pos">${eur(totS)}</b></div><div><small>Sparen pro Monat (Fixkosten)</small><b class="pos">+ ${eur(planS)}</b></div><div><small>Offene Schulden</small><b class="neg">${eur(totD)}</b></div><div><small>Tilgung pro Monat</small><b class="neg">− ${eur(planD)}</b></div>`;
    $('goal-list').innerHTML = goals.length ? goals.map(g => {
        const saved = goalSaved(g), tg = +g.target || 0, pct = tg ? Math.min(1, saved / tg) : 0, per = monthlyOf(f => f.goalId === g.id && f.category === SAVE), left = tg ? Math.max(0, tg - saved) : 0;
        return `<div class="gl"><div class="gl-pic">${goalPic(g)}</div><div class="gl-b"><b>${esc(g.name)}</b><div class="gl-v"><span class="pos">${eur(saved)}</span>${tg ? `<small>von ${eur(tg)}</small>` : ''}</div>
            ${tg ? `<div class="bar"><i style="width:${(pct * 100).toFixed(1)}%"></i></div><small>${pct >= 1 ? 'Ziel erreicht 🎉' : `noch ${eur(left)}` + (per > 0 ? ` · ca. ${Math.ceil(left / per)} Monate` : '')}</small>` : '<small>ohne festes Ziel</small>'}
            ${per > 0 ? `<small><i class="fa-solid fa-repeat"></i> ${eur(per)} pro Monat über Fixkosten</small>` : ''}</div>
            <div class="gl-a"><button class="ux-btn" data-g="pay" data-id="${esc(g.id)}"><i class="fa-solid fa-plus"></i>Einzahlen</button><button class="ux-ib" data-g="edit" data-id="${esc(g.id)}" title="Bearbeiten" aria-label="Bearbeiten"><i class="fa-solid fa-pen-to-square"></i></button><button class="ux-ib bad" data-g="del" data-id="${esc(g.id)}" title="Löschen" aria-label="Löschen"><i class="fa-solid fa-trash-can"></i></button></div></div>`;
    }).join('') : '<div class="ux-empty" style="grid-column:1/-1"><i class="fa-solid fa-jar"></i>Noch keine Sparziele. Lege z. B. „Auto“ oder „Urlaub“ an und trage ein, was schon drin ist.</div>';
    $('debt-list').innerHTML = debts.length ? debts.map(d => {
        const left = debtLeft(d), tot = +d.total || 0, pct = tot ? Math.min(1, (tot - left) / tot) : 0, per = monthlyOf(f => f.debtId === d.id && f.category === DEBT) || (+d.rate || 0);
        return `<div class="gl debt"><div class="gl-pic"><span class="db-ic"><i class="fa-solid fa-hand-holding-dollar"></i></span></div><div class="gl-b"><b>${esc(d.name)}</b><div class="gl-v"><span class="neg">${eur(left)}</span><small>offen von ${eur(tot)}</small></div>
            <div class="bar"><i style="width:${(pct * 100).toFixed(1)}%"></i></div><small>${left <= 0 ? 'Abbezahlt 🎉' : `${eur(tot - left)} zurückgezahlt` + (per > 0 ? ` · noch ca. ${Math.ceil(left / per)} Monate` : '')}</small>
            ${per > 0 ? `<small><i class="fa-solid fa-repeat"></i> ${eur(per)} pro Monat</small>` : ''}${d.note ? `<small>${esc(d.note)}</small>` : ''}</div>
            <div class="gl-a">${left > 0 ? `<button class="ux-btn" data-d="pay" data-id="${esc(d.id)}"><i class="fa-solid fa-minus"></i>Rate zahlen</button>` : ''}<button class="ux-ib" data-d="edit" data-id="${esc(d.id)}" title="Bearbeiten" aria-label="Bearbeiten"><i class="fa-solid fa-pen-to-square"></i></button><button class="ux-ib bad" data-d="del" data-id="${esc(d.id)}" title="Löschen" aria-label="Löschen"><i class="fa-solid fa-trash-can"></i></button></div></div>`;
    }).join('') : '<div class="ux-empty" style="grid-column:1/-1"><i class="fa-solid fa-hand-holding-dollar"></i>Keine Schulden eingetragen.</div>';
}
// Einzahlen bzw. Rate zahlen: Buchungsfenster vorausgefüllt öffnen
function payInto(kind, id) {
    const o = kind === 'goal' ? goals.find(x => x.id === id) : debts.find(x => x.id === id); if (!o) return;
    openTx(); $('tx-kind').value = 'out'; $('tx-category').innerHTML = catOpts('out', kind === 'goal' ? SAVE : DEBT); linkUI('tx', id);
    $('tx-partner').value = o.name; const per = kind === 'goal' ? monthlyOf(f => f.goalId === id) : (monthlyOf(f => f.debtId === id) || +o.rate || 0); $('tx-amount').value = per ? per.toFixed(2) : '';
    $('tx-title').innerText = kind === 'goal' ? 'Einzahlen: ' + o.name : 'Rate zahlen: ' + o.name; setTimeout(() => $('tx-amount').focus(), 40);
}
let glImg = '', glPlanet = 0;
function goalPicsWire() {
    $('gl-pics').innerHTML = PLANETS.map((_, i) => `<button type="button" data-pl="${i}" aria-label="Planet ${i + 1}">${planet(i)}</button>`).join('');
    $('gl-pics').addEventListener('click', e => { const b = e.target.closest('[data-pl]'); if (b) { glPlanet = +b.dataset.pl; glImg = ''; paintGoalPics(); } });
    $('gl-noimg').onclick = () => { glImg = ''; paintGoalPics(); };
    $('gl-file').onchange = async e => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        try { glImg = await shrinkImage(f, 480, .82); paintGoalPics(); } catch (x) { alert('Das Bild konnte nicht gelesen werden.'); }
    };
}
function paintGoalPics() {
    $('gl-pics').querySelectorAll('[data-pl]').forEach(b => b.classList.toggle('on', !glImg && +b.dataset.pl === glPlanet));
    let own = $('gl-pics').querySelector('.own'); if (own) own.remove();
    if (glImg) { own = document.createElement('span'); own.className = 'own on'; own.innerHTML = `<img src="${glImg}" alt="Eigenes Bild">`; $('gl-pics').prepend(own); }
    $('gl-noimg').classList.toggle('hidden', !glImg);
}
// Bild verkleinern (JPEG, längste Seite max), damit es ins Datenbank-Dokument passt
function shrinkImage(file, max, q) {
    return new Promise((res, rej) => { const img = new Image(), url = URL.createObjectURL(file); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q)); }; img.onerror = rej; img.src = url; });
}
function openGoal(id = '') {
    const g = id ? goals.find(x => x.id === id) : null;
    $('gl-title').innerText = g ? 'Sparziel bearbeiten' : 'Neues Sparziel'; $('gl-id').value = g ? g.id : ''; $('gl-name').value = g ? g.name : '';
    $('gl-target').value = g && g.target ? g.target : ''; $('gl-start').value = g && g.start ? g.start : '';
    glImg = g ? g.image || '' : ''; glPlanet = g ? +g.planet || 0 : goals.length % PLANETS.length; paintGoalPics(); openModal('m-goal'); setTimeout(() => $('gl-name').focus(), 40);
}
function saveGoal(e) {
    e.preventDefault();
    const id = $('gl-id').value, data = { name: $('gl-name').value.trim().slice(0, 40), target: Math.max(0, +$('gl-target').value || 0), start: Math.max(0, +$('gl-start').value || 0), planet: glPlanet, image: glImg || '' };
    if (data.image.length > 450000) return alert('Das Bild ist zu groß. Bitte ein kleineres wählen.');
    run(async () => { if (id) await db.collection('finance_goals').doc(id).update({ ...data, updatedAt: TS() }); else await db.collection('finance_goals').add({ ...data, owner: currentUser.email, createdAt: TS() }); closeModal('m-goal'); logSystemEvent('data', id ? 'Sparziel geändert' : 'Sparziel angelegt', { name: data.name }); });
}
async function goalAction(act, id) {
    const g = goals.find(x => x.id === id); if (!g) return;
    if (act === 'pay') payInto('goal', id); if (act === 'edit') openGoal(id);
    if (act === 'del' && (await uiConfirm(`Sparziel „${g.name}“ löschen? Die Buchungen bleiben, sind dann aber keinem Glas mehr zugeordnet.`, { danger: true, ok: 'Löschen' }))) run(() => db.collection('finance_goals').doc(id).delete());
}
function openDebt(id = '') {
    const d = id ? debts.find(x => x.id === id) : null;
    $('db-title').innerText = d ? 'Schuld bearbeiten' : 'Neue Schuld'; $('db-id').value = d ? d.id : ''; $('db-name').value = d ? d.name : ''; $('db-total').value = d ? d.total : ''; $('db-rate').value = d && d.rate ? d.rate : ''; $('db-note').value = d ? d.note || '' : '';
    openModal('m-debt'); setTimeout(() => $('db-name').focus(), 40);
}
function saveDebt(e) {
    e.preventDefault();
    const id = $('db-id').value, data = { name: $('db-name').value.trim().slice(0, 40), total: Math.max(0, +$('db-total').value || 0), rate: Math.max(0, +$('db-rate').value || 0), note: $('db-note').value.trim().slice(0, 120) };
    run(async () => { if (id) await db.collection('finance_debts').doc(id).update({ ...data, updatedAt: TS() }); else await db.collection('finance_debts').add({ ...data, owner: currentUser.email, createdAt: TS() }); closeModal('m-debt'); logSystemEvent('data', id ? 'Schuld geändert' : 'Schuld angelegt', { name: data.name }); });
}
async function debtAction(act, id) {
    const d = debts.find(x => x.id === id); if (!d) return;
    if (act === 'pay') payInto('debt', id); if (act === 'edit') openDebt(id);
    if (act === 'del' && (await uiConfirm(`Schuld „${d.name}“ löschen? Die Buchungen bleiben bestehen.`, { danger: true, ok: 'Löschen' }))) run(() => db.collection('finance_debts').doc(id).delete());
}

// ---------- Budgets ----------
function openBudgets() {
    $('bud-fields').innerHTML = CAT_OUT.map(c => `<label class="ux-f" style="display:flex;align-items:center;gap:12px;margin:0 0 10px"><span style="flex:0 0 150px;margin:0;color:#e2e8f0;font-size:13px"><i class="fa-solid ${catM(c)[2]}" style="color:${catM(c)[0]};margin-right:8px"></i>${esc(c)}</span>
        <input type="number" min="0" step="1" data-cat="${esc(c)}" value="${budgets[c] || ''}" placeholder="kein Limit" class="ux-in"></label>`).join('');
    openModal('m-bud');
}
function saveBudgets(e) {
    e.preventDefault();
    const b = {}; document.querySelectorAll('#bud-fields input').forEach(i => { if (+i.value > 0) b[i.dataset.cat] = +i.value; });
    run(async () => { await db.collection('finance_settings').doc(currentUser.uid).set({ owner: currentUser.email, budgets: b }); closeModal('m-bud'); logSystemEvent('data', 'Budgets geändert'); });
}

// ---------- Sparkassen-CSV ----------
const hashString = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
function parseCsvLine(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (c === ';' && !q) { out.push(cur.trim()); cur = ''; }
        else cur += c;
    }
    out.push(cur.trim()); return out;
}
const decodeCsv = buf => { try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1252').decode(buf); } };
const RULES = [['Einnahmen', ['gehalt', 'lohn', 'bezüge', 'bezuege', 'rente']], ['Lebensmittel', ['rewe', 'edeka', 'aldi', 'lidl', 'kaufland', 'penny', 'netto', 'dm-drogerie', 'rossmann', 'bäckerei', 'baeckerei']],
    ['Wohnen', ['miete', 'wohnen', 'nebenkosten', 'stadtwerke', 'strom', 'telekom', 'vodafone', '1&1', 'o2 ']], ['Auto', ['aral', 'shell', 'esso', 'total', 'tanken', 'jet ', 'kfz', 'werkstatt', 'tüv']],
    ['Abos', ['netflix', 'spotify', 'disney', 'dazn', 'apple.com', 'google', 'fitness', 'mcfit']], ['Versicherungen', ['versicherung', 'allianz', 'huk', 'ergo', 'axa', 'devk']],
    ['Gesundheit', ['apotheke', 'arzt', 'praxis', 'zahn']], ['Gastro', ['lieferando', 'restaurant', 'mcdonald', 'burger king', 'starbucks', 'cafe', 'café', 'pizza']], ['Freizeit', ['amazon', 'zalando', 'steam', 'playstation', 'kino']]];
const categorize = (text, amount) => { const t = text.toLowerCase(), hit = RULES.find(([, w]) => w.some(x => t.includes(x))); const c = hit ? hit[0] : (amount > 1000 ? 'Einnahmen' : 'Sonstiges'); return normCat(c, amount); };

function handleSparkasseCSV(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => run(async () => {
        let cD = -1, cP = -1, cZ = -1, cA = -1, header = false; const items = [];
        for (const raw of decodeCsv(reader.result).split(/\r\n|\n/)) {
            if (!raw.trim()) continue;
            const p = parseCsvLine(raw.trim());
            if (!header) {
                p.forEach((x, j) => {
                    const h = x.toLowerCase();
                    if (h.includes('buchungstag')) cD = j; else if (h.includes('datum') && cD === -1) cD = j;
                    if (/beg(ü|ue)nstigter|zahlungspflichtiger/.test(h)) cP = j;
                    if (h.includes('verwendungszweck')) cZ = j;
                    if (h === 'betrag') cA = j; else if (h.includes('betrag') && cA === -1) cA = j;
                });
                header = cD !== -1 && cA !== -1; continue;
            }
            if (p.length <= Math.max(cD, cA) || !p[cD] || !p[cA]) continue;
            const amount = parseFloat(p[cA].replace(/\./g, '').replace(',', '.')); if (isNaN(amount)) continue;
            const dp = p[cD].split('.'), date = dp.length === 3 ? `${dp[2].length === 2 ? '20' + dp[2] : dp[2]}-${dp[1].padStart(2, '0')}-${dp[0].padStart(2, '0')}` : p[cD];
            const partner = p[cP] || 'Unbekannt', purpose = p[cZ] || '';
            items.push({ date, partner, purpose, amount, category: categorize(partner + ' ' + purpose, amount), owner: currentUser.email, createdAt: TS() });
        }
        if (!items.length) return alert('Konnte keine gültigen Buchungszeilen in der CSV finden.');
        const seen = {};
        for (let i = 0; i < items.length; i += 400) {
            const b = db.batch();
            for (const it of items.slice(i, i + 400)) {
                const k = [currentUser.email, it.date, it.partner, it.amount, it.purpose].join('|');
                seen[k] = (seen[k] || 0) + 1;
                b.set(db.collection('finance_transactions').doc(await hashString(k + '|' + seen[k])), it);
            }
            await b.commit();
        }
        alert(`${items.length} Buchungen synchronisiert (vorhandene wurden zusammengeführt).`);
        logSystemEvent('data', 'Sparkassen-CSV importiert', { anzahl: items.length });
    }).finally(() => { e.target.value = ''; });
    reader.readAsArrayBuffer(file);
}

// ---------- Lohnabrechnungen ----------
function openPayslip() { $('pay-month').value = todayStr; ['pay-netto', 'pay-brutto', 'pay-file'].forEach(i => $(i).value = ''); openModal('m-pay'); }
function savePayslip(e) {
    e.preventDefault();
    const month = $('pay-month').value, netto = parseFloat($('pay-netto').value), brutto = parseFloat($('pay-brutto').value) || 0, file = $('pay-file').files[0], btn = $('pay-btn');
    if (!month || isNaN(netto) || !file) return;
    if (file.size > 700 * 1024) return alert('Datei zu groß (max. ca. 700 KB wegen des Firestore-Limits).');
    btn.disabled = true; btn.innerText = 'Wird gespeichert...';
    const reader = new FileReader();
    reader.onerror = () => { alert('Datei konnte nicht gelesen werden.'); btn.disabled = false; btn.innerText = 'In Cloud speichern'; };
    reader.onload = () => run(async () => {
        const txRef = db.collection('finance_transactions').doc();
        await db.collection('payslips').add({ txId: txRef.id, month, netto, brutto, fileName: file.name, fileData: reader.result, owner: currentUser.email, createdAt: TS() });
        await txRef.set({ date: `${month}-01`, partner: 'Arbeitgeber (Gehalt)', purpose: `Lohnabrechnung ${month}`, amount: netto, category: 'Gehalt', owner: currentUser.email, createdAt: TS() });
        closeModal('m-pay'); logSystemEvent('data', 'Lohnabrechnung abgelegt', { monat: month, netto });
    }).finally(() => { btn.disabled = false; btn.innerText = 'In Cloud speichern'; });
    reader.readAsDataURL(file);
}
function renderPays() {
    $('pay-count').innerText = pays.length;
    $('pay-list').innerHTML = pays.length ? [...pays].sort((a, b) => b.month.localeCompare(a.month)).map(p => `<div class="row" style="--c:#fbbf24;--cr:251,191,36"><div class="tile"><i class="fa-solid fa-file-invoice-dollar"></i></div>
        <div class="n"><div class="ell">${esc(monthLabel(p.month))}</div><small>${eur(p.netto)} netto${p.brutto ? ' · ' + eur(p.brutto) + ' brutto' : ''}</small></div>
        <div class="acts"><a href="${/^data:/.test(p.fileData || '') ? p.fileData : '#'}" download="Lohnabrechnung_${esc(p.month)}_${esc(p.fileName)}" class="ux-ib" title="Herunterladen" aria-label="Herunterladen"><i class="fa-solid fa-download"></i></a>
        <button data-del="${esc(p.id)}" class="ux-ib bad" title="Löschen" aria-label="Löschen"><i class="fa-solid fa-trash-can"></i></button></div></div>`).join('')
        : '<div class="ux-card ux-empty" style="grid-column:1/-1"><i class="fa-solid fa-folder-open"></i>Keine Lohnabrechnungen hinterlegt.</div>';
}
async function delPayslip(id) {
    if (!(await uiConfirm('Diese Lohnabrechnung wirklich löschen? Die zugehörige Gehaltsbuchung wird mit entfernt.', { danger: true, ok: 'Entfernen' }))) return;
    const p = pays.find(x => x.id === id);
    run(async () => {
        await db.collection('payslips').doc(id).delete();
        if (p?.txId) await db.collection('finance_transactions').doc(p.txId).delete().catch(() => {});
        logSystemEvent('data', 'Lohnabrechnung gelöscht', { monat: p?.month });
    });
}

// ---------- Rechnungen ----------
// Kopfdaten in invoices/{id}, die Datei (PDF/Foto) in Teilen zu je höchstens ca. 525 KB in invoices/{id}/chunks
const INV_MAX = 3 * 1024 * 1024, INV_CH = 700000, INV_OK = /^(application\/pdf|image\/(png|jpeg|webp))$/;
let invFilter = 'open', invPick = null, invDropFile = false;
const dayDiff = d => Math.round((Date.parse(d + 'T00:00:00') - Date.parse(localDate() + 'T00:00:00')) / 864e5);
const dShort = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '';
const dLong = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE') : '';
const invState = v => { if (v.status === 'paid') return 'paid'; if (!v.due) return 'later'; const d = dayDiff(v.due); return d < 0 ? 'over' : d <= 7 ? 'week' : 'later'; };
const INV_COL = { over: ['#f87171', '248,113,113'], week: ['#fbbf24', '251,191,36'], later: ['#60a5fa', '96,165,250'], paid: ['#4ade80', '74,222,128'] };
function dueText(v) {
    if (v.status === 'paid') return [v.paidAt ? `bezahlt ${dShort(v.paidAt)}` : 'bezahlt', v.txId ? 'als Buchung eingetragen' : ''];
    if (!v.due) return ['Fälligkeit unbekannt', 'bitte eintragen'];
    const d = dayDiff(v.due), t = d < -1 ? `seit ${-d} Tagen überfällig` : d === -1 ? 'seit gestern überfällig' : d === 0 ? 'heute fällig' : d === 1 ? 'morgen fällig' : `in ${d} Tagen`;
    return [t, `fällig ${dShort(v.due)}`];
}
const sumAmt = l => l.reduce((a, v) => a + (+v.amount || 0), 0);
const nRe = n => n === 1 ? '1 Rechnung' : n + ' Rechnungen';
function invRow(v, mini) {
    const st = invState(v), [c, cr] = INV_COL[st], [t1, t2] = dueText(v), icon = catM(normCat(v.category, -1))[2];
    const sub = mini ? esc(t1) + (st !== 'over' && st !== 'paid' && v.due ? ' · ' + dShort(v.due) : '')
        : [v.number ? 'Nr. ' + esc(v.number) : '', esc(v.category ? normCat(v.category, -1) : ''), v.note ? esc(v.note) : '', v.ref ? 'VZ ' + esc(v.ref) : ''].filter(Boolean).join(' · ') + (v.fileName ? ` · <span class="att"><i class="fa-solid fa-paperclip"></i> ${/pdf/.test(v.fileMime || '') ? 'PDF' : 'Foto'}</span>` : '');
    const acts = mini ? '' : `<div class="acts">${st === 'paid' ? `<span class="badge-p">BEZAHLT</span><button class="ux-ib" data-ia="unpaid" data-id="${esc(v.id)}" title="Wieder als offen markieren" aria-label="Wieder offen"><i class="fa-solid fa-rotate-left"></i></button>`
        : `<button class="ux-btn ok" data-ia="paid" data-id="${esc(v.id)}" style="padding:7px 11px;font-size:12px"><i class="fa-solid fa-check"></i>Bezahlt</button>`}
        ${v.iban || v.ref ? `<button class="ux-ib" data-ia="iban" data-id="${esc(v.id)}" title="${v.iban ? 'IBAN' : 'Verwendungszweck'} kopieren" aria-label="${v.iban ? 'IBAN' : 'Verwendungszweck'} kopieren"><i class="fa-regular fa-copy"></i></button>` : ''}
        ${v.fileName ? `<button class="ux-ib" data-ia="view" data-id="${esc(v.id)}" title="Datei ansehen" aria-label="Datei ansehen"><i class="fa-solid fa-eye"></i></button>` : ''}
        <button class="ux-ib" data-ia="edit" data-id="${esc(v.id)}" title="Bearbeiten" aria-label="Bearbeiten"><i class="fa-solid fa-pen"></i></button></div>`;
    return `<div class="inv ${st}" style="--c:${c};--cr:${cr}"${mini ? ` data-ia="edit" data-id="${esc(v.id)}" role="button" tabindex="0" style="--c:${c};--cr:${cr};cursor:pointer"` : ''}><div class="ic"><i class="fa-solid ${icon}"></i></div>
        <div class="n"><b>${esc(v.vendor)}</b><small>${sub}</small></div>${mini ? '' : `<div class="due"><b>${esc(t1)}</b>${esc(t2)}</div>`}<div class="amt">${v.amount == null || v.amount === '' ? '<span style="font-size:13px;color:#fbbf24">Betrag offen</span>' : eur(+v.amount || 0)}</div>${acts}</div>`;
}
function renderInv() {
    if (!$('inv-list')) return;
    const open = invs.filter(v => v.status !== 'paid').sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')), over = open.filter(v => invState(v) === 'over'), week = open.filter(v => invState(v) === 'week');
    const m = ym(), paidM = invs.filter(v => v.status === 'paid' && (v.paidAt || '').startsWith(m));
    $('ik-open').textContent = eur(sumAmt(open)); $('ik-open-n').textContent = nRe(open.length);
    $('ik-over').textContent = eur(sumAmt(over)); $('ik-over-n').textContent = nRe(over.length);
    $('ik-week').textContent = eur(sumAmt(week)); $('ik-week-n').textContent = nRe(week.length);
    $('ik-paid-l').textContent = 'Bezahlt im ' + new Date(+m.slice(0, 4), +m.slice(5) - 1, 1).toLocaleString('de-DE', { month: 'long' }); $('ik-paid').textContent = eur(sumAmt(paidM)); $('ik-paid-n').textContent = nRe(paidM.length);
    document.querySelectorAll('#inv-filter [data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === invFilter));
    const q = ($('inv-q').value || '').trim().toLowerCase(), hit = v => !q || `${v.vendor} ${v.number || ''} ${v.note || ''} ${v.category || ''} ${v.ref || ''}`.toLowerCase().includes(q);
    const paid = invs.filter(v => v.status === 'paid').sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));
    const grp = (label, col, list) => list.length ? `<div class="rg" style="--c:${col}"><b>● ${label}</b></div>` + list.map(v => invRow(v)).join('') : '';
    let h = '';
    if (invFilter === 'paid') h = grp('Bezahlt', '#4ade80', paid.filter(hit));
    else if (invFilter === 'over') h = grp('Überfällig', '#f87171', over.filter(hit));
    else {
        const o = open.filter(hit);
        h = grp('Überfällig', '#f87171', o.filter(v => invState(v) === 'over')) + grp('Diese Woche', '#fbbf24', o.filter(v => invState(v) === 'week')) + grp('Später', '#94a3b8', o.filter(v => invState(v) === 'later'));
        h += invFilter === 'all' ? grp('Bezahlt', '#4ade80', paid.filter(hit)) : grp('Zuletzt bezahlt', '#4ade80', paid.filter(hit).filter(v => dayDiff(v.paidAt || '2000-01-01') >= -30).slice(0, 3));
    }
    $('inv-list').innerHTML = h || `<div class="ux-empty" style="padding:28px"><i class="fa-solid fa-file-invoice"></i>${q ? 'Keine Rechnung gefunden.' : invFilter === 'over' ? 'Nichts überfällig. 👍' : invFilter === 'paid' ? 'Noch keine bezahlten Rechnungen.' : 'Keine offenen Rechnungen. Leg eine mit „Rechnung“ an.'}</div>`;
    // Karte auf der Übersicht
    $('inv-ov-n').textContent = open.length + ' offen';
    $('inv-ov').innerHTML = open.length ? open.slice(0, 4).map(v => invRow(v, true)).join('') : '<div class="ux-empty" style="padding:18px"><i class="fa-solid fa-circle-check" style="color:#4ade80"></i>Keine offenen Rechnungen.</div>';
}
function invWire() {
    $('inv-filter').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { invFilter = b.dataset.f; renderInv(); } });
    $('inv-q').addEventListener('input', renderInv);
    const act = e => { const b = e.target.closest('[data-ia]'); if (!b) return; const v = invs.find(x => x.id === b.dataset.id); if (!v) return;
        ({ paid: () => invPaid(v, true), unpaid: () => invPaid(v, false), edit: () => openInv(v.id), view: () => invView(v), iban: () => invCopy(v) })[b.dataset.ia]?.(); };
    $('inv-list').addEventListener('click', act); $('inv-ov').addEventListener('click', act);
    $('inv-ov').addEventListener('keydown', e => { if (e.key === 'Enter') act(e); });
    document.querySelectorAll('#m-inv [data-q]').forEach(b => b.onclick = () => { const base = $('iv-date').value || localDate(), d = new Date(base + 'T12:00:00'); d.setDate(d.getDate() + +b.dataset.q); $('iv-due').value = localDate(d); });
    const drop = $('iv-drop');
    $('iv-file').addEventListener('change', e => { if (e.target.files[0]) invSetFile(e.target.files[0]); });
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('on'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('on'); }));
    drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) invSetFile(f); });
    drop.addEventListener('click', e => { if (e.target.closest('[data-rmf]')) { e.preventDefault(); invPick = 'remove'; invDropUI(); } });
}
function invDropUI(cur) {
    const c = $('iv-drop-c'), f = invPick && invPick !== 'remove' ? invPick : null, keep = !invPick && cur;
    if (f || keep) { const name = f ? f.name : cur.fileName, size = f ? f.size : cur.fileSize;
        c.innerHTML = `<span class="hasf"><i class="fa-solid ${/pdf/.test(f ? f.type : cur.fileMime || '') ? 'fa-file-pdf' : 'fa-image'}" style="font-size:24px;color:#facc15"></i><span style="flex:1;min-width:0"><b class="ell" style="display:block">${esc(name)}</b><small>${size ? (size / 1048576 < .1 ? Math.round(size / 1024) + ' KB' : (size / 1048576).toFixed(1).replace('.', ',') + ' MB') : ''} · antippen zum Ersetzen</small></span><span class="ux-ib" data-rmf role="button" title="Datei entfernen" aria-label="Datei entfernen"><i class="fa-solid fa-xmark"></i></span></span>`; }
    else c.innerHTML = '<i class="fa-solid fa-cloud-arrow-up big"></i><b>Rechnung hierher ziehen oder antippen</b><br><small>PDF oder Foto (am Handy auch direkt mit der Kamera) · bis 3 MB · erscheint auch in Dokumente › Rechnungen</small>';
}
async function shrinkImage(f) {      // Fotos verkleinern (Handykamera-Bilder sind oft 4–8 MB)
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size < 900000) return f;
    try { const url = URL.createObjectURL(f), img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        const k = Math.min(1, 2200 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .85)); return b && b.size < f.size ? new File([b], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
    } catch (e) { return f; }
}
async function invSetFile(f) {
    if (/heic|heif/i.test(f.type + f.name)) { UX.toast('HEIC-Fotos kann der Browser nicht lesen. Bitte als JPG speichern oder ein PDF wählen.', true); return; }
    f = await shrinkImage(f);
    if (!INV_OK.test(f.type)) { UX.toast('Bitte ein PDF oder Foto (JPG, PNG, WebP) wählen.', true); return; }
    if (f.size > INV_MAX) { UX.toast('Die Datei ist größer als 3 MB.', true); return; }
    invPick = f; invDropUI();
}
function openInv(id) {
    const v = id ? invs.find(x => x.id === id) : null; invPick = null;
    $('iv-title').textContent = v ? 'Rechnung bearbeiten' : 'Rechnung anlegen'; $('iv-id').value = v ? v.id : '';
    $('iv-vendor').value = v ? v.vendor || '' : ''; $('iv-amount').value = v ? v.amount : ''; $('iv-date').value = v ? v.date || '' : localDate();
    const d14 = new Date(); d14.setDate(d14.getDate() + 14); $('iv-due').value = v ? v.due || '' : localDate(d14);
    $('iv-category').value = v ? normCat(v.category, -1) : 'Sonstiges'; $('iv-number').value = v ? v.number || '' : ''; $('iv-iban').value = v ? v.iban || '' : ''; $('iv-ref').value = v ? v.ref || '' : ''; $('iv-note').value = v ? v.note || '' : '';
    $('iv-book').checked = v ? v.autoBook !== false : true; $('iv-del').classList.toggle('hidden', !v); $('iv-file').value = '';
    invDropUI(v && v.fileName ? v : null); openModal('m-inv'); setTimeout(() => $('iv-vendor').focus(), 50);
}
async function invWriteFile(ref, f) {
    const old = await ref.collection('chunks').get(); for (const d of old.docs) await d.ref.delete();
    if (!f) return { fileName: firebase.firestore.FieldValue.delete(), fileMime: firebase.firestore.FieldValue.delete(), fileSize: firebase.firestore.FieldValue.delete(), fileChunks: firebase.firestore.FieldValue.delete() };
    const b = new Uint8Array(await f.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); const b64 = btoa(s), n = Math.ceil(b64.length / INV_CH);
    for (let i = 0; i < n; i++) await ref.collection('chunks').doc(String(i).padStart(3, '0')).set({ i, data: b64.slice(i * INV_CH, (i + 1) * INV_CH) });
    return { fileName: f.name.slice(0, 120), fileMime: f.type, fileSize: f.size, fileChunks: n };
}
function saveInv(e) {
    e.preventDefault();
    const id = $('iv-id').value, amt = $('iv-amount').value.trim(), amount = amt === '' ? null : Math.abs(parseFloat(amt)); if (amount !== null && isNaN(amount)) return;
    const data = { vendor: $('iv-vendor').value.trim().slice(0, 80), amount: amount === null ? null : Math.round(amount * 100) / 100, date: $('iv-date').value || '', due: $('iv-due').value, category: $('iv-category').value,
        number: $('iv-number').value.trim(), iban: $('iv-iban').value.replace(/\s+/g, ' ').trim().toUpperCase(), ref: $('iv-ref').value.trim(), note: $('iv-note').value.trim(), autoBook: $('iv-book').checked, owner: currentUser.email, updatedAt: TS() };
    const btn = $('iv-save'); if (btn.disabled) return; const pick = invPick; btn.disabled = true; btn.textContent = pick && pick !== 'remove' ? 'Lädt hoch …' : 'Speichert …';
    run(async () => {
        const ref = id ? db.collection('invoices').doc(id) : db.collection('invoices').doc();
        if (id) await ref.update(data); else await ref.set({ ...data, status: 'open', createdAt: TS() });
        if (pick) await ref.update(await invWriteFile(ref, pick === 'remove' ? null : pick));
        closeModal('m-inv'); UX.toast(id ? 'Rechnung gespeichert' : 'Rechnung angelegt'); logSystemEvent('data', id ? 'Rechnung bearbeitet' : 'Rechnung angelegt', { betrag: data.amount });
    }).finally(() => { btn.disabled = false; btn.textContent = 'Speichern'; if (invPick === pick) invPick = null; });
}
async function delInv() {
    const id = $('iv-id').value, v = invs.find(x => x.id === id); if (!v) return;
    if (!(await uiConfirm(`Rechnung „${v.vendor}“ wirklich löschen?${v.txId ? ' Die Buchung in deinen Finanzen bleibt erhalten.' : ''}`, { danger: true, ok: 'Löschen' }))) return;
    run(async () => { const ref = db.collection('invoices').doc(id), sn = await ref.collection('chunks').get(); for (const d of sn.docs) await d.ref.delete(); await ref.delete(); closeModal('m-inv'); UX.toast('Rechnung gelöscht'); logSystemEvent('data', 'Rechnung gelöscht', {}); });
}
function invPaid(v, on) {
    run(async () => {
        const ref = db.collection('invoices').doc(v.id);
        if (on) {
            const upd = { status: 'paid', paidAt: localDate(), updatedAt: TS() };
            if (v.autoBook !== false && +v.amount > 0) { const t = db.collection('finance_transactions').doc('inv_' + v.id); await t.set({ date: localDate(), partner: v.vendor, purpose: 'Rechnung' + (v.number ? ' ' + v.number : ''), category: normCat(v.category, -1), amount: -Math.abs(+v.amount || 0), owner: currentUser.email, source: 'invoice', createdAt: TS() }); upd.txId = t.id; }
            await ref.update(upd); UX.toast(upd.txId ? 'Bezahlt und als Ausgabe gebucht' : 'Als bezahlt markiert');
        } else {
            if (v.txId) await db.collection('finance_transactions').doc(v.txId).delete().catch(() => {});
            await ref.update({ status: 'open', paidAt: firebase.firestore.FieldValue.delete(), txId: firebase.firestore.FieldValue.delete(), updatedAt: TS() }); UX.toast('Wieder offen' + (v.txId ? ', Buchung entfernt' : ''));
        }
    });
}
async function invView(v) {
    const w = window.open('', '_blank');
    try { const sn = await db.collection('invoices').doc(v.id).collection('chunks').orderBy('i').get(); if (!sn.size) throw new Error('Datei fehlt.');
        const parts = sn.docs.map(d => { const s = atob(d.data().data), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; });
        const url = URL.createObjectURL(new Blob(parts, { type: v.fileMime || 'application/pdf' }));
        if (w) w.location = url; else location.href = url; setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { if (w) w.close(); UX.toast('Datei konnte nicht geladen werden: ' + e.message, true); }
}
// ---------- Rechnungen importieren (CSV) ----------
// Spalten werden über ihre Überschrift erkannt (änderbar); Doppelte werden erkannt und standardmäßig abgewählt.
const II_FIELDS = [['vendor', 'Anbieter', /gläubiger|anbieter|absender|firma|händler|haendler|lieferant|empfänger|empfaenger|name/i], ['note', 'Beschreibung', /^was$|beschreibung|leistung|artikel|bezeichnung|betreff|gegenstand/i],
    ['amount', 'Betrag', /betrag|summe|preis|amount/i], ['due', 'Fällig am', /fällig|faellig|zahlbar|frist|due/i], ['date', 'Rechnungsdatum', /rechnungsdatum|^datum$|ausgestellt/i],
    ['number', 'Rechnungsnummer', /rechnungs-?n(umme)?r|^nr\.?$|belegnummer|auftrag/i], ['ref', 'Verwendungszweck / Hinweis', /verwendungszweck|^vz$|hinweis|referenz/i], ['status', 'Status', /status|zustand/i], ['iban', 'IBAN', /iban/i], ['category', 'Kategorie', /kategorie/i]];
let II = null;
function csvParse(text) {
    text = text.replace(/^\uFEFF/, ''); const first = text.split(/\r?\n/)[0] || '', sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) { const ch = text[i];
        if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
        else if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch; }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
}
const iiNum = s => { s = String(s || '').replace(/[€\s]/g, ''); if (!s) return null; if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); const n = parseFloat(s); return isNaN(n) ? null : Math.round(Math.abs(n) * 100) / 100; };
const iiDate = s => { s = String(s || '').trim(); let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; } m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0].slice(0, 10) : ''; };
const iiStatus = s => /bezahlt|erledigt|beglichen|paid/i.test(s || '') && !/un|nicht/i.test(s || '') ? 'paid' : 'open';
function iiCat(r) { const t = `${r.vendor} ${r.note}`.toLowerCase();
    if (/versicherung|allianz|huk|adac|debeka|axa/.test(t)) return 'Versicherungen'; if (/tank|auto|kfz|werkstatt|reifen|roller|hawk|ersatzteil/.test(t)) return 'Auto';
    if (/miete|strom|gas|stadtwerke|wasser|nebenkosten|möbel|stuhl|nachttisch|ikea|vodafone|telekom|o2|mobilfunk|internet/.test(t)) return 'Wohnen'; if (/netflix|spotify|abo|disney|dazn/.test(t)) return 'Abos';
    if (/rewe|edeka|aldi|lidl|supermarkt|lebensmittel/.test(t)) return 'Lebensmittel'; if (/apotheke|arzt|praxis|zahn/.test(t)) return 'Gesundheit'; if (/kino|steam|amazon/.test(t)) return 'Freizeit'; return 'Sonstiges'; }
async function invImportFile(e) {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const buf = await f.arrayBuffer(); let txt;
    try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (err) { txt = new TextDecoder('windows-1252').decode(buf); }   // Excel speichert CSV oft in Windows-1252
    const rows = csvParse(txt); if (rows.length < 2) return UX.toast('In der Datei wurden keine Zeilen gefunden.', true);
    const head = rows[0].map(h => h.trim()), map = {};
    II_FIELDS.forEach(([k, , re]) => { const i = head.findIndex((h, j) => re.test(h) && !Object.values(map).includes(j)); if (i >= 0) map[k] = i; });
    II = { name: f.name, head, rows: rows.slice(1), map, items: null }; iiBuild(true); openModal('m-iimp');
}
function iiBuild(fresh) {
    const { head, rows, map } = II, cell = (r, k) => map[k] == null ? '' : String(r[map[k]] ?? '').trim();
    $('ii-sub').innerHTML = `<b>${esc(II.name)}</b> · ${rows.length} Zeilen. Prüfe die Zuordnung der Spalten und wähle ab, was du nicht übernehmen möchtest.`;
    $('ii-sum').innerHTML = `Spalten automatisch erkannt: <b>${II_FIELDS.filter(([k]) => map[k] != null).map(([, l]) => l).join(', ') || 'keine'}</b> · antippen zum Ändern`;
    $('ii-map').innerHTML = II_FIELDS.map(([k, label]) => `<label>${label}<select class="ux-in" data-map="${k}"><option value="">– keine –</option>${head.map((h, i) => `<option value="${i}"${map[k] === i ? ' selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('');
    II.items = rows.map((r, i) => {
        const prev = II.items && !fresh ? II.items[i] : null, ref0 = cell(r, 'ref');
        const it = { vendor: cell(r, 'vendor').slice(0, 80), note: cell(r, 'note'), amount: iiNum(cell(r, 'amount')), due: iiDate(cell(r, 'due')), date: iiDate(cell(r, 'date')), number: cell(r, 'number').slice(0, 60), iban: cell(r, 'iban').toUpperCase(), statusRaw: cell(r, 'status') };
        // „VZ 1234 – Hinweis“: Verwendungszweck und Hinweis trennen
        const m = ref0.match(/^VZ[:\s]+([^–—;]+?)(?:\s*[–—-]\s+(.*))?$/i); if (m) { it.ref = m[1].trim(); it.hint = (m[2] || '').trim(); } else { it.ref = ''; it.hint = ref0; }
        it.status = iiStatus(it.statusRaw); it.category = prev ? normCat(prev.category, -1) : (CATS.includes(normCat(cell(r, 'category'), -1)) && cell(r, 'category') ? normCat(cell(r, 'category'), -1) : iiCat(it));
        it.dup = invs.some(v => v.vendor === it.vendor && (v.amount ?? null) === it.amount && (v.due || '') === it.due && (v.note || '').startsWith(it.note.slice(0, 30)));
        it.on = prev ? prev.on : !!it.vendor && !it.dup; return it; });
    $('ii-rows').innerHTML = II.items.map((it, i) => {
        const hints = [it.dup ? '<span class="dup">schon vorhanden</span>' : '', !it.vendor ? '<span class="dup">ohne Anbieter</span>' : '', it.amount == null ? 'Betrag fehlt' : '', !it.due && it.status !== 'paid' ? 'Fälligkeit fehlt' : '', /pause|prüf|pruef|mahn/i.test(it.statusRaw) ? esc(it.statusRaw) : ''].filter(Boolean).join(' · ');
        return `<tr class="${it.on ? '' : 'off'}"><td><input type="checkbox" data-ii="${i}" ${it.on ? 'checked' : ''} ${it.vendor ? '' : 'disabled'} aria-label="Zeile übernehmen"></td><td><b>${esc(it.vendor)}</b></td><td>${esc(it.note)}${it.ref ? `<br><small style="color:#94a3b8">VZ ${esc(it.ref)}</small>` : ''}</td>
            <td class="r">${it.amount == null ? '–' : eur(it.amount)}</td><td>${it.due ? dLong(it.due) : '–'}</td><td><span class="stt ${it.status}">${it.status === 'paid' ? 'bezahlt' : 'offen'}</span></td>
            <td><select class="ux-in" data-iic="${i}">${CAT_OUT.map(c => `<option${c === it.category ? ' selected' : ''}>${c}</option>`).join('')}</select></td><td class="hint">${hints}</td></tr>`; }).join('');
    iiCount();
}
function iiCount() { const n = II.items.filter(x => x.on).length; $('ii-count').textContent = `${n} von ${II.items.length} Rechnungen werden übernommen` + (II.items.some(x => x.on && x.status === 'paid') ? ' (bezahlte ohne neue Buchung)' : ''); $('ii-go').disabled = !n; $('ii-all').checked = II.items.every(x => x.on || !x.vendor); }
document.addEventListener('change', e => {
    if (!II || !e.target.closest('#m-iimp')) return; const t = e.target;
    if (t.dataset.map) { if (t.value === '') delete II.map[t.dataset.map]; else II.map[t.dataset.map] = +t.value; iiBuild(false); }
    else if (t.dataset.ii) { II.items[+t.dataset.ii].on = t.checked; t.closest('tr').classList.toggle('off', !t.checked); iiCount(); }
    else if (t.dataset.iic) II.items[+t.dataset.iic].category = t.value;
    else if (t.id === 'ii-all') { II.items.forEach(x => { if (x.vendor) x.on = t.checked; }); iiBuild(false); }
});
function invImportGo() {
    const list = II.items.filter(x => x.on); if (!list.length) return; const btn = $('ii-go'); btn.disabled = true; btn.textContent = 'Übernehme …';
    run(async () => {
        for (let i = 0; i < list.length; i += 400) { const b = db.batch();
            list.slice(i, i + 400).forEach(it => { const note = [it.note, it.hint, /pause|prüf|pruef/i.test(it.statusRaw) ? it.statusRaw : ''].filter(Boolean).join(' · ').slice(0, 200);
                const d = { vendor: it.vendor, amount: it.amount, date: it.date || '', due: it.due || '', category: it.category, number: it.number || '', iban: it.iban || '', ref: it.ref || '', note, autoBook: it.status !== 'paid', status: it.status, owner: currentUser.email, source: 'import', createdAt: TS(), updatedAt: TS() };
                if (it.status === 'paid') d.paidAt = it.due || localDate(); b.set(db.collection('invoices').doc(), d); });
            await b.commit(); }
        closeModal('m-iimp'); UX.toast(`${list.length} Rechnung${list.length === 1 ? '' : 'en'} importiert`); logSystemEvent('data', 'Rechnungen importiert', { anzahl: list.length }); invFilter = 'open'; renderInv();
    }).finally(() => { btn.disabled = false; btn.textContent = 'Übernehmen'; });
}
function invCopy(v) { const what = v.iban ? v.iban.replace(/\s/g, '') : v.ref; navigator.clipboard.writeText(what).then(() => UX.toast(v.iban ? 'IBAN kopiert' + (v.ref ? ' · Verwendungszweck: ' + v.ref : '') : 'Verwendungszweck kopiert'), () => prompt(v.iban ? 'IBAN' : 'Verwendungszweck', what)); }
