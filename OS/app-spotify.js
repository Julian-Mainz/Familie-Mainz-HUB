// OS/app-spotify.js – Spotify als eigene OS-App: Fernbedienung (Titel, Fortschritt, Lautstärke, Geräte), Playlists, Suche, Lieblingssongs, Zuletzt gehört.
// Nutzt dieselbe Spotify-Anmeldung wie die Dashboard-Seite (Token im Browser). Verbinden läuft einmalig über ein kleines Anmeldefenster.
(function () {
    'use strict';
    const { esc, toast } = OAK;
    const SP = 'https://api.spotify.com/v1';
    const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const store = () => { try { return localStorage.getItem('sp_persist') === '1' ? localStorage : sessionStorage; } catch (x) { return sessionStorage; } };
    const tok = () => { try { return JSON.parse(store().getItem('sp_tok') || localStorage.getItem('sp_tok') || sessionStorage.getItem('sp_tok') || 'null'); } catch (x) { return null; } };
    let U = null;
    const cid = () => (U.userPrefs && U.userPrefs.spotify && U.userPrefs.spotify.clientId) || (() => { try { return localStorage.getItem('sp_client_id') || ''; } catch (x) { return ''; } })();
    async function access() {
        let t = tok(); if (!t || !t.access) return null;
        if (Date.now() > t.exp - 60000 && t.refresh) {
            const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: cid() }) });
            if (!r.ok) return null; const j = await r.json(); t = { access: j.access_token, refresh: j.refresh_token || t.refresh, exp: Date.now() + j.expires_in * 1000, scope: j.scope || t.scope || '' };
            try { store().setItem('sp_tok', JSON.stringify(t)); } catch (x) {}
        }
        return t.access;
    }
    async function api(path, method = 'GET', body) {
        const a = await access(); if (!a) throw Object.assign(new Error('Nicht mit Spotify verbunden.'), { auth: true });
        const r = await fetch(SP + path, { method, headers: { Authorization: 'Bearer ' + a, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
        if (r.status === 401) throw Object.assign(new Error('Die Verbindung zu Spotify ist abgelaufen.'), { auth: true });
        if (r.status === 204 || r.status === 202) return null;
        const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (x) {}
        if (!r.ok) { const e = new Error((j && j.error && j.error.message) || r.statusText); e.status = r.status; e.reason = j && j.error && j.error.reason; throw e; }
        return j;
    }
    const explain = e => e.reason === 'PREMIUM_REQUIRED' ? 'Für die Fernsteuerung ist Spotify Premium nötig.' : e.status === 404 || e.reason === 'NO_ACTIVE_DEVICE' ? 'Kein aktives Gerät. Wähle rechts ein Gerät oder starte Spotify am Handy.' : e.status === 429 ? 'Spotify bremst gerade – gleich nochmal.' : e.message;

    function ui(body, win) {
        let st = null, at = 0, devices = [], tab = 'home', seeking = false, lastVol = 0, poll = null, q = '', detail = null;
        body.innerHTML = `<div class="oa oa-sp" style="--m:#1ed760;--mr:30,215,96"><div class="sp-wrap"></div></div>`;
        const root = body.querySelector('.oa'), wrap = body.querySelector('.sp-wrap'), $ = s => body.querySelector(s);
        function connectView() {
            clearInterval(poll); poll = null;
            wrap.innerHTML = `<div class="oa-card sp-conn"><span class="sp-logo"><i class="fa-solid fa-headphones"></i></span><h3>Mit Spotify verbinden</h3>
                <p class="oa-note">${cid() ? 'Ein kleines Anmeldefenster von Spotify öffnet sich. Danach steuerst du hier Musik, Geräte und Playlists.' : 'Zuerst muss einmal eine Spotify-App (Client ID) eingerichtet werden. Das geht auf der Spotify-Seite im Dashboard – das Fenster führt dich hin.'}</p>
                <button type="button" class="btn pri" data-k="connect"><i class="fa-solid fa-plug"></i>${cid() ? 'Verbinden' : 'Einrichten'}</button><p class="oa-note sp-wait" hidden><i class="fa-solid fa-spinner fa-spin"></i> Warte auf die Anmeldung im anderen Fenster …</p></div>`;
        }
        function shell() {
            wrap.innerHTML = `<div class="sp-grid"><aside class="sp-nav">${[['home', 'fa-house', 'Start'], ['search', 'fa-magnifying-glass', 'Suchen'], ['lists', 'fa-list', 'Playlists'], ['liked', 'fa-heart', 'Lieblingssongs'], ['recent', 'fa-clock-rotate-left', 'Zuletzt gehört']].map(([k, i, t]) => `<button type="button" class="oa-row" data-tab="${k}"><i class="fa-solid ${i}"></i><span>${t}</span></button>`).join('')}
                <div class="sp-devs"><h4>Geräte</h4><div class="sp-dl"></div><button type="button" class="btn sp-dis" data-k="disconnect"><i class="fa-solid fa-link-slash"></i>Trennen</button></div></aside>
                <section class="sp-main"></section></div>
                <footer class="sp-bar"><span class="sp-cov"></span><span class="sp-ti"><b>–</b><small></small></span>
                    <div class="sp-ctl"><div class="sp-btns"><button type="button" class="mx-ib" data-c="shuffle" title="Zufall"><i class="fa-solid fa-shuffle"></i></button><button type="button" class="mx-ib" data-c="prev" title="Zurück"><i class="fa-solid fa-backward-step"></i></button><button type="button" class="sp-pp" data-c="pp" title="Wiedergabe/Pause (Leertaste)"><i class="fa-solid fa-play"></i></button><button type="button" class="mx-ib" data-c="next" title="Weiter"><i class="fa-solid fa-forward-step"></i></button><button type="button" class="mx-ib" data-c="repeat" title="Wiederholen"><i class="fa-solid fa-repeat"></i></button></div>
                        <div class="sp-prog"><small class="sp-pos">0:00</small><input type="range" class="sp-seek" min="0" max="1000" value="0" aria-label="Position"><small class="sp-dur">0:00</small></div></div>
                    <div class="sp-vol"><i class="fa-solid fa-volume-high"></i><input type="range" min="0" max="100" value="50" aria-label="Lautstärke"></div></footer>`;
            const seek = $('.sp-seek'); seek.addEventListener('input', () => { seeking = true; const it = st && st.item; if (it) $('.sp-pos').textContent = mmss(seek.value / 1000 * it.duration_ms); });
            seek.addEventListener('change', () => { const it = st && st.item; seeking = false; if (it) cmd('/me/player/seek?position_ms=' + Math.round(seek.value / 1000 * it.duration_ms)); });
            $('.sp-vol input').addEventListener('change', ev => { lastVol = Date.now(); cmd('/me/player/volume?volume_percent=' + ev.target.value); });
            startPoll(); showTab(tab);
        }
        const cur = () => { const p = st && st.progress_ms != null ? st.progress_ms : 0; return st && st.is_playing ? p + (performance.now() - at) : p; };
        async function refresh() { if (document.hidden && st) return; try { st = await api('/me/player?additional_types=episode'); at = performance.now(); paint(); } catch (e) { if (e.auth) return connectView(); } }
        async function loadDevices() { try { devices = ((await api('/me/player/devices')) || {}).devices || []; } catch (e) { devices = []; } paintDevices(); }
        function startPoll() { refresh(); loadDevices(); clearInterval(poll); let n = 0; poll = setInterval(() => { if (!win.el.isConnected) return clearInterval(poll); refresh(); if (++n % 4 === 0) loadDevices(); }, 3000); }
        async function cmd(path, method = 'PUT', b) { try { await api(path, method, b); setTimeout(refresh, 350); } catch (e) { toast(root, explain(e), true); if (e.status === 404) loadDevices(); } }
        function paint() {
            if (!$('.sp-bar')) return; const it = st && st.item, playing = !!(st && st.is_playing), img = it && ((it.album && it.album.images && it.album.images[0]) || (it.images && it.images[0]));
            $('.sp-cov').style.backgroundImage = img ? `url("${img.url}")` : ''; $('.sp-ti b').textContent = it ? it.name : 'Nichts läuft';
            $('.sp-ti small').textContent = it ? (it.artists ? it.artists.map(a => a.name).join(', ') : (it.show && it.show.name) || '') + (st.device ? ' · auf ' + st.device.name : '') : (st && st.device ? 'auf ' + st.device.name : 'Kein aktives Gerät');
            $('[data-c="pp"] i').className = 'fa-solid ' + (playing ? 'fa-pause' : 'fa-play'); $('[data-c="shuffle"]').classList.toggle('on', !!(st && st.shuffle_state)); $('[data-c="repeat"]').classList.toggle('on', !!(st && st.repeat_state && st.repeat_state !== 'off'));
            $('.sp-dur').textContent = it ? mmss(it.duration_ms) : '0:00'; const dv = st && st.device; if (dv && dv.volume_percent != null && Date.now() - lastVol > 2500) $('.sp-vol input').value = dv.volume_percent;
            win.el.querySelector('.wt-title').textContent = it ? (playing ? '▶ ' : '') + it.name + ' – Spotify' : 'Spotify'; prog(); if (tab === 'home') home();
        }
        function prog() { const it = st && st.item; if (!it || seeking || !$('.sp-seek')) return; const c = Math.min(cur(), it.duration_ms); $('.sp-pos').textContent = mmss(c); $('.sp-seek').value = Math.round(c / it.duration_ms * 1000); }
        const progIv = setInterval(() => { if (!win.el.isConnected) return clearInterval(progIv); prog(); }, 500);
        function paintDevices() { const ic = { Smartphone: 'fa-mobile-screen', Computer: 'fa-laptop', TV: 'fa-tv', Tablet: 'fa-tablet-screen-button', Speaker: 'fa-volume-high' }; const el = $('.sp-dl'); if (!el) return;
            el.innerHTML = devices.map(d => `<button type="button" class="oa-row${d.is_active ? ' on' : ''}" data-dev="${esc(d.id)}"><i class="fa-solid ${ic[d.type] || 'fa-volume-high'}"></i><span>${esc(d.name)}<small>${d.is_active ? 'aktiv' : 'hierher wechseln'}</small></span></button>`).join('') || '<p class="oa-note">Kein Gerät gefunden. Öffne Spotify am Handy oder PC.</p>'; }
        // ---------- Inhalte ----------
        const trackRow = (t, i, ctx) => { if (!t) return ''; const img = t.album && t.album.images && (t.album.images[2] || t.album.images[0]);
            return `<button type="button" class="sp-tr${st && st.item && st.item.id === t.id ? ' on' : ''}" data-play-uri="${esc(t.uri)}"${ctx ? ` data-ctx="${esc(ctx)}" data-pos="${i}"` : ''}><span class="sp-n">${i + 1}</span>${img ? `<img src="${esc(img.url)}" alt="" loading="lazy">` : '<span class="sp-ph"></span>'}<span class="sp-tt"><b>${esc(t.name)}</b><small>${esc((t.artists || []).map(a => a.name).join(', '))}</small></span><small class="sp-al">${esc((t.album || {}).name || '')}</small><small>${mmss(t.duration_ms || 0)}</small></button>`; };
        const cards = list => `<div class="sp-cards">${list.filter(Boolean).map(p => { const img = (p.images || [])[0]; return `<button type="button" class="sp-card" data-open="${esc(p.type)}:${esc(p.id)}" title="${esc(p.name)}"><span class="sp-ci" style="${img ? `background-image:url('${esc(img.url)}')` : ''}">${img ? '' : '<i class="fa-solid fa-music"></i>'}<i class="fa-solid fa-circle-play sp-cp" data-ctxplay="${esc(p.uri)}"></i></span><b>${esc(p.name)}</b><small>${esc(p.type === 'artist' ? 'Künstler' : p.owner ? 'von ' + p.owner.display_name : (p.artists || []).map(a => a.name).join(', '))}</small></button>`; }).join('')}</div>`;
        const main = () => $('.sp-main');
        function load(html) { main().innerHTML = html || '<p class="oa-empty"><i class="fa-solid fa-spinner fa-spin"></i>Lädt …</p>'; }
        function home() {
            const it = st && st.item, img = it && ((it.album && it.album.images && it.album.images[0]) || (it.images && it.images[0]));
            const box = main().querySelector('.sp-now'); const h = `<div class="sp-now">${img ? `<img src="${esc(img.url)}" alt="">` : '<span class="sp-big"><i class="fa-solid fa-music"></i></span>'}<div><small>${st ? (st.is_playing ? 'Läuft gerade' : 'Pausiert') : 'Nichts läuft'}</small><h2>${esc(it ? it.name : 'Wähle eine Playlist oder suche einen Titel')}</h2><p>${esc(it ? (it.artists || []).map(a => a.name).join(', ') : '')}</p>${it && it.album ? `<p class="oa-note">${esc(it.album.name)}</p>` : ''}</div></div>`;
            if (box) { if (box._h !== h) { box.outerHTML = h; main().querySelector('.sp-now')._h = h; } } else { main().innerHTML = h + '<div class="sp-home-more"></div>'; main().querySelector('.sp-now')._h = h; homeMore(); }
        }
        async function homeMore() { try { const [pl, rec] = await Promise.all([api('/me/playlists?limit=12'), api('/me/player/recently-played?limit=10').catch(() => null)]); const m = main().querySelector('.sp-home-more'); if (!m) return;
            m.innerHTML = `<h3 class="sp-h">Deine Playlists</h3>${cards((pl && pl.items) || [])}${rec && rec.items && rec.items.length ? `<h3 class="sp-h">Zuletzt gehört</h3><div class="sp-tl">${rec.items.map((x, i) => trackRow(x.track, i)).join('')}</div>` : ''}`; } catch (e) {} }
        async function showTab(t) {
            tab = t; detail = null; body.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
            try {
                if (t === 'home') { main().innerHTML = ''; home(); }
                else if (t === 'search') { main().innerHTML = `<input class="oa-in sp-q" type="search" placeholder="Was möchtest du hören?" value="${esc(q)}" aria-label="Spotify durchsuchen"><div class="sp-res"></div>`; const i = main().querySelector('.sp-q'); i.focus(); let tm = 0; i.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { q = i.value.trim(); search(); }, 350); }); if (q) search(); }
                else if (t === 'lists') { load(); const j = await api('/me/playlists?limit=50'); load(`<h3 class="sp-h">Playlists</h3>${cards(j.items || [])}`); }
                else if (t === 'liked') { load(); const j = await api('/me/tracks?limit=50'); load(`<h3 class="sp-h">Lieblingssongs</h3><div class="sp-tl">${(j.items || []).map((x, i) => trackRow(x.track, i)).join('')}</div>`); }
                else if (t === 'recent') { load(); const j = await api('/me/player/recently-played?limit=50'); load(`<h3 class="sp-h">Zuletzt gehört</h3><div class="sp-tl">${(j.items || []).map((x, i) => trackRow(x.track, i)).join('')}</div>`); }
            } catch (e) { if (e.auth) return connectView(); load(`<p class="oa-empty">${esc(explain(e))}</p>`); }
        }
        async function search() { const box = main().querySelector('.sp-res'); if (!box) return; if (!q) { box.innerHTML = ''; return; }
            try { const j = await api('/search?type=track,playlist,artist,album&limit=8&q=' + encodeURIComponent(q)); box.innerHTML = `${(j.tracks && j.tracks.items.length) ? `<h3 class="sp-h">Titel</h3><div class="sp-tl">${j.tracks.items.map((t, i) => trackRow(t, i)).join('')}</div>` : ''}${j.artists && j.artists.items.length ? `<h3 class="sp-h">Künstler</h3>${cards(j.artists.items)}` : ''}${j.albums && j.albums.items.length ? `<h3 class="sp-h">Alben</h3>${cards(j.albums.items)}` : ''}${j.playlists && j.playlists.items.length ? `<h3 class="sp-h">Playlists</h3>${cards(j.playlists.items)}` : ''}` || '<p class="oa-empty">Nichts gefunden.</p>'; }
            catch (e) { box.innerHTML = `<p class="oa-empty">${esc(explain(e))}</p>`; } }
        async function open(type, id) {
            detail = type + ':' + id; load();
            try {
                if (type === 'playlist') { const p = await api(`/playlists/${id}`), tr = await api(`/playlists/${id}/tracks?limit=100`); load(`<div class="sp-dh">${p.images && p.images[0] ? `<img src="${esc(p.images[0].url)}" alt="">` : ''}<div><small>Playlist</small><h2>${esc(p.name)}</h2><p class="oa-note">${esc(p.owner ? p.owner.display_name : '')} · ${p.tracks ? p.tracks.total : 0} Titel</p><button type="button" class="btn pri" data-ctxplay="${esc(p.uri)}"><i class="fa-solid fa-play"></i>Abspielen</button></div></div><div class="sp-tl">${(tr.items || []).map((x, i) => trackRow(x.track, i, p.uri)).join('')}</div>`); }
                else if (type === 'album') { const a = await api(`/albums/${id}`); load(`<div class="sp-dh">${a.images && a.images[0] ? `<img src="${esc(a.images[0].url)}" alt="">` : ''}<div><small>Album</small><h2>${esc(a.name)}</h2><p class="oa-note">${esc((a.artists || []).map(x => x.name).join(', '))} · ${esc((a.release_date || '').slice(0, 4))}</p><button type="button" class="btn pri" data-ctxplay="${esc(a.uri)}"><i class="fa-solid fa-play"></i>Abspielen</button></div></div><div class="sp-tl">${(a.tracks.items || []).map((t, i) => trackRow(Object.assign({ album: a }, t), i, a.uri)).join('')}</div>`); }
                else if (type === 'artist') { const [a, top] = await Promise.all([api(`/artists/${id}`), api(`/artists/${id}/top-tracks?market=DE`)]); load(`<div class="sp-dh">${a.images && a.images[0] ? `<img src="${esc(a.images[0].url)}" alt="" class="rnd">` : ''}<div><small>Künstler</small><h2>${esc(a.name)}</h2><p class="oa-note">${(a.followers ? a.followers.total : 0).toLocaleString('de-DE')} Follower</p><button type="button" class="btn pri" data-ctxplay="${esc(a.uri)}"><i class="fa-solid fa-play"></i>Abspielen</button></div></div><h3 class="sp-h">Beliebt</h3><div class="sp-tl">${(top.tracks || []).map((t, i) => trackRow(t, i)).join('')}</div>`); }
            } catch (e) { load(`<p class="oa-empty">${esc(explain(e))}</p>`); }
        }
        const target = () => (st && st.device && st.device.id) ? '' : (devices[0] ? '?device_id=' + encodeURIComponent(devices[0].id) : '');
        body.addEventListener('click', ev => {
            const k = ev.target.closest('[data-k]'); if (k) { if (k.dataset.k === 'connect') return connect(); if (k.dataset.k === 'disconnect') { try { localStorage.removeItem('sp_tok'); sessionStorage.removeItem('sp_tok'); } catch (x) {} return connectView(); } }
            const tb = ev.target.closest('[data-tab]'); if (tb) return showTab(tb.dataset.tab);
            const cp = ev.target.closest('[data-ctxplay]'); if (cp) { ev.stopPropagation(); return cmd('/me/player/play' + target(), 'PUT', { context_uri: cp.dataset.ctxplay }); }
            const op = ev.target.closest('[data-open]'); if (op) { const [t, id] = op.dataset.open.split(':'); return open(t, id); }
            const tr = ev.target.closest('[data-play-uri]'); if (tr) return cmd('/me/player/play' + target(), 'PUT', tr.dataset.ctx ? { context_uri: tr.dataset.ctx, offset: { position: +tr.dataset.pos } } : { uris: [tr.dataset.playUri] });
            const dv = ev.target.closest('[data-dev]'); if (dv) return cmd('/me/player', 'PUT', { device_ids: [dv.dataset.dev], play: !!(st && st.is_playing) }).then(loadDevices);
            const c = ev.target.closest('[data-c]'); if (!c) return; const playing = !!(st && st.is_playing);
            ({ pp: () => cmd(playing ? '/me/player/pause' : '/me/player/play' + target()), next: () => cmd('/me/player/next', 'POST'), prev: () => cmd('/me/player/previous', 'POST'), shuffle: () => cmd('/me/player/shuffle?state=' + !(st && st.shuffle_state)),
                repeat: () => cmd('/me/player/repeat?state=' + ({ off: 'context', context: 'track', track: 'off' }[(st && st.repeat_state) || 'off'])) }[c.dataset.c] || (() => {}))();
        });
        body.addEventListener('contextmenu', ev => { const tr = ev.target.closest('[data-play-uri]'); if (!tr) return; ev.preventDefault();
            API.ctx(ev.clientX, ev.clientY, [['fa-play', 'Abspielen', () => tr.click()], ['fa-list', 'In die Warteschlange', () => cmd('/me/player/queue?uri=' + encodeURIComponent(tr.dataset.playUri), 'POST').then(() => toast(root, 'Zur Warteschlange hinzugefügt'))], ['fa-heart', 'Zu Lieblingssongs', () => cmd('/me/tracks?ids=' + tr.dataset.playUri.split(':').pop(), 'PUT').then(() => toast(root, 'Gespeichert'))]]); });
        body.addEventListener('keydown', ev => { if (ev.target.closest('input, textarea')) return; if (ev.code === 'Space') { ev.preventDefault(); $('[data-c="pp"]') && $('[data-c="pp"]').click(); } });
        function connect() {
            try { localStorage.setItem('sp_persist', '1'); } catch (x) {}
            const w = window.open('/spotify.html', 'jmspotify', 'width=520,height=760'); if (!w) return toast(root, 'Bitte Pop-ups für diese Seite erlauben.', true);
            const wt = $('.sp-wait'); if (wt) wt.hidden = false;
            const iv = setInterval(() => { if (tok()) { clearInterval(iv); try { w.close(); } catch (x) {} shell(); } else if (w.closed) { clearInterval(iv); if (wt) wt.hidden = true; } }, 1500);
        }
        win.onClose = () => { clearInterval(poll); clearInterval(progIv); };
        if (tok()) shell(); else connectView();
    }
    let API = null;
    JMOS_LAZY.register('spotify', { ui, init(api, user) { API = api; U = user; } });
})();
