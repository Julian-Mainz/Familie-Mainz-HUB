// OS/chart.js – Diagramme für J.Mainz Office (Säulen, Balken, Linie, Kreis).
// Wird von Tabellen benutzt (zeichnen + als echtes Excel-Diagramm in die .xlsx schreiben/lesen) und von Writer/Präsentation (Diagramm als Bild übernehmen).
(function () {
    'use strict';
    const PAL = ['4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '264478', '9E480E', '636363', '997300'];
    const TYPES = { col: ['Säulen', 'fa-chart-column'], bar: ['Balken', 'fa-chart-bar'], line: ['Linie', 'fa-chart-line'], pie: ['Kreis', 'fa-chart-pie'] };
    const X = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const colS = c => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
    const colN = s => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    const isNum = v => typeof v === 'number' && isFinite(v);
    const txt = v => v == null ? '' : typeof v === 'object' && v.e ? v.e : typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6).replace('.', ',') : String(v);

    // Daten aus einem Zellbereich: erste Spalte = Beschriftungen (wenn Text), erste Zeile = Reihennamen (wenn Text)
    function data(def, get) {
        const { r1, c1, r2, c2 } = def.src, sv = (r, c) => { const v = get(r, c); return v && typeof v === 'object' && v.e ? null : v; };
        let hdr = false, catCol = false;
        for (let c = c1 + (c2 > c1 ? 1 : 0); c <= c2; c++) { const v = sv(r1, c); if (v != null && v !== '' && !isNum(v)) hdr = true; }
        if (c2 > c1) for (let r = r1 + (hdr ? 1 : 0); r <= r2; r++) { const v = sv(r, c1); if (v != null && v !== '' && !isNum(v)) catCol = true; }
        if (c2 > c1 && r1 < r2 && (sv(r1, c1) == null || sv(r1, c1) === '') && hdr) catCol = true;
        const dr1 = r1 + (hdr ? 1 : 0), dc1 = c1 + (catCol ? 1 : 0);
        const cats = [], series = [];
        for (let r = dr1; r <= r2; r++) cats.push(catCol ? txt(sv(r, c1)) : String(r - dr1 + 1));
        for (let c = dc1; c <= c2; c++) series.push({ name: hdr ? txt(sv(r1, c)) : 'Reihe ' + (c - dc1 + 1), vals: cats.map((_, i) => { const v = sv(dr1 + i, c); return isNum(v) ? v : null; }),
            ref: { name: hdr ? { r: r1, c } : null, vals: { r1: dr1, c1: c, r2, c2: c } } });
        return { type: def.type || 'col', title: def.title || '', cats, series, catRef: catCol && dr1 <= r2 ? { r1: dr1, c1, r2, c2: c1 } : null };
    }

    // ---------- Zeichnen (SVG) ----------
    const nf = v => { const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio.' : v.toLocaleString('de-DE', { maximumFractionDigits: a < 10 ? 2 : a < 1000 ? 1 : 0 }); };
    function nice(lo, hi) {
        if (lo === hi) { hi = lo + 1; lo = Math.min(0, lo); }
        const span = hi - lo, raw = span / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), st = [1, 2, 2.5, 5, 10].map(x => x * p).find(x => x >= raw) || raw;
        return { lo: Math.floor(lo / st) * st, hi: Math.ceil(hi / st) * st, st };
    }
    const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
    function svg(m, W, H, opt = {}) {
        const fg = opt.fg || '#404040', grid = opt.grid || '#D9D9D9', bg = opt.bg || '#FFFFFF', F = 'font-family="Calibri, Carlito, Segoe UI, Arial, sans-serif"';
        const ser = m.series.filter(s => s.vals.some(v => v != null)), out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ${F}><rect width="${W}" height="${H}" fill="${bg}"/>`];
        let top = 10; if (m.title) { out.push(`<text x="${W / 2}" y="26" text-anchor="middle" font-size="17" fill="${fg}">${X(cut(m.title, 60))}</text>`); top = 40; }
        if (!ser.length || !m.cats.length) { out.push(`<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="13" fill="#7F7F7F">Keine Zahlen im gewählten Bereich</text></svg>`); return out.join(''); }
        const legendItems = m.type === 'pie' ? m.cats : ser.map(s => s.name), showLeg = m.type === 'pie' || ser.length > 1, legH = showLeg ? 26 : 0;
        if (showLeg) { let lx = 0; const items = legendItems.map((n, i) => { const t = cut(String(n || ''), 18), w = 18 + t.length * 6.6 + 14, x = lx; lx += w; return { t, x, i }; }); const off = Math.max(8, (W - lx) / 2);
            items.forEach(({ t, x, i }) => { if (off + x + 20 > W) return; out.push(`<rect x="${off + x}" y="${H - 19}" width="10" height="10" fill="#${PAL[i % PAL.length]}"/><text x="${off + x + 15}" y="${H - 10}" font-size="12" fill="${fg}">${X(t)}</text>`); }); }
        if (m.type === 'pie') {
            const s = ser[0], vals = s.vals.map(v => Math.max(0, v || 0)), sum = vals.reduce((a, b) => a + b, 0) || 1, cx = W / 2, cy = top + (H - top - legH) / 2, r = Math.max(10, Math.min(W / 2 - 20, (H - top - legH) / 2 - 8));
            let a = -Math.PI / 2;
            vals.forEach((v, i) => { if (!v) return; const b = a + v / sum * Math.PI * 2, big = b - a > Math.PI ? 1 : 0, p = t => `${(cx + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`;
                out.push(v === sum ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#${PAL[i % PAL.length]}"/>` : `<path d="M${cx},${cy} L${p(a)} A${r},${r} 0 ${big} 1 ${p(b)} Z" fill="#${PAL[i % PAL.length]}" stroke="${bg}" stroke-width="1.5"/>`);
                const mid = (a + b) / 2, pc = Math.round(v / sum * 100); if (pc >= 5) out.push(`<text x="${(cx + r * .62 * Math.cos(mid)).toFixed(1)}" y="${(cy + r * .62 * Math.sin(mid) + 4).toFixed(1)}" text-anchor="middle" font-size="12" fill="#fff">${pc} %</text>`);
                a = b; });
            out.push('</svg>'); return out.join('');
        }
        const all = ser.flatMap(s => s.vals.filter(v => v != null)), sc = nice(Math.min(0, ...all), Math.max(0, ...all));
        const horiz = m.type === 'bar', n = m.cats.length;
        const lblW = horiz ? Math.min(140, 12 + Math.max(...m.cats.map(c => cut(c, 20).length)) * 6.4) : 12 + Math.max(...[sc.lo, sc.hi].map(v => nf(v).length)) * 6.6;
        const L = lblW + 6, R = W - 14, T = top + 4, B = H - legH - (horiz ? 22 : 24);
        const pos = v => horiz ? L + (v - sc.lo) / (sc.hi - sc.lo) * (R - L) : B - (v - sc.lo) / (sc.hi - sc.lo) * (B - T);
        for (let v = sc.lo; v <= sc.hi + sc.st / 2; v += sc.st) { const p = pos(v).toFixed(1);
            out.push(horiz ? `<line x1="${p}" y1="${T}" x2="${p}" y2="${B}" stroke="${grid}"/><text x="${p}" y="${B + 16}" text-anchor="middle" font-size="11" fill="${fg}">${nf(v)}</text>` : `<line x1="${L}" y1="${p}" x2="${R}" y2="${p}" stroke="${grid}"/><text x="${L - 6}" y="${+p + 4}" text-anchor="end" font-size="11" fill="${fg}">${nf(v)}</text>`); }
        const band = (horiz ? B - T : R - L) / n, every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((horiz ? B - T : R - L) / (horiz ? 16 : 54)))));
        m.cats.forEach((c, i) => { if (i % every) return; const mid = (horiz ? T : L) + band * (i + .5);
            out.push(horiz ? `<text x="${L - 6}" y="${(mid + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${fg}">${X(cut(c, 20))}</text>` : `<text x="${mid.toFixed(1)}" y="${B + 16}" text-anchor="middle" font-size="11" fill="${fg}">${X(cut(c, Math.max(4, Math.floor(band * every / 6.5))))}</text>`); });
        const z = pos(0);
        if (m.type === 'line') {
            ser.forEach((s, k) => { const col = '#' + PAL[k % PAL.length]; let d = ''; s.vals.forEach((v, i) => { if (v == null) return; const x = L + band * (i + .5), y = pos(v); d += (d ? ' L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1); });
                out.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>`); s.vals.forEach((v, i) => { if (v != null) out.push(`<circle cx="${(L + band * (i + .5)).toFixed(1)}" cy="${pos(v).toFixed(1)}" r="3.5" fill="${col}"/>`); }); });
        } else {
            const gw = band * .66, bw = gw / ser.length;
            ser.forEach((s, k) => s.vals.forEach((v, i) => { if (v == null) return; const a = (horiz ? T : L) + band * i + (band - gw) / 2 + bw * k, p = pos(v);
                out.push(horiz ? `<rect x="${Math.min(z, p).toFixed(1)}" y="${(a + bw * .06).toFixed(1)}" width="${Math.abs(p - z).toFixed(1)}" height="${(bw * .88).toFixed(1)}" fill="#${PAL[k % PAL.length]}"/>` : `<rect x="${(a + bw * .06).toFixed(1)}" y="${Math.min(z, p).toFixed(1)}" width="${(bw * .88).toFixed(1)}" height="${Math.abs(p - z).toFixed(1)}" fill="#${PAL[k % PAL.length]}"/>`); }));
        }
        out.push(horiz ? `<line x1="${z.toFixed(1)}" y1="${T}" x2="${z.toFixed(1)}" y2="${B}" stroke="#BFBFBF"/>` : `<line x1="${L}" y1="${z.toFixed(1)}" x2="${R}" y2="${z.toFixed(1)}" stroke="#BFBFBF"/>`);
        out.push('</svg>'); return out.join('');
    }
    // als PNG (für Writer, Präsentation, Zwischenablage)
    function png(m, W, H, scale = 2) {
        return new Promise((res, rej) => {
            const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale; const g = c.getContext('2d'); g.scale(scale, scale); g.drawImage(img, 0, 0, W, H); c.toBlob(b => b ? res(b) : rej(new Error('Bild konnte nicht erzeugt werden.')), 'image/png'); };
            img.onerror = () => rej(new Error('Bild konnte nicht erzeugt werden.')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(m, W, H));
        });
    }

    // ---------- Excel-Diagramm (DrawingML) ----------
    const NSC = 'http://schemas.openxmlformats.org/drawingml/2006/chart', NSA = 'http://schemas.openxmlformats.org/drawingml/2006/main';
    const q = sn => /^[A-Za-z_][\w.]*$/.test(sn) ? sn : `'${sn.replace(/'/g, "''")}'`;
    const rng = (sn, a) => `${q(sn)}!$${colS(a.c1)}$${a.r1 + 1}${a.r1 === a.r2 && a.c1 === a.c2 ? '' : `:$${colS(a.c2)}$${a.r2 + 1}`}`;
    function xml(m, sheetName) {
        const strCache = list => `<c:strCache><c:ptCount val="${list.length}"/>${list.map((t, i) => `<c:pt idx="${i}"><c:v>${X(t)}</c:v></c:pt>`).join('')}</c:strCache>`;
        const numCache = list => `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${list.length}"/>${list.map((v, i) => v == null ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numCache>`;
        const sers = m.series.map((s, k) => {
            const col = PAL[k % PAL.length], tx = s.ref && s.ref.name ? `<c:tx><c:strRef><c:f>${X(rng(sheetName, { r1: s.ref.name.r, c1: s.ref.name.c, r2: s.ref.name.r, c2: s.ref.name.c }))}</c:f>${strCache([s.name])}</c:strRef></c:tx>` : `<c:tx><c:v>${X(s.name)}</c:v></c:tx>`;
            const sp = m.type === 'line' ? `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${col}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${col}"/></a:solidFill></c:spPr></c:marker>`
                : m.type === 'pie' ? m.cats.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${PAL[i % PAL.length]}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`).join('')
                : `<c:spPr><a:solidFill><a:srgbClr val="${col}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>`;
            const cat = m.catRef ? `<c:cat><c:strRef><c:f>${X(rng(sheetName, m.catRef))}</c:f>${strCache(m.cats)}</c:strRef></c:cat>` : `<c:cat><c:strLit><c:ptCount val="${m.cats.length}"/>${m.cats.map((t, i) => `<c:pt idx="${i}"><c:v>${X(t)}</c:v></c:pt>`).join('')}</c:strLit></c:cat>`;
            const val = s.ref ? `<c:val><c:numRef><c:f>${X(rng(sheetName, s.ref.vals))}</c:f>${numCache(s.vals)}</c:numRef></c:val>` : `<c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${s.vals.length}"/>${s.vals.map((v, i) => v == null ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numLit></c:val>`;
            return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${tx}${sp}${cat}${val}${m.type === 'line' ? '<c:smooth val="0"/>' : ''}</c:ser>`;
        }).join('');
        const ax = (catPos, valPos) => `<c:catAx><c:axId val="50010001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${catPos}"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="50010002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`
            + `<c:valAx><c:axId val="50010002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${valPos}"/><c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="50010001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
        const plot = m.type === 'pie' ? `<c:pieChart><c:varyColors val="1"/>${sers}<c:firstSliceAng val="0"/></c:pieChart>`
            : m.type === 'line' ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/><c:axId val="50010001"/><c:axId val="50010002"/></c:lineChart>${ax('b', 'l')}`
            : `<c:barChart><c:barDir val="${m.type === 'bar' ? 'bar' : 'col'}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}<c:gapWidth val="80"/><c:axId val="50010001"/><c:axId val="50010002"/></c:barChart>${ax(m.type === 'bar' ? 'l' : 'b', m.type === 'bar' ? 'b' : 'l')}`;
        const title = m.title ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="0"/></a:pPr><a:r><a:rPr lang="de-DE" sz="1400" b="0"/><a:t>${X(m.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` : '<c:autoTitleDeleted val="1"/>';
        const legend = m.type === 'pie' || m.series.length > 1 ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : '';
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="${NSC}" xmlns:a="${NSA}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/>${plot}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1000"/></a:pPr><a:endParaRPr lang="de-DE"/></a:p></c:txPr></c:chartSpace>`;
    }
    // Excel-Diagramm lesen → { type, title, cats, series, src } (src = Zellbereich auf demselben Blatt, wenn erkennbar)
    function parse(str) {
        const d = new DOMParser().parseFromString(str, 'application/xml'), T = (el, n) => el ? [...el.getElementsByTagNameNS(NSC, n)] : [], A = (el, n) => el ? [...el.getElementsByTagNameNS(NSA, n)] : [];
        const kind = T(d, 'pieChart')[0] || T(d, 'pie3DChart')[0] || T(d, 'doughnutChart')[0] ? 'pie' : T(d, 'lineChart')[0] || T(d, 'line3DChart')[0] || T(d, 'areaChart')[0] || T(d, 'scatterChart')[0] ? 'line' : T(d, 'barChart')[0] || T(d, 'bar3DChart')[0] ? ((T(d, 'barDir')[0] || { getAttribute: () => 'col' }).getAttribute('val') === 'bar' ? 'bar' : 'col') : null;
        if (!kind) return null;
        const tEl = T(d, 'title')[0], title = tEl ? A(tEl, 't').map(t => t.textContent).join('') : '';
        const pts = el => { const o = []; T(el, 'pt').forEach(p => { o[+p.getAttribute('idx')] = (T(p, 'v')[0] || {}).textContent; }); const n = T(el, 'ptCount')[0]; const len = n ? +n.getAttribute('val') : o.length; return Array.from({ length: len }, (_, i) => o[i]); };
        const refOf = el => { const f = el && T(el, 'f')[0]; if (!f) return null; const m = /^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/.exec(f.textContent.trim()); if (!m) return null; const c1 = colN(m[3]), r1 = +m[4] - 1; return { sheet: (m[1] || m[2]).replace(/''/g, "'"), r1, c1, r2: m[6] ? +m[6] - 1 : r1, c2: m[5] ? colN(m[5]) : c1 }; };
        let cats = [], catRef = null; const series = [], refs = [];
        T(d, 'ser').forEach((s, k) => {
            const cat = T(s, 'cat')[0] || T(s, 'xVal')[0], val = T(s, 'val')[0] || T(s, 'yVal')[0], tx = T(s, 'tx')[0];
            if (cat && !cats.length) { cats = pts(cat).map(v => v == null ? '' : String(v)); catRef = refOf(cat); if (catRef) refs.push(catRef); }
            const vals = val ? pts(val).map(v => v == null || v === '' || isNaN(+v) ? null : +v) : []; const vr = refOf(val); if (vr) refs.push(vr);
            const nr = refOf(tx); if (nr) refs.push(nr);
            series.push({ name: tx ? (T(tx, 'v')[0] || {}).textContent || A(tx, 't').map(t => t.textContent).join('') || 'Reihe ' + (k + 1) : 'Reihe ' + (k + 1), vals });
        });
        if (!cats.length && series[0]) cats = series[0].vals.map((_, i) => String(i + 1));
        let src = null; if (refs.length && refs.every(r => r.sheet === refs[0].sheet)) src = { sheet: refs[0].sheet, r1: Math.min(...refs.map(r => r.r1)), c1: Math.min(...refs.map(r => r.c1)), r2: Math.max(...refs.map(r => r.r2)), c2: Math.max(...refs.map(r => r.c2)) };
        return { type: kind, title, cats, series, src };
    }
    window.JMCHART = { PAL, TYPES, data, svg, png, xml, parse };
})();
