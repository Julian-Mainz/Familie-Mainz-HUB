// OS/pptx.js – PowerPoint-Dateien (.pptx) im Browser lesen und schreiben (braucht OS/zip.js).
// Folienmodell (Maße in Pixeln bei 96 dpi, 1 px = 9525 EMU):
// deck = { W, H, slides: [{ bg, bgImg, trans, shapes: [{ type: 'text'|'shape'|'image', geom, x, y, w, h, rot, fill, line, lw, src, anchor, paras }] }] }
// paras = [{ al: 'l'|'ctr'|'r'|'just', bu: ''|'•'|'1.', lvl, runs: [{ t, b, i, u, color, sz, font }] }]
(function () {
    'use strict';
    const EMU = 9525;
    const X = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    const NS = { a: 'http://schemas.openxmlformats.org/drawingml/2006/main', p: 'http://schemas.openxmlformats.org/presentationml/2006/main', r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', rel: 'http://schemas.openxmlformats.org/package/2006/relationships' };
    const NSD = `xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"`;
    const emu = px => Math.round((+px || 0) * EMU);

    // ---------- Schreiben ----------
    const THEME = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="${NS.a}" name="J.Mainz"><a:themeElements><a:clrScheme name="J.Mainz"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F3F4F6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>
<a:fontScheme name="J.Mainz"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
    const MASTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster ${NSD}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr marL="228600" indent="-228600"><a:defRPr sz="2800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
    const LAYOUT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout ${NSD} type="blank" preserve="1"><p:cSld name="Leer"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
    const RELS = list => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}">${list.map(([id, type, t, ext]) => `<Relationship Id="${id}" Type="${type.startsWith('http') ? type : 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/' + type}" Target="${X(t)}"${ext ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;
    function runXml(r) {
        let p = `<a:rPr lang="de-DE"${r.sz ? ` sz="${Math.round(r.sz * 100)}"` : ''}${r.b ? ' b="1"' : ''}${r.i ? ' i="1"' : ''}${r.u ? ' u="sng"' : ''} dirty="0">`;
        if (r.color) p += `<a:solidFill><a:srgbClr val="${r.color}"/></a:solidFill>`;
        if (r.font) p += `<a:latin typeface="${X(r.font)}"/><a:cs typeface="${X(r.font)}"/>`;
        p += '</a:rPr>';
        return `<a:r>${p}<a:t>${X(r.t)}</a:t></a:r>`;
    }
    function txBody(s) {
        const ins = 'lIns="91440" tIns="45720" rIns="91440" bIns="45720"';
        const paras = (s.paras && s.paras.length ? s.paras : [{ runs: [] }]).map(pa => {
            const al = { l: 'l', ctr: 'ctr', r: 'r', just: 'just' }[pa.al] || 'l', lvl = pa.lvl || 0;
            const bu = pa.bu === '1.' ? `<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>` : pa.bu ? `<a:buFont typeface="Arial"/><a:buChar char="${X(pa.bu)}"/>` : '<a:buNone/>';
            const ind = pa.bu ? ` marL="${342900 + lvl * 457200}" indent="-342900"` : lvl ? ` marL="${lvl * 457200}"` : ' marL="0" indent="0"';
            const runs = (pa.runs || []).filter(r => r.t).map(runXml).join('');
            const end = (pa.runs || [])[0] && pa.runs[0].sz ? `<a:endParaRPr lang="de-DE" sz="${Math.round(pa.runs[0].sz * 100)}" dirty="0"/>` : '<a:endParaRPr lang="de-DE" dirty="0"/>';
            return `<a:p><a:pPr algn="${al}"${lvl ? ` lvl="${lvl}"` : ''}${ind}>${bu}</a:pPr>${runs}${end}</a:p>`;
        }).join('');
        return `<p:txBody><a:bodyPr wrap="square" ${ins} rtlCol="0" anchor="${{ t: 't', ctr: 'ctr', b: 'b' }[s.anchor] || 't'}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody>`;
    }
    const xfrm = (s, tag = 'a:xfrm') => `<${tag}${s.rot ? ` rot="${Math.round(s.rot * 60000)}"` : ''}${s.flipH ? ' flipH="1"' : ''}><a:off x="${emu(s.x)}" y="${emu(s.y)}"/><a:ext cx="${Math.max(1, emu(s.w))}" cy="${Math.max(1, emu(s.h))}"/></${tag}>`;
    const fillXml = c => c ? `<a:solidFill><a:srgbClr val="${c}"/></a:solidFill>` : '<a:noFill/>';
    async function write(deck) {
        const media = [], files = [], slideRels = [];
        const dataBytes = src => { const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i.exec(src || ''); if (!m) return null; const bin = atob(m[2]), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return { ext: m[1].toLowerCase().replace('jpeg', 'jpg'), b }; };
        const addImg = (src, rels) => { const d = dataBytes(src); if (!d) return null; let found = media.find(x => x.src === src); if (!found) { found = { src, name: `image${media.length + 1}.${d.ext}`, b: d.b }; media.push(found); } const id = 'rId' + (rels.length + 2); rels.push([id, 'image', '../media/' + found.name]); return id; };
        deck.slides.forEach((sl, si) => {
            const rels = [['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']]; let id = 1;
            const shapes = sl.shapes.map(s => {
                id++;
                const name = X(s.name || (s.type === 'image' ? 'Bild ' : s.type === 'text' ? 'Textfeld ' : 'Form ') + id);
                if (s.type === 'image') { const rid = addImg(s.src, rels); if (!rid) return '';
                    return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}" descr="${X(s.alt || '')}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(s)}<a:prstGeom prst="${s.geom === 'ellipse' ? 'ellipse' : s.geom === 'roundRect' ? 'roundRect' : 'rect'}"><a:avLst/></a:prstGeom>${s.line ? `<a:ln w="${emu(s.lw || 2)}">${fillXml(s.line)}</a:ln>` : ''}</p:spPr></p:pic>`; }
                const geom = s.type === 'text' ? 'rect' : (s.geom || 'rect');
                const ln = s.line ? `<a:ln w="${emu(s.lw || 2)}">${fillXml(s.line)}</a:ln>` : '<a:ln><a:noFill/></a:ln>';
                return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr${s.type === 'text' ? ' txBox="1"' : ''}/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(s)}<a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom>${fillXml(s.fill)}${ln}</p:spPr>${txBody(s)}</p:sp>`;
            }).join('');
            let bg = '';
            if (sl.bgImg) { const rid = addImg(sl.bgImg, rels); if (rid) bg = `<p:bg><p:bgPr><a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${rid}"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>`; }
            if (!bg && sl.bg) bg = `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${sl.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`;
            const tr = { fade: '<p:fade/>', push: '<p:push dir="u"/>', wipe: '<p:wipe dir="r"/>', zoom: '<p:zoom/>', cover: '<p:cover dir="l"/>' }[sl.trans];
            files.push([`ppt/slides/slide${si + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${NSD}><p:cSld>${bg}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${tr ? `<p:transition spd="med">${tr}</p:transition>` : ''}</p:sld>`]);
            files.push([`ppt/slides/_rels/slide${si + 1}.xml.rels`, RELS(rels)]);
        });
        const n = deck.slides.length, cx = emu(deck.W), cy = emu(deck.H);
        const pres = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ${NSD} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${deck.slides.map((s, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 10}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:lvl1pPr><a:defRPr sz="1800" lang="de-DE"><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:defaultTextStyle></p:presentation>`;
        const presRels = RELS([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'theme', 'theme/theme1.xml'], ['rId3', 'presProps', 'presProps.xml'], ['rId4', 'viewProps', 'viewProps.xml'], ['rId5', 'tableStyles', 'tableStyles.xml'], ...deck.slides.map((s, i) => ['rId' + (i + 10), 'slide', `slides/slide${i + 1}.xml`])]);
        const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="webp" ContentType="image/webp"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>${deck.slides.map((s, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
        const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
        files.push(['[Content_Types].xml', ct],
            ['_rels/.rels', RELS([['rId1', 'officeDocument', 'ppt/presentation.xml'], ['rId2', 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml'], ['rId3', 'extended-properties', 'docProps/app.xml']])],
            ['ppt/presentation.xml', pres], ['ppt/_rels/presentation.xml.rels', presRels],
            ['ppt/slideMasters/slideMaster1.xml', MASTER], ['ppt/slideMasters/_rels/slideMaster1.xml.rels', RELS([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']])],
            ['ppt/slideLayouts/slideLayout1.xml', LAYOUT], ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', RELS([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])],
            ['ppt/theme/theme1.xml', THEME],
            ['ppt/presProps.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr ${NSD}/>`],
            ['ppt/viewProps.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr ${NSD}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="72008" cy="72008"/></p:viewPr>`],
            ['ppt/tableStyles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="${NS.a}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`],
            ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(deck.title || '')}</dc:title><dc:creator>${X(deck.author || '')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`],
            ['docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>J.Mainz Präsentation</Application><Slides>${n}</Slides></Properties>`]);
        media.forEach(m => files.push(['ppt/media/' + m.name, m.b]));
        const z = await JMZIP.zip(files); return new Blob([z], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    }

    // ---------- Lesen ----------
    async function read(buf) {
        const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf), ents = JMZIP.list(bytes), map = {};
        ents.forEach(e => { map[e.name.replace(/^\/+/, '')] = e; });
        if (!map['ppt/presentation.xml']) throw new Error('Das ist keine PowerPoint-Datei (.pptx).');
        const get = async n => { const e = map[n]; return e ? new TextDecoder().decode(await JMZIP.extract(bytes, e)) : ''; };
        const dp = new DOMParser(), xml = s => dp.parseFromString(s || '<x/>', 'application/xml');
        const A = (el, n) => el ? [...el.getElementsByTagNameNS(NS.a, n)] : [], Pn = (el, n) => el ? [...el.getElementsByTagNameNS(NS.p, n)] : [];
        const kids = (el, ns, n) => el ? [...el.childNodes].filter(c => c.nodeType === 1 && c.localName === n && (!ns || c.namespaceURI === ns)) : [];
        const kid = (el, ns, n) => kids(el, ns, n)[0] || null;
        const rid = el => el && (el.getAttributeNS(NS.r, 'embed') || el.getAttributeNS(NS.r, 'id') || el.getAttribute('r:embed') || el.getAttribute('r:id'));
        const dir = p => p.slice(0, p.lastIndexOf('/') + 1), resolve = (base, t) => { if (t.startsWith('/')) return t.slice(1); const parts = (dir(base) + t).split('/'), out = []; parts.forEach(x => { if (x === '..') out.pop(); else if (x !== '.') out.push(x); }); return out.join('/'); };
        async function relsOf(path) { const r = xml(await get(dir(path) + '_rels/' + path.slice(path.lastIndexOf('/') + 1) + '.rels')), o = {}; [...r.getElementsByTagName('Relationship')].forEach(x => { o[x.getAttribute('Id')] = { t: resolve(path, x.getAttribute('Target')), type: x.getAttribute('Type') || '' }; }); return o; }
        const pres = xml(await get('ppt/presentation.xml')), pr = await relsOf('ppt/presentation.xml');
        const sz = Pn(pres, 'sldSz')[0], W = sz ? Math.round(+sz.getAttribute('cx') / EMU) : 1280, H = sz ? Math.round(+sz.getAttribute('cy') / EMU) : 720;
        // Farben des Designs
        const themePath = Object.values(pr).find(r => /theme$/.test(r.type)); const theme = xml(themePath ? await get(themePath.t) : '');
        const TH = {}; const cs = A(theme, 'clrScheme')[0]; if (cs) [...cs.children].forEach(c => { const v = c.firstElementChild; if (!v) return; TH[c.localName] = v.getAttribute('val') && v.localName === 'srgbClr' ? v.getAttribute('val') : v.getAttribute('lastClr') || '000000'; });
        const MAP = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };
        const fontMj = (A(A(theme, 'majorFont')[0], 'latin')[0] || { getAttribute: () => '' }).getAttribute('typeface'), fontMn = (A(A(theme, 'minorFont')[0], 'latin')[0] || { getAttribute: () => '' }).getAttribute('typeface');
        const mods = (hex, el) => { let [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)); for (const m of el.children) { const v = +m.getAttribute('val') / 100000; if (m.localName === 'lumMod') { r *= v; g *= v; b *= v; } else if (m.localName === 'lumOff') { r += 255 * v; g += 255 * v; b += 255 * v; } else if (m.localName === 'tint') { r += (255 - r) * (1 - v); g += (255 - g) * (1 - v); b += (255 - b) * (1 - v); } else if (m.localName === 'shade') { r *= v; g *= v; b *= v; } }
            return [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase(); };
        const color = el => { if (!el) return null; const c = el.firstElementChild ? [...el.children].find(x => /Clr$/.test(x.localName)) : null; const node = /Clr$/.test(el.localName) ? el : c; if (!node) return null;
            let hex = node.localName === 'srgbClr' ? node.getAttribute('val') : node.localName === 'schemeClr' ? TH[MAP[node.getAttribute('val')] || node.getAttribute('val')] : node.localName === 'sysClr' ? (node.getAttribute('lastClr') || '000000') : node.localName === 'prstClr' ? ({ black: '000000', white: 'FFFFFF', red: 'FF0000', blue: '0000FF', green: '00FF00', yellow: 'FFFF00' }[node.getAttribute('val')] || '000000') : null;
            return hex ? mods(hex, node) : null; };
        const fillOf = spPr => { if (!spPr) return undefined; if (kid(spPr, NS.a, 'noFill')) return ''; const sf = kid(spPr, NS.a, 'solidFill'); if (sf) return color(sf); const gf = kid(spPr, NS.a, 'gradFill'); if (gf) { const g = A(gf, 'gs')[0]; return g ? color(g) : undefined; } return undefined; };
        const media = {}; async function img(path) { if (media[path]) return media[path]; const e = map[path]; if (!e) return ''; const ext = path.split('.').pop().toLowerCase(), mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }[ext]; if (!mime) return ''; const b = await JMZIP.extract(bytes, e); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return (media[path] = `data:${mime};base64,${btoa(s)}`); }
        const xf = el => { const x = el && (kid(el, NS.a, 'xfrm') || kid(el, NS.p, 'xfrm')); if (!x) return null; const off = kid(x, NS.a, 'off'), ext = kid(x, NS.a, 'ext'); if (!off || !ext) return null; return { x: +off.getAttribute('x') / EMU, y: +off.getAttribute('y') / EMU, w: +ext.getAttribute('cx') / EMU, h: +ext.getAttribute('cy') / EMU, rot: (+x.getAttribute('rot') || 0) / 60000 }; };
        const phOf = sp => { const nv = sp.firstElementChild, ph = nv ? A(nv, 'ph')[0] || Pn(nv, 'ph')[0] : null; return ph ? { type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx') || '' } : null; };
        // Platzhalter aus Layout und Master (Position, Schriftgröße)
        async function phTable(path) { if (!path) return []; const d = xml(await get(path)); return Pn(d, 'sp').map(sp => ({ ph: phOf(sp), xf: xf(kid(sp, NS.p, 'spPr')), sz: (() => { const r = A(sp, 'defRPr')[0]; return r && r.getAttribute('sz') ? +r.getAttribute('sz') / 100 : 0; })(), anchor: (A(sp, 'bodyPr')[0] || { getAttribute: () => null }).getAttribute('anchor') })).filter(x => x.ph); }
        const find = (tab, ph) => tab.find(t => ph.idx && t.ph.idx === ph.idx) || tab.find(t => t.ph.type === ph.type) || tab.find(t => (ph.type === 'ctrTitle' && t.ph.type === 'title') || (ph.type === 'subTitle' && t.ph.type === 'body') || (ph.type === 'title' && t.ph.type === 'ctrTitle'));
        const DEF_SZ = { title: 44, ctrTitle: 54, subTitle: 24, body: 24, obj: 24 };
        async function bgOf(path, rels) {
            const d = xml(await get(path)), bg = Pn(d, 'bg')[0]; if (!bg) return null; const bp = kid(bg, NS.p, 'bgPr');
            if (bp) { const bf = kid(bp, NS.a, 'blipFill'); if (bf) { const r = rels[rid(A(bf, 'blip')[0])]; if (r) return { img: await img(r.t) }; } const f = fillOf(bp); if (f) return { color: f }; }
            const br = kid(bg, NS.p, 'bgRef'); if (br) { const c = color(br); if (c) return { color: c }; }
            return null;
        }
        const slides = [];
        for (const sid of Pn(pres, 'sldId')) {
            const r = pr[rid(sid)]; if (!r) continue; const path = r.t, sd = xml(await get(path)), rels = await relsOf(path);
            const layPath = (Object.values(rels).find(x => /slideLayout$/.test(x.type)) || {}).t, layRels = layPath ? await relsOf(layPath) : {}, masPath = (Object.values(layRels).find(x => /slideMaster$/.test(x.type)) || {}).t, masRels = masPath ? await relsOf(masPath) : {};
            const lay = await phTable(layPath), mas = await phTable(masPath);
            const bg = (await bgOf(path, rels)) || (layPath && await bgOf(layPath, layRels)) || (masPath && await bgOf(masPath, masRels)) || { color: 'FFFFFF' };
            const shapes = [];
            async function walk(tree, g) {
                for (const el of tree.children) {
                    const ln = el.localName;
                    if (ln === 'grpSp') { const gx = A(kid(el, NS.p, 'grpSpPr'), 'xfrm')[0]; let ng = g; if (gx) { const off = kid(gx, NS.a, 'off'), ext = kid(gx, NS.a, 'ext'), co = kid(gx, NS.a, 'chOff'), ce = kid(gx, NS.a, 'chExt'); if (off && ext && co && ce) { const sx = (+ext.getAttribute('cx') || 1) / (+ce.getAttribute('cx') || 1), sy = (+ext.getAttribute('cy') || 1) / (+ce.getAttribute('cy') || 1); const tx = +off.getAttribute('x') / EMU - (+co.getAttribute('x') / EMU) * sx, ty = +off.getAttribute('y') / EMU - (+co.getAttribute('y') / EMU) * sy; ng = { sx: g.sx * sx, sy: g.sy * sy, tx: g.tx + tx * g.sx, ty: g.ty + ty * g.sy }; } } await walk(el, ng); continue; }
                    const apply = p => p && { x: p.x * g.sx + g.tx, y: p.y * g.sy + g.ty, w: p.w * g.sx, h: p.h * g.sy, rot: p.rot };
                    if (ln === 'pic') { const bl = A(el, 'blip')[0], rr = bl && rels[rid(bl)]; const p = apply(xf(kid(el, NS.p, 'spPr'))); if (!rr || !p) continue; const src = await img(rr.t); if (!src) continue; shapes.push(Object.assign({ type: 'image', src }, p)); continue; }
                    if (ln === 'graphicFrame') { const p = apply(xf(el)); if (!p) continue; const tbl = A(el, 'tbl')[0];
                        if (tbl) { const rows = A(tbl, 'tr').map(tr => A(tr, 'tc').map(tc => A(tc, 't').map(t => t.textContent).join(' '))); shapes.push(Object.assign({ type: 'text', fill: '', paras: rows.map(rw => ({ al: 'l', runs: [{ t: rw.join('   |   '), sz: 14 }] })) }, p)); }
                        else shapes.push(Object.assign({ type: 'shape', geom: 'rect', fill: 'F3F4F6', line: '9CA3AF', anchor: 'ctr', paras: [{ al: 'ctr', runs: [{ t: 'Diagramm (wird hier nicht angezeigt)', sz: 14, color: '6B7280' }] }] }, p)); continue; }
                    if (ln !== 'sp' && ln !== 'cxnSp') continue;
                    const spPr = kid(el, NS.p, 'spPr'), ph = phOf(el); let p = apply(xf(spPr)), base = null;
                    if (ph) { const b1 = find(lay, ph), b2 = find(mas, ph), wx = find(lay.filter(t => t.xf), ph) || find(mas.filter(t => t.xf), ph); base = Object.assign({}, b2 || {}, b1 || {}); if (!base.sz) base.sz = (b1 && b1.sz) || (b2 && b2.sz) || 0; if (!p && wx) p = wx.xf; }
                    if (!p) continue;
                    const geomEl = A(spPr, 'prstGeom')[0], geom = geomEl ? geomEl.getAttribute('prst') : (ph ? 'rect' : 'rect');
                    let fill = fillOf(spPr); const sty = kid(el, NS.p, 'style'); if (fill === undefined && sty) { const fr = A(sty, 'fillRef')[0]; if (fr && +fr.getAttribute('idx') > 0) fill = color(fr); }
                    let line = ''; const lnEl = A(spPr, 'ln')[0]; if (lnEl && !kid(lnEl, NS.a, 'noFill')) { const sf = kid(lnEl, NS.a, 'solidFill'); line = sf ? color(sf) : ''; } else if (!lnEl && sty) { const lr = A(sty, 'lnRef')[0]; if (lr && +lr.getAttribute('idx') > 0 && !ph) line = color(lr) || ''; }
                    const tb = kid(el, NS.p, 'txBody'), defSz = (base && base.sz) || (ph ? DEF_SZ[ph.type] || 18 : 18), isTitle = ph && /title|ctrTitle/i.test(ph.type);
                    const defColor = (() => { const c = A(sty, 'fontRef')[0]; return c ? color(c) : null; })();
                    const paras = tb ? A(tb, 'p').map(pp => {
                        const pPr = kid(pp, NS.a, 'pPr'), al = pPr ? pPr.getAttribute('algn') : null, lvl = pPr ? +(pPr.getAttribute('lvl') || 0) : 0;
                        let bu = ''; if (pPr && kid(pPr, NS.a, 'buChar')) bu = '•'; else if (pPr && kid(pPr, NS.a, 'buAutoNum')) bu = '1.'; else if (ph && (ph.type === 'body' || ph.type === 'obj' || (!ph.type)) && !(pPr && kid(pPr, NS.a, 'buNone')) && !/subTitle/.test(ph.type)) bu = '•';
                        const runs = [...pp.children].filter(c => c.localName === 'r' || c.localName === 'fld' || c.localName === 'br').map(rr => {
                            if (rr.localName === 'br') return { t: '\n' };
                            const rp = kid(rr, NS.a, 'rPr'), t = (kid(rr, NS.a, 't') || { textContent: '' }).textContent, run = { t };
                            if (rp) { if (rp.getAttribute('sz')) run.sz = +rp.getAttribute('sz') / 100; if (rp.getAttribute('b') === '1') run.b = true; if (rp.getAttribute('i') === '1') run.i = true; if (rp.getAttribute('u') && rp.getAttribute('u') !== 'none') run.u = true; const c = color(kid(rp, NS.a, 'solidFill')); if (c) run.color = c; const lt = kid(rp, NS.a, 'latin'); if (lt && lt.getAttribute('typeface') && !/^\+/.test(lt.getAttribute('typeface'))) run.font = lt.getAttribute('typeface'); }
                            if (!run.sz) run.sz = defSz; if (!run.color && defColor) run.color = defColor; if (isTitle && !run.font && fontMj && fontMj !== 'Calibri Light') run.font = fontMj;
                            return run;
                        });
                        const out = []; let cur = { al: { ctr: 'ctr', r: 'r', just: 'just' }[al] || (ph && ph.type === 'ctrTitle' || ph && ph.type === 'subTitle' ? 'ctr' : 'l'), bu, lvl, runs: [] };
                        runs.forEach(r => { if (r.t === '\n') { out.push(cur); cur = Object.assign({}, cur, { runs: [] }); } else cur.runs.push(r); }); out.push(cur);
                        return out;
                    }).flat() : [];
                    const bp = tb ? kid(tb, NS.a, 'bodyPr') : null, anchor = (bp && bp.getAttribute('anchor')) || (base && base.anchor) || (isTitle ? 'ctr' : 't');
                    const type = (geom === 'rect' && (fill === undefined || fill === '') && !line) || ph ? 'text' : 'shape';
                    shapes.push(Object.assign({ type, geom: type === 'shape' ? geom : 'rect', fill: fill || '', line, lw: lnEl && lnEl.getAttribute('w') ? Math.max(1, Math.round(+lnEl.getAttribute('w') / EMU)) : 2, anchor: { t: 't', ctr: 'ctr', b: 'b' }[anchor] || 't', paras }, p));
                }
            }
            const tree = Pn(sd, 'spTree')[0]; if (tree) await walk(tree, { sx: 1, sy: 1, tx: 0, ty: 0 });
            const tr = Pn(sd, 'transition')[0], trans = tr && tr.firstElementChild ? ({ fade: 'fade', push: 'push', wipe: 'wipe', zoom: 'zoom', cover: 'cover', dissolve: 'fade', split: 'wipe' }[tr.firstElementChild.localName] || 'fade') : '';
            slides.push({ bg: bg.color || 'FFFFFF', bgImg: bg.img || '', trans, shapes });
        }
        if (!slides.length) slides.push({ bg: 'FFFFFF', shapes: [] });
        return { W, H, slides };
    }

    window.JMPPTX = { write, read };
})();
