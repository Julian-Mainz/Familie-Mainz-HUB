// js/space.js - Weltall-Hintergrund für das dunkle Design: Sterne und Nebel einmal auf ein Canvas gezeichnet,
// ein paar funkelnde Sterne, gelegentlich eine Sternschnuppe und eine Planeten-Szene unten in der Seitenleiste.
// Abschaltbar in den Einstellungen (pro Gerät gespeichert). Wird im <head> geladen, damit nichts aufblitzt.
(function () {
    const root = document.documentElement;
    const want = () => { try { return localStorage.getItem('bg') !== 'plain'; } catch (e) { return true; } };
    root.classList.toggle('space', want());
    let wrap, cv, seed = 7, built = false, shootT = 0;
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

    // Sternschnuppe alle 15-35 s, nur wenn der Tab sichtbar ist
    function shoot() {
        const b = wrap.querySelector('b');
        if (root.classList.contains('space') && !root.classList.contains('hell') && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const x = innerWidth * (.35 + Math.random() * .6), y = innerHeight * Math.random() * .4, len = 260 + Math.random() * 200, r = 150 + Math.random() * 20;
            const dx = Math.cos(r * Math.PI / 180) * len, dy = Math.sin(r * Math.PI / 180) * len;
            b.style.setProperty('--x0', x + 'px'); b.style.setProperty('--y0', y + 'px'); b.style.setProperty('--x1', (x + dx) + 'px'); b.style.setProperty('--y1', (y + dy) + 'px'); b.style.setProperty('--r', r + 'deg');
            b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
        }
        shootT = setTimeout(shoot, 15000 + Math.random() * 20000);
    }

    // Planeten-Szene: Planet mit Atmosphäre, Horizont-Glühen, Bergketten
    const SCENE = `<svg viewBox="0 0 280 340" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>
        <linearGradient id="spSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1022" stop-opacity="0"/><stop offset=".45" stop-color="#1e1b4b" stop-opacity=".35"/><stop offset=".72" stop-color="#6d28d9" stop-opacity=".32"/><stop offset=".88" stop-color="#db2777" stop-opacity=".32"/><stop offset="1" stop-color="#fb923c" stop-opacity=".3"/></linearGradient>
        <radialGradient id="spPl" cx=".3" cy=".22" r=".9"><stop offset="0" stop-color="#3048a8"/><stop offset=".45" stop-color="#1c2a72"/><stop offset="1" stop-color="#0a1033"/></radialGradient>
        <linearGradient id="spRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a5f3fc"/><stop offset=".45" stop-color="#818cf8"/><stop offset="1" stop-color="#c084fc" stop-opacity="0"/></linearGradient>
        <radialGradient id="spHalo" cx=".5" cy=".5" r=".5"><stop offset=".8" stop-color="#38bdf8" stop-opacity="0"/><stop offset=".9" stop-color="#60a5fa" stop-opacity=".28"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></radialGradient>
        <linearGradient id="spM0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c3a8c" stop-opacity=".8"/><stop offset="1" stop-color="#2a2160" stop-opacity=".8"/></linearGradient>
        <linearGradient id="spM1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2560"/><stop offset="1" stop-color="#15123a"/></linearGradient>
        <linearGradient id="spM2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141332"/><stop offset="1" stop-color="#07081a"/></linearGradient>
        <linearGradient id="spGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f472b6" stop-opacity="0"/><stop offset="1" stop-color="#fb923c" stop-opacity=".45"/></linearGradient></defs>
        <rect width="280" height="340" fill="url(#spSky)"/><circle cx="126" cy="83" r="0.6" fill="#fff" fill-opacity="0.9"/><circle cx="251" cy="45" r="0.6" fill="#fff" fill-opacity="0.35"/><circle cx="16" cy="108" r="0.8" fill="#fff" fill-opacity="0.35"/><circle cx="119" cy="139" r="0.8" fill="#fff" fill-opacity="0.7"/><circle cx="94" cy="33" r="0.8" fill="#fff" fill-opacity="0.5"/><circle cx="19" cy="72" r="0.8" fill="#fff" fill-opacity="0.5"/><circle cx="90" cy="85" r="0.8" fill="#fff" fill-opacity="0.7"/><circle cx="50" cy="92" r="1.1" fill="#fff" fill-opacity="0.5"/><circle cx="97" cy="69" r="1.1" fill="#fff" fill-opacity="0.7"/><circle cx="51" cy="146" r="0.8" fill="#fff" fill-opacity="0.35"/><circle cx="155" cy="85" r="0.6" fill="#fff" fill-opacity="0.9"/><circle cx="222" cy="79" r="1.1" fill="#fff" fill-opacity="0.9"/><circle cx="88" cy="65" r="0.8" fill="#fff" fill-opacity="0.7"/><circle cx="28" cy="26" r="0.6" fill="#fff" fill-opacity="0.9"/><circle cx="149" cy="138" r="1.1" fill="#fff" fill-opacity="0.7"/><circle cx="80" cy="56" r="0.6" fill="#fff" fill-opacity="0.9"/><circle cx="109" cy="118" r="0.8" fill="#fff" fill-opacity="0.5"/><circle cx="188" cy="117" r="0.8" fill="#fff" fill-opacity="0.5"/><g transform="translate(0,-78)">
        <circle cx="300" cy="300" r="250" fill="url(#spHalo)"/>
        <circle cx="300" cy="300" r="222" fill="url(#spPl)"/>
        <path d="M86 230c18-70 80-130 160-150" stroke="url(#spRim)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M96 224c20-60 76-114 148-134" stroke="#a5f3fc" stroke-opacity=".25" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M150 170c40-20 90-26 130-20M130 205c50-24 110-30 150-24" stroke="#93c5fd" stroke-opacity=".12" stroke-width="9" fill="none" stroke-linecap="round"/>
        <rect y="220" width="280" height="80" fill="url(#spGlow)"/>
        <path d="M0 252l18-14 16 8 22-26 14 10 20-18 24 22 16-6 22 18 18-12 24 14 20-20 28 22 18-8 20 14v76H0z" fill="url(#spM0)"/>
        <rect y="232" width="280" height="60" fill="#c084fc" fill-opacity=".07"/><path d="M0 278l24-20 14 8 26-30 18 18 14-8 28 26 20-14 22 16 24-22 30 26 18-10 42 20v140H0z" fill="url(#spM1)"/>
        <path d="M64 258l-8 10 12-4zM150 264l-6 9 10-3zM214 266l-7 8 11-3z" fill="#c4b5fd" fill-opacity=".35"/>
        <path d="M0 304l34-18 22 10 30-22 24 18 26-10 30 20 28-14 32 16 26-10 28 14v120H0z" fill="url(#spM2)"/></g><rect y="300" width="280" height="40" fill="#07081a"/></svg>`;

    function addScene() {
        const sb = document.getElementById('sb'); if (!sb || sb.querySelector('.sb-scene')) return;
        const d = document.createElement('div'); d.className = 'sb-scene'; d.innerHTML = SCENE; sb.prepend(d);
    }

    function build() {
        if (built || !document.body) return; built = true;
        wrap = document.createElement('div'); wrap.id = 'space-bg'; wrap.setAttribute('aria-hidden', 'true'); cv = document.createElement('canvas'); wrap.appendChild(cv);
        wrap.insertAdjacentHTML('beforeend', twinkles()); document.body.prepend(wrap);
        paint(); let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(paint, 200); });
        shootT = setTimeout(shoot, 4000);
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
