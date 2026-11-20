// js/space.js - Weltall-Hintergrund. Helles Design: Pastellbild (assets/img/space-bg-hell.webp) + menu-planet-hell.webp, Rest per CSS.
// Dunkles Design: Sterne und Nebel werden einmal auf ein Canvas gezeichnet
// (scharf auf jedem Bildschirm, kein Download), dazu funkelnde Sterne, gelegentlich eine Sternschnuppe
// und unten in der Seitenleiste das Planetenbild (assets/img/menu-planet.webp).
// Abschaltbar in den Einstellungen (pro Gerät gespeichert). Wird im <head> geladen, damit nichts aufblitzt.
(function () {
    const root = document.documentElement;
    const want = () => { try { return localStorage.getItem('bg') !== 'plain'; } catch (e) { return true; } };
    root.classList.toggle('space', want());
    let wrap, cv, built = false, seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };     // fester Zufall: jedes Mal derselbe Himmel

    function paint() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
        cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr); seed = 7;
        // Grund: tiefes Blau
        const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#070b18'); bg.addColorStop(1, '#05070f'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
        // Nebel
        g.globalCompositeOperation = 'lighter';
        [[.82, .06, .55, '124,58,237', .2], [.92, .22, .38, '236,72,153', .11], [.7, .0, .25, '251,146,60', .05], [.62, .02, .35, '56,189,248', .08], [.18, .95, .5, '14,165,233', .07], [.45, .6, .45, '99,102,241', .05]].forEach(([x, y, r, c, a]) => {
            const R = Math.max(W, H) * r, gr = g.createRadialGradient(W * x, H * y, 0, W * x, H * y, R);
            gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(.5, `rgba(${c},${a * .4})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        });
        // feines Sternenband (Milchstraße), schräg
        g.save(); g.translate(W * .55, H * .2); g.rotate(-.35);
        for (let i = 0; i < W * 1.1; i++) { const x = (rnd() - .5) * W * 1.6, y = (rnd() + rnd() + rnd() - 1.5) * 60; g.fillStyle = `rgba(200,210,255,${rnd() * .35})`; g.fillRect(x, y, .8, .8); }
        g.restore();
        // Sterne
        const n = Math.round(W * H / 1900);
        for (let i = 0; i < n; i++) {
            const x = rnd() * W, y = rnd() * H, s = rnd(), r = s > .985 ? 1.5 : s > .9 ? 1 : .6, a = .25 + rnd() * .65, hue = rnd();
            g.fillStyle = hue > .9 ? `rgba(191,219,254,${a})` : hue > .82 ? `rgba(253,230,138,${a})` : `rgba(255,255,255,${a})`;
            g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
            if (r > 1.2) { const gl = g.createRadialGradient(x, y, 0, x, y, 6); gl.addColorStop(0, `rgba(191,219,254,${a * .5})`); gl.addColorStop(1, 'rgba(191,219,254,0)'); g.fillStyle = gl; g.fillRect(x - 6, y - 6, 12, 12); }
        }
        g.globalCompositeOperation = 'source-over';
    }

    function twinkles() {
        let h = ''; for (let i = 0; i < 14; i++) h += `<i style="left:${(rnd() * 100).toFixed(2)}%;top:${(rnd() * 100).toFixed(2)}%;--d:${(3 + rnd() * 4).toFixed(1)}s;--w:${(-rnd() * 6).toFixed(1)}s"></i>`;
        return h + '<b></b>';
    }

    // Sternschnuppe alle 15-35 s, nur wenn aktiv und der Tab sichtbar ist
    function shoot() {
        const b = wrap.querySelector('b');
        if (root.classList.contains('space') && !root.classList.contains('hell') && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const x = innerWidth * (.35 + Math.random() * .6), y = innerHeight * Math.random() * .4, len = 260 + Math.random() * 200, r = 150 + Math.random() * 20;
            const dx = Math.cos(r * Math.PI / 180) * len, dy = Math.sin(r * Math.PI / 180) * len;
            b.style.setProperty('--x0', x + 'px'); b.style.setProperty('--y0', y + 'px'); b.style.setProperty('--x1', (x + dx) + 'px'); b.style.setProperty('--y1', (y + dy) + 'px'); b.style.setProperty('--r', r + 'deg');
            b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
        }
        setTimeout(shoot, 15000 + Math.random() * 20000);
    }

    // Planetenbild unten in der Seitenleiste
    function addScene() {
        const sb = document.getElementById('sb'); if (!sb || sb.querySelector('.sb-scene')) return;
        const d = document.createElement('div'); d.className = 'sb-scene'; d.setAttribute('aria-hidden', 'true'); sb.prepend(d);
    }

    function build() {
        if (built || !document.body) return; built = true;
        wrap = document.createElement('div'); wrap.id = 'space-bg'; wrap.setAttribute('aria-hidden', 'true'); cv = document.createElement('canvas'); wrap.appendChild(cv);
        wrap.insertAdjacentHTML('beforeend', twinkles()); document.body.prepend(wrap);
        paint(); let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(paint, 200); });
        setTimeout(shoot, 4000);
        addScene(); new MutationObserver(addScene).observe(document.body, { childList: true });       // Seitenleiste wird nachgeladen
    }
    // Schalter in den Einstellungen
    window.Space = {
        on: () => root.classList.contains('space'),
        set(v) { try { localStorage.setItem('bg', v ? 'space' : 'plain'); } catch (e) {} root.classList.toggle('space', !!v); if (v) build(); }
    };
    function init() { if (want()) build(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
