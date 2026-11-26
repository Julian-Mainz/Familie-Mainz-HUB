// OS/calc.js – Tabellenkalkulation „Tabellen“ für J.Mainz OS (wie Excel, nur im System).
// Speichert echte .xlsx-Dateien in den Dokumenten (mit OS/sheetcore.js) und öffnet vorhandene .xlsx/.csv.
// Formeln auf Deutsch (=SUMME(A1:A5); =WENN(...)), mehrere Blätter, Formatierung, Zahlenformate, Sortieren,
// Zeilen/Spalten einfügen, Ausfüllen, Kopieren/Einfügen (auch mit Excel), Rückgängig, Drucken.
(function () {
    'use strict';
    let API, U, e;
    const S = () => window.JMSHEET;
    const RH = 24, HH = 26, HW = 48, DEFW = 96;
    const PAL = ['000000', '404040', '7F7F7F', 'BFBFBF', 'FFFFFF', 'C00000', 'FF0000', 'FFC000', 'FFFF00', '92D050', '00B050', '00B0F0', '0070C0', '002060', '7030A0', '1F4E78', 'C55A11', '548235', 'BF8F00', '833C0B'];
    const FILLS = ['', 'F2F2F2', 'D9D9D9', 'DDEBF7', 'E2EFDA', 'FFF2CC', 'FCE4D6', 'EDE2F6', 'BDD7EE', 'C6E0B4', 'FFE699', 'F8CBAD', '9BC2E6', 'A9D08E', 'FFD966', 'F4B084', '5B9BD5', '70AD47', 'FFC000', 'ED7D31'];
    const FMTS = [['gen', 'Standard', '123,4'], ['num', 'Zahl', '1.234,50'], ['cur', 'Währung', '1.234,50 €'], ['pct', 'Prozent', '12 %'], ['date', 'Datum', '26.11.2026'], ['time', 'Uhrzeit', '8:30'], ['int', 'Ganze Zahl', '1.235']];
    const FHELP = { SUMME: 'Addiert Zahlen: SUMME(A1:A10)', MITTELWERT: 'Durchschnitt: MITTELWERT(A1:A10)', MIN: 'Kleinster Wert', MAX: 'Größter Wert', ANZAHL: 'Anzahl der Zahlen', ANZAHL2: 'Anzahl nicht leerer Zellen',
        WENN: 'WENN(Bedingung; Dann; Sonst)', UND: 'Alle Bedingungen wahr?', ODER: 'Eine Bedingung wahr?', RUNDEN: 'RUNDEN(Zahl; Stellen)', SUMMEWENN: 'SUMMEWENN(Bereich; Kriterium; [Summenbereich])', ZÄHLENWENN: 'ZÄHLENWENN(Bereich; Kriterium)',
        SVERWEIS: 'SVERWEIS(Suchwert; Tabelle; Spalte; FALSCH)', WENNFEHLER: 'WENNFEHLER(Wert; Ersatz)', HEUTE: 'Heutiges Datum', JETZT: 'Datum und Uhrzeit', DATUM: 'DATUM(Jahr; Monat; Tag)', VERKETTEN: 'Texte verbinden',
        LÄNGE: 'Anzahl Zeichen', LINKS: 'Zeichen von links', RECHTS: 'Zeichen von rechts', TEIL: 'TEIL(Text; Start; Anzahl)', PRODUKT: 'Multipliziert Zahlen', WURZEL: 'Quadratwurzel', ABS: 'Betrag', REST: 'Rest einer Division',
        JAHR: 'Jahr eines Datums', MONAT: 'Monat eines Datums', TAG: 'Tag eines Datums', MEDIAN: 'Mittlerer Wert', INDEX: 'INDEX(Bereich; Zeile; Spalte)', VERGLEICH: 'Position eines Werts', ISTLEER: 'Zelle leer?', TAGE: 'Tage zwischen zwei Daten',
        AUFRUNDEN: 'Aufrunden', ABRUNDEN: 'Abrunden', MITTELWERTWENN: 'Durchschnitt mit Bedingung', SUMMENPRODUKT: 'Summe der Produkte', KGRÖSSTE: 'k-größter Wert', KKLEINSTE: 'k-kleinster Wert', WOCHENTAG: 'Wochentag (1 = Sonntag)', GANZZAHL: 'Ganze Zahl' };
    const FCAT = [['Häufig', ['SUMME', 'MITTELWERT', 'ANZAHL', 'MIN', 'MAX', 'WENN', 'RUNDEN', 'SVERWEIS']], ['Mathematik', ['SUMME', 'PRODUKT', 'RUNDEN', 'AUFRUNDEN', 'ABRUNDEN', 'GANZZAHL', 'ABS', 'WURZEL', 'POTENZ', 'REST', 'SUMMEWENN', 'SUMMENPRODUKT', 'ZUFALLSBEREICH']],
        ['Statistik', ['MITTELWERT', 'MEDIAN', 'MIN', 'MAX', 'ANZAHL', 'ANZAHL2', 'ZÄHLENWENN', 'MITTELWERTWENN', 'KGRÖSSTE', 'KKLEINSTE']], ['Logik', ['WENN', 'UND', 'ODER', 'NICHT', 'WENNFEHLER', 'ISTLEER', 'ISTZAHL']],
        ['Text', ['VERKETTEN', 'LÄNGE', 'LINKS', 'RECHTS', 'TEIL', 'GROSS', 'KLEIN', 'GLÄTTEN', 'WECHSELN']], ['Datum & Zeit', ['HEUTE', 'JETZT', 'DATUM', 'JAHR', 'MONAT', 'TAG', 'WOCHENTAG', 'TAGE', 'EDATUM', 'MONATSENDE', 'ISOKALENDERWOCHE']], ['Nachschlagen', ['SVERWEIS', 'WVERWEIS', 'INDEX', 'VERGLEICH']]];
    let seq = 0;

    // ---------- Vorlagen ----------
    const C = (v, s) => ({ v, s }), F = (f, s) => ({ f, s });
    const H = { b: true, fill: 'DDEBF7', bd: true }, B = { bd: true }, EUR = { fmt: 'cur', bd: true }, SUMS = { b: true, fmt: 'cur', bd: true, fill: 'F2F2F2' };
    function grid(rows) { const m = new Map(); rows.forEach((r, ri) => r.forEach((x, ci) => { if (x == null) return; m.set(ri + ',' + ci, typeof x === 'object' ? x : { v: x }); })); return m; }
    const TPL = {
        leer: { n: 'Leere Mappe', i: 'fa-table-cells', make: () => ({ sheets: [{ name: 'Tabelle1', cells: new Map(), cols: {} }] }) },
        haushalt: { n: 'Haushaltsbuch', i: 'fa-wallet', make: () => ({ sheets: [{ name: 'Haushalt', cols: { 0: 200, 1: 120, 2: 120, 4: 160, 5: 120 }, freeze: 1, cells: grid([
            [C('Einnahmen', H), C('Geplant', H), C('Tatsächlich', H), null, C('Übersicht', H), C('Betrag', H)],
            [C('Gehalt', B), C(2500, EUR), C(2500, EUR), null, C('Einnahmen', B), F('C8', EUR)], [C('Kindergeld', B), C(250, EUR), C(250, EUR), null, C('Ausgaben', B), F('C20', EUR)], [C('Sonstiges', B), C(0, EUR), C(0, EUR), null, C('Bleibt übrig', { b: true, bd: true }), F('F2-F3', SUMS)],
            [C('', B), C('', EUR), C('', EUR), null, C('Sparquote', B), F('IFERROR(F4/F2,0)', { fmt: 'pct', bd: true })], [C('', B), C('', EUR), C('', EUR)], [C('', B), C('', EUR), C('', EUR)],
            [C('Summe', { b: true, bd: true, fill: 'F2F2F2' }), F('SUM(B2:B7)', SUMS), F('SUM(C2:C7)', SUMS)], [],
            [C('Ausgaben', H), C('Geplant', H), C('Tatsächlich', H)],
            [C('Miete', B), C(900, EUR), C(900, EUR)], [C('Strom & Gas', B), C(120, EUR), C(115, EUR)], [C('Lebensmittel', B), C(500, EUR), C(540, EUR)], [C('Versicherungen', B), C(150, EUR), C(150, EUR)],
            [C('Auto', B), C(200, EUR), C(180, EUR)], [C('Handy & Internet', B), C(60, EUR), C(60, EUR)], [C('Freizeit', B), C(150, EUR), C(190, EUR)], [C('Sparen', B), C(300, EUR), C(300, EUR)], [C('', B), C('', EUR), C('', EUR)],
            [C('Summe', { b: true, bd: true, fill: 'F2F2F2' }), F('SUM(B11:B19)', SUMS), F('SUM(C11:C19)', SUMS)]]) }] }) },
        einkauf: { n: 'Einkaufsliste', i: 'fa-cart-shopping', make: () => ({ sheets: [{ name: 'Einkauf', cols: { 0: 40, 1: 220, 2: 80, 3: 110, 4: 110 }, freeze: 1, cells: grid([
            [C('✓', H), C('Artikel', H), C('Menge', H), C('Preis', H), C('Summe', H)],
            ...[['Milch', 2, 1.19], ['Brot', 1, 2.49], ['Äpfel (1 kg)', 1, 2.99], ['Käse', 1, 3.29], ['Kaffee', 1, 6.99], ['', '', ''], ['', '', ''], ['', '', '']].map((x, i) => [C('', { bd: true, al: 'c' }), C(x[0], B), C(x[1], { bd: true, al: 'c' }), C(x[2], EUR), F(`IF(C${i + 2}="","",C${i + 2}*D${i + 2})`, EUR)]),
            [null, C('Gesamt', { b: true }), F('SUM(C2:C9)', { b: true, al: 'c' }), null, F('SUM(E2:E9)', SUMS)]]) }] }) },
        teilen: { n: 'Kosten teilen', i: 'fa-people-arrows', make: () => ({ sheets: [{ name: 'Kosten', cols: { 0: 110, 1: 220, 2: 110, 3: 120, 5: 120, 6: 110, 7: 130 }, freeze: 1, cells: grid([
            [C('Datum', H), C('Wofür', H), C('Betrag', H), C('Bezahlt von', H), null, C('Person', H), C('Bezahlt', H), C('Saldo', H)],
            [C(JMSHEET.ser(2026, 11, 1), { fmt: 'date', bd: true }), C('Einkauf', B), C(84.5, EUR), C('Julian', B), null, C('Julian', B), F('SUMIF($D$2:$D$20,F2,$C$2:$C$20)', EUR), F('G2-SUM($C$2:$C$20)/COUNTA($F$2:$F$5)', EUR)],
            [C(JMSHEET.ser(2026, 11, 3), { fmt: 'date', bd: true }), C('Tanken', B), C(60, EUR), C('Lisa', B), null, C('Lisa', B), F('SUMIF($D$2:$D$20,F3,$C$2:$C$20)', EUR), F('G3-SUM($C$2:$C$20)/COUNTA($F$2:$F$5)', EUR)],
            [C(JMSHEET.ser(2026, 11, 5), { fmt: 'date', bd: true }), C('Restaurant', B), C(72, EUR), C('Julian', B)], [C('', { fmt: 'date', bd: true }), C('', B), C('', EUR), C('', B)],
            [null, null, null, null, null, C('Positiver Saldo = bekommt Geld zurück', { i: true, color: '7F7F7F' })]]) }] }) },
    };

    function open(key) { API.openApp('tabellen', { key: 'tb:' + key, params: { open: key } }); }
    function create(folder, tpl) { API.openApp('tabellen', { key: 'tb:neu' + (++seq), params: { folder: folder || '', tpl: tpl || 'leer' } }); }

    // ======================================================================
    function ui(body, win) {
        const P = win.params || {}, J = S();
        const doc = { key: P.open || null, name: 'Mappe1.xlsx', folder: P.folder || '', saved: '', saving: false };
        let book = TPL.leer.make(), si = 0, sel = { r: 0, c: 0, r2: 0, c2: 0 }, ed = null, zoom = 100, NR = 200, NC = 26, clip = null, showF = false, lastFore = 'C00000', lastFill = 'FFFF00';
        const sh = () => book.sheets[si];
        const DKEY = () => 'jmos-tb-' + U.uid + '-' + (doc.key || win.key);
        body.innerHTML = `<div class="tbx">
            <div class="wr-rib cx-rib">
                <div class="wr-tabs"><button type="button" class="wr-file cx-file" data-rt="file">Datei</button>${[['home', 'Start'], ['ins', 'Einfügen'], ['form', 'Formeln'], ['data', 'Daten'], ['view', 'Ansicht']].map(([k, n], i) => `<button type="button" data-rt="${k}"${i ? '' : ' class="on"'}>${n}</button>`).join('')}<span class="wr-fill"></span><span class="wr-sv"></span><button type="button" class="wr-qs" data-c="save" title="Speichern (Strg+S)"><i class="fa-solid fa-floppy-disk"></i></button></div>
                <div class="wr-band" data-band="home">
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="paste"><i class="fa-solid fa-paste"></i><span>Einfügen</span></button><div class="wr-col"><button type="button" data-c="cut" title="Ausschneiden"><i class="fa-solid fa-scissors"></i></button><button type="button" data-c="copy" title="Kopieren"><i class="fa-solid fa-copy"></i></button><button type="button" data-c="undo" title="Rückgängig (Strg+Z)"><i class="fa-solid fa-rotate-left"></i></button><button type="button" data-c="redo" title="Wiederholen (Strg+Y)"><i class="fa-solid fa-rotate-right"></i></button></div></div><small>Zwischenablage</small></div>
                    <div class="wr-g"><div class="wr-gb wr-rows"><div class="wr-row"><select class="cx-fs" title="Schriftgröße">${[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map(s => `<option${s === 11 ? ' selected' : ''}>${s}</option>`).join('')}</select><button type="button" data-c="bold" title="Fett (Strg+B)"><i class="fa-solid fa-bold"></i></button><button type="button" data-c="italic" title="Kursiv (Strg+I)"><i class="fa-solid fa-italic"></i></button><button type="button" data-c="underline" title="Unterstrichen (Strg+U)"><i class="fa-solid fa-underline"></i></button></div>
                        <div class="wr-row"><button type="button" data-c="border" title="Alle Rahmenlinien"><i class="fa-solid fa-border-all"></i></button><button type="button" data-c="noborder" title="Kein Rahmen"><i class="fa-solid fa-border-none"></i></button><span class="wr-split"><button type="button" data-c="fill" title="Füllfarbe"><i class="fa-solid fa-fill-drip"></i><b class="wr-bar cx-flb" style="background:#FFFF00"></b></button><button type="button" class="wr-dd" data-dd="fill" aria-label="Füllfarbe wählen"><i class="fa-solid fa-chevron-down"></i></button></span><span class="wr-split"><button type="button" data-c="fore" title="Schriftfarbe"><i class="fa-solid fa-a"></i><b class="wr-bar cx-fb" style="background:#C00000"></b></button><button type="button" class="wr-dd" data-dd="fore" aria-label="Schriftfarbe wählen"><i class="fa-solid fa-chevron-down"></i></button></span></div></div><small>Schriftart</small></div>
                    <div class="wr-g"><div class="wr-gb wr-rows"><div class="wr-row"><button type="button" data-c="al-l" title="Linksbündig"><i class="fa-solid fa-align-left"></i></button><button type="button" data-c="al-c" title="Zentriert"><i class="fa-solid fa-align-center"></i></button><button type="button" data-c="al-r" title="Rechtsbündig"><i class="fa-solid fa-align-right"></i></button></div><div class="wr-row"><button type="button" data-c="wrap" title="Zeilenumbruch"><i class="fa-solid fa-turn-down fa-rotate-90"></i><span>Umbruch</span></button></div></div><small>Ausrichtung</small></div>
                    <div class="wr-g"><div class="wr-gb wr-rows"><div class="wr-row"><select class="cx-nf" title="Zahlenformat">${FMTS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div><div class="wr-row"><button type="button" data-c="f-cur" title="Währung (€)"><i class="fa-solid fa-euro-sign"></i></button><button type="button" data-c="f-pct" title="Prozent"><i class="fa-solid fa-percent"></i></button><button type="button" data-c="f-thou" title="Tausenderpunkt"><b class="cx-tx">000</b></button><button type="button" data-c="dec+" title="Mehr Dezimalstellen"><b class="cx-tx">,0<sup>+</sup></b></button><button type="button" data-c="dec-" title="Weniger Dezimalstellen"><b class="cx-tx">,0<sup>−</sup></b></button></div></div><small>Zahl</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-dd="cellins"><i class="fa-solid fa-table-cells-row-unlock"></i><span>Einfügen <i class="fa-solid fa-chevron-down wr-chev"></i></span></button><button type="button" class="wr-big" data-dd="celldel"><i class="fa-solid fa-table-cells-column-lock"></i><span>Löschen <i class="fa-solid fa-chevron-down wr-chev"></i></span></button></div><small>Zellen</small></div>
                    <div class="wr-g"><div class="wr-gb"><div class="wr-col2"><button type="button" data-c="autosum" title="AutoSumme (Alt+=)"><i class="cx-sig">Σ</i><span>AutoSumme</span></button><button type="button" data-c="sortAZ"><i class="fa-solid fa-arrow-down-a-z"></i><span>A → Z</span></button><button type="button" data-c="sortZA"><i class="fa-solid fa-arrow-down-z-a"></i><span>Z → A</span></button></div><div class="wr-col2"><button type="button" data-c="filldown" title="Nach unten ausfüllen (Strg+D)"><i class="fa-solid fa-arrow-down"></i><span>Ausfüllen</span></button><button type="button" data-c="clear"><i class="fa-solid fa-eraser"></i><span>Löschen</span></button><button type="button" data-c="find"><i class="fa-solid fa-magnifying-glass"></i><span>Suchen</span></button></div></div><small>Bearbeiten</small></div>
                </div>
                <div class="wr-band" data-band="ins" hidden>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="insRow"><i class="fa-solid fa-grip-lines"></i><span>Zeile einfügen</span></button><button type="button" class="wr-big" data-c="insCol"><i class="fa-solid fa-grip-lines-vertical"></i><span>Spalte einfügen</span></button><button type="button" class="wr-big" data-c="addSheet"><i class="fa-solid fa-file-circle-plus"></i><span>Neues Blatt</span></button></div><small>Zellen &amp; Blätter</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="today"><i class="fa-solid fa-calendar-day"></i><span>Heutiges Datum</span></button><button type="button" class="wr-big" data-c="now"><i class="fa-solid fa-clock"></i><span>Uhrzeit</span></button></div><small>Werte</small></div>
                </div>
                <div class="wr-band" data-band="form" hidden>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="fnDlg"><i class="fa-solid fa-square-root-variable"></i><span>Funktion einfügen</span></button>${[['SUMME', 'Σ', 'Summe'], ['MITTELWERT', 'Ø', 'Mittelwert'], ['ANZAHL', '#', 'Anzahl'], ['MAX', '↑', 'Maximum'], ['MIN', '↓', 'Minimum']].map(([f, i, n]) => `<button type="button" class="wr-big" data-auto="${f}"><b class="cx-bigsym">${i}</b><span>${n}</span></button>`).join('')}</div><small>Funktionen</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big wr-tg" data-c="showF"><i class="fa-solid fa-code"></i><span>Formeln anzeigen</span></button><button type="button" class="wr-big" data-c="recalc"><i class="fa-solid fa-arrows-rotate"></i><span>Neu berechnen</span></button></div><small>Berechnung</small></div>
                </div>
                <div class="wr-band" data-band="data" hidden>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="sortAZ"><i class="fa-solid fa-arrow-down-a-z"></i><span>Aufsteigend</span></button><button type="button" class="wr-big" data-c="sortZA"><i class="fa-solid fa-arrow-down-z-a"></i><span>Absteigend</span></button></div><small>Sortieren</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="csvIn"><i class="fa-solid fa-file-import"></i><span>CSV öffnen</span></button><button type="button" class="wr-big" data-c="csvOut"><i class="fa-solid fa-file-csv"></i><span>Als CSV herunterladen</span></button></div><small>Daten holen &amp; teilen</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big wr-tg" data-c="freeze"><i class="fa-solid fa-table-list"></i><span>Erste Zeile fixieren</span></button><button type="button" class="wr-big" data-c="dedupe"><i class="fa-solid fa-clone"></i><span>Duplikate entfernen</span></button></div><small>Datentools</small></div>
                </div>
                <div class="wr-band" data-band="view" hidden>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big" data-c="zout"><i class="fa-solid fa-magnifying-glass-minus"></i><span>Verkleinern</span></button><button type="button" class="wr-big" data-c="z100"><i class="fa-solid fa-magnifying-glass"></i><span>100 %</span></button><button type="button" class="wr-big" data-c="zin"><i class="fa-solid fa-magnifying-glass-plus"></i><span>Vergrößern</span></button></div><small>Zoom</small></div>
                    <div class="wr-g"><div class="wr-gb"><button type="button" class="wr-big wr-tg" data-c="lines"><i class="fa-solid fa-table-cells"></i><span>Gitternetz&shy;linien</span></button><button type="button" class="wr-big wr-tg" data-c="showF"><i class="fa-solid fa-code"></i><span>Formeln anzeigen</span></button></div><small>Anzeigen</small></div>
                </div>
            </div>
            <div class="cx-fbar"><input class="cx-name" aria-label="Zelle" spellcheck="false"><span class="cx-fxi">ƒx</span><input class="cx-fx" aria-label="Inhalt der Zelle" spellcheck="false" autocomplete="off"></div>
            <div class="cx-grid" tabindex="-1"><div class="cx-in"><div class="cx-hr"></div><div class="cx-rows"></div><div class="cx-sel"><div class="cx-act"></div><div class="cx-fh"></div></div><div class="cx-cp" hidden></div><textarea class="cx-ed" spellcheck="false" hidden></textarea><div class="cx-ac" hidden></div></div></div>
            <div class="cx-tabs"><button type="button" class="cx-add" data-c="addSheet" title="Neues Blatt"><i class="fa-solid fa-plus"></i></button><div class="cx-tl"></div></div>
            <div class="wr-st"><span class="cx-mode">Bereit</span><span class="wr-fill"></span><span class="cx-agg"></span><button type="button" data-c="zout" aria-label="Verkleinern"><i class="fa-solid fa-minus"></i></button><input type="range" class="wr-zr" min="50" max="200" step="10" value="100" aria-label="Zoom"><button type="button" data-c="zin" aria-label="Vergrößern"><i class="fa-solid fa-plus"></i></button><span class="wr-zv">100 %</span></div>
            <textarea class="cx-kb" aria-label="Tabelle" spellcheck="false"></textarea>
            <div class="wr-pop" hidden></div><div class="wr-back" hidden></div>
            <input type="file" hidden class="cx-fopen" accept=".xlsx,.csv">
        </div>`;
        const $ = s => body.querySelector(s), grid = $('.cx-grid'), inner = $('.cx-in'), rowsEl = $('.cx-rows'), hdr = $('.cx-hr'), selEl = $('.cx-sel'), kb = $('.cx-kb'), edEl = $('.cx-ed'), fx = $('.cx-fx'), nameEl = $('.cx-name'), pop = $('.wr-pop'), ac = $('.cx-ac');

        // ---------- Berechnung ----------
        let memo = new Map(); const BUSY = {}; const trees = new WeakMap();
        const sheetIdx = name => name == null ? -1 : book.sheets.findIndex(s => s.name.toLowerCase() === String(name).toLowerCase());
        function val(i, r, c) {
            const k = i + '|' + r + ',' + c; if (memo.has(k)) { const v = memo.get(k); return v === BUSY ? { e: '#CIRC!' } : v; }
            const cell = book.sheets[i] && book.sheets[i].cells.get(r + ',' + c); if (!cell) return '';
            if (!cell.f) return cell.v ?? '';
            memo.set(k, BUSY); let v;
            try { let t = trees.get(cell); if (!t) { t = J.parse(cell.f); trees.set(cell, t); } const w = wsFor(i); w.cur = { r, c }; v = J.evaluate(t, w); } catch (x) { v = { e: '#NAME?' }; }
            if (v === '' || v == null) v = 0;                    // leere Bezüge = 0 wie Excel
            memo.set(k, v); return v;
        }
        const wsFor = i => ({
            get: (n, r, c) => { const j = n == null ? i : sheetIdx(n); return j < 0 ? { e: '#REF!' } : val(j, r, c); },
            range: (n, r1, c1, r2, c2) => { const j = n == null ? i : sheetIdx(n); if (j < 0) return { e: '#REF!' }; r2 = Math.min(r2, r1 + 20000); c2 = Math.min(c2, c1 + 500); const out = []; for (let r = r1; r <= r2; r++) { const row = []; for (let c = c1; c <= c2; c++) row.push(val(j, r, c)); out.push(row); } return { range: true, vals: out }; },
        });
        const dirtyCalc = () => { memo = new Map(); };

        // ---------- Spalten ----------
        let colX = [];
        const width = c => (sh().cols && sh().cols[c]) || DEFW;
        function measure() {
            let maxR = 0, maxC = 0; sh().cells.forEach((v, k) => { const [r, c] = k.split(',').map(Number); if (r > maxR) maxR = r; if (c > maxC) maxC = c; });
            NR = Math.max(NR, 200, maxR + 60); NC = Math.max(26, maxC + 4, sel.c2 + 2, sel.c + 2);
            colX = [0]; for (let c = 0; c < NC; c++) colX.push(colX[c] + width(c));
            inner.style.width = (HW + colX[NC]) + 'px'; inner.style.height = (HH + NR * RH) + 'px';
            inner.style.setProperty('--gt', HW + 'px ' + Array.from({ length: NC }, (_, c) => width(c) + 'px').join(' '));
            hdr.innerHTML = `<div class="cx-corner" title="Alles auswählen"></div>` + Array.from({ length: NC }, (_, c) => `<div class="cx-ch" data-col="${c}">${J.colS(c)}<i class="cx-rz" data-rz="${c}"></i></div>`).join('');
        }
        const used = () => { let r2 = -1, c2 = -1; sh().cells.forEach((v, k) => { if (v.v === '' && !v.f) return; const [r, c] = k.split(',').map(Number); if (r > r2) r2 = r; if (c > c2) c2 = c; }); return { r2, c2 }; };

        // ---------- Zeichnen (nur sichtbare Zeilen) ----------
        let raf = 0; const paint = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };
        function cellHtml(r, c) {
            const cell = sh().cells.get(r + ',' + c), s = cell && cell.s || {};
            let v = cell ? (showF && cell.f ? '=' + J.toDE(cell.f) : val(si, r, c)) : '', txt = cell ? (typeof v === 'string' && showF && cell.f ? v : J.fmtVal(v, s)) : '';
            const isNum = typeof v === 'number', isErr = J.isE(v);
            let st = ''; if (s.b) st += 'font-weight:700;'; if (s.i) st += 'font-style:italic;'; if (s.u) st += 'text-decoration:underline;'; if (s.color) st += `color:#${s.color};`; if (s.fill) st += `background:#${s.fill};`; if (s.fs && s.fs !== 11) st += `font-size:${s.fs}pt;`;
            const al = s.al || (isNum && !(showF && cell.f) ? 'r' : isErr || typeof v === 'boolean' ? 'c' : 'l');
            let cls = 'cx-c a' + al + (s.bd ? ' bd' : '') + (s.wrap ? ' wr' : '') + (isErr ? ' err' : '');
            if (isNum && txt.length * 7.2 > width(c) - 6 && !showF) txt = '#'.repeat(Math.max(3, Math.floor((width(c) - 8) / 7.2)));
            if (txt && al === 'l' && !s.wrap && !isNum) { const nx = sh().cells.get(r + ',' + (c + 1)); if (!nx || ((nx.v == null || nx.v === '') && !nx.f)) cls += ' ov'; }
            return `<div class="${cls}"${st ? ` style="${st}"` : ''}><span>${e(txt)}</span></div>`;
        }
        function render() {
            const top = grid.scrollTop / (zoom / 100), h = grid.clientHeight / (zoom / 100);
            let r1 = Math.max(0, Math.floor((top - HH) / RH) - 4), r2 = Math.min(NR - 1, r1 + Math.ceil(h / RH) + 8);
            if (r2 > NR - 20 && NR < 1048576) { NR += 200; measure(); }
            const fr = sh().freeze || 0, out = [];
            for (let r = r1; r <= r2; r++) { if (r < fr) continue; out.push(`<div class="cx-r" style="top:${HH + r * RH}px" data-row="${r}"><div class="cx-rn">${r + 1}</div>${Array.from({ length: NC }, (_, c) => cellHtml(r, c)).join('')}</div>`); }
            for (let r = fr - 1; r >= 0; r--) out.unshift(`<div class="cx-r cx-frz" style="${r === 0 ? 'margin-top:' + HH + 'px;' : ''}top:${HH + r * RH}px" data-row="${r}"><div class="cx-rn">${r + 1}</div>${Array.from({ length: NC }, (_, c) => cellHtml(r, c)).join('')}</div>`);
            rowsEl.innerHTML = out.join('');
            body.querySelector('.tbx').classList.toggle('frz', fr > 0); inner.style.setProperty('--frz', fr);
            placeSel(); headSel();
        }
        function placeSel() {
            const a = norm(), x = HW + colX[a.c1], y = HH + a.r1 * RH, w = colX[a.c2 + 1] - colX[a.c1], hh = (a.r2 - a.r1 + 1) * RH;
            Object.assign(selEl.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
            const act = $('.cx-act'); Object.assign(act.style, { left: (colX[sel.c] - colX[a.c1]) + 'px', top: ((sel.r - a.r1) * RH) + 'px', width: width(sel.c) + 'px', height: RH + 'px' });
            selEl.classList.toggle('multi', a.r1 !== a.r2 || a.c1 !== a.c2);
            nameEl.value = a.r1 === a.r2 && a.c1 === a.c2 ? J.addr(sel.r, sel.c) : `${J.addr(a.r1, a.c1)}:${J.addr(a.r2, a.c2)}`;
            if (!ed) fx.value = rawOf(sel.r, sel.c);
            if (clip && clip.si === si && clip.cut !== undefined) { const cp = $('.cx-cp'); cp.hidden = false; Object.assign(cp.style, { left: HW + colX[clip.c1] + 'px', top: HH + clip.r1 * RH + 'px', width: colX[clip.c2 + 1] - colX[clip.c1] + 'px', height: (clip.r2 - clip.r1 + 1) * RH + 'px' }); } else $('.cx-cp').hidden = true;
            if (ed) placeEd();
            agg(); reflect();
        }
        function headSel() { const a = norm(); hdr.querySelectorAll('.cx-ch').forEach(h => h.classList.toggle('on', +h.dataset.col >= a.c1 && +h.dataset.col <= a.c2)); rowsEl.querySelectorAll('.cx-r').forEach(r => r.firstChild.classList.toggle('on', +r.dataset.row >= a.r1 && +r.dataset.row <= a.r2)); }
        const norm = () => ({ r1: Math.min(sel.r, sel.r2), r2: Math.max(sel.r, sel.r2), c1: Math.min(sel.c, sel.c2), c2: Math.max(sel.c, sel.c2) });
        function rawOf(r, c) {
            const cell = sh().cells.get(r + ',' + c); if (!cell) return ''; if (cell.f) return '=' + J.toDE(cell.f);
            const v = cell.v, s = cell.s || {}; if (typeof v === 'number') { if (s.fmt === 'date' || s.fmt === 'time' || s.fmt === 'dtime') return J.fmtVal(v, s); if (s.fmt === 'pct') return J.fmtGen(+(v * 100).toPrecision(12)) + '%'; return J.fmtGen(v); }
            if (typeof v === 'boolean') return v ? 'WAHR' : 'FALSCH'; return v == null ? '' : String(v);
        }
        function agg() {
            const a = norm(), el = $('.cx-agg'); if (a.r1 === a.r2 && a.c1 === a.c2) { el.textContent = ''; return; }
            let s = 0, n = 0, cnt = 0; const r2 = Math.min(a.r2, used().r2), c2 = Math.min(a.c2, used().c2);
            for (let r = a.r1; r <= r2; r++) for (let c = a.c1; c <= c2; c++) { const v = val(si, r, c); if (v !== '' && v != null && !(sh().cells.get(r + ',' + c) || {}).f === undefined) {} const cell = sh().cells.get(r + ',' + c); if (!cell || (cell.v === '' && !cell.f)) continue; cnt++; if (typeof v === 'number') { s += v; n++; } }
            el.innerHTML = n ? `Mittelwert: <b>${J.fmtVal(s / n, {})}</b>   Anzahl: <b>${cnt}</b>   Summe: <b>${J.fmtVal(s, {})}</b>` : cnt ? `Anzahl: <b>${cnt}</b>` : '';
        }

        // ---------- Änderungen & Rückgängig ----------
        const hist = { st: [], i: -1 };
        function apply(changes, label) {          // changes: [[sheetIdx, key, newCell|null]]
            const undo = changes.map(([i, k]) => [i, k, book.sheets[i].cells.has(k) ? book.sheets[i].cells.get(k) : null]);
            changes.forEach(([i, k, c]) => { if (c && (c.f || (c.v !== '' && c.v != null) || (c.s && Object.keys(c.s).length))) book.sheets[i].cells.set(k, c); else book.sheets[i].cells.delete(k); });
            hist.st = hist.st.slice(0, hist.i + 1); hist.st.push({ do: changes, undo, label }); if (hist.st.length > 300) hist.st.shift(); hist.i = hist.st.length - 1;
            changed();
        }
        function snapOp(fn) {                       // für Strukturänderungen: alle Blätter sichern
            const before = book.sheets.map(s => ({ name: s.name, cells: new Map(s.cells), cols: Object.assign({}, s.cols), freeze: s.freeze })); fn();
            const after = book.sheets.map(s => ({ name: s.name, cells: new Map(s.cells), cols: Object.assign({}, s.cols), freeze: s.freeze }));
            hist.st = hist.st.slice(0, hist.i + 1); hist.st.push({ snap: [before, after] }); hist.i = hist.st.length - 1; changed(true);
        }
        function restoreSnap(arr) { book.sheets = arr.map(s => ({ name: s.name, cells: new Map(s.cells), cols: Object.assign({}, s.cols), freeze: s.freeze })); si = Math.min(si, book.sheets.length - 1); changed(true); }
        function undo() { if (hist.i < 0) return; const h = hist.st[hist.i--]; if (h.snap) return restoreSnap(h.snap[0]); h.undo.forEach(([i, k, c]) => { if (c) book.sheets[i].cells.set(k, c); else book.sheets[i].cells.delete(k); }); changed(); }
        function redo() { if (hist.i >= hist.st.length - 1) return; const h = hist.st[++hist.i]; if (h.snap) return restoreSnap(h.snap[1]); h.do.forEach(([i, k, c]) => { if (c) book.sheets[i].cells.set(k, c); else book.sheets[i].cells.delete(k); }); changed(); }
        let tDraft = 0;
        function changed(struct) { dirtyCalc(); if (struct) { measure(); tabs(); } paint(); title(); clearTimeout(tDraft); tDraft = setTimeout(draft, 1500); }
        const cellsKey = c => { const s = c.s ? JSON.stringify(c.s) : ''; return (c.f ? '=' + c.f : JSON.stringify(c.v)) + s; };
        const sig = () => JSON.stringify(book.sheets.map(s => [s.name, [...s.cells].map(([k, c]) => k + ':' + cellsKey(c)).join('|'), s.cols, s.freeze || 0]));
        const dirty = () => sig() !== doc.saved;
        function title() { const t = (dirty() ? '*' : '') + doc.name + ' – Tabellen', el = win.el.querySelector('.wt-title'); if (el && el.textContent !== t) { el.textContent = t; API.renderTasks(); }
            $('.wr-sv').innerHTML = doc.saving ? '<i class="fa-solid fa-spinner fa-spin"></i>Speichert …' : !doc.key ? '<i class="fa-solid fa-circle-info"></i>Nicht gespeichert' : dirty() ? '<i class="fa-solid fa-pen"></i>Geändert' : '<i class="fa-solid fa-cloud"></i>Gespeichert'; }
        const ser = b => JSON.stringify({ sheets: b.sheets.map(s => ({ name: s.name, cells: [...s.cells], cols: s.cols, freeze: s.freeze || 0 })) });
        const deser = j => { const o = JSON.parse(j); return { sheets: o.sheets.map(s => ({ name: s.name, cells: new Map(s.cells), cols: s.cols || {}, freeze: s.freeze || 0 })) }; };
        function draft() { try { if (dirty()) localStorage.setItem(DKEY(), JSON.stringify({ b: ser(book), name: doc.name, t: Date.now() })); else localStorage.removeItem(DKEY()); } catch (x) {} }

        // ---------- Bearbeiten ----------
        function setSel(r, c, ext) { r = Math.max(0, Math.min(NR - 1, r)); c = Math.max(0, Math.min(NC + 50, c)); if (c >= NC - 1) { NC = c + 4; measure(); } if (ext) { sel.r2 = r; sel.c2 = c; } else sel = { r, c, r2: r, c2: c }; scrollTo(ext ? r : sel.r, ext ? c : sel.c); paint(); }
        function scrollTo(r, c) {
            const z = zoom / 100, y = (HH + r * RH) * z, x = (HW + colX[c]) * z, fr = (sh().freeze || 0) * RH * z;
            if (y < grid.scrollTop + HH * z + fr) grid.scrollTop = y - HH * z - fr; else if (y + RH * z > grid.scrollTop + grid.clientHeight) grid.scrollTop = y + RH * z - grid.clientHeight;
            if (x < grid.scrollLeft + HW * z) grid.scrollLeft = x - HW * z; else if (x + width(c) * z > grid.scrollLeft + grid.clientWidth) grid.scrollLeft = x + width(c) * z - grid.clientWidth;
        }
        function startEdit(initial, fromBar) {
            ed = { r: sel.r, c: sel.c, orig: rawOf(sel.r, sel.c) };
            edEl.hidden = false; edEl.value = initial != null ? initial : ed.orig; fx.value = edEl.value; placeEd();
            const s = (sh().cells.get(sel.r + ',' + sel.c) || {}).s || {}; edEl.style.fontWeight = s.b ? '700' : ''; edEl.style.fontStyle = s.i ? 'italic' : ''; edEl.style.textAlign = s.al === 'r' ? 'right' : s.al === 'c' ? 'center' : '';
            if (fromBar) fx.focus(); else { edEl.focus(); edEl.setSelectionRange(edEl.value.length, edEl.value.length); }
            $('.cx-mode').textContent = initial != null ? 'Eingeben' : 'Bearbeiten'; autoC();
        }
        function placeEd() { if (!ed) return; Object.assign(edEl.style, { left: HW + colX[ed.c] + 'px', top: HH + ed.r * RH + 'px', minWidth: width(ed.c) + 'px', height: RH + 'px' }); edEl.style.width = Math.max(width(ed.c), Math.min(600, edEl.value.length * 8 + 16)) + 'px'; }
        function commit(move) {
            if (!ed) return true; const v = (document.activeElement === fx ? fx.value : edEl.value), r = ed.r, c = ed.c;
            if (v !== ed.orig) {
                const p = J.parseInput(v), old = sh().cells.get(r + ',' + c), s = Object.assign({}, old && old.s || {}); let cell;
                if (p.f !== undefined) { let en; try { en = J.toEN(p.f); J.parse(en); } catch (x) { uiAlert('Die Formel ist fehlerhaft: ' + x.message + '\n\nTipp: Argumente mit Semikolon trennen, z. B. =WENN(A1>5;"ja";"nein")'); return false; } cell = { f: en, s };
                    if (!s.fmt) { const m = /^(\w+)\(/.exec(en); const refCell = (() => { const t = J.lex(en, false).find(x => x.t === 'ref'); if (!t) return null; const a = J.parseAddr(t.a); return sh().cells.get(a.r + ',' + a.c); })(); if (refCell && refCell.s && refCell.s.fmt && ['SUM', 'AVERAGE', 'MIN', 'MAX', undefined].includes(m ? m[1] : undefined)) s.fmt = refCell.s.fmt; } }
                else { cell = { v: p.v, s }; if (p.fmt && !s.fmt) s.fmt = p.fmt; }
                if (!Object.keys(s).length) delete cell.s;
                apply([[si, r + ',' + c, cell]]);
            }
            ed = null; edEl.hidden = true; ac.hidden = true; $('.cx-mode').textContent = 'Bereit'; kb.focus({ preventScroll: true });
            if (move) { const [dr, dc] = move; setSel(r + dr, c + dc); } else paint();
            return true;
        }
        function cancel() { ed = null; edEl.hidden = true; ac.hidden = true; $('.cx-mode').textContent = 'Bereit'; fx.value = rawOf(sel.r, sel.c); kb.focus({ preventScroll: true }); }
        // Funktionsvorschläge beim Tippen
        function autoC() {
            const src = document.activeElement === fx ? fx : edEl, v = src.value.slice(0, src.selectionStart), m = /^=.*?([A-ZÄÖÜa-zäöü][A-ZÄÖÜa-zäöü0-9.]*)$/.exec(v);
            if (!ed || !m || m[1].length < 1) { ac.hidden = true; return; }
            const q = m[1].toUpperCase(), list = Object.values(J.DE).filter(n => n.startsWith(q) && J.FN[J.EN[n]]).sort((a, b) => a.length - b.length).slice(0, 8);
            if (!list.length) { ac.hidden = true; return; }
            ac.innerHTML = list.map((n, i) => `<button type="button" data-fn="${n}" class="${i ? '' : 'on'}"><b>${n}</b><small>${e(FHELP[n] || '')}</small></button>`).join(''); ac.hidden = false;
            Object.assign(ac.style, { left: HW + colX[ed.c] + 'px', top: HH + (ed.r + 1) * RH + 2 + 'px' }); ac.dataset.q = m[1];
        }
        function acPick(n) { const src = document.activeElement === fx ? fx : edEl, pos = src.selectionStart, q = ac.dataset.q || ''; src.value = src.value.slice(0, pos - q.length) + n + '(' + src.value.slice(pos); const np = pos - q.length + n.length + 1; src.setSelectionRange(np, np); syncEd(src); ac.hidden = true; src.focus(); }
        function syncEd(src) { if (src === fx) edEl.value = fx.value; else fx.value = edEl.value; placeEd(); }
        // Zellbezug per Klick in eine Formel übernehmen
        const refMode = () => { if (!ed) return false; const src = document.activeElement === fx ? fx : edEl, v = src.value; if (v[0] !== '=') return false; const ch = v.slice(0, src.selectionStart).trim().slice(-1); return /[=(;+\-*/^&<>:]/.test(ch) || !!ed.refAt; };
        function insertRef(r1, c1, r2, c2) {
            const src = ed.src || (document.activeElement === fx ? fx : edEl); ed.src = src; const ref = r1 === r2 && c1 === c2 ? J.addr(r1, c1) : `${J.addr(Math.min(r1, r2), Math.min(c1, c2))}:${J.addr(Math.max(r1, r2), Math.max(c1, c2))}`;
            if (ed.refAt == null) ed.refAt = src.selectionStart, ed.refLen = 0;
            src.value = src.value.slice(0, ed.refAt) + ref + src.value.slice(ed.refAt + ed.refLen); ed.refLen = ref.length; const p = ed.refAt + ref.length; syncEd(src); src.focus(); src.setSelectionRange(p, p);
        }

        // ---------- Auswahl-Werkzeuge ----------
        const cellsIn = (a, cb) => { const u = used(), r2 = Math.min(a.r2, Math.max(u.r2, a.r1)), c2 = Math.min(a.c2, Math.max(u.c2, a.c1)); for (let r = a.r1; r <= r2; r++) for (let c = a.c1; c <= c2; c++) cb(r, c); };
        function styleSel(fn) { const a = norm(), ch = []; cellsIn(a, (r, c) => { const old = sh().cells.get(r + ',' + c) || { v: '' }, s = Object.assign({}, old.s || {}); fn(s); Object.keys(s).forEach(k => { if (s[k] === undefined || s[k] === false || s[k] === '') delete s[k]; }); const n = Object.assign({}, old, { s }); if (!Object.keys(s).length) delete n.s; ch.push([si, r + ',' + c, n]); }); if (ch.length) apply(ch); }
        const curS = () => (sh().cells.get(sel.r + ',' + sel.c) || {}).s || {};
        function clearSel(what) { const a = norm(), ch = []; cellsIn(a, (r, c) => { const old = sh().cells.get(r + ',' + c); if (!old) return; ch.push([si, r + ',' + c, what === 'all' ? null : old.s ? { v: '', s: old.s } : null]); }); if (ch.length) apply(ch); }
        function region() {             // zusammenhängender Bereich um die aktive Zelle
            const has = (r, c) => { const x = sh().cells.get(r + ',' + c); return x && (x.f || (x.v !== '' && x.v != null)); };
            let r1 = sel.r, r2 = sel.r, c1 = sel.c, c2 = sel.c, grow = true;
            while (grow) { grow = false;
                if (r1 > 0) for (let c = c1 - 1; c <= c2 + 1; c++) if (has(r1 - 1, c)) { r1--; grow = true; break; }
                for (let c = c1 - 1; c <= c2 + 1; c++) if (has(r2 + 1, c)) { r2++; grow = true; break; }
                if (c1 > 0) for (let r = r1; r <= r2; r++) if (has(r, c1 - 1)) { c1--; grow = true; break; }
                for (let r = r1; r <= r2; r++) if (has(r, c2 + 1)) { c2++; grow = true; break; } }
            return { r1, r2, c1, c2 };
        }
        function sort(desc) {
            let a = norm(); if (a.r1 === a.r2 && a.c1 === a.c2) a = region(); else if (a.r2 - a.r1 > 5000) { const u = used(); a.r2 = u.r2; a.c2 = Math.min(a.c2, u.c2); }
            if (a.r2 <= a.r1) return;
            const key = sel.c >= a.c1 && sel.c <= a.c2 ? sel.c : a.c1;
            const first = []; for (let c = a.c1; c <= a.c2; c++) first.push(val(si, a.r1, c)); const second = val(si, a.r1 + 1, key);
            const header = first.every(v => typeof v === 'string' && v !== '') && typeof val(si, a.r1 + 1, key) !== 'undefined' && (typeof second === 'number' || first.some((v, i) => (sh().cells.get(a.r1 + ',' + (a.c1 + i)) || {}).s && (sh().cells.get(a.r1 + ',' + (a.c1 + i)).s.b)));
            const start = header ? a.r1 + 1 : a.r1;
            const rows = []; for (let r = start; r <= a.r2; r++) { const cells = []; for (let c = a.c1; c <= a.c2; c++) cells.push(sh().cells.get(r + ',' + c) || null); rows.push({ r, cells, k: val(si, r, key) }); }
            const cmp = (x, y) => { const ex = x.k === '' || x.k == null, ey = y.k === '' || y.k == null; if (ex || ey) return ex - ey; const nx = typeof x.k === 'number', ny = typeof y.k === 'number'; if (nx !== ny) return nx ? -1 : 1; const d = nx ? x.k - y.k : String(x.k).localeCompare(String(y.k), 'de', { numeric: true, sensitivity: 'base' }); return desc ? -d : d; };
            rows.sort(cmp); const ch = [];
            rows.forEach((row, i) => { const nr = start + i; row.cells.forEach((cell, j) => { const c = a.c1 + j; let n = cell ? Object.assign({}, cell) : null; if (n && n.f) n.f = J.offsetFormula(n.f, nr - row.r, 0); ch.push([si, nr + ',' + c, n]); }); });
            apply(ch);
        }
        function insertAxis(axis, at, n) {
            snapOp(() => {
                const name = sh().name;
                book.sheets.forEach((s, i) => { const m = new Map(); s.cells.forEach((cell, k) => { let [r, c] = k.split(',').map(Number); let nc = Object.assign({}, cell);
                    if (nc.f) nc.f = J.insertShift(nc.f, name, s.name, axis, at, n);
                    if (i === si) { const v = axis === 'r' ? r : c; if (n < 0 && v >= at && v < at - n) return; if (v >= at) { if (axis === 'r') r += n; else c += n; } }
                    m.set(r + ',' + c, nc); }); s.cells = m; });
                if (axis === 'c') { const cols = {}; Object.keys(sh().cols || {}).forEach(k => { let c = +k; if (n < 0 && c >= at && c < at - n) return; if (c >= at) c += n; cols[c] = sh().cols[k]; }); sh().cols = cols; }
            });
        }
        function autoSum(fn) {
            fn = fn || 'SUM'; const a = norm(), en = J.EN[fn] || fn;
            if (a.r1 === a.r2 && a.c1 === a.c2) {
                const isN = (r, c) => r >= 0 && c >= 0 && typeof val(si, r, c) === 'number' && !!sh().cells.get(r + ',' + c);
                let r = sel.r - 1; while (r >= 0 && !sh().cells.get(r + ',' + sel.c) && sel.r - r < 3) r--;
                if (isN(r, sel.c)) { let top = r; while (isN(top - 1, sel.c)) top--; return startEdit(`=${J.DE[en] || en}(${J.addr(top, sel.c)}:${J.addr(r, sel.c)})`); }
                let c = sel.c - 1; while (c >= 0 && !sh().cells.get(sel.r + ',' + c) && sel.c - c < 3) c--;
                if (isN(sel.r, c)) { let left = c; while (isN(sel.r, left - 1)) left--; return startEdit(`=${J.DE[en] || en}(${J.addr(sel.r, left)}:${J.addr(sel.r, c)})`); }
                return startEdit(`=${J.DE[en] || en}()`);
            }
            const ch = []; for (let c = a.c1; c <= a.c2; c++) { const old = sh().cells.get(a.r2 + 1 + ',' + c); ch.push([si, (a.r2 + 1) + ',' + c, { f: `${en}(${J.addr(a.r1, c)}:${J.addr(a.r2, c)})`, s: Object.assign({ b: true }, old && old.s || {}, (sh().cells.get(a.r2 + ',' + c) || {}).s && sh().cells.get(a.r2 + ',' + c).s.fmt ? { fmt: sh().cells.get(a.r2 + ',' + c).s.fmt } : {}) }]); }
            apply(ch); sel = { r: a.r2 + 1, c: a.c1, r2: a.r2 + 1, c2: a.c2 }; paint();
        }
        function fillTo(src, dst) {            // src: Auswahl, dst: erweiterter Bereich (nur nach unten/rechts/oben/links in eine Richtung)
            const ch = [], down = dst.r2 > src.r2, up = dst.r1 < src.r1, right = dst.c2 > src.c2, left = dst.c1 < src.c1;
            const series = (vals) => { const ns = vals.map(v => v && !v.f && typeof v.v === 'number' ? v.v : null); if (ns.length >= 2 && ns.every(n => n !== null)) { const step = ns[1] - ns[0]; if (ns.every((n, i) => i === 0 || Math.abs(n - ns[i - 1] - step) < 1e-9)) return step; } return null; };
            if (down || up) for (let c = src.c1; c <= src.c2; c++) {
                const col = []; for (let r = src.r1; r <= src.r2; r++) col.push(sh().cells.get(r + ',' + c) || null); const step = series(col), n = col.length;
                const rows = down ? range(src.r2 + 1, dst.r2) : range(dst.r1, src.r1 - 1).reverse();
                rows.forEach((r, i) => { const k = down ? i % n : (n - 1 - (i % n)), from = down ? src.r1 + k : src.r1 + k, cell = col[k]; let nc = cell ? Object.assign({}, cell) : null;
                    if (nc && nc.f) nc.f = J.offsetFormula(nc.f, r - from, 0); else if (nc && step !== null) nc.v = col[n - 1].v + step * (down ? i + 1 : -(i + 1)); else if (nc && n === 1 && typeof nc.v === 'string') { const m = /^(.*?)(\d+)$/.exec(nc.v); if (m) nc.v = m[1] + (+m[2] + (down ? i + 1 : -(i + 1))); }
                    ch.push([si, r + ',' + c, nc]); });
            }
            else if (right || left) for (let r = src.r1; r <= src.r2; r++) {
                const row = []; for (let c = src.c1; c <= src.c2; c++) row.push(sh().cells.get(r + ',' + c) || null); const step = series(row), n = row.length;
                const cols = right ? range(src.c2 + 1, dst.c2) : range(dst.c1, src.c1 - 1).reverse();
                cols.forEach((c, i) => { const k = right ? i % n : (n - 1 - (i % n)), from = src.c1 + k, cell = row[k]; let nc = cell ? Object.assign({}, cell) : null;
                    if (nc && nc.f) nc.f = J.offsetFormula(nc.f, 0, c - from); else if (nc && step !== null) nc.v = row[n - 1].v + step * (right ? i + 1 : -(i + 1));
                    ch.push([si, r + ',' + c, nc]); });
            }
            if (ch.length) apply(ch);
        }
        const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };

        // ---------- Zwischenablage ----------
        function copy(cut) {
            const a = norm(), u = used(); const r2 = Math.min(a.r2, Math.max(u.r2, a.r1)), c2 = Math.min(a.c2, Math.max(u.c2, a.c1));
            const rows = [], cells = []; for (let r = a.r1; r <= r2; r++) { const tr = [], cr = []; for (let c = a.c1; c <= c2; c++) { const cell = sh().cells.get(r + ',' + c); tr.push(cell ? J.fmtVal(val(si, r, c), cell.s || {}).replace(/\t|\n/g, ' ') : ''); cr.push(cell ? Object.assign({}, cell) : null); } rows.push(tr.join('\t')); cells.push(cr); }
            clip = { si, r1: a.r1, c1: a.c1, r2, c2, cells, text: rows.join('\n'), cut: !!cut }; paint(); return clip.text;
        }
        function pasteText(text, html) {
            const a = norm();
            if (clip && text.replace(/\r/g, '') === clip.text) {
                const ch = [], dr = a.r1 - clip.r1, dc = a.c1 - clip.c1;
                if (clip.cut) for (let r = clip.r1; r <= clip.r2; r++) for (let c = clip.c1; c <= clip.c2; c++) ch.push([clip.si, r + ',' + c, null]);
                const ch_ = clip.cells.length, cw_ = clip.cells[0].length, selH = a.r2 - a.r1 + 1, selW = a.c2 - a.c1 + 1;
                const ty = !clip.cut && selH % ch_ === 0 && selH < 5000 ? selH / ch_ : 1, tx = !clip.cut && selW % cw_ === 0 && selW < 200 ? selW / cw_ : 1;          // Auswahl größer als Kopie: wiederholen
                for (let yy = 0; yy < ty; yy++) for (let xx = 0; xx < tx; xx++) clip.cells.forEach((row, i) => row.forEach((cell, j) => { const R = a.r1 + yy * ch_ + i, Cc = a.c1 + xx * cw_ + j; let n = cell ? Object.assign({}, cell) : null; if (n && n.f && !clip.cut) n.f = J.offsetFormula(n.f, R - clip.r1 - i, Cc - clip.c1 - j); ch.push([si, R + ',' + Cc, n]); }));
                apply(ch); sel = { r: a.r1, c: a.c1, r2: a.r1 + ch_ * ty - 1, c2: a.c1 + cw_ * tx - 1 }; if (clip.cut) clip = null; paint(); return;
            }
            const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n'), ch = [];
            lines.forEach((ln, i) => ln.split('\t').forEach((v, j) => { const p = J.parseInput(v); const k = (a.r1 + i) + ',' + (a.c1 + j), old = sh().cells.get(k), s = Object.assign({}, old && old.s || {}); let cell;
                if (p.f !== undefined) { try { cell = { f: J.toEN(p.f), s }; } catch (x) { cell = { v, s }; } } else { cell = { v: p.v, s }; if (p.fmt && !s.fmt) s.fmt = p.fmt; } if (!Object.keys(s).length) delete cell.s; ch.push([si, k, cell]); }));
            apply(ch); sel = { r: a.r1, c: a.c1, r2: a.r1 + lines.length - 1, c2: a.c1 + Math.max(...lines.map(l => l.split('\t').length)) - 1 }; paint();
        }
        kb.addEventListener('copy', ev => { ev.preventDefault(); ev.clipboardData.setData('text/plain', copy(false)); });
        kb.addEventListener('cut', ev => { ev.preventDefault(); ev.clipboardData.setData('text/plain', copy(true)); });
        kb.addEventListener('paste', ev => { ev.preventDefault(); pasteText(ev.clipboardData.getData('text/plain') || ''); });

        // ---------- Tastatur ----------
        const edge = (r, c, dr, dc) => { const has = (rr, cc) => { const x = sh().cells.get(rr + ',' + cc); return x && (x.f || (x.v !== '' && x.v != null)); }; const u = used(); const lim = dr ? Math.max(u.r2 + 1, r) : Math.max(u.c2 + 1, c);
            if (has(r, c) && has(r + dr, c + dc)) { while (has(r + dr, c + dc) && r + dr >= 0 && c + dc >= 0) { r += dr; c += dc; } return [r, c]; }
            r += dr; c += dc; while (r >= 0 && c >= 0 && (dr ? r : c) <= lim && !has(r, c)) { r += dr; c += dc; } if (r < 0 || c < 0 || (dr ? r : c) > lim) return [dr ? (dr < 0 ? 0 : Math.max(0, r - dr)) : r, dc ? (dc < 0 ? 0 : Math.max(0, c - dc)) : c]; return [r, c]; };
        kb.addEventListener('keydown', ev => {
            const k = ev.key, c = ev.ctrlKey || ev.metaKey, sft = ev.shiftKey, cur = sft ? { r: sel.r2, c: sel.c2 } : sel;
            const mv = (dr, dc) => { ev.preventDefault(); let [r, cc] = c ? edge(cur.r, cur.c, dr, dc) : [cur.r + dr, cur.c + dc]; setSel(r, cc, sft); };
            if (k === 'ArrowDown') return mv(1, 0); if (k === 'ArrowUp') return mv(-1, 0); if (k === 'ArrowLeft') return mv(0, -1); if (k === 'ArrowRight') return mv(0, 1);
            if (k === 'PageDown') return mv(Math.floor(grid.clientHeight / RH) - 1, 0); if (k === 'PageUp') return mv(-(Math.floor(grid.clientHeight / RH) - 1), 0);
            if (k === 'Home') { ev.preventDefault(); return setSel(c ? 0 : cur.r, 0, sft); }
            if (k === 'End' && c) { ev.preventDefault(); const u = used(); return setSel(Math.max(0, u.r2), Math.max(0, u.c2), sft); }
            if (k === 'Enter') { ev.preventDefault(); const a = norm(); if (a.r1 !== a.r2 || a.c1 !== a.c2) { let r = sel.r + (sft ? -1 : 1), cc = sel.c; if (r > a.r2) { r = a.r1; cc = cc + 1 > a.c2 ? a.c1 : cc + 1; } if (r < a.r1) r = a.r2; sel.r = r; sel.c = cc; return paint(); } return setSel(sel.r + (sft ? -1 : 1), sel.c); }
            if (k === 'Tab') { ev.preventDefault(); return setSel(sel.r, sel.c + (sft ? -1 : 1)); }
            if (k === 'F2') { ev.preventDefault(); return startEdit(); }
            if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); if (k === 'Backspace') { clearSel(); return startEdit(''); } return clearSel(); }
            if (k === 'Escape') { if (clip) { clip = null; paint(); } return; }
            if (c && (k === 'z' || k === 'Z') && !sft) { ev.preventDefault(); return undo(); }
            if (c && (k === 'y' || k === 'Y' || ((k === 'z' || k === 'Z') && sft))) { ev.preventDefault(); return redo(); }
            if (c && (k === 'b' || k === 'B')) { ev.preventDefault(); return CMD.bold(); } if (c && (k === 'i' || k === 'I')) { ev.preventDefault(); return CMD.italic(); } if (c && (k === 'u' || k === 'U')) { ev.preventDefault(); return CMD.underline(); }
            if (c && (k === 'a' || k === 'A')) { ev.preventDefault(); sel = { r: 0, c: 0, r2: NR - 1, c2: NC - 1 }; return paint(); }
            if (c && (k === 'd' || k === 'D')) { ev.preventDefault(); return CMD.filldown(); }
            if (c && k === ' ') { ev.preventDefault(); sel.r = 0; sel.r2 = NR - 1; return paint(); }
            if (sft && k === ' ') { ev.preventDefault(); sel.c = 0; sel.c2 = NC - 1; return paint(); }
            if (ev.altKey && (k === '=' || k === '0')) { ev.preventDefault(); return autoSum(); }
            if (c && k === ';') { ev.preventDefault(); return CMD.today(); }
            if (!c && !ev.altKey && k.length === 1) { ev.preventDefault(); startEdit(k); }
        });
        kb.addEventListener('input', () => { const v = kb.value; kb.value = ''; if (v && !ed) startEdit(v); });
        const edKey = (src) => ev => {
            const k = ev.key;
            if (!ac.hidden && (k === 'ArrowDown' || k === 'ArrowUp')) { ev.preventDefault(); const b = [...ac.children], i = b.findIndex(x => x.classList.contains('on')), j = (i + (k === 'ArrowDown' ? 1 : -1) + b.length) % b.length; b.forEach((x, n) => x.classList.toggle('on', n === j)); return; }
            if (!ac.hidden && (k === 'Tab' || (k === 'Enter' && ac.querySelector('.on')))) { ev.preventDefault(); return acPick(ac.querySelector('.on').dataset.fn); }
            if (k === 'Enter' && !ev.altKey) { ev.preventDefault(); return commit([ev.shiftKey ? -1 : 1, 0]); }
            if (k === 'Enter' && ev.altKey) { ev.preventDefault(); const p = src.selectionStart; src.value = src.value.slice(0, p) + '\n' + src.value.slice(p); src.setSelectionRange(p + 1, p + 1); syncEd(src); return; }
            if (k === 'Tab') { ev.preventDefault(); return commit([0, ev.shiftKey ? -1 : 1]); }
            if (k === 'Escape') { ev.preventDefault(); ev.stopPropagation(); return cancel(); }
            if (src === edEl && ed && !ed.typed && (k === 'ArrowDown' || k === 'ArrowUp' || k === 'ArrowLeft' || k === 'ArrowRight') && $('.cx-mode').textContent === 'Eingeben' && !refMode()) { ev.preventDefault(); return commit({ ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k]); }
            if ((ev.ctrlKey || ev.metaKey) && (k === 's' || k === 'S')) { ev.preventDefault(); ev.stopPropagation(); if (commit()) save(ev.shiftKey); }
        };
        edEl.addEventListener('keydown', edKey(edEl)); fx.addEventListener('keydown', edKey(fx));
        edEl.addEventListener('input', () => { if (ed) { ed.refAt = null; ed.src = null; } syncEd(edEl); autoC(); });
        fx.addEventListener('input', () => { if (!ed) { ed = { r: sel.r, c: sel.c, orig: rawOf(sel.r, sel.c) }; edEl.hidden = false; placeEd(); } else { ed.refAt = null; ed.src = null; } syncEd(fx); autoC(); });
        fx.addEventListener('focus', () => { if (!ed) { ed = { r: sel.r, c: sel.c, orig: rawOf(sel.r, sel.c) }; edEl.value = fx.value; edEl.hidden = false; placeEd(); $('.cx-mode').textContent = 'Bearbeiten'; } });
        ac.addEventListener('mousedown', ev => { ev.preventDefault(); const b = ev.target.closest('[data-fn]'); if (b) acPick(b.dataset.fn); });
        nameEl.addEventListener('keydown', ev => { if (ev.key !== 'Enter') return; ev.preventDefault(); const v = nameEl.value.trim().toUpperCase().split(':'), a = J.parseAddr(v[0]), b = v[1] ? J.parseAddr(v[1]) : a; if (!a || !b) return uiAlert('Unbekannte Zelle. Beispiel: B12 oder A1:C5'); sel = { r: a.r, c: a.c, r2: b.r, c2: b.c }; scrollTo(a.r, a.c); paint(); kb.focus(); });

        // ---------- Maus ----------
        const hit = (ev) => { const rc = inner.getBoundingClientRect(), z = zoom / 100, x = (ev.clientX - rc.left) / z - HW, y = (ev.clientY - rc.top) / z - HH;
            let c = colX.findIndex((v, i) => i > 0 && x < v) - 1; if (c < 0) c = x < 0 ? 0 : NC - 1; let r = Math.max(0, Math.floor(y / RH));
            const fr = sh().freeze || 0, gy = (ev.clientY - grid.getBoundingClientRect().top) / z; if (fr && gy >= HH && gy < HH + fr * RH) r = Math.floor((gy - HH) / RH);
            return { r: Math.min(NR - 1, r), c }; };
        grid.addEventListener('pointerdown', ev => {
            if (ev.button !== 0 || ev.target.closest('.cx-ed, .cx-ac')) return;
            const rz = ev.target.closest('[data-rz]');
            if (rz) { ev.preventDefault(); const c = +rz.dataset.rz, x0 = ev.clientX, w0 = width(c), before = Object.assign({}, sh().cols);
                const mv = m => { sh().cols[c] = Math.max(24, Math.round(w0 + (m.clientX - x0) / (zoom / 100))); measure(); paint(); };
                const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); const after = Object.assign({}, sh().cols); hist.st = hist.st.slice(0, hist.i + 1); const cur = book.sheets.map(s => ({ name: s.name, cells: new Map(s.cells), cols: Object.assign({}, s.cols), freeze: s.freeze })); const prev = cur.map((s, i) => i === si ? Object.assign({}, s, { cols: before }) : s); hist.st.push({ snap: [prev, cur] }); hist.i++; changed(); };
                addEventListener('pointermove', mv); addEventListener('pointerup', up); return; }
            if (ev.target.closest('.cx-corner')) { sel = { r: 0, c: 0, r2: NR - 1, c2: NC - 1 }; paint(); return; }
            const ch = ev.target.closest('.cx-ch'); if (ch) { ev.preventDefault(); if (ed && !commit()) return; const c = +ch.dataset.col; if (ev.shiftKey) { sel.c2 = c; sel.r = 0; sel.r2 = NR - 1; } else sel = { r: 0, c, r2: NR - 1, c2: c };
                const mv = m => { const h = hit(m); sel.c2 = h.c; paint(); }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); paint(); kb.focus({ preventScroll: true }); return; }
            const rn = ev.target.closest('.cx-rn'); if (rn) { ev.preventDefault(); if (ed && !commit()) return; const r = +rn.parentElement.dataset.row; if (ev.shiftKey) { sel.r2 = r; sel.c = 0; sel.c2 = NC - 1; } else sel = { r, c: 0, r2: r, c2: NC - 1 };
                const mv = m => { const h = hit(m); sel.r2 = h.r; paint(); }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); paint(); kb.focus({ preventScroll: true }); return; }
            if (ev.target.closest('.cx-fh')) { ev.preventDefault(); const src = norm(); let dst = Object.assign({}, src);
                const mv = m => { const h = hit(m); const dr = h.r > src.r2 ? h.r - src.r2 : h.r < src.r1 ? h.r - src.r1 : 0, dc = h.c > src.c2 ? h.c - src.c2 : h.c < src.c1 ? h.c - src.c1 : 0;
                    dst = Object.assign({}, src); if (Math.abs(dr) >= Math.abs(dc)) { if (dr > 0) dst.r2 = h.r; else if (dr < 0) dst.r1 = h.r; } else { if (dc > 0) dst.c2 = h.c; else if (dc < 0) dst.c1 = h.c; }
                    sel = { r: dst.r1, c: dst.c1, r2: dst.r2, c2: dst.c2 }; paint(); };
                const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); sel = { r: src.r1, c: src.c1, r2: src.r2, c2: src.c2 }; fillTo(src, dst); sel = { r: dst.r1, c: dst.c1, r2: dst.r2, c2: dst.c2 }; paint(); };
                addEventListener('pointermove', mv); addEventListener('pointerup', up); return; }
            const h = hit(ev);
            if (ed && refMode()) { ev.preventDefault(); const a0 = h; insertRef(a0.r, a0.c, a0.r, a0.c); const mv = m => { const b = hit(m); insertRef(a0.r, a0.c, b.r, b.c); }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); return; }
            if (ed && !commit()) return;
            ev.preventDefault(); if (ev.shiftKey) { sel.r2 = h.r; sel.c2 = h.c; } else sel = { r: h.r, c: h.c, r2: h.r, c2: h.c }; paint(); kb.focus({ preventScroll: true });
            const mv = m => { const b = hit(m); if (b.r !== sel.r2 || b.c !== sel.c2) { sel.r2 = b.r; sel.c2 = b.c; paint(); } }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up);
        });
        grid.addEventListener('dblclick', ev => { if (ev.target.closest('.cx-ch, .cx-rn, .cx-ed, [data-rz]')) { const rz = ev.target.closest('[data-rz]'); if (rz) autofitCol(+rz.dataset.rz); return; } const h = hit(ev); sel = { r: h.r, c: h.c, r2: h.r, c2: h.c }; startEdit(); });
        grid.addEventListener('scroll', paint, { passive: true });
        function autofitCol(c) { let w = 40; const cv = document.createElement('canvas').getContext('2d'); cv.font = '14.6px Calibri, Carlito, sans-serif'; sh().cells.forEach((cell, k) => { const [r, cc] = k.split(',').map(Number); if (cc !== c) return; w = Math.max(w, cv.measureText(J.fmtVal(val(si, r, c), cell.s || {})).width * ((cell.s && cell.s.fs) || 11) / 11 + 14); }); snapOp(() => { sh().cols[c] = Math.min(500, Math.round(w)); }); }
        grid.addEventListener('contextmenu', ev => {
            ev.preventDefault(); const onHead = ev.target.closest('.cx-ch'), onRow = ev.target.closest('.cx-rn'), h = hit(ev), a = norm();
            if (!onHead && !onRow && !(h.r >= a.r1 && h.r <= a.r2 && h.c >= a.c1 && h.c <= a.c2)) { sel = { r: h.r, c: h.c, r2: h.r, c2: h.c }; paint(); }
            const n = norm(), nr = n.r2 - n.r1 + 1, nc = n.c2 - n.c1 + 1, whole = (n.r2 - n.r1 + 1) >= NR - 1, wholeR = (n.c2 - n.c1 + 1) >= NC - 1;
            API.ctx(ev.clientX, ev.clientY, [['fa-scissors', 'Ausschneiden', CMD.cut], ['fa-copy', 'Kopieren', CMD.copy], ['fa-paste', 'Einfügen', CMD.paste], null,
                !whole && ['fa-grip-lines', nr > 1 ? `${nr} Zeilen oberhalb einfügen` : 'Zeile oberhalb einfügen', () => insertAxis('r', n.r1, nr)], !wholeR && ['fa-grip-lines-vertical', nc > 1 ? `${nc} Spalten links einfügen` : 'Spalte links einfügen', () => insertAxis('c', n.c1, nc)],
                !whole && ['fa-trash-can', nr > 1 ? `${nr} Zeilen löschen` : 'Zeile löschen', () => insertAxis('r', n.r1, -nr)], !wholeR && ['fa-trash-can', nc > 1 ? `${nc} Spalten löschen` : 'Spalte löschen', () => insertAxis('c', n.c1, -nc)], null,
                ['fa-eraser', 'Inhalte löschen', () => clearSel()], ['fa-broom', 'Alles löschen (mit Format)', () => clearSel('all')], null,
                ['fa-arrow-down-a-z', 'Aufsteigend sortieren', () => sort(false)], ['fa-arrow-down-z-a', 'Absteigend sortieren', () => sort(true)], onHead && ['fa-arrows-left-right', 'Spaltenbreite anpassen', () => autofitCol(n.c1)]]);
        });

        // ---------- Blätter ----------
        function tabs() { $('.cx-tl').innerHTML = book.sheets.map((s, i) => `<button type="button" class="cx-tab${i === si ? ' on' : ''}" data-sh="${i}">${e(s.name)}</button>`).join(''); }
        function goSheet(i) { if (ed && !commit()) return; si = i; sel = { r: 0, c: 0, r2: 0, c2: 0 }; NR = 200; grid.scrollTop = grid.scrollLeft = 0; measure(); tabs(); paint(); reflect(); }
        async function renameSheet(i) {
            const old = book.sheets[i].name, v = await ask('Blatt umbenennen', old, 'Umbenennen'); if (!v || v === old) return;
            if (/[\\/?*[\]:]/.test(v) || v.length > 31) return uiAlert('Blattnamen dürfen höchstens 31 Zeichen haben und keine der Zeichen \\ / ? * [ ] : enthalten.');
            if (book.sheets.some((s, j) => j !== i && s.name.toLowerCase() === v.toLowerCase())) return uiAlert('Diesen Namen gibt es schon.');
            snapOp(() => { book.sheets.forEach(s => s.cells.forEach((cell, k) => { if (cell.f && cell.f.includes('!')) { const nf = J.renameSheetRefs(cell.f, old, v); if (nf !== cell.f) s.cells.set(k, Object.assign({}, cell, { f: nf })); } })); book.sheets[i].name = v; });
        }
        function addSheet() { let n = book.sheets.length + 1; while (book.sheets.some(s => s.name === 'Tabelle' + n)) n++; snapOp(() => { book.sheets.push({ name: 'Tabelle' + n, cells: new Map(), cols: {} }); }); goSheet(book.sheets.length - 1); }
        $('.cx-tl').addEventListener('click', ev => { const t = ev.target.closest('[data-sh]'); if (t) goSheet(+t.dataset.sh); });
        $('.cx-tl').addEventListener('dblclick', ev => { const t = ev.target.closest('[data-sh]'); if (t) renameSheet(+t.dataset.sh); });
        $('.cx-tl').addEventListener('contextmenu', ev => { const t = ev.target.closest('[data-sh]'); if (!t) return; ev.preventDefault(); const i = +t.dataset.sh;
            API.ctx(ev.clientX, ev.clientY - 10, [['fa-pen', 'Umbenennen', () => renameSheet(i)], ['fa-clone', 'Kopieren', () => { snapOp(() => { const s = book.sheets[i]; let n = s.name + ' (2)', k = 2; while (book.sheets.some(x => x.name === n)) n = `${s.name} (${++k})`; book.sheets.splice(i + 1, 0, { name: n, cells: new Map([...s.cells].map(([kk, c]) => [kk, Object.assign({}, c)])), cols: Object.assign({}, s.cols), freeze: s.freeze }); }); goSheet(i + 1); }],
                i > 0 && ['fa-arrow-left', 'Nach links', () => { snapOp(() => { const [s] = book.sheets.splice(i, 1); book.sheets.splice(i - 1, 0, s); }); goSheet(i - 1); }], i < book.sheets.length - 1 && ['fa-arrow-right', 'Nach rechts', () => { snapOp(() => { const [s] = book.sheets.splice(i, 1); book.sheets.splice(i + 1, 0, s); }); goSheet(i + 1); }],
                null, book.sheets.length > 1 && ['fa-trash-can', 'Löschen', async () => { if (book.sheets[i].cells.size && !(await uiConfirm(`Blatt „${book.sheets[i].name}“ mit allen Inhalten löschen?`, { danger: true, ok: 'Löschen' }))) return; snapOp(() => book.sheets.splice(i, 1)); goSheet(Math.max(0, i - 1)); }]], true); });

        // ---------- Menüband ----------
        function showPop(btn, html, onClick) { const r = btn.getBoundingClientRect(), br = body.getBoundingClientRect(); pop.innerHTML = html; pop.hidden = false; pop.style.left = Math.min(r.left - br.left, br.width - pop.offsetWidth - 8) + 'px'; pop.style.top = (r.bottom - br.top + 4) + 'px'; pop.onclick = ev => { const t = ev.target.closest('[data-v]'); if (!t) return; pop.hidden = true; onClick(t.dataset.v); }; }
        const sw = (list, none) => `<div class="wr-sw">${list.filter(Boolean).map(c => `<button type="button" data-v="${c}" style="background:#${c}"></button>`).join('')}</div>${none ? `<button type="button" class="wr-pi" data-v="">${none}</button>` : ''}`;
        const DD = {
            fore: b => showPop(b, '<b class="wr-ph">Schriftfarbe</b>' + sw(PAL, '<i class="fa-solid fa-droplet-slash"></i>Automatisch'), v => { lastFore = v; $('.cx-fb').style.background = v ? '#' + v : '#000'; styleSel(s => { s.color = v && v !== '000000' ? v : undefined; }); }),
            fill: b => showPop(b, '<b class="wr-ph">Füllfarbe</b>' + sw(FILLS, '<i class="fa-solid fa-droplet-slash"></i>Keine Füllung'), v => { lastFill = v; $('.cx-flb').style.background = v ? '#' + v : 'transparent'; styleSel(s => { s.fill = v || undefined; }); }),
            cellins: b => showPop(b, `<button type="button" class="wr-pi" data-v="r"><i class="fa-solid fa-grip-lines"></i>Zeilen einfügen</button><button type="button" class="wr-pi" data-v="c"><i class="fa-solid fa-grip-lines-vertical"></i>Spalten einfügen</button><button type="button" class="wr-pi" data-v="s"><i class="fa-solid fa-file-circle-plus"></i>Blatt einfügen</button>`, v => { const n = norm(); if (v === 'r') insertAxis('r', n.r1, Math.min(n.r2 - n.r1 + 1, 1000)); if (v === 'c') insertAxis('c', n.c1, Math.min(n.c2 - n.c1 + 1, 100)); if (v === 's') addSheet(); }),
            celldel: b => showPop(b, `<button type="button" class="wr-pi" data-v="r"><i class="fa-solid fa-grip-lines"></i>Zeilen löschen</button><button type="button" class="wr-pi" data-v="c"><i class="fa-solid fa-grip-lines-vertical"></i>Spalten löschen</button>`, v => { const n = norm(); if (v === 'r') insertAxis('r', n.r1, -Math.min(n.r2 - n.r1 + 1, NR)); if (v === 'c') insertAxis('c', n.c1, -Math.min(n.c2 - n.c1 + 1, NC)); }),
        };
        const CMD = {
            undo, redo, copy: () => { copy(false); try { navigator.clipboard.writeText(clip.text); } catch (x) {} }, cut: () => { copy(true); try { navigator.clipboard.writeText(clip.text); } catch (x) {} },
            paste: async () => { try { pasteText(await navigator.clipboard.readText()); } catch (x) { if (clip) pasteText(clip.text); else uiAlert('Der Browser erlaubt das Einfügen über den Knopf nicht. Nutze Strg+V.'); } },
            bold: () => { const v = !curS().b; styleSel(s => { s.b = v; }); }, italic: () => { const v = !curS().i; styleSel(s => { s.i = v; }); }, underline: () => { const v = !curS().u; styleSel(s => { s.u = v; }); },
            border: () => styleSel(s => { s.bd = true; }), noborder: () => styleSel(s => { s.bd = undefined; }),
            fill: () => styleSel(s => { s.fill = lastFill || undefined; }), fore: () => styleSel(s => { s.color = lastFore && lastFore !== '000000' ? lastFore : undefined; }),
            'al-l': () => { const v = curS().al === 'l' ? undefined : 'l'; styleSel(s => { s.al = v; }); }, 'al-c': () => { const v = curS().al === 'c' ? undefined : 'c'; styleSel(s => { s.al = v; }); }, 'al-r': () => { const v = curS().al === 'r' ? undefined : 'r'; styleSel(s => { s.al = v; }); },
            wrap: () => { const v = !curS().wrap; styleSel(s => { s.wrap = v; }); },
            'f-cur': () => styleSel(s => { delete s.code; s.fmt = s.fmt === 'cur' ? undefined : 'cur'; delete s.dec; }), 'f-pct': () => styleSel(s => { delete s.code; s.fmt = s.fmt === 'pct' ? undefined : 'pct'; delete s.dec; }), 'f-thou': () => styleSel(s => { delete s.code; s.fmt = 'num'; }),
            'dec+': () => styleSel(s => { delete s.code; const d = s.dec != null ? s.dec : s.fmt === 'num' || s.fmt === 'cur' ? 2 : s.fmt === 'pct' || s.fmt === 'int' ? 0 : (() => { const v = val(si, sel.r, sel.c); return typeof v === 'number' ? ((String(v).split('.')[1] || '').length) : 0; })(); s.dec = Math.min(10, d + 1); if (!s.fmt || s.fmt === 'gen') s.fmt = undefined; }),
            'dec-': () => styleSel(s => { delete s.code; const d = s.dec != null ? s.dec : s.fmt === 'num' || s.fmt === 'cur' ? 2 : s.fmt === 'pct' || s.fmt === 'int' ? 0 : (() => { const v = val(si, sel.r, sel.c); return typeof v === 'number' ? Math.min(10, (String(v).split('.')[1] || '').length) : 0; })(); s.dec = Math.max(0, d - 1); }),
            autosum: () => autoSum(), sortAZ: () => sort(false), sortZA: () => sort(true), clear: () => clearSel(), find,
            filldown: () => { const a = norm(); if (a.r1 === a.r2) { if (a.r1 === 0) return; fillTo({ r1: a.r1 - 1, r2: a.r1 - 1, c1: a.c1, c2: a.c2 }, { r1: a.r1 - 1, r2: a.r2, c1: a.c1, c2: a.c2 }); } else fillTo({ r1: a.r1, r2: a.r1, c1: a.c1, c2: a.c2 }, a); },
            insRow: () => { const n = norm(); insertAxis('r', n.r1, 1); }, insCol: () => { const n = norm(); insertAxis('c', n.c1, 1); }, addSheet,
            today: () => apply([[si, sel.r + ',' + sel.c, { v: Math.floor(J.ser(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())), s: Object.assign({}, curS(), { fmt: 'date' }) }]]),
            now: () => { const d = new Date(); apply([[si, sel.r + ',' + sel.c, { v: (d.getHours() * 60 + d.getMinutes()) / 1440, s: Object.assign({}, curS(), { fmt: 'time' }) }]]); },
            fnDlg, showF: () => { showF = !showF; paint(); }, recalc: () => changed(),
            csvIn: () => { $('.cx-fopen').click(); }, csvOut, freeze: () => snapOp(() => { sh().freeze = sh().freeze ? 0 : 1; }), dedupe,
            zin: () => setZoom(zoom + 10), zout: () => setZoom(zoom - 10), z100: () => setZoom(100), lines: () => { body.querySelector('.tbx').classList.toggle('nolines'); reflect(); },
            save: () => save(), saveas: () => save(true), dl: download, print, close: () => API.closeWin(win),
        };
        body.addEventListener('mousedown', ev => { if (ev.target.closest('.wr-rib button, .wr-pop button, .cx-tabs button')) ev.preventDefault(); });
        body.addEventListener('click', ev => {
            const rt = ev.target.closest('[data-rt]'); if (rt) { if (rt.dataset.rt === 'file') return backstage('home'); body.querySelectorAll('[data-rt]').forEach(b => b.classList.toggle('on', b === rt)); body.querySelectorAll('[data-band]').forEach(b => { b.hidden = b.dataset.band !== rt.dataset.rt; }); return; }
            const dd = ev.target.closest('[data-dd]'); if (dd && !ev.target.closest('.wr-pop')) { if (!pop.hidden && pop.dataset.for === dd.dataset.dd) { pop.hidden = true; return; } pop.dataset.for = dd.dataset.dd; if (ed && !commit()) return; return DD[dd.dataset.dd](dd); }
            const c = ev.target.closest('[data-c]'); if (c && CMD[c.dataset.c]) { pop.hidden = true; if (ed && !['save', 'saveas'].includes(c.dataset.c) && !commit()) return; CMD[c.dataset.c](); if (!ed) kb.focus({ preventScroll: true }); return; }
            const au = ev.target.closest('[data-auto]'); if (au) { if (ed && !commit()) return; return autoSum(au.dataset.auto); }
            if (!ev.target.closest('.wr-pop')) pop.hidden = true;
        });
        $('.cx-fs').addEventListener('change', ev => { const v = +ev.target.value; styleSel(s => { s.fs = v === 11 ? undefined : v; }); kb.focus(); });
        $('.cx-nf').addEventListener('change', ev => { const v = ev.target.value; styleSel(s => { s.fmt = v === 'gen' ? undefined : v; delete s.dec; delete s.code; }); kb.focus(); });
        $('.wr-zr').addEventListener('input', ev => setZoom(+ev.target.value));
        function setZoom(z) { zoom = Math.max(50, Math.min(200, Math.round(z))); inner.style.zoom = zoom / 100; $('.wr-zr').value = zoom; $('.wr-zv').textContent = zoom + ' %'; paint(); }
        function reflect() {
            const s = curS(); const on = (c, v) => body.querySelectorAll(`[data-c="${c}"]`).forEach(b => b.classList.toggle('on', !!v));
            on('bold', s.b); on('italic', s.i); on('underline', s.u); on('al-l', s.al === 'l'); on('al-c', s.al === 'c'); on('al-r', s.al === 'r'); on('wrap', s.wrap); on('border', s.bd); on('f-cur', s.fmt === 'cur'); on('f-pct', s.fmt === 'pct');
            on('showF', showF); on('freeze', sh().freeze); on('lines', !body.querySelector('.tbx').classList.contains('nolines'));
            $('.cx-fs').value = String(s.fs || 11); $('.cx-nf').value = s.fmt || 'gen';
        }

        // ---------- Dialoge ----------
        function ask(t, v, ok) { return new Promise(res => { const bg = document.createElement('div'); bg.className = 'uidlg-bg'; bg.innerHTML = `<form class="uidlg" style="max-width:400px"><div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-pen"></i></span><span>${e(t)}</span></div><input class="xp-ask" value="${e(v || '')}"><div class="uidlg-a"><button type="button" data-r="0">Abbrechen</button><button type="submit" class="ok">${e(ok)}</button></div></form>`;
            const done = x => { bg.remove(); res(x); kb.focus(); }; bg.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); done(bg.querySelector('input').value.trim()); }); bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-r="0"]')) done(null); }); bg.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); done(null); } });
            document.body.appendChild(bg); const i = bg.querySelector('input'); i.focus(); i.select(); }); }
        async function find() {
            const q = await ask('Suchen', find.q || '', 'Weitersuchen'); if (!q) return; find.q = q; const ql = q.toLowerCase(), keys = [...sh().cells.keys()].map(k => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const hitK = keys.filter(([r, c]) => J.fmtVal(val(si, r, c), (sh().cells.get(r + ',' + c) || {}).s || {}).toLowerCase().includes(ql) || (sh().cells.get(r + ',' + c).f || '').toLowerCase().includes(ql));
            if (!hitK.length) return uiAlert(`„${q}“ wurde nicht gefunden.`);
            const nx = hitK.find(([r, c]) => r > sel.r || (r === sel.r && c > sel.c)) || hitK[0]; setSel(nx[0], nx[1]);
        }
        function fnDlg() {
            const bg = document.createElement('div'); bg.className = 'uidlg-bg';
            bg.innerHTML = `<div class="uidlg cx-fd"><div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-square-root-variable"></i></span><span>Funktion einfügen</span></div><input class="xp-ask cx-fq" placeholder="Funktion suchen, z. B. summe"><div class="cx-fdb"><nav>${FCAT.map(([n], i) => `<button type="button" data-cat="${i}" class="${i ? '' : 'on'}">${n}</button>`).join('')}</nav><div class="cx-fl"></div></div><div class="uidlg-a"><button type="button" data-r="0">Schließen</button></div></div>`;
            const list = names => bg.querySelector('.cx-fl').innerHTML = names.map(n => `<button type="button" data-ins="${n}"><b>${n}</b><small>${e(FHELP[n] || '')}</small></button>`).join('') || '<p class="wr-none">Nichts gefunden</p>';
            list(FCAT[0][1]);
            bg.addEventListener('click', ev => { const c = ev.target.closest('[data-cat]'); if (c) { bg.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('on', x === c)); list(FCAT[+c.dataset.cat][1]); }
                const i = ev.target.closest('[data-ins]'); if (i) { bg.remove(); if (!ed) startEdit('=' + i.dataset.ins + '('); else { const src = document.activeElement === fx ? fx : edEl; src.value += i.dataset.ins + '('; syncEd(src); src.focus(); } }
                if (ev.target === bg || ev.target.closest('[data-r="0"]')) bg.remove(); });
            bg.querySelector('.cx-fq').addEventListener('input', ev => { const q = ev.target.value.trim().toUpperCase(); list(q ? Object.values(J.DE).filter(n => J.FN[J.EN[n]] && (n.includes(q) || (FHELP[n] || '').toUpperCase().includes(q))).slice(0, 40) : FCAT[0][1]); });
            bg.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); bg.remove(); } });
            document.body.appendChild(bg); bg.querySelector('.cx-fq').focus();
        }
        async function dedupe() {
            let a = norm(); if (a.r1 === a.r2 && a.c1 === a.c2) a = region(); const seen = new Set(), keep = [], ch = []; let removed = 0;
            for (let r = a.r1; r <= a.r2; r++) { const k = range(a.c1, a.c2).map(c => JSON.stringify(val(si, r, c))).join('\u0001'); if (seen.has(k)) { removed++; continue; } seen.add(k); keep.push(r); }
            if (!removed) return uiAlert('Keine doppelten Zeilen gefunden.');
            if (!(await uiConfirm(`${removed} doppelte ${removed === 1 ? 'Zeile' : 'Zeilen'} im Bereich ${J.addr(a.r1, a.c1)}:${J.addr(a.r2, a.c2)} entfernen?`, { ok: 'Entfernen' }))) return;
            const rows = keep.map(r => range(a.c1, a.c2).map(c => sh().cells.get(r + ',' + c) || null));
            for (let r = a.r1; r <= a.r2; r++) for (let c = a.c1; c <= a.c2; c++) ch.push([si, r + ',' + c, null]);
            rows.forEach((row, i) => row.forEach((cell, j) => ch.push([si, (a.r1 + i) + ',' + (a.c1 + j), cell])));
            apply(ch);
        }

        // ---------- Speichern, Herunterladen, Drucken ----------
        const bytes = async () => new Uint8Array(await (await J.writeXlsx(Object.assign({}, book, { author: U.name || '' }), (i, r, c) => val(i, r, c))).arrayBuffer());
        async function save(as) {
            if (doc.saving) return; if (ed && !commit()) return;
            if (!window.JMOS_FILES || !can(U, 'dokumente')) return uiAlert('Zum Speichern brauchst du die Berechtigung „Dokumente“. Du kannst die Mappe aber herunterladen (Datei → Herunterladen).');
            if (!doc.key || as) {
                const r = await askSave(doc.name.replace(/\.csv$/i, '.xlsx'), doc.folder); if (!r) return;
                doc.saving = true; title();
                try { const key = await JMOS_FILES.createText(r.name, await bytes(), r.folder); try { localStorage.removeItem(DKEY()); } catch (x) {} doc.key = key; doc.name = r.name; doc.folder = r.folder; doc.saved = sig(); if (doc.key && window.JMOS_FILES && JMOS_FILES.touch) JMOS_FILES.touch(doc.key, doc.name); } catch (x) { uiAlert('Speichern fehlgeschlagen: ' + x.message); }
                doc.saving = false; title(); kb.focus(); return;
            }
            doc.saving = true; title();
            try { await JMOS_FILES.saveText(doc.key, await bytes()); doc.saved = sig(); if (doc.key && window.JMOS_FILES && JMOS_FILES.touch) JMOS_FILES.touch(doc.key, doc.name); try { localStorage.removeItem(DKEY()); } catch (x) {} } catch (x) { uiAlert('Speichern fehlgeschlagen: ' + x.message); }
            doc.saving = false; title();
        }
        function askSave(name, folder) {
            return new Promise(res => {
                const fs = window.JMOS_FILES ? JMOS_FILES.folders() : [], bg = document.createElement('div'); bg.className = 'uidlg-bg';
                bg.innerHTML = `<form class="uidlg" style="max-width:420px"><div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-floppy-disk"></i></span><span>Speichern unter</span></div><label class="ed-dl">Dateiname<input class="xp-ask" maxlength="120" value="${e(name)}"></label><label class="ed-dl">Ordner<select class="sh-sel">${[['', 'Eigene Dateien'], ...fs.map(f => [f.id, f.name])].map(([id, n]) => `<option value="${e(id)}" ${id === (folder || '') ? 'selected' : ''}>${e(n)}</option>`).join('')}</select></label><div class="uidlg-a"><button type="button" data-r="0">Abbrechen</button><button type="submit" class="ok">Speichern</button></div></form>`;
                const done = v => { bg.remove(); res(v); };
                bg.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); let n = bg.querySelector('input').value.trim().replace(/[\\/:*?"<>|]+/g, '_'); if (!n) return; if (!/\.xlsx$/i.test(n)) n = n.replace(/\.(xls|csv)$/i, '') + '.xlsx'; done({ name: n, folder: bg.querySelector('select').value }); });
                bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-r="0"]')) done(null); }); bg.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); done(null); } });
                document.body.appendChild(bg); const i = bg.querySelector('input'); i.focus(); i.setSelectionRange(0, Math.max(0, i.value.length - 5));
            });
        }
        const dlBlob = (b, n) => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: n }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
        async function download() { if (ed && !commit()) return; try { dlBlob(new Blob([await bytes()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), doc.name.replace(/\.csv$/i, '.xlsx')); } catch (x) { uiAlert(x.message); } }
        function csvOut() { const u = used(); const lines = []; for (let r = 0; r <= u.r2; r++) { const row = []; for (let c = 0; c <= u.c2; c++) { const cell = sh().cells.get(r + ',' + c); let t = cell ? J.fmtVal(val(si, r, c), Object.assign({}, cell.s, (cell.s || {}).fmt === 'cur' ? { fmt: 'num' } : {})).replace(/ €$/, '') : ''; if (typeof val(si, r, c) === 'number' && !(cell.s && /date|time/.test(cell.s.fmt || ''))) t = J.fmtGen(val(si, r, c)); row.push(/[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t); } lines.push(row.join(';')); }
            dlBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), doc.name.replace(/\.(xlsx|csv)$/i, '') + (book.sheets.length > 1 ? ' – ' + sh().name : '') + '.csv'); }
        function print() {
            const u = used(); if (u.r2 < 0) return uiAlert('Das Blatt ist leer.'); const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px'; document.body.appendChild(f);
            let t = '<table>'; for (let r = 0; r <= u.r2; r++) { t += '<tr>'; for (let c = 0; c <= u.c2; c++) { const cell = sh().cells.get(r + ',' + c), s = cell && cell.s || {}, v = cell ? val(si, r, c) : '';
                const st = [s.b ? 'font-weight:700' : '', s.i ? 'font-style:italic' : '', s.u ? 'text-decoration:underline' : '', s.color ? 'color:#' + s.color : '', s.fill ? 'background:#' + s.fill : '', s.bd ? 'border:1px solid #000' : '', 'text-align:' + ({ l: 'left', c: 'center', r: 'right' }[s.al] || (typeof v === 'number' ? 'right' : 'left')), 'width:' + width(c) + 'px'].filter(Boolean).join(';');
                t += `<td style="${st}">${cell ? e(J.fmtVal(v, s)) : ''}</td>`; } t += '</tr>'; } t += '</table>';
            f.contentDocument.open(); f.contentDocument.write(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${e(doc.name)} – ${e(sh().name)}</title><style>@page{size:A4 ${u.c2 > 7 ? 'landscape' : 'portrait'};margin:15mm} body{font:10pt Calibri,Carlito,Arial,sans-serif;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact} table{border-collapse:collapse;table-layout:fixed} td{padding:2px 5px;border:1px solid #e5e7eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px}</style></head><body>${t}</body></html>`); f.contentDocument.close();
            setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (x) { uiAlert(x.message); } setTimeout(() => f.remove(), 60000); }, 300);
        }

        // ---------- Datei-Menü ----------
        const back = $('.wr-back');
        function backstage(tab) {
            if (ed && !commit()) return;
            const files = window.JMOS_FILES ? JMOS_FILES.sheetFiles().sort((a, b) => (b.date || 0) - (a.date || 0)) : [], fold = Object.fromEntries((window.JMOS_FILES ? JMOS_FILES.folders() : []).map(f => [f.id, f.name]));
            const NAV = [['home', 'fa-house', 'Start'], ['new', 'fa-file-circle-plus', 'Neu'], ['open', 'fa-folder-open', 'Öffnen'], null, ['save', 'fa-floppy-disk', 'Speichern'], ['saveas', 'fa-file-export', 'Speichern unter'], ['dl', 'fa-download', 'Herunterladen (.xlsx)'], ['csvOut', 'fa-file-csv', 'Als CSV herunterladen'], ['print', 'fa-print', 'Drucken / PDF'], null, ['close', 'fa-xmark', 'Schließen']];
            const tpl = Object.entries(TPL).map(([k, t]) => `<button type="button" class="wr-tpl" data-tpl="${k}"><span class="wr-tpi cx-tpi"><i class="fa-solid ${t.i}"></i></span><b>${e(t.n)}</b></button>`).join('');
            const rows = l => l.map(it => `<button type="button" class="wr-fr" data-open="${e(it.key)}"><i class="fa-solid ${/\.csv$/i.test(it.name) ? 'fa-file-csv' : 'fa-file-excel'} cx-fi"></i><span><b>${e(it.name)}</b><small>${e(it.folder ? fold[it.folder] || 'Ordner' : 'Eigene Dateien')}</small></span><small>${it.date ? new Date(it.date).toLocaleDateString('de-DE') : ''}</small></button>`).join('') || '<p class="wr-none">Noch keine Tabellen in deinen Dokumenten.</p>';
            const main = tab === 'new' ? `<h2>Neu</h2><div class="wr-tpls">${tpl}</div>` : tab === 'open' ? `<h2>Öffnen</h2><button type="button" class="btn" data-bs="pc"><i class="fa-solid fa-laptop"></i>Vom Computer öffnen (.xlsx, .csv)</button><div class="wr-frs">${rows(files)}</div>`
                : `<h2>${new Date().getHours() < 11 ? 'Guten Morgen' : new Date().getHours() < 18 ? 'Hallo' : 'Guten Abend'}${U.firstName ? ', ' + e(U.firstName) : ''}</h2><div class="wr-tpls">${tpl}</div><h3>Zuletzt bearbeitet</h3><div class="wr-frs">${rows(files.slice(0, 8))}</div>`;
            back.innerHTML = `<nav class="cx-nav"><button type="button" class="wr-bk" data-bs="back" aria-label="Zurück"><i class="fa-solid fa-arrow-left"></i></button>${NAV.map(n => n ? `<button type="button" data-bs="${n[0]}" class="${n[0] === tab ? 'on' : ''}"><i class="fa-solid ${n[1]}"></i>${n[2]}</button>` : '<hr>').join('')}</nav><section>${main}</section>`; back.hidden = false;
        }
        const backClose = () => { back.hidden = true; kb.focus(); };
        const isEmpty = () => book.sheets.length === 1 && !book.sheets[0].cells.size;
        back.addEventListener('click', ev => {
            const b = ev.target.closest('[data-bs]'), t = ev.target.closest('[data-tpl]'), o = ev.target.closest('[data-open]');
            if (t) { if (doc.key || !isEmpty()) { backClose(); return create(doc.folder, t.dataset.tpl); } loadBook(TPL[t.dataset.tpl].make()); doc.name = t.dataset.tpl === 'leer' ? 'Mappe1.xlsx' : TPL[t.dataset.tpl].n + '.xlsx'; doc.saved = sig(); if (doc.key && window.JMOS_FILES && JMOS_FILES.touch) JMOS_FILES.touch(doc.key, doc.name); title(); return backClose(); }
            if (o) { backClose(); if (o.dataset.open === doc.key) return; if (!doc.key && isEmpty()) { doc.key = o.dataset.open; return loadFile(); } return open(o.dataset.open); }
            if (!b) return; const k = b.dataset.bs; if (k === 'back') return backClose(); if (k === 'home' || k === 'new' || k === 'open') return backstage(k); if (k === 'pc') return $('.cx-fopen').click();
            backClose(); if (CMD[k]) CMD[k]();
        });
        $('.cx-fopen').addEventListener('change', async ev => { const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
            try { const b = /\.csv$/i.test(f.name) ? J.readCsv(await f.text()) : await J.readXlsx(await f.arrayBuffer()); if (doc.key || !isEmpty()) { if (!(await uiConfirm('Die geöffnete Datei ersetzt den Inhalt dieses Fensters. Weiter?', { ok: 'Öffnen' }))) return; } loadBook(b); doc.key = null; doc.name = f.name.replace(/\.(csv|xlsx)$/i, '') + '.xlsx'; doc.saved = ''; title(); backClose(); } catch (x) { uiAlert('Datei nicht lesbar: ' + x.message); } });

        function loadBook(b) { book = b; book.sheets.forEach(s => { s.cols = s.cols || {}; }); si = 0; sel = { r: 0, c: 0, r2: 0, c2: 0 }; NR = 200; hist.st = []; hist.i = -1; dirtyCalc(); measure(); tabs(); paint(); }
        async function loadFile() {
            $('.cx-mode').textContent = 'Wird geladen …';
            try { const { blob, name } = await JMOS_FILES.blobOf(doc.key); const it = JMOS_FILES.item(doc.key); doc.name = name; doc.folder = it ? it.folder || '' : '';
                const b = /\.csv$/i.test(name) ? J.readCsv(await blob.text()) : await J.readXlsx(await blob.arrayBuffer()); loadBook(b); doc.saved = /\.csv$/i.test(name) ? '' : sig();
                if (/\.csv$/i.test(name)) { doc.key = null; doc.name = name.replace(/\.csv$/i, '.xlsx'); }
                let d = null; try { d = JSON.parse(localStorage.getItem(DKEY()) || 'null'); } catch (x) {}
                if (d && d.b && await uiConfirm(`Für „${name}“ gibt es ungespeicherte Änderungen vom ${new Date(d.t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}. Wiederherstellen?`, { ok: 'Wiederherstellen', title: 'Tabellen' })) loadBook(deser(d.b)); else if (d) { try { localStorage.removeItem(DKEY()); } catch (x) {} }
            } catch (x) { uiAlert('Die Datei lässt sich nicht öffnen: ' + x.message); doc.key = null; }
            $('.cx-mode').textContent = 'Bereit'; title();
        }
        win.beforeClose = () => dirty() && (doc.key || !isEmpty()) ? `„${doc.name}“ hat ungespeicherte Änderungen. Trotzdem schließen?` : '';
        win.onClose = () => { clearTimeout(tDraft); try { localStorage.removeItem(DKEY()); } catch (x) {} };
        win.onParams = p => { if (p && p.open && p.open !== doc.key) open(p.open); };
        body.addEventListener('keydown', ev => { const k = ev.key.toLowerCase(), c = ev.ctrlKey || ev.metaKey;
            if (c && k === 's') { ev.preventDefault(); ev.stopPropagation(); if (!ed || commit()) save(ev.shiftKey); } else if (c && k === 'p') { ev.preventDefault(); print(); } else if (c && k === 'o') { ev.preventDefault(); backstage('open'); } else if (c && k === 'f' && !ed) { ev.preventDefault(); ev.stopPropagation(); find(); }
            else if (k === 'escape' && !back.hidden) { ev.stopPropagation(); backClose(); } else if (k === 'escape' && !pop.hidden) pop.hidden = true; });
        new ResizeObserver(paint).observe(grid);

        if (doc.key) { measure(); tabs(); paint(); loadFile(); }
        else { const t = TPL[P.tpl] || TPL.leer; loadBook(t.make()); doc.name = P.tpl && P.tpl !== 'leer' ? t.n + '.xlsx' : 'Mappe1.xlsx'; doc.saved = sig(); if (doc.key && window.JMOS_FILES && JMOS_FILES.touch) JMOS_FILES.touch(doc.key, doc.name); if (!P.tpl) backstage('home'); title(); }
        setTimeout(() => { if (back.hidden) kb.focus({ preventScroll: true }); }, 80);
    }

    // wird von OS/office.js erst beim ersten Öffnen nachgeladen (schnellerer Start)
    const mod = { ui, init(api, user) { API = api; U = user; e = api.esc; } };
    if (window.JMOS_LAZY) JMOS_LAZY.register('tabellen', mod);
    else { window.JMOS_CALC = { open, create }; (window.JMOS_EXT = window.JMOS_EXT || []).push({ apps: [{ id: 'tabellen', name: 'Tabellen', icon: 'fa-table-cells', c: '#1e8e4e', native: 'tabellen', w: 1160, h: 760 }], ui: { tabellen: ui }, init: mod.init }); }
})();
