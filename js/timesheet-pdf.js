// js/timesheet-pdf.js - macht aus dem ausgefüllten Stundenzettel (.xlsx) direkt eine PDF im Layout der Firmen-Vorlage.
// Liest Druckbereich, Spaltenbreiten, Zeilenhöhen, verbundene Zellen, Rahmen, Füllfarben, Schrift, Zahlenformate, Logos (Bilder)
// sowie Kopf- und Fußzeile und rechnet die Formeln aus (Rechenkern OS/sheetcore.js). Alles im Browser, ohne Server.
// Aufruf: TimesheetPDF.render(xlsxBytes, { title }) → Blob (application/pdf)
(function () {
    'use strict';
    const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', NSR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const NSX = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing', NSA = 'http://schemas.openxmlformats.org/drawingml/2006/main';
    const dec = new TextDecoder(), xml = s => new DOMParser().parseFromString(s || '<x/>', 'application/xml');
    const T = (el, n, ns = NS) => el ? [...el.getElementsByTagNameNS(ns, n)] : [];
    const kid = (el, n) => el ? [...el.children].find(c => c.localName === n) : null;
    const colN = s => s.toUpperCase().split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
    const ref = s => { const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(s || ''); return m ? { r: +m[2] - 1, c: colN(m[1]) } : null; };
    const resolve = (base, t) => { if (t.startsWith('/')) return t.slice(1); const p = base.split('/'); p.pop(); t.split('/').forEach(x => { if (x === '..') p.pop(); else if (x !== '.') p.push(x); }); return p.join('/'); };
    const relsOf = (files, path) => { const p = path.split('/'), f = p.pop(), r = files.get([...p, '_rels', f + '.rels'].join('/')), out = {}; if (r) [...xml(dec.decode(r)).getElementsByTagName('Relationship')].forEach(x => { out[x.getAttribute('Id')] = { t: resolve(path, x.getAttribute('Target')), type: x.getAttribute('Type') || '' }; }); return out; };

    // ---------- Farben ----------
    const IDX = ['000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080',
        '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF', '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF', '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
        '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696', '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333'];
    function tint(hex, t) {
        if (!t) return hex; let [r, g, b] = [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16) / 255);
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0, l = (mx + mn) / 2;
        if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
        l = t < 0 ? l * (1 + t) : l * (1 - t) + t;
        const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = x => { x = (x + 1) % 1; return x < 1 / 6 ? p + (q - p) * 6 * x : x < .5 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p; };
        return (s ? [f(h + 1 / 3), f(h), f(h - 1 / 3)] : [l, l, l]).map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    function colorOf(el, theme, def) {
        if (!el) return def; let c = null;
        const rgb = el.getAttribute('rgb'), th = el.getAttribute('theme'), ix = el.getAttribute('indexed');
        if (rgb) c = rgb.length === 8 ? rgb.slice(2) : rgb; else if (th != null) c = theme[+th]; else if (ix != null) c = +ix === 64 ? '000000' : +ix === 65 ? 'FFFFFF' : IDX[+ix];
        if (el.getAttribute('auto') === '1' && !c) return def;
        return c ? tint(c.toUpperCase(), +(el.getAttribute('tint') || 0)) : def;
    }

    // ---------- Arbeitsmappe lesen ----------
    function readBook(files) {
        const get = n => files.has(n) ? dec.decode(files.get(n)) : '';
        const wb = xml(get('xl/workbook.xml')), wrels = relsOf(files, 'xl/workbook.xml');
        // Designfarben: Excel-Reihenfolge lt1, dk1, lt2, dk2, accent1–6, hlink, folHlink
        const thPath = Object.values(wrels).find(r => /theme$/.test(r.type)), theme = [];
        if (thPath && files.has(thPath.t)) { const cs = T(xml(get(thPath.t)), 'clrScheme', NSA)[0]; if (cs) { const v = [...cs.children].map(e => { const x = e.firstElementChild; return x ? (x.getAttribute('lastClr') || x.getAttribute('val') || '000000') : '000000'; }); theme.push(v[1], v[0], v[3], v[2], ...v.slice(4)); } }
        if (!theme.length) theme.push('FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47');
        const shared = T(xml(get('xl/sharedStrings.xml')), 'si').map(si => T(si, 't').filter(t => !(t.parentElement && t.parentElement.localName === 'rPh')).map(t => t.textContent).join(''));
        const st = xml(get('xl/styles.xml')), fmts = {};
        T(st, 'numFmt').forEach(f => { fmts[f.getAttribute('numFmtId')] = f.getAttribute('formatCode'); });
        const fonts = T(T(st, 'fonts')[0], 'font').map(f => ({ b: !!kid(f, 'b') && kid(f, 'b').getAttribute('val') !== '0', i: !!kid(f, 'i') && kid(f, 'i').getAttribute('val') !== '0', u: !!kid(f, 'u'), sz: +((kid(f, 'sz') || { getAttribute: () => 11 }).getAttribute('val')) || 11, color: colorOf(kid(f, 'color'), theme, '000000') }));
        const fills = T(T(st, 'fills')[0], 'fill').map(f => { const p = kid(f, 'patternFill'); if (!p || !p.getAttribute('patternType') || p.getAttribute('patternType') === 'none') return null; return colorOf(kid(p, p.getAttribute('patternType') === 'solid' ? 'fgColor' : 'bgColor') || kid(p, 'fgColor'), theme, null); });
        const borders = T(T(st, 'borders')[0], 'border').map(b => { const o = {}; ['left', 'right', 'top', 'bottom'].forEach(n => { const e = kid(b, n), s = e && e.getAttribute('style'); if (s && s !== 'none') o[n[0]] = { s, color: colorOf(kid(e, 'color'), theme, '000000') }; }); return o; });
        const xfs = T(T(st, 'cellXfs')[0], 'xf').map(x => { const al = kid(x, 'alignment'), id = x.getAttribute('numFmtId') || '0'; return { fmt: fmts[id] || BUILTIN[id] || 'General', font: fonts[+x.getAttribute('fontId') || 0] || fonts[0], fill: fills[+x.getAttribute('fillId') || 0] || null, bd: borders[+x.getAttribute('borderId') || 0] || {}, h: al ? al.getAttribute('horizontal') || '' : '', v: al ? al.getAttribute('vertical') || 'bottom' : 'bottom', wrap: !!al && al.getAttribute('wrapText') === '1' || !!al && al.getAttribute('wrapText') === 'true', ind: al ? +(al.getAttribute('indent') || 0) : 0, shrink: !!al && (al.getAttribute('shrinkToFit') === '1' || al.getAttribute('shrinkToFit') === 'true') }; });
        const sheets = T(wb, 'sheet').map(sh => { const rid = sh.getAttributeNS(NSR, 'id') || sh.getAttribute('r:id'); return { name: sh.getAttribute('name'), path: (wrels[rid] || {}).t || 'xl/worksheets/sheet1.xml' }; });
        sheets.forEach(s => { s.doc = xml(get(s.path)); s.cells = new Map();
            for (const c of T(s.doc, 'c')) {
                const p = ref(c.getAttribute('r')); if (!p) continue; const t = c.getAttribute('t'), v = T(c, 'v')[0], f = T(c, 'f')[0], cell = { s: +(c.getAttribute('s') || 0) };
                if (f && f.textContent) cell.f = f.textContent.replace(/_xlfn\./g, '');
                if (t === 's' && v) cell.v = shared[+v.textContent] || ''; else if (t === 'inlineStr') cell.v = T(c, 't').map(x => x.textContent).join(''); else if (t === 'str' || t === 'e') cell.v = v ? v.textContent : ''; else if (t === 'b') cell.v = v ? v.textContent === '1' : false; else if (v) cell.v = +v.textContent;
                s.cells.set(p.r + ',' + p.c, cell);
            }
        });
        // shared formulas: die Folgezellen haben nur einen Verweis, die Formel steht in der ersten Zelle
        sheets.forEach(s => { const first = {}; for (const c of T(s.doc, 'c')) { const f = T(c, 'f')[0]; if (!f || f.getAttribute('t') !== 'shared') continue; const si = f.getAttribute('si'), p = ref(c.getAttribute('r')); if (f.textContent) first[si] = { f: f.textContent.replace(/_xlfn\./g, ''), p }; else if (first[si] && window.JMSHEET) { const cell = s.cells.get(p.r + ',' + p.c); try { cell.f = JMSHEET.offsetFormula(first[si].f, p.r - first[si].p.r, p.c - first[si].p.c); } catch (x) {} } } });
        return { files, wb, sheets, xfs, theme };
    }
    const BUILTIN = { 0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 14: 'dd.mm.yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'dd.mm.yyyy h:mm', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0', 49: '@' };

    // ---------- Formeln ausrechnen ----------
    function calc(book) {
        const J = window.JMSHEET, memo = new Map(), busy = new Set(), S = book.sheets;
        const idx = (n, cur) => n == null ? cur : S.findIndex(s => s.name.toLowerCase() === String(n).replace(/^'|'$/g, '').replace(/''/g, "'").toLowerCase());
        const ws = (si, r, c) => ({ cur: { r, c }, get: (n, rr, cc) => { const j = idx(n, si); return j < 0 ? { e: '#REF!' } : val(j, rr, cc); },
            range: (n, r1, c1, r2, c2) => { const j = idx(n, si); if (j < 0) return { e: '#REF!' }; r2 = Math.min(r2, r1 + 5000); c2 = Math.min(c2, c1 + 200); const out = []; for (let a = r1; a <= r2; a++) { const row = []; for (let b = c1; b <= c2; b++) row.push(val(j, a, b)); out.push(row); } return { range: true, vals: out }; } });
        function val(si, r, c) {
            const k = si + ':' + r + ',' + c; if (memo.has(k)) return memo.get(k);
            const cell = S[si].cells.get(r + ',' + c); if (!cell) return '';
            let v = cell.v === undefined ? '' : cell.v;
            if (cell.f && J) { if (busy.has(k)) return { e: '#CIRC!' }; busy.add(k); try { v = J.evaluate(J.parse(cell.f), ws(si, r, c)); } catch (x) { v = { e: '#NAME?' }; } busy.delete(k); }
            memo.set(k, v); return v;
        }
        return val;
    }

    // ---------- Zahlenformate (deutsch: Komma, Tausenderpunkt, deutsche Monats- und Tagesnamen) ----------
    const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const DAY = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const ERR = { '#DIV/0!': '#DIV/0!', '#VALUE!': '#WERT!', '#REF!': '#BEZUG!', '#N/A': '#NV', '#NUM!': '#ZAHL!', '#CIRC!': '' , '#NAME?': '' };
    function sections(code) { const out = []; let cur = '', q = false; for (let i = 0; i < code.length; i++) { const ch = code[i]; if (ch === '"') q = !q; if (ch === '\\' && !q) { cur += ch + (code[++i] || ''); continue; } if (ch === ';' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }
    function lits(sec) { return sec.replace(/\[(?!h+\]|m+\]|s+\])(\$([^\]-]*)[^\]]*|[^\]]*)\]/gi, (m, a, cur) => cur ? '"' + cur + '"' : '').replace(/_./g, ' ').replace(/\*./g, ''); }
    function fmtDate(v, sec) {
        let tot = Math.round(v * 86400); const neg = tot < 0; if (neg) tot = -tot;
        const days = Math.floor(tot / 86400), d = new Date(Date.UTC(1899, 11, 30) + days * 864e5), Y = d.getUTCFullYear(), M = d.getUTCMonth(), D = d.getUTCDate(), W = d.getUTCDay();
        const secs = tot % 86400, hh = Math.floor(secs / 3600), mi = Math.floor(secs % 3600 / 60), ss = secs % 60, ampm = /AM\/PM|A\/P/i.test(sec);
        const toks = []; let i = 0;
        while (i < sec.length) {
            const ch = sec[i], rest = sec.slice(i), low = rest.toLowerCase();
            if (ch === '"') { const j = sec.indexOf('"', i + 1); toks.push({ l: sec.slice(i + 1, j < 0 ? undefined : j) }); i = j < 0 ? sec.length : j + 1; continue; }
            if (ch === '\\') { toks.push({ l: sec[i + 1] || '' }); i += 2; continue; }
            let m = /^\[(h+|m+|s+)\]/i.exec(rest); if (m) { toks.push({ e: m[1][0].toLowerCase(), n: m[1].length }); i += m[0].length; continue; }
            m = /^(am\/pm|a\/p)/i.exec(rest); if (m) { toks.push({ l: hh < 12 ? 'AM' : 'PM' }); i += m[0].length; continue; }
            m = /^(y+|m+|d+|h+|s+)/i.exec(low); if (m) { toks.push({ k: m[1][0], n: m[1].length }); i += m[1].length; continue; }
            m = /^\.(0+)/.exec(rest); if (m) { toks.push({ l: ',' + '0'.repeat(m[1].length) }); i += m[0].length; continue; }
            toks.push({ l: ch === '/' ? '.' : ch }); i++;              // „/“ ist im Datumsformat das Trennzeichen des Landes, deutsch „.“
        }
        // „m“ nach Stunden oder vor Sekunden sind Minuten
        toks.forEach((t, j) => { if (t.k !== 'm' || t.n > 2) return; const prev = toks.slice(0, j).reverse().find(x => x.k || x.e), next = toks.slice(j + 1).find(x => x.k || x.e); if (prev && (prev.k === 'h' || prev.e === 'h') || next && (next.k === 's' || next.e === 's')) t.min = true; });
        const p2 = (x, n) => String(x).padStart(n, '0');
        const out = toks.map(t => {
            if (t.l !== undefined) return t.l;
            if (t.e === 'h') return p2(Math.floor(tot / 3600), t.n); if (t.e === 'm') return p2(Math.floor(tot / 60), t.n); if (t.e === 's') return p2(tot, t.n);
            switch (t.k) {
                case 'y': return t.n <= 2 ? p2(Y % 100, 2) : String(Y);
                case 'm': if (t.min) return p2(mi, t.n); return t.n === 1 ? String(M + 1) : t.n === 2 ? p2(M + 1, 2) : t.n === 3 ? MON[M].slice(0, 3) : t.n === 5 ? MON[M][0] : MON[M];
                case 'd': return t.n === 1 ? String(D) : t.n === 2 ? p2(D, 2) : t.n === 3 ? DAY[W].slice(0, 2) : DAY[W];
                case 'h': { const h = ampm ? (hh % 12 || 12) : hh; return t.n >= 2 ? p2(h, 2) : String(h); }
                case 's': return p2(ss, t.n >= 2 ? 2 : 1);
            }
            return '';
        }).join('');
        return (neg ? '-' : '') + out;
    }
    function fmtNumber(v, sec, signed) {
        const toks = []; let i = 0;
        while (i < sec.length) { const ch = sec[i]; if (ch === '"') { const j = sec.indexOf('"', i + 1); toks.push({ l: sec.slice(i + 1, j < 0 ? undefined : j) }); i = j < 0 ? sec.length : j + 1; continue; } if (ch === '\\') { toks.push({ l: sec[i + 1] || '' }); i += 2; continue; } toks.push('0#?.,%'.includes(ch) ? { p: ch } : { l: ch }); i++; }
        const ph = toks.map((t, j) => t.p && '0#?'.includes(t.p) ? j : -1).filter(j => j >= 0); if (!ph.length) return toks.map(t => t.l || '').join('');
        const first = ph[0], last = ph[ph.length - 1], dot = toks.findIndex((t, j) => t.p === '.' && j > first - 1 && j <= last + 1);
        if (toks.some(t => t.p === '%')) v *= 100;
        let k = last + 1; while (toks[k] && toks[k].p === ',') { v /= 1000; k++; }
        const thou = toks.some((t, j) => t.p === ',' && j > first && j < (dot < 0 ? last : dot));
        const intPh = ph.filter(j => dot < 0 || j < dot), decPh = dot < 0 ? [] : ph.filter(j => j > dot);
        const a = Math.abs(v), fixed = a.toFixed(decPh.length), [ip, dp = ''] = fixed.split('.');
        let digits = ip === '0' && intPh.every(j => toks[j].p !== '0') ? '' : ip;
        const res = toks.map(t => ({ ...t }));
        if (thou) { const minLen = intPh.filter(j => toks[j].p === '0').length; let ds = digits.padStart(minLen, '0'); ds = ds.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); intPh.forEach((j, n) => { res[j].o = n === intPh.length - 1 ? ds : ''; }); }
        else { let d = digits; for (let n = intPh.length - 1; n >= 0; n--) { const j = intPh[n], t = toks[j]; if (n === 0) res[j].o = d.length ? d : t.p === '0' ? '0' : t.p === '?' ? ' ' : ''; else if (d.length) { res[j].o = d.slice(-1); d = d.slice(0, -1); } else res[j].o = t.p === '0' ? '0' : t.p === '?' ? ' ' : ''; } }
        let trim = dp.length; while (trim > 0 && dp[trim - 1] === '0' && toks[decPh[trim - 1]].p !== '0') trim--;
        decPh.forEach((j, n) => { res[j].o = n < trim ? dp[n] : toks[j].p === '?' ? ' ' : ''; });
        const s = res.map((t, j) => t.l !== undefined ? t.l : t.o !== undefined ? t.o : t.p === '.' ? (decPh.length ? ',' : '') : t.p === '%' ? '%' : t.p === ',' ? '' : '').join('');
        return (signed && v < 0 && /[1-9]/.test(s) ? '-' : '') + s;
    }
    function gen(v) { if (Number.isInteger(v) && Math.abs(v) < 1e11) return String(v); const a = Math.abs(v); if (a !== 0 && (a < 1e-9 || a >= 1e11)) return v.toExponential(5).replace('.', ','); return String(+v.toPrecision(10)).replace('.', ','); }
    function format(v, code) {
        if (v === '' || v == null) return '';
        if (typeof v === 'object' && v.e) return ERR[v.e] !== undefined ? ERR[v.e] : v.e;
        if (typeof v === 'object') return '';
        if (typeof v === 'boolean') return v ? 'WAHR' : 'FALSCH';
        const secs = sections(code || 'General');
        if (typeof v === 'string') { const ts = secs[3] !== undefined ? secs[3] : secs.find(s => s.includes('@')); return ts === undefined ? v : lits(ts).replace(/"([^"]*)"/g, '$1').replace(/\\(.)/g, '$1').replace('@', v); }
        let sec = secs[0], signed = true;
        if (v < 0 && secs.length > 1) { sec = secs[1]; signed = false; } else if (v === 0 && secs.length > 2) { sec = secs[2]; }
        // Bedingungen wie [<=9999999] werden ignoriert (seltener Fall)
        sec = lits(sec); if (!sec.replace(/"[^"]*"/g, 'x').trim()) return sec.replace(/"([^"]*)"/g, '$1');
        if (/general|standard/i.test(sec)) return sec.replace(/general|standard/i, gen(signed ? v : Math.abs(v))).replace(/"([^"]*)"/g, '$1');
        if (/[ymdhs]/i.test(sec.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/e\+/i, ''))) return fmtDate(signed ? v : Math.abs(v), sec);
        return fmtNumber(v, sec, signed);
    }

    // ---------- Text: Breite messen (Helvetica hat dieselben Laufweiten wie Arial) ----------
    const cv = document.createElement('canvas').getContext('2d');
    const tw = (s, sz, b, i) => { cv.font = `${i ? 'italic ' : ''}${b ? 'bold ' : ''}100px Helvetica, Arial, "Liberation Sans", sans-serif`; return cv.measureText(s).width * sz / 100; };
    const W1252 = { 0x20ac: 128, 0x201a: 130, 0x192: 131, 0x201e: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x2c6: 136, 0x2030: 137, 0x160: 138, 0x2039: 139, 0x152: 140, 0x17d: 142, 0x2018: 145, 0x2019: 146, 0x201c: 147, 0x201d: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x2dc: 152, 0x2122: 153, 0x161: 154, 0x203a: 155, 0x153: 156, 0x17e: 158, 0x178: 159 };
    const pstr = s => '(' + [...s].map(ch => { let c = ch.codePointAt(0); if (W1252[c]) c = W1252[c]; else if (c > 255 || (c >= 128 && c < 160)) c = 63; if (c === 40 || c === 41 || c === 92) return '\\' + ch; return c < 32 || c > 126 ? '\\' + c.toString(8).padStart(3, '0') : ch; }).join('') + ')';
    // Zeilenumbruch wie Excel: an Leerzeichen und nach Bindestrichen, zu lange Wörter notfalls mitten im Wort
    function wrap(text, maxW, sz, b, i) {
        const rows = [];
        text.split('\n').forEach(par => { let cur = '';
            par.split(/(\s+)|(?<=-)/).filter(t => t).forEach(t => { const t2 = cur + t; if (cur && tw(t2.trimEnd(), sz, b, i) > maxW) { rows.push(cur.trimEnd()); cur = t.trimStart(); } else cur = t2;
                while (cur.length > 1 && tw(cur, sz, b, i) > maxW) { let k = cur.length - 1; while (k > 1 && tw(cur.slice(0, k), sz, b, i) > maxW) k--; rows.push(cur.slice(0, k)); cur = cur.slice(k); } });
            rows.push(cur.trimEnd()); });
        return rows;
    }
    const n2 = x => (Math.round(x * 100) / 100).toString();
    const rgbOp = (hex, op) => [0, 2, 4].map(i => n2(parseInt(hex.substr(i, 2), 16) / 255)).join(' ') + ' ' + op;

    // ---------- Seite aufbauen ----------
    async function render(bytes, opt = {}) {
        if (!window.Timesheet) throw new Error('Stundenzettel-Modul fehlt.');
        const files = await Timesheet._test.unzip(bytes instanceof Uint8Array ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes);
        const book = readBook(files), val = calc(book), sh = book.sheets[0], doc = sh.doc, X = book.xfs;
        // Druckbereich
        let area = null; const pa = T(book.wb, 'definedName').find(d => d.getAttribute('name') === '_xlnm.Print_Area' && (d.getAttribute('localSheetId') || '0') === '0');
        if (pa) { const m = /\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)/i.exec(pa.textContent.split(',')[0]); if (m) area = { r1: +m[2] - 1, c1: colN(m[1]), r2: +m[4] - 1, c2: colN(m[3]) }; }
        if (!area) { area = { r1: 1e9, c1: 1e9, r2: 0, c2: 0 }; for (const [k, c] of sh.cells) { const x = X[c.s] || {}; if (c.v === undefined && !c.f && !x.fill && !Object.keys(x.bd || {}).length) continue; const [r, cc] = k.split(',').map(Number); area.r1 = Math.min(area.r1, r); area.c1 = Math.min(area.c1, cc); area.r2 = Math.max(area.r2, r); area.c2 = Math.max(area.c2, cc); } if (area.r2 < area.r1) area = { r1: 0, c1: 0, r2: 0, c2: 0 }; }
        // Spalten und Zeilen (Punkte)
        const fp = T(doc, 'sheetFormatPr')[0], defW = fp && fp.getAttribute('defaultColWidth') ? +fp.getAttribute('defaultColWidth') : (fp && fp.getAttribute('baseColWidth') ? +fp.getAttribute('baseColWidth') : 8) + .71;
        const defH = fp && fp.getAttribute('defaultRowHeight') ? +fp.getAttribute('defaultRowHeight') : 15, zeroH = fp && /^(1|true)$/.test(fp.getAttribute('zeroHeight') || '');
        const cw = {}, rh = {};
        T(doc, 'col').forEach(c => { const hid = /^(1|true)$/.test(c.getAttribute('hidden') || ''), w = c.getAttribute('width') ? +c.getAttribute('width') : defW; for (let i = +c.getAttribute('min'); i <= Math.min(+c.getAttribute('max'), 1000); i++) cw[i - 1] = hid ? 0 : w; });
        T(doc, 'row').forEach(r => { const hid = /^(1|true)$/.test(r.getAttribute('hidden') || ''); rh[+r.getAttribute('r') - 1] = hid ? 0 : r.getAttribute('ht') ? +r.getAttribute('ht') : defH; });
        const colPt = c => { const w = cw[c] !== undefined ? cw[c] : defW; return w ? Math.trunc((256 * w + Math.trunc(128 / 7)) / 256 * 7) * .75 : 0; };
        const rowPt = r => rh[r] !== undefined ? rh[r] : zeroH ? 0 : defH;
        const cx = [0], ry = [0]; for (let c = area.c1; c <= area.c2; c++) cx.push(cx[cx.length - 1] + colPt(c)); for (let r = area.r1; r <= area.r2; r++) ry.push(ry[ry.length - 1] + rowPt(r));
        const W0 = cx[cx.length - 1], H0 = ry[ry.length - 1], xOf = c => cx[c - area.c1], yOf = r => ry[r - area.r1];
        // Seite: Größe, Ränder, Skalierung
        const ps = T(doc, 'pageSetup')[0], pm = T(doc, 'pageMargins')[0], po = T(doc, 'printOptions')[0], spr = T(doc, 'pageSetUpPr')[0];
        let PW = 595.28, PH = 841.89; if (ps && ps.getAttribute('paperSize') === '1') { PW = 612; PH = 792; }
        if (ps && ps.getAttribute('orientation') === 'landscape') [PW, PH] = [PH, PW];
        const mg = n => pm && pm.getAttribute(n) ? +pm.getAttribute(n) * 72 : ({ left: .7, right: .7, top: .75, bottom: .75, header: .3, footer: .3 })[n] * 72;
        const ML = mg('left'), MR = mg('right'), MT = mg('top'), MB = mg('bottom'), aw = PW - ML - MR, ah = PH - MT - MB;
        let sc = ps && ps.getAttribute('scale') ? +ps.getAttribute('scale') / 100 : 1;
        if (spr && /^(1|true)$/.test(spr.getAttribute('fitToPage') || '')) { const fw = ps ? +(ps.getAttribute('fitToWidth') || 1) : 1, fh = ps ? +(ps.getAttribute('fitToHeight') || 1) : 1; sc = Math.min(fw ? aw / W0 : 9, fh ? ah / H0 : 9, 1); }
        sc = Math.min(sc, aw / W0, ah / H0);                   // immer auf eine Seite
        const ox = ML + (po && /^(1|true)$/.test(po.getAttribute('horizontalCentered') || '') ? (aw - W0 * sc) / 2 : 0), oy = MT + (po && /^(1|true)$/.test(po.getAttribute('verticalCentered') || '') ? (ah - H0 * sc) / 2 : 0);
        const PX = x => n2(ox + x * sc), PY = y => n2(PH - (oy + y * sc));
        // Verbundene Zellen
        const merges = T(doc, 'mergeCell').map(m => { const [a, b] = m.getAttribute('ref').split(':').map(ref); return a && b ? { r1: a.r, c1: a.c, r2: b.r, c2: b.c } : null; }).filter(Boolean);
        const mOf = new Map(); merges.forEach(m => { for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) mOf.set(r + ',' + c, m); });
        const out = [], fontsUsed = new Set(), push = s => out.push(s);
        const inArea = (r, c) => r >= area.r1 && r <= area.r2 && c >= area.c1 && c <= area.c2;
        const styleAt = (r, c) => { const cell = sh.cells.get(r + ',' + c); return X[cell ? cell.s : (rowStyle[r] !== undefined ? rowStyle[r] : colStyle[c] || 0)] || X[0]; };
        const rowStyle = {}, colStyle = {}; T(doc, 'row').forEach(r => { if (/^(1|true)$/.test(r.getAttribute('customFormat') || '')) rowStyle[+r.getAttribute('r') - 1] = +(r.getAttribute('s') || 0); }); T(doc, 'col').forEach(c => { if (c.getAttribute('style')) for (let i = +c.getAttribute('min'); i <= Math.min(+c.getAttribute('max'), 1000); i++) colStyle[i - 1] = +c.getAttribute('style'); });
        // 1) Füllfarben
        for (let r = area.r1; r <= area.r2; r++) { if (!rowPt(r)) continue; for (let c = area.c1; c <= area.c2; c++) { if (!colPt(c)) continue; const m = mOf.get(r + ',' + c); if (m && (m.r1 !== r || m.c1 !== c)) continue; const x = m ? styleAt(m.r1, m.c1) : styleAt(r, c); if (!x.fill || x.fill === 'FFFFFF') continue; const r2 = m ? Math.min(m.r2, area.r2) : r, c2 = m ? Math.min(m.c2, area.c2) : c; push(`${rgbOp(x.fill, 'rg')} ${PX(xOf(c))} ${PY(yOf(r2 + 1))} ${n2((xOf(c2 + 1) - xOf(c)) * sc)} ${n2((yOf(r2 + 1) - yOf(r)) * sc)} re f`); } }
        // 2) Rahmen (innen in verbundenen Zellen nicht)
        const BW = { hair: .25, thin: .5, medium: 1, thick: 1.5, double: .5, dashed: .5, dotted: .5, mediumDashed: 1, dashDot: .5, mediumDashDot: 1, dashDotDot: .5, mediumDashDotDot: 1, slantDashDot: 1 };
        const DASH = { hair: '[1 1]', dotted: '[1 1]', dashed: '[3 2]', mediumDashed: '[4 2]', dashDot: '[3 1 1 1]', mediumDashDot: '[4 1 1 1]', dashDotDot: '[3 1 1 1 1 1]', mediumDashDotDot: '[4 1 1 1 1 1]', slantDashDot: '[4 1 1 1]' };
        const lines = new Map();
        const addLine = (key, x1, y1, x2, y2, b) => { const o = lines.get(key); if (!o || BW[b.s] > BW[o.b.s]) lines.set(key, { x1, y1, x2, y2, b }); };
        for (let r = area.r1; r <= area.r2; r++) { if (!rowPt(r)) continue; for (let c = area.c1; c <= area.c2; c++) {
            if (!colPt(c)) continue; const bd = styleAt(r, c).bd; if (!bd || !Object.keys(bd).length) continue; const m = mOf.get(r + ',' + c);
            const x1 = xOf(c), x2 = xOf(c + 1), y1 = yOf(r), y2 = yOf(r + 1);
            if (bd.t && (!m || r === m.r1)) addLine(`h${r},${c}`, x1, y1, x2, y1, bd.t); if (bd.b && (!m || r === m.r2)) addLine(`h${r + 1},${c}`, x1, y2, x2, y2, bd.b);
            if (bd.l && (!m || c === m.c1)) addLine(`v${r},${c}`, x1, y1, x1, y2, bd.l); if (bd.r && (!m || c === m.c2)) addLine(`v${r},${c + 1}`, x2, y1, x2, y2, bd.r);
        } }
        // Verbundene Bereiche: Rand der Ankerzelle gilt für den ganzen Rand (Excel zeigt ihn so, wenn nur die erste Zelle formatiert ist)
        merges.forEach(m => { if (!inArea(m.r1, m.c1)) return; const bd = styleAt(m.r1, m.c1).bd || {}; const r2 = Math.min(m.r2, area.r2), c2 = Math.min(m.c2, area.c2);
            for (let c = m.c1; c <= c2; c++) { if (bd.t && !lines.has(`h${m.r1},${c}`)) addLine(`h${m.r1},${c}`, xOf(c), yOf(m.r1), xOf(c + 1), yOf(m.r1), bd.t); const bb = styleAt(m.r2, c).bd || {}; const b = bb.b || bd.b; if (b && !lines.has(`h${r2 + 1},${c}`)) addLine(`h${r2 + 1},${c}`, xOf(c), yOf(r2 + 1), xOf(c + 1), yOf(r2 + 1), b); }
            for (let r = m.r1; r <= r2; r++) { if (bd.l && !lines.has(`v${r},${m.c1}`)) addLine(`v${r},${m.c1}`, xOf(m.c1), yOf(r), xOf(m.c1), yOf(r + 1), bd.l); const br = (styleAt(r, m.c2).bd || {}).r || bd.r; if (br && !lines.has(`v${r},${c2 + 1}`)) addLine(`v${r},${c2 + 1}`, xOf(c2 + 1), yOf(r), xOf(c2 + 1), yOf(r + 1), br); } });
        push('0 J 0 j');
        for (const { x1, y1, x2, y2, b } of lines.values()) {
            const w = Math.max(.3, BW[b.s] || .5) * Math.max(sc, .6), d = DASH[b.s] || '[]';
            const seg = (dx, dy) => `${n2(+PX(x1) + dx)} ${n2(+PY(y1) + dy)} m ${n2(+PX(x2) + dx)} ${n2(+PY(y2) + dy)} l S`;
            push(`${rgbOp(b.color || '000000', 'RG')} ${n2(w)} w ${d} 0 d`);
            if (b.s === 'double') { const o = .9 * sc, hz = y1 === y2; push(seg(hz ? 0 : -o, hz ? o : 0)); push(seg(hz ? 0 : o, hz ? -o : 0)); }
            else push(seg(0, 0));
        }
        push('[] 0 d');
        // 3) Text
        const lineH = sz => sz * 1.17;
        const hasVal = (r, c) => { const cell = sh.cells.get(r + ',' + c); if (!cell) return false; const v = val(0, r, c); return v !== '' && v != null; };
        for (let r = area.r1; r <= area.r2; r++) { if (!rowPt(r)) continue; for (let c = area.c1; c <= area.c2; c++) {
            if (!colPt(c)) continue; const m = mOf.get(r + ',' + c); if (m && (m.r1 !== r || m.c1 !== c)) continue;
            const cell = sh.cells.get(r + ',' + c); if (!cell) continue; const v = val(0, r, c); if (v === '' || v == null) continue;
            const x = X[cell.s] || X[0], f = x.font, text = format(v, x.fmt); if (!text) continue;
            const r2 = m ? Math.min(m.r2, area.r2) : r, c2 = m ? Math.min(m.c2, area.c2) : c;
            let bx = xOf(c), by = yOf(r), bw = xOf(c2 + 1) - bx, bh = yOf(r2 + 1) - by; if (bw <= 0 || bh <= 0) continue;
            let sz = f.sz; const pad = 2.2 + x.ind * 7.5, isNum = typeof v === 'number', isErr = typeof v === 'object';
            let h = x.h && x.h !== 'general' ? x.h : isNum ? 'right' : isErr || typeof v === 'boolean' ? 'center' : 'left'; if (h === 'centerContinuous') h = 'center'; if (h === 'fill' || h === 'justify' || h === 'distributed') h = 'left';
            let rows = [text.replace(/\r/g, '')];
            if (x.wrap) rows = wrap(text, bw - 2 * pad, sz, f.b, f.i);
            else rows = [rows[0].replace(/\n/g, ' ')];
            if (x.shrink && !x.wrap) { const w0 = tw(rows[0], sz, f.b, f.i); if (w0 > bw - 2 * pad) sz = Math.max(4, sz * (bw - 2 * pad) / w0); }
            // überlanger Text ohne Umbruch läuft wie in Excel in leere Nachbarzellen hinein
            let clipX = bx, clipW = bw;
            if (!x.wrap && !m && !isNum) { const w0 = tw(rows[0], sz, f.b, f.i) + 2 * pad;
                if (w0 > bw && h === 'left') { let cc = c + 1; while (cc <= area.c2 && clipW < w0 && !hasVal(r, cc) && !mOf.has(r + ',' + cc)) { clipW += colPt(cc); cc++; } }
                else if (w0 > bw && h === 'right') { let cc = c - 1; while (cc >= area.c1 && clipW < w0 && !hasVal(r, cc) && !mOf.has(r + ',' + cc)) { clipX -= colPt(cc); clipW += colPt(cc); cc--; } }
                else if (w0 > bw && h === 'center') { const extra = (w0 - bw) / 2; let l = 0, rr = 0, cc = c - 1; while (cc >= area.c1 && l < extra && !hasVal(r, cc) && !mOf.has(r + ',' + cc)) { l += colPt(cc); cc--; } cc = c + 1; while (cc <= area.c2 && rr < extra && !hasVal(r, cc) && !mOf.has(r + ',' + cc)) { rr += colPt(cc); cc++; } clipX -= l; clipW += l + rr; } }
            const fid = f.b && f.i ? 'F4' : f.b ? 'F2' : f.i ? 'F3' : 'F1'; fontsUsed.add(fid);
            const tot = rows.length * lineH(sz), asc = sz * .77, dsc = sz * .23;
            let y0 = x.v === 'top' ? by + 1.5 + asc : x.v === 'center' || x.v === 'justify' || x.v === 'distributed' ? by + (bh - tot) / 2 + asc + (lineH(sz) - sz) / 2 : by + bh - 1.5 - dsc - (rows.length - 1) * lineH(sz);
            push(`q ${PX(clipX)} ${PY(by + bh)} ${n2(clipW * sc)} ${n2(bh * sc)} re W n`);
            rows.forEach((t, k) => {
                if (!t) return; const w = tw(t, sz, f.b, f.i), y = y0 + k * lineH(sz);
                const tx = h === 'right' ? bx + bw - pad - w : h === 'center' ? bx + (bw - w) / 2 : bx + pad;
                push(`BT /${fid} ${n2(sz * sc)} Tf ${rgbOp(f.color || '000000', 'rg')} ${PX(tx)} ${PY(y)} Td ${pstr(t)} Tj ET`);
                if (f.u) push(`${rgbOp(f.color || '000000', 'RG')} ${n2(.5 * sc)} w ${PX(tx)} ${n2(+PY(y) - 1.2 * sc)} m ${PX(tx + w)} ${n2(+PY(y) - 1.2 * sc)} l S`);
            });
            push('Q');
        } }
        // 4) Bilder (Logos)
        const images = [];
        const srel = relsOf(files, sh.path), drel = Object.values(srel).find(x => /drawing$/.test(x.type));
        if (drel && files.has(drel.t)) {
            const dd = xml(dec.decode(files.get(drel.t))), irels = relsOf(files, drel.t), EMU = 12700;
            const posOf = el => ({ c: +T(el, 'col', NSX)[0].textContent, co: +T(el, 'colOff', NSX)[0].textContent / EMU, r: +T(el, 'row', NSX)[0].textContent, ro: +T(el, 'rowOff', NSX)[0].textContent / EMU });
            const cxAbs = (c, off) => { let x = 0; for (let i = area.c1; i < c; i++) x += colPt(i); for (let i = c; i < area.c1; i++) x -= colPt(i); return x + off; };
            const ryAbs = (r, off) => { let y = 0; for (let i = area.r1; i < r; i++) y += rowPt(i); for (let i = r; i < area.r1; i++) y -= rowPt(i); return y + off; };
            for (const an of [...dd.documentElement.children]) {
                const pic = T(an, 'pic', NSX)[0], blip = pic && T(pic, 'blip', NSA)[0]; if (!blip) continue;
                const rid = blip.getAttributeNS(NSR, 'embed') || blip.getAttribute('r:embed'), src = irels[rid]; if (!src || !files.has(src.t)) continue;
                let x1, y1, x2, y2; const fr = T(an, 'from', NSX)[0], to = T(an, 'to', NSX)[0], ext = kid(an, 'ext') || T(pic, 'ext', NSA)[0];
                if (fr) { const a = posOf(fr); x1 = cxAbs(a.c, a.co); y1 = ryAbs(a.r, a.ro); if (to && an.localName === 'twoCellAnchor') { const b = posOf(to); x2 = cxAbs(b.c, b.co); y2 = ryAbs(b.r, b.ro); } else if (ext) { x2 = x1 + +ext.getAttribute('cx') / EMU; y2 = y1 + +ext.getAttribute('cy') / EMU; } }
                else { const pos = kid(an, 'pos'); if (!pos || !ext) continue; x1 = +pos.getAttribute('x') / EMU; y1 = +pos.getAttribute('y') / EMU; x2 = x1 + +ext.getAttribute('cx') / EMU; y2 = y1 + +ext.getAttribute('cy') / EMU; }
                if (!(x2 > x1 && y2 > y1) || x2 < 0 || y2 < 0 || x1 > W0 || y1 > H0) continue;
                const img = await imageObj(files.get(src.t), src.t, (x2 - x1) * sc, (y2 - y1) * sc); if (!img) continue;
                const name = 'Im' + (images.length + 1); images.push({ name, ...img });
                push(`q ${n2((x2 - x1) * sc)} 0 0 ${n2((y2 - y1) * sc)} ${PX(x1)} ${PY(y2)} cm /${name} Do Q`);
            }
        }
        // 5) Kopf- und Fußzeile
        const hf = T(doc, 'headerFooter')[0];
        const hfPart = (s, yBase, top) => {
            if (!s) return; const parts = { L: '', C: '', R: '' }; let cur = 'C';
            s.replace(/&([LCR])|([^&]+|&.)/g, (m0, sec, rest) => { if (sec) cur = sec; else parts[cur] += rest; return ''; });
            ['L', 'C', 'R'].forEach(k => {
                let t = parts[k]; if (!t) return; let sz = 10, b = false, it = false;
                t = t.replace(/&"([^"]*)"/g, (m0, fnt) => { if (/bold|fett/i.test(fnt)) b = true; if (/italic|kursiv/i.test(fnt)) it = true; return ''; }).replace(/&(\d+)/g, (m0, n) => { sz = +n; return ''; })
                    .replace(/&P/g, '1').replace(/&N/g, '1').replace(/&D/g, new Date().toLocaleDateString('de-DE')).replace(/&T/g, new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })).replace(/&A/g, sh.name).replace(/&F/g, opt.title || 'Stundenzettel')
                    .replace(/&B/g, () => { b = !b; return ''; }).replace(/&I/g, () => { it = !it; return ''; }).replace(/&[USXYOHEKGZ][0-9A-F]*/g, '').replace(/&&/g, '&');
                t.split('\n').forEach((ln, i) => { if (!ln.trim()) return; const w = tw(ln, sz, b, it), x = k === 'L' ? ML : k === 'R' ? PW - MR - w : (PW - w) / 2, fid = b && it ? 'F4' : b ? 'F2' : it ? 'F3' : 'F1'; fontsUsed.add(fid);
                    const y = top ? yBase + sz * .8 + i * sz * 1.2 : yBase - i * sz * 1.2; push(`BT /${fid} ${n2(sz)} Tf 0 0 0 rg ${n2(x)} ${n2(PH - y)} Td ${pstr(ln)} Tj ET`); });
            });
        };
        if (hf) { const hd = T(hf, 'oddHeader')[0], ft = T(hf, 'oddFooter')[0]; hfPart(hd && hd.textContent, mg('header'), true); if (ft) { const lines = ft.textContent.split('\n').length; hfPart(ft.textContent, PH - mg('footer') - (lines - 1) * 12, false); } }
        return pdfFile(PW, PH, out.join('\n'), images, opt.title || 'Stundenzettel');
    }

    // Bild → RGB + Transparenzmaske (Flate), verkleinert auf eine sinnvolle Druckauflösung
    async function imageObj(data, name, wPt, hPt) {
        try {
            const mime = /\.png$/i.test(name) ? 'image/png' : /\.jpe?g$/i.test(name) ? 'image/jpeg' : /\.gif$/i.test(name) ? 'image/gif' : /\.bmp$/i.test(name) ? 'image/bmp' : /\.webp$/i.test(name) ? 'image/webp' : '';
            if (!mime) return null;                     // EMF/WMF kann der Browser nicht zeichnen
            const bmp = await createImageBitmap(new Blob([data], { type: mime }));
            const k = Math.min(1, (wPt / 72 * 300) / bmp.width, (hPt / 72 * 300) / bmp.height), w = Math.max(1, Math.round(bmp.width * (k < 1 ? k : 1))), h = Math.max(1, Math.round(bmp.height * (k < 1 ? k : 1)));
            const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, w, h);
            const px = g.getImageData(0, 0, w, h).data, rgb = new Uint8Array(w * h * 3), a = new Uint8Array(w * h); let alpha = false;
            for (let i = 0, j = 0; i < px.length; i += 4, j++) { rgb[j * 3] = px[i]; rgb[j * 3 + 1] = px[i + 1]; rgb[j * 3 + 2] = px[i + 2]; a[j] = px[i + 3]; if (px[i + 3] < 255) alpha = true; }
            return { w, h, rgb: await zlib(rgb), a: alpha ? await zlib(a) : null };
        } catch (x) { return null; }
    }
    async function zlib(u) { return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()); }

    // ---------- PDF-Datei schreiben ----------
    async function pdfFile(PW, PH, content, images, title) {
        const enc = s => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
        const chunks = [], offs = []; let len = 0; const add = u => { if (typeof u === 'string') u = enc(u); chunks.push(u); len += u.length; };
        const objs = []; const obj = parts => { objs.push(parts); return objs.length; };
        const cat = obj(null), pages = obj(null), page = obj(null);
        const fonts = { F1: 'Helvetica', F2: 'Helvetica-Bold', F3: 'Helvetica-Oblique', F4: 'Helvetica-BoldOblique' }, fref = {};
        Object.entries(fonts).forEach(([k, n]) => { fref[k] = obj([`<< /Type /Font /Subtype /Type1 /BaseFont /${n} /Encoding /WinAnsiEncoding >>`]); });
        const iref = {};
        images.forEach(im => { let sm = ''; if (im.a) { const s = obj([`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${im.a.length} >>\nstream\n`, im.a, '\nendstream']); sm = ` /SMask ${s} 0 R`; }
            iref[im.name] = obj([`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${sm} /Length ${im.rgb.length} >>\nstream\n`, im.rgb, '\nendstream']); });
        const body = await zlib(enc(content));
        const cont = obj([`<< /Length ${body.length} /Filter /FlateDecode >>\nstream\n`, body, '\nendstream']);
        const info = obj([`<< /Title ${pstrSafe(title)} /Producer (J.Mainz Dashboard) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}) >>`]);
        objs[cat - 1] = [`<< /Type /Catalog /Pages ${pages} 0 R >>`];
        objs[pages - 1] = [`<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`];
        objs[page - 1] = [`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${PW.toFixed(2)} ${PH.toFixed(2)}] /Resources << /Font << ${Object.keys(fonts).map(k => `/${k} ${fref[k]} 0 R`).join(' ')} >>${images.length ? ` /XObject << ${images.map(im => `/${im.name} ${iref[im.name]} 0 R`).join(' ')} >>` : ''} >> /Contents ${cont} 0 R >>`];
        add('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
        objs.forEach((parts, i) => { offs[i] = len; add(`${i + 1} 0 obj\n`); parts.forEach(p => add(p)); add('\nendobj\n'); });
        const xref = len; add(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join(''));
        add(`trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
        return new Blob(chunks, { type: 'application/pdf' });
    }
    const pstrSafe = s => pstr(String(s || '').slice(0, 120));

    window.TimesheetPDF = { render, _test: { format } };
})();
