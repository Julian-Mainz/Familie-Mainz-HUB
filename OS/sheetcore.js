// OS/sheetcore.js – Rechenkern für „Tabellen“: Zelladressen, Formeln (deutsch eingeben, englisch speichern wie Excel),
// Berechnung mit Funktionen, Zahlenformate und .xlsx lesen/schreiben (braucht OS/zip.js).
(function () {
    'use strict';
    // ---------- Adressen ----------
    const colS = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };      // 0 → A
    const colN = s => s.toUpperCase().split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
    const addr = (r, c) => colS(c) + (r + 1);
    const parseAddr = s => { const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(s); return m ? { r: +m[2] - 1, c: colN(m[1]) } : null; };
    const key = (r, c) => r + ',' + c;

    // ---------- Funktionen: englischer Name → deutscher Name ----------
    const DE = { SUM: 'SUMME', AVERAGE: 'MITTELWERT', MIN: 'MIN', MAX: 'MAX', COUNT: 'ANZAHL', COUNTA: 'ANZAHL2', COUNTBLANK: 'ANZAHLLEEREZELLEN', IF: 'WENN', AND: 'UND', OR: 'ODER', NOT: 'NICHT',
        ROUND: 'RUNDEN', ROUNDUP: 'AUFRUNDEN', ROUNDDOWN: 'ABRUNDEN', ABS: 'ABS', SUMIF: 'SUMMEWENN', COUNTIF: 'ZÄHLENWENN', AVERAGEIF: 'MITTELWERTWENN', TODAY: 'HEUTE', NOW: 'JETZT',
        CONCATENATE: 'VERKETTEN', LEN: 'LÄNGE', LEFT: 'LINKS', RIGHT: 'RECHTS', MID: 'TEIL', UPPER: 'GROSS', LOWER: 'KLEIN', PROPER: 'GROSS2', TRIM: 'GLÄTTEN', VLOOKUP: 'SVERWEIS', HLOOKUP: 'WVERWEIS',
        IFERROR: 'WENNFEHLER', PRODUCT: 'PRODUKT', POWER: 'POTENZ', SQRT: 'WURZEL', MOD: 'REST', INT: 'GANZZAHL', YEAR: 'JAHR', MONTH: 'MONAT', DAY: 'TAG', DATE: 'DATUM', HOUR: 'STUNDE', MINUTE: 'MINUTE',
        MEDIAN: 'MEDIAN', PI: 'PI', RAND: 'ZUFALLSZAHL', RANDBETWEEN: 'ZUFALLSBEREICH', ISBLANK: 'ISTLEER', ISNUMBER: 'ISTZAHL', ISTEXT: 'ISTTEXT', INDEX: 'INDEX', MATCH: 'VERGLEICH', SUMPRODUCT: 'SUMMENPRODUKT',
        LARGE: 'KGRÖSSTE', SMALL: 'KKLEINSTE', WEEKDAY: 'WOCHENTAG', DAYS: 'TAGE', EDATE: 'EDATUM', EOMONTH: 'MONATSENDE', TEXT: 'TEXT', VALUE: 'WERT', SUBSTITUTE: 'WECHSELN', REPT: 'WIEDERHOLEN',
        TRUE: 'WAHR', FALSE: 'FALSCH', CEILING: 'OBERGRENZE', FLOOR: 'UNTERGRENZE', SIGN: 'VORZEICHEN', COUNTIFS: 'ZÄHLENWENNS', SUMIFS: 'SUMMEWENNS', ROW: 'ZEILE', COLUMN: 'SPALTE', ROWS: 'ZEILEN', COLUMNS: 'SPALTEN', ISOWEEKNUM: 'ISOKALENDERWOCHE', WEEKNUM: 'KALENDERWOCHE' };
    const EN = Object.fromEntries(Object.entries(DE).map(([e, d]) => [d, e]));
    const ERR_DE = { '#DIV/0!': '#DIV/0!', '#VALUE!': '#WERT!', '#REF!': '#BEZUG!', '#NAME?': '#NAME?', '#N/A': '#NV', '#NUM!': '#ZAHL!', '#CIRC!': '#ZIRKEL!' };

    // ---------- Zerlegen einer Formel (ohne „=“) ----------
    // Typen: num, str, ref ({ sheet, a, b }), fn, op, lp, rp, sep, bool, err
    const RE_REF = /^(?:('(?:[^']|'')+'|[A-Za-z_À-ɏ][\w.À-ɏ]*)!)?(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?/;
    function lex(src, de) {
        const out = []; let i = 0;
        while (i < src.length) {
            const ch = src[i], rest = src.slice(i);
            if (/\s/.test(ch)) { i++; continue; }
            if (ch === '"') { let j = i + 1, s = ''; while (j < src.length) { if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += src[j++]; } out.push({ t: 'str', v: s }); i = j + 1; continue; }
            let m;
            if ((m = (de ? /^\d+(?:,\d+)?(?:[eE][+-]?\d+)?/ : /^\d*\.?\d+(?:[eE][+-]?\d+)?/).exec(rest)) && !/^[A-Za-z]/.test(rest.slice(m[0].length))) { out.push({ t: 'num', v: +m[0].replace(',', '.') }); i += m[0].length; continue; }
            if ((m = RE_REF.exec(rest)) && !/^[\w(]/.test(rest.slice(m[0].length))) { let sh = m[1] ? m[1].replace(/^'|'$/g, '').replace(/''/g, "'") : null; out.push({ t: 'ref', sheet: sh, a: m[2].toUpperCase(), b: m[3] ? m[3].toUpperCase() : null }); i += m[0].length; continue; }
            if ((m = /^([A-Za-z_À-ɏ][\w.À-ɏ]*)\s*\(/.exec(rest))) { out.push({ t: 'fn', v: m[1].toUpperCase() }); i += m[0].length; out.push({ t: 'lp' }); continue; }
            if ((m = /^(TRUE|FALSE|WAHR|FALSCH)\b/i.exec(rest))) { out.push({ t: 'bool', v: /^(TRUE|WAHR)$/i.test(m[1]) }); i += m[0].length; continue; }
            if ((m = /^#(DIV\/0!|VALUE!|REF!|NAME\?|N\/A|NUM!|WERT!|BEZUG!|NV|ZAHL!)/i.exec(rest))) { out.push({ t: 'err', v: m[0].toUpperCase() }); i += m[0].length; continue; }
            if ((m = /^(<=|>=|<>|[-+*/^&=<>%])/.exec(rest))) { out.push({ t: 'op', v: m[1] }); i += m[1].length; continue; }
            if (ch === '(') { out.push({ t: 'lp' }); i++; continue; } if (ch === ')') { out.push({ t: 'rp' }); i++; continue; }
            if (ch === (de ? ';' : ',')) { out.push({ t: 'sep' }); i++; continue; }
            if (de && ch === ',') { out.push({ t: 'sep' }); i++; continue; }        // Komma als Trenner tolerieren
            if ((m = /^[A-Za-z_À-ɏ][\w.À-ɏ]*/.exec(rest))) { out.push({ t: 'name', v: m[0] }); i += m[0].length; continue; }
            throw new Error('Unerwartetes Zeichen „' + ch + '“');
        }
        return out;
    }
    const qSheet = s => /^[A-Za-z_][\w.]*$/.test(s) ? s : "'" + s.replace(/'/g, "''") + "'";
    function emit(toks, de) {
        return toks.map(t => {
            if (t.t === 'num') { let s = String(+t.v.toPrecision(15)); return de ? s.replace('.', ',') : s; }
            if (t.t === 'str') return '"' + t.v.replace(/"/g, '""') + '"';
            if (t.t === 'ref') return (t.sheet ? qSheet(t.sheet) + '!' : '') + t.a + (t.b ? ':' + t.b : '');
            if (t.t === 'fn') return de ? (DE[t.v] || t.v) : t.v;
            if (t.t === 'bool') return de ? (t.v ? 'WAHR' : 'FALSCH') : (t.v ? 'TRUE' : 'FALSE');
            if (t.t === 'err') return de ? (ERR_DE[t.v] || t.v) : (Object.keys(ERR_DE).find(k => ERR_DE[k] === t.v) || t.v);
            if (t.t === 'op') return t.v; if (t.t === 'lp') return '('; if (t.t === 'rp') return ')'; if (t.t === 'sep') return de ? ';' : ',';
            return t.v;
        }).join('');
    }
    // deutsch (Eingabe) → englisch (gespeichert) und zurück
    function toEN(f) { const t = lex(f, true); t.forEach(x => { if (x.t === 'fn') x.v = EN[x.v] || x.v; }); return emit(t, false); }
    function toDE(f) { try { return emit(lex(f, false), true); } catch (x) { return f; } }

    // Bezüge verschieben (Kopieren, Ausfüllen) und Zeilen/Spalten einfügen/löschen
    function shiftRefs(f, fn) {
        let t; try { t = lex(f, false); } catch (x) { return f; }
        t.forEach(x => { if (x.t !== 'ref') return; const r = fn(x); if (r === null) { x.t = 'err'; x.v = '#REF!'; } else Object.assign(x, r); });
        return emit(t, false);
    }
    const moveA1 = (a, dr, dc) => { const m = /^(\$?)([A-Z]{1,3})(\$?)(\d+)$/.exec(a); let c = colN(m[2]), r = +m[4] - 1; if (!m[1]) c += dc; if (!m[3]) r += dr; if (c < 0 || r < 0) return null; return m[1] + colS(c) + m[3] + (r + 1); };
    function offsetFormula(f, dr, dc) { return shiftRefs(f, x => { const a = moveA1(x.a, dr, dc), b = x.b ? moveA1(x.b, dr, dc) : null; return a && (!x.b || b) ? { a, b } : null; }); }
    // Zeilen/Spalten einfügen (n > 0) oder löschen (n < 0) ab Index at auf Blatt sheetName (curSheet = Blatt der Formel)
    function insertShift(f, sheetName, curSheet, axis, at, n) {
        return shiftRefs(f, x => {
            const sh = x.sheet || curSheet; if (sh !== sheetName) return x;
            const fix = (a, end) => { const m = /^(\$?)([A-Z]{1,3})(\$?)(\d+)$/.exec(a); let c = colN(m[2]), r = +m[4] - 1; let v = axis === 'r' ? r : c;
                if (n > 0) { if (v >= at) v += n; } else { const d0 = at, d1 = at - n - 1; if (v >= d0 && v <= d1) { if (!x.b) return null; v = end ? d0 - 1 : d0; if (v < 0) return null; } else if (v > d1) v += n; }
                if (axis === 'r') r = v; else c = v; return m[1] + colS(c) + m[3] + (r + 1); };
            const a = fix(x.a, false), b = x.b ? fix(x.b, true) : null; if (!a || (x.b && !b)) return null;
            if (x.b) { const pa = parseAddr(a), pb = parseAddr(b); if (pa.r > pb.r || pa.c > pb.c) return null; }
            return { a, b };
        });
    }

    // ---------- Parser → Baum ----------
    function parse(f) {
        const t = lex(f, false); let i = 0;
        const peek = () => t[i], next = () => t[i++];
        const isOp = (...o) => t[i] && t[i].t === 'op' && o.includes(t[i].v);
        function cmp() { let l = cat(); while (isOp('=', '<>', '<', '>', '<=', '>=')) { const o = next().v; l = { k: 'bin', o, l, r: cat() }; } return l; }
        function cat() { let l = add(); while (isOp('&')) { next(); l = { k: 'bin', o: '&', l, r: add() }; } return l; }
        function add() { let l = mul(); while (isOp('+', '-')) { const o = next().v; l = { k: 'bin', o, l, r: mul() }; } return l; }
        function mul() { let l = pow(); while (isOp('*', '/')) { const o = next().v; l = { k: 'bin', o, l, r: pow() }; } return l; }
        function pow() { let l = un(); while (isOp('^')) { next(); l = { k: 'bin', o: '^', l, r: un() }; } return l; }
        function un() { if (isOp('-')) { next(); return { k: 'neg', a: un() }; } if (isOp('+')) { next(); return un(); } return pct(); }
        function pct() { let a = prim(); while (isOp('%')) { next(); a = { k: 'bin', o: '/', l: a, r: { k: 'num', v: 100 } }; } return a; }
        function prim() {
            const x = next(); if (!x) throw new Error('Formel unvollständig');
            if (x.t === 'num') return { k: 'num', v: x.v }; if (x.t === 'str') return { k: 'str', v: x.v }; if (x.t === 'bool') return { k: 'bool', v: x.v }; if (x.t === 'err') return { k: 'err', v: x.v };
            if (x.t === 'ref') return { k: 'ref', sheet: x.sheet, a: x.a, b: x.b };
            if (x.t === 'lp') { const e = cmp(); if (!peek() || peek().t !== 'rp') throw new Error('Klammer fehlt'); next(); return e; }
            if (x.t === 'fn') { next(); const args = []; if (peek() && peek().t === 'rp') { next(); return { k: 'fn', v: x.v, args }; }
                while (true) { if (peek() && (peek().t === 'sep' || peek().t === 'rp')) args.push({ k: 'empty' }); else args.push(cmp()); const s = next(); if (!s) throw new Error('Klammer fehlt'); if (s.t === 'rp') break; if (s.t !== 'sep') throw new Error('Trennzeichen erwartet'); }
                return { k: 'fn', v: x.v, args }; }
            if (x.t === 'name') return { k: 'err', v: '#NAME?' };
            throw new Error('Formel ungültig');
        }
        const tree = cmp(); if (i < t.length) throw new Error('Formel ungültig'); return tree;
    }

    // ---------- Rechnen ----------
    const E = v => ({ e: v }); const isE = v => v && typeof v === 'object' && 'e' in v;
    const num = v => { if (isE(v)) return v; if (typeof v === 'number') return v; if (typeof v === 'boolean') return v ? 1 : 0; if (v === '' || v == null) return 0; const n = parseNum(String(v)); return n === null ? E('#VALUE!') : n; };
    const str = v => isE(v) ? v : typeof v === 'boolean' ? (v ? 'WAHR' : 'FALSCH') : v == null ? '' : typeof v === 'number' ? fmtGen(v) : String(v);
    const bool = v => isE(v) ? v : typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : /^(wahr|true)$/i.test(v) ? true : /^(falsch|false)$/i.test(v) ? false : v === '' ? false : E('#VALUE!');
    const flat = args => { const out = []; args.forEach(a => { if (a && a.range) a.vals.forEach(row => row.forEach(v => out.push({ v, fromRange: true }))); else out.push({ v: a, fromRange: false }); }); return out; };
    const nums = args => { const out = []; for (const { v, fromRange } of flat(args)) { if (isE(v)) return v; if (typeof v === 'number') out.push(v); else if (!fromRange && v !== '' && v != null) { const n = num(v); if (isE(n)) return n; out.push(n); } } return out; };
    const crit = c => { // Bedingung für ZÄHLENWENN usw.
        if (typeof c === 'number') return v => v === c || (typeof v === 'string' && parseNum(v) === c);
        const m = /^(<=|>=|<>|=|<|>)?(.*)$/.exec(String(c)), op = m[1] || '=', rhs = m[2], n = parseNum(rhs);
        if (n !== null && rhs !== '') { const cmp = { '=': (a, b) => a === b, '<>': (a, b) => a !== b, '<': (a, b) => a < b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '>=': (a, b) => a >= b }[op]; return v => typeof v === 'number' ? cmp(v, n) : op === '<>'; }
        const re = new RegExp('^' + rhs.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
        return op === '<>' ? v => !re.test(str(v)) : v => re.test(str(v));
    };
    const serialOf = d => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 864e5 + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
    const dateOf = s => { const ms = Math.round(s * 864e5) + Date.UTC(1899, 11, 30); const d = new Date(ms); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes() }; };
    const ser = (y, m, d) => (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5;
    const rnd = (n, d) => { const f = Math.pow(10, d); return Math.round((n + Math.sign(n) * 1e-12) * f) / f; };
    function lookupExact(arr, v) { return arr.findIndex(x => typeof v === 'string' ? str(x).toLowerCase() === v.toLowerCase() : x === v); }
    function lookupApprox(arr, v) { let best = -1; for (let i = 0; i < arr.length; i++) { const x = arr[i]; if (x === '' || x == null) continue; if (typeof v === 'number' ? (typeof x === 'number' && x <= v) : str(x).toLowerCase() <= String(v).toLowerCase()) best = i; else break; } return best; }
    const FN = {
        SUM: a => { const n = nums(a); return isE(n) ? n : n.reduce((x, y) => x + y, 0); },
        AVERAGE: a => { const n = nums(a); return isE(n) ? n : n.length ? n.reduce((x, y) => x + y, 0) / n.length : E('#DIV/0!'); },
        MIN: a => { const n = nums(a); return isE(n) ? n : n.length ? Math.min(...n) : 0; }, MAX: a => { const n = nums(a); return isE(n) ? n : n.length ? Math.max(...n) : 0; },
        MEDIAN: a => { const n = nums(a); if (isE(n)) return n; if (!n.length) return E('#NUM!'); n.sort((x, y) => x - y); const h = n.length >> 1; return n.length % 2 ? n[h] : (n[h - 1] + n[h]) / 2; },
        PRODUCT: a => { const n = nums(a); return isE(n) ? n : n.reduce((x, y) => x * y, 1); },
        COUNT: a => flat(a).filter(x => typeof x.v === 'number').length, COUNTA: a => flat(a).filter(x => x.v !== '' && x.v != null).length, COUNTBLANK: a => flat(a).filter(x => x.v === '' || x.v == null).length,
        IF: (a, lazy) => { const c = bool(lazy(0)); if (isE(c)) return c; return c ? (a.length > 1 ? lazy(1) : true) : (a.length > 2 ? lazy(2) : false); },
        IFERROR: (a, lazy) => { const v = lazy(0); return isE(v) ? lazy(1) : v; },
        AND: a => { for (const { v } of flat(a)) { const b = bool(v); if (isE(b)) return b; if (!b) return false; } return true; },
        OR: a => { for (const { v } of flat(a)) { const b = bool(v); if (isE(b)) return b; if (b) return true; } return false; },
        NOT: a => { const b = bool(a[0]); return isE(b) ? b : !b; }, TRUE: () => true, FALSE: () => false,
        ROUND: a => { const n = num(a[0]), d = num(a[1] ?? 0); return isE(n) ? n : isE(d) ? d : rnd(n, d); },
        ROUNDUP: a => { const n = num(a[0]), f = Math.pow(10, num(a[1] ?? 0)); return isE(n) ? n : Math.sign(n) * Math.ceil(Math.abs(n) * f - 1e-9) / f; },
        ROUNDDOWN: a => { const n = num(a[0]), f = Math.pow(10, num(a[1] ?? 0)); return isE(n) ? n : Math.sign(n) * Math.floor(Math.abs(n) * f + 1e-9) / f; },
        INT: a => { const n = num(a[0]); return isE(n) ? n : Math.floor(n); }, ABS: a => { const n = num(a[0]); return isE(n) ? n : Math.abs(n); }, SIGN: a => Math.sign(num(a[0])),
        SQRT: a => { const n = num(a[0]); return isE(n) ? n : n < 0 ? E('#NUM!') : Math.sqrt(n); }, POWER: a => Math.pow(num(a[0]), num(a[1])),
        MOD: a => { const n = num(a[0]), d = num(a[1]); return d === 0 ? E('#DIV/0!') : n - d * Math.floor(n / d); }, PI: () => Math.PI, RAND: () => Math.random(),
        RANDBETWEEN: a => { const lo = Math.ceil(num(a[0])), hi = Math.floor(num(a[1])); return lo + Math.floor(Math.random() * (hi - lo + 1)); },
        CEILING: a => { const n = num(a[0]), s = num(a[1] ?? 1); return s ? Math.ceil(n / s) * s : 0; }, FLOOR: a => { const n = num(a[0]), s = num(a[1] ?? 1); return s ? Math.floor(n / s) * s : 0; },
        SUMIF: a => { if (!a[0] || !a[0].range) return E('#VALUE!'); const t = crit(a[1]), src = a[0].vals.flat(), sum = (a[2] && a[2].range ? a[2].vals.flat() : src); let s = 0; src.forEach((v, i) => { if (t(v) && typeof sum[i] === 'number') s += sum[i]; }); return s; },
        COUNTIF: a => { if (!a[0] || !a[0].range) return E('#VALUE!'); const t = crit(a[1]); return a[0].vals.flat().filter(v => t(v)).length; },
        AVERAGEIF: a => { if (!a[0] || !a[0].range) return E('#VALUE!'); const t = crit(a[1]), src = a[0].vals.flat(), av = (a[2] && a[2].range ? a[2].vals.flat() : src); let s = 0, n = 0; src.forEach((v, i) => { if (t(v) && typeof av[i] === 'number') { s += av[i]; n++; } }); return n ? s / n : E('#DIV/0!'); },
        SUMIFS: a => { if (!a[0] || !a[0].range) return E('#VALUE!'); const sum = a[0].vals.flat(); let s = 0; sum.forEach((v, i) => { for (let k = 1; k + 1 < a.length; k += 2) { if (!a[k].range || !crit(a[k + 1])(a[k].vals.flat()[i])) return; } if (typeof v === 'number') s += v; }); return s; },
        COUNTIFS: a => { if (!a[0] || !a[0].range) return E('#VALUE!'); const n = a[0].vals.flat().length; let c = 0; for (let i = 0; i < n; i++) { let ok = true; for (let k = 0; k + 1 < a.length; k += 2) { if (!a[k].range || !crit(a[k + 1])(a[k].vals.flat()[i])) { ok = false; break; } } if (ok) c++; } return c; },
        SUMPRODUCT: a => { const arrs = a.map(x => x && x.range ? x.vals.flat() : [x]); const n = arrs[0].length; let s = 0; for (let i = 0; i < n; i++) s += arrs.reduce((p, ar) => p * (typeof ar[i] === 'number' ? ar[i] : 0), 1); return s; },
        LARGE: a => { const n = nums([a[0]]), k = num(a[1]); if (isE(n)) return n; n.sort((x, y) => y - x); return n[k - 1] ?? E('#NUM!'); }, SMALL: a => { const n = nums([a[0]]), k = num(a[1]); if (isE(n)) return n; n.sort((x, y) => x - y); return n[k - 1] ?? E('#NUM!'); },
        TODAY: () => Math.floor(serialOf(new Date())), NOW: () => serialOf(new Date()),
        DATE: a => ser(num(a[0]), num(a[1]), num(a[2])), YEAR: a => dateOf(num(a[0])).y, MONTH: a => dateOf(num(a[0])).m, DAY: a => dateOf(num(a[0])).d, HOUR: a => dateOf(num(a[0])).h, MINUTE: a => dateOf(num(a[0])).mi,
        WEEKDAY: a => { const w = dateOf(num(a[0])).wd, t = num(a[1] ?? 1); return t === 2 ? (w + 6) % 7 + 1 : t === 3 ? (w + 6) % 7 : w + 1; },
        DAYS: a => Math.floor(num(a[0])) - Math.floor(num(a[1])),
        EDATE: a => { const d = dateOf(num(a[0])), m = num(a[1]); const t = new Date(Date.UTC(d.y, d.m - 1 + m, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return ser(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(d.d, last)); },
        EOMONTH: a => { const d = dateOf(num(a[0])), m = num(a[1]); return ser(d.y, d.m + m + 1, 0); },
        ISOWEEKNUM: a => { const d = dateOf(num(a[0])), t = new Date(Date.UTC(d.y, d.m - 1, d.d)); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); return 1 + Math.round(((t - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7); },
        WEEKNUM: a => FN.ISOWEEKNUM(a),
        CONCATENATE: a => { let s = ''; for (const { v } of flat(a)) { if (isE(v)) return v; s += str(v); } return s; },
        LEN: a => str(a[0]).length, LEFT: a => str(a[0]).slice(0, a.length > 1 ? num(a[1]) : 1), RIGHT: a => { const s = str(a[0]), n = a.length > 1 ? num(a[1]) : 1; return n ? s.slice(-n) : ''; },
        MID: a => str(a[0]).substr(num(a[1]) - 1, num(a[2])), UPPER: a => str(a[0]).toUpperCase(), LOWER: a => str(a[0]).toLowerCase(), TRIM: a => str(a[0]).trim().replace(/\s+/g, ' '),
        PROPER: a => str(a[0]).toLowerCase().replace(/(^|[^a-zäöüß])([a-zäöüß])/g, (m, p, c) => p + c.toUpperCase()),
        SUBSTITUTE: a => str(a[0]).split(str(a[1])).join(str(a[2])), REPT: a => str(a[0]).repeat(Math.max(0, num(a[1]))),
        VALUE: a => { if (typeof a[0] === 'number') return a[0]; const p = parseInput(str(a[0])); return typeof p.v === 'number' ? p.v : E('#VALUE!'); },
        TEXT: a => textFmt(num(a[0]), str(a[1])),
        ISBLANK: a => a[0] === '' || a[0] == null, ISNUMBER: a => typeof a[0] === 'number', ISTEXT: a => typeof a[0] === 'string' && a[0] !== '',
        VLOOKUP: a => { const t = a[1]; if (!t || !t.range) return E('#VALUE!'); const col = num(a[2]) - 1, exact = a.length > 3 && !bool(a[3]); const first = t.vals.map(r => r[0]); const i = exact ? lookupExact(first, a[0]) : lookupApprox(first, a[0]); if (i < 0) return E('#N/A'); return t.vals[i][col] ?? E('#REF!'); },
        HLOOKUP: a => { const t = a[1]; if (!t || !t.range) return E('#VALUE!'); const row = num(a[2]) - 1, exact = a.length > 3 && !bool(a[3]); const i = exact ? lookupExact(t.vals[0], a[0]) : lookupApprox(t.vals[0], a[0]); if (i < 0) return E('#N/A'); return (t.vals[row] || [])[i] ?? E('#REF!'); },
        INDEX: a => { const t = a[0]; if (!t || !t.range) return a[0]; const r = num(a[1] ?? 1), c = num(a[2] ?? 1); const row = t.vals.length === 1 && a.length < 3 ? 1 : r, col = t.vals.length === 1 && a.length < 3 ? r : c; return (t.vals[row - 1] || [])[col - 1] ?? E('#REF!'); },
        MATCH: a => { const t = a[1]; if (!t || !t.range) return E('#N/A'); const arr = t.vals.length === 1 ? t.vals[0] : t.vals.map(r => r[0]), type = a.length > 2 ? num(a[2]) : 1; const i = type === 0 ? lookupExact(arr, a[0]) : lookupApprox(arr, a[0]); return i < 0 ? E('#N/A') : i + 1; },
    };
    // TEXT(Wert; Format) – die häufigsten Formatcodes
    function textFmt(v, code) {
        if (isE(v)) return v; code = code.split(';')[v < 0 && code.includes(';') ? 1 : 0] || code; if (v < 0 && /;/.test(code)) v = -v;
        let c = code.replace(/\\(.)/g, '"$1"').replace(/\[(?!h+\]|m+\]|s+\])[^\]]*\]/gi, '').replace(/_./g, ' ').replace(/\*./g, '');
        const big = /\[(h+)\]/i.exec(c); if (big) { const tot = Math.round(v * 1440); c = c.replace(/\[h+\]/i, '"' + Math.floor(tot / 60) + '"'); }
        if (/[dmyhsDMYHSjJtT]/.test(c.replace(/"[^"]*"/g, ''))) {          // Datum/Zeit
            const x = dateOf(v), tot = Math.round((v % 1) * 86400), H = Math.floor(tot / 3600), Mi = Math.floor(tot / 60) % 60, Se = tot % 60, MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'], WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
            return c.replace(/"([^"]*)"|yyyy|jjjj|yy|jj|mmmm|mmm|dddd|tttt|ddd|ttt|dd|tt|hh|ss|mm|d|t|h|m|s/gi, (m, lit) => { if (lit !== undefined) return lit; const k = m.toLowerCase();
                return { yyyy: x.y, jjjj: x.y, yy: String(x.y).slice(2), jj: String(x.y).slice(2), mmmm: MON[x.m - 1], mmm: MON[x.m - 1].slice(0, 3), dddd: WD[x.wd], tttt: WD[x.wd], ddd: WD[x.wd].slice(0, 2), ttt: WD[x.wd].slice(0, 2), dd: String(x.d).padStart(2, '0'), tt: String(x.d).padStart(2, '0'), d: x.d, t: x.d, hh: String(H).padStart(2, '0'), h: H, ss: String(Se).padStart(2, '0'), s: Se, mm: /h/i.test(c) ? String(Mi).padStart(2, '0') : String(x.m).padStart(2, '0'), m: /h/i.test(c) ? Mi : x.m }[k]; });
        }
        const pct = /%/.test(c.replace(/"[^"]*"/g, '')); if (pct) v *= 100;
        const body = c.replace(/"[^"]*"/g, ''), dm = /\.([0#]+)/.exec(body), dec = dm ? dm[1].replace(/#/g, '').length : 0;
        if (/\./.test(body) || /#,##/.test(body)) { const thou = /#,##/.test(body); return c.replace(/"([^"]*)"|[#0][#0,.]*[#0]|[#0]/, (m, lit) => lit !== undefined ? lit : nf(v, dec, thou)).replace(/"([^"]*)"/g, '$1'); }
        // nur Ziffernplätze mit Text dazwischen, z. B. 00":"00 → 830 wird 08:30
        const slots = (body.match(/[0#?]/g) || []).length; let digits = String(Math.round(Math.abs(v))); if (digits.length < slots) digits = digits.padStart((body.match(/0/g) || []).length, '0');
        let out = '', di = digits.length - 1; const parts = c.match(/"[^"]*"|[0#?]|./g) || [];
        for (let i = parts.length - 1; i >= 0; i--) { const pt = parts[i]; if (/^[0#?]$/.test(pt)) { out = (di >= 0 ? digits[di--] : (pt === '0' ? '0' : '')) + out; } else out = pt.replace(/^"|"$/g, '') + out; }
        if (di >= 0) out = digits.slice(0, di + 1) + out; return (v < 0 ? '-' : '') + out;
    }
    const LAZY = new Set(['IF', 'IFERROR']);
    // ws: { get(sheetName|null, r, c) → Wert, range(sheetName|null, r1, c1, r2, c2) → 2D }
    function evaluate(tree, ws) {
        const ev = n => {
            switch (n.k) {
                case 'num': case 'str': case 'bool': return n.v;
                case 'err': return E(n.v); case 'empty': return '';
                case 'neg': { const v = num(ev(n.a)); return isE(v) ? v : -v; }
                case 'ref': { const a = parseAddr(n.a); if (!n.b) return ws.get(n.sheet, a.r, a.c); const b = parseAddr(n.b); return ws.range(n.sheet, Math.min(a.r, b.r), Math.min(a.c, b.c), Math.max(a.r, b.r), Math.max(a.c, b.c)); }
                case 'bin': {
                    let l = ev(n.l), r = ev(n.r); if (l && l.range) l = l.vals[0][0]; if (r && r.range) r = r.vals[0][0];
                    if (isE(l)) return l; if (isE(r)) return r;
                    if (n.o === '&') return str(l) + str(r);
                    if (['=', '<>', '<', '>', '<=', '>='].includes(n.o)) {
                        let a = l, b = r; if (a == null || a === '') a = typeof b === 'number' ? 0 : typeof b === 'boolean' ? false : ''; if (b == null || b === '') b = typeof a === 'number' ? 0 : typeof a === 'boolean' ? false : '';
                        const rank = v => typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2; let c;
                        if (rank(a) !== rank(b)) c = rank(a) - rank(b); else if (typeof a === 'string') c = a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0; else c = a < b ? -1 : a > b ? 1 : 0;
                        return { '=': c === 0, '<>': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[n.o];
                    }
                    const x = num(l), y = num(r); if (isE(x)) return x; if (isE(y)) return y;
                    if (n.o === '+') return x + y; if (n.o === '-') return x - y; if (n.o === '*') return x * y;
                    if (n.o === '/') return y === 0 ? E('#DIV/0!') : x / y; if (n.o === '^') { const p = Math.pow(x, y); return isFinite(p) ? p : E('#NUM!'); }
                    return E('#VALUE!');
                }
                case 'fn': {
                    if (['ROW', 'COLUMN', 'ROWS', 'COLUMNS'].includes(n.v)) {          // brauchen den Bezug selbst, nicht den Wert
                        const a = n.args[0]; if (!a || a.k === 'empty') return n.v === 'ROW' ? (ws.cur ? ws.cur.r + 1 : 1) : n.v === 'COLUMN' ? (ws.cur ? ws.cur.c + 1 : 1) : 1;
                        if (a.k !== 'ref') return E('#VALUE!'); const p1 = parseAddr(a.a), p2 = a.b ? parseAddr(a.b) : p1;
                        return n.v === 'ROW' ? Math.min(p1.r, p2.r) + 1 : n.v === 'COLUMN' ? Math.min(p1.c, p2.c) + 1 : n.v === 'ROWS' ? Math.abs(p2.r - p1.r) + 1 : Math.abs(p2.c - p1.c) + 1;
                    }
                    const f = FN[n.v]; if (!f) return E('#NAME?');
                    if (LAZY.has(n.v)) { const lazy = i => { const v = ev(n.args[i]); return v && v.range ? v.vals[0][0] : v; }; return f(n.args, lazy); }
                    const args = n.args.map(ev);
                    if (!['COUNT', 'COUNTA', 'COUNTBLANK', 'ISBLANK', 'ISNUMBER', 'ISTEXT', 'IFERROR'].includes(n.v)) { const er = args.find(isE); if (er) return er; }
                    try { const v = f(args.map(x => x)); return typeof v === 'number' && !isFinite(v) ? E('#NUM!') : v; } catch (x) { return E('#VALUE!'); }
                }
            }
            return E('#VALUE!');
        };
        let v = ev(tree); if (v && v.range) v = v.vals.length === 1 && v.vals[0].length === 1 ? v.vals[0][0] : E('#VALUE!');
        return v;
    }

    // ---------- Zahlen lesen und anzeigen (deutsch) ----------
    function parseNum(s) {
        s = String(s).trim().replace(/ /g, ' '); if (!s) return null;
        let m = /^([+-]?)([\d.]*\d)(?:,(\d+))?$/.exec(s.replace(/\s/g, ''));                       // 1.234,56
        if (m && (!/\./.test(m[2]) || /^\d{1,3}(\.\d{3})+$/.test(m[2]))) return +(m[1] + m[2].replace(/\./g, '') + (m[3] ? '.' + m[3] : ''));
        m = /^([+-]?\d+)\.(\d+)$/.exec(s); if (m) return +s;                                        // 12.5 (englisch, ohne Tausender)
        return null;
    }
    // Eingabe deuten: Zahl, Prozent, Währung, Datum, Uhrzeit, Wahrheitswert, Text
    function parseInput(s) {
        const t = String(s).trim(); if (t === '') return { v: '' };
        if (/^=./.test(t)) return { f: t.slice(1) };
        let m;
        if ((m = /^(-?[\d.,\s]+)\s*%$/.exec(t)) && parseNum(m[1]) !== null) return { v: parseNum(m[1]) / 100, fmt: 'pct' };
        if ((m = /^(-?[\d.,\s]+)\s*€$|^€\s*(-?[\d.,\s]+)$/.exec(t))) { const n = parseNum(m[1] || m[2]); if (n !== null) return { v: n, fmt: 'cur' }; }
        if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})?$/.exec(t))) { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear(); const d = +m[1], mo = +m[2]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { v: ser(y, mo, d), fmt: 'date' }; }
        if ((m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t))) return { v: (+m[1] * 3600 + +m[2] * 60 + +(m[3] || 0)) / 86400, fmt: 'time' };
        const n = parseNum(t); if (n !== null) return { v: n };
        if (/^(wahr|true)$/i.test(t)) return { v: true }; if (/^(falsch|false)$/i.test(t)) return { v: false };
        return { v: t.replace(/^'/, '') };
    }
    const nf = (n, d, thou) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: thou });
    function fmtGen(n) { if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n); const a = Math.abs(n); if (a !== 0 && (a < 1e-9 || a >= 1e15)) return n.toExponential(5).replace('.', ','); return String(+n.toPrecision(11)).replace('.', ','); }
    function fmtVal(v, s) {
        if (isE(v)) return ERR_DE[v.e] || v.e;
        if (typeof v === 'boolean') return v ? 'WAHR' : 'FALSCH';
        if (typeof v !== 'number') return v == null ? '' : String(v);
        if (s && s.code) { try { const t = textFmt(v, s.code); if (!isE(t)) return t; } catch (x) {} }
        const f = (s && s.fmt) || 'gen', d = s && s.dec != null ? s.dec : null;
        switch (f) {
            case 'num': return nf(v, d ?? 2, true); case 'int': return nf(v, d ?? 0, true); case 'cur': return nf(v, d ?? 2, true) + ' €';
            case 'pct': return nf(v * 100, d ?? 0, true) + ' %';
            case 'date': { const x = dateOf(v); return `${String(x.d).padStart(2, '0')}.${String(x.m).padStart(2, '0')}.${x.y}`; }
            case 'time': { const tot = Math.round((v % 1) * 1440); return `${Math.floor(tot / 60)}:${String(tot % 60).padStart(2, '0')}`; }
            case 'dtime': { const x = dateOf(v); return `${String(x.d).padStart(2, '0')}.${String(x.m).padStart(2, '0')}.${x.y} ${x.h}:${String(x.mi).padStart(2, '0')}`; }
            default: return d != null ? nf(v, d, false) : fmtGen(v);
        }
    }

    // ======================================================================
    //  .xlsx
    // ======================================================================
    const NSM = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', NSR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const X = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    const FMT_CODE = { num: ['#,##0.00', 4], int: ['#,##0', 3], cur: ['#,##0.00\\ "€"', 0], pct: ['0%', 9], date: ['m/d/yyyy', 14], time: ['h:mm', 20], dtime: ['m/d/yy h:mm', 22] };
    // book: { sheets: [{ name, cells: Map(key → { v, f, s }), cols: { c: px } }] }
    async function writeXlsx(book, calc) {
        const fonts = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
        const numFmts = [], xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'], xfMap = { '{}': 0 };
        const idx = (arr, x) => { let i = arr.indexOf(x); if (i < 0) { arr.push(x); i = arr.length - 1; } return i; };
        const fmtId = s => { if (s.code) return custom(s.code); if (!s.fmt || s.fmt === 'gen') return s.dec != null ? custom(s.dec ? '0.' + '0'.repeat(s.dec) : '0') : 0; const [code, id] = FMT_CODE[s.fmt] || ['General', 0];
            const c2 = s.dec != null && /0\.00|^#,##0$|^0%$/.test(code) ? code.replace(/0\.00|#,##0$|0%/, m => m === '0%' ? (s.dec ? '0.' + '0'.repeat(s.dec) + '%' : '0%') : m.startsWith('#') ? (s.dec ? '#,##0.' + '0'.repeat(s.dec) : '#,##0') : (s.dec ? '0.' + '0'.repeat(s.dec) : '0')) : code;
            return c2 === code && id ? id : custom(c2); };
        function custom(code) { let i = numFmts.findIndex(x => x[1] === code); if (i < 0) { numFmts.push([164 + numFmts.length, code]); i = numFmts.length - 1; } return numFmts[i][0]; }
        const styleId = s => {
            if (!s) return 0; const k = JSON.stringify(s); if (k in xfMap) return xfMap[k];
            const font = `<font>${s.b ? '<b/>' : ''}${s.i ? '<i/>' : ''}${s.u ? '<u/>' : ''}<sz val="${s.fs || 11}"/>${s.color ? `<color rgb="FF${s.color}"/>` : ''}<name val="Calibri"/><family val="2"/></font>`;
            const fill = s.fill ? `<fill><patternFill patternType="solid"><fgColor rgb="FF${s.fill}"/><bgColor indexed="64"/></patternFill></fill>` : null;
            const bd = s.bd ? '<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>' : null;
            const fi = idx(fonts, font), fl = fill ? idx(fills, fill) : 0, bi = bd ? idx(borders, bd) : 0, nf = fmtId(s);
            const al = s.al || s.wrap ? `<alignment${s.al ? ` horizontal="${{ l: 'left', c: 'center', r: 'right' }[s.al]}"` : ''}${s.wrap ? ' wrapText="1"' : ''} vertical="center"/>` : '';
            xfs.push(`<xf numFmtId="${nf}" fontId="${fi}" fillId="${fl}" borderId="${bi}" xfId="0"${nf ? ' applyNumberFormat="1"' : ''}${fi ? ' applyFont="1"' : ''}${fl ? ' applyFill="1"' : ''}${bi ? ' applyBorder="1"' : ''}${al ? ' applyAlignment="1">' + al + '</xf>' : '/>'}`);
            return (xfMap[k] = xfs.length - 1);
        };
        // Diagramme (OS/chart.js) als echte Excel-Diagramme
        const extra = [], ctx = [], DRW = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing', REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
        let nChart = 0, nDraw = 0;
        function drawingOf(sh, si) {
            const list = (sh.charts || []).filter(c => c && c.src); if (!list.length || !window.JMCHART) return '';
            const d = ++nDraw, get = (r, c) => { const cell = sh.cells.get(r + ',' + c); if (!cell) return null; return cell.f ? calc(si, r, c) : cell.v; }, E = px => Math.round(px * 9525);
            const anchors = list.map((ch, i) => { const k = ++nChart, m = JMCHART.data(ch, get);
                extra.push([`xl/charts/chart${k}.xml`, JMCHART.xml(m, sh.name)]); ctx.push(`<Override PartName="/xl/charts/chart${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
                return { rel: `<Relationship Id="rId${i + 1}" Type="${REL}/chart" Target="../charts/chart${k}.xml"/>`, xml: `<xdr:oneCellAnchor><xdr:from><xdr:col>${ch.c || 0}</xdr:col><xdr:colOff>${E(ch.ox || 0)}</xdr:colOff><xdr:row>${ch.r || 0}</xdr:row><xdr:rowOff>${E(ch.oy || 0)}</xdr:rowOff></xdr:from><xdr:ext cx="${E(ch.w || 480)}" cy="${E(ch.h || 288)}"/><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Diagramm ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>` }; });
            extra.push([`xl/drawings/drawing${d}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="${DRW}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}">${anchors.map(a => a.xml).join('')}</xdr:wsDr>`]);
            extra.push([`xl/drawings/_rels/drawing${d}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${anchors.map(a => a.rel).join('')}</Relationships>`]);
            extra.push([`xl/worksheets/_rels/sheet${si + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/drawing" Target="../drawings/drawing${d}.xml"/></Relationships>`]);
            ctx.push(`<Override PartName="/xl/drawings/drawing${d}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
            return '<drawing r:id="rId1"/>';
        }
        const sheetsXml = book.sheets.map((sh, si) => {
            const rows = new Map(); let maxR = 0, maxC = 0;
            sh.cells.forEach((cell, k) => { const [r, c] = k.split(',').map(Number); if (!rows.has(r)) rows.set(r, []); rows.get(r).push([c, cell]); maxR = Math.max(maxR, r); maxC = Math.max(maxC, c); });
            const rowXml = [...rows.keys()].sort((a, b) => a - b).map(r => `<row r="${r + 1}">${rows.get(r).sort((a, b) => a[0] - b[0]).map(([c, cell]) => {
                const ref = addr(r, c), s = styleId(cell.s), sa = s ? ` s="${s}"` : '';
                if (cell.f) { const v = calc(si, r, c); const vv = isE(v) ? `<v>${X(v.e)}</v>` : typeof v === 'number' ? `<v>${v}</v>` : typeof v === 'boolean' ? `<v>${v ? 1 : 0}</v>` : `<v>${X(v)}</v>`;
                    const t = isE(v) ? ' t="e"' : typeof v === 'string' ? ' t="str"' : typeof v === 'boolean' ? ' t="b"' : ''; return `<c r="${ref}"${sa}${t}><f>${X(cell.f)}</f>${vv}</c>`; }
                if (typeof cell.v === 'number') return `<c r="${ref}"${sa}><v>${cell.v}</v></c>`;
                if (typeof cell.v === 'boolean') return `<c r="${ref}"${sa} t="b"><v>${cell.v ? 1 : 0}</v></c>`;
                if (cell.v === '' || cell.v == null) return s ? `<c r="${ref}"${sa}/>` : '';
                return `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${X(cell.v)}</t></is></c>`;
            }).join('')}</row>`).join('');
            const cols = Object.keys(sh.cols || {}).map(Number).sort((a, b) => a - b).map(c => `<col min="${c + 1}" max="${c + 1}" width="${(sh.cols[c] / 7.2).toFixed(2)}" customWidth="1"/>`).join('');
            const freeze = sh.freeze ? `<sheetViews><sheetView workbookViewId="0"${si === 0 ? ' tabSelected="1"' : ''}><pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : `<sheetViews><sheetView workbookViewId="0"${si === 0 ? ' tabSelected="1"' : ''}/></sheetViews>`;
            return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NSM}" xmlns:r="${NSR}"><dimension ref="A1:${addr(maxR, maxC)}"/>${freeze}<sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${rowXml}</sheetData><pageMargins left="0.7" right="0.7" top="0.78740157499999996" bottom="0.78740157499999996" header="0.3" footer="0.3"/>${drawingOf(sh, si)}</worksheet>`;
        });
        const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NSM}">${numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.map(([id, c]) => `<numFmt numFmtId="${id}" formatCode="${X(c)}"/>`).join('')}</numFmts>` : ''}<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
        const n = book.sheets.length;
        const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NSM}" xmlns:r="${NSR}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${book.sheets.map((s, i) => `<sheet name="${X(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
        const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${book.sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
        const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${book.sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ctx.join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
        const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
        const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
        const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>${X(book.author || '')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
        const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>J.Mainz Tabellen</Application></Properties>`;
        const files = [['[Content_Types].xml', ct], ['_rels/.rels', rels], ['xl/workbook.xml', wb], ['xl/_rels/workbook.xml.rels', wbRels], ['xl/styles.xml', styles], ['docProps/core.xml', core], ['docProps/app.xml', app], ...sheetsXml.map((x, i) => [`xl/worksheets/sheet${i + 1}.xml`, x]), ...extra];
        const z = await JMZIP.zip(files); return new Blob([z], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    async function readXlsx(buf) {
        const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf), ents = JMZIP.list(bytes), map = {};
        ents.forEach(e => { map[e.name.replace(/^\/+/, '')] = e; });
        const get = async n => { const e = map[n]; return e ? new TextDecoder().decode(await JMZIP.extract(bytes, e)) : ''; };
        if (!map['xl/workbook.xml']) throw new Error('Das ist keine Excel-Datei (.xlsx).');
        const dp = new DOMParser(), xml = s => dp.parseFromString(s || '<x/>', 'application/xml');
        const T = (el, n) => el ? [...el.getElementsByTagNameNS(NSM, n)] : [];
        const wb = xml(await get('xl/workbook.xml')), wr = xml(await get('xl/_rels/workbook.xml.rels')), REL = {};
        [...wr.getElementsByTagName('Relationship')].forEach(r => { REL[r.getAttribute('Id')] = r.getAttribute('Target'); });
        const shared = T(xml(await get('xl/sharedStrings.xml')), 'si').map(si => T(si, 't').filter(t => !t.closest || !t.parentElement || t.parentElement.localName !== 'rPh').map(t => t.textContent).join(''));
        // Stile
        const st = xml(await get('xl/styles.xml')), fmts = {}; T(st, 'numFmt').forEach(f => { fmts[f.getAttribute('numFmtId')] = f.getAttribute('formatCode'); });
        const fontsX = T(T(st, 'fonts')[0], 'font'), fillsX = T(T(st, 'fills')[0], 'fill'), bordersX = T(T(st, 'borders')[0], 'border');
        const rgb = el => { if (!el) return ''; const v = el.getAttribute('rgb'); return v && /^[0-9A-Fa-f]{8}$/.test(v) ? v.slice(2).toUpperCase() : v && /^[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : ''; };
        const fmtKind = (id, code) => { id = +id; if ([14, 15, 16, 17, 22].includes(id)) return id === 22 ? 'dtime' : 'date'; if ([18, 19, 20, 21, 45, 46, 47].includes(id)) return 'time'; if ([9, 10].includes(id)) return 'pct'; if ([3, 37, 38].includes(id)) return 'int'; if ([4, 39, 40].includes(id)) return 'num'; if ([5, 6, 7, 8].includes(id)) return 'cur';
            if (!code) return 'gen'; const c = code.replace(/"[^"]*"/g, m => /€/.test(m) ? '€' : '').replace(/\[[^\]]*\]/g, m => /€|EUR/.test(m) ? '€' : '');
            if (/€/.test(c)) return 'cur'; if (/%/.test(c)) return 'pct'; if (/[dy]/i.test(c) && /h/i.test(c)) return 'dtime'; if (/[dy]/i.test(c) || /m{3,}/i.test(c)) return 'date'; if (/h/i.test(c) || /:mm/.test(c)) return 'time'; if (/0\.0/.test(c)) return /#,##/.test(c) ? 'num' : 'gen'; if (/#,##0/.test(c)) return 'int'; return 'gen'; };
        const decOf = code => { const m = /0\.(0+)/.exec(code || ''); return m ? m[1].length : null; };
        const XF = T(T(st, 'cellXfs')[0], 'xf').map(x => {
            const s = {}, id = x.getAttribute('numFmtId') || '0', code = fmts[id], k = fmtKind(id, code); if (k !== 'gen') s.fmt = k;
            if (code && +id >= 164 && (k === 'date' || k === 'time' || k === 'dtime' || /"[^"]+"|\[h\]/i.test(code))) s.code = code;          // eigenes Format (z. B. TTT, TT.) behalten const d = decOf(code || ({ 4: '0.00', 2: '0.00', 10: '0.00' }[id])); if (d != null && ((k === 'num' && d !== 2) || (k === 'cur' && d !== 2) || (k === 'pct' && d) || (k === 'gen' && d))) s.dec = d; if (k === 'gen' && +id === 2) s.dec = 2;
            const f = fontsX[+x.getAttribute('fontId') || 0]; if (f) { if (T(f, 'b')[0]) s.b = true; if (T(f, 'i')[0]) s.i = true; if (T(f, 'u')[0]) s.u = true; const c = rgb(T(f, 'color')[0]); if (c && c !== '000000') s.color = c; const sz = +(T(f, 'sz')[0] || { getAttribute: () => 11 }).getAttribute('val'); if (sz && sz !== 11) s.fs = sz; }
            const fl = fillsX[+x.getAttribute('fillId') || 0]; if (fl) { const p = T(fl, 'patternFill')[0]; if (p && p.getAttribute('patternType') === 'solid') { const c = rgb(T(p, 'fgColor')[0]); if (c && c !== 'FFFFFF') s.fill = c; } }
            const bd = bordersX[+x.getAttribute('borderId') || 0]; if (bd && ['left', 'right', 'top', 'bottom'].filter(n => { const e = T(bd, n)[0]; return e && e.getAttribute('style'); }).length >= 2) s.bd = true;
            const al = T(x, 'alignment')[0]; if (al) { const h = al.getAttribute('horizontal'); if (h === 'center' || h === 'centerContinuous') s.al = 'c'; else if (h === 'right') s.al = 'r'; else if (h === 'left') s.al = 'l'; if (al.getAttribute('wrapText') === '1') s.wrap = true; }
            return Object.keys(s).length ? s : null;
        });
        const sheets = [];
        for (const sh of T(wb, 'sheet')) {
            const rid = sh.getAttributeNS(NSR, 'id') || sh.getAttribute('r:id'); let p = REL[rid] || ''; p = p.startsWith('/') ? p.slice(1) : 'xl/' + p.replace(/^\.\//, '');
            const doc = xml(await get(p)), cells = new Map(), cols = {}, sharedF = {};
            T(doc, 'col').forEach(c => { const w = +c.getAttribute('width'); if (!w || c.getAttribute('customWidth') !== '1' && !c.getAttribute('width')) return; for (let i = +c.getAttribute('min'); i <= Math.min(+c.getAttribute('max'), 200); i++) cols[i - 1] = Math.round(w * 7.2); });
            for (const c of T(doc, 'c')) {
                const ref = parseAddr(c.getAttribute('r') || ''); if (!ref) continue; const t = c.getAttribute('t'), v = T(c, 'v')[0], f = T(c, 'f')[0], s = XF[+c.getAttribute('s') || 0];
                const cell = {}; if (s) cell.s = Object.assign({}, s);
                if (f) {
                    let ft = f.textContent;
                    if (f.getAttribute('t') === 'shared') { const si = f.getAttribute('si'); if (ft) sharedF[si] = { f: ft, r: ref.r, c: ref.c }; else if (sharedF[si]) ft = offsetFormula(sharedF[si].f, ref.r - sharedF[si].r, ref.c - sharedF[si].c); }
                    if (ft) cell.f = ft.replace(/_xlfn\./g, '');
                    if (cell.f && v) cell.cv = t === 'str' || t === 'e' ? v.textContent : t === 'b' ? v.textContent === '1' : +v.textContent;          // zuletzt berechneter Wert (für Serienbrief, Suche)
                }
                if (!cell.f) {
                    if (t === 's' && v) cell.v = shared[+v.textContent] ?? ''; else if (t === 'inlineStr') cell.v = T(c, 't').map(x => x.textContent).join(''); else if (t === 'str') cell.v = v ? v.textContent : ''; else if (t === 'b') cell.v = v ? v.textContent === '1' : false;
                    else if (t === 'e') cell.v = v ? v.textContent : ''; else if (v) cell.v = +v.textContent;
                }
                if (cell.f || (cell.v !== undefined && cell.v !== '') || cell.s) cells.set(key(ref.r, ref.c), cell);
            }
            const pane = T(doc, 'pane')[0], fr = pane && pane.getAttribute('state') === 'frozen' ? +pane.getAttribute('ySplit') || 0 : 0;
            const charts = [];
            try { const dEl = T(doc, 'drawing')[0]; if (dEl && window.JMCHART) {
                const dir = p.replace(/[^/]+$/, ''), relsOf = async f => { const x = xml(await get(f.replace(/([^/]+)$/, '_rels/$1.rels'))), o = {}; [...x.getElementsByTagName('Relationship')].forEach(r => { o[r.getAttribute('Id')] = r.getAttribute('Target'); }); return o; };
                const res = (base, t) => { if (t.startsWith('/')) return t.slice(1); const parts = (base + t).split('/'), out = []; parts.forEach(x => { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); }); return out.join('/'); };
                const sr = await relsOf(p), dp_ = res(dir, sr[dEl.getAttributeNS(NSR, 'id') || dEl.getAttribute('r:id')] || ''); if (dp_ && map[dp_]) {
                    const dx = xml(await get(dp_)), dr = await relsOf(dp_), XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing', Q = (el, n) => el ? [...el.getElementsByTagNameNS(XDR, n)] : [];
                    const num = (el, n) => +((Q(el, n)[0] || {}).textContent || 0), cw = c => cols[c] || 64;
                    for (const an of [...dx.documentElement.children]) {
                        const ce = an.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/chart', 'chart')[0]; if (!ce) continue;
                        const target = dr[ce.getAttributeNS(NSR, 'id') || ce.getAttribute('r:id')]; if (!target) continue;
                        const m = JMCHART.parse(await get(res(dp_.replace(/[^/]+$/, ''), target))); if (!m) continue;
                        const fr = Q(an, 'from')[0], to = Q(an, 'to')[0], ext = Q(an, 'ext')[0], c = num(fr, 'col'), r = num(fr, 'row'), ox = Math.round(num(fr, 'colOff') / 9525), oy = Math.round(num(fr, 'rowOff') / 9525);
                        let w = 480, h = 288;
                        if (ext) { w = Math.round(+ext.getAttribute('cx') / 9525); h = Math.round(+ext.getAttribute('cy') / 9525); }
                        else if (to) { const c2 = num(to, 'col'), r2 = num(to, 'row'); w = 0; for (let i = c; i < c2; i++) w += cw(i); w += Math.round(num(to, 'colOff') / 9525) - ox; h = (r2 - r) * 24 + Math.round(num(to, 'rowOff') / 9525) - oy; }
                        const ch = { type: m.type, title: m.title, c, r, ox: Math.max(0, ox), oy: Math.max(0, Math.min(23, oy)), w: Math.max(160, w || 480), h: Math.max(120, h || 288), cache: { cats: m.cats, series: m.series } };
                        if (m.src && m.src.sheet.toLowerCase() === (sh.getAttribute('name') || '').toLowerCase()) ch.src = { r1: m.src.r1, c1: m.src.c1, r2: m.src.r2, c2: m.src.c2 };
                        charts.push(ch);
                    } } } } catch (x) { /* Diagramm nicht lesbar – Tabelle trotzdem öffnen */ }
            sheets.push({ name: sh.getAttribute('name') || 'Tabelle' + (sheets.length + 1), cells, cols, freeze: fr, charts });
        }
        if (!sheets.length) sheets.push({ name: 'Tabelle1', cells: new Map(), cols: {} });
        return { sheets };
    }
    // CSV (Semikolon oder Komma, deutsche Zahlen)
    function readCsv(text) {
        text = text.replace(/^﻿/, ''); const first = text.split('\n')[0] || '', sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
        const rows = []; let row = [], cur = '', q = false;
        for (let i = 0; i < text.length; i++) { const ch = text[i];
            if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
            if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; } else cur += ch; }
        if (cur || row.length) { row.push(cur); rows.push(row); }
        const cells = new Map(); rows.forEach((r, ri) => r.forEach((v, ci) => { const p = parseInput(v); if (p.v === '' && !p.f) return; const cell = p.f ? { f: (() => { try { return toEN(p.f); } catch (x) { return null; } })() } : { v: p.v }; if (p.f && !cell.f) cell.v = v; if (p.fmt) cell.s = { fmt: p.fmt }; cells.set(key(ri, ci), cell); }));
        return { sheets: [{ name: 'Tabelle1', cells, cols: {} }] };
    }

    function renameSheetRefs(f, old, nu) { let t; try { t = lex(f, false); } catch (x) { return f; } let ch = false; t.forEach(x => { if (x.t === 'ref' && x.sheet && x.sheet.toLowerCase() === old.toLowerCase()) { x.sheet = nu; ch = true; } }); return ch ? emit(t, false) : f; }
    window.JMSHEET = { renameSheetRefs, colS, colN, addr, parseAddr, key, lex, toEN, toDE, parse, evaluate, offsetFormula, insertShift, parseNum, parseInput, fmtVal, fmtGen, isE, ERR_DE, DE, EN, FN, writeXlsx, readXlsx, readCsv, ser, dateOf };
})();
