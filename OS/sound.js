// OS/sound.js – Systemklänge für J.Mainz OS. Alle Töne werden im Browser erzeugt (keine Audiodateien).
// Start, Sperren/Entsperren, Mitteilung, Hinweis, Papierkorb, Bildschirmfoto. Ein/aus und Lautstärke unter Einstellungen → System → Ton.
(function () {
    'use strict';
    let API, S, ctx = null, master = null;
    const cfg = () => (S.sound = Object.assign({ on: true, vol: 45 }, S.sound || {}));
    function ac() {
        if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); master = ctx.createGain(); master.connect(ctx.destination); }
        master.gain.value = Math.max(0, Math.min(1, cfg().vol / 100)) * .55;
        return ctx;
    }
    // Ton: Frequenz, Start (s), Länge (s), Wellenform, Lautstärke
    function tone(c, f, t0, d, type = 'sine', g = .5, f2) {
        const o = c.createOscillator(), v = c.createGain(), t = c.currentTime + t0;
        o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
        v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + .012); v.gain.exponentialRampToValueAtTime(.0008, t + d);
        o.connect(v); v.connect(master); o.start(t); o.stop(t + d + .05);
    }
    function noise(c, t0, d, g = .3, freq = 1800, q = .8) {
        const n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const s = c.createBufferSource(), fl = c.createBiquadFilter(), v = c.createGain(), t = c.currentTime + t0; s.buffer = b; fl.type = 'bandpass'; fl.frequency.value = freq; fl.Q.value = q;
        v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(fl); fl.connect(v); v.connect(master); s.start(t);
    }
    const SOUNDS = {
        start: c => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, i * .09, 1.4 - i * .15, 'sine', .32)); tone(c, 261.63, 0, 1.6, 'triangle', .12); },
        unlock: c => { tone(c, 659.25, 0, .25, 'sine', .35); tone(c, 987.77, .09, .4, 'sine', .3); },
        lock: c => { tone(c, 783.99, 0, .22, 'sine', .3); tone(c, 523.25, .09, .38, 'sine', .3); },
        notify: c => { tone(c, 1318.5, 0, .28, 'triangle', .28); tone(c, 987.77, .1, .45, 'triangle', .24); },
        alert: c => { tone(c, 440, 0, .55, 'sine', .32); tone(c, 659.25, 0, .55, 'sine', .14); },
        trash: c => { noise(c, 0, .22, .35, 900, .6); noise(c, .1, .2, .25, 1500, .9); },
        shot: c => { noise(c, 0, .05, .5, 3000, .5); noise(c, .07, .09, .35, 1200, .7); },
        error: c => { tone(c, 220, 0, .3, 'square', .08); tone(c, 196, .12, .35, 'square', .08); },
        done: c => { tone(c, 880, 0, .18, 'sine', .3); tone(c, 1174.7, .08, .35, 'sine', .28); },
    };
    let lastAt = {};
    function play(name) {
        if (!S || !cfg().on || !SOUNDS[name]) return;
        if (document.documentElement.classList.contains('nosound')) return;
        const now = Date.now(); if (lastAt[name] && now - lastAt[name] < 400) return; lastAt[name] = now;          // nicht doppelt
        const c = ac(); if (!c) return;
        const go = () => { try { SOUNDS[name](c); } catch (x) {} };
        if (c.state === 'suspended') c.resume().then(go).catch(() => {}); else go();
    }
    window.JMOS_SOUND = { play };

    function settings(body) {
        const box = body.querySelector('.app-set'); if (!box || box.querySelector('.snd-on')) return;
        const sec = document.createElement('section'); const c0 = cfg();
        sec.innerHTML = `<label class="set-row"><div><b>Systemklänge</b><small>Kurze Töne beim Start, Sperren und Entsperren, bei Mitteilungen, Hinweisen, im Papierkorb und beim Bildschirmfoto.</small></div><input type="checkbox" class="tgl snd-on" ${c0.on ? 'checked' : ''}></label>
            <div class="set-row"><div><b>Lautstärke der Klänge</b><small>Gilt nur für die Systemklänge, nicht für Musik.</small></div><div style="display:flex;gap:10px;align-items:center"><input type="range" class="snd-vol" min="5" max="100" step="5" value="${c0.vol}" style="width:150px;accent-color:var(--acc)"><button type="button" class="btn snd-test"><i class="fa-solid fa-volume-high"></i>Probe</button></div></div>`;
        box.appendChild(sec);
        sec.querySelector('.snd-on').addEventListener('change', ev => { cfg().on = ev.target.checked; API.save(); if (ev.target.checked) play('done'); });
        sec.querySelector('.snd-vol').addEventListener('change', ev => { cfg().vol = +ev.target.value; API.save(); play('notify'); });
        sec.querySelector('.snd-test').addEventListener('click', () => { const was = cfg().on; cfg().on = true; play('start'); cfg().on = was; });
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        init(api) {
            API = api; S = api.state();
            const base = window.JMOS_NATIVE_UI.set; window.JMOS_NATIVE_UI.set = (b, w) => { base(b, w); settings(b); };
            // Hinweisfenster (uiAlert) mit Ton
            if (typeof window.uiAlert === 'function' && !window.uiAlert.__snd) { const orig = window.uiAlert; window.uiAlert = function (...a) { play(/fehlgeschlagen|nicht möglich|Fehler|nicht lesbar|fehlerhaft/i.test(String(a[0])) ? 'error' : 'alert'); return orig.apply(this, a); }; window.uiAlert.__snd = true; }
            // Startton beim ersten Klick oder Tastendruck (Browser erlauben Töne erst nach einer Eingabe)
            let started = false; const first = () => { if (started) return; started = true; removeEventListener('pointerdown', first, true); removeEventListener('keydown', first, true); if (!document.getElementById('lock')) play('start'); };
            addEventListener('pointerdown', first, true); addEventListener('keydown', first, true);
        },
    });
})();
