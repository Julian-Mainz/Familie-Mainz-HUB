/* J.Mainz OS – Paket C: lebendiger Hintergrund (Sternschnuppen, Tageszeit, Wetter), Start- und Abmelde-Animation,
   Bildschirmschoner, Desktop-Haustier (Astronaut) und „Als App installieren“. */
(function () {
    'use strict';
    let API, U, S, e;
    const $ = id => document.getElementById(id);
    const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const L = () => (S.live = S.live && typeof S.live === 'object' ? S.live : {});
    const on = k => L()[k] !== false;              // alles standardmäßig an

    // ================= Lebendiger Hintergrund =================
    let fx, fcx, raf = 0, shoot = [], drops = [], wxKind = '', flash = 0, nextShoot = 0, lastT = 0;
    function sizeFx() { const d = Math.min(2, devicePixelRatio || 1); fx.width = innerWidth * d; fx.height = innerHeight * d; fcx.setTransform(d, 0, 0, d, 0, 0); makeDrops(); }
    function makeDrops() {
        const n = wxKind === 'rain' || wxKind === 'storm' ? Math.round(innerWidth / 9) : wxKind === 'snow' ? Math.round(innerWidth / 14) : 0;
        drops = Array.from({ length: n }, () => newDrop(true));
    }
    function newDrop(any) {
        const snow = wxKind === 'snow';
        return { x: Math.random() * innerWidth, y: any ? Math.random() * innerHeight : -20, v: snow ? .4 + Math.random() * .8 : 9 + Math.random() * 7, r: snow ? 1 + Math.random() * 2.4 : 10 + Math.random() * 14, w: Math.random() * 6.3 };
    }
    function spawnShoot() {
        const fromLeft = Math.random() < .5, a = (fromLeft ? 1 : -1) * (.35 + Math.random() * .35);
        shoot.push({ x: fromLeft ? Math.random() * innerWidth * .6 : innerWidth * (.4 + Math.random() * .6), y: Math.random() * innerHeight * .45, vx: Math.sin(a) * 14 * (fromLeft ? 1 : 1), vy: Math.cos(Math.abs(a)) * 6, life: 0, max: 50 + Math.random() * 30 });
    }
    function frame(t) {
        const dt = Math.min(3, (t - lastT) / 16.7 || 1); lastT = t;
        fcx.clearRect(0, 0, innerWidth, innerHeight);
        // Sternschnuppen
        if (on('shoot') && t > nextShoot) { spawnShoot(); if (Math.random() < .15) setTimeout(spawnShoot, 300); nextShoot = t + 5000 + Math.random() * 12000; }
        shoot = shoot.filter(s => s.life < s.max);
        for (const s of shoot) {
            s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
            const k = 1 - s.life / s.max, len = 14;
            const g = fcx.createLinearGradient(s.x, s.y, s.x - s.vx * len, s.y - s.vy * len);
            g.addColorStop(0, `rgba(255,255,255,${.95 * k})`); g.addColorStop(.3, `rgba(199,210,254,${.5 * k})`); g.addColorStop(1, 'rgba(199,210,254,0)');
            fcx.strokeStyle = g; fcx.lineWidth = 2; fcx.lineCap = 'round'; fcx.beginPath(); fcx.moveTo(s.x, s.y); fcx.lineTo(s.x - s.vx * len, s.y - s.vy * len); fcx.stroke();
            fcx.fillStyle = `rgba(255,255,255,${k})`; fcx.beginPath(); fcx.arc(s.x, s.y, 1.6, 0, 6.283); fcx.fill();
        }
        // Wetter
        if (on('wx') && drops.length) {
            if (wxKind === 'snow') {
                fcx.fillStyle = 'rgba(255,255,255,.8)';
                for (const d of drops) { d.y += d.v * dt; d.w += .02 * dt; d.x += Math.sin(d.w) * .5 * dt; if (d.y > innerHeight + 5) Object.assign(d, newDrop(false)); fcx.globalAlpha = .35 + d.r / 5; fcx.beginPath(); fcx.arc(d.x, d.y, d.r, 0, 6.283); fcx.fill(); }
                fcx.globalAlpha = 1;
            } else {
                fcx.strokeStyle = 'rgba(165,180,252,.35)'; fcx.lineWidth = 1; fcx.beginPath();
                for (const d of drops) { d.y += d.v * dt; d.x -= d.v * .18 * dt; if (d.y > innerHeight) Object.assign(d, newDrop(false), { x: Math.random() * innerWidth * 1.2 }); fcx.moveTo(d.x, d.y); fcx.lineTo(d.x + d.r * .18, d.y - d.r); }
                fcx.stroke();
            }
            if (wxKind === 'storm') { if (flash <= 0 && Math.random() < .0015 * dt) flash = 1; if (flash > 0) { fcx.fillStyle = `rgba(224,231,255,${flash * .35})`; fcx.fillRect(0, 0, innerWidth, innerHeight); flash -= .06 * dt; } }
        }
        raf = requestAnimationFrame(frame);
    }
    function runFx() {
        cancelAnimationFrame(raf); raf = 0; fcx.clearRect(0, 0, innerWidth, innerHeight);
        const need = (on('shoot') || (on('wx') && drops.length)) && !calm() && !document.hidden && !document.documentElement.classList.contains('locked') && !saverEl;
        if (need) { lastT = performance.now(); raf = requestAnimationFrame(frame); }
    }
    // Tageszeit: sanfte Färbung des Himmels
    function tod() {
        const el = $('tod'); if (!el) return;
        const h = new Date().getHours() + new Date().getMinutes() / 60;
        const k = !on('tod') ? '' : h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'dusk' : 'night';
        el.dataset.k = k; document.documentElement.dataset.tod = k;
    }
    // Wetter von Open-Meteo (gleicher Ort wie das Wetter-Widget)
    async function weather() {
        if (!on('wx')) { setWx(''); return; }
        const DEF = { lat: 50.8021, lon: 6.4836 }, l0 = (U.userPrefs && U.userPrefs.home || {}).weather, l = l0 && isFinite(l0.lat) && isFinite(l0.lon) ? l0 : DEF;
        try {
            const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${l.lat}&longitude=${l.lon}&current=weather_code&timezone=auto`)).json();
            const c = j.current.weather_code;
            setWx(c >= 95 ? 'storm' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c === 45 || c === 48 ? 'fog' : '');
        } catch (x) { /* ohne Wetter weiter */ }
    }
    function setWx(k) { wxKind = k; document.documentElement.dataset.wx = on('wx') ? k : ''; makeDrops(); runFx(); }
    function wireLive() {
        const wall = $('wall');
        fx = document.createElement('canvas'); fx.id = 'fx'; wall.appendChild(fx); fcx = fx.getContext('2d');
        const t = document.createElement('div'); t.id = 'tod'; wall.appendChild(t);
        sizeFx(); tod(); runFx(); weather();
        addEventListener('resize', () => { sizeFx(); });
        document.addEventListener('visibilitychange', runFx);
        new MutationObserver(runFx).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        setInterval(tod, 5 * 60000); setInterval(weather, 30 * 60000);
        window.JMOS_LIVE = { setWx, spawnShoot: () => { spawnShoot(); runFx(); }, tod };
    }

    // ================= Start- und Abmelde-Animation =================
    function enter() {
        if (calm()) return;
        document.querySelectorAll('#icons .ico').forEach((x, i) => x.style.setProperty('--i', Math.min(i, 30)));
        document.documentElement.classList.add('os-enter');
        setTimeout(() => document.documentElement.classList.remove('os-enter'), 1600);
    }
    function wireBye() {
        const orig = window.handleLogout; if (typeof orig !== 'function') return;
        let busy = false;
        window.handleLogout = function () {
            if (busy) return; busy = true; API.closePops();
            const name = U.firstName || (U.email || '').split('@')[0];
            const el = document.createElement('div'); el.id = 'bye'; el.setAttribute('role', 'status');
            el.innerHTML = `<div class="boot-logo"><span></span><span></span><span></span><span></span></div><b>Auf Wiedersehen, ${e(name)}</b><small>Wird abgemeldet …</small>`;
            document.body.appendChild(el); document.documentElement.classList.add('os-bye');
            setTimeout(() => orig.apply(this, arguments), calm() ? 200 : 1300);
        };
    }

    // ================= Bildschirmschoner =================
    let saverEl = null, idleAt = Date.now(), saverRaf = 0;
    const SAVER_KEY = 'saverMin';
    const saverMin = () => (S[SAVER_KEY] === undefined ? 10 : +S[SAVER_KEY]);
    function saverOn() {
        if (saverEl || document.documentElement.classList.contains('locked')) return;
        API.closePops();
        saverEl = document.createElement('div'); saverEl.id = 'saver'; saverEl.setAttribute('aria-hidden', 'true');
        saverEl.innerHTML = '<canvas></canvas><div class="sv-c"><b></b><span></span><small>J.Mainz <i>OS</i></small></div>';
        document.body.appendChild(saverEl); runFx();
        const cv = saverEl.querySelector('canvas'), cx = cv.getContext('2d'), d = Math.min(2, devicePixelRatio || 1);
        cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0);
        const W = innerWidth, H = innerHeight, st = Array.from({ length: 420 }, () => ({ x: (Math.random() - .5) * W, y: (Math.random() - .5) * H, z: Math.random() * W }));
        const draw = () => {
            cx.fillStyle = 'rgba(3,5,12,.35)'; cx.fillRect(0, 0, W, H);
            for (const s of st) {
                const pz = s.z; s.z -= calm() ? 0 : 5; if (s.z < 1) { s.x = (Math.random() - .5) * W; s.y = (Math.random() - .5) * H; s.z = W; continue; }
                const k = 260 / s.z, x = W / 2 + s.x * k, y = H / 2 + s.y * k, k0 = 260 / pz, x0 = W / 2 + s.x * k0, y0 = H / 2 + s.y * k0;
                const a = Math.min(1, (1 - s.z / W) * 1.4); cx.strokeStyle = `rgba(${200 + 55 * a | 0},${210 + 45 * a | 0},255,${a})`; cx.lineWidth = Math.max(.5, 2.2 * (1 - s.z / W));
                cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x, y); cx.stroke();
            }
            saverRaf = requestAnimationFrame(draw);
        };
        cx.fillStyle = '#03050c'; cx.fillRect(0, 0, W, H); draw();
        const c = saverEl.querySelector('.sv-c');
        const tick = () => { if (!saverEl) return; const n = new Date(); c.querySelector('b').textContent = n.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); c.querySelector('span').textContent = n.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }); };
        const move = () => { if (!saverEl) return; c.style.left = (10 + Math.random() * 60) + '%'; c.style.top = (12 + Math.random() * 56) + '%'; };
        tick(); move(); saverEl._t = setInterval(tick, 1000); saverEl._m = setInterval(move, 12000);
        requestAnimationFrame(() => saverEl && saverEl.classList.add('on'));
        saverEl._start = Date.now();
    }
    function saverOff() {
        if (!saverEl) return; const el = saverEl; saverEl = null;
        cancelAnimationFrame(saverRaf); clearInterval(el._t); clearInterval(el._m);
        el.classList.remove('on'); setTimeout(() => el.remove(), 400); runFx();
    }
    function wireSaver() {
        let px = -1, py = -1;
        const wake = ev => {
            if (ev.type === 'pointermove') { if (Math.abs(ev.screenX - px) + Math.abs(ev.screenY - py) < 6) return; px = ev.screenX; py = ev.screenY; }
            idleAt = Date.now();
            if (saverEl && Date.now() - saverEl._start > 600) { saverOff(); if (ev.type !== 'pointermove' && ev.cancelable) { ev.preventDefault(); ev.stopPropagation(); } }
        };
        ['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(t => document.addEventListener(t, wake, { capture: true, passive: t === 'pointermove' || t === 'wheel' }));
        (window.JMOS_EMBED_HOOKS = window.JMOS_EMBED_HOOKS || []).push(doc => ['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(t => doc.addEventListener(t, wake, { capture: true, passive: true })));
        setInterval(() => { const m = saverMin(); if (m > 0 && !saverEl && !document.hidden && Date.now() - idleAt > m * 60000) saverOn(); }, 5000);
        window.JMOS_SAVER = { on: saverOn, off: saverOff };
    }

    // ================= Desktop-Haustier: der kleine Astronaut =================
    const PET_SVG = `<svg viewBox="0 0 64 72" aria-hidden="true">
        <defs><linearGradient id="pv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#818cf8"/><stop offset=".55" stop-color="#312e81"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
        <g class="pt-flame"><path d="M22 60 q2 10 5 0z M37 60 q2 10 5 0z" fill="#fb923c"/><path d="M23.5 60 q1 5 2.5 0z M38.5 60 q1 5 2.5 0z" fill="#fde68a"/></g>
        <rect x="14" y="30" width="36" height="30" rx="12" fill="#cbd5e1"/>
        <rect x="18" y="32" width="28" height="27" rx="10" fill="#f8fafc"/>
        <rect x="26" y="40" width="12" height="8" rx="2" fill="#a5b4fc"/><circle cx="29" cy="44" r="1.3" fill="#f43f5e"/><circle cx="33" cy="44" r="1.3" fill="#22c55e"/>
        <g class="pt-arm"><rect x="6" y="36" width="12" height="8" rx="4" fill="#f8fafc"/></g><rect x="46" y="36" width="12" height="8" rx="4" fill="#f8fafc"/>
        <circle cx="32" cy="22" r="18" fill="#f8fafc"/><circle cx="32" cy="22" r="18" fill="none" stroke="#cbd5e1" stroke-width="2"/>
        <rect x="18" y="13" width="28" height="19" rx="9.5" fill="url(#pv)"/><path d="M23 18 q4 -4 9 -3" stroke="#fff" stroke-opacity=".7" stroke-width="2" fill="none" stroke-linecap="round"/>
        <g class="pt-eyes"><circle cx="27" cy="23" r="2" fill="#e0e7ff"/><circle cx="37" cy="23" r="2" fill="#e0e7ff"/></g>
        <line x1="32" y1="4" x2="32" y2="0" stroke="#cbd5e1" stroke-width="2"/><circle cx="32" cy="0" r="2.4" fill="#f472b6"/></svg>`;
    const FACTS = ['Ein Tag auf der Venus dauert länger als ein Jahr dort.', 'Auf dem Mond wiegst du nur ein Sechstel.', 'Das Licht der Sonne braucht gut 8 Minuten bis zur Erde.', 'Im Weltall ist es völlig still.', 'Saturn würde in einer riesigen Badewanne schwimmen.', 'Auf dem Mars ist der Sonnenuntergang blau.', 'Die ISS umrundet die Erde in etwa 90 Minuten.', 'Es gibt mehr Sterne im Universum als Sandkörner an allen Stränden der Erde.'];
    let pet = null, petT = 0, petPos = { x: 0, y: 0 }, petHold = false;
    function petLine() {
        const h = new Date().getHours(), n = U.firstName || '';
        const greet = h < 5 ? `Noch wach, ${n}? Die Sterne leisten dir Gesellschaft.` : h < 11 ? `Guten Morgen, ${n}! Kaffee schon getankt?` : h < 14 ? `Mahlzeit, ${n}!` : h < 18 ? `Schönen Nachmittag, ${n}!` : h < 22 ? `Guten Abend, ${n}. Feierabend in Sicht?` : `Gute Nacht bald, ${n}!`;
        const rem = (S.reminders || []).filter(r => r.at > Date.now()).sort((a, b) => a.at - b.at)[0];
        const opts = [greet, 'Wusstest du? ' + FACTS[Math.random() * FACTS.length | 0]];
        if (rem) opts.push(`Nicht vergessen: „${rem.text}“ um ${new Date(rem.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}.`);
        const open = API.wins.filter(w => !w.closing).length; if (open >= 6) opts.push(`${open} Fenster offen … Zeit zum Aufräumen? 🧹`);
        return opts[Math.random() * opts.length | 0];
    }
    function say(text, ms) {
        let b = pet.querySelector('.pt-say'); if (!b) { b = document.createElement('div'); b.className = 'pt-say'; pet.appendChild(b); }
        b.textContent = text; b.classList.remove('out'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.add('out'), ms || 5000);
    }
    function petBounds() { const d = $('desk').getBoundingClientRect(); return { w: d.width - 80, h: d.height - 90 }; }
    function petGo(x, y, slow) {
        const b = petBounds(); x = Math.max(8, Math.min(b.w, x)); y = Math.max(8, Math.min(b.h, y));
        pet.classList.toggle('flip', x < petPos.x); petPos = { x, y };
        const dist = Math.hypot(x - parseFloat(pet.style.left || 0), y - parseFloat(pet.style.top || 0));
        pet.style.transitionDuration = slow === 0 ? '0s' : Math.max(2, Math.min(12, dist / 60)) + 's';
        pet.style.left = x + 'px'; pet.style.top = y + 'px';
    }
    function petWander() {
        clearTimeout(petT); if (!pet) return;
        if (!pet.classList.contains('drag') && !calm() && !petHold) { const b = petBounds(); petGo(Math.random() * b.w, Math.random() * b.h); }
        petT = setTimeout(petWander, 9000 + Math.random() * 9000);
    }
    function petOn() {
        if (pet || S.pet === false) return;
        pet = document.createElement('div'); pet.id = 'pet'; pet.setAttribute('role', 'button'); pet.tabIndex = 0; pet.title = 'Astro – klick mich an'; pet.setAttribute('aria-label', 'Astronaut Astro');
        pet.innerHTML = `<div class="pt-body">${PET_SVG}</div>`;
        $('desk').appendChild(pet);
        const b = petBounds(); petPos = { x: b.w * .55, y: b.h * .6 }; petGo(petPos.x, petPos.y, 0);
        if (window.JMOS_ASTRO_DRESS) JMOS_ASTRO_DRESS(pet);
        setTimeout(() => say(petLine(), 4500), 2200);
        petT = setTimeout(petWander, 6000);
        let sx, sy, ox, oy, moved = false;
        pet.addEventListener('pointerdown', ev => {
            if (ev.button > 0) return; ev.stopPropagation(); ev.preventDefault(); pet.setPointerCapture(ev.pointerId);
            sx = ev.clientX; sy = ev.clientY; ox = parseFloat(pet.style.left); oy = parseFloat(pet.style.top); moved = false;
            const r = pet.getBoundingClientRect(); ox = r.left; oy = r.top;
            const mv = m => { if (!moved && Math.hypot(m.clientX - sx, m.clientY - sy) < 4) return; if (!moved) { moved = true; pet.classList.add('drag'); clearTimeout(petT); } petGo(ox + m.clientX - sx, oy + m.clientY - sy, 0); };
            const up = () => {
                pet.removeEventListener('pointermove', mv); pet.removeEventListener('pointerup', up); pet.removeEventListener('pointercancel', up);
                if (moved) { pet.classList.remove('drag'); say(['Huiii!', 'Danke für die Mitfahrgelegenheit!', 'Schwerelos ist schöner …'][Math.random() * 3 | 0], 2500); petT = setTimeout(petWander, 12000); }
                else { pet.classList.remove('spin'); void pet.offsetWidth; pet.classList.add('spin'); say(petLine()); }
            };
            pet.addEventListener('pointermove', mv); pet.addEventListener('pointerup', up); pet.addEventListener('pointercancel', up);
        });
        pet.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); say(petLine()); } });
        pet.addEventListener('contextmenu', ev => { ev.preventDefault(); ev.stopPropagation(); API.ctx(ev.clientX, ev.clientY, [['fa-comment', 'Etwas sagen', () => say(petLine())], ['fa-house', 'Komm her', () => { const b2 = petBounds(); petGo(b2.w / 2, b2.h / 2); }], ...(window.JMOS_ASTRO_CTX ? JMOS_ASTRO_CTX(ev) : []), null, ['fa-eye-slash', 'Astro ausblenden', () => { S.pet = false; API.save(); petOff(); }]]); });
        new ResizeObserver(() => { if (pet) petGo(petPos.x, petPos.y, 0); }).observe($('desk'));
    }
    function petOff() { clearTimeout(petT); if (pet) { pet.remove(); pet = null; } }
    // für OS/season.js: Astro sprechen lassen, bewegen, anhalten
    window.JMOS_ASTRO = { say: (t, ms) => { if (pet) say(t, ms); }, go: (x, y, slow) => { if (pet) petGo(x, y, slow); }, el: () => pet, bounds: () => petBounds(), pos: () => petPos, hold: v => { petHold = !!v; if (!v) petWander(); }, line: () => petLine(), svg: PET_SVG };

    // ================= Als App installieren =================
    let installEv = null;
    const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    function wireInstall() {
        addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); installEv = ev; document.querySelectorAll('.lv-inst').forEach(paintInstall); });
        addEventListener('appinstalled', () => { installEv = null; document.querySelectorAll('.lv-inst').forEach(paintInstall); const box = $('toasts'), el = document.createElement('div'); el.className = 'tst'; el.innerHTML = '<div class="tst-i"><span class="ic" style="--c:#818cf8"><i class="fa-solid fa-download"></i></span><span class="tx"><b>J.Mainz OS installiert</b><span>Das OS gibt es jetzt als eigene App auf diesem Computer.</span></span></div>'; box.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 4500); });
    }
    async function install() {
        if (!installEv) return;
        installEv.prompt(); try { await installEv.userChoice; } catch (x) { } installEv = null; document.querySelectorAll('.lv-inst').forEach(paintInstall);
    }
    function paintInstall(row) {
        const b = row.querySelector('button'), s = row.querySelector('small');
        if (standalone()) { b.disabled = true; b.textContent = 'Installiert'; s.textContent = 'Das OS läuft gerade als eigene App.'; }
        else if (installEv) { b.disabled = false; b.textContent = 'Installieren'; s.textContent = 'Öffnet das OS als eigenes Fenster ohne Browserleiste, mit eigenem Symbol in der Taskleiste von Windows bzw. im Dock.'; }
        else { b.disabled = true; b.textContent = 'Installieren'; s.textContent = 'In Chrome oder Edge möglich: Symbol „App installieren“ rechts in der Adressleiste. In Safari: Teilen → „Zum Dock hinzufügen“.'; }
    }

    // ================= Einstellungen =================
    function settings(body) {
        const box = body.querySelector('.app-set'), sec = document.createElement('section');
        const tg = (k, t, d) => `<label class="set-row"><div><b>${t}</b><small>${d}</small></div><input type="checkbox" class="tgl" data-lv="${k}" ${on(k) ? 'checked' : ''}></label>`;
        sec.innerHTML = `<h3>Lebendiger Desktop</h3>
            ${tg('shoot', 'Sternschnuppen', 'Ab und zu zieht eine Sternschnuppe über den Himmel.')}
            ${tg('tod', 'Tageszeit', 'Der Himmel färbt sich morgens, tagsüber und abends leicht anders.')}
            ${tg('wx', 'Wetter', 'Regen, Schnee, Gewitter oder Nebel wie draußen bei dir (Ort aus dem Wetter-Widget).')}
            <label class="set-row"><div><b>Astro, der kleine Astronaut</b><small>Schwebt über den Desktop. Anklicken, ziehen oder per Rechtsklick ausblenden.</small></div><input type="checkbox" class="tgl" data-pet ${S.pet !== false ? 'checked' : ''}></label>
            <div class="set-row"><div><b>Bildschirmschoner</b><small>Flug durch die Sterne mit Uhr, nach so vielen Minuten ohne Maus und Tastatur.</small></div><div style="display:flex;gap:8px;align-items:center"><button type="button" class="btn lv-prev">Vorschau</button><select class="sh-sel lv-saver">${[[0, 'Nie'], [3, '3 Min.'], [5, '5 Min.'], [10, '10 Min.'], [15, '15 Min.'], [30, '30 Min.']].map(([v, n]) => `<option value="${v}" ${saverMin() === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
            <div class="set-row lv-inst"><div><b>Als App installieren</b><small></small></div><button type="button" class="btn">Installieren</button></div>`;
        box.insertBefore(sec, box.children[2] || null); paintInstall(sec.querySelector('.lv-inst'));
        sec.addEventListener('change', ev => {
            const t = ev.target;
            if (t.dataset.lv) { L()[t.dataset.lv] = t.checked; API.save(); if (t.dataset.lv === 'tod') tod(); else if (t.dataset.lv === 'wx') { if (t.checked) weather(); else setWx(''); } else runFx(); }
            else if ('pet' in t.dataset) { S.pet = t.checked; API.save(); t.checked ? petOn() : petOff(); }
            else if (t.classList.contains('lv-saver')) { S[SAVER_KEY] = +t.value; API.save(); }
        });
        sec.addEventListener('click', ev => {
            if (ev.target.closest('.lv-prev')) { ev.stopPropagation(); setTimeout(saverOn, 50); }
            if (ev.target.closest('.lv-inst button')) install();
        });
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        init(api, user) {
            API = api; U = user; e = api.esc; S = api.state();
            wireLive(); wireBye(); wireSaver(); wireInstall();
            const base0 = window.JMOS_NATIVE_UI.set; window.JMOS_NATIVE_UI.set = (b, w) => { base0(b, w); settings(b); };
            setTimeout(() => { enter(); setTimeout(petOn, 900); }, 420);
        },
    });
})();
