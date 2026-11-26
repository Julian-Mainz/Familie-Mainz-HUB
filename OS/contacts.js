// OS/contacts.js – Kontakte (Adressbuch) für J.Mainz OS: Familie, Freunde, Ärzte, Handwerker …
// Firestore „contacts“: eigene Kontakte sieht nur man selbst; „Für die Familie sichtbar“ zeigt sie allen freigeschalteten Mitgliedern (bearbeiten kann nur, wer sie angelegt hat).
// Nutzbar in Writer: Brief an einen Kontakt, Adresse einfügen und Serienbrief (Sendungen → Empfänger → Kontakte).
(function () {
    'use strict';
    const CATS = [['Familie', 'fa-house-chimney-user', '#f472b6'], ['Freunde', 'fa-user-group', '#a78bfa'], ['Ärzte', 'fa-user-doctor', '#34d399'], ['Handwerker', 'fa-screwdriver-wrench', '#fbbf24'], ['Behörden & Ämter', 'fa-landmark', '#60a5fa'], ['Arbeit', 'fa-briefcase', '#38bdf8'], ['Sonstiges', 'fa-address-card', '#94a3b8']];
    const CAT = Object.fromEntries(CATS.map(c => [c[0], c]));
    const FIELDS = ['anrede', 'vorname', 'nachname', 'firma', 'kat', 'tel', 'mobil', 'mail', 'str', 'plz', 'ort', 'geb', 'notiz', 'shared'];
    let API, U, e, own = [], fam = [], err = '', started = false;
    const subs = new Set();
    const all = () => { const m = new Map(); [...own, ...fam].forEach(c => m.set(c.id, c)); return [...m.values()].sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'de')); };
    const nameOf = c => [c.vorname, c.nachname].filter(Boolean).join(' ') || c.firma || 'Ohne Namen';
    const sortKey = c => (c.nachname || c.vorname || c.firma || '#').trim();
    const mine = c => c.owner === U.email;
    const initials = c => { const n = [c.vorname, c.nachname].filter(Boolean); return (n.length ? n.map(x => x[0]).join('') : (c.firma || '?').slice(0, 2)).toUpperCase().slice(0, 2); };
    function salutation(c) {
        const n = c.nachname || nameOf(c);
        return c.anrede === 'Frau' ? `Sehr geehrte Frau ${n},` : c.anrede === 'Herr' ? `Sehr geehrter Herr ${n},` : c.anrede === 'Familie' ? `Liebe Familie ${n},` : c.kat === 'Familie' || c.kat === 'Freunde' ? `Hallo ${c.vorname || n},` : 'Sehr geehrte Damen und Herren,';
    }
    function addressLines(c) {
        const l1 = c.anrede === 'Familie' ? 'Familie ' + (c.nachname || nameOf(c)) : c.anrede === 'Frau' || c.anrede === 'Herr' ? [c.anrede === 'Herr' ? 'Herrn' : 'Frau', nameOf(c)].join(' ') : nameOf(c);
        return [c.firma && c.firma !== nameOf(c) ? c.firma : '', l1, c.str, [c.plz, c.ort].filter(Boolean).join(' ')].filter(Boolean);
    }
    function start() {
        if (started || !U) return; started = true;
        const map = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
        const fail = x => { err = /permission|insufficient/i.test(x && x.message || '') ? 'Die Kontakte sind noch nicht freigeschaltet (Firestore-Regeln für „contacts“ fehlen).' : 'Kontakte konnten nicht geladen werden.'; emit(); };
        db.collection('contacts').where('owner', '==', U.email).onSnapshot(s => { own = map(s); err = ''; emit(); }, fail);
        db.collection('contacts').where('shared', '==', true).onSnapshot(s => { fam = map(s); emit(); }, () => {});
    }
    const emit = () => subs.forEach(f => { try { f(); } catch (x) { console.warn(x); } });

    // ---------- Serienbrief / Writer ----------
    function records(cat) {
        start();
        const list = all().filter(c => !cat || c.kat === cat);
        const fields = ['Anrede', 'Vorname', 'Nachname', 'Firma', 'Straße', 'PLZ', 'Ort', 'Telefon', 'Mobil', 'E-Mail', 'Kategorie', 'Briefanrede', 'Adresse'];
        return { fields, rows: list.map(c => ({ Anrede: c.anrede || '', Vorname: c.vorname || '', Nachname: c.nachname || '', Firma: c.firma || '', Straße: c.str || '', PLZ: c.plz || '', Ort: c.ort || '', Telefon: c.tel || '', Mobil: c.mobil || '', 'E-Mail': c.mail || '', Kategorie: c.kat || '', Briefanrede: salutation(c), Adresse: addressLines(c).join('\n') })) };
    }

    // ---------- vCard ----------
    const vEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
    function toVcf(list) {
        return list.map(c => ['BEGIN:VCARD', 'VERSION:3.0', `N:${vEsc(c.nachname)};${vEsc(c.vorname)};;${vEsc(c.anrede === 'Frau' || c.anrede === 'Herr' ? c.anrede : '')};`, `FN:${vEsc(nameOf(c))}`, c.firma && `ORG:${vEsc(c.firma)}`, c.tel && `TEL;TYPE=HOME,VOICE:${c.tel}`, c.mobil && `TEL;TYPE=CELL:${c.mobil}`, c.mail && `EMAIL;TYPE=INTERNET:${c.mail}`,
            (c.str || c.ort) && `ADR;TYPE=HOME:;;${vEsc(c.str)};${vEsc(c.ort)};;${vEsc(c.plz)};`, c.geb && `BDAY:${c.geb}`, c.notiz && `NOTE:${vEsc(c.notiz)}`, c.kat && `CATEGORIES:${vEsc(c.kat)}`, 'END:VCARD'].filter(Boolean).join('\r\n')).join('\r\n');
    }
    function fromVcf(text) {
        const un = s => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
        const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/), out = []; let c = null;
        for (const ln of lines) {
            const i = ln.indexOf(':'); if (i < 0) continue; const head = ln.slice(0, i).toUpperCase(), val = ln.slice(i + 1), key = head.split(';')[0].replace(/^ITEM\d+\./, '');
            if (key === 'BEGIN') { c = { kat: 'Sonstiges' }; continue; } if (!c) continue;
            if (key === 'END') { if (c.vorname || c.nachname || c.firma) out.push(c); c = null; continue; }
            const parts = val.split(/(?<!\\);/).map(un);
            if (key === 'N') { c.nachname = parts[0] || ''; c.vorname = parts[1] || ''; if (/^(frau|herr)$/i.test(parts[3] || '')) c.anrede = parts[3][0].toUpperCase() + parts[3].slice(1).toLowerCase(); }
            else if (key === 'FN' && !c.vorname && !c.nachname) { const f = un(val).trim().split(/\s+/); c.nachname = f.pop() || ''; c.vorname = f.join(' '); }
            else if (key === 'ORG') c.firma = parts[0];
            else if (key === 'TEL') { if (/CELL|MOBILE/.test(head) && !c.mobil) c.mobil = val.trim(); else if (!c.tel) c.tel = val.trim(); else if (!c.mobil) c.mobil = val.trim(); }
            else if (key === 'EMAIL' && !c.mail) c.mail = val.trim();
            else if (key === 'ADR' && !c.str) { c.str = parts[2] || ''; c.ort = parts[3] || ''; c.plz = parts[5] || ''; }
            else if (key === 'BDAY') { const m = /(\d{4})-?(\d{2})-?(\d{2})/.exec(val); if (m) c.geb = `${m[1]}-${m[2]}-${m[3]}`; }
            else if (key === 'NOTE') c.notiz = un(val);
            else if (key === 'CATEGORIES') { const k = CATS.find(x => un(val).toLowerCase().includes(x[0].toLowerCase().slice(0, 5))); if (k) c.kat = k[0]; }
        }
        return out;
    }
    const clean = c => { const o = {}; FIELDS.forEach(k => { if (k === 'shared') o.shared = !!c.shared; else o[k] = String(c[k] || '').trim().slice(0, k === 'notiz' ? 2000 : 120); }); if (!CAT[o.kat]) o.kat = 'Sonstiges'; if (!/^\d{4}-\d{2}-\d{2}$/.test(o.geb)) o.geb = ''; if (!['', 'Frau', 'Herr', 'Familie'].includes(o.anrede)) o.anrede = ''; return o; };
    const saveC = (id, c) => { const d = Object.assign(clean(c), { owner: U.email, ownerName: U.name || U.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); return id ? db.collection('contacts').doc(id).set(d) : db.collection('contacts').add(Object.assign(d, { createdAt: firebase.firestore.FieldValue.serverTimestamp() })); };

    // ---------- Geburtstag ----------
    function birthday(geb) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(geb || ''); if (!m) return null;
        const t = new Date(); t.setHours(0, 0, 0, 0); let next = new Date(t.getFullYear(), +m[2] - 1, +m[3]); if (next < t) next = new Date(t.getFullYear() + 1, +m[2] - 1, +m[3]);
        const days = Math.round((next - t) / 864e5), age = next.getFullYear() - +m[1];
        return { text: new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }), days, age };
    }

    // ---------- App ----------
    function ui(body, win) {
        start();
        let cat = '', q = '', selId = (win.params && win.params.id) || null, edit = null;
        body.innerHTML = `<div class="kt">
            <aside class="kt-side"><label class="kt-q"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Kontakte suchen" aria-label="Kontakte suchen"></label>
                <button type="button" class="btn pri kt-new" data-k="new"><i class="fa-solid fa-user-plus"></i>Neuer Kontakt</button><nav class="kt-cats"></nav>
                <div class="kt-io"><button type="button" class="btn" data-k="imp" title="Kontakte aus einer vCard-Datei (.vcf) übernehmen, z. B. vom Handy"><i class="fa-solid fa-file-import"></i>Importieren</button><button type="button" class="btn" data-k="exp" title="Angezeigte Kontakte als vCard (.vcf) herunterladen"><i class="fa-solid fa-file-export"></i>Exportieren</button></div>
                <input type="file" hidden class="kt-file" accept=".vcf,text/vcard,text/x-vcard"></aside>
            <div class="kt-list" tabindex="0" aria-label="Kontaktliste"></div>
            <section class="kt-det"></section></div>`;
        const $ = s => body.querySelector(s), listEl = $('.kt-list'), det = $('.kt-det');
        const filtered = () => { const nq = q.toLowerCase(); return all().filter(c => (!cat || (cat === '*shared' ? c.shared : c.kat === cat)) && (!nq || [nameOf(c), c.firma, c.ort, c.tel, c.mobil, c.mail, c.notiz, c.kat].join(' ').toLowerCase().includes(nq))).sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'de')); };
        function drawSide() {
            const a = all(), n = k => a.filter(c => k === '' ? true : k === '*shared' ? c.shared : c.kat === k).length;
            const row = (k, ic, c, label) => `<button type="button" class="kt-cat${cat === k ? ' on' : ''}" data-cat="${e(k)}"><i class="fa-solid ${ic}" style="color:${c}"></i><span>${e(label)}</span><em>${n(k)}</em></button>`;
            $('.kt-cats').innerHTML = row('', 'fa-address-book', '#a5b4fc', 'Alle Kontakte') + CATS.map(([k, ic, c]) => row(k, ic, c, k)).join('') + '<hr>' + row('*shared', 'fa-people-roof', '#f472b6', 'Für die Familie sichtbar');
        }
        function drawList() {
            const L = filtered(); let last = '', html = '';
            if (err) html = `<p class="kt-empty"><i class="fa-solid fa-triangle-exclamation"></i>${e(err)}</p>`;
            else if (!L.length) html = `<p class="kt-empty"><i class="fa-solid fa-address-book"></i>${q || cat ? 'Keine Kontakte gefunden.' : 'Noch keine Kontakte. Lege den ersten an oder importiere eine vCard-Datei vom Handy.'}</p>`;
            L.forEach(c => { const ch = (sortKey(c)[0] || '#').toUpperCase().replace(/[ÄÖÜ]/, x => ({ Ä: 'A', Ö: 'O', Ü: 'U' }[x])); if (ch !== last) { last = ch; html += `<div class="kt-let">${e(/[A-Z]/.test(ch) ? ch : '#')}</div>`; }
                const k = CAT[c.kat] || CAT.Sonstiges, sub = [c.firma && c.firma !== nameOf(c) ? c.firma : '', c.kat, c.ort].filter(Boolean).join(' · ');
                html += `<button type="button" class="kt-row${c.id === selId ? ' on' : ''}" data-id="${e(c.id)}"><span class="kt-av" style="--c:${k[2]}">${e(initials(c))}</span><span><b>${e(nameOf(c))}</b><small>${e(sub)}</small></span>${c.shared ? '<i class="fa-solid fa-people-roof kt-sh" title="Für die Familie sichtbar"></i>' : ''}</button>`; });
            listEl.innerHTML = html;
        }
        function drawDetail() {
            if (edit) return drawForm();
            const c = all().find(x => x.id === selId);
            if (!c) { det.innerHTML = `<div class="kt-hint"><i class="fa-solid fa-address-card"></i><b>Kontakte</b><span>Wähle links einen Kontakt oder lege einen neuen an. Kontakte kannst du in Writer für Briefe und Serienbriefe nutzen.</span></div>`; return; }
            const k = CAT[c.kat] || CAT.Sonstiges, bd = birthday(c.geb), ro = !mine(c);
            const f = (ic, label, v, href) => v ? `<div class="kt-f"><i class="fa-solid ${ic}"></i><span><small>${label}</small>${href ? `<a href="${e(href)}">${e(v)}</a>` : e(v).replace(/\n/g, '<br>')}</span></div>` : '';
            det.innerHTML = `<div class="kt-head"><span class="kt-av big" style="--c:${k[2]}">${e(initials(c))}</span><div><h2>${e(nameOf(c))}</h2><span class="kt-chip" style="--c:${k[2]}"><i class="fa-solid ${k[1]}"></i>${e(c.kat || 'Sonstiges')}</span>${c.shared ? '<span class="kt-chip" style="--c:#f472b6"><i class="fa-solid fa-people-roof"></i>Für die Familie sichtbar</span>' : ''}</div></div>
                <div class="kt-acts">${c.tel || c.mobil ? `<a class="btn" href="tel:${e((c.mobil || c.tel).replace(/[^\d+]/g, ''))}"><i class="fa-solid fa-phone"></i>Anrufen</a>` : ''}${c.mail ? `<a class="btn" href="mailto:${e(c.mail)}"><i class="fa-solid fa-envelope"></i>E-Mail</a>` : ''}<button type="button" class="btn" data-k="letter"><i class="fa-solid fa-file-word"></i>Brief schreiben</button>
                    ${ro ? '' : '<button type="button" class="btn" data-k="edit"><i class="fa-solid fa-pen"></i>Bearbeiten</button>'}<button type="button" class="btn" data-k="vcf" title="Als vCard herunterladen"><i class="fa-solid fa-download"></i></button>${ro ? '' : '<button type="button" class="btn bad" data-k="del" title="Löschen"><i class="fa-solid fa-trash-can"></i></button>'}</div>
                <div class="kt-fs">${f('fa-building', 'Firma', c.firma && c.firma !== nameOf(c) ? c.firma : '')}${f('fa-phone', 'Telefon', c.tel, 'tel:' + (c.tel || '').replace(/[^\d+]/g, ''))}${f('fa-mobile-screen', 'Mobil', c.mobil, 'tel:' + (c.mobil || '').replace(/[^\d+]/g, ''))}${f('fa-envelope', 'E-Mail', c.mail, 'mailto:' + (c.mail || ''))}
                    ${f('fa-location-dot', 'Adresse', [c.str, [c.plz, c.ort].filter(Boolean).join(' ')].filter(Boolean).join('\n'))}${bd ? f('fa-cake-candles', 'Geburtstag', `${bd.text} · wird ${bd.age} ${bd.days === 0 ? '– heute! 🎉' : bd.days === 1 ? '– morgen' : `in ${bd.days} Tagen`}`) : ''}${f('fa-note-sticky', 'Notiz', c.notiz)}</div>
                ${ro ? `<p class="kt-own"><i class="fa-solid fa-circle-info"></i>Angelegt von ${e(c.ownerName || c.owner)} – nur ${e((c.ownerName || '').split(' ')[0] || 'diese Person')} kann ihn ändern.</p>` : ''}`;
        }
        function drawForm() {
            const c = edit, opt = (v, list) => list.map(x => `<option${x === v ? ' selected' : ''}>${e(x)}</option>`).join('');
            const inp = (k, label, type = 'text', ph = '') => `<label class="kt-in"><span>${label}</span><input name="${k}" type="${type}" value="${e(c[k] || '')}" placeholder="${e(ph)}" maxlength="120"${type === 'tel' ? ' inputmode="tel"' : ''}></label>`;
            det.innerHTML = `<form class="kt-form"><h2>${c.id ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</h2>
                <div class="kt-grid"><label class="kt-in"><span>Anrede</span><select name="anrede"><option value="">–</option>${opt(c.anrede, ['Frau', 'Herr', 'Familie'])}</select></label><label class="kt-in"><span>Kategorie</span><select name="kat">${opt(c.kat || 'Sonstiges', CATS.map(x => x[0]))}</select></label>
                ${inp('vorname', 'Vorname')}${inp('nachname', 'Nachname')}${inp('firma', 'Firma / Praxis', 'text', 'z. B. Praxis Dr. Weber')}${inp('geb', 'Geburtstag', 'date')}
                ${inp('tel', 'Telefon', 'tel')}${inp('mobil', 'Mobil', 'tel')}<div class="kt-wide">${inp('mail', 'E-Mail', 'email')}</div>
                <div class="kt-wide">${inp('str', 'Straße und Hausnummer')}</div>${inp('plz', 'PLZ')}${inp('ort', 'Ort')}
                <label class="kt-in kt-wide"><span>Notiz</span><textarea name="notiz" rows="3" maxlength="2000" placeholder="z. B. Sprechzeiten, Kundennummer, Ansprechpartner">${e(c.notiz || '')}</textarea></label></div>
                <label class="kt-shr"><input type="checkbox" class="tgl" name="shared"${c.shared ? ' checked' : ''}><span><b>Für die ganze Familie sichtbar</b><small>Alle freigeschalteten Familienmitglieder sehen diesen Kontakt (ändern kannst nur du).</small></span></label>
                <div class="kt-fa"><button type="button" class="btn" data-k="cancel">Abbrechen</button><button type="submit" class="btn pri"><i class="fa-solid fa-check"></i>Speichern</button></div></form>`;
            const fm = det.querySelector('form'); fm.querySelector('[name="vorname"]').focus();
            fm.addEventListener('submit', async ev => { ev.preventDefault(); const d = Object.fromEntries(new FormData(fm)); d.shared = fm.shared.checked;
                if (!d.vorname.trim() && !d.nachname.trim() && !d.firma.trim()) return uiAlert('Bitte mindestens einen Namen oder eine Firma eintragen.');
                const b = fm.querySelector('[type="submit"]'); b.disabled = true;
                try { const r = await saveC(c.id, d); if (!c.id && r && r.id) selId = r.id; edit = null; redraw(); } catch (x) { b.disabled = false; uiAlert('Speichern fehlgeschlagen: ' + (/permission/i.test(x.message) ? 'Die Firestore-Regeln für „contacts“ fehlen noch.' : x.message)); } });
        }
        const redraw = () => { drawSide(); drawList(); drawDetail(); };
        const dl = (text, name) => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'text/vcard;charset=utf-8' })), download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
        body.addEventListener('click', async ev => {
            const ct = ev.target.closest('[data-cat]'); if (ct) { cat = ct.dataset.cat; drawSide(); drawList(); return; }
            const r = ev.target.closest('[data-id]'); if (r) { if (edit && !(await uiConfirm('Änderungen verwerfen?', { ok: 'Verwerfen', danger: true }))) return; edit = null; selId = r.dataset.id; drawList(); drawDetail(); return; }
            const k = ev.target.closest('[data-k]'); if (!k) return; const c = all().find(x => x.id === selId);
            switch (k.dataset.k) {
                case 'new': edit = { kat: cat && cat !== '*shared' ? cat : 'Sonstiges', shared: cat === '*shared' || cat === 'Ärzte' || cat === 'Handwerker' }; drawDetail(); break;
                case 'edit': if (c) { edit = Object.assign({}, c); drawDetail(); } break;
                case 'cancel': edit = null; drawDetail(); break;
                case 'del': if (c && await uiConfirm(`„${nameOf(c)}“ löschen?`, { danger: true, ok: 'Löschen' })) { try { await db.collection('contacts').doc(c.id).delete(); selId = null; redraw(); } catch (x) { uiAlert(x.message); } } break;
                case 'letter': if (c) letter(c.id); break;
                case 'vcf': if (c) dl(toVcf([c]), nameOf(c).replace(/[\\/:*?"<>|]+/g, '_') + '.vcf'); break;
                case 'exp': { const L = filtered(); if (!L.length) return uiAlert('Keine Kontakte zum Exportieren.'); dl(toVcf(L), 'Kontakte.vcf'); break; }
                case 'imp': $('.kt-file').click(); break;
            }
        });
        $('.kt-file').addEventListener('change', async ev => { const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
            const list = fromVcf(await f.text()); if (!list.length) return uiAlert('In der Datei wurden keine Kontakte gefunden.');
            if (!(await uiConfirm(`${list.length} ${list.length === 1 ? 'Kontakt' : 'Kontakte'} übernehmen? Gleichnamige vorhandene Kontakte werden übersprungen.`, { ok: 'Übernehmen', title: 'Importieren' }))) return;
            const have = new Set(all().filter(mine).map(c => nameOf(c).toLowerCase())); let n = 0;
            try { for (const c of list) { if (have.has(nameOf(c).toLowerCase())) continue; await saveC(null, c); n++; } uiAlert(`${n} ${n === 1 ? 'Kontakt' : 'Kontakte'} übernommen.`); } catch (x) { uiAlert('Import abgebrochen: ' + x.message); } });
        $('.kt-q input').addEventListener('input', ev => { q = ev.target.value.trim(); drawList(); });
        listEl.addEventListener('keydown', ev => { if (!/^Arrow(Up|Down)$/.test(ev.key)) return; ev.preventDefault(); const L = filtered(), i = L.findIndex(c => c.id === selId), n = L[Math.max(0, Math.min(L.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)))]; if (n && !edit) { selId = n.id; drawList(); drawDetail(); listEl.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); } });
        const off = (fn => { subs.add(fn); return () => subs.delete(fn); })(() => { if (!win.el.isConnected) return off(); drawSide(); drawList(); if (!edit) drawDetail(); });
        win.onParams = p => { if (p && p.id) { selId = p.id; edit = null; redraw(); } };
        redraw();
    }
    // Brief an einen Kontakt in Writer
    function letter(id) { API.openApp('writer', { key: 'wr:neu' + Date.now().toString(36), params: { tpl: 'brief', to: id } }); }

    window.JMOS_CONTACTS = { all: () => (start(), all()), get: id => all().find(c => c.id === id) || null, records, salutation, addressLines, nameOf, letter, cats: () => CATS.map(c => c[0]), onChange: fn => { start(); subs.add(fn); return () => subs.delete(fn); } };
    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        apps: [{ id: 'kontakte', name: 'Kontakte', icon: 'fa-address-book', c: '#8b5cf6', native: 'kontakte', w: 1040, h: 680 }],
        ui: { kontakte: ui },
        init(api, user) { API = api; U = user; e = api.esc; setTimeout(start, 1500); },          // früh laden, damit Writer (Adresse, Serienbrief) die Kontakte sofort kennt
    });
})();
