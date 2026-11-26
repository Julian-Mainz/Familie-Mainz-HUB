// OS/writer.js – Textverarbeitung „Writer“ für J.Mainz OS (wie Word, aber nur im System).
// Speichert echte .docx-Dateien in den Dokumenten (mit OS/docx.js) – die lassen sich auch mit Microsoft Word öffnen,
// und vorhandene .docx-Dateien lassen sich hier bearbeiten. Menüband mit Start, Einfügen, Layout und Ansicht,
// A4-Blatt mit Seitenrändern, Kopf- und Fußzeile, Seitenzahlen, Tabellen, Bilder, Suchen & Ersetzen, Drucken/PDF, Vorlagen.
(function () {
    'use strict';
    let API, U, e;
    const FONTS = ['Calibri', 'Arial', 'Cambria', 'Georgia', 'Times New Roman', 'Verdana', 'Segoe UI', 'Courier New', 'Comic Sans MS'];
    const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
    const STYLES = [['p', 'Standard'], ['title', 'Titel'], ['sub', 'Untertitel'], ['h1', 'Überschrift 1'], ['h2', 'Überschrift 2'], ['h3', 'Überschrift 3'], ['quote', 'Zitat']];
    const PAL = ['000000', '404040', '7F7F7F', 'BFBFBF', 'FFFFFF', 'C00000', 'FF0000', 'FFC000', 'FFFF00', '92D050', '00B050', '00B0F0', '0070C0', '002060', '7030A0', '2F5496', 'C55A11', '548235', 'BF8F00', '1F3864'];
    const HIL = ['FFFF00', '00FF00', '00FFFF', 'FF00FF', 'FFC000', 'FF7C80', 'D9D9D9', ''];
    const SPECIAL = '€ § © ® ™ ° ± × ÷ – — „ “ ‚ ‘ » « … • · → ← ↑ ↓ ✓ ✗ ½ ¼ ¾ ² ³ µ ∞ ≈ ≠ ≤ ≥ Ø ♥ ☺'.split(' ');
    const MARGINS = [['Normal', { t: 25, r: 25, b: 20, l: 25 }], ['Schmal', { t: 12.7, r: 12.7, b: 12.7, l: 12.7 }], ['Mittel', { t: 25.4, r: 19.1, b: 25.4, l: 19.1 }], ['Breit', { t: 25.4, r: 50.8, b: 25.4, l: 50.8 }], ['DIN 5008 (Brief)', { t: 27, r: 20, b: 20, l: 25 }]];
    const MM = 3.7795;
    let seq = 0; const HAND = {};          // Übergabe an ein neues Fenster (Serienbrief-Ergebnis)

    const today = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
    const TPL = {
        leer: { n: 'Leeres Dokument', i: 'fa-file', html: () => '<p><br></p>' },
        brief: { n: 'Brief', i: 'fa-envelope-open-text', st: { margins: { t: 27, r: 20, b: 20, l: 25 } }, html: () => `<p style="font-size:8pt;color:#7F7F7F"><u>${e(U.name || '')} · Straße Hausnummer · PLZ Ort</u></p><p>Frau / Herrn<br>Vorname Nachname<br>Straße Hausnummer<br>PLZ Ort</p><p><br></p><p style="text-align:right">Ort, ${today()}</p><p><b>Betreff</b></p><p>Sehr geehrte Damen und Herren,</p><p>hier steht der Text Ihres Briefes.</p><p>Mit freundlichen Grüßen</p><p><br></p><p>${e(U.name || '')}</p>` },
        protokoll: { n: 'Protokoll', i: 'fa-clipboard-list', html: () => `<h1 class="wr-title">Protokoll</h1><p class="wr-sub">Titel der Besprechung</p><table><tr><th>Datum</th><td>${new Date().toLocaleDateString('de-DE')}</td></tr><tr><th>Ort</th><td><br></td></tr><tr><th>Teilnehmer</th><td><br></td></tr><tr><th>Protokoll</th><td>${e(U.name || '')}</td></tr></table><h1>Tagesordnung</h1><ol><li>Begrüßung</li><li>Thema</li><li>Sonstiges</li></ol><h1>Ergebnisse</h1><p><br></p><h1>Aufgaben</h1><table><tr><th>Was</th><th>Wer</th><th>Bis wann</th></tr><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></table>` },
        einladung: { n: 'Einladung', i: 'fa-champagne-glasses', html: () => `<h1 class="wr-title" style="text-align:center">Einladung</h1><p class="wr-sub" style="text-align:center">zu unserem Fest</p><p style="text-align:center"><br></p><p style="text-align:center;font-size:14pt">Wir freuen uns, dich einzuladen!</p><table><tr><th>Wann</th><td>Samstag, … um … Uhr</td></tr><tr><th>Wo</th><td>…</td></tr><tr><th>Mitbringen</th><td>gute Laune</td></tr></table><p><br></p><p style="text-align:center">Bitte gib bis zum … Bescheid, ob du kommst.</p><p style="text-align:center">${e(U.name || '')}</p>` },
        lebenslauf: { n: 'Lebenslauf', i: 'fa-id-card', st: { margins: { t: 20, r: 20, b: 20, l: 20 } }, html: () => `<h1 class="wr-title">${e(U.name || 'Vorname Nachname')}</h1><p class="wr-sub">Straße · PLZ Ort · Telefon · E-Mail</p><h1>Berufserfahrung</h1><table><tr><td style="width:140px">seit 2020</td><td><b>Position</b><br>Firma, Ort<br>Aufgaben …</td></tr><tr><td>2015 – 2020</td><td><b>Position</b><br>Firma, Ort</td></tr></table><h1>Ausbildung</h1><table><tr><td style="width:140px">2012 – 2015</td><td><b>Abschluss</b><br>Schule / Hochschule</td></tr></table><h1>Kenntnisse</h1><ul><li>Sprachen: Deutsch (Muttersprache), Englisch (gut)</li><li>EDV: …</li></ul><p><br></p><p>Ort, ${today()}</p>` },
    };

    // ---------- Einfügen von außen: nur saubere Formate übernehmen ----------
    const OKTAG = /^(P|H1|H2|H3|H4|BLOCKQUOTE|UL|OL|LI|TABLE|TBODY|THEAD|TR|TD|TH|BR|HR|B|STRONG|I|EM|U|S|STRIKE|SUB|SUP|A|SPAN|IMG|PRE)$/;
    const OKCSS = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'font-family', 'font-size', 'text-align', 'margin-left', 'line-height', 'vertical-align', 'width'];
    function clean(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html'), out = document.createElement('div');
        const walk = (src, dst) => {
            for (const n of src.childNodes) {
                if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); continue; }
                if (n.nodeType !== 1) continue;
                let t = n.tagName; if (/^(SCRIPT|STYLE|META|LINK|TITLE|HEAD|OBJECT|IFRAME|SVG|CANVAS|BUTTON|INPUT|SELECT|TEXTAREA|NOSCRIPT|TEMPLATE)$/.test(t)) continue;
                if (t === 'H5' || t === 'H6') t = 'H4'; if (t === 'DIV' || t === 'SECTION' || t === 'ARTICLE') t = [...n.children].some(c => /^(P|DIV|H\d|UL|OL|TABLE|BLOCKQUOTE)$/.test(c.tagName)) ? '' : 'P';
                if (t === 'FONT') t = 'SPAN';
                if (!t || !OKTAG.test(t)) { walk(n, dst); continue; }
                if (t === 'IMG' && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(n.getAttribute('src') || '')) continue;
                const el = document.createElement(t);
                const css = []; (n.getAttribute('style') || '').split(';').forEach(d => { const i = d.indexOf(':'); if (i < 0) return; const k = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).trim(); if (OKCSS.includes(k) && !/url\(|expression|javascript/i.test(v) && v.length < 80) css.push(k + ':' + v); });
                if (n.tagName === 'FONT') { if (n.getAttribute('color')) css.push('color:' + n.getAttribute('color').replace(/[^#\w]/g, '')); if (n.getAttribute('face')) css.push('font-family:' + n.getAttribute('face').replace(/[^\w ,-]/g, '')); }
                if (css.length && t !== 'TABLE' && t !== 'TR') el.setAttribute('style', css.join(';'));
                if (t === 'A') { const h = n.getAttribute('href') || ''; if (/^(https?:|mailto:)/i.test(h)) { el.setAttribute('href', h); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); } }
                if (t === 'IMG') el.setAttribute('src', n.getAttribute('src'));
                if ((t === 'TD' || t === 'TH') && +n.getAttribute('colspan') > 1) el.setAttribute('colspan', Math.min(20, +n.getAttribute('colspan')));
                if ((t === 'TD' || t === 'TH') && +n.getAttribute('rowspan') > 1) el.setAttribute('rowspan', Math.min(50, +n.getAttribute('rowspan')));
                const cl = (n.getAttribute('class') || '').split(/\s+/).filter(c => /^wr-(title|sub|pb)$/.test(c)); if (cl.length) el.className = cl.join(' ');
                if (cl.includes('wr-pb')) el.setAttribute('contenteditable', 'false');
                walk(n, el); dst.appendChild(el);
            }
        };
        walk(doc.body, out);
        return out.innerHTML.replace(/<span>([^<]*)<\/span>/g, '$1');
    }
    // Bild verkleinern (max. 1600 px), damit die Datei unter 3 MB bleibt
    function shrink(file) {
        return new Promise((res, rej) => {
            const r = new FileReader(); r.onerror = () => rej(new Error('Bild nicht lesbar'));
            r.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('Bild nicht lesbar'));
                im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
                    const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
                    const png = /png|gif/.test(file.type) && file.size < 400000; if (!png) { const d = x.getImageData(0, 0, Math.min(w, 40), Math.min(h, 40)).data; }
                    res({ src: c.toDataURL(png ? 'image/png' : 'image/jpeg', .86), w, h }); };
                im.src = r.result; };
            r.readAsDataURL(file);
        });
    }

    function open(key) { API.openApp('writer', { key: 'wr:' + key, params: { open: key } }); }
    function create(folder, tpl) { API.openApp('writer', { key: 'wr:neu' + (++seq), params: { folder: folder || '', tpl: tpl || 'leer' } }); }

    // ======================================================================
    function ui(body, win) {
        const P = win.params || {};
        const doc = { key: P.open || null, name: 'Dokument1.docx', folder: P.folder || '', st: JMDOCX.DEF(), saved: '', saving: false };
        const DKEY = () => 'jmos-wr-' + U.uid + '-' + (doc.key || win.key);
        body.innerHTML = `<div class="wr">
            <div class="wr-rib">
                <div class="wr-tabs" role="tablist">
                    <button type="button" class="wr-file" data-rt="file">Datei</button>
                    ${[['home', 'Start'], ['ins', 'Einfügen'], ['lay', 'Layout'], ['mail', 'Sendungen'], ['view', 'Ansicht']].map(([k, n], i) => `<button type="button" role="tab" data-rt="${k}"${i ? '' : ' class="on"'}>${n}</button>`).join('')}
                    <span class="wr-fill"></span><span class="wr-sv"></span>
                    <button type="button" class="wr-qs" data-c="save" title="Speichern (Strg+S)"><i class="fa-solid fa-floppy-disk"></i></button>
                </div>
                <div class="wr-band" data-band="home">
                    <div class="wr-g"><div class="wr-gb">
                        <button type="button" class="wr-big" data-c="paste" title="Einfügen (Strg+V)"><i class="fa-solid fa-paste"></i><span>Einfügen</span></button>
                        <div class="wr-col"><button type="button" data-c="cut" title="Ausschneiden (Strg+X)"><i class="fa-solid fa-scissors"></i></button><button type="button" data-c="copy" title="Kopieren (Strg+C)"><i class="fa-solid fa-copy"></i></button><button type="button" data-c="undo" title="Rückgängig (Strg+Z)"><i class="fa-solid fa-rotate-left"></i></button><button type="button" data-c="redo" title="Wiederholen (Strg+Y)"><i class="fa-solid fa-rotate-right"></i></button></div>
                    </div><small>Zwischenablage</small></div>
                    <div class="wr-g"><div class="wr-gb wr-rows">
                        <div class="wr-row"><select class="wr-font" title="Schriftart">${FONTS.map(f => `<option style="font-family:'${f}'">${f}</option>`).join('')}</select><select class="wr-size" title="Schriftgröße">${SIZES.map(s => `<option>${String(s).replace('.', ',')}</option>`).join('')}</select>
                            <button type="button" data-c="grow" title="Schrift größer"><i class="fa-solid fa-font"></i><sup>+</sup></button><button type="button" data-c="shrinkf" title="Schrift kleiner"><i class="fa-solid fa-font" style="font-size:.8em"></i><sup>−</sup></button><button type="button" data-c="removeFormat" title="Formatierung löschen"><i class="fa-solid fa-eraser"></i></button></div>
                        <div class="wr-row"><button type="button" data-c="bold" title="Fett (Strg+B)"><i class="fa-solid fa-bold"></i></button><button type="button" data-c="italic" title="Kursiv (Strg+I)"><i class="fa-solid fa-italic"></i></button><button type="button" data-c="underline" title="Unterstrichen (Strg+U)"><i class="fa-solid fa-underline"></i></button><button type="button" data-c="strikeThrough" title="Durchgestrichen"><i class="fa-solid fa-strikethrough"></i></button><button type="button" data-c="subscript" title="Tiefgestellt"><i class="fa-solid fa-subscript"></i></button><button type="button" data-c="superscript" title="Hochgestellt"><i class="fa-solid fa-superscript"></i></button>
                            <span class="wr-split"><button type="button" data-c="hilite" title="Texthervorhebungsfarbe"><i class="fa-solid fa-highlighter"></i><b class="wr-bar wr-hbar" style="background:#FFFF00"></b></button><button type="button" class="wr-dd" data-dd="hil" aria-label="Farbe wählen"><i class="fa-solid fa-chevron-down"></i></button></span>
                            <span class="wr-split"><button type="button" data-c="fore" title="Schriftfarbe"><i class="fa-solid fa-a"></i><b class="wr-bar wr-fbar" style="background:#C00000"></b></button><button type="button" class="wr-dd" data-dd="col" aria-label="Farbe wählen"><i class="fa-solid fa-chevron-down"></i></button></span></div>
                    </div><small>Schriftart</small></div>
                    <div class="wr-g"><div class="wr-gb wr-rows">
                        <div class="wr-row"><button type="button" data-c="insertUnorderedList" title="Aufzählung"><i class="fa-solid fa-list-ul"></i></button><button type="button" data-c="insertOrderedList" title="Nummerierung"><i class="fa-solid fa-list-ol"></i></button><button type="button" data-c="outdent" title="Einzug verkleinern"><i class="fa-solid fa-outdent"></i></button><button type="button" data-c="indent" title="Einzug vergrößern"><i class="fa-solid fa-indent"></i></button><button type="button" class="wr-dd2" data-dd="lh" title="Zeilenabstand"><i class="fa-solid fa-arrows-up-down"></i><i class="fa-solid fa-chevron-down wr-chev"></i></button></div>
                        <div class="wr-row"><button type="button" data-c="justifyLeft" title="Linksbündig (Strg+L)"><i class="fa-solid fa-align-left"></i></button><button type="button" data-c="justifyCenter" title="Zentriert (Strg+E)"><i class="fa-solid fa-align-center"></i></button><button type="button" data-c="justifyRight" title="Rechtsbündig (Strg+R)"><i class="fa-solid fa-align-right"></i></button><button type="button" data-c="justifyFull" title="Blocksatz (Strg+J)"><i class="fa-solid fa-align-justify"></i></button></div>
                    </div><small>Absatz</small></div>
                    <div class="wr-g wr-gst"><div class="wr-gb"><div class="wr-styles">${STYLES.map(([k, n]) => `<button type="button" data-st="${k}" class="wr-sty s-${k}"><span>AaBbCc</span><small>${n}</small></button>`).join('')}</div></div><small>Formatvorlagen</small></div>
                    <div class="wr-g"><div class="wr-gb wr-col2"><button type="button" data-c="find" title="Suchen (Strg+F)"><i class="fa-solid fa-magnifying-glass"></i><span>Suchen</span></button><button type="button" data-c="replace" title="Ersetzen (Strg+H)"><i class="fa-solid fa-right-left"></i><span>Ersetzen</span></button></div><small>Bearbeiten</small></div>
                </div>
                <div class="wr-band" data-band="ins" hidden>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="pb" title="Seitenumbruch (Strg+Enter)"><i class="fa-solid fa-file-circle-plus"></i><span>Seiten&shy;umbruch</span></button></div><small>Seiten</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-dd="tbl"><i class="fa-solid fa-table"></i><span>Tabelle <i class="fa-solid fa-chevron-down wr-chev"></i></span></button></div><small>Tabellen</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="imgpc"><i class="fa-solid fa-image"></i><span>Bild vom Computer</span></button><button type="button" class="wr-big" data-c="imgdoc"><i class="fa-solid fa-folder-open"></i><span>Bild aus Dokumenten</span></button><button type="button" class="wr-big" data-c="chart"><i class="fa-solid fa-chart-column"></i><span>Diagramm aus Tabelle</span></button></div><small>Illustrationen</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-dd="addr"><i class="fa-solid fa-address-book"></i><span>Adresse aus Kontakten <i class="fa-solid fa-chevron-down wr-chev"></i></span></button></div><small>Kontakte</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="link" title="Link (Strg+K)"><i class="fa-solid fa-link"></i><span>Link</span></button></div><small>Links</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="hr"><i class="fa-solid fa-grip-lines"></i><span>Linie</span></button><button type="button" class="wr-big" data-c="date"><i class="fa-solid fa-calendar-day"></i><span>Datum</span></button><button type="button" class="wr-big" data-dd="sym"><i class="fa-solid fa-paragraph"></i><span>Symbol <i class="fa-solid fa-chevron-down wr-chev"></i></span></button></div><small>Text &amp; Symbole</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="hdr"><i class="fa-solid fa-heading"></i><span>Kopf&shy;zeile</span></button><button type="button" class="wr-big" data-c="ftr"><i class="fa-solid fa-shoe-prints"></i><span>Fuß&shy;zeile</span></button><button type="button" class="wr-big wr-tg" data-c="pnum"><i class="fa-solid fa-hashtag"></i><span>Seiten&shy;zahlen</span></button></div><small>Kopf- und Fußzeile</small></div>
                </div>
                <div class="wr-band" data-band="lay" hidden>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-dd="mar"><i class="fa-solid fa-ruler-combined"></i><span>Seiten&shy;ränder <i class="fa-solid fa-chevron-down wr-chev"></i></span></button><button type="button" class="wr-big wr-tg" data-c="portrait"><i class="fa-solid fa-file"></i><span>Hochformat</span></button><button type="button" class="wr-big wr-tg" data-c="landscape"><i class="fa-solid fa-file fa-rotate-90"></i><span>Querformat</span></button></div><small>Seite einrichten</small></div>
                    <div class="wr-g wr-gform"><div class="wr-gb wr-rows"><label>Kopfzeile<input class="wr-in-h" maxlength="200" placeholder="z. B. Julian Mainz"></label><label>Fußzeile<input class="wr-in-f" maxlength="200" placeholder="z. B. Vertraulich"></label></div><small>Kopf- und Fußzeile</small></div>
                    <div class="wr-g"><div class="wr-gb wr-rows"><div class="wr-row"><span class="wr-lab">Zeilenabstand</span>${['1', '1.15', '1.5', '2'].map(v => `<button type="button" data-lh="${v}">${v.replace('.', ',')}</button>`).join('')}</div><div class="wr-row"><span class="wr-lab">Einzug</span><button type="button" data-c="outdent"><i class="fa-solid fa-outdent"></i></button><button type="button" data-c="indent"><i class="fa-solid fa-indent"></i></button></div></div><small>Absatz</small></div>
                </div>
                <div class="wr-band" data-band="mail" hidden>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-dd="mmsrc"><i class="fa-solid fa-users"></i><span>Empfänger wählen <i class="fa-solid fa-chevron-down wr-chev"></i></span></button><div class="wr-mminfo">Noch keine Empfänger.<br><small>Eine Tabelle mit Überschriften in der ersten Zeile${window.JMOS_CONTACTS ? ' oder die Kontakte' : ''}.</small></div></div><small>Serienbrief starten</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-dd="mmfield"><i class="fa-solid fa-code"></i><span>Feld einfügen <i class="fa-solid fa-chevron-down wr-chev"></i></span></button></div><small>Felder</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big wr-tg" data-c="mmprev"><i class="fa-solid fa-eye"></i><span>Vorschau</span></button><div class="wr-mmnav"><button type="button" data-c="mmback" aria-label="Vorheriger Empfänger"><i class="fa-solid fa-chevron-left"></i></button><span class="wr-mmpos">–</span><button type="button" data-c="mmfwd" aria-label="Nächster Empfänger"><i class="fa-solid fa-chevron-right"></i></button></div></div><small>Vorschau</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="mmdoc"><i class="fa-solid fa-file-circle-plus"></i><span>Alle Briefe als Dokument</span></button><button type="button" class="wr-big" data-c="mmprint"><i class="fa-solid fa-print"></i><span>Alle drucken</span></button></div><small>Fertigstellen</small></div>
                </div>
                <div class="wr-band" data-band="view" hidden>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="zout"><i class="fa-solid fa-magnifying-glass-minus"></i><span>Verkleinern</span></button><button type="button" class="wr-big" data-c="z100"><i class="fa-solid fa-magnifying-glass"></i><span>100 %</span></button><button type="button" class="wr-big" data-c="zin"><i class="fa-solid fa-magnifying-glass-plus"></i><span>Vergrößern</span></button><button type="button" class="wr-big" data-c="zfit"><i class="fa-solid fa-arrows-left-right"></i><span>Seiten&shy;breite</span></button></div><small>Zoom</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big wr-tg" data-c="focus"><i class="fa-solid fa-expand"></i><span>Fokus&shy;modus</span></button><button type="button" class="wr-big wr-tg" data-c="marks"><i class="fa-solid fa-paragraph"></i><span>Formatierungs&shy;zeichen</span></button><button type="button" class="wr-big" data-c="count"><i class="fa-solid fa-calculator"></i><span>Wörter zählen</span></button></div><small>Ansicht</small></div>
                </div>
            </div>
            <form class="wr-find" hidden><input class="wr-q" placeholder="Im Dokument suchen" aria-label="Suchen"><input class="wr-r" placeholder="Ersetzen durch" aria-label="Ersetzen durch">
                <button type="button" data-f="prev" title="Vorheriger"><i class="fa-solid fa-arrow-up"></i></button><button type="submit" title="Nächster"><i class="fa-solid fa-arrow-down"></i></button>
                <label><input type="checkbox" class="wr-cs">Aa</label><button type="button" data-f="one">Ersetzen</button><button type="button" data-f="all">Alle ersetzen</button><span class="wr-hits"></span><button type="button" data-f="x" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button></form>
            <div class="wr-scroll"><div class="wr-zoom"><div class="wr-sheet">
                <div class="wr-hdr" contenteditable="true" spellcheck="false" data-ph="Kopfzeile"></div>
                <div class="wr-page" contenteditable="true" spellcheck="true" lang="de"></div>
                <div class="wr-ftr" data-ph="Fußzeile"><span class="wr-ftx" contenteditable="true" spellcheck="false"></span><span class="wr-pn"></span></div>
            </div></div></div>
            <div class="wr-st"><span class="wr-pg">Seite 1 von 1</span><span class="wr-wc"></span><span class="wr-lang"><i class="fa-solid fa-spell-check"></i>Deutsch</span><span class="wr-fill"></span>
                <button type="button" data-c="zout" aria-label="Verkleinern"><i class="fa-solid fa-minus"></i></button><input type="range" class="wr-zr" min="50" max="200" step="10" aria-label="Zoom"><button type="button" data-c="zin" aria-label="Vergrößern"><i class="fa-solid fa-plus"></i></button><span class="wr-zv">100 %</span></div>
            <div class="wr-pop" hidden></div>
            <div class="wr-imgbar" hidden><button type="button" data-iw="25">25 %</button><button type="button" data-iw="50">50 %</button><button type="button" data-iw="75">75 %</button><button type="button" data-iw="100">100 %</button><i></i><button type="button" data-ia="left" title="Links"><i class="fa-solid fa-align-left"></i></button><button type="button" data-ia="center" title="Mitte"><i class="fa-solid fa-align-center"></i></button><button type="button" data-ia="right" title="Rechts"><i class="fa-solid fa-align-right"></i></button><i></i><button type="button" data-ia="del" title="Bild löschen"><i class="fa-solid fa-trash-can"></i></button></div>
            <div class="wr-back" hidden></div>
            <input type="file" hidden class="wr-fimg" accept="image/png,image/jpeg,image/webp,image/gif"><input type="file" hidden class="wr-fdoc" accept=".docx">
        </div>`;
        const $ = s => body.querySelector(s), page = $('.wr-page'), sheet = $('.wr-sheet'), scroll = $('.wr-scroll'), pop = $('.wr-pop');
        try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (x) {}
        let zoom = 100, lastFore = 'C00000', lastHil = 'FFFF00', savedRange = null;
        const mm = { src: null, name: '', fields: [], rows: [], i: 0, preview: false, orig: null };          // Serienbrief

        // ---------- Auswahl merken (Menüband-Knöpfe stehlen sonst den Fokus) ----------
        const inPage = n => n && (n === page || page.contains(n));
        document.addEventListener('selectionchange', onSel);
        function onSel() {
            if (!body.isConnected) return document.removeEventListener('selectionchange', onSel);
            const s = getSelection(); if (s.rangeCount && inPage(s.anchorNode)) { savedRange = s.getRangeAt(0).cloneRange(); clearTimeout(onSel.t); onSel.t = setTimeout(reflect, 60); }
        }
        const restoreSel = () => { const s = getSelection(); if (document.activeElement === page && s.rangeCount && inPage(s.anchorNode)) return;            // Auswahl ist noch da (Knöpfe nehmen den Fokus nicht)
            page.focus({ preventScroll: true }); if (savedRange) { s.removeAllRanges(); s.addRange(savedRange); } };
        const blockOf = n => { while (n && n !== page) { if (n.nodeType === 1 && /^(P|H1|H2|H3|H4|BLOCKQUOTE|LI|TD|TH|PRE|DIV)$/.test(n.tagName)) return n; n = n.parentNode; } return null; };
        const selBlocks = () => { const r = savedRange; if (!r) return []; const a = blockOf(r.startContainer), b = blockOf(r.endContainer); if (!a) return [];
            const all = [...page.querySelectorAll('p,h1,h2,h3,h4,blockquote,li,pre')]; const i = all.indexOf(a), j = all.indexOf(b); return i >= 0 && j >= i ? all.slice(i, j + 1) : [a]; };

        // ---------- Rückgängig: eigene Schritte (auch für Tabellen-, Bild- und Absatzänderungen) ----------
        const H = { st: [], i: -1 };
        function caretOff() { const s = getSelection(); if (!s.rangeCount || !inPage(s.anchorNode)) return 0; const r = document.createRange(); r.selectNodeContents(page); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString().length; }
        function caretTo(off) { const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT); let n, left = off; while ((n = w.nextNode())) { if (left <= n.length) { const r = document.createRange(); r.setStart(n, left); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } left -= n.length; } }
        function snap() { const h = page.innerHTML; if (H.st[H.i] && H.st[H.i].h === h) return; H.st = H.st.slice(0, H.i + 1); H.st.push({ h, c: caretOff() }); if (H.st.length > 200) H.st.shift(); H.i = H.st.length - 1; }
        function undo() { snap(); if (H.i <= 0) return; H.i--; page.innerHTML = H.st[H.i].h; page.focus(); caretTo(H.st[H.i].c); changed(true); }
        function redo() { if (H.i >= H.st.length - 1) return; H.i++; page.innerHTML = H.st[H.i].h; page.focus(); caretTo(H.st[H.i].c); changed(true); }
        // Aufräumen: Browser erzeugen manchmal ungültige Verschachtelungen (Liste in Absatz, Tabellenteile ohne Tabelle, div statt p)
        const BL = /^(UL|OL|H[1-6]|TABLE|BLOCKQUOTE|P|DIV|PRE|HR)$/;
        function fixDom() {
            let ch = false;
            page.querySelectorAll('p, h1, h2, h3, h4, blockquote').forEach(p => {
                if (![...p.children].some(c => BL.test(c.tagName) && !c.classList.contains('wr-pb'))) return; ch = true;
                const parts = []; let run = null;
                [...p.childNodes].forEach(n => { if (n.nodeType === 1 && BL.test(n.tagName)) { run = null; parts.push(n); return; }
                    if (n.nodeType === 3 && !n.nodeValue.trim() && !run) return; if (!run) { run = document.createElement(p.tagName); [...p.attributes].forEach(a => run.setAttribute(a.name, a.value)); parts.push(run); } run.appendChild(n); });
                p.replaceWith(...parts);
            });
            page.querySelectorAll('tbody, thead, tr').forEach(x => { if (x.closest('table')) return; ch = true; const t = document.createElement('table'); x.replaceWith(t); if (x.tagName === 'TR') { const tb = document.createElement('tbody'); tb.appendChild(x); t.appendChild(tb); } else t.appendChild(x); });
            page.querySelectorAll('table').forEach(t => { if (!t.rows.length) { t.remove(); ch = true; } });
            [...page.children].forEach(c => { if (c.tagName === 'DIV' && !c.classList.contains('wr-pb')) { ch = true; if ([...c.children].some(x => BL.test(x.tagName))) c.replaceWith(...c.childNodes); else { const p = document.createElement('p'); [...c.attributes].forEach(a => p.setAttribute(a.name, a.value)); while (c.firstChild) p.appendChild(c.firstChild); c.replaceWith(p); } } });
            [...page.childNodes].forEach(n => { if (n.nodeType === 3 && n.nodeValue.trim()) { ch = true; const p = document.createElement('p'); n.replaceWith(p); p.appendChild(n); } });
            const last = page.lastElementChild; if (!last || last.tagName === 'TABLE' || last.classList.contains('wr-pb')) { page.insertAdjacentHTML('beforeend', '<p><br></p>'); ch = true; }
            return ch;
        }
        const tidy = () => { const off = caretOff(); if (fixDom()) { const s = getSelection(); if (!(s.rangeCount && s.anchorNode.isConnected && inPage(s.anchorNode))) caretTo(off); } };
        const act = fn => { tidy(); snap(); fn(); tidy(); snap(); changed(); };

        // ---------- Befehle ----------
        const ex = (c, v) => { restoreSel(); try { document.execCommand('styleWithCSS', false, true); } catch (x) {} document.execCommand(c, false, v); };
        function setSize(ptv) {
            restoreSel(); const s = getSelection(); if (!s.rangeCount) return;
            if (s.isCollapsed) { const sp = document.createElement('span'); sp.style.fontSize = ptv + 'pt'; sp.textContent = '​'; s.getRangeAt(0).insertNode(sp); const r = document.createRange(); r.setStart(sp.firstChild, 1); r.collapse(true); s.removeAllRanges(); s.addRange(r); return; }
            ex('fontSize', 7); page.querySelectorAll('font[size="7"]').forEach(f => { const sp = document.createElement('span'); sp.style.fontSize = ptv + 'pt'; while (f.firstChild) sp.appendChild(f.firstChild); f.replaceWith(sp); });
            page.querySelectorAll('span').forEach(sp => { if (sp.style.fontSize === 'xxx-large' || sp.style.fontSize === '-webkit-xxx-large') sp.style.fontSize = ptv + 'pt'; });
        }
        const curSize = () => { const s = getSelection(), n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement); return n && inPage(n) ? Math.round(parseFloat(getComputedStyle(n).fontSize) * .75 * 2) / 2 : 11; };
        function styleBlocks(k) {
            const tag = { p: 'p', title: 'h1', sub: 'p', h1: 'h1', h2: 'h2', h3: 'h3', quote: 'blockquote' }[k];
            ex('formatBlock', '<' + tag + '>');
            const s = getSelection(); savedRange = s.rangeCount ? s.getRangeAt(0).cloneRange() : savedRange;
            selBlocks().forEach(b => { if (b.tagName === 'LI' || b.tagName === 'TD') return; b.classList.remove('wr-title', 'wr-sub'); if (k === 'title') b.classList.add('wr-title'); if (k === 'sub') b.classList.add('wr-sub'); if (!b.className) b.removeAttribute('class'); });
        }
        function indent(d) {
            const bl = selBlocks(); if (bl.some(b => b.tagName === 'LI')) return ex(d > 0 ? 'indent' : 'outdent');
            bl.forEach(b => { const cur = parseFloat(b.style.marginLeft) || 0, n = Math.max(0, cur + d * 47); b.style.marginLeft = n ? n + 'px' : ''; if (!b.getAttribute('style')) b.removeAttribute('style'); });
        }
        function lineH(v) { selBlocks().forEach(b => { b.style.lineHeight = v === '1.15' ? '' : v; if (!b.getAttribute('style')) b.removeAttribute('style'); }); }
        const insertHTML = h => ex('insertHTML', h);
        function table(r, c) {
            const row = '<tr>' + '<td><br></td>'.repeat(c) + '</tr>'; insertHTML(`<table data-new="1"><tbody>${row.repeat(r)}</tbody></table><p><br></p>`);
            fixDom(); const t = page.querySelector('table[data-new]') || [...page.querySelectorAll('table')].pop(); if (!t || !t.querySelector('td')) return; t.removeAttribute('data-new');
            const prev = t.previousElementSibling; if (prev && prev.tagName === 'P' && !prev.textContent.trim() && !prev.querySelector('img') && prev.previousElementSibling) prev.remove();      // leere Zeile davor weg
            const cell = t.querySelector('td'), rg = document.createRange(); rg.setStart(cell, 0); rg.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); savedRange = rg.cloneRange();
        }
        async function imageFromFile(f) {
            if (!f || !/^image\//.test(f.type)) return;
            try { const im = await shrink(f), tw = sheet.clientWidth - (doc.st.margins.l + doc.st.margins.r) * MM, w = Math.round(Math.min(im.w, tw * .7));
                act(() => insertHTML(`<img src="${im.src}" style="width:${w}px" alt="">`)); } catch (x) { uiAlert(x.message); }
        }
        async function imageFromDocs() {
            const imgs = (window.JMOS_FILES ? JMOS_FILES.all() : []).filter(x => x.k === 'img');
            if (!imgs.length) return uiAlert('In deinen Dokumenten sind noch keine Bilder.');
            popList('Bild aus Dokumenten', imgs.map(x => [x.key, x.name]), async k => { try { const { blob, name } = await JMOS_FILES.blobOf(k); await imageFromFile(new File([blob], name, { type: blob.type || 'image/jpeg' })); } catch (x) { uiAlert(x.message); } });
        }
        async function link() {
            const s = savedRange, txt = s ? s.toString() : '', a = s && s.startContainer.parentElement && s.startContainer.parentElement.closest('a');
            const v = await askText('Link einfügen', a ? a.getAttribute('href') : 'https://', 'Einfügen', txt ? `Für „${txt.slice(0, 40)}“` : 'Ohne markierten Text wird die Adresse selbst eingefügt.'); if (v == null) return;
            const url = /^(https?:|mailto:)/i.test(v) ? v : /@/.test(v) && !/\//.test(v) ? 'mailto:' + v : 'https://' + v.replace(/^\/+/, '');
            act(() => { if (!v) return ex('unlink'); if (txt) { ex('createLink', url); page.querySelectorAll('a:not([target])').forEach(x => { x.target = '_blank'; x.rel = 'noopener noreferrer'; }); } else insertHTML(`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(v)}</a>&nbsp;`); });
        }
        const C = {
            paste: async () => { try { const t = await navigator.clipboard.readText(); act(() => ex('insertText', t)); } catch (x) { uiAlert('Der Browser erlaubt das Einfügen über den Knopf nicht. Nutze Strg+V.'); } },
            cut: () => act(() => ex('cut')), copy: () => ex('copy'), undo, redo,
            grow: () => act(() => { const c = curSize(), n = SIZES.find(s => s > c) || c + 2; setSize(n); }), shrinkf: () => act(() => { const c = curSize(), n = [...SIZES].reverse().find(s => s < c) || Math.max(1, c - 1); setSize(n); }),
            removeFormat: () => act(() => { ex('removeFormat'); ex('unlink'); }),
            bold: () => act(() => ex('bold')), italic: () => act(() => ex('italic')), underline: () => act(() => ex('underline')), strikeThrough: () => act(() => ex('strikeThrough')), subscript: () => act(() => ex('subscript')), superscript: () => act(() => ex('superscript')),
            hilite: () => act(() => ex('hiliteColor', lastHil ? '#' + lastHil : 'transparent')), fore: () => act(() => ex('foreColor', '#' + lastFore)),
            insertUnorderedList: () => act(() => ex('insertUnorderedList')), insertOrderedList: () => act(() => ex('insertOrderedList')),
            indent: () => act(() => indent(1)), outdent: () => act(() => indent(-1)),
            justifyLeft: () => act(() => ex('justifyLeft')), justifyCenter: () => act(() => ex('justifyCenter')), justifyRight: () => act(() => ex('justifyRight')), justifyFull: () => act(() => ex('justifyFull')),
            find: () => findOpen(false), replace: () => findOpen(true),
            pb: () => act(() => insertHTML('<div class="wr-pb" contenteditable="false"></div><p><br></p>')),
            imgpc: () => $('.wr-fimg').click(), imgdoc: imageFromDocs, link,
            hr: () => act(() => insertHTML('<hr><p><br></p>')), date: () => act(() => ex('insertText', today())),
            hdr: () => { $('.wr-hdr').focus(); }, ftr: () => { $('.wr-ftx').focus(); }, pnum: () => { doc.st.pageNum = !doc.st.pageNum; layout(); changed(); },
            portrait: () => { doc.st.orient = 'portrait'; layout(); changed(); }, landscape: () => { doc.st.orient = 'landscape'; layout(); changed(); },
            zin: () => setZoom(zoom + 10), zout: () => setZoom(zoom - 10), z100: () => setZoom(100), zfit: () => setZoom(Math.floor((scroll.clientWidth - 40) / (sheet.offsetWidth) * 100)),
            focus: () => { body.querySelector('.wr').classList.toggle('focus'); reflect(); }, marks: () => { body.querySelector('.wr').classList.toggle('marks'); reflect(); },
            count: () => { const t = page.innerText, w = (t.match(/\S+/g) || []).length; uiAlert(`Seiten: ${pages()}\nWörter: ${w.toLocaleString('de-DE')}\nZeichen (ohne Leerzeichen): ${t.replace(/\s/g, '').length.toLocaleString('de-DE')}\nZeichen (mit Leerzeichen): ${t.replace(/\n/g, '').length.toLocaleString('de-DE')}\nAbsätze: ${page.querySelectorAll('p,h1,h2,h3,h4,li,blockquote').length}`); },
            save: () => save(), saveas: () => save(true), dl: download, print: () => print(), close: () => API.closeWin(win),
            chart: async () => { const f = await JMOFFICE.pickChart(); if (f) { restoreSel(); imageFromFile(f); } },
            versions: () => JMOFFICE.versions({ doc, dirty, save: () => save(), reload: () => loadFile() }),
            saveTpl: () => JMOFFICE.saveTemplate(doc.name, 'docx', bytes),
            mmprev: () => { if (!mm.rows.length) return uiAlert('Wähle zuerst die Empfänger (Sendungen → Empfänger wählen).'); mmPreview(!mm.preview); },
            mmback: () => { if (!mm.rows.length) return; mm.i = (mm.i - 1 + mm.rows.length) % mm.rows.length; if (mm.preview) mmShow(); mmInfo(); },
            mmfwd: () => { if (!mm.rows.length) return; mm.i = (mm.i + 1) % mm.rows.length; if (mm.preview) mmShow(); mmInfo(); },
            mmdoc: () => { const h = mmAll(); if (!h) return; const id = 'h' + Date.now().toString(36); HAND[id] = { html: h, st: JSON.parse(JSON.stringify(doc.st)), name: doc.name.replace(/\.docx$/i, '') + ' – Serienbrief.docx' }; API.openApp('writer', { key: 'wr:neu' + (++seq), params: { hand: id, folder: doc.folder } }); },
            mmprint: () => { const h = mmAll(); if (h) print(h); },
        };

        // ---------- Serienbrief: Felder «Name» werden mit den Zeilen einer Tabelle (oder den Kontakten) gefüllt ----------
        const FIELD = /«([^«»\n]{1,60})»/g;
        function mmValue(row, f) { if (f in row) return row[f]; const k = Object.keys(row).find(x => x.toLowerCase() === f.trim().toLowerCase()); return k ? row[k] : ''; }
        function mmMerge(html, row) {
            const box = document.createElement('div'); box.innerHTML = html;
            const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), list = []; let n; while ((n = w.nextNode())) if (n.nodeValue.includes('«')) list.push(n);
            list.forEach(t => { const v = t.nodeValue.replace(FIELD, (m, f) => mmValue(row, f)); if (!v.includes('\n')) { t.nodeValue = v; return; }
                const fr = document.createDocumentFragment(); v.split('\n').forEach((x, i) => { if (i) fr.appendChild(document.createElement('br')); fr.appendChild(document.createTextNode(x)); }); t.replaceWith(fr); });
            return box.innerHTML;
        }
        function mmAll() {
            if (!mm.rows.length) { uiAlert('Wähle zuerst die Empfänger (Sendungen → Empfänger wählen).'); return null; }
            const src = mm.preview ? mm.orig : page.innerHTML; if (!FIELD.test(src.replace(/<[^>]+>/g, ''))) { FIELD.lastIndex = 0; uiAlert('Im Brief steht noch kein Feld. Setze den Cursor an die Stelle und wähle „Feld einfügen“.'); return null; } FIELD.lastIndex = 0;
            return mm.rows.map(r => mmMerge(src, r)).join('<div class="wr-pb" contenteditable="false"></div>');
        }
        function mmShow() { page.innerHTML = mmMerge(mm.orig, mm.rows[mm.i] || {}); }
        function mmPreview(on) {
            if (on === mm.preview) return;
            if (on) { mm.orig = page.innerHTML; mm.preview = true; mmShow(); page.contentEditable = 'false'; }
            else { page.innerHTML = mm.orig; mm.orig = null; mm.preview = false; page.contentEditable = 'true'; }
            body.querySelector('.wr').classList.toggle('mmprev', mm.preview); reflect(); mmInfo(); status();
        }
        function mmInfo() {
            $('.wr-mmpos').textContent = mm.rows.length ? `${mm.i + 1} / ${mm.rows.length}` : '–';
            $('.wr-mminfo').innerHTML = mm.src ? `<b>${e(mm.name)}</b><br><small>${mm.rows.length} ${mm.rows.length === 1 ? 'Empfänger' : 'Empfänger'} · ${mm.fields.length} Felder</small>` : `Noch keine Empfänger.<br><small>Eine Tabelle mit Überschriften in der ersten Zeile${window.JMOS_CONTACTS ? ' oder die Kontakte' : ''}.</small>`;
        }
        async function mmLoad(id) {
            const s = JMOFFICE.sources().find(x => x.id === id); $('.wr-mminfo').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Wird gelesen …';
            try { const r = await JMOFFICE.records(id); if (!r.rows.length) throw new Error('In der Tabelle stehen unter der Überschriftenzeile keine Einträge.'); Object.assign(mm, { src: id, name: s ? s.name : id, fields: r.fields, rows: r.rows, i: 0 }); if (mm.preview) mmShow(); }
            catch (x) { uiAlert('Empfänger konnten nicht gelesen werden: ' + x.message); }
            mmInfo();
        }

        // ---------- Aufklapp-Menüs ----------
        function showPop(btn, html, onClick) {
            const r = btn.getBoundingClientRect(), br = body.getBoundingClientRect();
            pop.innerHTML = html; pop.hidden = false; pop.style.left = Math.min(r.left - br.left, br.width - pop.offsetWidth - 8) + 'px'; pop.style.top = (r.bottom - br.top + 4) + 'px';
            pop.onclick = ev => { const t = ev.target.closest('[data-v]'); if (!t) return; pop.hidden = true; onClick(t.dataset.v, t); };
        }
        const swatches = (list, none) => `<div class="wr-sw">${list.map(c => c ? `<button type="button" data-v="${c}" style="background:#${c}" title="#${c}"></button>` : '').join('')}</div>${none ? `<button type="button" class="wr-pi" data-v="">${none}</button>` : ''}`;
        const DD = {
            addr: b => { const list = window.JMOS_CONTACTS ? JMOS_CONTACTS.all().filter(c => c.str || c.ort) : []; if (!list.length) return uiAlert('In deinen Kontakten gibt es noch niemanden mit Adresse. Öffne die App „Kontakte“ und lege einen an.');
                showPop(b, `<b class="wr-ph">Adresse einfügen</b><input class="wr-pq" placeholder="Suchen …" aria-label="Kontakt suchen"><div class="wr-pl">${list.map(c => `<button type="button" class="wr-pi" data-v="${e(c.id)}" data-s="${e([JMOS_CONTACTS.nameOf(c), c.ort, c.firma].join(' ').toLowerCase())}"><i class="fa-solid fa-address-card"></i>${e(JMOS_CONTACTS.nameOf(c))}<small>${e(c.ort || '')}</small></button>`).join('')}</div>`,
                    id => { const c = JMOS_CONTACTS.get(id); if (c) act(() => insertHTML(JMOS_CONTACTS.addressLines(c).map(l => e(l)).join('<br>'))); });
                const qi = pop.querySelector('.wr-pq'); qi.focus(); qi.addEventListener('input', () => { const v = qi.value.toLowerCase(); pop.querySelectorAll('[data-s]').forEach(x => { x.hidden = !x.dataset.s.includes(v); }); }); },
            mmsrc: b => { const list = JMOFFICE.sources(); if (!list.length) return uiAlert('Lege zuerst in „Tabellen“ eine Liste an: erste Zeile Überschriften (z. B. Vorname, Nachname, Straße, PLZ, Ort), darunter je Empfänger eine Zeile. Speichern – dann hier auswählen.');
                showPop(b, `<b class="wr-ph">Empfänger aus …</b><div class="wr-pl">${list.map(x => `<button type="button" class="wr-pi" data-v="${e(x.id)}"><i class="fa-solid ${x.icon}" style="color:${x.c}"></i>${e(x.name)}</button>`).join('')}</div>`, v => mmLoad(v)); },
            mmfield: b => { if (!mm.fields.length) return uiAlert('Wähle zuerst die Empfänger – dann stehen hier die Spalten (z. B. Vorname, Straße) als Felder bereit.'); if (mm.preview) mmPreview(false);
                showPop(b, `<b class="wr-ph">Feld einfügen</b><div class="wr-pl">${mm.fields.map(f => `<button type="button" class="wr-pi" data-v="${e(f)}"><i class="fa-solid fa-code"></i>${e(f)}</button>`).join('')}</div>`, v => act(() => ex('insertText', '«' + v + '»'))); },
            col: b => showPop(b, '<b class="wr-ph">Schriftfarbe</b>' + swatches(PAL, '<i class="fa-solid fa-droplet-slash"></i>Automatisch (Schwarz)'), v => { lastFore = v || '000000'; $('.wr-fbar').style.background = '#' + lastFore; act(() => ex('foreColor', '#' + lastFore)); }),
            hil: b => showPop(b, '<b class="wr-ph">Hervorheben</b>' + swatches(HIL, '<i class="fa-solid fa-droplet-slash"></i>Keine Farbe'), v => { lastHil = v; $('.wr-hbar').style.background = v ? '#' + v : 'transparent'; act(() => ex('hiliteColor', v ? '#' + v : 'transparent')); }),
            lh: b => showPop(b, ['1', '1.15', '1.5', '2', '2.5', '3'].map(v => `<button type="button" class="wr-pi" data-v="${v}">${v.replace('.', ',')}</button>`).join(''), v => act(() => lineH(v))),
            sym: b => showPop(b, `<div class="wr-syms">${SPECIAL.map(c => `<button type="button" data-v="${e(c)}">${e(c)}</button>`).join('')}</div>`, v => act(() => ex('insertText', v))),
            mar: b => showPop(b, MARGINS.map(([n, m]) => `<button type="button" class="wr-pi wr-mi" data-v="${e(n)}"><b>${e(n)}</b><small>${[['Oben', m.t], ['Unten', m.b], ['Links', m.l], ['Rechts', m.r]].map(([k, v]) => k + ' ' + String(v).replace('.', ',')).join(' · ')} mm</small></button>`).join(''), v => { doc.st.margins = Object.assign({}, MARGINS.find(x => x[0] === v)[1]); layout(); changed(); }),
            tbl: b => { showPop(b, `<b class="wr-ph wr-tl">Tabelle einfügen</b><div class="wr-tg8">${Array.from({ length: 64 }, (_, i) => `<button type="button" data-v="${Math.floor(i / 8) + 1}x${i % 8 + 1}"></button>`).join('')}</div>`, v => { const [r, c] = v.split('x').map(Number); act(() => table(r, c)); });
                pop.onmouseover = ev => { const t = ev.target.closest('[data-v]'); if (!t) return; const [r, c] = t.dataset.v.split('x').map(Number); pop.querySelectorAll('.wr-tg8 button').forEach(x => { const [a, b2] = x.dataset.v.split('x').map(Number); x.classList.toggle('on', a <= r && b2 <= c); }); pop.querySelector('.wr-tl').textContent = `Tabelle ${c} × ${r}`; }; },
        };
        function popList(title, rows, pick) {
            const btn = $('[data-c="imgdoc"]') || $('.wr-rib');
            showPop(btn, `<b class="wr-ph">${e(title)}</b><div class="wr-pl">${rows.map(([v, n]) => `<button type="button" class="wr-pi" data-v="${e(v)}"><i class="fa-solid fa-image"></i>${e(n)}</button>`).join('')}</div>`, pick);
        }

        // ---------- Menüband ----------
        body.addEventListener('mousedown', ev => { if (ev.target.closest('.wr-rib button, .wr-pop button, .wr-imgbar button')) ev.preventDefault(); });          // Auswahl im Text behalten
        body.addEventListener('click', ev => {
            const rt = ev.target.closest('[data-rt]'); if (rt) { if (rt.dataset.rt === 'file') return backstage('home'); body.querySelectorAll('[data-rt]').forEach(b => b.classList.toggle('on', b === rt)); body.querySelectorAll('[data-band]').forEach(b => { b.hidden = b.dataset.band !== rt.dataset.rt; }); return; }
            const dd = ev.target.closest('[data-dd]'); if (dd && !ev.target.closest('.wr-pop')) { if (!pop.hidden && pop.dataset.for === dd.dataset.dd) { pop.hidden = true; return; } pop.dataset.for = dd.dataset.dd; return DD[dd.dataset.dd](dd); }
            const c = ev.target.closest('[data-c]'); if (c && C[c.dataset.c]) { pop.hidden = true; return C[c.dataset.c](); }
            const st = ev.target.closest('[data-st]'); if (st) return act(() => styleBlocks(st.dataset.st));
            const lh = ev.target.closest('[data-lh]'); if (lh) return act(() => lineH(lh.dataset.lh));
            if (!ev.target.closest('.wr-pop')) pop.hidden = true;
        });
        $('.wr-font').addEventListener('change', ev => act(() => ex('fontName', ev.target.value)));
        $('.wr-size').addEventListener('change', ev => act(() => setSize(parseFloat(ev.target.value.replace(',', '.')))));
        $('.wr-zr').addEventListener('input', ev => setZoom(+ev.target.value));
        $('.wr-fimg').addEventListener('change', ev => { const f = ev.target.files[0]; ev.target.value = ''; imageFromFile(f); });
        $('.wr-fdoc').addEventListener('change', async ev => { const f = ev.target.files[0]; ev.target.value = ''; if (!f) return; try { const r = await JMDOCX.read(await f.arrayBuffer()); loadDoc(r.html, r.settings); doc.key = null; doc.name = f.name.replace(/\.docx$/i, '') + '.docx'; doc.saved = ''; title(); changed(); backstageClose(); } catch (x) { uiAlert('Datei nicht lesbar: ' + x.message); } });

        // Zustand im Menüband anzeigen
        function reflect() {
            const mp = body.querySelector('[data-c="mmprev"]'); if (mp) mp.classList.toggle('on', mm.preview);
            const q = c => { try { return document.queryCommandState(c); } catch (x) { return false; } };
            ['bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript', 'insertUnorderedList', 'insertOrderedList', 'justifyCenter', 'justifyRight', 'justifyFull'].forEach(c => body.querySelectorAll(`[data-c="${c}"]`).forEach(b => b.classList.toggle('on', q(c))));
            const s = getSelection(), n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
            if (n && inPage(n)) {
                const cs = getComputedStyle(n), f = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), fs = $('.wr-font');
                if (![...fs.options].some(o => o.value === f)) fs.add(new Option(f, f)); fs.value = f;
                const sz = String(Math.round(parseFloat(cs.fontSize) * .75 * 2) / 2).replace('.', ','), ss = $('.wr-size'); if (![...ss.options].some(o => o.value === sz)) ss.add(new Option(sz, sz)); ss.value = sz;
                const b = blockOf(n), k = !b ? 'p' : b.classList.contains('wr-title') ? 'title' : b.classList.contains('wr-sub') ? 'sub' : b.tagName === 'BLOCKQUOTE' ? 'quote' : /^H[1-3]$/.test(b.tagName) ? b.tagName.toLowerCase() : 'p';
                body.querySelectorAll('[data-st]').forEach(x => x.classList.toggle('on', x.dataset.st === k));
                const left = !q('justifyCenter') && !q('justifyRight') && !q('justifyFull'); body.querySelectorAll('[data-c="justifyLeft"]').forEach(x => x.classList.toggle('on', left));
            }
            $('[data-c="portrait"]').classList.toggle('on', doc.st.orient !== 'landscape'); $('[data-c="landscape"]').classList.toggle('on', doc.st.orient === 'landscape');
            $('[data-c="pnum"]').classList.toggle('on', !!doc.st.pageNum);
            $('[data-c="focus"]').classList.toggle('on', body.querySelector('.wr').classList.contains('focus')); $('[data-c="marks"]').classList.toggle('on', body.querySelector('.wr').classList.contains('marks'));
        }

        // ---------- Seite ----------
        function layout() {
            const land = doc.st.orient === 'landscape', m = doc.st.margins;
            sheet.style.setProperty('--pw', (land ? 297 : 210) + 'mm'); sheet.style.setProperty('--ph', (land ? 210 : 297) + 'mm');
            sheet.style.padding = `${m.t}mm ${m.r}mm ${m.b}mm ${m.l}mm`;
            const hd = $('.wr-hdr'), ft = $('.wr-ftr'); hd.style.top = Math.max(6, m.t / 2 - 3) + 'mm'; hd.style.left = ft.style.left = m.l + 'mm'; hd.style.right = ft.style.right = m.r + 'mm'; ft.style.bottom = Math.max(5, m.b / 2 - 3) + 'mm';
            if (document.activeElement !== hd) hd.textContent = doc.st.header || ''; const fx = $('.wr-ftx'); if (document.activeElement !== fx) fx.textContent = doc.st.footer || '';
            $('.wr-in-h').value = doc.st.header || ''; $('.wr-in-f').value = doc.st.footer || '';
            $('.wr-pn').textContent = doc.st.pageNum ? (doc.st.footer ? '   ·   ' : '') + 'Seite 1 von ' + pages() : '';
            reflect(); status();
        }
        const pageH = () => (doc.st.orient === 'landscape' ? 210 : 297) * MM;
        const pages = () => { const ph = pageH(), pb = page.querySelectorAll(':scope > .wr-pb').length, h = page.offsetTop + page.offsetHeight + doc.st.margins.b * MM; return Math.max(pb + 1, Math.ceil(h / ph - .02)); };
        function setZoom(z) { zoom = Math.max(50, Math.min(200, Math.round(z))); $('.wr-zoom').style.zoom = zoom / 100; $('.wr-zr').value = zoom; $('.wr-zv').textContent = zoom + ' %'; }
        function status() {
            const t = page.innerText || '', w = (t.match(/\S+/g) || []).length;
            const sh = sheet.getBoundingClientRect(), sr = scroll.getBoundingClientRect(), cur = Math.min(pages(), Math.max(1, Math.floor((sr.top + 40 - sh.top) / (pageH() * zoom / 100)) + 1));
            $('.wr-pg').textContent = `Seite ${cur} von ${pages()}`; $('.wr-wc').textContent = `${w.toLocaleString('de-DE')} ${w === 1 ? 'Wort' : 'Wörter'}`;
            const sv = $('.wr-sv'); sv.innerHTML = doc.saving ? '<i class="fa-solid fa-spinner fa-spin"></i>Speichert …' : !doc.key ? '<i class="fa-solid fa-circle-info"></i>Nicht gespeichert' : dirty() ? '<i class="fa-solid fa-pen"></i>Geändert' : '<i class="fa-solid fa-cloud"></i>Gespeichert';
        }
        scroll.addEventListener('scroll', () => { clearTimeout(scroll.t); scroll.t = setTimeout(status, 80); }, { passive: true });

        // ---------- Inhalt & Änderungen ----------
        const sig = () => page.innerHTML + '|' + JSON.stringify(doc.st);
        const dirty = () => sig() !== doc.saved;
        let tIn = 0, tDraft = 0;
        function changed(noSnap) {
            clearTimeout(tIn); tIn = setTimeout(() => { if (!noSnap) snap(); status(); title(); $('.wr-pn').textContent = doc.st.pageNum ? (doc.st.footer ? '   ·   ' : '') + 'Seite 1 von ' + pages() : ''; }, 400);
            clearTimeout(tDraft); tDraft = setTimeout(draft, 1500);
        }
        function title() { const t = (dirty() ? '*' : '') + doc.name + ' – Writer'; const el = win.el.querySelector('.wt-title'); if (el && el.textContent !== t) { el.textContent = t; API.renderTasks(); } status(); }
        function draft() { try { if (dirty()) localStorage.setItem(DKEY(), JSON.stringify({ html: page.innerHTML, st: doc.st, name: doc.name, folder: doc.folder, t: Date.now() })); else localStorage.removeItem(DKEY()); } catch (x) {} }
        function loadDoc(html, st) {
            page.innerHTML = clean(html) || '<p><br></p>'; fixDom();
            doc.st = Object.assign(JMDOCX.DEF(), st || {}); doc.st.margins = Object.assign(JMDOCX.DEF().margins, (st || {}).margins || {});
            H.st = []; H.i = -1; snap(); layout();
        }
        page.addEventListener('input', ev => { if (/^(insertParagraph|insertFromPaste|deleteContent|insertOrderedList|insertUnorderedList|formatBlock)/.test(ev.inputType)) tidy(); if (ev.inputType === 'insertParagraph' || (ev.data && /[\s.,;:!?]/.test(ev.data))) snap(); changed(); });          // Rückgängig wortweise
        page.addEventListener('keydown', ev => {
            const k = ev.key.toLowerCase(), c = ev.ctrlKey || ev.metaKey;
            if (c && k === 'z' && !ev.shiftKey) { ev.preventDefault(); return undo(); }
            if (c && (k === 'y' || (k === 'z' && ev.shiftKey))) { ev.preventDefault(); return redo(); }
            if (c && k === 'enter') { ev.preventDefault(); return C.pb(); }
            if (c && k === 'k') { ev.preventDefault(); return link(); }
            if (c && (k === 'e' || k === 'l' || k === 'r' || k === 'j')) { ev.preventDefault(); return C[{ e: 'justifyCenter', l: 'justifyLeft', r: 'justifyRight', j: 'justifyFull' }[k]](); }
            if (c && (k === 'b' || k === 'i' || k === 'u')) { ev.preventDefault(); return C[{ b: 'bold', i: 'italic', u: 'underline' }[k]](); }
            if (k === 'tab') {
                const s = getSelection(), td = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('td,th');
                ev.preventDefault();
                if (td && inPage(td)) { const cells = [...td.closest('table').querySelectorAll('td,th')], i = cells.indexOf(td); let nx = cells[i + (ev.shiftKey ? -1 : 1)];
                    if (!nx && !ev.shiftKey) { act(() => { const tr = td.parentElement.cloneNode(true); [...tr.cells].forEach(x => { x.innerHTML = '<br>'; }); td.closest('tr').after(tr); }); nx = td.closest('tr').nextElementSibling.cells[0]; }
                    if (nx) { const r = document.createRange(); r.selectNodeContents(nx); s.removeAllRanges(); s.addRange(r); } return; }
                if (blockOf(s.anchorNode) && blockOf(s.anchorNode).tagName === 'LI') return act(() => ex(ev.shiftKey ? 'outdent' : 'indent'));
                return act(() => ex('insertText', '\t'));
            }
        });
        page.addEventListener('beforeinput', ev => { if (ev.inputType === 'historyUndo') { ev.preventDefault(); undo(); } else if (ev.inputType === 'historyRedo') { ev.preventDefault(); redo(); } });
        page.addEventListener('paste', ev => {
            const dt = ev.clipboardData; if (!dt) return; ev.preventDefault();
            const img = [...dt.files].find(f => /^image\//.test(f.type)); if (img) return imageFromFile(img);
            const h = dt.getData('text/html'), t = dt.getData('text/plain');
            snap(); if (h) document.execCommand('insertHTML', false, clean(h)); else document.execCommand('insertText', false, t); snap(); changed();
        });
        page.addEventListener('drop', ev => { const f = ev.dataTransfer && [...ev.dataTransfer.files].find(x => /^image\//.test(x.type)); if (f) { ev.preventDefault(); imageFromFile(f); } });
        // Kopf- und Fußzeile direkt auf dem Blatt
        const hfIn = (el, k) => { el.addEventListener('input', () => { doc.st[k] = el.textContent.replace(/\s+/g, ' ').slice(0, 200); $(k === 'header' ? '.wr-in-h' : '.wr-in-f').value = doc.st[k]; changed(); });
            el.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); page.focus(); } });
            el.addEventListener('paste', ev => { ev.preventDefault(); document.execCommand('insertText', false, (ev.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' ')); }); };
        hfIn($('.wr-hdr'), 'header'); hfIn($('.wr-ftx'), 'footer');
        $('.wr-in-h').addEventListener('input', ev => { doc.st.header = ev.target.value; layout(); changed(); });
        $('.wr-in-f').addEventListener('input', ev => { doc.st.footer = ev.target.value; layout(); changed(); });

        // ---------- Bilder ----------
        let selImg = null; const ib = $('.wr-imgbar');
        const placeIb = () => { if (!selImg || !selImg.isConnected) { ib.hidden = true; selImg = null; return; } const r = selImg.getBoundingClientRect(), br = body.getBoundingClientRect(); ib.hidden = false; ib.style.left = Math.max(6, r.left - br.left) + 'px'; ib.style.top = Math.max(6, r.top - br.top - ib.offsetHeight - 6) + 'px'; };
        page.addEventListener('click', ev => { page.querySelectorAll('img.sel').forEach(x => x.classList.remove('sel')); selImg = ev.target.tagName === 'IMG' ? ev.target : null; if (selImg) selImg.classList.add('sel'); placeIb(); });
        scroll.addEventListener('scroll', placeIb, { passive: true });
        ib.addEventListener('click', ev => {
            const b = ev.target.closest('button'); if (!b || !selImg) return; const img = selImg, tw = sheet.clientWidth - (doc.st.margins.l + doc.st.margins.r) * MM;
            act(() => {
                if (b.dataset.iw) img.style.width = Math.round(tw * b.dataset.iw / 100) + 'px';
                else if (b.dataset.ia === 'del') { img.remove(); selImg = null; }
                else if (b.dataset.ia) { const bl = blockOf(img); if (bl) bl.style.textAlign = b.dataset.ia === 'left' ? '' : b.dataset.ia; }
            }); placeIb();
        });
        // Bildgröße mit der Maus (rechte untere Ecke ziehen)
        page.addEventListener('pointerdown', ev => {
            const img = ev.target.tagName === 'IMG' ? ev.target : null; if (!img) return; const r = img.getBoundingClientRect(); if (ev.clientX < r.right - 18 || ev.clientY < r.bottom - 18) return;
            ev.preventDefault(); snap(); const sx = ev.clientX, w0 = r.width / (zoom / 100);
            const mv = m => { img.style.width = Math.max(30, Math.round(w0 + (m.clientX - sx) / (zoom / 100))) + 'px'; placeIb(); };
            const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); snap(); changed(); };
            addEventListener('pointermove', mv); addEventListener('pointerup', up);
        });

        // ---------- Tabellen und Kontextmenü ----------
        page.addEventListener('contextmenu', ev => {
            const td = ev.target.closest('td,th'), a = ev.target.closest('a'); savedRange = getSelection().rangeCount ? getSelection().getRangeAt(0).cloneRange() : savedRange;
            ev.preventDefault();
            const T = fn => () => act(fn);
            const items = [['fa-scissors', 'Ausschneiden', C.cut], ['fa-copy', 'Kopieren', C.copy], ['fa-paste', 'Einfügen', C.paste], null, ['fa-link', a ? 'Link bearbeiten' : 'Link einfügen …', link]];
            if (a) items.push(['fa-arrow-up-right-from-square', 'Link öffnen', () => window.open(a.href, '_blank', 'noopener')], ['fa-link-slash', 'Link entfernen', T(() => { const r = document.createRange(); r.selectNodeContents(a); const s = getSelection(); s.removeAllRanges(); s.addRange(r); savedRange = r; ex('unlink'); })]);
            if (td) {
                const tr = td.parentElement, tb = td.closest('table'), ci = [...tr.cells].indexOf(td);
                const addRow = after => T(() => { const n = tr.cloneNode(true); [...n.cells].forEach(c => { c.innerHTML = '<br>'; }); after ? tr.after(n) : tr.before(n); });
                const addCol = after => T(() => { [...tb.rows].forEach(r => { const c = r.cells[Math.min(ci, r.cells.length - 1)]; if (!c) return; const n = document.createElement(c.tagName === 'TH' ? 'th' : 'td'); n.innerHTML = '<br>'; after ? c.after(n) : c.before(n); }); });
                items.push(null, ['fa-arrow-up', 'Zeile oberhalb einfügen', addRow(false)], ['fa-arrow-down', 'Zeile unterhalb einfügen', addRow(true)], ['fa-arrow-left', 'Spalte links einfügen', addCol(false)], ['fa-arrow-right', 'Spalte rechts einfügen', addCol(true)],
                    ['fa-heading', tr.cells[0].tagName === 'TH' ? 'Kopfzeile aufheben' : 'Als Kopfzeile formatieren', T(() => { const toTh = tr.cells[0].tagName !== 'TH'; [...tr.cells].forEach(c => { const n = document.createElement(toTh ? 'th' : 'td'); n.innerHTML = c.innerHTML; [...c.attributes].forEach(at => n.setAttribute(at.name, at.value)); c.replaceWith(n); }); })],
                    ['fa-fill-drip', 'Zelle einfärben', () => showPop(td, '<b class="wr-ph">Schattierung</b>' + swatches(['F2F2F2', 'D9D9D9', 'DEEAF6', 'E2EFD9', 'FFF2CC', 'FBE4D5', 'EDE2F6', 'BDD7EE', 'C5E0B3', 'FFE599'], '<i class="fa-solid fa-droplet-slash"></i>Keine Farbe'), v => act(() => { td.style.backgroundColor = v ? '#' + v : ''; if (!td.getAttribute('style')) td.removeAttribute('style'); }))],
                    null, ['fa-trash-can', 'Zeile löschen', T(() => { if (tb.rows.length > 1) tr.remove(); else tb.remove(); })], ['fa-trash-can', 'Spalte löschen', T(() => { if (tr.cells.length <= 1) return tb.remove(); [...tb.rows].forEach(r => { const c = r.cells[Math.min(ci, r.cells.length - 1)]; if (c) c.remove(); }); })], ['fa-trash-can', 'Tabelle löschen', T(() => tb.remove())]);
            }
            API.ctx(ev.clientX, ev.clientY, items);
        });

        // ---------- Suchen & Ersetzen ----------
        const fq = $('.wr-q'), fr = $('.wr-r');
        function findOpen(rep) { const f = $('.wr-find'); f.hidden = false; f.classList.toggle('rep', rep); const s = savedRange ? savedRange.toString() : ''; if (s && !s.includes('\n') && s.length < 60) fq.value = s; (rep && fq.value ? fr : fq).focus(); fq.select(); hits(); }
        const norm = s => $('.wr-cs').checked ? s : s.toLowerCase();
        function matches() { const q = norm(fq.value); if (!q) return []; const out = [], w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = norm(n.nodeValue); let i = -1; while ((i = t.indexOf(q, i + 1)) >= 0) out.push([n, i]); } return out; }
        function hits() { const m = matches(); $('.wr-hits').textContent = fq.value ? (m.length ? m.length + ' Treffer' : 'Kein Treffer') : ''; $('.wr-hits').classList.toggle('bad', !!fq.value && !m.length); return m; }
        function step(d) {
            const m = hits(); if (!m.length) return; const s = getSelection(); let cur = s.rangeCount && inPage(s.anchorNode) ? s.getRangeAt(0) : null;
            let pick = d > 0 ? m.find(([n, i]) => !cur || (cur.compareBoundaryPoints(Range.START_TO_START, mk(n, i)) < 0)) : [...m].reverse().find(([n, i]) => !cur || cur.compareBoundaryPoints(Range.START_TO_START, mk(n, i)) > 0);
            if (!pick) pick = d > 0 ? m[0] : m[m.length - 1];
            const r = mk(pick[0], pick[1]); r.setEnd(pick[0], pick[1] + fq.value.length); s.removeAllRanges(); s.addRange(r); savedRange = r.cloneRange();
            const el = pick[0].parentElement; el.scrollIntoView({ block: 'center' });
        }
        const mk = (n, i) => { const r = document.createRange(); r.setStart(n, i); r.collapse(true); return r; };
        $('.wr-find').addEventListener('submit', ev => { ev.preventDefault(); step(1); });
        fq.addEventListener('input', hits); $('.wr-cs').addEventListener('change', hits);
        fq.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.shiftKey) { ev.preventDefault(); step(-1); } if (ev.key === 'Escape') { ev.preventDefault(); $('.wr-find').hidden = true; page.focus(); } });
        $('.wr-find').addEventListener('click', ev => { const b = ev.target.closest('[data-f]'); if (!b) return;
            if (b.dataset.f === 'prev') step(-1);
            if (b.dataset.f === 'x') { $('.wr-find').hidden = true; page.focus(); }
            if (b.dataset.f === 'one') { const s = getSelection(); if (s.rangeCount && norm(s.toString()) === norm(fq.value) && fq.value) { act(() => { savedRange = s.getRangeAt(0).cloneRange(); ex('insertText', fr.value); }); } step(1); }
            if (b.dataset.f === 'all') { const m = matches(); if (!m.length) return; act(() => { [...m].reverse().forEach(([n, i]) => { n.nodeValue = n.nodeValue.slice(0, i) + fr.value + n.nodeValue.slice(i + fq.value.length); }); }); $('.wr-hits').textContent = m.length + ' ersetzt'; } });

        // ---------- Speichern, Herunterladen, Drucken ----------
        async function bytes() {
            const blob = await JMDOCX.write(page, Object.assign({}, doc.st, { author: U.name || '' }));
            return new Uint8Array(await blob.arrayBuffer());
        }
        async function save(as, auto) {
            if (doc.saving) return; if (mm.preview) mmPreview(false);
            if (!window.JMOS_FILES || !can(U, 'dokumente')) return uiAlert('Zum Speichern brauchst du die Berechtigung „Dokumente“. Du kannst das Dokument aber herunterladen (Datei → Herunterladen).');
            if (!doc.key || as) {
                const firstLine = (page.innerText || '').split('\n').map(s => s.trim()).find(Boolean) || 'Dokument';
                const r = await askSave(doc.key ? doc.name : firstLine.slice(0, 50).replace(/[\\/:*?"<>|]+/g, '') + '.docx', doc.folder); if (!r) return;
                doc.saving = true; status();
                restoreSel();
                try { const b = await bytes(); const key = await JMOS_FILES.createText(r.name, b, r.folder); try { localStorage.removeItem(DKEY()); } catch (x) {} doc.key = key; doc.name = r.name; doc.folder = r.folder; doc.saved = sig(); if (doc.key && window.JMOS_FILES && JMOS_FILES.touch) JMOS_FILES.touch(doc.key, doc.name); }
                catch (x) { uiAlert('Speichern fehlgeschlagen: ' + x.message); }
                doc.saving = false; title(); return;
            }
            doc.saving = true; status();
            const was = sig();
            try { const b = await bytes(); await JMOS_FILES.saveText(doc.key, b, JMOFFICE.saveOpts()); doc.saved = was; if (doc.key && window.JMOS_FILES && JMOS_FILES.touch) JMOS_FILES.touch(doc.key, doc.name); if (!dirty()) try { localStorage.removeItem(DKEY()); } catch (x) {} }
            catch (x) { if (auto) doc.autoOff = true; uiAlert('Speichern fehlgeschlagen: ' + x.message + (auto ? '\nAutomatisches Speichern ist für dieses Fenster pausiert.' : '')); }
            doc.saving = false; title();
        }
        function askSave(name, folder) {
            return new Promise(res => {
                const fs = window.JMOS_FILES ? JMOS_FILES.folders() : [], bg = document.createElement('div'); bg.className = 'uidlg-bg';
                bg.innerHTML = `<form class="uidlg" style="max-width:420px"><div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-floppy-disk"></i></span><span>Speichern unter</span></div>
                    <label class="ed-dl">Dateiname<input class="xp-ask" maxlength="120" value="${e(name)}"></label>
                    <label class="ed-dl">Ordner<select class="sh-sel">${[['', 'Eigene Dateien'], ...fs.map(f => [f.id, f.name])].map(([id, n]) => `<option value="${e(id)}" ${id === (folder || '') ? 'selected' : ''}>${e(n)}</option>`).join('')}</select></label>
                    <div class="uidlg-a"><button type="button" data-r="0">Abbrechen</button><button type="submit" class="ok">Speichern</button></div></form>`;
                const done = v => { bg.remove(); res(v); };
                bg.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); let n = bg.querySelector('input').value.trim().replace(/[\\/:*?"<>|]+/g, '_'); if (!n) return; if (!/\.docx$/i.test(n)) n = n.replace(/\.(doc|txt)$/i, '') + '.docx'; done({ name: n, folder: bg.querySelector('select').value }); });
                bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-r="0"]')) done(null); });
                bg.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); done(null); } });
                document.body.appendChild(bg); const i = bg.querySelector('input'); i.focus(); i.setSelectionRange(0, Math.max(0, i.value.length - 5));
            });
        }
        function askText(t, v, ok, hint) {
            return new Promise(res => {
                const bg = document.createElement('div'); bg.className = 'uidlg-bg';
                bg.innerHTML = `<form class="uidlg" style="max-width:440px"><div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-link"></i></span><span>${e(t)}</span></div>${hint ? `<p class="uidlg-m">${e(hint)}</p>` : ''}<input class="xp-ask" value="${e(v || '')}"><div class="uidlg-a"><button type="button" data-r="0">Abbrechen</button><button type="submit" class="ok">${e(ok)}</button></div></form>`;
                const done = x => { bg.remove(); res(x); restoreSel(); };
                bg.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); done(bg.querySelector('input').value.trim()); });
                bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-r="0"]')) done(null); });
                bg.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); done(null); } });
                document.body.appendChild(bg); const i = bg.querySelector('input'); i.focus(); i.select();
            });
        }
        async function download() {
            try { const b = await bytes(), a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([b], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })), download: doc.name });
                document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } catch (x) { uiAlert(x.message); }
        }
        function print(content) {
            const m = doc.st.margins, land = doc.st.orient === 'landscape', st = doc.st;
            const css = getComputedStyle(page), f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px'; document.body.appendChild(f);
            const sheetCss = [...document.styleSheets].map(s => { try { return [...s.cssRules].filter(r => r.selectorText && /\.wr-page|\.wr-content/.test(r.selectorText)).map(r => r.cssText.replace(/\.wr-page/g, '.wr-content')).join('\n'); } catch (x) { return ''; } }).join('\n');
            const hf = (t, cls) => t ? `<div class="${cls}">${e(t)}</div>` : '';
            f.contentDocument.open(); f.contentDocument.write(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${e(doc.name.replace(/\.docx$/i, ''))}</title><style>
                @page { size: A4 ${land ? 'landscape' : 'portrait'}; margin: ${m.t}mm ${m.r}mm ${m.b}mm ${m.l}mm; ${st.pageNum ? '@bottom-center { content: "Seite " counter(page) " von " counter(pages); font: 9pt Calibri, Carlito, Arial, sans-serif; color: #595959; }' : ''} }
                html, body { margin: 0; background: #fff; } ${sheetCss}
                .wr-content { outline: 0; } .ph-h, .ph-f { font: 9pt Calibri, Carlito, Arial, sans-serif; color: #595959; text-align: center; } .ph-h { padding-bottom: 6mm; } .ph-f { padding-top: 6mm; }
                table.wr-pt { width: 100%; border-collapse: collapse; } table.wr-pt > * > tr > td { padding: 0; border: 0; }
                .wr-pb { break-after: page; height: 0; border: 0; margin: 0; } .wr-pb::after { display: none; }
            </style></head><body><table class="wr-pt"><thead><tr><td>${hf(st.header, 'ph-h')}</td></tr></thead><tfoot><tr><td>${hf(st.footer, 'ph-f')}</td></tr></tfoot><tbody><tr><td><div class="wr-content">${typeof content === 'string' ? content : page.innerHTML}</div></td></tr></tbody></table></body></html>`);
            f.contentDocument.close();
            setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (x) { uiAlert('Drucken nicht möglich: ' + x.message); } setTimeout(() => f.remove(), 60000); }, 350);
        }

        // ---------- Datei-Menü (Backstage) ----------
        const back = $('.wr-back');
        let backstage = function (tab) {
            const files = window.JMOS_FILES ? JMOS_FILES.wordFiles().sort((a, b) => (b.date || 0) - (a.date || 0)) : [];
            const fold = Object.fromEntries((window.JMOS_FILES ? JMOS_FILES.folders() : []).map(f => [f.id, f.name]));
            const NAV = [['home', 'fa-house', 'Start'], ['new', 'fa-file-circle-plus', 'Neu'], ['open', 'fa-folder-open', 'Öffnen'], null, ['save', 'fa-floppy-disk', 'Speichern'], ['saveas', 'fa-file-export', 'Speichern unter'], ['versions', 'fa-clock-rotate-left', 'Versionsverlauf'], ['saveTpl', 'fa-bookmark', 'Als Vorlage speichern'], ['dl', 'fa-download', 'Herunterladen (.docx)'], ['print', 'fa-print', 'Drucken / PDF'], null, ['close', 'fa-xmark', 'Schließen']];
            const tplHtml = Object.entries(TPL).map(([k, t]) => `<button type="button" class="wr-tpl" data-tpl="${k}"><span class="wr-tpi"><i class="fa-solid ${t.i}"></i></span><b>${e(t.n)}</b></button>`).join('');
            const fileRows = list => list.map(it => `<button type="button" class="wr-fr" data-open="${e(it.key)}"><i class="fa-solid fa-file-word"></i><span><b>${e(it.name)}</b><small>${e(it.folder ? fold[it.folder] || 'Ordner' : 'Eigene Dateien')}</small></span><small>${it.date ? new Date(it.date).toLocaleDateString('de-DE') : ''}</small></button>`).join('') || '<p class="wr-none">Noch keine Word-Dokumente in deinen Dokumenten.</p>';
            const main = tab === 'new' ? `<h2>Neu</h2><div class="wr-tpls">${tplHtml}</div>${JMOFFICE.tplHtml('docx')}`
                : tab === 'open' ? `<h2>Öffnen</h2><button type="button" class="btn" data-bs="pc"><i class="fa-solid fa-laptop"></i>Vom Computer öffnen (.docx)</button><div class="wr-frs">${fileRows(files)}</div>`
                : `<h2>${new Date().getHours() < 11 ? 'Guten Morgen' : new Date().getHours() < 18 ? 'Hallo' : 'Guten Abend'}${U.firstName ? ', ' + e(U.firstName) : ''}</h2><div class="wr-tpls">${tplHtml}</div>${JMOFFICE.tplHtml('docx')}<h3>Zuletzt bearbeitet</h3><div class="wr-frs">${fileRows(files.slice(0, 8))}</div>`;
            back.innerHTML = `<nav><button type="button" class="wr-bk" data-bs="back" aria-label="Zurück"><i class="fa-solid fa-arrow-left"></i></button>${NAV.map(n => n ? `<button type="button" data-bs="${n[0]}" class="${n[0] === tab ? 'on' : ''}"><i class="fa-solid ${n[1]}"></i>${n[2]}</button>` : '<hr>').join('')}</nav><section>${main}</section>`;
            back.hidden = false;
        };
        function backstageClose() { back.hidden = true; page.focus(); }
        let bsTab = 'home'; const bs0 = backstage; backstage = t => { bsTab = t; bs0(t); };
        async function fromTemplate(id, name) {
            const b = await JMOFFICE.templateBytes(id), r = await JMDOCX.read(b.buffer);
            loadDoc(r.html, r.settings); doc.key = null; doc.name = (name || 'Dokument').replace(/\.docx$/i, '') + '.docx'; doc.saved = ''; title(); changed(true);
        }
        JMOFFICE.tplClicks({ back, rerender: () => backstage(bsTab), use: async id => { const t = JMOS_FILES.templates('docx').find(x => x.id === id);
            if (doc.key || page.innerText.trim()) { backstageClose(); return API.openApp('writer', { key: 'wr:neu' + (++seq), params: { utpl: id, folder: doc.folder } }); }
            try { await fromTemplate(id, t && t.name); backstageClose(); } catch (x) { uiAlert('Vorlage nicht lesbar: ' + x.message); } } });
        back.addEventListener('click', async ev => {
            const b = ev.target.closest('[data-bs]'), t = ev.target.closest('[data-tpl]'), o = ev.target.closest('[data-open]');
            if (t) { if (dirty() && page.innerText.trim() && !(await uiConfirm('Das aktuelle Dokument hat ungespeicherte Änderungen. Trotzdem eine neue Vorlage laden?', { danger: true, ok: 'Verwerfen' }))) return;
                const tp = TPL[t.dataset.tpl]; if (doc.key || page.innerText.trim()) { backstageClose(); return create(doc.folder, t.dataset.tpl); }
                loadDoc(tp.html(), tp.st || {}); doc.name = tp.n === 'Leeres Dokument' ? 'Dokument1.docx' : tp.n + '.docx'; doc.saved = sig(); if (doc.key && window.JMOS_FILES && JMOS_FILES.touch) JMOS_FILES.touch(doc.key, doc.name); title(); return backstageClose(); }
            if (o) { backstageClose(); if (o.dataset.open === doc.key) return; if (!doc.key && !page.innerText.trim()) { doc.key = o.dataset.open; return loadFile(); } return open(o.dataset.open); }
            if (!b) return; const k = b.dataset.bs;
            if (k === 'back') return backstageClose();
            if (k === 'home' || k === 'new' || k === 'open') return backstage(k);
            if (k === 'pc') return $('.wr-fdoc').click();
            backstageClose(); if (C[k]) C[k]();
        });

        // ---------- Laden ----------
        async function loadFile() {
            const it = window.JMOS_FILES && JMOS_FILES.item(doc.key);
            page.innerHTML = '<p class="wr-loading"><i class="fa-solid fa-spinner fa-spin"></i> Dokument wird geladen …</p>'; page.contentEditable = 'false';
            try {
                const { blob, name } = await JMOS_FILES.blobOf(doc.key); doc.name = name; doc.folder = it ? it.folder || '' : '';
                const r = await JMDOCX.read(await blob.arrayBuffer());
                page.contentEditable = 'true'; loadDoc(r.html, r.settings); doc.saved = sig(); if (doc.key && window.JMOS_FILES && JMOS_FILES.touch) JMOS_FILES.touch(doc.key, doc.name);
                if (it && it.src === 'sh') { doc.key = null; doc.folder = ''; JMOFFICE.flash(`Von ${it.from} geteilt – Änderungen speicherst du als eigene Kopie`); } 
                let d = null; try { d = JSON.parse(localStorage.getItem(DKEY()) || 'null'); } catch (x) {}
                if (d && d.html && d.html !== page.innerHTML && await uiConfirm(`Für „${name}“ gibt es ungespeicherte Änderungen vom ${new Date(d.t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}. Wiederherstellen?`, { ok: 'Wiederherstellen', title: 'Writer' })) { loadDoc(d.html, d.st); }
                else if (d) { try { localStorage.removeItem(DKEY()); } catch (x) {} }
            } catch (x) { page.contentEditable = 'true'; page.innerHTML = `<p><b>Das Dokument lässt sich nicht öffnen.</b></p><p>${e(x.message)}</p>`; doc.key = null; doc.saved = sig(); if (doc.key && window.JMOS_FILES && JMOS_FILES.touch) JMOS_FILES.touch(doc.key, doc.name); }
            title();
        }
        win.beforeClose = () => (mm.preview && mmPreview(false), 0) || dirty() && (doc.key || page.innerText.trim()) ? `„${doc.name}“ hat ungespeicherte Änderungen. Trotzdem schließen?` : '';
        win.onClose = () => { clearTimeout(tDraft); try { localStorage.removeItem(DKEY()); } catch (x) {}          // Schließen = gespeichert oder bewusst verworfen
            document.removeEventListener('selectionchange', onSel); };
        win.onParams = p => { if (p && p.open && p.open !== doc.key) open(p.open); };
        body.addEventListener('keydown', ev => {
            const k = ev.key.toLowerCase(), c = ev.ctrlKey || ev.metaKey;
            if (c && k === 's') { ev.preventDefault(); ev.stopPropagation(); save(ev.shiftKey); }
            else if (c && k === 'p') { ev.preventDefault(); print(); }
            else if (c && k === 'o') { ev.preventDefault(); backstage('open'); }
            else if (c && (k === 'f' || k === 'h')) { ev.preventDefault(); ev.stopPropagation(); findOpen(k === 'h'); }
            else if (k === 'escape' && !back.hidden) { ev.stopPropagation(); backstageClose(); }
            else if (k === 'escape' && !pop.hidden) { pop.hidden = true; }
        });
        new ResizeObserver(() => { status(); placeIb(); }).observe(page);

        JMOFFICE.autosave({ body, win, doc, dirty, save, busy: () => mm.preview || !!doc.autoOff || !back.hidden });
        setZoom(win.el.offsetWidth < 900 ? 80 : 100);
        if (doc.key) loadFile();
        else if (P.hand && HAND[P.hand]) { const h = HAND[P.hand]; delete HAND[P.hand]; loadDoc(h.html, h.st); doc.name = h.name; doc.saved = ''; title(); }
        else if (P.utpl) { const t = window.JMOS_FILES && JMOS_FILES.templates('docx').find(x => x.id === P.utpl); loadDoc('<p><br></p>', {}); doc.saved = sig(); title(); fromTemplate(P.utpl, t && t.name).catch(x => uiAlert('Vorlage nicht lesbar: ' + x.message)); }
        else {
            const tp = TPL[P.tpl] || TPL.leer; loadDoc(tp.html(), tp.st || {});
            const to = P.to && window.JMOS_CONTACTS && JMOS_CONTACTS.get(P.to);
            if (to) { const ps = [...page.querySelectorAll('p')], ad = ps.find(x => /Frau \/ Herrn/.test(x.textContent)), sa = ps.find(x => /Sehr geehrte Damen und Herren/.test(x.textContent));
                if (ad) ad.innerHTML = JMOS_CONTACTS.addressLines(to).map(l => e(l)).join('<br>'); if (sa) sa.textContent = JMOS_CONTACTS.salutation(to); H.st = []; H.i = -1; snap(); } doc.name = P.tpl && P.tpl !== 'leer' ? tp.n + '.docx' : 'Dokument1.docx'; doc.saved = sig(); if (doc.key && window.JMOS_FILES && JMOS_FILES.touch) JMOS_FILES.touch(doc.key, doc.name);
            let d = null; try { d = JSON.parse(localStorage.getItem(DKEY()) || 'null'); } catch (x) {}
            if (!P.tpl) backstage('home');
            title();
        }
        setTimeout(() => { if (back.hidden) { page.focus(); const r = document.createRange(); r.setStart(page.firstChild || page, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); } }, 80);
    }

    // wird von OS/office.js erst beim ersten Öffnen nachgeladen (schnellerer Start)
    const mod = { ui, init(api, user) { API = api; U = user; e = api.esc; } };
    if (window.JMOS_LAZY) JMOS_LAZY.register('writer', mod);
    else { window.JMOS_WRITER = { open, create }; (window.JMOS_EXT = window.JMOS_EXT || []).push({ apps: [{ id: 'writer', name: 'Writer', icon: 'fa-file-word', c: '#2b6cdf', native: 'writer', w: 1120, h: 760 }], ui: { writer: ui }, init: mod.init }); }
})();
