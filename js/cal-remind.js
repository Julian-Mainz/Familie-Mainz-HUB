// js/cal-remind.js - Termin-Erinnerungen auf allen Seiten (auch im J.Mainz OS).
// Erinnert an eigene Termine, angenommene Einladungen und Termine aus gemeinsamen Kalendern, solange eine Seite des Dashboards offen ist.
// Jede Erinnerung kommt nur einmal, auch bei mehreren offenen Tabs (Merkliste im localStorage).
(function () {
    'use strict';
    if (window.__calRemind) return; window.__calRemind = true;
    const KEY = 'jm-calrem';
    let events = [], timer = 0;
    // currentUser und db sind globale let/const aus firebase-init.js (nicht an window gebunden, aber über den Namen erreichbar)
    const user = () => (typeof currentUser !== 'undefined' ? currentUser : null);
    const DB = () => (typeof db !== 'undefined' ? db : null);
    const fired = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
    const mark = k => { const f = fired(), now = Date.now(); Object.keys(f).forEach(x => { if (now - f[x] > 8 * 864e5) delete f[x]; }); f[k] = now; try { localStorage.setItem(KEY, JSON.stringify(f)); } catch (e) { } };
    const pad = n => String(n).padStart(2, '0');
    const ld = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    // Für wen erinnern: eigene Termine, Einladungen mit Zusage, gemeinsame Kalender
    function relevant(ev, u) {
        if (ev.owner === u.email) return true;
        const sh = CAL.shareOf(ev);
        if (sh === 'calendar') return (ev.members || []).includes(u.uid);
        if (sh === 'people') return CAL.rsvpOf(ev, u.uid) === 'yes';
        return false;
    }
    function when(o) {
        const d = new Date(), today = ld(d);
        if (o.date === today && !o.time) return 'heute (ganztägig)';
        const day = o.date === today ? 'heute' : o.date === CAL.addDays(today, 1) ? 'morgen' : new Date(o.date + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
        return day + (o.time ? ' um ' + CAL.timeLabel(o) + ' Uhr' : ' (ganztägig)');
    }
    function toast(title, text) {
        let box = document.getElementById('jm-rem-box');
        if (!box) {
            box = document.createElement('div'); box.id = 'jm-rem-box'; box.setAttribute('aria-live', 'polite');
            box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99990;display:flex;flex-direction:column;gap:10px;max-width:min(360px,calc(100vw - 32px))';
            document.body.appendChild(box);
        }
        const light = document.documentElement.classList.contains('hell'), el = document.createElement('div');
        el.style.cssText = `display:flex;gap:12px;align-items:flex-start;padding:14px 14px 14px 16px;border-radius:16px;font:14px/1.4 Inter,system-ui,sans-serif;box-shadow:0 20px 50px -12px rgba(0,0,0,.55);${light ? 'background:#fff;color:#0f172a;border:1px solid rgba(15,23,42,.14)' : 'background:rgba(16,22,42,.97);color:#e2e8f0;border:1px solid rgba(148,163,184,.25)'}`;
        el.innerHTML = `<span style="flex:none;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:rgba(129,140,248,.18);color:#818cf8"><i class="fa-solid fa-bell"></i></span><span style="flex:1;min-width:0"><b style="display:block"></b><span style="opacity:.8"></span></span><button type="button" aria-label="Schließen" style="border:0;background:none;color:inherit;opacity:.6;cursor:pointer;font-size:16px">✕</button>`;
        el.querySelector('b').textContent = title; el.querySelector('span > span').textContent = text;     // als Text einsetzen, nie als HTML
        el.querySelector('button').onclick = () => el.remove();
        box.appendChild(el); setTimeout(() => el.remove(), 30000);
    }
    function notify(o) {
        const title = '⏰ ' + o.title, text = when(o) + (o.ev && o.ev.location ? ' · ' + o.ev.location : '');
        if (window.JMOS) window.dispatchEvent(new CustomEvent('jm-cal-remind', { detail: { title: o.title, text } }));
        else toast(title, text);
        try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body: text, icon: '/icons/icon-192.png', tag: 'cal-' + o.key }); } catch (e) { }
    }
    function check() {
        const u = user(); if (!u || !window.CAL) return;
        const def = CAL.prefs(u).remind, now = Date.now(), today = ld(new Date()), f = fired();
        CAL.expand(events.filter(ev => relevant(ev, u)), CAL.addDays(today, -1), CAL.addDays(today, 3)).forEach(o => {
            const at = CAL.remindAt(o, def); if (at === null) return;
            const [y, mo, d] = o.date.split('-').map(Number), [hh, mm] = o.time ? o.time.split(':').map(Number) : [23, 59], start = new Date(y, mo - 1, d, hh, mm).getTime();
            const k = o.key + '@' + at;
            if (now >= at && now < start && !f[k]) { mark(k); notify(o); }
        });
    }
    function start() {
        const u = user(); if (!u || !window.CAL || !DB() || (typeof can === 'function' && !can(u, 'termine'))) return;
        CAL.subscribe(DB(), u, list => { events = list; check(); });
        clearInterval(timer); timer = setInterval(check, 20000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    }
    // Warten, bis firebase-init den Nutzer geladen hat
    let tries = 0; (function wait() { if (user() && window.CAL) return start(); if (++tries < 120) setTimeout(wait, 500); })();
})();
