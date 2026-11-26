// OS/slides.js – Präsentationsprogramm „Präsentation“ für J.Mainz OS (wie PowerPoint, nur im System).
// Speichert echte .pptx-Dateien in den Dokumenten (mit OS/pptx.js) und öffnet vorhandene .pptx.
// Folienleiste, Layouts, Designs, Textfelder, Formen, Bilder, Übergänge, Bildschirmpräsentation, Drucken/PDF.
(function () {
    'use strict';
    let API, U, e;
    const PT = 96 / 72;                      // Punkt → Pixel
    let seq = 0;
    const DESIGNS = {
        hell: { n: 'Hell', bg: 'FFFFFF', tx: '374151', ti: '111827', acc: '2563EB', acc2: 'DBEAFE' },
        dunkel: { n: 'Dunkel', bg: '1E1E2E', tx: 'D1D5DB', ti: 'FFFFFF', acc: 'A78BFA', acc2: '312E81' },
        weltall: { n: 'Weltall', bg: '0B1026', tx: 'CBD5E1', ti: 'FFFFFF', acc: '8B5CF6', acc2: '1E1B4B' },
        ozean: { n: 'Ozean', bg: '0E4D64', tx: 'E0F2FE', ti: 'FFFFFF', acc: '22D3EE', acc2: '155E75' },
        frisch: { n: 'Frisch', bg: 'F0FDF4', tx: '14532D', ti: '166534', acc: '22C55E', acc2: 'DCFCE7' },
        warm: { n: 'Warm', bg: 'FFF7ED', tx: '7C2D12', ti: '9A3412', acc: 'F97316', acc2: 'FFEDD5' },
        rosa: { n: 'Rosa', bg: 'FDF2F8', tx: '831843', ti: '9D174D', acc: 'EC4899', acc2: 'FCE7F3' },
        schiefer: { n: 'Schiefer', bg: '334155', tx: 'E2E8F0', ti: 'FFFFFF', acc: 'FBBF24', acc2: '475569' },
    };
    const LAYOUTS = [['title', 'Titelfolie', 'fa-heading'], ['content', 'Titel und Inhalt', 'fa-list-ul'], ['two', 'Zwei Inhalte', 'fa-table-columns'], ['picture', 'Bild mit Titel', 'fa-image'], ['section', 'Abschnitt', 'fa-bookmark'], ['titleonly', 'Nur Titel', 'fa-minus'], ['blank', 'Leer', 'fa-square']];
    const GEOMS = [['rect', 'Rechteck'], ['roundRect', 'Abgerundet'], ['ellipse', 'Ellipse'], ['triangle', 'Dreieck'], ['diamond', 'Raute'], ['rightArrow', 'Pfeil'], ['chevron', 'Winkel'], ['star5', 'Stern'], ['hexagon', 'Sechseck'], ['heart', 'Herz']];
    const PAL = ['000000', '404040', '7F7F7F', 'BFBFBF', 'FFFFFF', 'C00000', 'FF0000', 'FFC000', 'FFFF00', '92D050', '00B050', '00B0F0', '0070C0', '002060', '7030A0', '2563EB', '8B5CF6', 'EC4899', 'F97316', '22C55E'];
    const FONTS = ['Calibri', 'Calibri Light', 'Arial', 'Georgia', 'Verdana', 'Segoe UI', 'Trebuchet MS', 'Times New Roman', 'Courier New', 'Comic Sans MS'];
    const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 54, 66, 72, 96];
    const TRANS = [['', 'Ohne', 'fa-ban'], ['fade', 'Verblassen', 'fa-circle-half-stroke'], ['push', 'Schieben', 'fa-arrow-up'], ['wipe', 'Wischen', 'fa-arrow-right'], ['cover', 'Aufdecken', 'fa-arrow-left'], ['zoom', 'Zoom', 'fa-magnifying-glass-plus']];

    // ---------- Folien bauen ----------
    const run = (t, o = {}) => Object.assign({ t }, o);
    const para = (t, o = {}, r = {}) => ({ al: o.al || 'l', bu: o.bu || '', lvl: o.lvl || 0, runs: t === '' ? [run('', r)] : [run(t, r)] });
    function make(layout, d, W, H, txt = {}) {
        const s = [], ti = { color: d.ti, sz: 40, font: 'Calibri Light' }, tx = { color: d.tx, sz: 24 };
        const box = (x, y, w, h, paras, o = {}) => s.push(Object.assign({ type: 'text', x, y, w, h, fill: '', line: '', anchor: 't', paras }, o));
        const M = Math.round(W * .05);
        if (layout === 'title') { box(M * 2, H * .3, W - M * 4, H * .22, [para(txt.t || '', { al: 'ctr' }, Object.assign({}, ti, { sz: 54 }))], { anchor: 'b', ph: 'Titel hinzufügen' }); box(M * 3, H * .55, W - M * 6, H * .14, [para(txt.s || '', { al: 'ctr' }, Object.assign({}, tx, { sz: 24 }))], { ph: 'Untertitel hinzufügen' }); s.push({ type: 'shape', geom: 'rect', x: W / 2 - 60, y: H * .53, w: 120, h: 5, fill: d.acc, line: '', paras: [] }); }
        else if (layout === 'section') { s.push({ type: 'shape', geom: 'rect', x: 0, y: H * .38, w: 14, h: H * .24, fill: d.acc, line: '', paras: [] }); box(M * 1.5, H * .3, W - M * 3, H * .25, [para(txt.t || '', { al: 'l' }, Object.assign({}, ti, { sz: 48 }))], { anchor: 'b', ph: 'Abschnittstitel' }); box(M * 1.5, H * .56, W - M * 3, H * .14, [para(txt.s || '', {}, Object.assign({}, tx, { sz: 22 }))], { ph: 'Text hinzufügen' }); }
        else if (layout !== 'blank') {
            box(M, H * .06, W - M * 2, H * .16, [para(txt.t || '', {}, ti)], { anchor: 'ctr', ph: 'Titel hinzufügen' });
            const items = txt.b && txt.b.length ? txt.b : [''];
            if (layout === 'content') box(M, H * .26, W - M * 2, H * .66, items.map(t => para(t, { bu: '•' }, tx)), { ph: 'Text hinzufügen' });
            if (layout === 'two') { const cw = (W - M * 3) / 2; box(M, H * .26, cw, H * .66, items.map(t => para(t, { bu: '•' }, tx)), { ph: 'Text hinzufügen' }); box(M * 2 + cw, H * .26, cw, H * .66, (txt.b2 || ['']).map(t => para(t, { bu: '•' }, tx)), { ph: 'Text hinzufügen' }); }
            if (layout === 'picture') s.push({ type: 'shape', geom: 'rect', x: M, y: H * .26, w: W - M * 2, h: H * .66, fill: d.acc2, line: '', anchor: 'ctr', pic: true, paras: [para('Doppelklick: Bild einfügen', { al: 'ctr' }, { color: d.tx, sz: 20 })] });
        }
        return { bg: d.bg, trans: '', shapes: s };
    }
    const TPL = {
        leer: { n: 'Leere Präsentation', d: 'hell', i: 'fa-file', slides: () => [['title']] },
        referat: { n: 'Referat', d: 'hell', i: 'fa-person-chalkboard', slides: () => [['title', { t: 'Mein Thema', s: (U && U.name) || '' }], ['content', { t: 'Gliederung', b: ['Einleitung', 'Hauptteil', 'Fazit'] }], ['section', { t: 'Einleitung', s: 'Worum geht es?' }], ['content', { t: 'Hauptteil', b: ['Erster Punkt', 'Zweiter Punkt', 'Dritter Punkt'] }], ['two', { t: 'Vergleich', b: ['Vorteile …'], b2: ['Nachteile …'] }], ['content', { t: 'Fazit', b: ['Das Wichtigste in einem Satz'] }], ['title', { t: 'Danke fürs Zuhören!', s: 'Fragen?' }]] },
        urlaub: { n: 'Urlaubsrückblick', d: 'ozean', i: 'fa-umbrella-beach', slides: () => [['title', { t: 'Unser Urlaub', s: 'Sommer ' + new Date().getFullYear() }], ['picture', { t: 'Die Anreise' }], ['picture', { t: 'Unterwegs' }], ['content', { t: 'Highlights', b: ['Bestes Essen: …', 'Schönster Ort: …', 'Lustigster Moment: …'] }], ['title', { t: 'Bis zum nächsten Mal!', s: '' }]] },
        geburtstag: { n: 'Geburtstag', d: 'warm', i: 'fa-cake-candles', slides: () => [['title', { t: 'Alles Gute zum Geburtstag!', s: 'Für …' }], ['picture', { t: 'Unsere schönsten Momente' }], ['content', { t: 'Was wir an dir lieben', b: ['…', '…', '…'] }]] },
        familie: { n: 'Familien-Info', d: 'frisch', i: 'fa-house-chimney', slides: () => [['title', { t: 'Familienrat', s: new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) }], ['content', { t: 'Themen', b: ['Urlaubsplanung', 'Haushalt', 'Termine'] }], ['two', { t: 'Wer macht was?', b: ['Einkaufen: …', 'Kochen: …'], b2: ['Wäsche: …', 'Müll: …'] }]] },
        weltall: { n: 'Weltall', d: 'weltall', i: 'fa-rocket', slides: () => [['title', { t: 'Präsentation', s: 'Untertitel' }], ['content', { t: 'Überschrift', b: [''] }]] },
    };
    const newDeck = (tpl) => { const t = TPL[tpl] || TPL.leer, d = DESIGNS[t.d], W = 1280, H = 720; return { W, H, design: t.d, slides: t.slides().map(([l, x]) => make(l, d, W, H, x)) }; };

    // ---------- Darstellung ----------
    function geomSvg(g, w, h, fill, line, lw) {
        const f = fill ? '#' + fill : 'none', st = line ? `stroke="#${line}" stroke-width="${lw || 2}" vector-effect="non-scaling-stroke"` : '';
        let el;
        switch (g) {
            case 'ellipse': el = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}"`; break;
            case 'roundRect': { const r = Math.min(w, h) * .16; el = `<rect width="${w}" height="${h}" rx="${r}" ry="${r}"`; break; }
            case 'triangle': el = `<polygon points="${w / 2},0 ${w},${h} 0,${h}"`; break;
            case 'diamond': el = `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}"`; break;
            case 'rightArrow': { const hw = Math.min(w * .45, h); el = `<polygon points="0,${h * .25} ${w - hw},${h * .25} ${w - hw},0 ${w},${h / 2} ${w - hw},${h} ${w - hw},${h * .75} 0,${h * .75}"`; break; }
            case 'leftArrow': { const hw = Math.min(w * .45, h); el = `<polygon points="${w},${h * .25} ${hw},${h * .25} ${hw},0 0,${h / 2} ${hw},${h} ${hw},${h * .75} ${w},${h * .75}"`; break; }
            case 'chevron': { const k = Math.min(w * .4, h * .5); el = `<polygon points="0,0 ${w - k},0 ${w},${h / 2} ${w - k},${h} 0,${h} ${k},${h / 2}"`; break; }
            case 'hexagon': { const k = Math.min(w * .25, h * .5); el = `<polygon points="${k},0 ${w - k},0 ${w},${h / 2} ${w - k},${h} ${k},${h} 0,${h / 2}"`; break; }
            case 'star5': { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .2 : .5; pts.push(`${w / 2 + Math.cos(a) * r * w},${h / 2 + Math.sin(a) * r * h + h * .04}`); } el = `<polygon points="${pts.join(' ')}"`; break; }
            case 'heart': el = `<path d="M${w / 2},${h * .3} C${w / 2},${h * .05} ${w * .05},${h * .05} ${w * .05},${h * .35} C${w * .05},${h * .6} ${w / 2},${h * .8} ${w / 2},${h} C${w / 2},${h * .8} ${w * .95},${h * .6} ${w * .95},${h * .35} C${w * .95},${h * .05} ${w / 2},${h * .05} ${w / 2},${h * .3} Z"`; break;
            case 'line': return `<svg class="pxs-g" viewBox="0 0 ${w} ${Math.max(1, h)}" preserveAspectRatio="none"><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="#${line || fill || '000000'}" stroke-width="${lw || 3}" vector-effect="non-scaling-stroke"/></svg>`;
            default: el = `<rect width="${w}" height="${h}"`;
        }
        return `<svg class="pxs-g" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${el} fill="${f}" ${st}/></svg>`;
    }
    const runCss = r => `${r.sz ? `font-size:${(r.sz * PT).toFixed(1)}px;` : ''}${r.b ? 'font-weight:700;' : ''}${r.i ? 'font-style:italic;' : ''}${r.u ? 'text-decoration:underline;' : ''}${r.color ? `color:#${r.color};` : ''}${r.font ? `font-family:'${r.font.replace(/'/g, '')}',Calibri,Carlito,sans-serif;` : ''}`;
    function parasHtml(paras) {
        return (paras || []).map(p => {
            const r0 = (p.runs || [])[0] || {}, runs = (p.runs || []).filter(r => r.t !== '');
            return `<p class="al-${p.al || 'l'}${p.bu ? ' bu' : ''}" data-bu="${e(p.bu || '')}" data-lvl="${p.lvl || 0}" style="${runCss(r0)}--lvl:${p.lvl || 0}">${runs.length ? runs.map(r => `<span style="${runCss(r)}">${e(r.t)}</span>`).join('') : '<br>'}</p>`;
        }).join('');
    }
    const empty = s => !(s.paras || []).some(p => (p.runs || []).some(r => r.t && r.t.trim()));
    function shapeHtml(s, i, edit) {
        const tr = s.rot ? `transform:rotate(${s.rot}deg);` : '';
        let inner = '';
        if (s.type === 'image') inner = `<img src="${s.src}" alt="" draggable="false" class="${s.geom === 'ellipse' ? 'el' : ''}">`;
        else { if (s.type === 'shape') inner = geomSvg(s.geom, s.w, s.h, s.fill, s.line, s.lw); else if (s.fill || s.line) inner = geomSvg('rect', s.w, s.h, s.fill, s.line, s.lw);
            const ph = edit && s.ph && empty(s) ? ` data-ph="${e(s.ph)}"` : ''; inner += `<div class="pxs-tx an-${s.anchor || 't'}${s.type === 'shape' ? ' in' : ''}"${ph}>${parasHtml(s.paras)}</div>`; }
        return `<div class="pxs-sh${s.type === 'image' ? ' img' : ''}" data-i="${i}" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px;${tr}">${inner}</div>`;
    }
    const slideBg = sl => `background:#${sl.bg || 'FFFFFF'}${sl.bgImg ? ` url("${sl.bgImg}") center/cover no-repeat` : ''};`;
    const slideHtml = (sl, edit) => sl.shapes.map((s, i) => shapeHtml(s, i, edit)).join('');
    function shrink(file, max = 1600) {
        return new Promise((res, rej) => { const r = new FileReader(); r.onerror = () => rej(new Error('Bild nicht lesbar')); r.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('Bild nicht lesbar')); im.onload = () => { const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k); const c = Object.assign(document.createElement('canvas'), { width: w, height: h }); c.getContext('2d').drawImage(im, 0, 0, w, h); const png = /png|gif/.test(file.type) && file.size < 500000; res({ src: c.toDataURL(png ? 'image/png' : 'image/jpeg', .85), w, h }); }; im.src = r.result; }; r.readAsDataURL(file); });
    }
    const hex = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c || ''); if (!m || (m[4] !== undefined && +m[4] === 0)) return ''; return [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join('').toUpperCase(); };

    function open(key) { API.openApp('praesentation', { key: 'px:' + key, params: { open: key } }); }
    function create(folder, tpl) { API.openApp('praesentation', { key: 'px:neu' + (++seq), params: { folder: folder || '', tpl: tpl || 'leer' } }); }

    // ======================================================================
    function ui(body, win) {
        const P = win.params || {};
        const doc = { key: P.open || null, name: 'Präsentation1.pptx', folder: P.folder || '', saved: '', saving: false };
        let deck = newDeck(P.tpl), cur = 0, sel = [], editing = -1, zoomFit = true, zoom = 1, clip = null;
        const DKEY = () => 'jmos-px-' + U.uid + '-' + (doc.key || win.key);
        body.innerHTML = `<div class="pxa">
            <div class="wr-rib px-rib">
                <div class="wr-tabs"><button type="button" class="wr-file px-file" data-rt="file">Datei</button>${[['home', 'Start'], ['ins', 'Einfügen'], ['des', 'Entwurf'], ['tr', 'Übergänge'], ['show', 'Bildschirmpräsentation']].map(([k, n], i) => `<button type="button" data-rt="${k}"${i ? '' : ' class="on"'}>${n}</button>`).join('')}<span class="wr-fill"></span><span class="wr-sv"></span><button type="button" class="wr-qs" data-c="show0" title="Von Beginn an (F5)"><i class="fa-solid fa-play"></i></button><button type="button" class="wr-qs" data-c="save" title="Speichern (Strg+S)"><i class="fa-solid fa-floppy-disk"></i></button></div>
                <div class="wr-band" data-band="home">
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-dd="newslide"><i class="fa-solid fa-square-plus"></i><span>Neue Folie <i class="fa-solid fa-chevron-down wr-chev"></i></span></button><div class="wr-col2"><button type="button" data-dd="layout"><i class="fa-solid fa-table-columns"></i><span>Layout</span></button><button type="button" data-c="dupSlide"><i class="fa-solid fa-clone"></i><span>Duplizieren</span></button><button type="button" data-c="delSlide"><i class="fa-solid fa-trash-can"></i><span>Löschen</span></button></div></div><small>Folien</small></div>
                    <div class="wr-g"><div class="wr-gb wr-rows"><div class="wr-row"><select class="px-font" title="Schriftart">${FONTS.map(f => `<option style="font-family:'${f}'">${f}</option>`).join('')}</select><select class="px-size" title="Schriftgröße">${SIZES.map(s => `<option>${s}</option>`).join('')}</select><button type="button" data-c="grow" title="Größer"><i class="fa-solid fa-font"></i><sup>+</sup></button><button type="button" data-c="shrinkf" title="Kleiner"><i class="fa-solid fa-font" style="font-size:.8em"></i><sup>−</sup></button></div>
                        <div class="wr-row"><button type="button" data-c="bold" title="Fett (Strg+B)"><i class="fa-solid fa-bold"></i></button><button type="button" data-c="italic" title="Kursiv (Strg+I)"><i class="fa-solid fa-italic"></i></button><button type="button" data-c="underline" title="Unterstrichen (Strg+U)"><i class="fa-solid fa-underline"></i></button><span class="wr-split"><button type="button" data-c="fore" title="Schriftfarbe"><i class="fa-solid fa-a"></i><b class="wr-bar px-fb" style="background:#C00000"></b></button><button type="button" class="wr-dd" data-dd="fore" aria-label="Farbe wählen"><i class="fa-solid fa-chevron-down"></i></button></span></div></div><small>Schriftart</small></div>
                    <div class="wr-g"><div class="wr-gb wr-rows"><div class="wr-row"><button type="button" data-c="bullet" title="Aufzählung"><i class="fa-solid fa-list-ul"></i></button><button type="button" data-c="number" title="Nummerierung"><i class="fa-solid fa-list-ol"></i></button><button type="button" data-c="outdent" title="Ebene höher"><i class="fa-solid fa-outdent"></i></button><button type="button" data-c="indent" title="Ebene tiefer"><i class="fa-solid fa-indent"></i></button></div><div class="wr-row"><button type="button" data-c="al-l" title="Links"><i class="fa-solid fa-align-left"></i></button><button type="button" data-c="al-ctr" title="Zentriert"><i class="fa-solid fa-align-center"></i></button><button type="button" data-c="al-r" title="Rechts"><i class="fa-solid fa-align-right"></i></button><button type="button" data-c="al-just" title="Blocksatz"><i class="fa-solid fa-align-justify"></i></button><button type="button" data-dd="anchor" title="Text vertikal ausrichten"><i class="fa-solid fa-arrows-up-down"></i><i class="fa-solid fa-chevron-down wr-chev"></i></button></div></div><small>Absatz</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="textbox"><i class="fa-solid fa-font"></i><span>Textfeld</span></button><button type="button" class="wr-big" data-dd="shapes"><i class="fa-solid fa-shapes"></i><span>Formen <i class="fa-solid fa-chevron-down wr-chev"></i></span></button><div class="wr-col2"><span class="wr-split"><button type="button" data-c="fill" title="Fülleffekt"><i class="fa-solid fa-fill-drip"></i><b class="wr-bar px-flb" style="background:#2563EB"></b></button><button type="button" class="wr-dd" data-dd="fill" aria-label="Füllfarbe"><i class="fa-solid fa-chevron-down"></i></button></span><span class="wr-split"><button type="button" data-c="line" title="Kontur"><i class="fa-solid fa-pen"></i><b class="wr-bar px-lnb" style="background:#1F2937"></b></button><button type="button" class="wr-dd" data-dd="line" aria-label="Konturfarbe"><i class="fa-solid fa-chevron-down"></i></button></span></div></div><small>Zeichnen</small></div>
                    <div class="wr-g"><div class="wr-gb"><div class="wr-col2"><button type="button" data-c="front"><i class="fa-solid fa-arrow-up"></i><span>Nach vorne</span></button><button type="button" data-c="back"><i class="fa-solid fa-arrow-down"></i><span>Nach hinten</span></button><button type="button" data-dd="align"><i class="fa-solid fa-object-group"></i><span>Ausrichten</span></button></div></div><small>Anordnen</small></div>
                </div>
                <div class="wr-band" data-band="ins" hidden>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-dd="newslide"><i class="fa-solid fa-square-plus"></i><span>Neue Folie</span></button></div><small>Folien</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="imgpc"><i class="fa-solid fa-image"></i><span>Bild vom Computer</span></button><button type="button" class="wr-big" data-c="imgdoc"><i class="fa-solid fa-folder-open"></i><span>Bild aus Dokumenten</span></button><button type="button" class="wr-big" data-dd="shapes"><i class="fa-solid fa-shapes"></i><span>Formen</span></button></div><small>Bilder &amp; Formen</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="textbox"><i class="fa-solid fa-font"></i><span>Textfeld</span></button><button type="button" class="wr-big" data-c="date"><i class="fa-solid fa-calendar-day"></i><span>Datum</span></button><button type="button" class="wr-big" data-c="slidenum"><i class="fa-solid fa-hashtag"></i><span>Folien&shy;nummern</span></button></div><small>Text</small></div>
                </div>
                <div class="wr-band" data-band="des" hidden>
                    <div class="wr-g"><div class="wr-gb px-designs">${Object.entries(DESIGNS).map(([k, d]) => `<button type="button" class="px-des" data-des="${k}" title="${d.n}" style="background:#${d.bg}"><b style="color:#${d.ti}">Aa</b><i style="background:#${d.acc}"></i><small>${d.n}</small></button>`).join('')}</div><small>Designs</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-dd="bg"><i class="fa-solid fa-palette"></i><span>Hintergrund&shy;farbe</span></button><button type="button" class="wr-big" data-c="bgimg"><i class="fa-solid fa-panorama"></i><span>Hintergrund&shy;bild</span></button><button type="button" class="wr-big" data-c="bgall"><i class="fa-solid fa-layer-group"></i><span>Für alle übernehmen</span></button></div><small>Anpassen</small></div>
                </div>
                <div class="wr-band" data-band="tr" hidden>
                    <div class="wr-g"><div class="wr-gb">${TRANS.map(([k, n, i]) => `<button type="button" class="wr-big wr-tg" data-tr="${k}"><i class="fa-solid ${i}"></i><span>${n}</span></button>`).join('')}</div><small>Übergang zu dieser Folie</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="trall"><i class="fa-solid fa-layer-group"></i><span>Für alle übernehmen</span></button></div><small>Anwenden</small></div>
                </div>
                <div class="wr-band" data-band="show" hidden>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="show0"><i class="fa-solid fa-play"></i><span>Von Beginn an</span></button><button type="button" class="wr-big" data-c="showCur"><i class="fa-solid fa-forward-step"></i><span>Ab aktueller Folie</span></button></div><small>Präsentation starten</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="print"><i class="fa-solid fa-file-pdf"></i><span>Als PDF / Drucken</span></button></div><small>Ausgabe</small></div>
                </div>
            </div>
            <div class="px-body"><div class="px-side" tabindex="-1"></div><div class="px-stage" tabindex="-1"><div class="px-wrap"><div class="px-slide"></div><div class="px-selbox" hidden></div><div class="px-guides"></div></div></div></div>
            <div class="wr-st"><span class="px-pos"></span><span class="px-hint"></span><span class="wr-fill"></span><button type="button" data-c="zout" aria-label="Verkleinern"><i class="fa-solid fa-minus"></i></button><input type="range" class="wr-zr" min="25" max="200" step="5" aria-label="Zoom"><button type="button" data-c="zin" aria-label="Vergrößern"><i class="fa-solid fa-plus"></i></button><span class="wr-zv"></span><button type="button" data-c="zfit" title="An Fenster anpassen"><i class="fa-solid fa-expand"></i></button></div>
            <div class="wr-pop" hidden></div><div class="wr-back" hidden></div>
            <input type="file" hidden class="px-fimg" accept="image/*"><input type="file" hidden class="px-fbg" accept="image/*"><input type="file" hidden class="px-fopen" accept=".pptx">
        </div>`;
        const $ = s => body.querySelector(s), side = $('.px-side'), stage = $('.px-stage'), wrap = $('.px-wrap'), slideEl = $('.px-slide'), selbox = $('.px-selbox'), pop = $('.wr-pop'), guides = $('.px-guides');
        const sl = () => deck.slides[cur], D = () => DESIGNS[deck.design] || DESIGNS.hell;

        // ---------- Rückgängig ----------
        const H = { st: [], i: -1 };
        const snapStr = () => JSON.stringify(deck);
        function snap() { const s = snapStr(); if (H.st[H.i] === s) return; H.st = H.st.slice(0, H.i + 1); H.st.push(s); if (H.st.length > 60) H.st.shift(); H.i = H.st.length - 1; }
        function undo() { endEdit(); snap(); if (H.i <= 0) return; H.i--; deck = JSON.parse(H.st[H.i]); cur = Math.min(cur, deck.slides.length - 1); sel = []; renderAll(); changed(true); }
        function redo() { if (H.i >= H.st.length - 1) return; H.i++; deck = JSON.parse(H.st[H.i]); cur = Math.min(cur, deck.slides.length - 1); sel = []; renderAll(); changed(true); }
        const act = (fn, all) => { snap(); fn(); snap(); if (all) renderAll(); else { renderSlide(); thumb(cur); } changed(); };

        // ---------- Zeichnen ----------
        function fit() {
            const r = stage.getBoundingClientRect(); if (!r.width) return;
            if (zoomFit) zoom = Math.max(.1, Math.min((r.width - 60) / deck.W, (r.height - 50) / deck.H));
            wrap.style.width = deck.W * zoom + 'px'; wrap.style.height = deck.H * zoom + 'px';
            slideEl.style.width = deck.W + 'px'; slideEl.style.height = deck.H + 'px'; slideEl.style.transform = `scale(${zoom})`;
            $('.wr-zr').value = Math.round(zoom * 100); $('.wr-zv').textContent = Math.round(zoom * 100) + ' %';
            placeSel();
        }
        function renderSlide() {
            const s = sl(); slideEl.style.cssText = `width:${deck.W}px;height:${deck.H}px;transform:scale(${zoom});${slideBg(s)}`;
            slideEl.innerHTML = slideHtml(s, true);
            if (editing >= 0) { const el = slideEl.querySelector(`[data-i="${editing}"] .pxs-tx`); if (el) { el.contentEditable = 'true'; } }
            placeSel(); status(); reflect();
        }
        function thumbHtml(s, i) { const k = 176 / deck.W; return `<div class="px-th${i === cur ? ' on' : ''}" data-s="${i}" draggable="true"><span class="px-tn">${i + 1}${s.trans ? '<i class="fa-solid fa-star"></i>' : ''}</span><div class="px-tw" style="height:${deck.H * k}px"><div class="px-ts" style="width:${deck.W}px;height:${deck.H}px;transform:scale(${k});${slideBg(s)}">${slideHtml(s, false)}</div></div></div>`; }
        function renderSide() { side.innerHTML = deck.slides.map(thumbHtml).join(''); const on = side.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
        function thumb(i) { const el = side.querySelector(`[data-s="${i}"]`); if (!el) return renderSide(); el.outerHTML = thumbHtml(deck.slides[i], i); }
        function renderAll() { renderSide(); renderSlide(); fit(); }
        function placeSel() {
            slideEl.querySelectorAll('.pxs-sh').forEach(el => el.classList.toggle('sel', sel.includes(+el.dataset.i)));
            if (sel.length !== 1 || editing >= 0 && false) { selbox.hidden = true; if (sel.length > 1) { selbox.hidden = true; } }
            if (sel.length === 1 && sl().shapes[sel[0]]) { const s = sl().shapes[sel[0]]; selbox.hidden = false; Object.assign(selbox.style, { left: s.x * zoom + 'px', top: s.y * zoom + 'px', width: s.w * zoom + 'px', height: s.h * zoom + 'px', transform: s.rot ? `rotate(${s.rot}deg)` : '' });
                selbox.innerHTML = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => `<i class="px-h h-${h}" data-h="${h}"></i>`).join('') + '<i class="px-rot" data-h="rot" title="Drehen"><i class="fa-solid fa-rotate-right"></i></i>';
                selbox.classList.toggle('editing', editing === sel[0]); }
            else selbox.hidden = true;
        }
        function status() { $('.px-pos').textContent = `Folie ${cur + 1} von ${deck.slides.length}`; $('.px-hint').textContent = editing >= 0 ? 'Text bearbeiten – Esc zum Beenden' : sel.length ? 'Ziehen zum Verschieben · Doppelklick zum Bearbeiten · Entf zum Löschen' : 'Klick auf ein Objekt, um es auszuwählen'; title(); }
        function go(i) { endEdit(); cur = Math.max(0, Math.min(deck.slides.length - 1, i)); sel = []; side.querySelectorAll('.px-th').forEach(t => t.classList.toggle('on', +t.dataset.s === cur)); const on = side.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' }); renderSlide(); }

        // ---------- Speichern-Zustand ----------
        const sig = () => snapStr(), dirty = () => sig() !== doc.saved;
        let tD = 0; function changed() { status(); clearTimeout(tD); tD = setTimeout(draft, 1500); }
        function title() { const t = (dirty() ? '*' : '') + doc.name + ' – Präsentation', el = win.el.querySelector('.wt-title'); if (el && el.textContent !== t) { el.textContent = t; API.renderTasks(); }
            $('.wr-sv').innerHTML = doc.saving ? '<i class="fa-solid fa-spinner fa-spin"></i>Speichert …' : !doc.key ? '<i class="fa-solid fa-circle-info"></i>Nicht gespeichert' : dirty() ? '<i class="fa-solid fa-pen"></i>Geändert' : '<i class="fa-solid fa-cloud"></i>Gespeichert'; }
        function draft() { try { if (dirty()) localStorage.setItem(DKEY(), JSON.stringify({ deck, name: doc.name, t: Date.now() })); else localStorage.removeItem(DKEY()); } catch (x) {} }

        // ---------- Text bearbeiten ----------
        function startEdit(i, atPoint) {
            const s = sl().shapes[i]; if (!s || s.type === 'image') return; if (s.pic) return pickImage(i);
            endEdit(); editing = i; sel = [i]; snap();
            const el = slideEl.querySelector(`[data-i="${i}"] .pxs-tx`); el.removeAttribute('data-ph'); el.contentEditable = 'true'; el.focus();
            try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, true); } catch (x) {}
            const r = document.createRange();
            if (atPoint && document.caretRangeFromPoint) { const cr = document.caretRangeFromPoint(atPoint.x, atPoint.y); if (cr && el.contains(cr.startContainer)) { getSelection().removeAllRanges(); getSelection().addRange(cr); placeSel(); status(); return; } }
            if (empty(s)) { r.selectNodeContents(el.querySelector('p') || el); r.collapse(true); } else { r.selectNodeContents(el); r.collapse(false); }
            getSelection().removeAllRanges(); getSelection().addRange(r); placeSel(); status();
        }
        function parseTx(el, s) {
            const blocks = [...el.children].filter(c => /^(P|DIV|UL|OL|LI|H\d)$/.test(c.tagName)); const list = blocks.length ? blocks : [el];
            const out = [];
            list.forEach(b => {
                const base = { al: (/al-(\w+)/.exec(b.className) || [])[1] || ({ center: 'ctr', right: 'r', justify: 'just' }[b.style.textAlign] || 'l'), bu: b.classList.contains('bu') ? (b.dataset.bu || '•') : '', lvl: +(b.dataset.lvl || 0) };
                if (b.style.textAlign) base.al = { center: 'ctr', right: 'r', justify: 'just', left: 'l' }[b.style.textAlign] || base.al;
                let cur = Object.assign({}, base, { runs: [] });
                const walk = n => { for (const c of n.childNodes) {
                    if (c.nodeType === 3) { if (!c.nodeValue) continue; const pe = c.parentElement, cs = getComputedStyle(pe); let u = false; for (let x = pe; x && x !== el.parentElement; x = x.parentElement) { if (x.tagName === 'U' || /underline/.test(x.style.textDecoration || x.style.textDecorationLine || '')) { u = true; break; } }
                        const r = { t: c.nodeValue.replace(/​/g, ''), sz: Math.round(parseFloat(cs.fontSize) / PT * 2) / 2 }; if (+cs.fontWeight >= 600) r.b = true; if (cs.fontStyle === 'italic') r.i = true; if (u) r.u = true; const col = hex(cs.color); if (col) r.color = col; const f = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(); if (f && f !== 'Calibri') r.font = f;
                        if (r.t) cur.runs.push(r); continue; }
                    if (c.nodeType !== 1) continue; if (c.tagName === 'BR') { if (c.nextSibling || c.previousSibling) { out.push(cur); cur = Object.assign({}, base, { runs: [] }); } continue; }
                    if (/^(P|DIV)$/.test(c.tagName)) { out.push(cur); cur = Object.assign({}, base, { runs: [] }); walk(c); continue; }
                    walk(c); } };
                walk(b);
                if (!cur.runs.length) { const cs = getComputedStyle(b); cur.runs = [{ t: '', sz: Math.round(parseFloat(cs.fontSize) / PT * 2) / 2, color: hex(cs.color) || undefined }]; }
                const merged = []; cur.runs.forEach(r => { const l = merged[merged.length - 1]; if (l && ['b', 'i', 'u', 'color', 'sz', 'font'].every(k => (l[k] || '') === (r[k] || ''))) l.t += r.t; else merged.push(Object.assign({}, r)); }); cur.runs = merged;
                out.push(cur);
            });
            return out.length ? out : [{ al: 'l', bu: '', lvl: 0, runs: [{ t: '' }] }];
        }
        function endEdit() {
            if (editing < 0) return; const i = editing, el = slideEl.querySelector(`[data-i="${i}"] .pxs-tx`); editing = -1;
            if (el && sl().shapes[i]) { sl().shapes[i].paras = parseTx(el, sl().shapes[i]); el.contentEditable = 'false'; }
            snap(); renderSlide(); thumb(cur); changed();
        }
        slideEl.addEventListener('input', () => { if (editing < 0) return; clearTimeout(slideEl.t); slideEl.t = setTimeout(() => { const el = slideEl.querySelector(`[data-i="${editing}"] .pxs-tx`); if (el && sl().shapes[editing]) { sl().shapes[editing].paras = parseTx(el); const k = side.querySelector(`[data-s="${cur}"] .px-ts`); if (k) k.innerHTML = slideHtml(sl(), false); changed(); } }, 400); });

        // ---------- Formatieren ----------
        const editSel = () => editing >= 0 && getSelection().rangeCount && slideEl.querySelector(`[data-i="${editing}"] .pxs-tx`).contains(getSelection().anchorNode);
        const eachRun = fn => act(() => sel.forEach(i => { const s = sl().shapes[i]; (s.paras || []).forEach(p => p.runs.forEach(fn)); }));
        const eachPara = fn => { if (editing >= 0) { const el = slideEl.querySelector(`[data-i="${editing}"] .pxs-tx`), s = getSelection(); const ps = [...el.querySelectorAll('p')]; const a = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('p'), b = s.focusNode && (s.focusNode.nodeType === 1 ? s.focusNode : s.focusNode.parentElement).closest('p');
            let i1 = ps.indexOf(a), i2 = ps.indexOf(b); if (i1 < 0) i1 = 0; if (i2 < 0) i2 = ps.length - 1; if (i1 > i2) [i1, i2] = [i2, i1]; ps.slice(i1, i2 + 1).forEach(p => fn(null, p)); return; }
            act(() => sel.forEach(i => (sl().shapes[i].paras || []).forEach(p => fn(p)))); };
        function setSizeEdit(px) { document.execCommand('fontSize', false, 7); slideEl.querySelectorAll('font[size="7"]').forEach(f => { const sp = document.createElement('span'); sp.style.fontSize = px + 'px'; while (f.firstChild) sp.appendChild(f.firstChild); f.replaceWith(sp); }); slideEl.querySelectorAll('span').forEach(sp => { if (/xxx-large/.test(sp.style.fontSize)) sp.style.fontSize = px + 'px'; }); }
        const curRun = () => { const s = sl().shapes[sel[0]]; return s && s.paras && s.paras[0] && s.paras[0].runs[0] || {}; };
        function fmt(k, v) {
            if (editSel()) { const s = getSelection(); if (k === 'size') { if (s.isCollapsed) { const p = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement; p.closest('p').style.fontSize = v * PT + 'px'; } else setSizeEdit(v * PT); }
                else if (k === 'font') document.execCommand('fontName', false, v); else if (k === 'color') document.execCommand('foreColor', false, '#' + v); else document.execCommand(k); slideEl.dispatchEvent(new Event('input')); return; }
            if (!sel.length) return;
            if (k === 'bold') { const on = !curRun().b; eachRun(r => { r.b = on; }); } else if (k === 'italic') { const on = !curRun().i; eachRun(r => { r.i = on; }); } else if (k === 'underline') { const on = !curRun().u; eachRun(r => { r.u = on; }); }
            else if (k === 'size') eachRun(r => { r.sz = v; }); else if (k === 'font') eachRun(r => { r.font = v === 'Calibri' ? undefined : v; }); else if (k === 'color') eachRun(r => { r.color = v; });
        }
        function paraFmt(k, v) {
            eachPara((p, el) => {
                if (el) { if (k === 'al') { el.className = el.className.replace(/al-\w+/, '') + ' al-' + v; el.style.textAlign = ''; } if (k === 'bu') { const on = !(el.classList.contains('bu') && el.dataset.bu === v); el.classList.toggle('bu', on); el.dataset.bu = on ? v : ''; } if (k === 'lvl') { const n = Math.max(0, Math.min(4, +(el.dataset.lvl || 0) + v)); el.dataset.lvl = n; el.style.setProperty('--lvl', n); } return; }
                if (k === 'al') p.al = v; if (k === 'bu') p.bu = p.bu === v ? '' : v; if (k === 'lvl') p.lvl = Math.max(0, Math.min(4, (p.lvl || 0) + v));
            });
            if (editing >= 0) slideEl.dispatchEvent(new Event('input'));
        }
        function reflect() {
            const s = sl().shapes[sel[0]], r = curRun(), on = (c, v) => body.querySelectorAll(`[data-c="${c}"]`).forEach(b => b.classList.toggle('on', !!v));
            if (s && s.paras && s.paras[0]) { on('bold', r.b); on('italic', r.i); on('underline', r.u); ['l', 'ctr', 'r', 'just'].forEach(a => on('al-' + a, s.paras[0].al === a)); on('bullet', s.paras[0].bu === '•'); on('number', s.paras[0].bu === '1.');
                const f = $('.px-font'), z = $('.px-size'); const fv = r.font || 'Calibri'; if (![...f.options].some(o => o.value === fv)) f.add(new Option(fv, fv)); f.value = fv; const sv = String(r.sz || 18); if (![...z.options].some(o => o.value === sv)) z.add(new Option(sv, sv)); z.value = sv; }
            body.querySelectorAll('[data-tr]').forEach(b => b.classList.toggle('on', (sl().trans || '') === b.dataset.tr));
            body.querySelectorAll('[data-des]').forEach(b => b.classList.toggle('on', deck.design === b.dataset.des));
        }

        // ---------- Objekte ----------
        const center = (w, h) => ({ x: Math.round((deck.W - w) / 2), y: Math.round((deck.H - h) / 2), w, h });
        function addShape(s) { act(() => { sl().shapes.push(s); sel = [sl().shapes.length - 1]; }); }
        function textbox() { const d = D(); addShape(Object.assign({ type: 'text', fill: '', line: '', anchor: 't', paras: [para('', {}, { color: d.tx, sz: 24 })], ph: 'Text eingeben' }, center(480, 70))); startEdit(sl().shapes.length - 1); }
        function shape(g) { const d = D(), w = g === 'line' ? 300 : 220, h = g === 'line' ? 6 : g === 'rightArrow' || g === 'chevron' ? 120 : 220; addShape(Object.assign({ type: 'shape', geom: g, fill: g === 'line' ? '' : d.acc, line: g === 'line' ? d.tx : '', lw: 3, anchor: 'ctr', paras: [para('', { al: 'ctr' }, { color: 'FFFFFF', sz: 20 })] }, center(w, h))); }
        async function imageFile(f, into) {
            if (!f || !/^image\//.test(f.type)) return;
            try { const im = await shrink(f); act(() => {
                if (into != null && sl().shapes[into]) { const b = sl().shapes[into], k = Math.min(b.w / im.w, b.h / im.h), w = Math.round(im.w * k), h = Math.round(im.h * k); sl().shapes[into] = { type: 'image', src: im.src, x: Math.round(b.x + (b.w - w) / 2), y: Math.round(b.y + (b.h - h) / 2), w, h }; sel = [into]; return; }
                const k = Math.min(1, deck.W * .6 / im.w, deck.H * .7 / im.h); sl().shapes.push(Object.assign({ type: 'image', src: im.src }, center(Math.round(im.w * k), Math.round(im.h * k)))); sel = [sl().shapes.length - 1]; }); } catch (x) { uiAlert(x.message); }
        }
        let picTarget = null; function pickImage(i) { picTarget = i; $('.px-fimg').click(); }
        async function imageDocs() { const imgs = (window.JMOS_FILES ? JMOS_FILES.all() : []).filter(x => x.k === 'img'); if (!imgs.length) return uiAlert('In deinen Dokumenten sind noch keine Bilder.');
            showPop($('[data-c="imgdoc"]') || $('.wr-rib'), `<b class="wr-ph">Bild aus Dokumenten</b><div class="wr-pl">${imgs.map(x => `<button type="button" class="wr-pi" data-v="${e(x.key)}"><i class="fa-solid fa-image"></i>${e(x.name)}</button>`).join('')}</div>`, async k => { try { const { blob, name } = await JMOS_FILES.blobOf(k); imageFile(new File([blob], name, { type: blob.type || 'image/jpeg' }), picTarget); picTarget = null; } catch (x) { uiAlert(x.message); } }); }
        function delSel() { if (!sel.length) return; act(() => { sl().shapes = sl().shapes.filter((s, i) => !sel.includes(i)); sel = []; }); }
        function dupSel() { if (!sel.length) return; act(() => { const n = sel.map(i => Object.assign(JSON.parse(JSON.stringify(sl().shapes[i])), { x: sl().shapes[i].x + 20, y: sl().shapes[i].y + 20 })); sl().shapes.push(...n); sel = n.map((s, k) => sl().shapes.length - n.length + k); }); }
        function order(d) { if (sel.length !== 1) return; act(() => { const i = sel[0], a = sl().shapes, [s] = a.splice(i, 1); const j = d > 0 ? a.length : 0; a.splice(j, 0, s); sel = [j]; }); }
        function alignSel(k) { act(() => sel.forEach(i => { const s = sl().shapes[i]; if (k === 'l') s.x = 0; if (k === 'c') s.x = Math.round((deck.W - s.w) / 2); if (k === 'r') s.x = deck.W - s.w; if (k === 't') s.y = 0; if (k === 'm') s.y = Math.round((deck.H - s.h) / 2); if (k === 'b') s.y = deck.H - s.h; })); }

        // ---------- Folien ----------
        function newSlide(layout) { endEdit(); act(() => { deck.slides.splice(cur + 1, 0, make(layout || 'content', D(), deck.W, deck.H)); cur++; sel = []; }, true); }
        function setLayout(layout) { endEdit(); const old = sl(); const n = make(layout, D(), deck.W, deck.H); const txt = old.shapes.filter(s => s.type === 'text' && !empty(s));
            act(() => { const tb = n.shapes.filter(s => s.type === 'text'); txt.forEach((s, k) => { if (tb[k]) tb[k].paras = s.paras; }); const keep = old.shapes.filter(s => s.type === 'image' || (s.type === 'shape' && !s.pic)); n.shapes.push(...keep.filter(s => !(s.type === 'shape' && n.shapes.some(x => x.type === 'shape' && x.geom === s.geom && x.w === s.w)))); n.trans = old.trans; n.bg = old.bg; n.bgImg = old.bgImg; deck.slides[cur] = n; sel = []; }, true); }
        function dupSlide() { endEdit(); act(() => { deck.slides.splice(cur + 1, 0, JSON.parse(JSON.stringify(sl()))); cur++; sel = []; }, true); }
        async function delSlide(i = cur) { endEdit(); if (deck.slides.length === 1) { act(() => { deck.slides[0] = make('blank', D(), deck.W, deck.H); }, true); return; } act(() => { deck.slides.splice(i, 1); cur = Math.min(cur, deck.slides.length - 1); sel = []; }, true); }
        function applyDesign(k) {
            const old = D(), nd = DESIGNS[k]; if (!nd) return; endEdit();
            act(() => { const map = { [old.ti]: nd.ti, [old.tx]: nd.tx, [old.acc]: nd.acc, [old.acc2]: nd.acc2 };
                deck.slides.forEach(s => { s.bg = nd.bg; s.bgImg = ''; s.shapes.forEach(sh => { if (sh.fill && map[sh.fill]) sh.fill = map[sh.fill]; if (sh.line && map[sh.line]) sh.line = map[sh.line]; (sh.paras || []).forEach(p => p.runs.forEach(r => { if (r.color && map[r.color]) r.color = map[r.color]; else if (!r.color && sh.type === 'text') r.color = nd.tx; })); }); });
                deck.design = k; }, true);
        }

        // ---------- Maus auf der Folie ----------
        const pt = ev => { const r = slideEl.getBoundingClientRect(); return { x: (ev.clientX - r.left) / zoom, y: (ev.clientY - r.top) / zoom }; };
        function snapPos(s, nx, ny) {
            const lines = [], T = 6 / zoom; let x = nx, y = ny;
            const xs = [[0, 'l'], [deck.W / 2, 'c'], [deck.W, 'r']], ys = [[0, 't'], [deck.H / 2, 'm'], [deck.H, 'b']];
            sl().shapes.forEach((o, i) => { if (sel.includes(i)) return; xs.push([o.x], [o.x + o.w / 2], [o.x + o.w]); ys.push([o.y], [o.y + o.h / 2], [o.y + o.h]); });
            for (const [gx] of xs) { for (const off of [0, s.w / 2, s.w]) if (Math.abs(nx + off - gx) < T) { x = gx - off; lines.push(['v', gx]); break; } if (lines.some(l => l[0] === 'v')) break; }
            for (const [gy] of ys) { for (const off of [0, s.h / 2, s.h]) if (Math.abs(ny + off - gy) < T) { y = gy - off; lines.push(['h', gy]); break; } if (lines.some(l => l[0] === 'h')) break; }
            guides.innerHTML = lines.map(([t, v]) => `<i class="px-gl ${t}" style="${t === 'v' ? 'left' : 'top'}:${v * zoom}px"></i>`).join('');
            return { x: Math.round(x), y: Math.round(y) };
        }
        stage.addEventListener('pointerdown', ev => {
            if (ev.button !== 0) return; pop.hidden = true;
            const h = ev.target.closest('[data-h]');
            if (h && sel.length === 1) { ev.preventDefault(); endEditKeep(); const s = sl().shapes[sel[0]], o = Object.assign({}, s), p0 = pt(ev), k = h.dataset.h; snap();
                const ratio = o.w / o.h;
                const mv = m => { const p = pt(m);
                    if (k === 'rot') { const cx = o.x + o.w / 2, cy = o.y + o.h / 2; let a = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90; if (!m.shiftKey) { const r15 = Math.round(a / 15) * 15; if (Math.abs(a - r15) < 4) a = r15; } s.rot = Math.round(((a % 360) + 360) % 360); if (s.rot === 0) delete s.rot; }
                    else { let dx = p.x - p0.x, dy = p.y - p0.y; let x = o.x, y = o.y, w = o.w, hh = o.h;
                        if (k.includes('e')) w = o.w + dx; if (k.includes('s')) hh = o.h + dy; if (k.includes('w')) { w = o.w - dx; x = o.x + dx; } if (k.includes('n')) { hh = o.h - dy; y = o.y + dy; }
                        if ((s.type === 'image' || m.shiftKey) && k.length === 2) { if (w / hh > ratio) w = hh * ratio; else hh = w / ratio; if (k.includes('w')) x = o.x + o.w - w; if (k.includes('n')) y = o.y + o.h - hh; }
                        s.x = Math.round(x); s.y = Math.round(y); s.w = Math.max(8, Math.round(w)); s.h = Math.max(4, Math.round(hh)); }
                    const el = slideEl.querySelector(`[data-i="${sel[0]}"]`); el.outerHTML = shapeHtml(s, sel[0], true); placeSel(); };
                const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); snap(); renderSlide(); thumb(cur); changed(); };
                addEventListener('pointermove', mv); addEventListener('pointerup', up); return; }
            const shEl = ev.target.closest('.pxs-sh');
            if (shEl && editing === +shEl.dataset.i) return;            // im Text klicken
            if (!shEl) { endEdit(); sel = []; placeSel(); status(); stage.focus({ preventScroll: true }); return; }
            const i = +shEl.dataset.i; ev.preventDefault(); stage.focus({ preventScroll: true });
            const wasSel = sel.includes(i) && sel.length === 1;
            if (editing >= 0) endEdit();
            if (ev.shiftKey || ev.ctrlKey) { sel = sel.includes(i) ? sel.filter(x => x !== i) : [...sel, i]; placeSel(); status(); reflect(); return; }
            if (!sel.includes(i)) sel = [i]; placeSel(); status(); reflect();
            const p0 = pt(ev), start = sel.map(k => ({ k, x: sl().shapes[k].x, y: sl().shapes[k].y })); let moved = false;
            const mv = m => { const p = pt(m), dx = p.x - p0.x, dy = p.y - p0.y; if (!moved && Math.abs(dx) + Math.abs(dy) < 3 / zoom) return; if (!moved) { moved = true; snap(); }
                let ox = 0, oy = 0; if (start.length === 1 && !m.altKey) { const s = sl().shapes[start[0].k], sp = snapPos(s, start[0].x + dx, start[0].y + dy); ox = sp.x - (start[0].x + dx); oy = sp.y - (start[0].y + dy); }
                start.forEach(st => { const s = sl().shapes[st.k]; s.x = Math.round(st.x + dx + ox); s.y = Math.round(st.y + dy + oy); const el = slideEl.querySelector(`[data-i="${st.k}"]`); el.style.left = s.x + 'px'; el.style.top = s.y + 'px'; }); placeSel(); };
            const up = m => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); guides.innerHTML = '';
                if (moved) { snap(); thumb(cur); changed(); } else if (wasSel && sl().shapes[i].type !== 'image') startEdit(i, { x: m.clientX, y: m.clientY }); };
            addEventListener('pointermove', mv); addEventListener('pointerup', up);
        });
        const endEditKeep = () => { if (editing >= 0) { const i = editing; endEdit(); sel = [i]; } };
        stage.addEventListener('dblclick', ev => { const shEl = ev.target.closest('.pxs-sh'); if (!shEl) return; const i = +shEl.dataset.i, s = sl().shapes[i]; if (s.pic) return pickImage(i); if (s.type === 'image') return; if (editing !== i) startEdit(i, { x: ev.clientX, y: ev.clientY }); });
        stage.addEventListener('contextmenu', ev => {
            const shEl = ev.target.closest('.pxs-sh'); if (shEl && editing === +shEl.dataset.i) return; ev.preventDefault();
            if (shEl) { const i = +shEl.dataset.i; if (!sel.includes(i)) { sel = [i]; placeSel(); } }
            const items = sel.length ? [['fa-scissors', 'Ausschneiden', () => { clip = sel.map(i => JSON.parse(JSON.stringify(sl().shapes[i]))); delSel(); }], ['fa-copy', 'Kopieren', () => { clip = sel.map(i => JSON.parse(JSON.stringify(sl().shapes[i]))); }], clip && ['fa-paste', 'Einfügen', paste], ['fa-clone', 'Duplizieren', dupSel], null,
                sel.length === 1 && sl().shapes[sel[0]].type !== 'image' && ['fa-pen', 'Text bearbeiten', () => startEdit(sel[0])], ['fa-arrow-up', 'In den Vordergrund', () => order(1)], ['fa-arrow-down', 'In den Hintergrund', () => order(-1)], null, ['fa-trash-can', 'Löschen', delSel]]
                : [clip && ['fa-paste', 'Einfügen', paste], ['fa-font', 'Textfeld einfügen', textbox], ['fa-image', 'Bild einfügen', () => $('.px-fimg').click()], null, ['fa-square-plus', 'Neue Folie', () => newSlide()], ['fa-palette', 'Hintergrund ändern', () => DD.bg($('[data-dd="bg"]'))]];
            API.ctx(ev.clientX, ev.clientY, items);
        });
        function paste() { if (!clip) return; act(() => { const n = clip.map(s => Object.assign(JSON.parse(JSON.stringify(s)), { x: s.x + 20, y: s.y + 20 })); clip = n.map(s => JSON.parse(JSON.stringify(s))); sl().shapes.push(...n); sel = n.map((s, k) => sl().shapes.length - n.length + k); }); }
        // Tastatur
        body.addEventListener('keydown', ev => {
            const k = ev.key, c = ev.ctrlKey || ev.metaKey;
            if (c && (k === 's' || k === 'S')) { ev.preventDefault(); ev.stopPropagation(); endEditKeep(); return save(ev.shiftKey); }
            if (k === 'F5') { ev.preventDefault(); endEditKeep(); return show(ev.shiftKey ? cur : 0); }
            if (c && (k === 'p' || k === 'P')) { ev.preventDefault(); return print(); }
            if (!$('.wr-back').hidden) { if (k === 'Escape') { ev.stopPropagation(); back.hidden = true; } return; }
            if (editing >= 0) { if (k === 'Escape') { ev.preventDefault(); ev.stopPropagation(); endEditKeep(); placeSel(); } if (k === 'Tab') { ev.preventDefault(); paraFmt('lvl', ev.shiftKey ? -1 : 1); } return; }
            if (ev.target.closest('input, select, textarea')) return;
            const inSide = ev.target.closest('.px-side');
            if (c && (k === 'z' || k === 'Z') && !ev.shiftKey) { ev.preventDefault(); return undo(); } if (c && (k === 'y' || k === 'Y' || ((k === 'z' || k === 'Z') && ev.shiftKey))) { ev.preventDefault(); return redo(); }
            if (c && (k === 'm' || k === 'M')) { ev.preventDefault(); return newSlide(); }
            if (inSide || !sel.length) {
                if (k === 'ArrowDown' || k === 'PageDown' || (inSide && k === 'ArrowRight')) { ev.preventDefault(); return go(cur + 1); } if (k === 'ArrowUp' || k === 'PageUp' || (inSide && k === 'ArrowLeft')) { ev.preventDefault(); return go(cur - 1); }
                if (inSide && (k === 'Delete' || k === 'Backspace')) { ev.preventDefault(); return delSlide(); } if (inSide && c && (k === 'd' || k === 'D')) { ev.preventDefault(); return dupSlide(); }
                if (c && (k === 'v' || k === 'V') && clip) { ev.preventDefault(); return paste(); }
                if (c && (k === 'a' || k === 'A')) { ev.preventDefault(); sel = sl().shapes.map((s, i) => i); placeSel(); return; }
                return;
            }
            if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); return delSel(); }
            if (k === 'Escape') { sel = []; placeSel(); status(); return; }
            if (k === 'Enter' || k === 'F2') { ev.preventDefault(); return startEdit(sel[0]); }
            const nud = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k]; if (nud) { ev.preventDefault(); const st = ev.shiftKey ? 10 : 1; act(() => sel.forEach(i => { sl().shapes[i].x += nud[0] * st; sl().shapes[i].y += nud[1] * st; })); return; }
            if (c && (k === 'c' || k === 'C')) { ev.preventDefault(); clip = sel.map(i => JSON.parse(JSON.stringify(sl().shapes[i]))); return; }
            if (c && (k === 'x' || k === 'X')) { ev.preventDefault(); clip = sel.map(i => JSON.parse(JSON.stringify(sl().shapes[i]))); return delSel(); }
            if (c && (k === 'v' || k === 'V') && clip) { ev.preventDefault(); return paste(); }
            if (c && (k === 'd' || k === 'D')) { ev.preventDefault(); return dupSel(); }
            if (c && (k === 'a' || k === 'A')) { ev.preventDefault(); sel = sl().shapes.map((s, i) => i); placeSel(); return; }
            if (c && (k === 'b' || k === 'B')) { ev.preventDefault(); return fmt('bold'); } if (c && (k === 'i' || k === 'I')) { ev.preventDefault(); return fmt('italic'); } if (c && (k === 'u' || k === 'U')) { ev.preventDefault(); return fmt('underline'); }
            if (!c && !ev.altKey && k.length === 1 && sel.length === 1 && sl().shapes[sel[0]].type !== 'image' && !sl().shapes[sel[0]].pic) { startEdit(sel[0]); const el = slideEl.querySelector(`[data-i="${sel[0]}"] .pxs-tx`); const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); }
        });
        stage.addEventListener('paste', ev => { if (editing >= 0) { ev.preventDefault(); const t = ev.clipboardData.getData('text/plain'); document.execCommand('insertText', false, t); return; } const f = [...ev.clipboardData.files].find(x => /^image\//.test(x.type)); if (f) { ev.preventDefault(); imageFile(f); } });
        stage.addEventListener('dragover', ev => { if ([...ev.dataTransfer.items || []].some(i => i.kind === 'file')) ev.preventDefault(); });
        stage.addEventListener('drop', ev => { const f = [...ev.dataTransfer.files].find(x => /^image\//.test(x.type)); if (f) { ev.preventDefault(); const sh = ev.target.closest('.pxs-sh'); imageFile(f, sh && sl().shapes[+sh.dataset.i].pic ? +sh.dataset.i : null); } });

        // Folienleiste
        side.addEventListener('click', ev => { const t = ev.target.closest('[data-s]'); if (t) { go(+t.dataset.s); side.focus({ preventScroll: true }); } });
        side.addEventListener('dblclick', ev => { if (!ev.target.closest('[data-s]')) newSlide(); });
        side.addEventListener('contextmenu', ev => { ev.preventDefault(); const t = ev.target.closest('[data-s]'); if (t) go(+t.dataset.s);
            API.ctx(ev.clientX, ev.clientY, [['fa-square-plus', 'Neue Folie', () => newSlide()], t && ['fa-clone', 'Folie duplizieren', dupSlide], t && ['fa-trash-can', 'Folie löschen', () => delSlide()], null, t && ['fa-play', 'Ab dieser Folie präsentieren', () => show(cur)]]); });
        let dragS = -1;
        side.addEventListener('dragstart', ev => { const t = ev.target.closest('[data-s]'); if (!t) return; dragS = +t.dataset.s; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', 'slide'); });
        side.addEventListener('dragover', ev => { if (dragS < 0) return; ev.preventDefault(); const t = ev.target.closest('[data-s]'); side.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); if (t) t.classList.add('drop'); });
        side.addEventListener('drop', ev => { if (dragS < 0) return; ev.preventDefault(); const t = ev.target.closest('[data-s]'); const to = t ? +t.dataset.s : deck.slides.length - 1, from = dragS; dragS = -1; if (to === from) return renderSide(); act(() => { const [s] = deck.slides.splice(from, 1); deck.slides.splice(to, 0, s); cur = to; }, true); });
        side.addEventListener('dragend', () => { dragS = -1; side.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); });

        // ---------- Menüband ----------
        function showPop(btn, html, onClick) { const r = btn.getBoundingClientRect(), br = body.getBoundingClientRect(); pop.innerHTML = html; pop.hidden = false; pop.style.left = Math.max(4, Math.min(r.left - br.left, br.width - pop.offsetWidth - 8)) + 'px'; pop.style.top = (r.bottom - br.top + 4) + 'px'; pop.onclick = ev => { const t = ev.target.closest('[data-v]'); if (!t) return; pop.hidden = true; onClick(t.dataset.v); }; }
        const sw = (list, none) => `<div class="wr-sw">${list.map(c => `<button type="button" data-v="${c}" style="background:#${c}"></button>`).join('')}</div>${none ? `<button type="button" class="wr-pi" data-v="">${none}</button>` : ''}`;
        let lastFore = 'C00000', lastFill = '2563EB', lastLine = '1F2937';
        const themeRow = () => { const d = D(); return [d.bg, d.ti, d.tx, d.acc, d.acc2]; };
        const DD = {
            newslide: b => showPop(b, '<b class="wr-ph">Layout der neuen Folie</b>' + LAYOUTS.map(([k, n, i]) => `<button type="button" class="wr-pi" data-v="${k}"><i class="fa-solid ${i}"></i>${n}</button>`).join(''), v => newSlide(v)),
            layout: b => showPop(b, '<b class="wr-ph">Layout dieser Folie</b>' + LAYOUTS.map(([k, n, i]) => `<button type="button" class="wr-pi" data-v="${k}"><i class="fa-solid ${i}"></i>${n}</button>`).join(''), v => setLayout(v)),
            shapes: b => showPop(b, `<b class="wr-ph">Formen</b><div class="px-geoms">${[...GEOMS, ['line', 'Linie']].map(([g, n]) => `<button type="button" data-v="${g}" title="${n}">${geomSvg(g, 40, g === 'line' ? 8 : 30, g === 'line' ? '' : '8FB8FF', g === 'line' ? '8FB8FF' : '', 2)}</button>`).join('')}</div>`, v => shape(v)),
            fore: b => showPop(b, '<b class="wr-ph">Designfarben</b>' + sw(themeRow()) + '<b class="wr-ph">Farben</b>' + sw(PAL), v => { lastFore = v; $('.px-fb').style.background = '#' + v; fmt('color', v); }),
            fill: b => showPop(b, '<b class="wr-ph">Designfarben</b>' + sw(themeRow()) + '<b class="wr-ph">Füllfarbe</b>' + sw(PAL, '<i class="fa-solid fa-droplet-slash"></i>Keine Füllung'), v => { lastFill = v; $('.px-flb').style.background = v ? '#' + v : 'transparent'; act(() => sel.forEach(i => { const s = sl().shapes[i]; if (s.type !== 'image') s.fill = v; })); }),
            line: b => showPop(b, '<b class="wr-ph">Kontur</b>' + sw(PAL, '<i class="fa-solid fa-droplet-slash"></i>Keine Kontur') + '<b class="wr-ph">Stärke</b><div class="px-lws">' + [1, 2, 3, 5, 8].map(w => `<button type="button" class="wr-pi" data-v="w${w}"><i style="display:inline-block;width:40px;height:${w}px;background:currentColor"></i>${w} px</button>`).join('') + '</div>', v => { if (v[0] === 'w') return act(() => sel.forEach(i => { sl().shapes[i].lw = +v.slice(1); if (!sl().shapes[i].line) sl().shapes[i].line = lastLine; })); lastLine = v; $('.px-lnb').style.background = v ? '#' + v : 'transparent'; act(() => sel.forEach(i => { sl().shapes[i].line = v; })); }),
            anchor: b => showPop(b, [['t', 'Oben', 'fa-arrow-up'], ['ctr', 'Mitte', 'fa-grip-lines'], ['b', 'Unten', 'fa-arrow-down']].map(([k, n, i]) => `<button type="button" class="wr-pi" data-v="${k}"><i class="fa-solid ${i}"></i>${n}</button>`).join(''), v => { endEditKeep(); act(() => sel.forEach(i => { sl().shapes[i].anchor = v; })); }),
            align: b => showPop(b, '<b class="wr-ph">An der Folie ausrichten</b>' + [['l', 'Links', 'fa-align-left'], ['c', 'Zentriert', 'fa-align-center'], ['r', 'Rechts', 'fa-align-right'], ['t', 'Oben', 'fa-arrow-up'], ['m', 'Mittig', 'fa-grip-lines'], ['b', 'Unten', 'fa-arrow-down']].map(([k, n, i]) => `<button type="button" class="wr-pi" data-v="${k}"><i class="fa-solid ${i}"></i>${n}</button>`).join(''), v => alignSel(v)),
            bg: b => showPop(b, '<b class="wr-ph">Designfarben</b>' + sw(themeRow()) + '<b class="wr-ph">Hintergrund</b>' + sw(['FFFFFF', 'F8FAFC', 'F1F5F9', 'FEF3C7', 'DCFCE7', 'DBEAFE', 'FCE7F3', 'EDE9FE', '0F172A', '1E1E2E', '0B1026', '0E4D64', '14532D', '7C2D12', '831843', '000000']), v => act(() => { sl().bg = v; sl().bgImg = ''; })),
        };
        const C = {
            save: () => save(), saveas: () => save(true), dl: download, print, close: () => API.closeWin(win), show0: () => show(0), showCur: () => show(cur),
            dupSlide, delSlide: () => delSlide(), textbox, imgpc: () => { picTarget = null; $('.px-fimg').click(); }, imgdoc: () => { picTarget = null; imageDocs(); },
            bold: () => fmt('bold'), italic: () => fmt('italic'), underline: () => fmt('underline'), fore: () => fmt('color', lastFore),
            grow: () => { const z = curRun().sz || 18; fmt('size', SIZES.find(s => s > z) || z + 4); }, shrinkf: () => { const z = curRun().sz || 18; fmt('size', [...SIZES].reverse().find(s => s < z) || Math.max(6, z - 2)); },
            bullet: () => paraFmt('bu', '•'), number: () => paraFmt('bu', '1.'), indent: () => paraFmt('lvl', 1), outdent: () => paraFmt('lvl', -1),
            'al-l': () => paraFmt('al', 'l'), 'al-ctr': () => paraFmt('al', 'ctr'), 'al-r': () => paraFmt('al', 'r'), 'al-just': () => paraFmt('al', 'just'),
            fill: () => act(() => sel.forEach(i => { if (sl().shapes[i].type !== 'image') sl().shapes[i].fill = lastFill; })), line: () => act(() => sel.forEach(i => { sl().shapes[i].line = lastLine; })),
            front: () => order(1), back: () => order(-1),
            date: () => addShape(Object.assign({ type: 'text', fill: '', line: '', anchor: 'ctr', paras: [para(new Date().toLocaleDateString('de-DE'), { al: 'r' }, { color: D().tx, sz: 14 })] }, { x: deck.W - 260, y: deck.H - 50, w: 220, h: 34 })),
            slidenum: () => act(() => deck.slides.forEach((s, i) => { s.shapes = s.shapes.filter(x => !x.num); s.shapes.push({ type: 'text', num: true, fill: '', line: '', anchor: 'ctr', x: deck.W - 100, y: deck.H - 46, w: 70, h: 30, paras: [para(String(i + 1), { al: 'r' }, { color: D().tx, sz: 12 })] }); }), true),
            bgimg: () => $('.px-fbg').click(), bgall: () => act(() => { const s = sl(); deck.slides.forEach(x => { x.bg = s.bg; x.bgImg = s.bgImg; }); }, true),
            trall: () => act(() => deck.slides.forEach(x => { x.trans = sl().trans; }), true),
            zin: () => setZoom(zoom * 100 + 10), zout: () => setZoom(zoom * 100 - 10), zfit: () => { zoomFit = true; fit(); },
        };
        function setZoom(z) { zoomFit = false; zoom = Math.max(.25, Math.min(2, z / 100)); fit(); }
        body.addEventListener('mousedown', ev => { if (ev.target.closest('.wr-rib button, .wr-pop button')) ev.preventDefault(); });
        body.addEventListener('click', ev => {
            const rt = ev.target.closest('[data-rt]'); if (rt) { if (rt.dataset.rt === 'file') { endEditKeep(); return backstage('home'); } body.querySelectorAll('[data-rt]').forEach(b => b.classList.toggle('on', b === rt)); body.querySelectorAll('[data-band]').forEach(b => { b.hidden = b.dataset.band !== rt.dataset.rt; }); return; }
            const dd = ev.target.closest('[data-dd]'); if (dd && !ev.target.closest('.wr-pop')) { if (!pop.hidden && pop.dataset.for === dd.dataset.dd) { pop.hidden = true; return; } pop.dataset.for = dd.dataset.dd; return DD[dd.dataset.dd](dd); }
            const c = ev.target.closest('[data-c]'); if (c && C[c.dataset.c]) { pop.hidden = true; return C[c.dataset.c](); }
            const de = ev.target.closest('[data-des]'); if (de) return applyDesign(de.dataset.des);
            const tr = ev.target.closest('[data-tr]'); if (tr) { act(() => { sl().trans = tr.dataset.tr; }); reflect(); return; }
            if (!ev.target.closest('.wr-pop')) pop.hidden = true;
        });
        $('.px-font').addEventListener('change', ev => { const sel0 = editing; fmt('font', ev.target.value); if (sel0 < 0) stage.focus(); });
        $('.px-size').addEventListener('change', ev => fmt('size', +ev.target.value));
        $('.wr-zr').addEventListener('input', ev => setZoom(+ev.target.value));
        $('.px-fimg').addEventListener('change', ev => { const f = ev.target.files[0]; ev.target.value = ''; imageFile(f, picTarget); picTarget = null; });
        $('.px-fbg').addEventListener('change', async ev => { const f = ev.target.files[0]; ev.target.value = ''; if (!f) return; try { const im = await shrink(f, 1920); act(() => { sl().bgImg = im.src; }); } catch (x) { uiAlert(x.message); } });
        $('.px-fopen').addEventListener('change', async ev => { const f = ev.target.files[0]; ev.target.value = ''; if (!f) return; try { const d = await JMPPTX.read(await f.arrayBuffer()); if (doc.key || deck.slides.some(s => s.shapes.some(x => !empty(x) || x.type === 'image'))) { if (!(await uiConfirm('Die geöffnete Datei ersetzt den Inhalt dieses Fensters. Weiter?', { ok: 'Öffnen' }))) return; } loadDeck(d); doc.key = null; doc.name = f.name; doc.saved = ''; title(); back.hidden = true; } catch (x) { uiAlert('Datei nicht lesbar: ' + x.message); } });

        // ---------- Bildschirmpräsentation ----------
        function show(from) {
            endEditKeep(); let i = from || 0, done = false;
            const ov = document.createElement('div'); ov.className = 'px-show'; ov.tabIndex = 0;
            ov.innerHTML = `<div class="px-sv"></div><div class="px-sbar"><button type="button" data-k="prev" aria-label="Zurück"><i class="fa-solid fa-chevron-left"></i></button><span class="px-sn"></span><button type="button" data-k="next" aria-label="Weiter"><i class="fa-solid fa-chevron-right"></i></button><button type="button" data-k="end" aria-label="Beenden"><i class="fa-solid fa-xmark"></i></button></div>`;
            document.body.appendChild(ov); const sv = ov.querySelector('.px-sv');
            const scale = () => Math.min(innerWidth / deck.W, innerHeight / deck.H);
            function paint(dir) {
                const k = scale(), old = sv.querySelector('.px-ss:not(.out)');
                if (i >= deck.slides.length) { sv.innerHTML = `<div class="px-end">Ende der Bildschirmpräsentation. Klicken oder Esc zum Beenden.</div>`; ov.querySelector('.px-sn').textContent = ''; return; }
                const s = deck.slides[i], el = document.createElement('div'); el.className = 'px-ss' + (dir > 0 && s.trans ? ' tr-' + s.trans : '');
                el.style.cssText = `width:${deck.W}px;height:${deck.H}px;transform:translate(-50%,-50%) scale(${k});${slideBg(s)}`; el.innerHTML = slideHtml(s, false);
                if (old && dir > 0 && s.trans) { old.classList.add('out'); setTimeout(() => old.remove(), 700); } else sv.innerHTML = '';
                sv.appendChild(el); ov.querySelector('.px-sn').textContent = `${i + 1} / ${deck.slides.length}`;
            }
            const next = () => { if (i >= deck.slides.length) return end(); i++; paint(1); }, prev = () => { if (i > 0) { i = Math.min(i, deck.slides.length) - 1; paint(-1); } };
            function end() { if (done) return; done = true; removeEventListener('keydown', key, true); removeEventListener('resize', onR); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); ov.remove(); go(Math.min(i, deck.slides.length - 1)); stage.focus(); }
            const key = ev => { const k = ev.key; ev.stopPropagation(); if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n'].includes(k)) { ev.preventDefault(); next(); } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p'].includes(k)) { ev.preventDefault(); prev(); } else if (k === 'Escape') { ev.preventDefault(); end(); } else if (k === 'Home') { i = 0; paint(0); } else if (k === 'End') { i = deck.slides.length - 1; paint(0); } };
            const onR = () => { sv.querySelectorAll('.px-ss').forEach(el => { el.style.transform = `translate(-50%,-50%) scale(${scale()})`; }); };
            addEventListener('keydown', key, true); addEventListener('resize', onR);
            ov.addEventListener('click', ev => { const b = ev.target.closest('[data-k]'); if (b) { ev.stopPropagation(); ({ prev, next, end })[b.dataset.k](); return; } next(); });
            ov.addEventListener('contextmenu', ev => { ev.preventDefault(); prev(); });
            document.addEventListener('fullscreenchange', function fc() { if (!document.fullscreenElement) { document.removeEventListener('fullscreenchange', fc); end(); } });
            try { ov.requestFullscreen && ov.requestFullscreen().catch(() => {}); } catch (x) {}
            paint(0); ov.focus();
        }

        // ---------- Speichern, Laden, Drucken ----------
        const bytes = async () => new Uint8Array(await (await JMPPTX.write(Object.assign({}, deck, { author: U.name || '', title: doc.name.replace(/\.pptx$/i, '') }))).arrayBuffer());
        async function save(as) {
            endEditKeep(); if (doc.saving) return;
            if (!window.JMOS_FILES || !can(U, 'dokumente')) return uiAlert('Zum Speichern brauchst du die Berechtigung „Dokumente“. Du kannst die Präsentation aber herunterladen (Datei → Herunterladen).');
            if (!doc.key || as) {
                const first = (() => { for (const s of deck.slides) for (const x of s.shapes) if (x.type === 'text' && !empty(x)) return x.paras.map(p => p.runs.map(r => r.t).join('')).join(' ').trim(); return ''; })();
                const r = await askSave(doc.key ? doc.name : (first ? first.slice(0, 50).replace(/[\\/:*?"<>|]+/g, '') + '.pptx' : doc.name), doc.folder); if (!r) return;
                doc.saving = true; title();
                try { const key = await JMOS_FILES.createText(r.name, await bytes(), r.folder); try { localStorage.removeItem(DKEY()); } catch (x) {} doc.key = key; doc.name = r.name; doc.folder = r.folder; doc.saved = sig(); } catch (x) { uiAlert('Speichern fehlgeschlagen: ' + x.message); }
                doc.saving = false; title(); stage.focus(); return;
            }
            doc.saving = true; title();
            try { await JMOS_FILES.saveText(doc.key, await bytes()); doc.saved = sig(); try { localStorage.removeItem(DKEY()); } catch (x) {} } catch (x) { uiAlert('Speichern fehlgeschlagen: ' + x.message); }
            doc.saving = false; title();
        }
        function askSave(name, folder) {
            return new Promise(res => {
                const fs = window.JMOS_FILES ? JMOS_FILES.folders() : [], bg = document.createElement('div'); bg.className = 'uidlg-bg';
                bg.innerHTML = `<form class="uidlg" style="max-width:420px"><div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-floppy-disk"></i></span><span>Speichern unter</span></div><label class="ed-dl">Dateiname<input class="xp-ask" maxlength="120" value="${e(name)}"></label><label class="ed-dl">Ordner<select class="sh-sel">${[['', 'Eigene Dateien'], ...fs.map(f => [f.id, f.name])].map(([id, n]) => `<option value="${e(id)}" ${id === (folder || '') ? 'selected' : ''}>${e(n)}</option>`).join('')}</select></label><div class="uidlg-a"><button type="button" data-r="0">Abbrechen</button><button type="submit" class="ok">Speichern</button></div></form>`;
                const done = v => { bg.remove(); res(v); };
                bg.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); let n = bg.querySelector('input').value.trim().replace(/[\\/:*?"<>|]+/g, '_'); if (!n) return; if (!/\.pptx$/i.test(n)) n = n.replace(/\.ppt$/i, '') + '.pptx'; done({ name: n, folder: bg.querySelector('select').value }); });
                bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-r="0"]')) done(null); }); bg.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); done(null); } });
                document.body.appendChild(bg); const i = bg.querySelector('input'); i.focus(); i.setSelectionRange(0, Math.max(0, i.value.length - 5));
            });
        }
        async function download() { endEditKeep(); try { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([await bytes()], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })), download: doc.name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } catch (x) { uiAlert(x.message); } }
        function print() {
            endEditKeep(); const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px'; document.body.appendChild(f);
            const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].filter(r => r.selectorText && /\.pxs-/.test(r.selectorText)).map(r => r.cssText).join('\n'); } catch (x) { return ''; } }).join('\n');
            f.contentDocument.open(); f.contentDocument.write(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${e(doc.name.replace(/\.pptx$/i, ''))}</title><style>@page{size:${deck.W}px ${deck.H}px;margin:0} html,body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact} .pg{position:relative;width:${deck.W}px;height:${deck.H}px;overflow:hidden;break-after:page;font-family:Calibri,Carlito,sans-serif} ${css}</style></head><body>${deck.slides.map(s => `<div class="pg" style="${slideBg(s)}">${slideHtml(s, false)}</div>`).join('')}</body></html>`); f.contentDocument.close();
            setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (x) { uiAlert(x.message); } setTimeout(() => f.remove(), 60000); }, 400);
        }
        const back = $('.wr-back');
        function backstage(tab) {
            const files = window.JMOS_FILES ? JMOS_FILES.slideFiles().sort((a, b) => (b.date || 0) - (a.date || 0)) : [], fold = Object.fromEntries((window.JMOS_FILES ? JMOS_FILES.folders() : []).map(f => [f.id, f.name]));
            const NAV = [['home', 'fa-house', 'Start'], ['new', 'fa-file-circle-plus', 'Neu'], ['open', 'fa-folder-open', 'Öffnen'], null, ['save', 'fa-floppy-disk', 'Speichern'], ['saveas', 'fa-file-export', 'Speichern unter'], ['dl', 'fa-download', 'Herunterladen (.pptx)'], ['print', 'fa-file-pdf', 'Als PDF / Drucken'], null, ['close', 'fa-xmark', 'Schließen']];
            const tpl = Object.entries(TPL).map(([k, t]) => { const d = DESIGNS[t.d]; return `<button type="button" class="wr-tpl px-tpl" data-tpl="${k}"><span class="px-tpi" style="background:#${d.bg}"><i class="fa-solid ${t.i}" style="color:#${d.acc}"></i><b style="color:#${d.ti}">${e(t.n)}</b></span><b>${e(t.n)}</b></button>`; }).join('');
            const rows = l => l.map(it => `<button type="button" class="wr-fr" data-open="${e(it.key)}"><i class="fa-solid fa-file-powerpoint px-fi"></i><span><b>${e(it.name)}</b><small>${e(it.folder ? fold[it.folder] || 'Ordner' : 'Eigene Dateien')}</small></span><small>${it.date ? new Date(it.date).toLocaleDateString('de-DE') : ''}</small></button>`).join('') || '<p class="wr-none">Noch keine Präsentationen in deinen Dokumenten.</p>';
            const main = tab === 'new' ? `<h2>Neu</h2><div class="wr-tpls">${tpl}</div>` : tab === 'open' ? `<h2>Öffnen</h2><button type="button" class="btn" data-bs="pc"><i class="fa-solid fa-laptop"></i>Vom Computer öffnen (.pptx)</button><div class="wr-frs">${rows(files)}</div>`
                : `<h2>${new Date().getHours() < 11 ? 'Guten Morgen' : new Date().getHours() < 18 ? 'Hallo' : 'Guten Abend'}${U.firstName ? ', ' + e(U.firstName) : ''}</h2><div class="wr-tpls">${tpl}</div><h3>Zuletzt bearbeitet</h3><div class="wr-frs">${rows(files.slice(0, 8))}</div>`;
            back.innerHTML = `<nav class="px-nav"><button type="button" class="wr-bk" data-bs="back" aria-label="Zurück"><i class="fa-solid fa-arrow-left"></i></button>${NAV.map(n => n ? `<button type="button" data-bs="${n[0]}" class="${n[0] === tab ? 'on' : ''}"><i class="fa-solid ${n[1]}"></i>${n[2]}</button>` : '<hr>').join('')}</nav><section>${main}</section>`; back.hidden = false;
        }
        const isEmpty = () => !deck.slides.some(s => s.shapes.some(x => x.type === 'image' || (x.type !== 'shape' && !empty(x)))) && deck.slides.length === 1;
        back.addEventListener('click', ev => {
            const b = ev.target.closest('[data-bs]'), t = ev.target.closest('[data-tpl]'), o = ev.target.closest('[data-open]');
            if (t) { if (doc.key || !isEmpty()) { back.hidden = true; return create(doc.folder, t.dataset.tpl); } loadDeck(newDeck(t.dataset.tpl)); doc.name = t.dataset.tpl === 'leer' ? 'Präsentation1.pptx' : TPL[t.dataset.tpl].n + '.pptx'; doc.saved = sig(); title(); back.hidden = true; return; }
            if (o) { back.hidden = true; if (o.dataset.open === doc.key) return; if (!doc.key && isEmpty()) { doc.key = o.dataset.open; return loadFile(); } return open(o.dataset.open); }
            if (!b) return; const k = b.dataset.bs; if (k === 'back') { back.hidden = true; return; } if (k === 'home' || k === 'new' || k === 'open') return backstage(k); if (k === 'pc') return $('.px-fopen').click();
            back.hidden = true; if (C[k]) C[k]();
        });
        function loadDeck(d) { deck = d; deck.design = deck.design || ''; cur = 0; sel = []; editing = -1; H.st = []; H.i = -1; snap(); renderAll(); }
        async function loadFile() {
            slideEl.innerHTML = '<div class="px-load"><i class="fa-solid fa-spinner fa-spin"></i> Präsentation wird geladen …</div>';
            try { const { blob, name } = await JMOS_FILES.blobOf(doc.key); const it = JMOS_FILES.item(doc.key); doc.name = name; doc.folder = it ? it.folder || '' : '';
                loadDeck(await JMPPTX.read(await blob.arrayBuffer())); doc.saved = sig();
                let d = null; try { d = JSON.parse(localStorage.getItem(DKEY()) || 'null'); } catch (x) {}
                if (d && d.deck && await uiConfirm(`Für „${name}“ gibt es ungespeicherte Änderungen vom ${new Date(d.t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}. Wiederherstellen?`, { ok: 'Wiederherstellen', title: 'Präsentation' })) loadDeck(d.deck); else if (d) { try { localStorage.removeItem(DKEY()); } catch (x) {} }
            } catch (x) { uiAlert('Die Präsentation lässt sich nicht öffnen: ' + x.message); doc.key = null; loadDeck(newDeck('leer')); }
            title();
        }
        win.beforeClose = () => { endEditKeep(); return dirty() && (doc.key || !isEmpty()) ? `„${doc.name}“ hat ungespeicherte Änderungen. Trotzdem schließen?` : ''; };
        win.onClose = () => { clearTimeout(tD); try { localStorage.removeItem(DKEY()); } catch (x) {} };
        win.onParams = p => { if (p && p.open && p.open !== doc.key) open(p.open); };
        new ResizeObserver(() => fit()).observe(stage);

        if (doc.key) { renderAll(); loadFile(); }
        else { loadDeck(deck); doc.name = P.tpl && P.tpl !== 'leer' ? TPL[P.tpl].n + '.pptx' : 'Präsentation1.pptx'; doc.saved = sig(); if (!P.tpl) backstage('home'); title(); }
        setTimeout(() => stage.focus({ preventScroll: true }), 80);
    }

    window.JMOS_SLIDES = { open, create };
    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        apps: [{ id: 'praesentation', name: 'Präsentation', icon: 'fa-person-chalkboard', c: '#d24726', native: 'praesentation', w: 1180, h: 780 }],
        ui: { praesentation: ui },
        init(api, user) { API = api; U = user; e = api.esc; },
    });
})();
