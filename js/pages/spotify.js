// js/pages/spotify.js - Seiten-Code von /spotify.html (ausgelagert, damit der Browser ihn zwischenspeichern kann)
const API = 'https://api.spotify.com/v1', AUTH = 'https://accounts.spotify.com';
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative streaming user-read-private user-read-email user-library-read user-library-modify user-read-recently-played user-top-read user-follow-read playlist-modify-private playlist-modify-public';
const NEED = ['streaming', 'user-library-read', 'user-read-recently-played', 'user-top-read'];      // für die neuen Funktionen nötig
const REDIRECT = location.origin + '/spotify.html';
const setT = (el, t) => { const n = el.firstChild; if (n && n.nodeType === 3) { if (n.nodeValue !== t) n.nodeValue = t; } else el.textContent = t; };
const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: k => { try { localStorage.removeItem(k); } catch (e) {} } };
const view = v => ['setup', 'connect', 'player'].forEach(k => $('v-' + k).classList.toggle('hidden', k !== v));
function toast(msg, bad, action) {
    document.querySelectorAll('.sp-toast').forEach(x => x.remove()); const t = document.createElement('div'); t.textContent = msg + ' '; t.setAttribute('role', 'status');
    t.className = 'sp-toast' + (bad ? ' bad' : '');
    if (action) { const b = document.createElement('button'); b.textContent = action.label; b.className = 'sp-act'; b.onclick = () => { t.remove(); action.fn(); }; t.appendChild(b); }
    document.body.appendChild(t); setTimeout(() => t.remove(), action ? 14000 : 4200);
}

// ---------- Anmeldung (PKCE, ohne eigenen Server) ----------
const rand = n => { const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; return Array.from(crypto.getRandomValues(new Uint8Array(n)), x => c[x % c.length]).join(''); };
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const tokStore = () => (ls.get('sp_persist') === '1' ? localStorage : sessionStorage);
const getTok = () => { try { return JSON.parse(tokStore().getItem('sp_tok') || 'null'); } catch (e) { return null; } };
const setTok = t => { try { tokStore().setItem('sp_tok', JSON.stringify(t)); } catch (e) {} };
const clearTok = () => { try { localStorage.removeItem('sp_tok'); sessionStorage.removeItem('sp_tok'); } catch (e) {} };
const getClientId = () => (currentUser.userPrefs && currentUser.userPrefs.spotify && currentUser.userPrefs.spotify.clientId) || ls.get('sp_client_id') || '';

function showSetup() { $('redir').value = REDIRECT; $('cid').value = getClientId(); view('setup'); }
function copyRedirect() { $('redir').select(); try { navigator.clipboard.writeText(REDIRECT); } catch (e) { document.execCommand('copy'); } toast('Adresse kopiert'); }
async function saveClientId() {
    const id = $('cid').value.trim();
    if (!/^[a-zA-Z0-9]{20,64}$/.test(id)) return toast('Die Client ID sieht nicht richtig aus (nur Buchstaben und Zahlen, ca. 32 Zeichen).', true);
    ls.set('sp_client_id', id);
    try { await db.collection('users').doc(currentUser.uid).update({ 'userPrefs.spotify': { clientId: id } }); currentUser.userPrefs = { ...(currentUser.userPrefs || {}), spotify: { clientId: id } }; } catch (e) { /* lokal gespeichert genügt */ }
    clearTok(); view('connect');
}
async function connect() {
    const cid = getClientId(); if (!cid) return showSetup();
    ls.set('sp_persist', $('keep').checked ? '1' : '0');
    const verifier = rand(64), state = rand(16), challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    sessionStorage.setItem('sp_verifier', verifier); sessionStorage.setItem('sp_state', state);
    const u = new URL(AUTH + '/authorize');
    u.search = new URLSearchParams({ response_type: 'code', client_id: cid, scope: SCOPES, code_challenge_method: 'S256', code_challenge: challenge, redirect_uri: REDIRECT, state }).toString();
    location.href = u.toString();
}
async function finishLogin(code, state) {
    const verifier = sessionStorage.getItem('sp_verifier');
    if (!verifier || state !== sessionStorage.getItem('sp_state')) throw new Error('Die Anmeldung konnte nicht bestätigt werden. Bitte noch einmal versuchen.');
    const r = await fetch(AUTH + '/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: getClientId(), grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error_description || j.error || 'Spotify hat die Anmeldung abgelehnt.');
    setTok({ access: j.access_token, refresh: j.refresh_token, exp: Date.now() + j.expires_in * 1000, scope: j.scope || '' });
    sessionStorage.removeItem('sp_verifier'); sessionStorage.removeItem('sp_state');
}
async function refreshTok(t) {
    const r = await fetch(AUTH + '/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: getClientId() }) });
    if (!r.ok) { clearTok(); throw Object.assign(new Error('Die Verbindung zu Spotify ist abgelaufen.'), { reauth: true }); }
    const j = await r.json(), n = { access: j.access_token, refresh: j.refresh_token || t.refresh, exp: Date.now() + j.expires_in * 1000, scope: j.scope || t.scope || '' }; setTok(n); return n;
}
function disconnect() { clearTok(); stopPolling(); st = null; view('connect'); toast('Verbindung getrennt'); }

// ---------- Spotify-Schnittstelle ----------
let backoffUntil = 0;
async function api(path, { method = 'GET', body, retry = true } = {}) {
    let t = getTok(); if (!t) throw Object.assign(new Error('Nicht verbunden.'), { reauth: true });
    if (Date.now() > t.exp - 60000) t = await refreshTok(t);
    const r = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + t.access, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 && retry) { t.exp = 0; setTok(t); return api(path, { method, body, retry: false }); }
    if (r.status === 429) { backoffUntil = Date.now() + (+r.headers.get('retry-after') || 3) * 1000; throw Object.assign(new Error('Spotify bremst gerade. Gleich nochmal.'), { status: 429 }); }
    if (r.status === 204 || r.status === 202) return null;
    const text = await r.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) {}
    if (!r.ok) throw Object.assign(new Error((j && j.error && j.error.message) || r.statusText), { status: r.status, reason: j && j.error && j.error.reason });
    return j;
}
function explain(e) {
    if (e.reauth) { clearTok(); stopPolling(); view('connect'); return 'Bitte neu mit Spotify verbinden.'; }
    if (e.reason === 'PREMIUM_REQUIRED') return 'Für die Fernsteuerung ist Spotify Premium nötig.';
    if (e.status === 404 || e.reason === 'NO_ACTIVE_DEVICE') return 'Kein aktives Gerät. Öffne Spotify am Handy und starte kurz einen Titel.';
    if (e.status === 403 && /not registered|user may not be registered/i.test(e.message)) return 'Dein Spotify-Konto ist in der App nicht freigegeben (Dashboard → User management).';
    if (e.status === 403) return 'Spotify hat die Aktion nicht erlaubt (' + e.message + ').';
    return e.message || 'Unbekannter Fehler.';
}

// ---------- Zustand ----------
let st = null, fetchedAt = 0, devices = [], seeking = false, pollT = null, devT = 0, lastVol = 0;
let lastActive = sessionStorage.getItem('sp_last_active') || '', lastTransferAt = 0, polled = false; const names = {};
const stopPolling = () => { clearInterval(pollT); pollT = null; };
function startPolling() { if (pollT) return; poll(); loadDevices(); pollT = setInterval(() => { if (document.hidden && performance.now() - fetchedAt < 15000) return; poll(); if (!document.hidden && Date.now() - devT > 12000) loadDevices(); }, 3000); }   // im Hintergrund-Tab nur alle 15 s (Schlaf-Timer braucht den Titel)
async function poll() {
    if (document.hidden || Date.now() < backoffUntil) return;
    try {
        st = await api('/me/player?additional_types=episode'); fetchedAt = performance.now();
        const dv = st && st.device;
        if (dv && dv.id) {
            names[dv.id] = dv.name;
            // Läuft die Musik plötzlich woanders (nicht durch diese Seite), wird das gemeldet und lässt sich mit einem Klick zurückholen
            if (polled && lastActive && dv.id !== lastActive && Date.now() - lastTransferAt > 8000)
                toast('Die Wiedergabe läuft jetzt auf „' + dv.name + '“. Das wurde nicht von dieser Seite ausgelöst.', false, { label: 'Zurück auf „' + (names[lastActive] || 'vorheriges Gerät') + '“', fn: () => transferTo(lastActive === dv.id ? '' : lastActive, dv.id) });
            lastActive = dv.id; try { sessionStorage.setItem('sp_last_active', dv.id); } catch (e) {}
        }
        polled = true; render();
    } catch (e) { if (e.status !== 429) toast(explain(e), true); }
}
async function cmd(path, method = 'PUT', body) {
    try { await api(path, { method, body }); setTimeout(poll, 350); }
    catch (e) { toast(explain(e), true); if (e.status === 404) loadDevices(true); }
}
// Es wird nie geraten, auf welchem Gerät etwas startet. Pause, Weiter, Lautstärke usw. gehen ohne Geräteangabe an das aktive Gerät.
// Nur wenn gerade kein Gerät aktiv ist, wird das zuletzt aktive Gerät dieser Sitzung genommen (und nur, wenn es noch in der Liste steht).
const hasActive = () => !!(st && st.device && st.device.id);
const resumeTarget = () => (lastActive && devices.some(d => d.id === lastActive) ? lastActive : '');
function noDevice() { toast('Kein aktives Gerät. Wähle rechts ein Gerät aus, auf dem Spotify laufen soll.', true); $('devices').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
function play(payload) { return playVerified(payload); }

// ---------- Anzeige ----------
const cur = () => { const prog = st && st.progress_ms != null ? st.progress_ms : 0; return st && st.is_playing ? prog + (performance.now() - fetchedAt) : prog; };
function render() {
    const it = st && st.item, playing = !!(st && st.is_playing);
    const img = it && ((it.album && it.album.images && it.album.images[0]) || (it.images && it.images[0]));
    $('cover').style.backgroundImage = img ? 'url("' + img.url + '")' : '';
    $('cover').firstElementChild.style.display = img ? 'none' : '';
    setT($('np-title'), it ? it.name : (st ? 'Werbung oder unbekannter Inhalt' : 'Nichts wird abgespielt'));
    const art = it ? (it.artists ? it.artists.map(a => `<button onclick="openArtist('${esc(a.id || '')}')">${esc(a.name)}</button>`).join(', ') : esc((it.show && it.show.name) || '')) : ''; if ($('np-artist')._h !== art) { $('np-artist')._h = art; $('np-artist').innerHTML = art; }
    checkLike();
    setT($('np-label'), st ? (playing ? 'Läuft gerade' : 'Pausiert') : 'Zuletzt aktiv');
    setT($('np-device'), st && st.device ? 'auf ' + st.device.name : 'Kein aktives Gerät');
    $('b-play').firstElementChild.className = 'fa-solid ' + (playing ? 'fa-pause' : 'fa-play');
    $('b-shuffle').classList.toggle('on', !!(st && st.shuffle_state));
    $('b-repeat').classList.toggle('on', !!(st && st.repeat_state && st.repeat_state !== 'off'));
    $('b-repeat').firstElementChild.className = 'fa-solid fa-repeat'; $('b-repeat').title = st && st.repeat_state === 'track' ? 'Wiederholen: Titel' : st && st.repeat_state === 'context' ? 'Wiederholen: Liste' : 'Wiederholen: aus';
    const dev = st && st.device, canVol = !!(dev && dev.supports_volume !== false);
    $('vol').disabled = !dev || !canVol; $('vol-note').classList.toggle('hidden', !(dev && !canVol));
    if (dev && dev.volume_percent != null && Date.now() - lastVol > 2500) $('vol').value = dev.volume_percent;
    $('seek').disabled = !it; setT($('t-dur'), it ? mmss(it.duration_ms) : '0:00');
    document.title = (it ? (playing ? '▶ ' : '') + it.name + ' – ' : '') + 'Spotify';
    renderProgress(); renderDevices();
}
function renderProgress() {
    const it = st && st.item; if (!it || seeking) return;
    const c = Math.min(cur(), it.duration_ms); setT($('t-pos'), mmss(c)); $('seek').value = Math.round(c / it.duration_ms * 1000);
}
setInterval(() => { if (!document.hidden) renderProgress(); }, 500);
function renderDevices() {
    const icon = { Smartphone: 'fa-mobile-screen', Computer: 'fa-laptop', TV: 'fa-tv', Tablet: 'fa-tablet-screen-button' };
    const webRow = devices.some(d => d.id === web.id) ? '' : `<button data-web="1" class="row dev web"><i class="fa-solid fa-globe di"></i><span class="n"><span class="ell">Dieser Browser</span><small>${web.err ? esc(web.err) : web.loading && !web.ready ? 'Wird verbunden …' : 'Direkt hier hören (Premium)'}</small></span><small class="sw2">${web.err ? '' : 'Hier abspielen'}</small></button>`;
    $('devices').innerHTML = webRow + (devices.length ? devices.map(d => `<button data-id="${esc(d.id)}" class="row dev${d.is_active ? ' on' : ''}">
        <i class="fa-solid ${icon[d.type] || 'fa-volume-high'} di"></i>
        <span class="n"><span class="ell">${esc(d.id === web.id ? 'Dieser Browser' : d.name)}</span><small>${esc(d.type)}${d.is_active ? ' · aktiv' : ''}</small></span>
        ${d.is_active ? '<i class="fa-solid fa-circle" style="color:var(--m);font-size:8px"></i>' : '<small class="sw2">Hierher wechseln</small>'}</button>`).join('')
        : '<div class="ux-note" style="padding:10px 2px">Kein weiteres Gerät gefunden. Öffne Spotify auf deinem Handy.</div>');
}
async function loadDevices(manual) {
    devT = Date.now();
    try { const j = await api('/me/player/devices'); devices = (j && j.devices) || []; renderDevices(); if (manual) toast(devices.length ? devices.length + ' Gerät(e) gefunden' : 'Kein Gerät gefunden'); } catch (e) { if (manual) toast(explain(e), true); }
}

// ---------- Steuerung ----------
function togglePlay() {
    if (st && st.is_playing) { st.is_playing = false; st.progress_ms = cur(); fetchedAt = performance.now(); render(); return cmd('/me/player/pause'); }
    if (st) { st.is_playing = true; fetchedAt = performance.now(); render(); }
    return play();
}
const toggleShuffle = () => cmd('/me/player/shuffle?state=' + !(st && st.shuffle_state));
function cycleRepeat() { const next = { off: 'context', context: 'track', track: 'off' }[(st && st.repeat_state) || 'off']; cmd('/me/player/repeat?state=' + next); }
$('seek').addEventListener('input', () => { seeking = true; const it = st && st.item; if (it) setT($('t-pos'), mmss($('seek').value / 1000 * it.duration_ms)); });
$('seek').addEventListener('change', () => { const it = st && st.item; seeking = false; if (!it) return; const ms = Math.round($('seek').value / 1000 * it.duration_ms); st.progress_ms = ms; fetchedAt = performance.now(); cmd('/me/player/seek?position_ms=' + ms); });
let volT; $('vol').addEventListener('input', () => { lastVol = Date.now(); clearTimeout(volT); volT = setTimeout(() => cmd('/me/player/volume?volume_percent=' + $('vol').value), 250); });
$('devices').addEventListener('click', e => {
    if (e.target.closest('[data-web]')) { if (!web.err) useBrowser(); return; }
    const b = e.target.closest('[data-id]'); if (!b) return; if (st && st.device && st.device.id === b.dataset.id) return;
    transferTo(b.dataset.id, st && st.device ? st.device.id : '');
});
async function transferTo(id, backId) {
    if (!id) return;
    lastTransferAt = Date.now(); lastActive = id; try { sessionStorage.setItem('sp_last_active', id); } catch (e) {}
    const was = !!(st && st.is_playing);
    await cmd('/me/player', 'PUT', { device_ids: [id], play: was });
    setTimeout(() => loadDevices(), 700);
    if (backId && backId !== id) toast('Wiedergabe auf „' + (devices.find(d => d.id === id) || {}).name + '“ übertragen.', false, { label: 'Rückgängig', fn: () => transferTo(backId, '') });
}
document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey || e.altKey || $('v-player').classList.contains('hidden')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'n' || e.key === 'N') cmd('/me/player/next', 'POST');
    else if (e.key === 'b' || e.key === 'B') cmd('/me/player/previous', 'POST');
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const v = Math.max(0, Math.min(100, +$('vol').value + (e.key === 'ArrowUp' ? 5 : -5))); $('vol').value = v; $('vol').dispatchEvent(new Event('input')); }
});

// ---------- Im Browser abspielen (Spotify Web Playback SDK, Premium nötig) ----------
let web = { id: '', ready: false, player: null, loading: null, err: '' };
function webPlayer() {
    if (web.loading) return web.loading;
    web.loading = new Promise((ok, bad) => {
        window.onSpotifyWebPlaybackSDKReady = () => {
            const pl = new Spotify.Player({ name: 'J.Mainz Dashboard (Browser)', volume: 0.7, getOAuthToken: async cb => { try { let t = getTok(); if (Date.now() > t.exp - 60000) t = await refreshTok(t); cb(t.access); } catch (e) { cb(''); } } });
            const fail = m => { web.err = m; web.ready = false; renderDevices(); bad(new Error(m)); };
            pl.addListener('ready', ({ device_id }) => { web.id = device_id; web.ready = true; web.err = ''; names[device_id] = 'Dieser Browser'; renderDevices(); setTimeout(() => loadDevices(), 800); ok(device_id); });
            pl.addListener('not_ready', () => { web.ready = false; renderDevices(); });
            pl.addListener('initialization_error', ({ message }) => fail('Dieser Browser kann Spotify nicht direkt abspielen (' + message + ').'));
            pl.addListener('authentication_error', () => fail('Für das Hören im Browser bitte einmal neu mit Spotify verbinden.'));
            pl.addListener('account_error', () => fail('Hören im Browser geht nur mit Spotify Premium.'));
            pl.addListener('playback_error', ({ message }) => toast('Wiedergabe im Browser: ' + message, true));
            pl.addListener('player_state_changed', () => setTimeout(poll, 300));
            web.player = pl; pl.connect().then(c => { if (!c) fail('Der Browser-Player konnte nicht starten.'); });
        };
        const s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js'; s.onerror = () => { web.loading = null; bad(new Error('Der Spotify-Player konnte nicht geladen werden (Netz oder Firewall).')); }; document.head.appendChild(s);
    });
    return web.loading;
}
async function useBrowser(payload) {
    try {
        if (web.player && web.player.activateElement) web.player.activateElement();         // Browser verlangen einen Klick, bevor Ton abgespielt wird
        const id = await webPlayer(); ls.set('sp_web', '1');
        if (payload) await api('/me/player/play?device_id=' + encodeURIComponent(id), { method: 'PUT', body: payload });
        else await api('/me/player', { method: 'PUT', body: { device_ids: [id], play: true } });
        lastActive = id; lastTransferAt = Date.now(); setTimeout(poll, 600);
    } catch (e) { toast(e.message && !e.status ? e.message : explain(e), true); }
}

// ---------- Abspielen mit Kontrolle: passiert nichts, gibt es einen Hinweis und eine Lösung ----------
function chooseDevice(payload) {
    const acts = []; if (web.err === '') acts.push({ label: 'Hier im Browser abspielen', fn: () => useBrowser(payload) });
    toast('Kein aktives Gerät gefunden. Öffne Spotify am Handy oder höre hier im Browser.', true, acts[0]); $('devices').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
let playSeq = 0;
async function playVerified(payload) {
    const seq = ++playSeq;
    const target = hasActive() ? '' : resumeTarget();
    if (!hasActive() && !target) return chooseDevice(payload);
    const want = payload && (payload.uris ? payload.uris[payload.offset ? payload.offset.position || 0 : 0] : payload.context_uri);
    try { await api('/me/player/play' + (target ? '?device_id=' + encodeURIComponent(target) : ''), { method: 'PUT', body: payload }); }
    catch (e) { if (e.status === 404 || e.reason === 'NO_ACTIVE_DEVICE') return chooseDevice(payload); return toast(explain(e), true); }
    setTimeout(async () => {
        if (seq !== playSeq) return;      // inzwischen wurde etwas anderes gestartet
        await poll(); if (seq !== playSeq) return; const it = st && st.item, ctx = st && st.context && st.context.uri;
        const okNow = st && st.is_playing && (!want || (it && it.uri === want) || ctx === want || (payload && payload.uris && it && payload.uris.includes(it.uri)));
        if (!okNow) toast('„' + ((st && st.device && st.device.name) || 'Das Gerät') + '“ hat nicht reagiert. Oft schläft die Spotify-App am Handy im Hintergrund.', true, web.err === '' ? { label: 'Hier im Browser abspielen', fn: () => useBrowser(payload) } : { label: 'App öffnen', fn: () => window.open('https://open.spotify.com', '_blank', 'noopener') });
    }, 1800);
}

// ---------- Gefällt mir, Schlaf-Timer, Zur Playlist ----------
let liked = null, likedUri = '';
async function checkLike() {
    const it = st && st.item; if (!it || !it.uri) { $('b-like').classList.add('hidden'); return; }
    $('b-like').classList.remove('hidden'); if (it.uri === likedUri) return; likedUri = it.uri; liked = null;
    try { const j = await api('/me/library/contains?uris=' + encodeURIComponent(it.uri)); liked = Array.isArray(j) ? !!j[0] : null; } catch (e) { liked = null; }
    paintLike();
}
function paintLike() { const b = $('b-like'); b.classList.toggle('on', !!liked); b.setAttribute('aria-pressed', String(!!liked)); b.firstElementChild.className = (liked ? 'fa-solid' : 'fa-regular') + ' fa-heart'; b.title = liked ? 'Aus Lieblingssongs entfernen' : 'Zu Lieblingssongs hinzufügen'; }
async function toggleLike() {
    const it = st && st.item; if (!it) return; const was = !!liked; liked = !was; paintLike();
    const q = '/me/library?uris=' + encodeURIComponent(it.uri);
    try { await api(q, { method: was ? 'DELETE' : 'PUT' }); toast(was ? 'Aus Lieblingssongs entfernt' : 'Zu Lieblingssongs hinzugefügt'); libCache.tracks = null; }
    catch (e) { try { await api('/me/library', { method: was ? 'DELETE' : 'PUT', body: { uris: [it.uri] } }); toast(was ? 'Aus Lieblingssongs entfernt' : 'Zu Lieblingssongs hinzugefügt'); } catch (e2) { liked = was; paintLike(); toast(explain(e2), true); } }
}
function popMenu(anchor, items) {
    document.querySelectorAll('.menu2').forEach(m => m.remove()); const m = document.createElement('div'); m.className = 'menu2'; m.setAttribute('role', 'menu');
    m.innerHTML = items.map((x, i) => `<button data-i="${i}" role="menuitem">${esc(x[0])}</button>`).join(''); document.body.appendChild(m);
    const r = anchor.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = (r.bottom + 6 + m.offsetHeight < innerHeight ? r.bottom + 6 : Math.max(8, r.top - m.offsetHeight - 6)) + 'px';
    m.onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; m.remove(); items[+b.dataset.i][1](); };
    setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } }), 0);
}
let sleepT = 0, sleepAt = 0, sleepEnd = false;
function setSleep(min, endOfTrack) {
    clearTimeout(sleepT); sleepAt = 0; sleepEnd = !!endOfTrack;
    if (min) { sleepAt = Date.now() + min * 60000; sleepT = setTimeout(() => { cmd('/me/player/pause'); toast('Schlaf-Timer: Wiedergabe angehalten'); setSleep(0); }, min * 60000); toast('Schlaf-Timer: Pause in ' + min + ' Minuten'); }
    else if (endOfTrack) toast('Schlaf-Timer: Pause am Ende dieses Titels');
    paintSleep();
}
function paintSleep() { const on = !!(sleepAt || sleepEnd); $('b-sleep').classList.toggle('on', on); $('b-sleep').lastElementChild.textContent = sleepAt ? 'Pause in ' + Math.max(1, Math.ceil((sleepAt - Date.now()) / 60000)) + ' Min' : sleepEnd ? 'Pause nach Titel' : 'Schlaf-Timer'; }
setInterval(() => { if (sleepAt) paintSleep(); if (sleepEnd && st && st.item && st.is_playing && st.item.duration_ms - cur() < 2500) { sleepEnd = false; setTimeout(() => { cmd('/me/player/pause'); toast('Schlaf-Timer: Wiedergabe angehalten'); paintSleep(); }, Math.max(0, st.item.duration_ms - cur() - 400)); } }, 1000);
function sleepMenu(b) { popMenu(b, [['15 Minuten', () => setSleep(15)], ['30 Minuten', () => setSleep(30)], ['45 Minuten', () => setSleep(45)], ['60 Minuten', () => setSleep(60)], ['Am Ende dieses Titels', () => setSleep(0, true)], ...(sleepAt || sleepEnd ? [['Schlaf-Timer aus', () => { setSleep(0); toast('Schlaf-Timer aus'); }]] : [])]); }
async function addToPlaylistMenu(b) {
    const it = st && st.item; if (!it) return toast('Gerade läuft nichts.', true);
    try {
        const me = await getMe(), j = await api('/me/playlists?limit=50'), own = ((j && j.items) || []).filter(x => x && (x.owner && x.owner.id === me.id || x.collaborative));
        if (!own.length) return toast('Du hast noch keine eigene Playlist.', true);
        popMenu(b, own.map(pl => [pl.name, async () => { try { await api('/playlists/' + pl.id + '/items', { method: 'POST', body: { uris: [it.uri] } }); toast('„' + it.name + '“ zu „' + pl.name + '“ hinzugefügt'); } catch (e) { toast(explain(e), true); } }]));
    } catch (e) { toast(explain(e), true); }
}
let meP = null; const getMe = () => meP || (meP = api('/me').catch(e => { meP = null; throw e; }));
async function addQueue(uri, name) { try { await api('/me/player/queue?uri=' + encodeURIComponent(uri), { method: 'POST' }); toast('„' + name + '“ kommt als Nächstes dran'); if (curTab === 'queue') openTab('queue'); } catch (e) { if (e.status === 404) chooseDevice(); else toast(explain(e), true); } }

// ---------- Listen (Suche, Bibliothek, Zuletzt, Für dich, Warteschlange, Detailseiten) ----------
const thumb = im => im && im.length ? im[im.length > 1 ? im.length - 1 : 0].url : '';
const big = im => im && im.length ? im[0].url : '';
const names2 = a => (a || []).map(x => x.name).join(', ');
const KIND = { track: 'Titel', episode: 'Folge', album: 'Album', playlist: 'Playlist', artist: 'Künstler', show: 'Podcast', audiobook: 'Hörbuch', chapter: 'Kapitel' };
let rows = [], curTab = 'search', stack = [];
// Eine Zeile: Titel und Folgen werden abgespielt, alles andere öffnet eine eigene Seite. ctx/pos: aus einer Liste heraus an dieser Stelle starten
function row(x, o = {}) {
    if (!x || !x.uri) return ''; const i = rows.push({ x, o }) - 1, k = x.type, img = thumb(x.images || (x.album && x.album.images) || (x.show && x.show.images));
    const sub = o.sub || (k === 'track' ? names2(x.artists) + (o.noAlbum || !x.album ? '' : ' · ' + x.album.name) : k === 'episode' ? (x.show ? x.show.name : 'Folge') : k === 'album' ? 'Album · ' + names2(x.artists) : k === 'playlist' ? 'Playlist' + (x.owner && x.owner.display_name ? ' · ' + x.owner.display_name : '') : k === 'artist' ? 'Künstler' : k === 'show' ? 'Podcast · ' + (x.publisher || '') : k === 'audiobook' ? 'Hörbuch · ' + names2(x.authors) : KIND[k] || '');
    const playable = k === 'track' || k === 'episode' || k === 'chapter', nowOn = st && st.item && st.item.uri === x.uri;
    return `<div class="row res${nowOn ? ' now' : ''}" data-r="${i}" role="button" tabindex="0">${o.idx ? `<span class="idx">${o.idx}</span>` : ''}${img ? `<img src="${esc(img)}" alt="" class="cv${k === 'artist' ? ' rnd' : ''}" loading="lazy">` : `<span class="cv ph"><i class="fa-solid ${k === 'artist' ? 'fa-user' : k === 'show' || k === 'episode' ? 'fa-podcast' : 'fa-music'}"></i></span>`}
        <span class="n"><span class="ell">${esc(x.name)}</span><small class="ell">${esc(sub)}</small></span><span class="ract">${playable ? `<button data-q="${i}" title="Als Nächstes abspielen" aria-label="Zur Warteschlange"><i class="fa-solid fa-list-ol"></i></button>` : ''}<button class="pl2" data-p="${i}" title="Abspielen" aria-label="Abspielen"><i class="fa-solid fa-play"></i></button></span></div>`;
}
function playRow(i) {
    const { x, o } = rows[i] || {}; if (!x) return;
    if (o.ctx) return playVerified(o.ctx.startsWith('spotify:') ? { context_uri: o.ctx, offset: { uri: x.uri } } : null);
    if (o.uris) return playVerified({ uris: o.uris, offset: { position: o.uris.indexOf(x.uri) } });
    if (['track', 'episode', 'chapter'].includes(x.type)) return playVerified({ uris: [x.uri] });
    return playVerified({ context_uri: x.uri });
}
function openRow(i) { const { x } = rows[i] || {}; if (!x) return; if (['track', 'episode', 'chapter'].includes(x.type)) return playRow(i); openView({ k: x.type, id: x.id, uri: x.uri }); }
const sec = (title, arr, more) => arr.filter(Boolean).length ? `<div class="rsec"><div class="rt">${title}</div><div class="rg">${arr.join('')}</div>${more || ''}</div>` : '';
const empty = t => `<div class="ux-note" style="padding:10px 2px">${t}</div>`;
const box = id => $(id);
function showOnly(id) { ['search', 'lib', 'recent', 'top', 'queue', 'detail'].forEach(k => $('tab-' + k).classList.toggle('hidden', k !== id)); }
// Suche
const QT = [['all', 'Alles'], ['track', 'Titel'], ['artist', 'Künstler'], ['album', 'Alben'], ['playlist', 'Playlists'], ['show', 'Podcasts'], ['audiobook', 'Hörbücher']];
let qType = 'all', qOff = 0, qT;
function chips(id, list, cur, fn) { box(id).innerHTML = list.map(([k, t]) => `<button data-k="${k}" class="${k === cur ? 'on' : ''}">${t}</button>`).join(''); box(id).onclick = e => { const b = e.target.closest('[data-k]'); if (b) fn(b.dataset.k); }; }
$('q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => search(), 400); });
async function search(more) {
    const q = $('q').value.trim(); chips('q-type', QT, qType, k => { qType = k; search(); }); if (q.length < 2) { $('results').innerHTML = empty('Tippe mindestens zwei Buchstaben.'); return; }
    if (!more) { qOff = 0; rows = []; }
    try {
        const types = qType === 'all' ? 'track,artist,album,playlist,show,audiobook' : qType, lim = qType === 'all' ? 5 : 10;
        const j = await api('/search?type=' + types + '&limit=' + lim + '&offset=' + qOff + '&market=from_token&q=' + encodeURIComponent(q));
        const L = k => ((j[k + 's'] && j[k + 's'].items) || []).filter(Boolean);
        if (qType === 'all') $('results').innerHTML = (sec('Titel', L('track').map(x => row(x))) + sec('Künstler', L('artist').map(x => row(x))) + sec('Alben', L('album').map(x => row(x))) + sec('Playlists', L('playlist').map(x => row(x))) + sec('Podcasts', L('show').map(x => row(x))) + sec('Hörbücher', L('audiobook').map(x => row(x)))) || empty('Nichts gefunden.');
        else { const items = L(qType), html = items.map(x => row(x)).join(''), tot = (j[qType + 's'] || {}).total || 0; const old = more ? $('results').querySelector('.rg') : null;
            if (old) { old.insertAdjacentHTML('beforeend', html); $('results').querySelector('.moreb')?.remove(); } else $('results').innerHTML = items.length ? `<div class="rsec"><div class="rg">${html}</div></div>` : empty('Nichts gefunden.');
            qOff += items.length; if (items.length && qOff < tot && qOff < 200) $('results').insertAdjacentHTML('beforeend', '<button class="ux-btn moreb" onclick="search(true)">Mehr laden</button>'); }
    } catch (e) { toast(explain(e), true); }
}
// Bibliothek
const LT = [['playlists', 'Playlists'], ['tracks', 'Lieblingssongs'], ['albums', 'Alben'], ['artists', 'Künstler'], ['shows', 'Podcasts'], ['episodes', 'Folgen'], ['audiobooks', 'Hörbücher']];
let libType = ls.get('sp_lib') || 'playlists'; const libCache = {};
async function loadLib(k) {
    libType = k || libType; ls.set('sp_lib', libType); chips('lib-type', LT, libType, loadLib); rows = []; $('lib').innerHTML = empty('Lade …');
    try {
        const P = { playlists: ['/me/playlists?limit=50', j => j.items], tracks: ['/me/tracks?limit=50', j => j.items.map(x => x.track)], albums: ['/me/albums?limit=50', j => j.items.map(x => x.album)], artists: ['/me/following?type=artist&limit=50', j => j.artists.items], shows: ['/me/shows?limit=50', j => j.items.map(x => x.show)], episodes: ['/me/episodes?limit=50', j => j.items.map(x => x.episode)], audiobooks: ['/me/audiobooks?limit=50', j => j.items] }[libType];
        const list = (libCache[libType] || (libCache[libType] = P[1](await api(P[0])) || [])).filter(Boolean);
        const uris = libType === 'tracks' ? list.map(x => x.uri) : null;
        $('lib').innerHTML = list.length ? (uris ? '<div class="row2 lb" style="margin-bottom:10px"><button class="ux-btn pri sm"><i class="fa-solid fa-play"></i>Alle abspielen</button></div>' : '') + `<div class="rg">${list.map(x => row(x, uris ? { uris } : {})).join('')}</div>` : empty('Hier ist noch nichts.');
        if (uris) $('lib').querySelector('.lb button').onclick = () => playVerified({ uris });
    } catch (e) { libCache[libType] = null; $('lib').innerHTML = empty(explain(e)); }
}
// Zuletzt gehört
async function loadRecent() {
    rows = []; $('recent').innerHTML = empty('Lade …');
    try { const j = await api('/me/player/recently-played?limit=50'), seen = new Set(), list = ((j && j.items) || []).filter(x => x && x.track && !seen.has(x.track.uri) && seen.add(x.track.uri));
        const when = t => { const d = new Date(t), m = Math.round((Date.now() - d) / 60000); return m < 60 ? 'vor ' + Math.max(1, m) + ' Min' : m < 1440 ? 'vor ' + Math.round(m / 60) + ' Std' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); };
        $('recent').innerHTML = list.length ? `<div class="rg">${list.map(x => row(x.track, { sub: names2(x.track.artists) + ' · ' + when(x.played_at) })).join('')}</div>` : empty('Noch nichts gehört.');
    } catch (e) { $('recent').innerHTML = empty(explain(e)); }
}
// Für dich (meistgehört)
const TT = [['short_term', '4 Wochen'], ['medium_term', '6 Monate'], ['long_term', 'Seit Beginn']]; let topRange = 'short_term';
async function loadTop(k) {
    topRange = k || topRange; chips('top-type', TT, topRange, loadTop); rows = []; $('top').innerHTML = empty('Lade …');
    try { const [a, t] = await Promise.all([api('/me/top/artists?limit=12&time_range=' + topRange), api('/me/top/tracks?limit=20&time_range=' + topRange)]);
        const tr = ((t && t.items) || []).filter(Boolean), uris = tr.map(x => x.uri);
        $('top').innerHTML = (sec('Deine meistgehörten Titel', tr.map((x, i) => row(x, { idx: i + 1, uris })), tr.length ? `<button class="ux-btn pri sm moreb" id="top-all"><i class="fa-solid fa-play"></i>Alle abspielen</button>` : '') + sec('Deine Lieblingskünstler', ((a && a.items) || []).filter(Boolean).map(x => row(x)))) || empty('Dafür hast du noch nicht genug gehört.');
        const b = $('top-all'); if (b) b.onclick = () => playVerified({ uris });
    } catch (e) { $('top').innerHTML = empty(explain(e)); }
}
// Warteschlange
async function loadQueue() {
    rows = []; $('queue').innerHTML = empty('Lade …');
    try { const j = await api('/me/player/queue'), c = j && j.currently_playing, q = ((j && j.queue) || []).filter(Boolean).slice(0, 30);
        $('queue').innerHTML = (c ? sec('Läuft gerade', [row(c)]) : '') + (sec('Als Nächstes', q.map((x, i) => row(x, { idx: i + 1 }))) || (c ? empty('Danach ist nichts eingereiht.') : empty('Gerade läuft nichts.')));
    } catch (e) { $('queue').innerHTML = empty(e.status === 404 ? 'Kein aktives Gerät.' : explain(e)); }
}
// Detailseiten (Album, Playlist, Künstler, Podcast, Hörbuch)
async function openView(v) {
    if (v.k === 'queue') { openTab('queue'); return; }
    stack.push(v); showOnly('detail'); const d = $('tab-detail'); rows = []; d.innerHTML = '<button class="ux-btn sm backb" id="d-back"><i class="fa-solid fa-arrow-left"></i>Zurück</button>' + empty('Lade …'); $('d-back').onclick = back;
    const head = (img, kind, title, sub, round, extra) => `<button class="ux-btn sm backb" id="d-back"><i class="fa-solid fa-arrow-left"></i>Zurück</button><div class="dhd">${img ? `<img src="${esc(img)}" alt="" class="${round ? 'rnd' : ''}">` : '<span class="ph"><i class="fa-solid fa-music"></i></span>'}<div style="min-width:0"><div class="k">${kind}</div><h3>${esc(title)}</h3><small>${esc(sub)}</small><div class="row2"><button class="ux-btn pri sm" id="d-play"><i class="fa-solid fa-play"></i>Abspielen</button><button class="ux-btn sm" id="d-shuf"><i class="fa-solid fa-shuffle"></i>Zufällig</button>${extra || ''}</div></div></div>`;
    try {
        let html = '', ctx = v.uri, uris = null;
        if (v.k === 'album') { const a = await api('/albums/' + v.id); const tr = (a.tracks && a.tracks.items || []).filter(Boolean);
            html = head(big(a.images), 'Album', a.name, names2(a.artists) + ' · ' + (a.release_date || '').slice(0, 4) + ' · ' + tr.length + ' Titel') + `<div class="rg">${tr.map((x, i) => row(x, { idx: i + 1, ctx, noAlbum: true })).join('')}</div>`; }
        else if (v.k === 'playlist') { const pl = await api('/playlists/' + v.id); const box2 = pl.items || pl.tracks, list = ((box2 && box2.items) || []).map(x => x && (x.item || x.track)).filter(x => x && x.uri);
            html = head(big(pl.images), 'Playlist', pl.name, (pl.owner && pl.owner.display_name ? pl.owner.display_name + ' · ' : '') + (list.length ? list.length + ' Titel' : '')) + (list.length ? `<div class="rg">${list.map((x, i) => row(x, { idx: i + 1, ctx })).join('')}</div>` : empty('Spotify zeigt den Inhalt nur bei eigenen Playlists an. Abspielen geht trotzdem.')); }
        else if (v.k === 'artist') { const [a, al] = await Promise.all([api('/artists/' + v.id), api('/artists/' + v.id + '/albums?include_groups=album,single&limit=30')]);
            html = head(big(a.images), 'Künstler', a.name, (a.genres || []).slice(0, 3).join(', '), true) + sec('Alben und Singles', ((al && al.items) || []).filter(Boolean).map(x => row(x, { sub: (x.album_type === 'single' ? 'Single' : 'Album') + ' · ' + (x.release_date || '').slice(0, 4) }))); }
        else if (v.k === 'show') { const [sh, ep] = await Promise.all([api('/shows/' + v.id), api('/shows/' + v.id + '/episodes?limit=30')]);
            html = head(big(sh.images), 'Podcast', sh.name, sh.publisher || '') + `<div class="rg">${((ep && ep.items) || []).filter(Boolean).map(x => row(x, { sub: (x.release_date || '') + ' · ' + Math.round((x.duration_ms || 0) / 60000) + ' Min', ctx })).join('')}</div>`; }
        else if (v.k === 'audiobook') { const [ab, ch] = await Promise.all([api('/audiobooks/' + v.id), api('/audiobooks/' + v.id + '/chapters?limit=50')]);
            html = head(big(ab.images), 'Hörbuch', ab.name, names2(ab.authors)) + `<div class="rg">${((ch && ch.items) || []).filter(Boolean).map((x, i) => row(x, { idx: i + 1, sub: Math.round((x.duration_ms || 0) / 60000) + ' Min', ctx })).join('')}</div>`; }
        if (stack[stack.length - 1] !== v) return; d.innerHTML = html; $('d-back').onclick = back;
        $('d-play').onclick = () => playVerified({ context_uri: ctx });
        $('d-shuf').onclick = async () => { try { await api('/me/player/shuffle?state=true', { method: 'PUT' }); } catch (e) {} playVerified({ context_uri: ctx }); };
    } catch (e) { d.innerHTML = '<button class="ux-btn sm backb" id="d-back"><i class="fa-solid fa-arrow-left"></i>Zurück</button>' + empty(explain(e)); $('d-back').onclick = back; }
}
function back() { stack.pop(); const v = stack.pop(); if (v) openView(v); else openTab(curTab); }
function openTab(t) {
    curTab = t; stack = []; document.querySelectorAll('#sp-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); showOnly(t);
    if (t === 'search') search(); else if (t === 'lib') loadLib(); else if (t === 'recent') loadRecent(); else if (t === 'top') loadTop(); else if (t === 'queue') loadQueue();
}
$('sp-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) openTab(b.dataset.tab); });
document.querySelector('#v-player > .ux-card:last-child, #v-player .ux-card[style*="min-width"]').addEventListener('click', e => {
    const q = e.target.closest('[data-q]'); if (q) { e.stopPropagation(); const r = rows[+q.dataset.q]; return r && addQueue(r.x.uri, r.x.name); }
    const p = e.target.closest('[data-p]'); if (p) { e.stopPropagation(); return playRow(+p.dataset.p); }
    const r = e.target.closest('[data-r]'); if (r) openRow(+r.dataset.r);
});
document.addEventListener('keydown', e => { const r = e.target.closest && e.target.closest('[data-r]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openRow(+r.dataset.r); } });
function openArtist(id) { if (!id) return; openView({ k: 'artist', id, uri: 'spotify:artist:' + id }); }

// ---------- Start ----------
initAuthGuard(async user => {
    if (!user) return;
    renderDrawer(); $('redir').value = REDIRECT; $('keep').checked = ls.get('sp_persist') === '1';
    const params = new URLSearchParams(location.search), code = params.get('code'), err = params.get('error');
    if (code || err) history.replaceState(null, '', '/spotify.html');
    if (!getClientId()) return showSetup();
    if (err) { view('connect'); $('cb-error').textContent = err === 'access_denied' ? 'Die Verbindung wurde bei Spotify nicht bestätigt.' : 'Spotify meldet: ' + err; $('cb-error').classList.remove('hidden'); return; }
    if (code) {
        try { await finishLogin(code, params.get('state')); logSystemEvent('data', 'Spotify verbunden'); }
        catch (e) { view('connect'); $('cb-error').textContent = e.message; $('cb-error').classList.remove('hidden'); return; }
    }
    if (!getTok()) return view('connect');
    view('player'); startPolling(); openTab('search');
    const sc = (getTok() || {}).scope; if (sc !== undefined && NEED.some(x => !(' ' + sc + ' ').includes(' ' + x + ' '))) $('scope-note').classList.remove('hidden');
    if (ls.get('sp_web') === '1') webPlayer().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden && getTok()) poll(); });
}, { perm: 'spotify' });
