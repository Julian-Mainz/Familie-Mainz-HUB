// js/gamesave.js – Spielstände im Konto: auf jedem Gerät weiterspielen.
// Die Spiele speichern wie bisher im Browser (localStorage). Dieses Skript gleicht diesen Stand mit dem Konto ab (Firestore: gamesaves/<uid>).
// Ohne Anmeldung, ohne Netz oder ohne das Recht "Web-Apps" läuft alles wie vorher nur auf dem Gerät.
//
// Nutzung im Spiel:   GameSave.ready(['keks-fabrik-v1']).then(start)   (wartet höchstens ein paar Sekunden auf das Konto)
// Zustand anzeigen:   GameSave.onStatus(s => ...)   s = 'local' | 'sync' | 'saved' | 'offline' | 'error'
(function () {
    'use strict';
    const GAMES = { 'ballon-alarm-v1': 'ballon', 'keks-fabrik-v1': 'keks', 'buero-imperium-v1': 'buero', 'sternenkolonie-v1': 'kolonie', 'gc-meta': 'gc' };
    const MAX = 200000, WAIT_MS = 3500, UPLOAD_EVERY = 15000;
    const CFG = { apiKey: 'AIzaSyCfKWWHQ17-ujYGJcHw6efFBESArA8uY0Q', authDomain: 'familie-mainz-netzwerk.firebaseapp.com', projectId: 'familie-mainz-netzwerk', storageBucket: 'familie-mainz-netzwerk.firebasestorage.app', messagingSenderId: '361922663455', appId: '1:361922663455:web:ed3eb8d34103ce89be312a' };
    const LS = window.localStorage, rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
    const meta = k => { try { return JSON.parse(LS.getItem('gs-meta:' + k) || '{}'); } catch (e) { return {}; } };
    const setMeta = (k, m) => { try { rawSet.call(LS, 'gs-meta:' + k, JSON.stringify(m)); } catch (e) {} };
    let frozen = false, autoReload = false;
    let watched = [], ref = null, user = null, status = 'local', listeners = [], timer = null, cloud = {}, readyP = null, blockedUntil = 0;
    const setStatus = s => { status = s; listeners.forEach(f => { try { f(s, user); } catch (e) {} }); };

    // Jede Speicherung eines Spiels wird als "geändert" markiert (Zeitpunkt auf diesem Gerät)
    Storage.prototype.setItem = function (k, v) { if (frozen && this === LS && watched.includes(k)) return; rawSet.call(this, k, v); if (this === LS && GAMES[k] && watched.includes(k)) { const m = meta(k); m.dirty = true; m.ms = Date.now(); setMeta(k, m); schedule(); } };
    Storage.prototype.removeItem = function (k) { if (frozen && this === LS && watched.includes(k)) return; rawRemove.call(this, k); if (this === LS && GAMES[k] && watched.includes(k)) { setMeta(k, { dirty: true, ms: Date.now(), removed: true }); schedule(); } };

    function loadScript(src) { return new Promise((ok, bad) => { if ([...document.scripts].some(s => s.src.endsWith(src))) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
    async function firebaseReady() {
        if (!window.firebase || !firebase.firestore) {
            await loadScript('/js/vendor/firebase-app-compat.js'); await loadScript('/js/vendor/firebase-auth-compat.js'); await loadScript('/js/vendor/firebase-firestore-compat.js');
        }
        if (!firebase.apps.length) firebase.initializeApp(CFG);
        return new Promise(ok => { const off = firebase.auth().onAuthStateChanged(u => { off(); ok(u); }); });
    }
    const field = k => GAMES[k];
    // Zeitpunkt eines Spielstands, der schon vor dieser Funktion auf dem Gerät lag (die Spiele merken sich, wann sie zuletzt gespeichert haben)
    const savedAt = v => { try { const o = JSON.parse(v); return +(o && (o.lastSave || (o.meta && o.meta.last))) || 0; } catch (e) { return 0; } };
    // Stand im Konto mit dem Gerät abgleichen. Gewinnt der neuere Stand (Zeitpunkt der letzten Änderung).
    function merge(k) {
        const c = cloud[field(k)], m = meta(k), local = LS.getItem(k);
        if (!c || typeof c.data !== 'string') return local != null || m.removed ? 'up' : null;
        const cms = +c.ms || 0;
        if (local == null && !m.dirty) { rawSet.call(LS, k, c.data); setMeta(k, { ms: cms, syncedMs: cms }); return 'down'; }
        if (cms === (m.syncedMs || -1) && !m.dirty) return null;          // nichts Neues
        if (cms > (m.ms || savedAt(local))) { if (c.data === '') rawRemove.call(LS, k); else rawSet.call(LS, k, c.data); setMeta(k, { ms: cms, syncedMs: cms }); return 'down'; }
        if (!m.ms) { setMeta(k, { dirty: true, ms: savedAt(local) || Date.now() }); return 'up'; }     // erster Abgleich: der Stand dieses Geräts ist neuer
        return m.dirty ? 'up' : null;
    }
    function schedule() { if (!ref) return; clearTimeout(timer); timer = setTimeout(upload, UPLOAD_EVERY); }
    const blockedF = {};          // einzelne Spiele, die das Konto (noch) nicht annimmt, z. B. ein neues Spiel vor dem Regel-Update
    async function upload() {
        clearTimeout(timer); if (!ref || Date.now() < blockedUntil) return;
        const out = {}, done = [];
        watched.forEach(k => { const m = meta(k); if (!m.dirty) return; if ((blockedF[field(k)] || 0) > Date.now()) return; const v = LS.getItem(k); if (v != null && v.length > MAX) return; out[field(k)] = { data: v == null ? '' : v, ms: m.ms || Date.now(), at: firebase.firestore.FieldValue.serverTimestamp() }; done.push([k, m.ms]); });
        if (!done.length) return;
        setStatus('sync');
        const ok = list => list.forEach(([k, ms]) => { const m = meta(k); if (m.ms === ms) setMeta(k, { ms, syncedMs: ms }); cloud[field(k)] = out[field(k)]; });
        try { await ref.set(out, { merge: true }); ok(done); setStatus('saved'); }
        catch (e) {
            if (e && e.code === 'permission-denied' && done.length > 1) {      // ein abgelehntes Spiel soll die anderen nicht blockieren: einzeln versuchen
                let good = 0;
                for (const d of done) { const f = field(d[0]); try { await ref.set({ [f]: out[f] }, { merge: true }); ok([d]); good++; } catch (e2) { if (e2 && e2.code === 'permission-denied') blockedF[f] = Date.now() + 600000; } }
                if (good) return setStatus('saved');
                blockedUntil = Date.now() + 600000; return setStatus('error');
            }
            setStatus(navigator.onLine === false ? 'offline' : 'error');
            if (e && e.code === 'permission-denied') { if (done.length === 1) blockedF[field(done[0][0])] = Date.now() + 600000; else blockedUntil = Date.now() + 600000; } else schedule();
        }
    }
    async function pull() {
        if (!ref) return [];
        const snap = await ref.get(); cloud = snap.exists ? snap.data() : {};
        const changed = []; watched.forEach(k => { const r = merge(k); if (r === 'down') changed.push(k); if (r === 'up') { const m = meta(k); m.dirty = true; setMeta(k, m); } });
        upload(); return changed;
    }

    window.GameSave = {
        // Vor dem Start des Spiels aufrufen. Gibt die Schlüssel zurück, die aus dem Konto übernommen wurden.
        ready(keys, opts) {
            if (opts && opts.reloadOnRemote) autoReload = true;
            if (opts && opts.badge && !document.getElementById('gs-badge')) {         // kleines Zeichen unten links: wo der Spielstand liegt
                const b = document.createElement('div'); b.id = 'gs-badge'; b.setAttribute('role', 'status');
                b.style.cssText = 'position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:90;font:600 11.5px system-ui,sans-serif;padding:5px 10px;border-radius:99px;background:rgba(15,23,42,.85);border:1px solid rgba(148,163,184,.25);color:#cbd5e1;pointer-events:none';
                document.body.appendChild(b);
                const T = { local: ['Nur auf diesem Gerät', '#94a3b8'], sync: ['Wird gespeichert …', '#7dd3fc'], saved: ['Im Konto gespeichert', '#86efac'], offline: ['Offline, nur auf diesem Gerät', '#fcd34d'], error: ['Speichern im Konto fehlgeschlagen', '#fca5a5'] };
                listeners.push(st => { const t = T[st] || T.local; b.textContent = '☁ ' + t[0]; b.style.color = t[1]; });
            }
            watched = [...new Set([...watched, ...keys.filter(k => GAMES[k])])];
            if (readyP) return readyP.then(() => pull().catch(() => []));
            const work = (async () => {
                try {
                    user = await firebaseReady(); if (!user) { setStatus('local'); return []; }
                    ref = firebase.firestore().collection('gamesaves').doc(user.uid); setStatus('sync');
                    const ch = await pull(); setStatus('saved'); return ch;
                } catch (e) { ref = null; setStatus(e && e.code === 'permission-denied' ? 'local' : 'offline'); return []; }
            })();
            readyP = work;
            return Promise.race([work, new Promise(ok => setTimeout(() => ok([]), WAIT_MS))]);
        },
        // Liefert true, wenn auf einem anderen Gerät inzwischen weitergespielt wurde (dann sollte die Seite den Stand neu laden)
        async check() { if (!ref) return []; const before = watched.map(k => LS.getItem(k)); const ch = await pull().catch(() => []); return ch.filter(k => before[watched.indexOf(k)] !== LS.getItem(k)); },
        flush: upload,
        async remove(k) { rawRemove.call(LS, k); setMeta(k, { dirty: false, ms: Date.now(), syncedMs: Date.now() }); if (ref) { try { await ref.set({ [field(k)]: firebase.firestore.FieldValue.delete() }, { merge: true }); } catch (e) {} } },
        onStatus(f) { listeners.push(f); f(status, user); },
        get user() { return user; }, get status() { return status; }
    };
    // Beim Verlassen oder Wechseln des Tabs sofort hochladen, beim Zurückkommen auf neuere Stände prüfen
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden) return upload();
        if (!autoReload || !ref) return;
        const ch = await window.GameSave.check();
        if (ch.length) { frozen = true; location.reload(); }      // auf einem anderen Gerät wurde weitergespielt: neu laden, ohne den alten Stand aus dem Speicher darüberzuschreiben
    });
    window.addEventListener('pagehide', () => upload());
})();
