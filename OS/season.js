/* J.Mainz OS – Paket F: Jahreszeiten-Themen (Weihnachten, Silvester, Ostern, Halloween) und Astro ausgebaut
   (Outfits, sagt Erinnerungen und Nachrichten an, Minispiel „Sterne sammeln“). */
(function () {
    'use strict';
    let API, U, S, e;
    const $ = id => document.getElementById(id);
    const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const A = () => window.JMOS_ASTRO;

    // ================= Welche Zeit ist gerade? =================
    function easter(y) {          // Ostersonntag (Gauß/Meeus)
        const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), f = b % 4, g = Math.floor((b + 8) / 25), h = Math.floor((b - g + 1) / 3),
            k = (19 * a + b - d - h + 15) % 30, i = Math.floor(c / 4), l = c % 4, m = (32 + 2 * f + 2 * i - k - l) % 7, n = Math.floor((a + 11 * k + 22 * m) / 451),
            mo = Math.floor((k + m - 7 * n + 114) / 31), da = ((k + m - 7 * n + 114) % 31) + 1;
        return new Date(y, mo - 1, da);
    }
    function autoSeason(d = new Date()) {
        const mo = d.getMonth() + 1, da = d.getDate();
        if ((mo === 12 && da === 31 && d.getHours() >= 12) || (mo === 1 && da === 1)) return 'nye';
        if (mo === 12 && da <= 26) return 'xmas';
        const es = easter(d.getFullYear()), day = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - es) / 864e5);
        if (day >= -3 && day <= 1) return 'easter';
        if (mo === 10 && da >= 24) return 'halloween';
        return '';
    }
    const NAMES = { xmas: 'Weihnachten', nye: 'Silvester', easter: 'Ostern', halloween: 'Halloween' };
    const season = () => { const v = S.season || 'auto'; return v === 'off' ? '' : v === 'auto' ? autoSeason() : (NAMES[v] ? v : ''); };

    // ================= Darstellung =================
    let born = [], cur = '', cv, cx, raf = 0, parts = [], flakes = [], nextRocket = 0, batT = 0, lastT = 0;
    function apply() {
        const k = season(); if (k === cur) return; cur = k;
        document.documentElement.dataset.season = k;
        cancelAnimationFrame(raf); raf = 0; parts = []; flakes = []; clearTimeout(batT);
        document.querySelectorAll('#garland, .egg, .bat, #nye-cd').forEach(x => x.remove());
        if (k === 'xmas') { garland(); makeFlakes(); }
        if (k === 'easter') eggs();
        if (k === 'halloween') bats();
        run(); dress();
    }
    function sizeCv() { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); if (cur === 'xmas') makeFlakes(); }
    function run() {
        cancelAnimationFrame(raf); raf = 0; cx.clearRect(0, 0, innerWidth, innerHeight);
        if ((cur === 'xmas' || cur === 'nye') && !calm() && !document.hidden && !document.documentElement.classList.contains('locked')) { lastT = performance.now(); raf = requestAnimationFrame(frame); }
    }
    // Weihnachten: leiser Schneefall
    function makeFlakes() { flakes = Array.from({ length: Math.round(innerWidth / 18) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: .8 + Math.random() * 2.2, v: .25 + Math.random() * .6, w: Math.random() * 6.3 })); }
    // Silvester: Raketen und Funken
    const COLORS = ['#f472b6', '#facc15', '#60a5fa', '#34d399', '#f87171', '#c084fc', '#fb923c', '#ffffff'];
    function rocket(x) {
        const tx = x ?? innerWidth * (.15 + Math.random() * .7), ty = innerHeight * (.12 + Math.random() * .35);
        parts.push({ k: 'r', x: tx + (Math.random() - .5) * 80, y: innerHeight - 40, tx, ty, v: 7 + Math.random() * 3, c: COLORS[Math.random() * COLORS.length | 0] });
    }
    function burst(x, y, c) {
        const n = 60 + Math.random() * 50 | 0, two = Math.random() < .3 ? COLORS[Math.random() * COLORS.length | 0] : c;
        for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = 2 + Math.random() * 5.5; born.push({ k: 's', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 50 + Math.random() * 40, c: i % 3 ? c : two }); }
    }
    function frame(t) {
        if (document.body.classList.contains('dragging')) { lastT = t; raf = requestAnimationFrame(frame); return; }
        if (window.JMOS_PERF && JMOS_PERF.on() && t - lastT < 32) { raf = requestAnimationFrame(frame); return; }   // Leistungsmodus: 30 Bilder/s   // beim Ziehen eines Fensters Pause
        const dt = Math.min(3, (t - lastT) / 16.7 || 1); lastT = t;
        cx.clearRect(0, 0, innerWidth, innerHeight);
        if (cur === 'xmas') {
            cx.fillStyle = '#fff';
            for (const f of flakes) { f.y += f.v * dt; f.w += .015 * dt; f.x += Math.sin(f.w) * .35 * dt; if (f.y > innerHeight + 4) { f.y = -4; f.x = Math.random() * innerWidth; } cx.globalAlpha = .3 + f.r / 4; cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, 6.283); cx.fill(); }
            cx.globalAlpha = 1;
        }
        if (cur === 'nye') {
            const h = new Date().getHours(), party = h >= 23 || h < 2 || S.season === 'nye';
            if (t > nextRocket) { rocket(); nextRocket = t + (party ? 500 + Math.random() * 1400 : 3000 + Math.random() * 6000); }
            cx.globalCompositeOperation = 'lighter';
            parts = parts.filter(p => {
                if (p.k === 'r') { const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy); if (d < p.v * dt * 1.5) { burst(p.tx, p.ty, p.c); return false; } p.x += dx / d * p.v * dt; p.y += dy / d * p.v * dt; cx.fillStyle = '#fde68a'; cx.beginPath(); cx.arc(p.x, p.y, 1.8, 0, 6.283); cx.fill(); cx.fillStyle = 'rgba(253,230,138,.35)'; cx.fillRect(p.x - .6, p.y, 1.2, 14); return true; }
                p.life += dt; p.vx *= .985; p.vy = p.vy * .985 + .045 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
                const k = 1 - p.life / p.max; if (k <= 0) return false;
                cx.globalAlpha = k; cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, 2.1, 0, 6.283); cx.fill(); cx.globalAlpha = k * .35; cx.beginPath(); cx.arc(p.x - p.vx * 2, p.y - p.vy * 2, 1.4, 0, 6.283); cx.fill(); return true;
            });
            if (born.length) { parts.push(...born); born = []; }        // Funken erst nach dem Durchlauf anhängen
            cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
            countdown();
        }
        raf = requestAnimationFrame(frame);
    }
    // Countdown um Mitternacht
    let cdShown = '';
    function countdown() {
        const n = new Date(), y = n.getFullYear();
        const left = n.getMonth() === 11 && n.getDate() === 31 ? Math.ceil((new Date(y + 1, 0, 1) - n) / 1000) : 0;
        let el = $('nye-cd');
        if (left > 0 && left <= 10) { if (!el) { el = document.createElement('div'); el.id = 'nye-cd'; document.body.appendChild(el); } if (cdShown !== String(left)) { cdShown = String(left); el.innerHTML = `<b>${left}</b>`; el.firstChild.style.animation = 'none'; void el.offsetWidth; el.firstChild.style.animation = ''; } return; }
        const fresh = n.getMonth() === 0 && n.getDate() === 1 && n.getHours() === 0 && n.getMinutes() < 1;
        if (fresh && cdShown !== 'ny') { cdShown = 'ny'; if (!el) { el = document.createElement('div'); el.id = 'nye-cd'; document.body.appendChild(el); } el.innerHTML = `<span>Frohes neues Jahr</span><b class="y">${y}</b>`; for (let i = 0; i < 8; i++) setTimeout(() => rocket(innerWidth * (i + .5) / 8), i * 120); if (A()) A().say(`Frohes neues Jahr, ${U.firstName || ''}! 🎆`, 9000); setTimeout(() => { const x = $('nye-cd'); if (x) x.remove(); }, 12000); }
        else if (!fresh && el && cdShown !== 'ny') el.remove();
    }
    // Weihnachten: Lichterkette über der Taskleiste
    function garland() {
        const g = document.createElement('div'); g.id = 'garland'; g.setAttribute('aria-hidden', 'true');
        const n = Math.max(12, Math.round(innerWidth / 46)), cols = ['#f87171', '#facc15', '#4ade80', '#60a5fa', '#f472b6'];
        let path = 'M0 4'; for (let i = 0; i < n; i++) { const x0 = i / n * 100, x1 = (i + .5) / n * 100, x2 = (i + 1) / n * 100; path += ` Q${x1} 16 ${x2} 4`; void x0; }
        g.innerHTML = `<svg viewBox="0 0 100 20" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="#1f2937" stroke-width=".25" vector-effect="non-scaling-stroke"/></svg>` +
            Array.from({ length: n }, (_, i) => `<i style="left:${(i + .5) / n * 100}%;--c:${cols[i % cols.length]};animation-delay:${(i % 5) * .35 + Math.random() * .4}s"></i>`).join('');
        document.body.appendChild(g);
    }
    // Ostern: fünf Eier auf dem Desktop verstecken
    function eggs() {
        const y = new Date().getFullYear(), st = S.eggs && S.eggs.y === y ? S.eggs : (S.eggs = { y, found: [] });
        const desk = $('desk').getBoundingClientRect(), rnd = (a, b) => a + Math.random() * (b - a), cols = [['#f472b6', '#fbcfe8'], ['#60a5fa', '#bfdbfe'], ['#facc15', '#fef08a'], ['#4ade80', '#bbf7d0'], ['#c084fc', '#e9d5ff']];
        for (let i = 0; i < 5; i++) {
            if (st.found.includes(i)) continue;
            const el = document.createElement('button'); el.type = 'button'; el.className = 'egg'; el.dataset.egg = i; el.setAttribute('aria-label', 'Osterei');
            el.style.left = rnd(Math.min(380, desk.width * .3), desk.width - 60) + 'px'; el.style.top = rnd(desk.height * .25, desk.height - 70) + 'px';
            el.style.setProperty('--a', cols[i][0]); el.style.setProperty('--b', cols[i][1]); el.style.transform = `rotate(${rnd(-25, 25)}deg)`;
            el.innerHTML = '<svg viewBox="0 0 30 38"><path d="M15 1C7 1 1 14 1 23c0 8 6 14 14 14s14-6 14-14C29 14 23 1 15 1z" fill="var(--a)"/><path d="M2 20 Q8 16 15 20 T28 20" stroke="var(--b)" stroke-width="3" fill="none"/><path d="M3 27 Q9 31 15 27 T27 27" stroke="#fff" stroke-opacity=".7" stroke-width="2" fill="none" stroke-dasharray="2 3"/></svg>';
            el.addEventListener('pointerdown', ev => ev.stopPropagation());          // sonst fängt der Markier-Rahmen des Desktops den Klick
            el.addEventListener('click', eggClick);
            $('desk').appendChild(el);
        }
    }
    function eggClick(ev) {
        const el = ev.target.closest('.egg'); if (!el) return; ev.stopPropagation();
        const i = +el.dataset.egg, st = S.eggs; if (!st.found.includes(i)) st.found.push(i); API.save();
        const r = el.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2);
        el.classList.add('found'); setTimeout(() => el.remove(), 500);
        const n = st.found.length;
        if (A()) A().say(n >= 5 ? `Alle 5 Eier gefunden! Frohe Ostern, ${U.firstName || ''}! 🐣` : `Ein Osterei! ${n} von 5 gefunden 🥚`, 4500);
    }
    function confetti(x, y) {
        for (let i = 0; i < 24; i++) {
            const c = document.createElement('i'); c.className = 'cft'; const a = Math.random() * 6.283, d = 40 + Math.random() * 70;
            c.style.cssText = `left:${x}px;top:${y}px;background:${COLORS[i % COLORS.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 30}px;--r:${Math.random() * 720 - 360}deg`;
            document.body.appendChild(c); setTimeout(() => c.remove(), 900);
        }
    }
    // Halloween: Fledermäuse
    function bats() {
        if (cur !== 'halloween') return;
        if (!calm() && !document.hidden) {
            const n = 1 + (Math.random() * 3 | 0);
            for (let i = 0; i < n; i++) {
                const b = document.createElement('div'); b.className = 'bat'; b.setAttribute('aria-hidden', 'true');
                const ltr = Math.random() < .5, y = 40 + Math.random() * innerHeight * .45, dur = 7 + Math.random() * 5;
                b.style.cssText = `top:${y}px;animation-duration:${dur}s;animation-delay:${i * .5}s;--dir:${ltr ? 1 : -1};${ltr ? 'left:-60px' : 'right:-60px'}`;
                b.innerHTML = '<svg viewBox="0 0 60 26"><path class="w" d="M30 12 C24 2 14 2 2 6 C8 9 9 13 8 17 C13 14 18 15 22 19 C24 15 27 14 30 16 C33 14 36 15 38 19 C42 15 47 14 52 17 C51 13 52 9 58 6 C46 2 36 2 30 12Z" fill="#1e1b2e"/><circle cx="27.5" cy="11" r="1" fill="#fbbf24"/><circle cx="32.5" cy="11" r="1" fill="#fbbf24"/></svg>';
                document.body.appendChild(b); setTimeout(() => b.remove(), (dur + i * .5) * 1000 + 200);
            }
        }
        batT = setTimeout(bats, 9000 + Math.random() * 14000);
    }

    // ================= Astro: Outfits =================
    const OUTFITS = {
        none: ['Ohne', ''],
        santa: ['Weihnachtsmütze', '<path d="M12 12 C18 1 46 -1 52 11 C46 -3 36 -14 18 -15 C22 -6 18 3 12 12Z" fill="#dc2626"/><rect x="10" y="7" width="44" height="7.5" rx="3.75" fill="#f8fafc"/><circle cx="18" cy="-15" r="4.5" fill="#f8fafc"/>', 1],
        party: ['Partyhut', '<path d="M22 8 L33 -20 L43 8 Z" fill="#a855f7"/><path d="M25.5 0 L40 0 M28.5 -8 L37.5 -8" stroke="#facc15" stroke-width="2.5"/><circle cx="33" cy="-20" r="3.5" fill="#facc15"/>', 1],
        bunny: ['Hasenohren', '<g transform="rotate(-14 24 4)"><ellipse cx="24" cy="-8" rx="5.5" ry="14" fill="#f8fafc" stroke="#e2e8f0"/><ellipse cx="24" cy="-7" rx="2.6" ry="10" fill="#f9a8d4"/></g><g transform="rotate(14 40 4)"><ellipse cx="40" cy="-8" rx="5.5" ry="14" fill="#f8fafc" stroke="#e2e8f0"/><ellipse cx="40" cy="-7" rx="2.6" ry="10" fill="#f9a8d4"/></g>', 1],
        witch: ['Hexenhut', '<ellipse cx="32" cy="8" rx="25" ry="4.5" fill="#3b0764"/><path d="M19 7 L36 -24 L45 7 Z" fill="#581c87"/><rect x="20.5" y="1.5" width="23" height="4.5" fill="#f59e0b"/>', 1],
        crown: ['Krone', '<path d="M17 9 L19 -6 L25.5 2 L32 -10 L38.5 2 L45 -6 L47 9 Z" fill="#facc15" stroke="#ca8a04" stroke-width="1" stroke-linejoin="round"/><circle cx="32" cy="3" r="2" fill="#ef4444"/><circle cx="23" cy="5" r="1.5" fill="#3b82f6"/><circle cx="41" cy="5" r="1.5" fill="#22c55e"/>', 1],
        cap: ['Cap', '<path d="M14 13 Q32 -8 50 13 Z" fill="#2563eb"/><path d="M42 11 Q55 8 61 13 Q52 16 42 14 Z" fill="#1e40af"/><circle cx="32" cy="2.5" r="1.8" fill="#1e40af"/>', 1],
        glasses: ['Sonnenbrille', '<rect x="20" y="19" width="11" height="7.5" rx="3.5" fill="#0b1020"/><rect x="33" y="19" width="11" height="7.5" rx="3.5" fill="#0b1020"/><rect x="30.5" y="21" width="3" height="1.6" fill="#0b1020"/><path d="M22 21 l3 -1.2 M35 21 l3 -1.2" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" stroke-linecap="round"/>'],
        headphones: ['Kopfhörer', '<path d="M13 23 A19 19 0 0 1 51 23" stroke="#334155" stroke-width="3.5" fill="none" stroke-linecap="round"/><rect x="8.5" y="17" width="8" height="13" rx="3.5" fill="#ec4899"/><rect x="47.5" y="17" width="8" height="13" rx="3.5" fill="#ec4899"/>'],
    };
    const SEASON_HAT = { xmas: 'santa', nye: 'party', easter: 'bunny', halloween: 'witch' };
    const outfit = () => { const o = S.astroOutfit || 'auto'; return o === 'auto' ? (SEASON_HAT[cur] || 'none') : (OUTFITS[o] ? o : 'none'); };
    function dress(pet) {
        pet = pet || (A() && A().el()); if (!pet) return;
        const svg = pet.querySelector('svg'); if (!svg) return; const old = svg.querySelector('.pt-acc'); if (old) old.remove();
        const o = OUTFITS[outfit()]; pet.classList.toggle('hat', !!(o && o[2]));
        if (o && o[1]) { const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'pt-acc'); g.innerHTML = o[1]; svg.appendChild(g); }
    }
    function outfitPop(x, y) {
        API.closePops(); const old = document.querySelector('.ao-pop'); if (old) old.remove();
        const el = document.createElement('div'); el.className = 'ao-pop'; el.setAttribute('role', 'menu');
        const cur0 = S.astroOutfit || 'auto';
        el.innerHTML = `<b>Outfit für Astro</b><div class="ao-g">${[['auto', 'Passend zur Jahreszeit', SEASON_HAT[cur] || 'none'], ...Object.keys(OUTFITS).map(k => [k, OUTFITS[k][0], k])].map(([k, n, show]) => `<button type="button" data-o="${k}" class="${cur0 === k ? 'on' : ''}" title="${e(n)}"><svg viewBox="0 -26 64 98">${A().svg.replace(/^<svg[^>]*>|<\/svg>$/g, '')}${OUTFITS[show] ? OUTFITS[show][1] : ''}</svg><span>${e(n)}</span></button>`).join('')}</div>`;
        document.body.appendChild(el);
        el.style.left = Math.max(8, Math.min(innerWidth - el.offsetWidth - 8, x - el.offsetWidth / 2)) + 'px'; el.style.top = Math.max(8, Math.min(innerHeight - el.offsetHeight - 8, y - el.offsetHeight - 12)) + 'px';
        const close = ev => { if (!el.contains(ev.target)) { el.remove(); document.removeEventListener('pointerdown', close, true); } };
        setTimeout(() => document.addEventListener('pointerdown', close, true));
        el.addEventListener('click', ev => { const b = ev.target.closest('[data-o]'); if (!b) return; S.astroOutfit = b.dataset.o; API.save(); dress(); el.remove(); document.removeEventListener('pointerdown', close, true); if (A()) A().say(['Steht mir, oder? 😎', 'Neuer Look!', 'Passt perfekt.'][Math.random() * 3 | 0], 2500); });
    }

    // ================= Astro sagt Erinnerungen und Nachrichten an =================
    const talk = () => S.astroTalk !== false;
    function wireTalk() {
        const seen = new Set((S.remFired || []).map(r => r.id));
        setInterval(() => {
            (S.remFired || []).forEach(r => { if (seen.has(r.id)) return; seen.add(r.id); if (talk() && A() && A().el()) { A().el().classList.remove('spin'); void A().el().offsetWidth; A().el().classList.add('spin'); A().say('⏰ Erinnerung: ' + r.text, 9000); } });
        }, 4000);
        if (window.MSG && can(U, 'messenger')) {
            const base = {}; let ready = false;
            MSG.subscribe(() => {
                const st = MSG.state; if (!st.ready) return;
                st.chats.forEach(c => {
                    const s0 = base[c.id]; base[c.id] = c.seq || 0;
                    if (!ready || s0 === undefined || (c.seq || 0) <= s0 || !c.last || c.last.from === U.uid || MSG.isMuted(c, st.meta)) return;
                    if (talk() && A() && A().el()) A().say(`💬 ${MSG.chatTitle(c, st.dir, U.uid)}: ${MSG.previewLine(c, st.dir, U.uid)}`.slice(0, 120), 6000);
                });
                ready = true;
            });
        }
    }

    // ================= Minispiel: Sterne sammeln =================
    let game = null;
    function playGame() {
        if (game) return; API.closePops();
        const el = document.createElement('div'); el.className = 'sg'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Sterne sammeln');
        el.innerHTML = `<div class="sg-hud"><span><i class="fa-solid fa-star"></i> <b class="sg-s">0</b></span><span class="sg-t">30</span><span class="sg-b">Bestwert ${+S.astroBest || 0}</span><button type="button" class="sg-x" aria-label="Beenden"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="sg-a">${A() ? A().svg : ''}</div><div class="sg-intro"><b>Sterne sammeln</b><span>Steuere Astro mit der Maus und sammle in 30 Sekunden so viele Sterne wie möglich. Goldene Sterne zählen 5 Punkte, Meteore kosten 3.</span><button type="button" class="sg-go">Los geht's</button></div>`;
        document.body.appendChild(el);
        const astro = el.querySelector('.sg-a'); dress({ querySelector: q => astro.querySelector(q), classList: astro.classList });
        let ax = innerWidth / 2, ay = innerHeight / 2, mx = ax, my = ay, score = 0, left = 30, items = [], spawnT = 0, tick = 0, running = false, rf = 0, last = 0;
        const place = () => { astro.style.transform = `translate(${ax - 32}px, ${ay - 36}px) scaleX(${mx < ax - 2 ? -1 : 1})`; };
        place();
        const spawn = () => {
            const r = Math.random(), k = r < .12 ? 'gold' : r < .3 ? 'met' : 'star', it = document.createElement('i'); it.className = 'sg-i ' + k;
            it.innerHTML = k === 'met' ? '<i class="fa-solid fa-meteor"></i>' : '<i class="fa-solid fa-star"></i>';
            const x = 40 + Math.random() * (innerWidth - 80), y = 70 + Math.random() * (innerHeight - 140); it.style.left = x + 'px'; it.style.top = y + 'px'; el.appendChild(it);
            items.push({ el: it, x, y, k, t: performance.now() });
        };
        const end = () => {
            running = false; cancelAnimationFrame(rf); clearInterval(tick); clearInterval(spawnT); items.forEach(i => i.el.remove()); items = [];
            const best = Math.max(+S.astroBest || 0, score), rec = score > (+S.astroBest || 0) && score > 0; S.astroBest = best; API.save();
            const box = document.createElement('div'); box.className = 'sg-intro'; box.innerHTML = `<b>${rec ? 'Neuer Rekord! 🏆' : 'Geschafft!'}</b><span><strong>${score}</strong> Punkte · Bestwert ${best}</span><div><button type="button" class="sg-go">Nochmal</button><button type="button" class="sg-q">Beenden</button></div>`;
            el.appendChild(box); el.querySelector('.sg-b').textContent = 'Bestwert ' + best;
            if (A()) A().say(rec ? `Neuer Rekord: ${score} Punkte! 🚀` : `${score} Punkte, nicht schlecht!`, 5000);
        };
        const loop = t => {
            const dt = Math.min(3, (t - last) / 16.7 || 1); last = t;
            ax += (mx - ax) * .14 * dt; ay += (my - ay) * .14 * dt; place();
            items = items.filter(i => {
                if (Math.hypot(i.x - ax, i.y - ay) < 40) { const pts = i.k === 'gold' ? 5 : i.k === 'met' ? -3 : 1; score = Math.max(0, score + pts); el.querySelector('.sg-s').textContent = score;
                    const f = document.createElement('span'); f.className = 'sg-f' + (pts < 0 ? ' bad' : ''); f.textContent = (pts > 0 ? '+' : '') + pts; f.style.left = i.x + 'px'; f.style.top = i.y + 'px'; el.appendChild(f); setTimeout(() => f.remove(), 700);
                    i.el.remove(); return false; }
                if (t - i.t > (i.k === 'gold' ? 2200 : 4200)) { i.el.classList.add('gone'); setTimeout(() => i.el.remove(), 300); return false; }
                return true;
            });
            if (running) rf = requestAnimationFrame(loop);
        };
        const start = () => {
            el.querySelectorAll('.sg-intro').forEach(x => x.remove()); score = 0; left = 30; el.querySelector('.sg-s').textContent = '0'; el.querySelector('.sg-t').textContent = '30';
            running = true; last = performance.now(); rf = requestAnimationFrame(loop); for (let i = 0; i < 3; i++) spawn();
            spawnT = setInterval(() => { if (items.length < 8) spawn(); }, 650);
            tick = setInterval(() => { left--; el.querySelector('.sg-t').textContent = left; el.querySelector('.sg-t').classList.toggle('low', left <= 5); if (left <= 0) end(); }, 1000);
        };
        const quit = () => { running = false; cancelAnimationFrame(rf); clearInterval(tick); clearInterval(spawnT); el.remove(); document.removeEventListener('keydown', key, true); game = null; if (A()) A().hold(false); };
        const key = ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); quit(); } };
        document.addEventListener('keydown', key, true);
        el.addEventListener('pointermove', ev => { mx = ev.clientX; my = ev.clientY; });
        el.addEventListener('click', ev => { if (ev.target.closest('.sg-go')) start(); else if (ev.target.closest('.sg-x, .sg-q')) quit(); });
        game = { quit }; if (A()) A().hold(true);
        el.querySelector('.sg-go').focus();
    }

    // ================= Einstellungen =================
    function settings(body) {
        const box = body.querySelector('.app-set'), sec = document.createElement('section'), auto = autoSeason();
        sec.innerHTML = `<h3>Jahreszeiten &amp; Astro</h3>
            <div class="set-row"><div><b>Jahreszeiten-Themen</b><small>Automatisch: Weihnachten (1.–26.12.), Silvester (31.12. ab mittags und 1.1.), Ostern (Gründonnerstag bis Ostermontag), Halloween (24.–31.10.).${auto ? ' Gerade aktiv: ' + NAMES[auto] + '.' : ''}</small></div><select class="sh-sel ss-season">${[['auto', 'Automatisch'], ['off', 'Aus'], ['xmas', 'Weihnachten'], ['nye', 'Silvester'], ['easter', 'Ostern'], ['halloween', 'Halloween']].map(([v, n]) => `<option value="${v}" ${(S.season || 'auto') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
            <div class="set-row"><div><b>Outfit für Astro</b><small>„Passend zur Jahreszeit“ setzt z. B. im Dezember die Weihnachtsmütze auf.</small></div><select class="sh-sel ss-outfit">${[['auto', 'Passend zur Jahreszeit'], ...Object.keys(OUTFITS).map(k => [k, OUTFITS[k][0]])].map(([v, n]) => `<option value="${v}" ${(S.astroOutfit || 'auto') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
            <label class="set-row"><div><b>Astro sagt Bescheid</b><small>Astro sagt fällige Erinnerungen und neue Nachrichten in einer Sprechblase an.</small></div><input type="checkbox" class="tgl ss-talk" ${talk() ? 'checked' : ''}></label>
            <div class="set-row"><div><b>Minispiel „Sterne sammeln“</b><small>30 Sekunden Sterne einsammeln. Bestwert: ${+S.astroBest || 0} Punkte. Auch per Rechtsklick auf Astro.</small></div><button type="button" class="btn ss-play"><i class="fa-solid fa-star"></i>Spielen</button></div>`;
        const after = [...box.querySelectorAll('section h3')].find(h => /Lebendiger/.test(h.textContent));
        box.insertBefore(sec, after ? after.parentElement.nextSibling : null);
        box.addEventListener('change', ev => {
            const t = ev.target;
            if (t.classList.contains('ss-season')) { S.season = t.value; API.save(); apply(); }
            else if (t.classList.contains('ss-outfit')) { S.astroOutfit = t.value; API.save(); dress(); }
            else if (t.classList.contains('ss-talk')) { S.astroTalk = t.checked; API.save(); }
        });
        box.addEventListener('click', ev => { if (ev.target.closest('.ss-play')) playGame(); });
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        init(api, user) {
            API = api; U = user; e = api.esc; S = api.state();
            cv = document.createElement('canvas'); cv.id = 'ssn'; $('wall').appendChild(cv); cx = cv.getContext('2d'); sizeCv();
            addEventListener('resize', sizeCv); document.addEventListener('visibilitychange', run);
            new MutationObserver(run).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
            window.JMOS_ASTRO_DRESS = dress;
            window.JMOS_ASTRO_CTX = ev => [['fa-shirt', 'Outfit wählen …', () => outfitPop(ev.clientX, ev.clientY)], ['fa-star', 'Sterne sammeln (Spiel)', playGame]];
            window.JMOS_SEASON = { set: k => { S.season = k; apply(); }, auto: autoSeason, easter, play: playGame, outfit: k => { S.astroOutfit = k; dress(); } };
            const base0 = window.JMOS_NATIVE_UI.set; window.JMOS_NATIVE_UI.set = (b, w) => { base0(b, w); settings(b); };
            (window.JMOS_SEARCH_EXTRA = window.JMOS_SEARCH_EXTRA || []).push(q => (q || '').toLowerCase().length >= 4 && /(spiel|sterne|astro)/i.test(q) ? [{ kind: 'Spiel', title: 'Sterne sammeln mit Astro', sub: 'Minispiel, 30 Sekunden', icon: 'fa-star', c: '#facc15', run: playGame, s: 3 }] : []);
            apply(); wireTalk();
            setInterval(apply, 60000);           // Wechsel um Mitternacht, Silvester mittags usw.
        },
    });
})();
