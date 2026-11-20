// js/layout.js - frei anpassbare Karten-Anordnung für die Modul-Seiten (Zeiterfassung, Finanzen, ...).
// Karten liegen in einem Raster (12 Spalten) und rücken ohne Lücken zusammen. Im Anpassen-Modus kann jede Karte per Ziehen oder Pfeil-Knöpfen
// verschoben, ausgeblendet und an der Ecke rechts unten im Raster größer oder kleiner gezogen werden (Breite in 12 Spalten, Höhe in Reihen zu 40 px).
// Zusätzlich gibt es die Anordnung "Frei im Raster": Karten liegen dann genau dort, wo man sie ablegt (Spalte und Reihe), Lücken sind erlaubt,
// überlappende Karten werden nach unten geschoben. Auf schmalen Bildschirmen liegen sie weiterhin untereinander (von oben links nach unten rechts).
// Optional lassen sich auch die Reiter einer Seite ordnen.
// Das Layout wird je Person im Profil gespeichert (userPrefs.layouts.<seite>); die Seite übergibt dazu eine save-Funktion.
// Wer noch kein eigenes Layout hat, bekommt den Standard, den ein Admin mit „Als Standard für alle“ festgelegt hat (layout_defaults/<seite>).
(function (root) {
    'use strict';
    const WIDTHS = [3, 4, 6, 8, 12], WLABEL = { 3: '¼', 4: '⅓', 6: '½', 8: '⅔', 12: 'Ganz' }, ROW = 8, GAP = 16;
    const MINW = 2, RU = 40, MINH = 4, MAXH = 40;                                         // Raster: kleinste Breite 2 Spalten, eine Reihe = 40 px
    const okW = w => Number.isInteger(w) && w >= MINW && w <= 12, okH = h => Number.isInteger(h) && h >= MINH && h <= MAXH;
    const wl = w => WLABEL[w] || w + '/12', hl = h => (h ? h + ' R' : 'Auto');
    const wide = () => innerWidth > 1100;                                                  // auf schmalen Bildschirmen liegen alle Karten untereinander
    const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const clone = o => JSON.parse(JSON.stringify(o));
    const toast = (m, bad) => (S && S.toast ? S.toast(m, bad) : root.UX && UX.toast ? UX.toast(m, bad) : alert(m));
    let S = null;
    document.documentElement.classList.add('lay-js');                                  // ab jetzt versteckt das Raster, bis die Karten sortiert sind
    setTimeout(() => document.querySelectorAll('.lay-grid').forEach(g => g.classList.add('lay-ready')), 4000);      // Sicherheitsnetz

    // ---------- Daten ----------
    function norm(l, includeTabs = true) {
        const ids = S.mods.map(m => m.id), o = l && Array.isArray(l.order) ? l.order.filter(id => S.byId[id]) : [], out = { order: [...new Set(o)], hidden: [], width: {}, height: {} };
        ids.forEach(id => { if (!out.order.includes(id)) out.order.push(id); });                                       // neue Karten (spätere Updates) landen hinten
        out.hidden = [...new Set((l && Array.isArray(l.hidden) ? l.hidden : S.mods.filter(m => m.off).map(m => m.id)).filter(id => S.byId[id]))];
        ids.forEach(id => { const w = l && l.width ? +l.width[id] : 0; out.width[id] = okW(w) ? w : S.byId[id].w; });
        ids.forEach(id => { const h = l && l.height ? +l.height[id] : (l && l.width ? 0 : S.byId[id].h); if (okH(h)) out.height[id] = h; });
        if (l && l.free) {                                                                                              // freie Anordnung: [Spalte, Reihe] je Karte
            out.free = true; out.pos = {};
            ids.forEach(id => { const p = l.pos && l.pos[id]; if (Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[1] >= 0) out.pos[id] = [Math.max(0, Math.min(12 - out.width[id], p[0])), Math.min(p[1], 4000)]; });
        }
        if (S.tabs && includeTabs) {
            const tids = S.tabs.items.map(t => t.id), t = l && l.tabs ? l.tabs : {}, to = (Array.isArray(t.order) ? t.order : []).filter(id => tids.includes(id)), th = (Array.isArray(t.hidden) ? t.hidden : []).filter(id => tids.includes(id));
            tids.forEach(id => { if (!to.includes(id)) to.push(id); });
            out.tabs = { order: [...new Set(to)], hidden: th.length >= tids.length ? [] : [...new Set(th)] };           // mindestens ein Reiter bleibt sichtbar
        }
        return out;
    }
    const defaults = () => norm({ order: S.mods.map(m => m.id), hidden: S.mods.filter(m => m.off).map(m => m.id), width: Object.fromEntries(S.mods.map(m => [m.id, m.w])), height: Object.fromEntries(S.mods.filter(m => m.h).map(m => [m.id, m.h])), tabs: S.tabs ? { order: S.tabs.items.map(t => t.id), hidden: [] } : undefined });
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
    const schedule = () => { if (!S.raf) S.raf = requestAnimationFrame(() => { S.raf = 0; if (freeOn()) { if (!S.dragging) placeFree(S.sizing || null); } else masonry(); }); };

    // ---------- Freie Anordnung im Raster ----------
    const freeOn = () => !!(S && S.cur && S.cur.free) && wide();
    function geom() { const g = S.root, cg = parseFloat(getComputedStyle(g).columnGap) || GAP, cw = (g.clientWidth - 11 * cg) / 12; return { cg, cw, cp: cw + cg }; }
    const rowsOf = id => S.cur.height[id] || Math.max(1, Math.ceil((S.byId[id].el.offsetHeight + GAP) / RU));
    // Jede Karte möchte an ihre gespeicherte Stelle. Liegt dort schon eine andere, rutscht sie darunter. "fixed" (die gerade gezogene Karte) kommt zuerst dran.
    function placeFree(fixed) {
        const G = geom(), vis = visible(), pos = S.cur.pos || (S.cur.pos = {});
        vis.forEach(id => { const w = S.cur.width[id]; S.byId[id].el.style.width = (w * G.cw + (w - 1) * G.cg) + 'px'; });
        let bottom = 0; vis.forEach(id => { if (pos[id]) bottom = Math.max(bottom, pos[id][1] + rowsOf(id)); });
        vis.forEach(id => { if (!pos[id]) { pos[id] = [0, bottom]; bottom += rowsOf(id); } else pos[id][0] = Math.max(0, Math.min(12 - S.cur.width[id], pos[id][0])); });
        const order = vis.slice().sort((a, b) => (a === fixed ? -1 : b === fixed ? 1 : 0) || pos[a][1] - pos[b][1] || pos[a][0] - pos[b][0]);
        const placed = []; S.at = {};
        order.forEach(id => {
            const w = S.cur.width[id], h = rowsOf(id), x = pos[id][0]; let y = pos[id][1], hit;
            do { hit = placed.find(p => x < p.x + p.w && p.x < x + w && y < p.y + p.h && p.y < y + h); if (hit) y = hit.y + hit.h; } while (hit);
            placed.push({ id, x, y, w, h }); S.at[id] = [x, y];
            if (S.dragging && S.dragging.id === id) return; const el = S.byId[id].el; el.style.left = (x * G.cp) + 'px'; el.style.top = (y * RU) + 'px';
        });
        S.root.style.height = Math.max(0, placed.reduce((m, p) => Math.max(m, p.y + p.h), 0) * RU - GAP) + 'px';
    }
    // Aufgelöste Positionen übernehmen (nach Ziehen, Größe ändern, Einblenden) und die Reihenfolge für schmale Bildschirme daraus ableiten
    function commitFree() {
        if (!S.at) return; Object.entries(S.at).forEach(([id, p]) => { S.cur.pos[id] = p.slice(); });
        const v = visible().sort((a, b) => S.cur.pos[a][1] - S.cur.pos[b][1] || S.cur.pos[a][0] - S.cur.pos[b][0]);
        S.cur.order = [...v, ...S.cur.order.filter(id => !v.includes(id))];
    }
    function unfree() { S.mods.forEach(m => { m.el.style.left = m.el.style.top = m.el.style.width = ''; }); S.root.style.height = ''; }
    // Umschalten: Beim Wechsel auf "frei" bleiben die Karten genau dort, wo sie gerade sind
    function setMode(free) {
        if (!!S.cur.free === free) return;
        if (free) {
            if (!wide()) { toast('Die freie Anordnung lässt sich nur auf einem breiten Bildschirm einrichten.', true); modeSel(); return; }
            const G = geom(), rr = S.root.getBoundingClientRect(); S.cur.pos = {};
            visible().forEach(id => { const r = S.byId[id].el.getBoundingClientRect(); S.cur.pos[id] = [Math.max(0, Math.min(12 - S.cur.width[id], Math.round((r.left - rr.left) / G.cp))), Math.max(0, Math.round((r.top - rr.top) / RU))]; });
            S.cur.free = true; render(false); commitFree();
        } else {
            if (S.cur.pos) { const v = visible().sort((a, b) => (S.cur.pos[a] || [0, 1e9])[1] - (S.cur.pos[b] || [0, 1e9])[1] || (S.cur.pos[a] || [0])[0] - (S.cur.pos[b] || [0])[0]); S.cur.order = [...v, ...S.cur.order.filter(id => !v.includes(id))]; }
            delete S.cur.free; delete S.cur.pos; render(true);
        }
    }
    function modeSel() { const s = document.getElementById('lay-mode'); if (s) s.value = S.cur.free ? 'free' : 'auto'; }
    function nudge(id, dx, dy) { const p = S.cur.pos[id]; if (!p) return; const x = Math.max(0, Math.min(12 - S.cur.width[id], p[0] + dx)), y = Math.max(0, p[1] + dy); if (x === p[0] && y === p[1]) return; S.cur.pos[id] = [x, y]; render(false, id); commitFree(); labels(); }
    function render(flip, fixed) {
        const first = flip && !reduced() && !freeOn() ? rects() : null;
        S.cur.order.forEach((id, i) => { const m = S.byId[id], h = S.cur.height[id]; m.el.style.order = i; m.el.style.setProperty('--w', S.cur.width[id]); m.el.classList.toggle('lay-hide', S.cur.hidden.includes(id) || na(id));
            m.el.classList.toggle('lay-fixh', !!h); if (h) m.el.style.setProperty('--lay-h', (h * RU - GAP) + 'px'); else m.el.style.removeProperty('--lay-h'); });
        gridVars();
        if (S.tabs) S.tabs.items.forEach(t => { const i = S.cur.tabs.order.indexOf(t.id); t.el.style.order = i; t.el.classList.toggle('lay-hide', S.cur.tabs.hidden.includes(t.id)); });
        const fr = freeOn(); S.root.classList.toggle('lay-free', fr);
        if (fr) placeFree(fixed); else { if (S.wasFree) unfree(); masonry(); }
        S.wasFree = fr; modeSel(); labels(); tray(); if (first) play(first);
        if (S.onTabs) S.onTabs();
    }
    function labels() {
        S.mods.forEach(m => { const ov = m.ov; if (!ov) return; const w = S.cur.width[m.id], h = S.cur.height[m.id] || 0; ov.querySelector('.lay-wl').textContent = wl(w);
            ov.querySelector('[data-a="narrower"]').disabled = w <= WIDTHS[0]; ov.querySelector('[data-a="wider"]').disabled = w >= 12;
            ov.querySelector('.lay-sz').textContent = `${w} × ${h || 'Auto'}`; ov.querySelector('[data-a="autoh"]').hidden = !h;
            ov.querySelector('.lay-rs').setAttribute('aria-label', `${m.title}: Größe ${w} von 12 Spalten, Höhe ${h ? h + ' Reihen' : 'automatisch'}. Pfeiltasten ändern die Größe.`);
            const pv = ov.querySelector('[data-a="prev"]'), nx = ov.querySelector('[data-a="next"]'), fr = freeOn();
            pv.title = fr ? 'Eine Spalte nach links' : 'Nach vorn'; nx.title = fr ? 'Eine Spalte nach rechts' : 'Nach hinten';
            pv.setAttribute('aria-label', m.title + (fr ? ' nach links' : ' nach vorn')); nx.setAttribute('aria-label', m.title + (fr ? ' nach rechts' : ' nach hinten'));
            if (fr) { const p = S.cur.pos[m.id] || [0, 0]; pv.disabled = p[0] <= 0; nx.disabled = p[0] + w >= 12; }
            else { const v = visible(), k = v.indexOf(m.id); pv.disabled = k <= 0; nx.disabled = k < 0 || k >= v.length - 1; } });
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
                <button type="button" data-a="autoh" title="Höhe wieder automatisch" aria-label="${esc(m.title)}: Höhe automatisch" hidden><i class="fa-solid fa-arrows-up-down"></i></button>
                <button type="button" data-a="hide" title="Ausblenden" aria-label="${esc(m.title)} ausblenden"><i class="fa-solid fa-eye-slash"></i></button>
                <div class="lay-ctl"><button type="button" data-a="prev" title="Nach vorn" aria-label="${esc(m.title)} nach vorn"><i class="fa-solid fa-arrow-left"></i></button><button type="button" data-a="next" title="Nach hinten" aria-label="${esc(m.title)} nach hinten"><i class="fa-solid fa-arrow-right"></i></button>
                <span class="lay-w"><button type="button" data-a="narrower" title="Schmaler" aria-label="${esc(m.title)} schmaler"><i class="fa-solid fa-minus"></i></button><b class="lay-wl"></b><button type="button" data-a="wider" title="Breiter" aria-label="${esc(m.title)} breiter"><i class="fa-solid fa-plus"></i></button></span></div></div>
                <span class="lay-sz" aria-hidden="true"></span><button type="button" class="lay-rs" data-a="rs" title="Ziehen: Größe im Raster ändern (Doppelklick: Höhe automatisch)"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button>`;
            m.el.appendChild(m.ov);
        });
        S.tr = document.createElement('div'); S.tr.className = 'lay-tray'; S.root.parentNode.insertBefore(S.tr, S.tabsAnchor || S.root);
        S.bar = document.createElement('div'); S.bar.className = 'lay-edit-bar'; S.bar.setAttribute('role', 'toolbar'); S.bar.setAttribute('aria-label', 'Anpassen');
        S.bar.innerHTML = `<span class="lay-ttl"><i class="fa-solid fa-table-columns"></i>Anpassen</span><label class="lay-sel"><span>Anordnung</span><select id="lay-mode"><option value="auto">Automatisch, ohne Lücken</option><option value="free">Frei im Raster</option></select></label><label class="lay-sel"><span>Vorlage</span><select id="lay-preset"><option value="">Vorlage wählen …</option>${Object.keys(S.presets).map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select></label>
            <button type="button" data-b="std" style="display:none" title="Dieses Layout bekommen alle, die noch kein eigenes haben"><i class="fa-solid fa-users"></i>Als Standard für alle</button><button type="button" data-b="reset"><i class="fa-solid fa-rotate-left"></i>Zurücksetzen</button><button type="button" data-b="cancel">Abbrechen</button><button type="button" data-b="save" class="pri"><i class="fa-solid fa-check"></i>Speichern</button>`;
        document.body.appendChild(S.bar);
        S.root.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || !S.editing) return; const id = b.closest('.lay-item').dataset.mod, a = b.dataset.a; if (a === 'prev') freeOn() ? nudge(id, -1, 0) : move(id, -1); else if (a === 'next') freeOn() ? nudge(id, 1, 0) : move(id, 1); else if (a === 'narrower') setW(id, -1); else if (a === 'wider') setW(id, 1); else if (a === 'hide') hide(id); else if (a === 'autoh') setH(id, 0); });
        S.root.addEventListener('dblclick', e => { const r = e.target.closest('.lay-rs'); if (r && S.editing) setH(r.closest('.lay-item').dataset.mod, 0); });
        S.tr.addEventListener('click', e => {
            const s = e.target.closest('[data-show]'); if (s) return show(s.dataset.show);
            const m = e.target.closest('[data-tm]'); if (m) { const o = S.cur.tabs.order, i = o.indexOf(m.dataset.tm), j = i + +m.dataset.d; if (j >= 0 && j < o.length) { [o[i], o[j]] = [o[j], o[i]]; render(false); } return; }
            const t = e.target.closest('[data-tt]'); if (t) { const h = S.cur.tabs.hidden, id = t.dataset.tt; if (h.includes(id)) S.cur.tabs.hidden = h.filter(x => x !== id); else h.push(id); render(false); }
        });
        S.bar.addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (!b) return; if (b.dataset.b === 'save') save(); else if (b.dataset.b === 'cancel') cancel(); else if (b.dataset.b === 'std') setStd(b); else if (b.dataset.b === 'reset') { S.cur = S.siteDef ? norm(S.siteDef) : defaults(); $p().value = ''; render(true); } });
        $p().addEventListener('change', e => { const p = S.presets[e.target.value]; if (p) { S.cur = norm(p); render(true); } });
        document.getElementById('lay-mode').addEventListener('change', e => setMode(e.target.value === 'free'));
        S.root.addEventListener('keydown', e => {           // Größe per Tastatur: Pfeile links/rechts = Spalten, hoch/runter = Reihen
            const r = e.target.closest('.lay-rs'); if (!r || !S.editing || !/^Arrow/.test(e.key)) return; e.preventDefault(); const id = r.closest('.lay-item').dataset.mod;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const w = Math.max(MINW, Math.min(12, S.cur.width[id] + (e.key === 'ArrowRight' ? 1 : -1))); if (w !== S.cur.width[id]) { S.cur.width[id] = w; render(true, id); if (freeOn()) commitFree(); } }
            else { setH(id, Math.max(MINH, Math.min(MAXH, (S.cur.height[id] || curRows(id)) + (e.key === 'ArrowDown' ? 1 : -1)))); }
        });
        S.root.addEventListener('keydown', e => { const g = e.target.closest('.lay-grip'); if (!g || !S.editing) return; const id = g.closest('.lay-item').dataset.mod;
            if (freeOn() && /^Arrow/.test(e.key)) { e.preventDefault(); const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; nudge(id, d[0], d[1]); return; }
            if (/^Arrow(Left|Up)$/.test(e.key)) { e.preventDefault(); move(id, -1); } else if (/^Arrow(Right|Down)$/.test(e.key)) { e.preventDefault(); move(id, 1); } });
        S.root.addEventListener('pointerdown', dragStart); S.root.addEventListener('pointerdown', resizeStart);
    }
    const $p = () => document.getElementById('lay-preset');
    function move(id, d) { const v = visible(), i = v.indexOf(id), j = i + d; if (i < 0 || j < 0 || j >= v.length) return; const o = S.cur.order, a = o.indexOf(id), b = o.indexOf(v[j]); [o[a], o[b]] = [o[b], o[a]]; render(true); }
    // Knöpfe springen zur nächsten üblichen Breite (¼, ⅓, ½, ⅔, ganz), Ziehen an der Ecke erlaubt jede Spaltenzahl
    function setW(id, d) { const w = S.cur.width[id], n = d > 0 ? WIDTHS.find(x => x > w) : [...WIDTHS].reverse().find(x => x < w); if (n) { S.cur.width[id] = n; render(true); } }
    function setH(id, h) { if (h) S.cur.height[id] = h; else delete S.cur.height[id]; render(true, id); if (freeOn()) commitFree(); }
    const curRows = id => Math.max(MINH, Math.min(MAXH, Math.round((S.byId[id].el.offsetHeight + GAP) / RU)));
    // Rasterlinien im Anpassen-Modus: Spaltenbreite und Zeilenhöhe als CSS-Variablen
    function gridVars() { const g = S.root, cg = parseFloat(getComputedStyle(g).columnGap) || GAP, cw = (g.clientWidth - 11 * cg) / 12; g.style.setProperty('--lay-cp', (cw + cg) + 'px'); g.style.setProperty('--lay-cw', cw + 'px'); g.style.setProperty('--lay-ru', RU + 'px'); }

    // Größe ändern: Ecke rechts unten ziehen, Breite rastet in Spalten ein, Höhe in Reihen (40 px)
    function resizeStart(e) {
        const hnd = e.target.closest('.lay-rs'); if (!hnd || !S.editing || (e.button !== undefined && e.button !== 0)) return; e.preventDefault();
        const el = hnd.closest('.lay-item'), id = el.dataset.mod, g = S.root, cg = parseFloat(getComputedStyle(g).columnGap) || GAP;
        el.classList.add('lay-sizing'); document.body.classList.add('lay-resizing'); S.sizing = id; try { hnd.setPointerCapture(e.pointerId); } catch (x) {}
        const r0 = el.getBoundingClientRect(), off = { x: r0.right - e.clientX, y: r0.bottom - e.clientY };
        const mv = ev => {
            const r = el.getBoundingClientRect(), cw = (g.clientWidth - 11 * cg) / 12, x = ev.clientX + off.x, y = ev.clientY + off.y;
            const w = wide() ? Math.max(MINW, Math.min(12, Math.round((x - r.left + cg) / (cw + cg)))) : S.cur.width[id], h = Math.max(MINH, Math.min(MAXH, Math.round((y - r.top + GAP) / RU)));
            if (w !== S.cur.width[id] || h !== S.cur.height[id]) { S.cur.width[id] = w; S.cur.height[id] = h; render(false, id); }
            const sc = S.scroller || (S.scroller = scrollParent(S.root)), bot = sc === document.scrollingElement ? innerHeight : sc.getBoundingClientRect().bottom; if (ev.clientY > bot - 60) sc.scrollBy(0, 14);
        };
        const up = () => { hnd.removeEventListener('pointermove', mv); hnd.removeEventListener('pointerup', up); hnd.removeEventListener('pointercancel', up); el.classList.remove('lay-sizing'); document.body.classList.remove('lay-resizing'); S.scroller = null; S.sizing = null; render(false, id); if (freeOn()) commitFree(); labels(); };
        hnd.addEventListener('pointermove', mv); hnd.addEventListener('pointerup', up); hnd.addEventListener('pointercancel', up);
    }
    function hide(id) { if (!S.cur.hidden.includes(id)) S.cur.hidden.push(id); render(true); }
    function show(id) { S.cur.hidden = S.cur.hidden.filter(x => x !== id); if (S.cur.pos) delete S.cur.pos[id]; render(true); if (freeOn()) commitFree(); }

    // Ziehen mit Maus oder Finger (Pointer Events): Die Karte folgt dem Zeiger, die anderen rücken weich zur Seite
    function dragStart(e) {
        const g = e.target.closest('.lay-grip'); if (!g || !S.editing || (e.button !== undefined && e.button !== 0)) return; e.preventDefault();
        const el = g.closest('.lay-item'), m = S.byId[el.dataset.mod], r = el.getBoundingClientRect();
        S.dragging = m; S.grab = { dx: e.clientX - r.left, dy: e.clientY - r.top }; S.lastOver = null; el.classList.add('lay-drag'); el.style.transition = 'none';
        if (freeOn()) { S.ph = document.createElement('div'); S.ph.className = 'lay-ph'; S.root.appendChild(S.ph); phMove(m.id); }
        try { g.setPointerCapture(e.pointerId); } catch (x) {}
        const mv = ev => follow(ev), up = ev => { if (ev && ev.type === 'pointerup') follow(ev); g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); dragEnd(); };
        g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    }
    // Platzhalter zeigt, wo die Karte beim Loslassen einrastet
    function phMove(id) { const p = S.at && S.at[id]; if (!S.ph || !p) return; const G = geom(), w = S.cur.width[id]; Object.assign(S.ph.style, { left: p[0] * G.cp + 'px', top: p[1] * RU + 'px', width: (w * G.cw + (w - 1) * G.cg) + 'px', height: (rowsOf(id) * RU - GAP) + 'px' }); }
    function followFree(e) {
        const m = S.dragging, el = m.el, G = geom(), rr = S.root.getBoundingClientRect(), px = e.clientX - S.grab.dx - rr.left, py = e.clientY - S.grab.dy - rr.top;
        el.style.left = px + 'px'; el.style.top = py + 'px';
        const x = Math.max(0, Math.min(12 - S.cur.width[m.id], Math.round(px / G.cp))), y = Math.max(0, Math.round(py / RU)), p = S.cur.pos[m.id];
        if (!p || p[0] !== x || p[1] !== y) { S.cur.pos[m.id] = [x, y]; placeFree(m.id); phMove(m.id); }
    }
    function follow(e) {
        const m = S.dragging; if (!m) return; const el = m.el; S.pt = { x: e.clientX, y: e.clientY };
        if (freeOn()) { followFree(e); autoScroll(e); return; }
        el.style.transform = 'none'; const nat = el.getBoundingClientRect();
        el.style.transform = `translate(${e.clientX - S.grab.dx - nat.left}px,${e.clientY - S.grab.dy - nat.top}px) scale(1.02)`;
        let over = null; for (const id of visible()) { if (id === m.id) continue; const r = S.byId[id].el.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { over = id; break; } }
        if (!over) S.lastOver = null;
        else if (over !== S.lastOver) {
            S.lastOver = over; const first = reduced() ? null : rects(), o = S.cur.order, a = o.indexOf(m.id), b = o.indexOf(over); o.splice(a, 1); o.splice(b, 0, m.id);
            S.cur.order.forEach((id, i) => { S.byId[id].el.style.order = i; }); masonry(); labels(); if (first) play(first);
            el.style.transform = 'none'; const n2 = el.getBoundingClientRect(); el.style.transform = `translate(${e.clientX - S.grab.dx - n2.left}px,${e.clientY - S.grab.dy - n2.top}px) scale(1.02)`;
        }
        autoScroll(e);
    }
    function autoScroll(e) {
        const sc = S.scroller || (S.scroller = scrollParent(S.root)), top = sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top, bot = sc === document.scrollingElement ? innerHeight : sc.getBoundingClientRect().bottom;
        if (e.clientY < top + 90) sc.scrollBy(0, -16); else if (e.clientY > bot - 90) sc.scrollBy(0, 16);
    }
    function scrollParent(el) { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if (/(auto|scroll)/.test(o) && n.scrollHeight > n.clientHeight + 1) return n; } return document.scrollingElement || document.documentElement; }
    function dragEnd() {
        const m = S.dragging; if (!m) return; const el = m.el; S.dragging = null; S.scroller = null;
        if (S.ph) { S.ph.remove(); S.ph = null; }
        if (freeOn()) { el.style.transition = 'left .22s cubic-bezier(.2,.8,.2,1), top .22s cubic-bezier(.2,.8,.2,1)'; placeFree(m.id); commitFree(); setTimeout(() => { el.classList.remove('lay-drag'); el.style.transition = ''; }, 240); labels(); return; }
        el.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1)'; el.style.transform = 'none';
        setTimeout(() => { el.classList.remove('lay-drag'); el.style.transition = ''; }, 300); render(false);
    }

    // ---------- Standard für alle (Admin) ----------
    const isAdm = () => { try { return typeof isAdmin === 'function' && typeof currentUser !== 'undefined' && isAdmin(currentUser); } catch (e) { return false; } };
    const stdRef = () => (typeof db !== 'undefined' ? db.collection('layout_defaults').doc(S.key) : null);
    function siteDefault() {
        if (S.stdP) return S.stdP; const r = stdRef();
        S.stdP = r ? r.get().then(d => { S.siteDef = d.exists && d.data().layout ? d.data().layout : null; return S.siteDef; }).catch(() => null) : Promise.resolve(null);
        return S.stdP;
    }
    async function setStd(btn) {
        if (!(await uiConfirm('Dieses Layout als Standard für alle festlegen?\n\nEs gilt für alle, die auf dieser Seite noch kein eigenes Layout gespeichert haben, und für „Zurücksetzen“. Eigene Layouts der anderen bleiben unverändert.'))) return;
        btn.disabled = true;
        try {
            const l = clone(S.cur); await stdRef().set({ layout: l, updatedBy: currentUser.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            S.siteDef = l; S.stdP = Promise.resolve(l); toast('Als Standard für alle gespeichert');
            if (typeof logSystemEvent === 'function') logSystemEvent('admin', 'Standard-Layout festgelegt', { seite: S.key });
        } catch (e) { toast('Speichern fehlgeschlagen: ' + (e.code || e.message), true); } finally { btn.disabled = false; }
    }

    function edit(on) {
        if (on === S.editing) return; S.editing = on;
        const sb = S.bar && S.bar.querySelector('[data-b="std"]'); if (sb) sb.style.display = isAdm() ? '' : 'none';      // nur Admins
        document.body.classList.toggle('lay-on', on); S.root.classList.toggle('lay-editing', on);
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
    async function toggle() { if (!S.editing) return edit(true); if (dirty() && !(await uiConfirm('Änderungen am Layout verwerfen?', { danger: true, ok: 'Verwerfen' }))) return; cancel(); }

    // ---------- Start ----------
    function init(o) {
        if (S && S.bar) S.bar.remove();
        S = { key: o.key, root: o.root, mods: [], byId: {}, presets: o.presets || {}, save: o.save, editing: false, tabs: o.tabs || null, onTabs: o.onTabs, onEdit: o.onEdit, toast: o.toast, tabsAnchor: o.anchor || null, raf: 0 };
        o.modules.forEach(d => { const el = typeof d.el === 'string' ? document.querySelector(d.el) : d.el; if (!el) return; const m = { id: d.id, title: d.title, w: okW(d.w) ? d.w : 12, h: okH(d.h) ? d.h : 0, off: !!d.off, el, span: 0 }; S.mods.push(m); S.byId[m.id] = m; el.dataset.mod = m.id; el.classList.add('lay-item'); });
        S.root.classList.add('lay-grid'); S.ro = new ResizeObserver(schedule); S.mods.forEach(m => S.ro.observe(m.el));
        S.cur = norm(o.prefs || null); S.saved = clone(S.cur); build(); render(false);
        window.addEventListener('resize', () => { if (!!S.wasFree !== freeOn()) render(false); else schedule(); gridVars(); }); requestAnimationFrame(() => S.root.classList.add('lay-ready')); setTimeout(() => S.root.classList.add('lay-ready'), 2500);
    }
    // Gespeichertes Layout nachträglich laden (nach der Anmeldung)
    function load(prefs) {
        if (!S) return;
        const apply = l => { S.cur = norm(l || null); S.saved = clone(S.cur); if (S.editing) S.snap = clone(S.cur); render(false); };
        if (prefs) { apply(prefs); siteDefault(); return; }
        siteDefault().then(d => { if (!S.editing) apply(d); });                     // kein eigenes Layout: Standard vom Admin (sonst eingebauter Standard)
    }

    const tabHidden = id => !!(S && S.cur.tabs && S.cur.tabs.hidden.includes(id));
    const firstTab = () => (S && S.cur.tabs ? S.cur.tabs.order.find(id => !S.cur.tabs.hidden.includes(id)) : null);
    root.Layout = { init, load, toggle, edit, refresh: () => { if (S) { masonry(); schedule(); } }, tabHidden, firstTab, isEditing: () => !!(S && S.editing), current: () => (S ? clone(S.cur) : null), norm: l => (S ? norm(l) : l) };
})(typeof window !== 'undefined' ? window : globalThis);
