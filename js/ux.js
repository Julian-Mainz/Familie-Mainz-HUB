// js/ux.js - kleine Helfer für die Modul-Seiten: hochzählende Zahlen, animierte Ringe, Hinweise.
// Beachtet "Bewegung reduzieren" und unterbricht laufende Animationen sauber.
(function (root) {
    'use strict';
    const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    const ease = t => 1 - Math.pow(1 - t, 3);

    // Text mit mehreren Zahlen (zum Beispiel "118:30" oder "+12:15") von den alten zu den neuen Werten zählen lassen
    function countTo(span, finalText, ms) {
        cancelAnimationFrame(span._raf);
        const re = /\d+/g, nums = finalText.match(re) || [], parts = finalText.split(re), finals = nums.map(Number);
        if (!nums.length || reduced() || document.hidden) { span.textContent = finalText; span._nums = finals; return; }
        const same = span._nums && span._nums.length === finals.length, from = same ? span._nums : finals.map(() => 0), t0 = performance.now(), dur = ms || (same ? 520 : 850);
        const fmt = (n, i) => { const w = nums[i].length; return (nums[i][0] === '0' && w > 1) || /:$/.test(parts[i]) ? String(n).padStart(w, '0') : String(n); };   // Minuten und Sekunden nach einem Doppelpunkt bleiben zweistellig
        const step = now => {
            const k = Math.min(1, (now - t0) / dur), e = ease(k);
            let out = parts[0]; finals.forEach((f, i) => { out += fmt(Math.round(from[i] + (f - from[i]) * e), i) + parts[i + 1]; });
            span.textContent = out; if (k < 1) span._raf = requestAnimationFrame(step); else { span.textContent = finalText; span._nums = finals; }
        };
        span._nums = finals; span._raf = requestAnimationFrame(step);
    }
    // Kennzahl setzen: "118:30 Std" wird zu <span class="n">118:30</span><small>Std</small>; nur bei Änderung wird animiert
    function setNum(el, text, tone) {
        text = String(text ?? ''); const i = text.lastIndexOf(' '), unit = i > 0 && !/\d/.test(text.slice(i + 1)) ? text.slice(i + 1) : '', num = unit ? text.slice(0, i) : text;
        if (!el._n) { el.innerHTML = '<span class="n"></span><small></small>'; el._n = el.firstChild; el._u = el.lastChild; }
        el._u.textContent = unit; el._u.style.display = unit ? '' : 'none';
        if (el._n.dataset.v !== num) { el._n.dataset.v = num; countTo(el._n, num); }
        if (tone !== undefined) el.className = (el.className.replace(/\b(pos|neg|warn)\b/g, '').trim() + ' ' + (tone || '')).trim();
    }
    // Ring zeichnen: frac 0..1, bei der ersten Anzeige wächst er von 0 an. offset = Startanteil (für einen zweiten Bogen)
    function ring(circle, frac, offset) {
        if (!circle) return; const r = +circle.getAttribute('r'), C = 2 * Math.PI * r;
        circle._t = { f: Math.max(0, Math.min(1, isFinite(frac) ? frac : 0)), o: Math.max(0, Math.min(1, offset || 0)) };      // immer der neueste Zielwert
        const apply = () => { const t = circle._t; circle.style.strokeDasharray = (t.f * C).toFixed(1) + ' ' + (C - t.f * C + 1).toFixed(1); circle.style.strokeDashoffset = (-t.o * C).toFixed(1); };
        if (!circle._shown && !reduced()) { circle._shown = true; circle.style.strokeDasharray = '0 ' + C.toFixed(1); circle.style.strokeDashoffset = (-circle._t.o * C).toFixed(1); requestAnimationFrame(() => requestAnimationFrame(apply)); }
        else { circle._shown = true; apply(); }
    }
    function toast(msg, bad) {
        document.querySelectorAll('.ux-toast').forEach(t => t.remove());
        const t = document.createElement('div'); t.className = 'ux-toast'; if (bad) { t.style.background = '#4c0519'; t.style.borderColor = 'rgba(244,63,94,.5)'; t.style.color = '#fecdd3'; }
        t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
    }
    // ISO-Kalenderwoche
    function kw(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); }

    root.UX = { countTo, setNum, ring, toast, kw };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.UX;
})(typeof window !== 'undefined' ? window : globalThis);
