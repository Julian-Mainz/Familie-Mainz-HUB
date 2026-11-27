// OS/app-changelog.js – Changelog als eigene OS-App (liest CHANGELOG.md wie die Dashboard-Seite)
(function () {
    'use strict';
    const { esc } = OAK;
    const AREAS = [['Finanzen', /finanz|rechnung|buchung|lohn/i, '#facc15', 'fa-coins'], ['Zeiterfassung', /zeit|stempel|überstunden|urlaub/i, '#34d399', 'fa-business-time'],
        ['OS', /\bos\b|desktop|fenster|explorer|writer|tabellen|präsentation|office/i, '#8b5cf6', 'fa-desktop'], ['Spiele', /spiel|kolonie|game|ballon|keks|büro|buero/i, '#a78bfa', 'fa-gamepad'],
        ['Kalender', /kalender|termin|wand/i, '#22d3ee', 'fa-calendar-days'], ['Dokumente', /dokument|datei/i, '#38bdf8', 'fa-folder-open'], ['Messenger', /messenger|chat|nachricht/i, '#f472b6', 'fa-comments'],
        ['Optik', /optik|design|hintergrund|anpassen|layout|startseite|texte/i, '#fb923c', 'fa-palette'], ['Sicherheit', /firestore|regel|sicher|datenschutz|login|anmeld/i, '#c084fc', 'fa-shield-halved'], ['Sonstiges', /./, '#94a3b8', 'fa-wand-magic-sparkles']];
    const ADMIN = /^(geänderte dateien|firestore-regeln)/i;
    const dIso = s => { const m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
    function parse(md) {
        const out = []; let day = null;
        for (const raw of md.split(/\r?\n/)) {
            const l = raw.trimEnd(); if (/^## /.test(l)) { day = { title: l.slice(3).trim(), iso: dIso(l), head: '', text: [], items: [], meta: [] }; out.push(day); continue; }
            if (!day || !l.trim()) continue;
            if (/^### /.test(l)) { const h = l.slice(4).trim(); if (!day.head) day.head = h; else day.items.push('**' + h + '**'); continue; }      // Überschrift des Eintrags
            if (/^\s*[-*] /.test(l)) { const x = l.replace(/^\s*[-*] /, ''); if (ADMIN.test(x)) day.meta.push(x); else day.items.push(x); } else if (day.items.length && /^\s{2,}/.test(raw)) day.items[day.items.length - 1] += ' ' + l.trim();
            else if (ADMIN.test(l.trim())) day.meta.push(l.trim()); else if (!day.head) day.head = l.trim(); else day.text.push(l.trim());
        }
        return out;
    }
    const inline = (s, q) => { let h = esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>'); if (q) { const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'); h = h.replace(/(^|>)([^<]+)/g, (m, a, b) => a + b.replace(re, '<mark>$1</mark>')); } return h; };
    let U = null;
    function ui(body) {
        const admin = typeof isAdmin === 'function' && isAdmin(U); let days = [], area = '', seen = ''; try { seen = localStorage.getItem('cl_seen') || ''; } catch (x) {}
        body.innerHTML = `<div class="oa oa-cl" style="--m:#a78bfa;--mr:167,139,250"><div class="oa-h"><span class="oa-ico"><i class="fa-solid fa-clock-rotate-left"></i></span><div><h2>Changelog</h2><small class="cl-sub">Was ist neu</small></div><span class="oa-sp"></span><input class="oa-in" type="search" placeholder="Suchen, z. B. Messenger" aria-label="Changelog durchsuchen" style="width:240px"></div>
            <div class="oa-cols"><aside class="cl-nav"></aside><div class="oa-b"><div class="oa-chips cl-chips"></div><div class="cl-list"><p class="oa-empty"><i class="fa-solid fa-spinner fa-spin"></i>Lade Änderungen …</p></div></div></div></div>`;
        const $ = s => body.querySelector(s), areaOf = d => (d.head && AREAS.slice(0, -1).find(a => a[1].test(d.head))) || AREAS.find(a => a[1].test(d.head + ' ' + d.items.slice(0, 2).join(' ')));
        function render() {
            const q = $('.oa-h input').value.trim(), ql = q.toLowerCase();
            const vis = days.filter(d => (!area || areaOf(d)[0] === area) && (!ql || [d.title, d.head, ...d.text, ...d.items].join(' ').toLowerCase().includes(ql)));
            $('.cl-chips').innerHTML = ['', ...new Set(days.map(d => areaOf(d)[0]))].map(a => `<button type="button" class="oa-chip${a === area ? ' on' : ''}" data-a="${esc(a)}">${a || 'Alle'}</button>`).join('');
            $('.cl-nav').innerHTML = vis.map((d, i) => `<button type="button" class="oa-row cl-nl${seen && d.iso > seen ? ' new' : ''}" data-i="${i}"><span>${esc(d.title)}<small>${esc(areaOf(d)[0])}</small></span></button>`).join('') || '<p class="oa-empty">Nichts gefunden.</p>';
            $('.cl-list').innerHTML = vis.map((d, i) => { const a = areaOf(d), wd = d.iso ? new Date(d.iso + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long' }) : '';
                return `<section class="oa-card cl-sec" id="cl${i}" style="--c:${a[2]}"><div class="cl-ic"><i class="fa-solid ${a[3]}"></i></div><div class="cl-b"><div class="cl-dt">${esc(d.title)} · ${wd}${seen && d.iso > seen ? ' <span class="oa-tag">neu für dich</span>' : ''}</div>
                    ${d.head ? `<h3>${inline(d.head, q)}</h3>` : ''}${d.text.map(t => `<p>${inline(t, q)}</p>`).join('')}${d.items.length ? `<ul>${d.items.map(x => `<li>${inline(x, q)}</li>`).join('')}</ul>` : ''}
                    ${admin && d.meta.length ? `<div class="cl-meta">${d.meta.map(m => `<p>${inline(m, q)}</p>`).join('')}</div>` : ''}</div></section>`; }).join('') || '<p class="oa-empty"><i class="fa-solid fa-magnifying-glass"></i>Nichts gefunden.</p>';
        }
        body.addEventListener('click', ev => { const a = ev.target.closest('[data-a]'); if (a) { area = a.dataset.a; render(); return; } const n = ev.target.closest('[data-i]'); if (n) { const el = $('#cl' + n.dataset.i); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
        $('.oa-h input').addEventListener('input', render);
        fetch('/CHANGELOG.md?v=' + Date.now(), { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(t => {
            days = parse(t); const last = days.find(d => d.iso); if (last) { $('.cl-sub').textContent = 'Zuletzt aktualisiert am ' + last.title; try { localStorage.setItem('cl_seen', last.iso); } catch (x) {} } render();
        }).catch(x => { $('.cl-list').innerHTML = `<p class="oa-empty">Der Changelog konnte nicht geladen werden (${esc(x.message)}).</p>`; });
    }
    JMOS_LAZY.register('changelog', { ui, init(api, user) { U = user; } });
})();
