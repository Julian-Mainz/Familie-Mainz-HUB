// js/layout.js - frei anpassbare Karten-Anordnung für die Modul-Seiten (Zeiterfassung, Finanzen, ...).
// Karten liegen in einem Raster (12 Spalten) und rücken ohne Lücken zusammen. Im Anpassen-Modus kann jede Karte per Ziehen oder Pfeil-Knöpfen
// verschoben, in 5 Breiten gestellt (¼, ⅓, ½, ⅔, ganz) und ausgeblendet werden. Optional lassen sich auch die Reiter einer Seite ordnen.
// Das Layout wird je Person im Profil gespeichert (userPrefs.layouts.<seite>); die Seite übergibt dazu eine save-Funktion.
(function (root) {
    'use strict';
    const WIDTHS = [3, 4, 6, 8, 12], WLABEL = { 3: '¼', 4: '⅓', 6: '½', 8: '⅔', 12: 'Ganz' }, ROW = 8, GAP = 16;
    const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const clone = o => JSON.parse(JSON.stringify(o));
    const toast = (m, bad) => (S && S.toast ? S.toast(m, bad) : root.UX && UX.toast ? UX.toast(m, bad) : alert(m));
    let S = null;
    document.documentElement.classList.add('lay-js');                                  // ab jetzt versteckt das Raster, bis die Karten sortiert sind
    setTimeout(() => document.querySelectorAll('.lay-grid').forEach(g => g.classList.add('lay-ready')), 4000);      // Sicherheitsnetz

    // ---------- Daten ----------
    function norm(l, includeTabs = true) {
        const ids = S.mods.map(m => m.id), o = l && Array.isArray(l.order) ? l.order.filter(id => S.byId[id]) : [], out = { order: [...new Set(o)], hidden: [], width: {} };
        ids.forEach(id => { if (!out.order.includes(id)) out.order.push(id); });                                       // neue Karten (spätere Updates) landen hinten
        out.hidden = [...new Set((l && Array.isArray(l.hidden) ? l.hidden : []).filter(id => S.byId[id]))];
        ids.forEach(id => { const w = l && l.width ? +l.width[id] : 0; out.width[id] = WIDTHS.includes(w) ? w : S.byId[id].w; });
        if (S.tabs && includeTabs) {
            const tids = S.tabs.items.map(t => t.id), t = l && l.tabs ? l.tabs : {}, to = (Array.isArray(t.order) ? t.order : []).filter(id => tids.includes(id)), th = (Array.isArray(t.hidden) ? t.hidden : []).filter(id => tids.includes(id));
            tids.forEach(id => { if (!to.includes(id)) to.push(id); });
            out.tabs = { order: [...new Set(to)], hidden: th.length >= tids.length ? [] : [...new Set(th)] };           // mindestens ein Reiter bleibt sichtbar
        }
        return out;
    }
    const defaults = () => norm({ order: S.mods.map(m => m.id), hidden: [], width: Object.fromEntries(S.mods.map(m => [m.id, m.w])), tabs: S.tabs ? { order: S.tabs.items.map(t => t.id), hidden: [] } : undefined });
    const na = id => S.byId[id].el.hasAttribute('data-na');                      // z. B. Karte ohne Berechtigung: nie sichtbar, nicht in der Ablage
    const visible = () => S.cur.order.filter(id => !S.cur.hidden.includes(id) && !na(id));

    // ---------- Anzeige ----------
    function rects() { const r = {}; S.mods.forEach(m => { if (!m.el.classList.contains('lay-hide') && m !== S.dragging) r[m.id] = m.el.getBoundingClientRect(); }); return r; }
    function play(first) {
        S.mods.forEach(m => {
            const a = first[m.id]; if (!a || m === S.dragging || !m.el.animate) return; const b = m.el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
            if (Math.abs(dx) + Math.abs(dy) > 1) m.el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
        });
    }
    // Karten ohne Lücken: Jede Karte belegt so viele 8-Pixel-Zeilen, wie sie hoch ist
    function masonry() {
        S.mods.forEach(m => {
            if (m.el.classList.contains('lay-hide')) return; const n = Math.max(1, Math.ceil((m.el.offsetHeight + GAP) / ROW)); if (m.span !== n) { m.span = n; m.el.style.gridRowEnd = 'span ' + n; }
        });
    }
    const schedule = () => { if (!S.raf) S.raf = requestAnimationFrame(() => { S.raf = 0; masonry(); }); };
    function render(flip) {
        const first = flip && !reduced() ? rects() : null;
        S.cur.order.forEach((id, i) => { const m = S.byId[id]; m.el.style.order = i; m.el.style.setProperty('--w', S.cur.width[id]); m.el.classList.toggle('lay-hide', S.cur.hidden.includes(id) || na(id)); });
        if (S.tabs) S.tabs.items.forEach(t => { const i = S.cur.tabs.order.indexOf(t.id); t.el.style.order = i; t.el.classList.toggle('lay-hide', S.cur.tabs.hidden.includes(t.id)); });
        masonry(); labels(); tray(); if (first) play(first);
        if (S.onTabs) S.onTabs();
    }
    function labels() {
        S.mods.forEach(m => { const ov = m.ov; if (!ov) return; const w = S.cur.width[m.id], i = WIDTHS.indexOf(w); ov.querySelector('.lay-wl').textContent = WLABEL[w];
            ov.querySelector('[data-a="narrower"]').disabled = i <= 0; ov.querySelector('[data-a="wider"]').disabled = i >= WIDTHS.length - 1;
            const v = visible(), k = v.indexOf(m.id); ov.querySelector('[data-a="prev"]').disabled = k <= 0; ov.querySelector('[data-a="next"]').disabled = k < 0 || k >= v.length - 1; });
    }
    function tray() {
        if (!S.tr) return; const hid = S.cur.hidden.filter(id => !na(id));
        let h = `<div class="lay-row"><b>Ausgeblendet</b>${hid.length ? hid.map(id => `<button type="button" class="lay-chip" data-show="${esc(id)}"><i class="fa-solid fa-plus"></i>${esc(S.byId[id].title)}</button>`).join('') : '<span class="lay-note">Keine Karte ausgeblendet. Mit dem Augen-Symbol auf einer Karte blendest du sie aus.</span>'}</div>`;
        if (S.tabs) {
            const to = S.cur.tabs.order, vis = to.filter(id => !S.cur.tabs.hidden.includes(id));
            h += `<div class="lay-row"><b>Reiter</b>${to.map((id, i) => { const t = S.tabs.items.find(x => x.id === id), off = S.cur.tabs.hidden.includes(id), k = vis.indexOf(id);
                return `<span class="lay-tab${off ? ' off' : ''}"><button type="button" data-tm="${esc(id)}" data-d="-1" aria-label="Reiter ${esc(t.title)} nach vorn"${i === 0 ? ' disabled' : ''}><i class="fa-solid fa-arrow-left"></i></button><span>${esc(t.title)}</span>
                    <button type="button" data-tm="${esc(id)}" data-d="1" aria-label="Reiter ${esc(t.title)} nach hinten"${i === to.length - 1 ? ' disabled' : ''}><i class="fa-solid fa-arrow-right"></i></button>
                    <button type="button" data-tt="${esc(id)}" aria-label="Reiter ${esc(t.title)} ${off ? 'einblenden' : 'ausblenden'}"${!off && vis.length <= 1 ? ' disabled' : ''}><i class="fa-solid ${off ? 'fa-eye' : 'fa-eye-slash'}"></i></button></span>`; }).join('')}</div>`;
        }
        S.tr.innerHTML = h;
    }

    // ---------- Bearbeiten ----------
    function build() {
        S.mods.forEach(m => {
            m.ov = document.createElement('div'); m.ov.className = 'lay-ov';
            m.ov.innerHTML = `<div class="lay-top"><button type="button" class="lay-grip" data-a="grip" title="Ziehen zum Verschieben (oder Pfeiltasten)" aria-label="${esc(m.title)} verschieben"><i class="fa-solid fa-grip"></i></button><span class="lay-name">${esc(m.title)}</span>
                <button type="button" data-a="hide" title="Ausblenden" aria-label="${esc(m.title)} ausblenden"><i class="fa-solid fa-eye-slash"></i></button>
                <div class="lay-ctl"><button type="button" data-a="prev" title="Nach vorn" aria-label="${esc(m.title)} nach vorn"><i class="fa-solid fa-arrow-left"></i></button><button type="button" data-a="next" title="Nach hinten" aria-label="${esc(m.title)} nach hinten"><i class="fa-solid fa-arrow-right"></i></button>
                <span class="lay-w"><button type="button" data-a="narrower" title="Schmaler" aria-label="${esc(m.title)} schmaler"><i class="fa-solid fa-minus"></i></button><b class="lay-wl"></b><button type="button" data-a="wider" title="Breiter" aria-label="${esc(m.title)} breiter"><i class="fa-solid fa-plus"></i></button></span></div></div>`;
            m.el.appendChild(m.ov);
        });
        S.tr = document.createElement('div'); S.tr.className = 'lay-tray'; S.root.parentNode.insertBefore(S.tr, S.tabsAnchor || S.root);
        S.bar = document.createElement('div'); S.bar.className = 'lay-edit-bar'; S.bar.setAttribute('role', 'toolbar'); S.bar.setAttribute('aria-label', 'Anpassen');
        S.bar.innerHTML = `<span class="lay-ttl"><i class="fa-solid fa-table-columns"></i>Anpassen</span><label class="lay-sel"><span>Vorlage</span><select id="lay-preset"><option value="">Vorlage wählen …</option>${Object.keys(S.presets).map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select></label>
            <button type="button" data-b="reset"><i class="fa-solid fa-rotate-left"></i>Zurücksetzen</button><button type="button" data-b="cancel">Abbrechen</button><button type="button" data-b="save" class="pri"><i class="fa-solid fa-check"></i>Speichern</button>`;
        document.body.appendChild(S.bar);
        S.root.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || !S.editing) return; const id = b.closest('.lay-item').dataset.mod, a = b.dataset.a; if (a === 'prev') move(id, -1); else if (a === 'next') move(id, 1); else if (a === 'narrower') setW(id, -1); else if (a === 'wider') setW(id, 1); else if (a === 'hide') hide(id); });
        S.tr.addEventListener('click', e => {
            const s = e.target.closest('[data-show]'); if (s) return show(s.dataset.show);
            const m = e.target.closest('[data-tm]'); if (m) { const o = S.cur.tabs.order, i = o.indexOf(m.dataset.tm), j = i + +m.dataset.d; if (j >= 0 && j < o.length) { [o[i], o[j]] = [o[j], o[i]]; render(false); } return; }
            const t = e.target.closest('[data-tt]'); if (t) { const h = S.cur.tabs.hidden, id = t.dataset.tt; if (h.includes(id)) S.cur.tabs.hidden = h.filter(x => x !== id); else h.push(id); render(false); }
        });
        S.bar.addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (!b) return; if (b.dataset.b === 'save') save(); else if (b.dataset.b === 'cancel') cancel(); else if (b.dataset.b === 'reset') { S.cur = defaults(); $p().value = ''; render(true); } });
        $p().addEventListener('change', e => { const p = S.presets[e.target.value]; if (p) { S.cur = norm(p); render(true); } });
        S.root.addEventListener('keydown', e => { const g = e.target.closest('.lay-grip'); if (!g || !S.editing) return; const id = g.closest('.lay-item').dataset.mod; if (/^Arrow(Left|Up)$/.test(e.key)) { e.preventDefault(); move(id, -1); } else if (/^Arrow(Right|Down)$/.test(e.key)) { e.preventDefault(); move(id, 1); } });
        S.root.addEventListener('pointerdown', dragStart);
    }
    const $p = () => document.getElementById('lay-preset');
    function move(id, d) { const v = visible(), i = v.indexOf(id), j = i + d; if (i < 0 || j < 0 || j >= v.length) return; const o = S.cur.order, a = o.indexOf(id), b = o.indexOf(v[j]); [o[a], o[b]] = [o[b], o[a]]; render(true); }
    function setW(id, d) { const i = WIDTHS.indexOf(S.cur.width[id]), k = Math.max(0, Math.min(WIDTHS.length - 1, i + d)); if (k !== i) { S.cur.width[id] = WIDTHS[k]; render(true); } }
    function hide(id) { if (!S.cur.hidden.includes(id)) S.cur.hidden.push(id); render(true); }
    function show(id) { S.cur.hidden = S.cur.hidden.filter(x => x !== id); render(true); }

    // Ziehen mit Maus oder Finger (Pointer Events): Die Karte folgt dem Zeiger, die anderen rücken weich zur Seite
    function dragStart(e) {
        const g = e.target.closest('.lay-grip'); if (!g || !S.editing || (e.button !== undefined && e.button !== 0)) return; e.preventDefault();
        const el = g.closest('.lay-item'), m = S.byId[el.dataset.mod], r = el.getBoundingClientRect();
        S.dragging = m; S.grab = { dx: e.clientX - r.left, dy: e.clientY - r.top }; S.lastOver = null; el.classList.add('lay-drag'); el.style.transition = 'none';
        try { g.setPointerCapture(e.pointerId); } catch (x) {}
        const mv = ev => follow(ev), up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); dragEnd(); };
        g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    }
    function follow(e) {
        const m = S.dragging; if (!m) return; const el = m.el; S.pt = { x: e.clientX, y: e.clientY };
        el.style.transform = 'none'; const nat = el.getBoundingClientRect();
        el.style.transform = `translate(${e.clientX - S.grab.dx - nat.left}px,${e.clientY - S.grab.dy - nat.top}px) scale(1.02)`;
        let over = null; for (const id of visible()) { if (id === m.id) continue; const r = S.byId[id].el.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { over = id; break; } }
        if (!over) S.lastOver = null;
        else if (over !== S.lastOver) {
            S.lastOver = over; const first = reduced() ? null : rects(), o = S.cur.order, a = o.indexOf(m.id), b = o.indexOf(over); o.splice(a, 1); o.splice(b, 0, m.id);
            S.cur.order.forEach((id, i) => { S.byId[id].el.style.order = i; }); masonry(); labels(); if (first) play(first);
            el.style.transform = 'none'; const n2 = el.getBoundingClientRect(); el.style.transform = `translate(${e.clientX - S.grab.dx - n2.left}px,${e.clientY - S.grab.dy - n2.top}px) scale(1.02)`;
        }
        const sc = S.scroller || (S.scroller = scrollParent(S.root)), top = sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top, bot = sc === document.scrollingElement ? innerHeight : sc.getBoundingClientRect().bottom;
        if (e.clientY < top + 90) sc.scrollBy(0, -16); else if (e.clientY > bot - 90) sc.scrollBy(0, 16);
    }
    function scrollParent(el) { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if (/(auto|scroll)/.test(o) && n.scrollHeight > n.clientHeight + 1) return n; } return document.scrollingElement || document.documentElement; }
    function dragEnd() {
        const m = S.dragging; if (!m) return; const el = m.el; S.dragging = null; S.scroller = null;
        el.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1)'; el.style.transform = 'none';
        setTimeout(() => { el.classList.remove('lay-drag'); el.style.transition = ''; }, 300); render(false);
    }

    function edit(on) {
        if (on === S.editing) return; S.editing = on; document.body.classList.toggle('lay-on', on); S.root.classList.toggle('lay-editing', on);
        if (on) { S.snap = clone(S.cur); $p().value = ''; if (S.onEdit) S.onEdit(true); render(false); setTimeout(() => { const g = S.root.querySelector('.lay-item:not(.lay-hide) .lay-grip'); if (g) g.focus({ preventScroll: true }); }, 50); }
        else { if (S.onEdit) S.onEdit(false); }
        const b = document.getElementById('lay-btn'); if (b) b.classList.toggle('on', on);
    }
    const dirty = () => JSON.stringify(S.cur) !== JSON.stringify(S.snap);
    function cancel() { if (!S.editing) return; S.cur = clone(S.snap); render(false); edit(false); }
    async function save() {
        const btn = S.bar.querySelector('[data-b="save"]'); btn.disabled = true;
        try { await S.save(clone(S.cur)); S.saved = clone(S.cur); S.snap = clone(S.cur); edit(false); toast('Layout gespeichert'); }
        catch (e) { toast('Speichern fehlgeschlagen: ' + (e.code || e.message), true); } finally { btn.disabled = false; }
    }
    function toggle() { if (!S.editing) return edit(true); if (dirty() && !confirm('Änderungen am Layout verwerfen?')) return; cancel(); }

    // ---------- Start ----------
    function init(o) {
        if (S && S.bar) S.bar.remove();
        S = { key: o.key, root: o.root, mods: [], byId: {}, presets: o.presets || {}, save: o.save, editing: false, tabs: o.tabs || null, onTabs: o.onTabs, onEdit: o.onEdit, toast: o.toast, tabsAnchor: o.anchor || null, raf: 0 };
        o.modules.forEach(d => { const el = typeof d.el === 'string' ? document.querySelector(d.el) : d.el; if (!el) return; const m = { id: d.id, title: d.title, w: WIDTHS.includes(d.w) ? d.w : 12, el, span: 0 }; S.mods.push(m); S.byId[m.id] = m; el.dataset.mod = m.id; el.classList.add('lay-item'); });
        S.root.classList.add('lay-grid'); S.ro = new ResizeObserver(schedule); S.mods.forEach(m => S.ro.observe(m.el));
        S.cur = norm(o.prefs || null); S.saved = clone(S.cur); build(); render(false);
        window.addEventListener('resize', schedule); requestAnimationFrame(() => S.root.classList.add('lay-ready')); setTimeout(() => S.root.classList.add('lay-ready'), 2500);
    }
    // Gespeichertes Layout nachträglich laden (nach der Anmeldung)
    function load(prefs) { if (!S) return; S.cur = norm(prefs || null); S.saved = clone(S.cur); if (S.editing) S.snap = clone(S.cur); render(false); }

    const tabHidden = id => !!(S && S.cur.tabs && S.cur.tabs.hidden.includes(id));
    const firstTab = () => (S && S.cur.tabs ? S.cur.tabs.order.find(id => !S.cur.tabs.hidden.includes(id)) : null);
    root.Layout = { init, load, toggle, edit, refresh: () => { if (S) { masonry(); schedule(); } }, tabHidden, firstTab, isEditing: () => !!(S && S.editing), current: () => (S ? clone(S.cur) : null), norm: l => (S ? norm(l) : l) };
})(typeof window !== 'undefined' ? window : globalThis);
