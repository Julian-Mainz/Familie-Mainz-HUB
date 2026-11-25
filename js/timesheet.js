// js/timesheet.js - Stundenzettel im Firmen-Layout: Excel-Vorlage (.xlsx) einmal hochladen und Felder zuordnen,
// danach füllt das Dashboard den Zettel für jeden Monat aus den Einträgen der Zeiterfassung aus.
// Alles läuft im Browser: .xlsx ist ein ZIP-Archiv mit XML-Dateien; gelesen und geschrieben mit den eingebauten (De-)Kompressions-Streams.
// Vorlage und Zuordnung liegen in timesheet_tpl/{uid} (nur für den Besitzer lesbar).
(function () {
    'use strict';
    const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const MAXB64 = 700000;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = id => document.getElementById(id);

    // ---------- ZIP lesen und schreiben ----------
    const u16 = (b, o) => b[o] | (b[o + 1] << 8), u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
    async function inflate(data) { return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); }
    async function deflate(data) { return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); }
    async function unzip(buf) {
        const b = new Uint8Array(buf); let e = b.length - 22; while (e >= 0 && u32(b, e) !== 0x06054b50) e--;
        if (e < 0) throw new Error('Das ist keine gültige .xlsx-Datei.');
        const n = u16(b, e + 10); let p = u32(b, e + 16); const files = new Map(), dec = new TextDecoder();
        for (let i = 0; i < n; i++) {
            if (u32(b, p) !== 0x02014b50) throw new Error('Die Excel-Datei ist beschädigt.');
            const method = u16(b, p + 10), csize = u32(b, p + 20), nlen = u16(b, p + 28), xlen = u16(b, p + 30), clen = u16(b, p + 32), off = u32(b, p + 42);
            const name = dec.decode(b.subarray(p + 46, p + 46 + nlen)), lo = off + 30 + u16(b, off + 26) + u16(b, off + 28), raw = b.subarray(lo, lo + csize);
            if (!name.endsWith('/')) files.set(name, method === 8 ? await inflate(raw) : method === 0 ? raw.slice() : (() => { throw new Error('Nicht unterstützte Komprimierung in der Excel-Datei.'); })());
            p += 46 + nlen + xlen + clen;
        }
        return files;
    }
    const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    const crc32 = d => { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    async function zip(files) {
        const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
        const le = (n, size) => { const a = new Uint8Array(size); for (let i = 0; i < size; i++) a[i] = (n >>> (8 * i)) & 255; return a; };
        for (const [name, data] of files) {
            const nm = enc.encode(name), comp = await deflate(data), crc = crc32(data);
            const head = [le(0x04034b50, 4), le(20, 2), le(0x0800, 2), le(8, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(comp.length, 4), le(data.length, 4), le(nm.length, 2), le(0, 2), nm];
            const hl = head.reduce((a, x) => a + x.length, 0); parts.push(...head, comp);
            cen.push(le(0x02014b50, 4), le(20, 2), le(20, 2), le(0x0800, 2), le(8, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(comp.length, 4), le(data.length, 4), le(nm.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(off, 4), nm);
            off += hl + comp.length;
        }
        const cl = cen.reduce((a, x) => a + x.length, 0);
        return new Blob([...parts, ...cen, le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.size, 2), le(files.size, 2), le(cl, 4), le(off, 4), le(0, 2)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    // ---------- Excel-Inhalt verstehen ----------
    const xml = s => new DOMParser().parseFromString(s, 'application/xml');
    const txt = u => new TextDecoder().decode(u);
    const colN = s => s.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
    const colS = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    const ref = r => { const m = /^([A-Z]+)(\d+)$/.exec(r || ''); return m ? { c: colN(m[1]), r: +m[2] } : null; };
    async function openBook(buf) {
        const files = await unzip(buf);
        const wb = xml(txt(files.get('xl/workbook.xml') || new Uint8Array())), rels = xml(txt(files.get('xl/_rels/workbook.xml.rels') || new Uint8Array()));
        const sh = wb.getElementsByTagNameNS(NS, 'sheet')[0]; if (!sh) throw new Error('In der Datei wurde kein Tabellenblatt gefunden.');
        const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
        const rel = [...rels.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid);
        let path = rel ? rel.getAttribute('Target') : 'worksheets/sheet1.xml'; path = path.startsWith('/') ? path.slice(1) : 'xl/' + path.replace(/^\.\//, '');
        const shared = files.has('xl/sharedStrings.xml') ? [...xml(txt(files.get('xl/sharedStrings.xml'))).getElementsByTagNameNS(NS, 'si')].map(si => [...si.getElementsByTagNameNS(NS, 't')].map(t => t.textContent).join('')) : [];
        // Zahlenformate je Stil (für die Erkennung „Uhrzeit als 800“ und Datumsfelder)
        const st = files.has('xl/styles.xml') ? xml(txt(files.get('xl/styles.xml'))) : null, fmts = {}, xf = [];
        if (st) {
            [...st.getElementsByTagNameNS(NS, 'numFmt')].forEach(f => { fmts[f.getAttribute('numFmtId')] = f.getAttribute('formatCode'); });
            const cx = st.getElementsByTagNameNS(NS, 'cellXfs')[0]; if (cx) [...cx.getElementsByTagNameNS(NS, 'xf')].forEach(x => xf.push(x.getAttribute('numFmtId') || '0'));
        }
        return { files, path, sheetName: sh.getAttribute('name') || 'Tabelle', doc: xml(txt(files.get(path))), shared, fmtOf: s => { const id = xf[+s || 0] || '0'; return fmts[id] || ({ 14: 'dd.mm.yyyy', 20: 'h:mm', 21: 'h:mm:ss', 22: 'dd.mm.yyyy h:mm' }[id] || 'General'); } };
    }
    function cellsOf(book) {
        const out = new Map();
        for (const c of book.doc.getElementsByTagNameNS(NS, 'c')) {
            const r = c.getAttribute('r'), t = c.getAttribute('t'), v = c.getElementsByTagNameNS(NS, 'v')[0], f = c.getElementsByTagNameNS(NS, 'f')[0];
            let val = '';
            if (t === 's' && v) val = book.shared[+v.textContent] || ''; else if (t === 'inlineStr') val = [...c.getElementsByTagNameNS(NS, 't')].map(x => x.textContent).join(''); else if (v) val = v.textContent;
            out.set(r, { val, f: !!f, s: c.getAttribute('s') || '0' });
        }
        return out;
    }
    const merges = book => [...book.doc.getElementsByTagNameNS(NS, 'mergeCell')].map(m => { const [a, b] = m.getAttribute('ref').split(':').map(ref); return a && b ? { a, b } : null; }).filter(Boolean);

    // Vorschlag für die Zuordnung: Überschriften wie „Name“, „Monat“, „Beginn“, „Pause“, „Ende“ … suchen
    function guess(book) {
        const cells = cellsOf(book), mg = merges(book), map = { fields: {}, cols: {}, row1: 0 };
        const label = (re) => { for (const [r, c] of cells) if (!c.f && re.test(c.val)) return ref(r); return null; };
        const right = p => {                                // erstes Feld rechts neben einer Beschriftung (übersprungen wird, was zur Beschriftung gehört)
            const own = mg.find(m => p.r >= m.a.r && p.r <= m.b.r && p.c >= m.a.c && p.c <= m.b.c), start = own ? own.b.c + 1 : p.c + 1;
            for (let c = start; c < start + 8; c++) { const k = colS(c) + p.r, x = cells.get(k); if (x && /:\s*$/.test(x.val)) break; if ((x && x.val !== '') || mg.some(m => m.a.r === p.r && m.a.c === c)) return k; }   // an der nächsten Beschriftung aufhören
            return colS(start) + p.r;
        };
        const nm = label(/name/i), mo = label(/monat|zeitraum/i), pn = label(/pers.*n/i), fi = label(/^\s*firma/i);
        if (nm) map.fields.name = right(nm); if (mo) map.fields.month = right(mo); if (pn) map.fields.persnr = right(pn); if (fi) map.fields.company = right(fi);
        const H = { start: /^beginn|^von$|^kommen/i, pause: /^pause/i, end: /^ende|^bis$|^gehen/i, dur: /^dauer|^stunden|^summe|^ist/i, code: /^\*$|^kürzel|^abwesen/i, rec: /aufgezeichnet|erfasst/i, note: /^bemerk|^notiz|^kommentar/i, day: /tag|datum/i };
        let hr = 0;
        for (const [r, c] of cells) { if (c.f) continue; const p = ref(r); for (const k in H) if (H[k].test(c.val.trim()) && !map.cols[k]) { if (k === 'start') hr = p.r; map.cols[k] = p.c; } }
        if (hr) {                                           // erste Datenzeile: unter der Überschrift, Hinweiszeilen wie „(Uhrzeit)“ überspringen
            let r = hr + 1; while (r < hr + 4) { const vals = [...cells].filter(([k, c]) => ref(k).r === r && c.val && !c.f).map(([, c]) => c.val); if (vals.length && vals.every(v => /^\(.*\)$|^am:?$/i.test(v.trim()))) r++; else break; }
            map.row1 = r;
        }
        // Spalten, die in der Datenzeile eine Formel haben (z. B. Dauer), nicht beschreiben
        if (map.row1) Object.keys(map.cols).forEach(k => { const x = cells.get(colS(map.cols[k]) + map.row1); if (x && x.f && k !== 'day') map.cols[k] = 0; });
        delete map.cols.day;
        const fmt = map.row1 && map.cols.start ? book.fmtOf((cells.get(colS(map.cols.start) + map.row1) || {}).s) : '';
        map.timeMode = /#.*\\?:|00"?:"?00/.test(fmt) && !/h/i.test(fmt) ? 'hhmm' : /h/i.test(fmt) ? 'time' : 'text';
        map.codes = { sick: 'K', vacation: 'U', holiday: 'F', flex: '' };
        map.recMode = 'created'; map.nameText = ''; map.persnrText = ''; map.companyText = '';
        return map;
    }

    // ---------- Ausfüllen ----------
    const serial = (y, m, d) => (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5;
    function setCell(doc, r, value, kind) {
        const p = ref(r); if (!p) return;
        const sd = doc.getElementsByTagNameNS(NS, 'sheetData')[0];
        let row = [...sd.getElementsByTagNameNS(NS, 'row')].find(x => +x.getAttribute('r') === p.r);
        if (!row) { row = doc.createElementNS(NS, 'row'); row.setAttribute('r', p.r); const nx = [...sd.getElementsByTagNameNS(NS, 'row')].find(x => +x.getAttribute('r') > p.r); sd.insertBefore(row, nx || null); }
        let c = [...row.getElementsByTagNameNS(NS, 'c')].find(x => x.getAttribute('r') === r);
        if (!c) { c = doc.createElementNS(NS, 'c'); c.setAttribute('r', r); const nx = [...row.getElementsByTagNameNS(NS, 'c')].find(x => (ref(x.getAttribute('r')) || { c: 0 }).c > p.c); row.insertBefore(c, nx || null); }
        while (c.firstChild) c.removeChild(c.firstChild); c.removeAttribute('t');
        if (value === '' || value === null || value === undefined) return;
        if (kind === 'n') { const v = doc.createElementNS(NS, 'v'); v.textContent = String(value); c.appendChild(v); }
        else { c.setAttribute('t', 'inlineStr'); const is = doc.createElementNS(NS, 'is'), t = doc.createElementNS(NS, 't'); t.setAttribute('xml:space', 'preserve'); t.textContent = String(value); is.appendChild(t); c.appendChild(is); }
    }
    const tmin = s => { const [h, m] = String(s || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    function timeVal(min, mode) {
        const h = Math.floor(min / 60), m = Math.round(min % 60);
        if (mode === 'hhmm') return [h * 100 + m, 'n'];
        if (mode === 'time') return [min / 1440, 'n'];
        return [`${h}:${String(m).padStart(2, '0')}`, 's'];
    }
    // Ein Monat: pro Tag Beginn (früheste Zeit), Ende (späteste), Pause (Pausen + Lücken zwischen Einträgen), Kürzel, Erfassungsdatum, Bemerkung
    function daysOf(ym, entries, opt) {
        const y = +ym.slice(0, 4), m = +ym.slice(5), last = new Date(y, m, 0).getDate(), out = [];
        for (let d = 1; d <= last; d++) {
            const key = `${ym}-${String(d).padStart(2, '0')}`, es = entries.filter(e => e.date === key), work = es.filter(e => (e.type || 'work') === 'work' && e.start && e.end).sort((a, b) => a.start.localeCompare(b.start));
            const abs = es.find(e => (e.type || 'work') !== 'work'), hol = opt.holiday(key);
            const row = { d, key };
            if (work.length) {
                const s = tmin(work[0].start), e = Math.max(...work.map(w => tmin(w.end))), net = work.reduce((a, w) => a + (+w.netMinutes || 0), 0);
                row.start = s; row.end = e; row.pause = Math.max(0, e - s - net); row.net = net;
                row.note = work.map(w => w.note).filter(Boolean).join('; ');
            }
            if (abs) row.code = opt.codes[abs.type] || ''; else if (hol && !work.length && opt.isWorkday(key)) row.code = opt.codes.holiday || '';
            if (abs && !work.length) row.net = +abs.netMinutes || 0;
            const src = work[0] || abs; if (src && opt.recMode !== 'none') { const ts = src.createdAt && src.createdAt.toDate ? src.createdAt.toDate() : null; row.rec = opt.recMode === 'created' && ts ? ts : opt.recMode === 'day' || !ts ? new Date(y, m - 1, d) : ts; }
            out.push(row);
        }
        return out;
    }
    async function fill(b64, map, ym, entries, user, opt) {
        const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const book = await openBook(buf.buffer), doc = book.doc, y = +ym.slice(0, 4), m = +ym.slice(5);
        const F = map.fields || {}, C = map.cols || {};
        if (F.name) setCell(doc, F.name, map.nameText || user.name, 's');
        if (F.month) setCell(doc, F.month, serial(y, m, 1), 'n');
        if (F.persnr && map.persnrText) setCell(doc, F.persnr, map.persnrText, 's');
        if (F.company && map.companyText) setCell(doc, F.company, map.companyText, 's');
        const rows = daysOf(ym, entries, { codes: map.codes || {}, recMode: map.recMode || 'created', holiday: opt.holiday, isWorkday: opt.isWorkday });
        for (const r of rows) {
            const rr = map.row1 + r.d - 1, put = (k, v, kind) => { if (C[k]) setCell(doc, colS(C[k]) + rr, v, kind); };
            ['start', 'end', 'pause', 'dur', 'code', 'rec', 'note'].forEach(k => put(k, '', 's'));        // Zeile erst leeren
            if (r.start !== undefined) { put('start', ...timeVal(r.start, map.timeMode)); put('end', ...timeVal(r.end, map.timeMode)); put('pause', ...timeVal(r.pause, map.timeMode)); }
            if (r.net && C.dur) put('dur', ...timeVal(r.net, map.timeMode === 'hhmm' ? 'time' : map.timeMode));
            if (r.code) put('code', r.code, 's');
            if (r.rec) put('rec', serial(r.rec.getFullYear(), r.rec.getMonth() + 1, r.rec.getDate()), 'n');
            if (r.note) put('note', r.note.slice(0, 200), 's');
        }
        // Formeln beim Öffnen neu berechnen lassen: zwischengespeicherte Ergebnisse entfernen
        for (const f of [...doc.getElementsByTagNameNS(NS, 'f')]) { const v = f.parentNode.getElementsByTagNameNS(NS, 'v')[0]; if (v) v.remove(); }
        const files = book.files, enc = new TextEncoder();
        files.set(book.path, enc.encode(new XMLSerializer().serializeToString(doc)));
        const wb = xml(txt(files.get('xl/workbook.xml'))); let cp = wb.getElementsByTagNameNS(NS, 'calcPr')[0];
        if (!cp) { cp = wb.createElementNS(NS, 'calcPr'); wb.documentElement.appendChild(cp); }
        cp.setAttribute('fullCalcOnLoad', '1'); files.set('xl/workbook.xml', enc.encode(new XMLSerializer().serializeToString(wb)));
        if (files.has('xl/calcChain.xml')) {
            files.delete('xl/calcChain.xml');
            const ct = txt(files.get('[Content_Types].xml')).replace(/<Override[^>]*calcChain[^>]*\/>/g, ''); files.set('[Content_Types].xml', enc.encode(ct));
            const rl = txt(files.get('xl/_rels/workbook.xml.rels')).replace(/<Relationship[^>]*calcChain[^>]*\/>/g, ''); files.set('xl/_rels/workbook.xml.rels', enc.encode(rl));
        }
        return zip(files);
    }

    // ---------- Oberfläche ----------
    let ctx = null, tpl = null, book = null, map = null, pick = '';
    const FIELDS = [['name', 'Name', 'f'], ['month', 'Monat (Datum)', 'f'], ['persnr', 'Personalnummer', 'f'], ['company', 'Firma', 'f'], ['start', 'Beginn', 'c'], ['pause', 'Pause', 'c'], ['end', 'Ende', 'c'], ['dur', 'Dauer (nur ohne Formel)', 'c'], ['code', 'Kürzel (Krank, Urlaub …)', 'c'], ['rec', 'Aufgezeichnet am', 'c'], ['note', 'Bemerkung', 'c']];
    const docRef = () => ctx.db.collection('timesheet_tpl').doc(ctx.user.uid);
    async function open(c) {
        ctx = c; const box = $('ts-body'); box.innerHTML = '<div class="ts-load">Wird geladen …</div>';
        try { const d = await docRef().get(); tpl = d.exists ? d.data() : null; } catch (e) { tpl = null; }
        tpl && tpl.b64 && tpl.map ? viewReady() : viewUpload();
    }
    function viewUpload(msg) {
        $('ts-body').innerHTML = `<div class="ts-up"><i class="fa-solid fa-file-excel"></i><b>Stundenzettel-Vorlage deiner Firma hochladen</b>
            <span>Eine leere Excel-Vorlage (.xlsx). Danach ordnest du einmal zu, in welche Zellen Name, Monat, Beginn, Pause, Ende usw. gehören. Ab dann füllt das Dashboard den Zettel jeden Monat automatisch aus.</span>
            <span class="ts-hint">Alte Excel-Dateien (.xls) bitte einmal in Excel öffnen und als „Excel-Arbeitsmappe (.xlsx)“ speichern.</span>
            ${msg ? `<span class="ts-err">${esc(msg)}</span>` : ''}
            <label class="ux-btn pri"><i class="fa-solid fa-upload"></i>Vorlage wählen<input type="file" id="ts-file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label></div>`;
        $('ts-file').onchange = async e => {
            const f = e.target.files[0]; if (!f) return;
            if (/\.xls$/i.test(f.name)) return viewUpload('Das ist eine alte .xls-Datei. Bitte in Excel als .xlsx speichern und erneut hochladen.');
            try {
                const buf = await f.arrayBuffer(), b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(f); });
                if (b64.length > MAXB64) return viewUpload('Die Vorlage ist zu groß (höchstens ca. 500 KB).');
                book = await openBook(buf); map = guess(book); tpl = { name: f.name, b64, map };
                viewMap();
            } catch (x) { viewUpload(x.message || 'Die Datei konnte nicht gelesen werden.'); }
        };
    }
    async function ensureBook() { if (book) return; const bin = atob(tpl.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); book = await openBook(u.buffer); }
    function where(k) { const F = map.fields, C = map.cols; return FIELDS.find(f => f[0] === k)[2] === 'f' ? (F[k] || '') : (C[k] && map.row1 ? colS(C[k]) + map.row1 : ''); }
    function viewMap() {
        const cells = cellsOf(book); let maxR = 0, maxC = 0; for (const [r, c] of cells) { if (c.val === '' && !c.f) continue; const p = ref(r); maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c); }
        maxR = Math.min(Math.max(maxR, (map.row1 || 1) + 32), 80); maxC = Math.min(Math.max(maxC, 8), 16);
        const at = {}; FIELDS.forEach(([k, n]) => { const w = where(k); if (w) at[w] = n; });
        if (map.row1) for (let d = 2; d <= 31; d++) Object.entries(map.cols).forEach(([k, c]) => { if (c) at[colS(c) + (map.row1 + d - 1)] = at[colS(c) + (map.row1 + d - 1)] || '·'; });
        let g = '<table class="ts-grid"><tr><th></th>' + Array.from({ length: maxC }, (_, i) => `<th>${colS(i + 1)}</th>`).join('') + '</tr>';
        for (let r = 1; r <= maxR; r++) {
            g += `<tr><th>${r}</th>`;
            for (let c = 1; c <= maxC; c++) { const k = colS(c) + r, x = cells.get(k), a = at[k];
                g += `<td data-cell="${k}" class="${a ? (a === '·' ? 'ts-cont' : 'ts-on') : ''}${x && x.f ? ' ts-f' : ''}" title="${k}${a && a !== '·' ? ' · ' + esc(a) : ''}">${a && a !== '·' ? `<span class="ts-tag">${esc(a)}</span>` : x ? (x.f ? 'ƒ' : esc(String(x.val).slice(0, 24))) : ''}</td>`; }
            g += '</tr>';
        }
        g += '</table>';
        const codes = map.codes || {};
        $('ts-body').innerHTML = `<p class="ux-note" style="margin:0 0 10px">Wähle links ein Feld und klicke rechts in die passende Zelle. Für Beginn, Pause, Ende usw. klickst du die Zelle des <b>1. Tages</b>, die übrigen Tage folgen darunter. Den Vorschlag habe ich schon aus den Überschriften erkannt.</p>
            <div class="ts-map"><div class="ts-fields">${FIELDS.map(([k, n]) => `<button type="button" class="ts-fb${pick === k ? ' on' : ''}" data-pick="${k}"><span>${esc(n)}</span><b>${where(k) || '–'}</b>${where(k) ? `<i class="fa-solid fa-xmark" data-clear="${k}" title="Zuordnung entfernen"></i>` : ''}</button>`).join('')}
                <label class="ux-f"><span>Uhrzeiten eintragen als</span><select id="ts-tm" class="ux-in"><option value="hhmm">Zahl wie 800 / 1645 (Excel-Format ##:##)</option><option value="time">Excel-Uhrzeit (08:00)</option><option value="text">Text „8:00“</option></select></label>
                <label class="ux-f"><span>Aufgezeichnet am</span><select id="ts-rec" class="ux-in"><option value="created">Datum der Erfassung</option><option value="day">Tag selbst</option><option value="none">leer lassen</option></select></label>
                <label class="ux-f"><span>Name im Zettel</span><input id="ts-name" class="ux-in" maxlength="80" placeholder="${esc(ctx.user.name)}" value="${esc(map.nameText || '')}"></label>
                <div class="ux-row2"><label class="ux-f"><span>Personalnummer</span><input id="ts-pn" class="ux-in" maxlength="40" value="${esc(map.persnrText || '')}"></label><label class="ux-f"><span>Firma</span><input id="ts-co" class="ux-in" maxlength="80" value="${esc(map.companyText || '')}" placeholder="leer = nicht ändern"></label></div>
                <div class="ux-f"><span>Kürzel</span><div class="ts-codes">${[['sick', 'Krank'], ['vacation', 'Urlaub'], ['holiday', 'Feiertag'], ['flex', 'Überstundenabbau']].map(([k, n]) => `<label>${n}<input class="ux-in" maxlength="6" data-code="${k}" value="${esc(codes[k] ?? '')}"></label>`).join('')}</div></div>
            </div><div class="ts-gwrap">${g}</div></div>
            <div class="ux-acts"><button type="button" class="ux-btn" data-act="back">${tpl.map && tpl.saved ? 'Zurück' : 'Andere Vorlage'}</button><div style="flex:1"></div><button type="button" class="ux-btn pri" data-act="savemap"><i class="fa-solid fa-check"></i>Zuordnung speichern</button></div>`;
        $('ts-tm').value = map.timeMode || 'hhmm'; $('ts-rec').value = map.recMode || 'created';
        const body = $('ts-body');
        body.onclick = async e => {
            const cl = e.target.closest('[data-clear]'); if (cl) { e.stopPropagation(); const k = cl.dataset.clear; if (map.fields[k] !== undefined) delete map.fields[k]; if (map.cols[k] !== undefined) map.cols[k] = 0; return keepAndRepaint(); }
            const pb = e.target.closest('[data-pick]'); if (pb) { pick = pick === pb.dataset.pick ? '' : pb.dataset.pick; return keepAndRepaint(); }
            const td = e.target.closest('[data-cell]'); if (td && pick) { const p = ref(td.dataset.cell), isF = FIELDS.find(f => f[0] === pick)[2] === 'f'; if (isF) map.fields[pick] = td.dataset.cell; else { map.cols[pick] = p.c; map.row1 = p.r; } pick = ''; return keepAndRepaint(); }
            const a = e.target.closest('[data-act]'); if (!a) return;
            if (a.dataset.act === 'back') { if (tpl.saved) viewReady(); else { book = null; viewUpload(); } }
            if (a.dataset.act === 'savemap') {
                readForm();
                if (!map.row1 || !map.cols.start || !map.cols.end) return alert('Bitte mindestens Beginn und Ende (Zelle des 1. Tages) zuordnen.');
                a.disabled = true;
                try { await docRef().set({ name: tpl.name, b64: tpl.b64, map, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); tpl.map = map; tpl.saved = true; viewReady(true); }
                catch (x) { alert('Speichern fehlgeschlagen: ' + x.message); a.disabled = false; }
            }
        };
    }
    function readForm() {
        if (!$('ts-tm')) return;
        map.timeMode = $('ts-tm').value; map.recMode = $('ts-rec').value; map.nameText = $('ts-name').value.trim(); map.persnrText = $('ts-pn').value.trim(); map.companyText = $('ts-co').value.trim();
        map.codes = {}; document.querySelectorAll('[data-code]').forEach(i => { map.codes[i.dataset.code] = i.value.trim(); });
    }
    function keepAndRepaint() { readForm(); const sc = document.querySelector('.ts-gwrap'), t = sc ? sc.scrollTop : 0, l = sc ? sc.scrollLeft : 0; viewMap(); const s2 = document.querySelector('.ts-gwrap'); if (s2) { s2.scrollTop = t; s2.scrollLeft = l; } }
    function viewReady(fresh) {
        tpl.saved = true; map = JSON.parse(JSON.stringify(tpl.map));
        const now = new Date(), opts = []; for (let i = 0; i < 13; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1), ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; opts.push(`<option value="${ym}">${d.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}</option>`); }
        $('ts-body').innerHTML = `${fresh ? '<div class="ts-ok"><i class="fa-solid fa-circle-check"></i>Vorlage gespeichert. Ab jetzt reicht ein Klick pro Monat.</div>' : ''}
            <div class="ts-ready"><span class="ts-ic"><i class="fa-solid fa-file-excel"></i></span><span><b>${esc(tpl.name || 'Vorlage')}</b><small>Beginn ${where('start') || '–'} · Pause ${where('pause') || '–'} · Ende ${where('end') || '–'}${where('code') ? ' · Kürzel ' + where('code') : ''}</small></span></div>
            <label class="ux-f"><span>Monat</span><select id="ts-month" class="ux-in">${opts.join('')}</select></label>
            <div class="ux-acts"><button type="button" class="ux-btn" data-act="remap"><i class="fa-solid fa-table-cells"></i>Felder ändern</button><button type="button" class="ux-btn" data-act="new"><i class="fa-solid fa-upload"></i>Neue Vorlage</button><button type="button" class="ux-btn" data-act="del" title="Vorlage löschen"><i class="fa-solid fa-trash-can"></i></button><div style="flex:1"></div>
                <button type="button" class="ux-btn pri" data-act="make"><i class="fa-solid fa-download"></i>Stundenzettel erstellen</button></div>`;
        $('ts-body').onclick = async e => {
            const a = e.target.closest('[data-act]'); if (!a) return;
            if (a.dataset.act === 'remap') { await ensureBook(); viewMap(); }
            if (a.dataset.act === 'new') { book = null; tpl.saved = false; viewUpload(); }
            if (a.dataset.act === 'del') { if (!(await uiConfirm('Vorlage und Zuordnung löschen?', { danger: true, ok: 'Löschen' }))) return; await docRef().delete(); tpl = null; book = null; viewUpload(); }
            if (a.dataset.act === 'make') {
                const ym = $('ts-month').value; a.disabled = true; a.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Wird erstellt …';
                try {
                    const blob = await fill(tpl.b64, tpl.map, ym, ctx.entries(), ctx.user, { holiday: ctx.holiday, isWorkday: ctx.isWorkday });
                    const base = (tpl.name || 'Stundenzettel').replace(/\.xlsx$/i, '').replace(/[_\s-]*(blanko|leer|vorlage)[_\s-]*\d*$/i, '') || 'Stundenzettel';
                    const url = URL.createObjectURL(blob), l = document.createElement('a'); l.href = url; l.download = `${base}_${ym}.xlsx`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
                    if (ctx.log) ctx.log(ym);
                } catch (x) { alert('Der Stundenzettel konnte nicht erstellt werden: ' + x.message); }
                a.disabled = false; a.innerHTML = '<i class="fa-solid fa-download"></i>Stundenzettel erstellen';
            }
        };
    }
    window.Timesheet = { open, _test: { unzip, zip, openBook, guess, fill, cellsOf, daysOf } };
})();
