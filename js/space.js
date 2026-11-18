// js/space.js - Weltall-Hintergrund für das dunkle Design: festes Bild (assets/img/space-bg.webp),
// dazu ein paar funkelnde Sterne und gelegentlich eine Sternschnuppe.
// Abschaltbar in den Einstellungen (pro Gerät gespeichert). Wird im <head> geladen, damit nichts aufblitzt.
(function () {
    const root = document.documentElement;
    const want = () => { try { return localStorage.getItem('bg') !== 'plain'; } catch (e) { return true; } };
    root.classList.toggle('space', want());
    let wrap, built = false, seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };     // fester Zufall: Sterne immer an derselben Stelle

    function twinkles() {
        let h = ''; for (let i = 0; i < 12; i++) h += `<i style="left:${(30 + rnd() * 68).toFixed(2)}%;top:${(rnd() * 70).toFixed(2)}%;--d:${(3 + rnd() * 4).toFixed(1)}s;--w:${(-rnd() * 6).toFixed(1)}s"></i>`;
        return h + '<b></b>';
    }

    // Sternschnuppe alle 15-35 s, nur wenn aktiv und der Tab sichtbar ist
    function shoot() {
        const b = wrap.querySelector('b');
        if (root.classList.contains('space') && !root.classList.contains('hell') && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const x = innerWidth * (.4 + Math.random() * .55), y = innerHeight * Math.random() * .35, len = 260 + Math.random() * 200, r = 150 + Math.random() * 20;
            const dx = Math.cos(r * Math.PI / 180) * len, dy = Math.sin(r * Math.PI / 180) * len;
            b.style.setProperty('--x0', x + 'px'); b.style.setProperty('--y0', y + 'px'); b.style.setProperty('--x1', (x + dx) + 'px'); b.style.setProperty('--y1', (y + dy) + 'px'); b.style.setProperty('--r', r + 'deg');
            b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
        }
        setTimeout(shoot, 15000 + Math.random() * 20000);
    }

    function build() {
        if (built || !document.body) return; built = true;
        wrap = document.createElement('div'); wrap.id = 'space-bg'; wrap.setAttribute('aria-hidden', 'true');
        wrap.innerHTML = twinkles(); document.body.prepend(wrap);
        setTimeout(shoot, 4000);
    }
    // Schalter in den Einstellungen
    window.Space = {
        on: () => root.classList.contains('space'),
        set(v) { try { localStorage.setItem('bg', v ? 'space' : 'plain'); } catch (e) {} root.classList.toggle('space', !!v); if (v) build(); }
    };
    function init() { if (want()) build(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
