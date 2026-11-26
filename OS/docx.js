// OS/docx.js – Word-Dateien (.docx) im Browser lesen und schreiben, ohne Bibliothek (braucht OS/zip.js).
// JMDOCX.write(root, settings) → Blob   (root = Element mit dem Inhalt des Writers)
// JMDOCX.read(arrayBuffer) → { html, settings }
// settings: { orient: 'portrait'|'landscape', margins: { t, r, b, l } (mm), header, footer (Text), pageNum (bool) }
(function () {
    'use strict';
    const X = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const H = X;                                     // für HTML genauso
    const PX_EMU = 9525, MM_TW = 56.6929;
    const A4 = { w: 11906, h: 16838 };
    const DEF = () => ({ orient: 'portrait', margins: { t: 25, r: 25, b: 20, l: 25 }, header: '', footer: '', pageNum: false });
    const NS = {
        w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
        pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture', rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
    };

    // ---------- Farben und Größen ----------
    function hex(c) {
        if (!c) return ''; c = String(c).trim().toLowerCase();
        if (c === 'transparent' || c === 'inherit' || c === 'initial') return '';
        let m = /^#([0-9a-f]{3})$/.exec(c); if (m) return m[1].split('').map(x => x + x).join('').toUpperCase();
        m = /^#([0-9a-f]{6})$/.exec(c); if (m) return m[1].toUpperCase();
        m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?/.exec(c);
        if (m) { if (m[4] !== undefined && +m[4] === 0) return ''; return [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join('').toUpperCase(); }
        const N = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080', orange: 'FFA500', purple: '800080' };
        return N[c] || '';
    }
    const KW = { 'xx-small': 7, 'x-small': 7.5, small: 10, medium: 12, large: 13.5, 'x-large': 18, 'xx-large': 24, 'xxx-large': 36 };
    function pt(v) {         // CSS-Größe → Punkt
        if (!v) return 0; v = String(v).trim(); if (KW[v]) return KW[v];
        const m = /^([\d.]+)(pt|px|em|rem|%)?$/.exec(v); if (!m) return 0; const n = +m[1];
        return m[2] === 'px' ? n * .75 : m[2] === 'em' || m[2] === 'rem' ? n * 11 : m[2] === '%' ? n / 100 * 11 : n;
    }
    function lenPx(v, base) { if (!v) return 0; const m = /^([\d.]+)(px|pt|cm|mm|%|em)?$/.exec(String(v).trim()); if (!m) return 0; const n = +m[1];
        return m[2] === 'pt' ? n / .75 : m[2] === 'cm' ? n * 37.795 : m[2] === 'mm' ? n * 3.7795 : m[2] === '%' ? n / 100 * (base || 600) : m[2] === 'em' ? n * 14.67 : n; }

    // ======================================================================
    //  SCHREIBEN
    // ======================================================================
    function write(root, st0) {
        const st = Object.assign(DEF(), st0 || {}); st.margins = Object.assign(DEF().margins, (st0 || {}).margins || {});
        const land = st.orient === 'landscape', pgW = land ? A4.h : A4.w, pgH = land ? A4.w : A4.h;
        const textTw = pgW - Math.round((st.margins.l + st.margins.r) * MM_TW), textPx = textTw / 15;
        const rels = [], media = [], nums = [];       // nums: { abs: 0|1 } – 0 = Aufzählung, 1 = Nummerierung
        let relN = 10, pic = 0;
        const rel = (type, target, ext) => { const id = 'rId' + (++relN); rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${X(target)}"${ext ? ' TargetMode="External"' : ''}/>`); return id; };
        let bulletNum = 0; const numMap = new Map();
        const numFor = (ordered, listEl) => {
            if (!ordered) { if (!bulletNum) { nums.push({ abs: 0 }); bulletNum = nums.length; } return bulletNum; }
            if (!numMap.has(listEl)) { nums.push({ abs: 1, start: +listEl.getAttribute('start') || 1 }); numMap.set(listEl, nums.length); } return numMap.get(listEl);
        };

        // --- Zeichenformat ---
        function runProps(s) {
            let p = '';
            if (s.style) p += `<w:rStyle w:val="${s.style}"/>`;
            if (s.font) { const f = X(s.font); p += `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>`; }
            if (s.b) p += '<w:b/><w:bCs/>'; if (s.i) p += '<w:i/><w:iCs/>'; if (s.s) p += '<w:strike/>';
            if (s.color) p += `<w:color w:val="${s.color}"/>`;
            if (s.size) p += `<w:sz w:val="${Math.round(s.size * 2)}"/><w:szCs w:val="${Math.round(s.size * 2)}"/>`;
            if (s.bg) p += `<w:shd w:val="clear" w:color="auto" w:fill="${s.bg}"/>`;
            if (s.u) p += '<w:u w:val="single"/>';
            if (s.sup) p += '<w:vertAlign w:val="superscript"/>'; else if (s.sub) p += '<w:vertAlign w:val="subscript"/>';
            return p ? `<w:rPr>${p}</w:rPr>` : '';
        }
        function styleOf(el, s0) {
            const s = Object.assign({}, s0), t = el.tagName, cs = el.style || {};
            if (t === 'B' || t === 'STRONG' || t === 'TH') s.b = true; if (t === 'I' || t === 'EM') s.i = true; if (t === 'U' || t === 'INS') s.u = true;
            if (t === 'S' || t === 'STRIKE' || t === 'DEL') s.s = true; if (t === 'SUP') s.sup = true; if (t === 'SUB') s.sub = true;
            if (t === 'FONT') { if (el.getAttribute('color')) s.color = hex(el.getAttribute('color')) || s.color; if (el.getAttribute('face')) s.font = el.getAttribute('face').split(',')[0].replace(/["']/g, '').trim(); }
            if (t === 'A' && el.getAttribute('href')) { s.href = el.getAttribute('href'); s.style = 'Hyperlink'; }
            if (cs.fontWeight === 'bold' || +cs.fontWeight >= 600) s.b = true; else if (cs.fontWeight === 'normal' || +cs.fontWeight && +cs.fontWeight < 600) s.b = false;
            if (cs.fontStyle === 'italic') s.i = true; else if (cs.fontStyle === 'normal') s.i = false;
            const td = (cs.textDecorationLine || cs.textDecoration || ''); if (/underline/.test(td)) s.u = true; if (/line-through/.test(td)) s.s = true;
            if (cs.verticalAlign === 'super') s.sup = true; if (cs.verticalAlign === 'sub') s.sub = true;
            if (cs.color) s.color = hex(cs.color) || s.color;
            if (cs.backgroundColor) { const b = hex(cs.backgroundColor); if (b) s.bg = b; }
            if (cs.fontFamily) s.font = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
            if (cs.fontSize) { const p = pt(cs.fontSize); if (p) s.size = p; }
            return s;
        }
        function text(t, s) {
            if (!t) return ''; const rp = runProps(s), parts = t.split('\t'); let o = '';
            parts.forEach((x, i) => { if (i) o += `<w:r>${rp}<w:tab/></w:r>`; if (x) o += `<w:r>${rp}<w:t xml:space="preserve">${X(x)}</w:t></w:r>`; });
            return o;
        }
        function image(img) {
            const src = img.getAttribute('src') || '', m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i.exec(src); if (!m) return '';
            let ext = m[1].toLowerCase().replace('jpeg', 'jpg'); const bin = atob(m[2]), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const nw = img.naturalWidth || +img.getAttribute('data-w') || 400, nh = img.naturalHeight || +img.getAttribute('data-h') || 300;
            let w = (img.isConnected && img.offsetWidth) || lenPx(img.style.width, textPx) || +img.getAttribute('width') || nw; w = Math.min(w, textPx); const h = w * nh / nw;          // angezeigte Breite (z. B. in schmalen Tabellenzellen)
            const name = `image${media.length + 1}.${ext}`; media.push([name, bytes]); const id = rel('image', 'media/' + name); pic++;
            const cx = Math.round(w * PX_EMU), cy = Math.round(h * PX_EMU);
            return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${pic}" name="Bild ${pic}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${NS.a}" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="${NS.a}"><a:graphicData uri="${NS.pic}"><pic:pic xmlns:pic="${NS.pic}"><pic:nvPicPr><pic:cNvPr id="${pic}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
        }
        function inline(node, s) {          // Inhalt eines Absatzes
            let o = '';
            for (const n of node.childNodes) {
                if (n.nodeType === 3) { o += text(n.nodeValue.replace(/[\r\n]+/g, ' ').replace(/ /g, ' '), s); continue; }
                if (n.nodeType !== 1) continue;
                const t = n.tagName;
                if (t === 'BR') { o += '<w:r><w:br/></w:r>'; continue; }
                if (t === 'IMG') { o += image(n); continue; }
                if (n.classList && n.classList.contains('wr-pb')) { o += '<w:r><w:br w:type="page"/></w:r>'; continue; }
                if (BLOCK.test(t)) { o += inline(n, s); continue; }       // verirrte Blöcke flach machen
                const s2 = styleOf(n, s);
                if (t === 'A' && s2.href && /^(https?:|mailto:)/i.test(s2.href)) { const id = rel('hyperlink', s2.href, true); const sh = Object.assign({}, s2); delete sh.href; o += `<w:hyperlink r:id="${id}">${inline(n, sh)}</w:hyperlink>`; continue; }
                o += inline(n, s2);
            }
            return o;
        }
        function pPr(el, extra) {
            let p = extra || '';
            const cs = el.style || {}, al = cs.textAlign || el.getAttribute && el.getAttribute('align');
            const ml = lenPx(cs.marginLeft, textPx) || lenPx(cs.paddingLeft, textPx);
            const lh = cs.lineHeight && /^[\d.]+$/.test(cs.lineHeight) ? +cs.lineHeight : 0;
            if (lh) p += `<w:spacing w:line="${Math.round(lh * 240)}" w:lineRule="auto"/>`;
            if (ml && !/<w:numPr>/.test(p)) p += `<w:ind w:left="${Math.round(ml * 15)}"/>`;
            const jc = { center: 'center', right: 'right', justify: 'both', end: 'right', start: 'left', left: 'left' }[al]; if (jc && jc !== 'left') p += `<w:jc w:val="${jc}"/>`;
            return p;
        }
        const P = (props, runs) => `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${runs}</w:p>`;
        const BLOCK = /^(P|H[1-6]|DIV|BLOCKQUOTE|UL|OL|LI|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|HR|PRE|SECTION|ARTICLE|HEADER|FOOTER|FIGURE|FIGCAPTION)$/;
        const STY = el => { const t = el.tagName; if (/^H[1-6]$/.test(t)) return el.classList.contains('wr-title') ? 'Title' : 'Heading' + Math.min(4, +t[1]);
            if (el.classList.contains('wr-title')) return 'Title'; if (el.classList.contains('wr-sub')) return 'Subtitle'; if (t === 'BLOCKQUOTE') return 'Quote'; return ''; };

        function blocks(parent, lvl) {
            let o = '', loose = [];
            const flush = () => { if (!loose.length) return; const has = loose.some(n => (n.textContent || '').trim() || (n.nodeType === 1 && (n.matches('img,br') || n.querySelector('img,br'))));
                if (has) o += P('', inline({ childNodes: loose }, {})); loose = []; };          // echte Knoten (nicht kopiert), damit Bildgrößen stimmen
            for (const n of parent.childNodes) {
                if (n.nodeType === 3) { if (n.nodeValue.trim()) loose.push(n); continue; }
                if (n.nodeType !== 1) continue;
                const t = n.tagName;
                if (!BLOCK.test(t) && !(n.classList && n.classList.contains('wr-pb'))) { loose.push(n); continue; }
                flush();
                if (n.classList && n.classList.contains('wr-pb')) { o += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; continue; }
                if (t === 'HR') { o += P('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>', ''); continue; }
                if (t === 'UL' || t === 'OL') { o += list(n, lvl || 0); continue; }
                if (t === 'TABLE') { o += table(n); let nx = n.nextSibling; while (nx && nx.nodeType === 3 && !nx.nodeValue.trim()) nx = nx.nextSibling; if (!nx || (nx.nodeType === 1 && nx.tagName === 'TABLE')) o += P('<w:spacing w:after="0"/>', ''); continue; }
                if (t === 'DIV' || t === 'SECTION' || t === 'ARTICLE' || t === 'HEADER' || t === 'FOOTER' || t === 'FIGURE' || t === 'THEAD' || t === 'TBODY') {
                    if ([...n.children].some(c => BLOCK.test(c.tagName))) { o += blocks(n, lvl); continue; }
                }
                if (t === 'PRE') { const s = { font: 'Consolas', size: 10 }; o += n.textContent.split('\n').map(l => P('<w:spacing w:after="0"/>', text(l, s))).join(''); continue; }
                const sty = STY(n), base = sty ? `<w:pStyle w:val="${sty}"/>` : '';
                if ([...n.children].some(c => /^(UL|OL|TABLE|P|DIV|BLOCKQUOTE|H[1-6])$/.test(c.tagName))) {            // Absatz mit Blöcken darin
                    const innerS = n.cloneNode(true); innerS.querySelectorAll('ul,ol,table,p,div,blockquote,h1,h2,h3,h4,h5,h6').forEach(x => x.remove());
                    if (innerS.textContent.trim()) o += P(pPr(n, base), inline(innerS, sty === 'Quote' ? { i: true } : {}));
                    o += blocks(n, lvl); continue;
                }
                o += P(pPr(n, base), inline(n, {}));
            }
            flush(); return o;
        }
        function list(ul, lvl) {
            const ord = ul.tagName === 'OL', num = numFor(ord, ul); let o = '';
            for (const li of ul.children) {
                if (li.tagName === 'UL' || li.tagName === 'OL') { o += list(li, lvl + 1); continue; }            // Chrome: Liste direkt in Liste
                if (li.tagName !== 'LI') { o += blocks({ childNodes: [li] }, lvl); continue; }
                const own = li.cloneNode(true); own.querySelectorAll('ul,ol').forEach(x => x.remove());
                const sub = [...li.children].filter(c => c.tagName === 'UL' || c.tagName === 'OL');
                const firstBlock = own.querySelector('p,h1,h2,h3,div'), runsEl = firstBlock && own.children.length === 1 ? firstBlock : own;
                o += P(`<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${Math.min(8, lvl)}"/><w:numId w:val="${num}"/></w:numPr>` + pPr(li).replace(/<w:ind[^>]*\/>/, ''), inline(runsEl, {}));
                sub.forEach(s => { o += list(s, lvl + 1); });
            }
            return o;
        }
        function table(tb) {
            const rows = [...tb.rows]; if (!rows.length) return '';
            const cols = Math.max(...rows.map(r => [...r.cells].reduce((a, c) => a + (c.colSpan || 1), 0)));
            const cw = Math.floor(textTw / cols);
            let o = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${cw * cols}" w:type="dxa"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>${'<w:gridCol w:w="' + cw + '"/>'.repeat(cols)}</w:tblGrid>`;
            const vm = {};       // Spalte → verbleibende Zeilen eines rowspan
            rows.forEach(r => {
                o += '<w:tr>'; let col = 0;
                const cells = [...r.cells]; let ci = 0;
                while (ci < cells.length || vm[col]) {
                    if (vm[col]) { const span = vm[col].span; o += `<w:tc><w:tcPr><w:tcW w:w="${cw * span}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}<w:vMerge/></w:tcPr><w:p/></w:tc>`; vm[col].left--; if (!vm[col].left) delete vm[col]; col += span; continue; }
                    const c = cells[ci++], span = c.colSpan || 1, rs = c.rowSpan || 1, bg = hex(c.style.backgroundColor);
                    if (rs > 1) vm[col] = { left: rs - 1, span };
                    const inner = blocks(c, 0) || '<w:p/>';
                    const th = c.tagName === 'TH';
                    o += `<w:tc><w:tcPr><w:tcW w:w="${cw * span}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${rs > 1 ? '<w:vMerge w:val="restart"/>' : ''}${bg || th ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg || 'E7E6E6'}"/>` : ''}</w:tcPr>${th ? inner.replace(/<w:r>(<w:rPr>)?/g, (m, rp) => rp ? '<w:r><w:rPr><w:b/>' : '<w:r><w:rPr><w:b/></w:rPr>') : inner}</w:tc>`;
                    col += span;
                }
                o += '</w:tr>';
            });
            return o + '</w:tbl>';
        }

        const body = blocks(root, 0) || '<w:p/>';
        // Kopf- und Fußzeile
        let hdrRef = '', ftrRef = '', hdrXml = '', ftrXml = '';
        const hfDoc = (tag, inner) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} xmlns:w="${NS.w}" xmlns:r="${NS.r}">${inner}</w:${tag}>`;
        const hfStyle = '<w:rPr><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>';
        const fld = f => `<w:r>${hfStyle}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${hfStyle}<w:instrText xml:space="preserve"> ${f} </w:instrText></w:r><w:r>${hfStyle}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${hfStyle}<w:t>1</w:t></w:r><w:r>${hfStyle}<w:fldChar w:fldCharType="end"/></w:r>`;
        const hfRun = t => t ? `<w:r>${hfStyle}<w:t xml:space="preserve">${X(t)}</w:t></w:r>` : '';
        if (st.header) { hdrXml = hfDoc('hdr', P('<w:pStyle w:val="Header"/><w:jc w:val="center"/>', hfRun(st.header))); hdrRef = `<w:headerReference w:type="default" r:id="${rel('header', 'header1.xml')}"/>`; }
        if (st.footer || st.pageNum) {
            ftrXml = hfDoc('ftr', P('<w:pStyle w:val="Footer"/><w:jc w:val="center"/>', hfRun(st.footer) + (st.pageNum ? hfRun((st.footer ? '   ·   ' : '') + 'Seite ') + fld('PAGE') + hfRun(' von ') + fld('NUMPAGES') : '')));
            ftrRef = `<w:footerReference w:type="default" r:id="${rel('footer', 'footer1.xml')}"/>`;
        }
        const tw = mm => Math.round(mm * MM_TW);
        const sect = `<w:sectPr>${hdrRef}${ftrRef}<w:pgSz w:w="${pgW}" w:h="${pgH}"${land ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${tw(st.margins.t)}" w:right="${tw(st.margins.r)}" w:bottom="${tw(st.margins.b)}" w:left="${tw(st.margins.l)}" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/></w:sectPr>`;
        const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}"><w:body>${body}${sect}</w:body></w:document>`;

        const lvlXml = (abs) => Array.from({ length: 9 }, (_, i) => {
            const ind = 720 * (i + 1), bullet = ['•', '◦', '▪'][i % 3], fmt = ['decimal', 'lowerLetter', 'lowerRoman'][i % 3];
            return abs === 0 ? `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${bullet}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${ind}" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:hint="default"/></w:rPr></w:lvl>`
                : `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="%${i + 1}."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${ind}" w:hanging="360"/></w:pPr></w:lvl>`;
        }).join('');
        const numXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="${NS.w}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${lvlXml(0)}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${lvlXml(1)}</w:abstractNum>${nums.map((n, i) => `<w:num w:numId="${i + 1}"><w:abstractNumId w:val="${n.abs}"/>${n.abs === 1 ? `<w:lvlOverride w:ilvl="0"><w:startOverride w:val="${n.start || 1}"/></w:lvlOverride>` : ''}</w:num>`).join('')}</w:numbering>`;
        const font = 'Calibri', fontH = 'Calibri Light';
        const sty = (id, name, extra, opt = '') => `<w:style w:type="paragraph" w:styleId="${id}"${opt}><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>${extra}</w:style>`;
        const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${NS.w}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="de-DE" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${sty('Title', 'Title', `<w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:contextualSpacing/></w:pPr><w:rPr><w:rFonts w:ascii="${fontH}" w:hAnsi="${fontH}"/><w:spacing w:val="-10"/><w:kern w:val="28"/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr>`)}
${sty('Subtitle', 'Subtitle', '<w:rPr><w:color w:val="5A5A5A"/><w:spacing w:val="15"/><w:sz w:val="28"/></w:rPr>')}
${[[1, 32, '2F5496', 240], [2, 26, '2F5496', 40], [3, 24, '1F3763', 40], [4, 22, '2F5496', 40]].map(([n, sz, c, b]) => sty('Heading' + n, 'heading ' + n, `<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${b}" w:after="${n === 1 ? 0 : 0}"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:rFonts w:ascii="${fontH}" w:hAnsi="${fontH}"/><w:color w:val="${c}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${n === 4 ? '<w:i/>' : ''}</w:rPr>`)).join('')}
${sty('Quote', 'Quote', '<w:pPr><w:spacing w:before="200"/><w:ind w:left="864" w:right="864"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:color w:val="404040"/></w:rPr>')}
${sty('ListParagraph', 'List Paragraph', '<w:pPr><w:ind w:left="720"/><w:contextualSpacing/></w:pPr>')}
${sty('Header', 'header', '<w:pPr><w:tabs><w:tab w:val="center" w:pos="4536"/><w:tab w:val="right" w:pos="9072"/></w:tabs><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>')}
${sty('Footer', 'footer', '<w:pPr><w:tabs><w:tab w:val="center" w:pos="4536"/><w:tab w:val="right" w:pos="9072"/></w:tabs><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>')}
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="NormalTable"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="NormalTable"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr></w:style>
</w:styles>`;
        const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
        const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="webp" ContentType="image/webp"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${hdrXml ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}${ftrXml ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
        const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
        const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${rels.join('')}</Relationships>`;
        const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${NS.w}"><w:zoom w:percent="100"/><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
        const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>${X(st.author || '')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
        const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>J.Mainz Writer</Application></Properties>`;
        const files = [['[Content_Types].xml', ct], ['_rels/.rels', rootRels], ['word/document.xml', docXml], ['word/_rels/document.xml.rels', docRels], ['word/styles.xml', stylesXml], ['word/numbering.xml', numXml], ['word/settings.xml', settings], ['docProps/core.xml', core], ['docProps/app.xml', app]];
        if (hdrXml) files.push(['word/header1.xml', hdrXml]); if (ftrXml) files.push(['word/footer1.xml', ftrXml]);
        media.forEach(([n, b]) => files.push(['word/media/' + n, b]));
        return JMZIP.zip(files).then(b => new Blob([b], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    }

    // ======================================================================
    //  LESEN
    // ======================================================================
    async function read(buf) {
        const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf), ents = JMZIP.list(bytes), map = {};
        ents.forEach(e => { map[e.name.replace(/^\/+/, '')] = e; });
        const get = async n => { const e = map[n]; return e ? new TextDecoder().decode(await JMZIP.extract(bytes, e)) : ''; };
        const getB = async n => { const e = map[n]; return e ? JMZIP.extract(bytes, e) : null; };
        if (!map['word/document.xml']) throw new Error('Das ist keine Word-Datei (.docx).');
        const dp = new DOMParser(), xml = s => dp.parseFromString(s, 'application/xml');
        const doc = xml(await get('word/document.xml'));
        const W = (el, name) => el ? [...el.childNodes].filter(n => n.nodeType === 1 && n.localName === name) : [];
        const W1 = (el, name) => W(el, name)[0] || null;
        const attr = (el, name) => el ? (el.getAttributeNS(NS.w, name) ?? el.getAttribute('w:' + name)) : null;
        const relsDoc = xml(await get('word/_rels/document.xml.rels') || '<r/>'), RELS = {};
        [...relsDoc.getElementsByTagName('Relationship')].forEach(r => { RELS[r.getAttribute('Id')] = { t: r.getAttribute('Target'), type: r.getAttribute('Type') || '' }; });
        // Formatvorlagen
        const STY = {}; const sx = xml(await get('word/styles.xml') || '<s/>');
        [...sx.getElementsByTagNameNS(NS.w, 'style')].forEach(s => { const id = attr(s, 'styleId'); STY[id] = { name: (attr(W1(s, 'name'), 'val') || '').toLowerCase(), based: attr(W1(s, 'basedOn'), 'val'), type: attr(s, 'type') }; });
        const kindOf = id => { let k = 0, s = STY[id]; while (s && k++ < 8) { const n = s.name; let m;
            if ((m = /^(heading|überschrift)\s*(\d)/.exec(n))) return 'h' + Math.min(4, +m[2]); if (n === 'title' || n === 'titel') return 'title'; if (n === 'subtitle' || n === 'untertitel') return 'sub';
            if (/quote|zitat/.test(n)) return 'quote'; s = STY[s.based]; }
            if (/^(heading|berschrift)(\d)$/i.test(id || '')) return 'h' + Math.min(4, +/\d/.exec(id)[0]); return ''; };
        // Nummerierung
        const NUM = {}; const nx = xml(await get('word/numbering.xml') || '<n/>'), ABS = {};
        [...nx.getElementsByTagNameNS(NS.w, 'abstractNum')].forEach(a => { const lv = {}; W(a, 'lvl').forEach(l => { lv[attr(l, 'ilvl')] = attr(W1(l, 'numFmt'), 'val') || 'decimal'; }); ABS[attr(a, 'abstractNumId')] = lv; });
        [...nx.getElementsByTagNameNS(NS.w, 'num')].forEach(n => { NUM[attr(n, 'numId')] = ABS[attr(W1(n, 'abstractNumId'), 'val')] || {}; });
        const imgCache = {};
        async function imgSrc(rid) {
            const r = RELS[rid]; if (!r) return ''; if (imgCache[rid]) return imgCache[rid];
            const path = r.t.startsWith('/') ? r.t.slice(1) : 'word/' + r.t.replace(/^\.\//, ''), ext = (path.split('.').pop() || '').toLowerCase();
            const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }[ext]; if (!mime) return '';
            const b = await getB(path); if (!b) return ''; let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
            return (imgCache[rid] = `data:${mime};base64,${btoa(s)}`);
        }
        const HL = { yellow: 'FFFF00', green: '00FF00', cyan: '00FFFF', magenta: 'FF00FF', blue: '0000FF', red: 'FF0000', darkBlue: '000080', darkCyan: '008080', darkGreen: '008000', darkMagenta: '800080', darkRed: '800000', darkYellow: '808000', darkGray: '808080', lightGray: 'C0C0C0', black: '000000', white: 'FFFFFF' };
        const on = el => el && attr(el, 'val') !== '0' && attr(el, 'val') !== 'false' && attr(el, 'val') !== 'none';
        async function runs(p) {
            let o = '';
            for (const n of p.childNodes) {
                if (n.nodeType !== 1) continue; const ln = n.localName;
                if (ln === 'r') o += await run(n);
                else if (ln === 'hyperlink') { const rid = n.getAttributeNS(NS.r, 'id') || n.getAttribute('r:id'), href = rid && RELS[rid] ? RELS[rid].t : ''; const inner = await runs(n);
                    o += /^(https?:|mailto:)/i.test(href) ? `<a href="${H(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner; }
                else if (['ins', 'smartTag', 'customXml', 'fldSimple', 'sdt', 'sdtContent', 'bdo', 'dir'].includes(ln)) o += await runs(ln === 'sdt' ? (W1(n, 'sdtContent') || n) : n);
            }
            return o;
        }
        async function run(r) {
            const rp = W1(r, 'rPr'); let css = '', open = '', close = '';
            if (rp) {
                if (on(W1(rp, 'b'))) { open += '<b>'; close = '</b>' + close; } if (on(W1(rp, 'i'))) { open += '<i>'; close = '</i>' + close; }
                if (on(W1(rp, 'u'))) { open += '<u>'; close = '</u>' + close; } if (on(W1(rp, 'strike')) || on(W1(rp, 'dstrike'))) { open += '<s>'; close = '</s>' + close; }
                const va = attr(W1(rp, 'vertAlign'), 'val'); if (va === 'superscript') { open += '<sup>'; close = '</sup>' + close; } else if (va === 'subscript') { open += '<sub>'; close = '</sub>' + close; }
                const c = attr(W1(rp, 'color'), 'val'); if (c && /^[0-9A-Fa-f]{6}$/.test(c) && c !== '000000') css += `color:#${c};`;
                const hl = attr(W1(rp, 'highlight'), 'val'), sh = attr(W1(rp, 'shd'), 'fill'); if (hl && HL[hl]) css += `background-color:#${HL[hl]};`; else if (sh && /^[0-9A-Fa-f]{6}$/.test(sh) && sh.toUpperCase() !== 'FFFFFF') css += `background-color:#${sh};`;
                const f = attr(W1(rp, 'rFonts'), 'ascii') || attr(W1(rp, 'rFonts'), 'hAnsi'); if (f && !/^(Calibri|\+)/i.test(f)) css += `font-family:${H(f).replace(/;/g, '')};`;
                const sz = +attr(W1(rp, 'sz'), 'val'); if (sz && sz !== 22) css += `font-size:${sz / 2}pt;`;
                if (W1(rp, 'vanish')) return '';
            }
            let t = '';
            for (const n of r.childNodes) {
                if (n.nodeType !== 1) continue; const ln = n.localName;
                if (ln === 't') t += H(n.textContent); else if (ln === 'tab') t += '\t'; else if (ln === 'noBreakHyphen') t += '‑';
                else if (ln === 'br') t += attr(n, 'type') === 'page' ? '\u0001PB\u0001' : '<br>';
                else if (ln === 'cr') t += '<br>';
                else if (ln === 'drawing' || ln === 'pict' || ln === 'object') {
                    const blip = n.getElementsByTagNameNS(NS.a, 'blip')[0], imd = n.getElementsByTagName('v:imagedata')[0];
                    const rid = blip ? (blip.getAttributeNS(NS.r, 'embed') || blip.getAttribute('r:embed')) : imd ? (imd.getAttributeNS(NS.r, 'id') || imd.getAttribute('r:id')) : '';
                    const src = rid ? await imgSrc(rid) : ''; if (!src) continue;
                    const ext = n.getElementsByTagNameNS(NS.wp, 'extent')[0], w = ext ? Math.round(+ext.getAttribute('cx') / PX_EMU) : 0;
                    t += `<img src="${src}" alt=""${w ? ` style="width:${w}px"` : ''}>`;
                }
            }
            if (!t) return '';
            return css ? `<span style="${css}">${open}${t}${close}</span>` : open + t + close;
        }
        function pStyleCss(pp) {
            if (!pp) return ''; let css = '';
            const jc = attr(W1(pp, 'jc'), 'val'); const al = { center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' }[jc]; if (al) css += `text-align:${al};`;
            const ind = W1(pp, 'ind'), left = ind ? +(attr(ind, 'left') || attr(ind, 'start') || 0) : 0; if (left > 0 && !W1(pp, 'numPr')) css += `margin-left:${Math.round(left / 15)}px;`;
            const sp = W1(pp, 'spacing'), line = sp ? +attr(sp, 'line') : 0; if (line && (attr(sp, 'lineRule') || 'auto') === 'auto' && Math.abs(line - 259) > 12) css += `line-height:${(line / 240).toFixed(2)};`;
            return css;
        }
        // Körper
        const out = []; let stack = [];       // offene Listen: [{ tag, lvl }]
        const closeLists = (to) => { while (stack.length > to) { out.push(`</li></${stack.pop().tag}>`); } };
        async function para(p) {
            const pp = W1(p, 'pPr'), kind = kindOf(attr(W1(pp, 'pStyle'), 'val')), css = pStyleCss(pp), st = css ? ` style="${css}"` : '';
            let inner = await runs(p);
            const np = W1(pp, 'numPr'), numId = np ? attr(W1(np, 'numId'), 'val') : null;
            if (np && numId && numId !== '0' && NUM[numId]) {
                const lvl = +(attr(W1(np, 'ilvl'), 'val') || 0), fmt = NUM[numId][lvl] || 'decimal', tag = fmt === 'bullet' ? 'ul' : 'ol';
                while (stack.length && (stack.length > lvl + 1 || (stack.length === lvl + 1 && stack[lvl].tag !== tag))) { out.push(`</li></${stack.pop().tag}>`); }
                if (stack.length === lvl + 1) out.push('</li><li' + st + '>');
                else { while (stack.length < lvl + 1) { out.push(`<${tag}><li${stack.length === lvl ? st : ''}>`); stack.push({ tag }); } }
                out.push(inner || '<br>'); return;
            }
            closeLists(0);
            const bdr = W1(pp, 'pBdr'); if (bdr && !inner.replace(/<[^>]+>/g, '').trim() && !/<img/.test(inner)) { out.push('<hr>'); return; }
            if (W1(pp, 'sectPr') && !inner) return;
            const tag = kind === 'title' ? 'h1 class="wr-title"' : kind === 'sub' ? 'p class="wr-sub"' : kind === 'quote' ? 'blockquote' : /^h\d$/.test(kind) ? kind : 'p';
            const ctag = tag.split(' ')[0], parts = inner.split('\u0001PB\u0001');
            parts.forEach((part, i) => { if (i) out.push('<div class="wr-pb" contenteditable="false"></div>');
                if (part.replace(/<[^>]+>/g, '').trim() || /<img/.test(part) || parts.length === 1) out.push(`<${tag}${st}>${part || '<br>'}</${ctag}>`); });
        }
        async function tbl(t) {
            closeLists(0);
            const rows = W(t, 'tr'), vm = []; let html = '<table>';
            const grid = rows.map(tr => { let col = 0; return W(tr, 'tc').map(tc => { const pr = W1(tc, 'tcPr'), span = +(attr(W1(pr, 'gridSpan'), 'val') || 1), v = W1(pr, 'vMerge'); const c = { tc, col, span, v: v ? (attr(v, 'val') === 'restart' ? 'start' : 'cont') : '', rs: 1 }; col += span; return c; }); });
            grid.forEach((r, ri) => r.forEach(c => { if (c.v === 'start') { let k = ri + 1; while (k < grid.length) { const below = grid[k].find(x => x.col === c.col); if (below && below.v === 'cont') { c.rs++; k++; } else break; } } }));
            for (const r of grid) {
                html += '<tr>';
                for (const c of r) { if (c.v === 'cont') continue;
                    const pr = W1(c.tc, 'tcPr'), fill = attr(W1(pr, 'shd'), 'fill'), bg = fill && /^[0-9A-Fa-f]{6}$/.test(fill) && fill.toUpperCase() !== 'FFFFFF' ? ` style="background-color:#${fill}"` : '';
                    const sub = await bodyOf(c.tc);
                    html += `<td${c.span > 1 ? ` colspan="${c.span}"` : ''}${c.rs > 1 ? ` rowspan="${c.rs}"` : ''}${bg}>${sub || '<br>'}</td>`; }
                html += '</tr>';
            }
            out.push(html + '</table>');
        }
        async function bodyOf(el) {        // für Tabellenzellen: eigener Puffer
            const keep = out.splice(0), ks = stack; stack = [];
            for (const n of el.childNodes) { if (n.nodeType !== 1) continue; if (n.localName === 'p') await para(n); else if (n.localName === 'tbl') await tbl(n); else if (n.localName === 'sdt') await walk(W1(n, 'sdtContent')); }
            closeLists(0); const res = out.splice(0).join(''); out.push(...keep); stack = ks;
            return res.replace(/^<p><br><\/p>$/, '');
        }
        async function walk(el) { if (!el) return; for (const n of el.childNodes) { if (n.nodeType !== 1) continue; const ln = n.localName;
            if (ln === 'p') await para(n); else if (ln === 'tbl') await tbl(n); else if (ln === 'sdt') await walk(W1(n, 'sdtContent')); else if (ln === 'customXml') await walk(n); } }
        const body = doc.getElementsByTagNameNS(NS.w, 'body')[0];
        await walk(body); closeLists(0);
        // Seite
        const st = DEF(), sp = body ? W(body, 'sectPr').pop() || body.getElementsByTagNameNS(NS.w, 'sectPr')[0] : null;
        if (sp) {
            const sz = W1(sp, 'pgSz'), mar = W1(sp, 'pgMar');
            if (sz && (attr(sz, 'orient') === 'landscape' || +attr(sz, 'w') > +attr(sz, 'h'))) st.orient = 'landscape';
            if (mar) { const mm = v => Math.round((+v || 0) / MM_TW); st.margins = { t: mm(attr(mar, 'top')) || 25, r: mm(attr(mar, 'right')) || 25, b: mm(attr(mar, 'bottom')) || 20, l: mm(attr(mar, 'left')) || 25 }; }
            const hf = async (tag) => { const ref = W(sp, tag + 'Reference').find(x => attr(x, 'type') === 'default') || W(sp, tag + 'Reference')[0]; if (!ref) return null;
                const rid = ref.getAttributeNS(NS.r, 'id') || ref.getAttribute('r:id'), r = RELS[rid]; if (!r) return null; const x = xml(await get('word/' + r.t)); return x; };
            const hx = await hf('header'); if (hx) st.header = [...hx.getElementsByTagNameNS(NS.w, 't')].map(t => t.textContent).join('').trim().slice(0, 200);
            const fx = await hf('footer');
            if (fx) { const instr = [...fx.getElementsByTagNameNS(NS.w, 'instrText')].map(t => t.textContent).join(' ') + [...fx.getElementsByTagNameNS(NS.w, 'fldSimple')].map(f => attr(f, 'instr')).join(' ');
                st.pageNum = /\bPAGE\b/.test(instr);
                let txt = ''; for (const p of fx.getElementsByTagNameNS(NS.w, 'p')) { let inF = 0; for (const r of p.getElementsByTagNameNS(NS.w, 'r')) { const fc = W1(r, 'fldChar'); if (fc) { const t = attr(fc, 'fldCharType'); inF = t === 'begin' || t === 'separate' ? 1 : 0; continue; } if (!inF) txt += [...r.getElementsByTagNameNS(NS.w, 't')].map(t => t.textContent).join(''); } }
                if (st.pageNum) txt = txt.replace(/[\s·|–-]*Seite\s*(von)?\s*$/i, '').replace(/[\s·|–-]*Page\s*(of)?\s*$/i, ''); st.footer = txt.trim().slice(0, 200); }
        }
        let html = out.join('').replace(/\u0001PB\u0001/g, '<div class="wr-pb" contenteditable="false"></div>');
        if (!html.trim()) html = '<p><br></p>';
        return { html, settings: st };
    }

    window.JMDOCX = { write, read, DEF };
})();
