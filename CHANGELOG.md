# Changelog

Alle Änderungen am J.Mainz Dashboard, die neuesten oben.

## 26.11.2026 (3)

### Desktop-Modus: Präsentation – eigenes Präsentationsprogramm (wie PowerPoint)
- Neue App „Präsentation“ im Startmenü: speichert echte PowerPoint-Dateien (.pptx) in den Dokumenten, die sich auch mit PowerPoint oder LibreOffice öffnen lassen. Vorhandene .pptx-Dateien lassen sich öffnen und bearbeiten (Doppelklick im Explorer) – auch solche mit Platzhaltern aus Folienmastern, Gruppen und 4:3-Format.
- Folienleiste links mit Vorschaubildern: Folien anklicken, per Ziehen umsortieren, Rechtsklick für Neu/Duplizieren/Löschen.
- Bearbeiten wie in PowerPoint: Objekte anklicken, verschieben (mit Hilfslinien zum Ausrichten), an den Griffen größer ziehen (Umschalt hält das Seitenverhältnis), drehen; Doppelklick zum Schreiben; Entf löscht, Pfeiltasten verschieben, Strg+C/V/D kopieren und duplizieren, Strg+Z/Y.
- Menüband: Start (Neue Folie mit 7 Layouts, Layout ändern, Schriftart, Größe, fett/kursiv/unterstrichen, Farbe, Aufzählung, Nummerierung, Ebenen, Ausrichtung, Textfeld, Formen, Füllung, Kontur, Vorder-/Hintergrund, an der Folie ausrichten), Einfügen (Bilder vom Computer oder aus den Dokumenten, Formen, Textfeld, Datum, Foliennummern), Entwurf (8 Designs, Hintergrundfarbe oder -bild, für alle übernehmen), Übergänge (Verblassen, Schieben, Wischen, Aufdecken, Zoom), Bildschirmpräsentation.
- Bildschirmpräsentation im Vollbild (F5 oder Umschalt+F5 ab aktueller Folie), weiter mit Klick, Leertaste oder Pfeiltasten, Esc zum Beenden.
- Datei-Menü mit Vorlagen (Leere Präsentation, Referat, Urlaubsrückblick, Geburtstag, Familien-Info, Weltall), Öffnen, Speichern, Speichern unter, Herunterladen (.pptx) und Als PDF/Drucken. Ungespeicherte Änderungen werden zwischengespeichert und beim Schließen abgefragt.
- „Neue Präsentation“ per Rechtsklick auf den Desktop oder im Explorer.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/os-icons.css, OS/explorer.js, OS/pptx.js (neu), OS/slides.js (neu)
- Firestore-Regeln: keine Änderung.

## 26.11.2026 (2)

### Desktop-Modus: Tabellen – eigene Tabellenkalkulation (wie Excel)
- Neue App „Tabellen“ im Startmenü: speichert echte Excel-Dateien (.xlsx) in den Dokumenten, die sich auch mit Excel oder LibreOffice öffnen lassen. Vorhandene .xlsx- und .csv-Dateien lassen sich öffnen und bearbeiten (Doppelklick im Explorer); Formate wie Datum, Uhrzeit, Währung und eigene Formate (z. B. „Do, 01“) bleiben erhalten.
- Formeln auf Deutsch wie in Excel: =SUMME(A1:A5), =WENN(A1>5;"ja";"nein"), =SVERWEIS(…), Bezüge auf andere Blätter (=Tabelle2!B3). Über 80 Funktionen (Summe, Mittelwert, Anzahl, Min/Max, Runden, Wenn, Und/Oder, SummeWenn, ZählenWenn, SVerweis, Index/Vergleich, Datum, Heute, Text, Links/Rechts/Teil …). Beim Tippen erscheinen Vorschläge mit Erklärung; Zellen per Klick in die Formel übernehmen; Fehler wie #DIV/0! und Zirkelbezüge werden angezeigt.
- Menüband: Start (Zwischenablage, fett/kursiv/unterstrichen, Schriftgröße, Rahmen, Füll- und Schriftfarbe, Ausrichtung, Umbruch, Zahlenformate Standard/Zahl/Währung/Prozent/Datum/Uhrzeit, Dezimalstellen, Zeilen/Spalten einfügen und löschen, AutoSumme, Sortieren, Ausfüllen, Suchen), Einfügen, Formeln (Funktion einfügen, Summe/Mittelwert/Anzahl/Max/Min, Formeln anzeigen), Daten (Sortieren, CSV öffnen/herunterladen, erste Zeile fixieren, Duplikate entfernen), Ansicht (Zoom, Gitternetzlinien).
- Bedienung wie Excel: Pfeiltasten, Enter/Tab, Umschalt zum Markieren, Strg+Pfeil springt an Datenränder, F2 oder Doppelklick zum Bearbeiten, Strg+C/X/V (auch mit Excel), Strg+Z/Y, Strg+D, Alt+= für AutoSumme, Ausfüllkästchen zum Ziehen (Formeln und Zahlenreihen), Spaltenbreite ziehen oder per Doppelklick anpassen, Rechtsklick-Menü.
- Mehrere Blätter (hinzufügen, umbenennen, kopieren, verschieben, löschen); Statusleiste mit Summe, Mittelwert und Anzahl der Auswahl.
- Datei-Menü mit Vorlagen (Leere Mappe, Haushaltsbuch, Einkaufsliste, Kosten teilen), Öffnen, Speichern, Speichern unter, Herunterladen (.xlsx/.csv) und Drucken/PDF. Ungespeicherte Änderungen werden zwischengespeichert und beim Schließen abgefragt.
- „Neue Tabelle“ per Rechtsklick auf den Desktop oder im Explorer.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/os-icons.css, OS/explorer.js, OS/sheetcore.js (neu), OS/calc.js (neu)
- Firestore-Regeln: keine Änderung.

## 26.11.2026 (1)

### Desktop-Modus: Writer – eigene Textverarbeitung (wie Word)
- Neue App „Writer“ im Startmenü: schreibt und speichert echte Word-Dateien (.docx) in den Dokumenten. Die Dateien lassen sich auch mit Microsoft Word oder LibreOffice öffnen, und vorhandene .docx-Dateien lassen sich im Writer bearbeiten (Doppelklick im Explorer).
- Menüband wie bei Word:
  - Start: Einfügen/Ausschneiden/Kopieren, Rückgängig/Wiederholen, Schriftart und -größe, fett, kursiv, unterstrichen, durchgestrichen, hoch-/tiefgestellt, Schriftfarbe, Hervorheben, Formatierung löschen, Aufzählung, Nummerierung, Einzug, Ausrichtung, Zeilenabstand, Formatvorlagen (Standard, Titel, Untertitel, Überschrift 1–3, Zitat), Suchen und Ersetzen.
  - Einfügen: Seitenumbruch, Tabelle (Raster zum Aufziehen), Bild vom Computer oder aus den Dokumenten, Link, Linie, Datum, Sonderzeichen, Kopf- und Fußzeile, Seitenzahlen.
  - Layout: Seitenränder (Normal, Schmal, Mittel, Breit, DIN 5008), Hoch- und Querformat, Kopf- und Fußzeile, Zeilenabstand, Einzug.
  - Ansicht: Zoom, Seitenbreite, Fokusmodus, Formatierungszeichen, Wörter zählen.
- Datei-Menü: Startseite mit Vorlagen (Leeres Dokument, Brief, Protokoll, Einladung, Lebenslauf) und zuletzt bearbeiteten Dokumenten, Öffnen (auch vom Computer), Speichern, Speichern unter (mit Ordnerwahl), Herunterladen als .docx, Drucken bzw. als PDF speichern.
- A4-Blatt mit Seitenrändern und Seitenlinien, Kopf- und Fußzeile direkt auf dem Blatt bearbeitbar, Seitenanzeige und Wortzahl in der Statusleiste.
- Tabellen per Rechtsklick bearbeiten (Zeilen/Spalten einfügen und löschen, Kopfzeile, Zellen einfärben), mit Tab von Zelle zu Zelle. Bilder anklicken: Größe 25–100 %, Ausrichtung, löschen oder an der Ecke größer ziehen. Bilder werden beim Einfügen verkleinert, damit Dokumente unter 3 MB bleiben.
- Eingefügter Text aus Webseiten oder Word wird bereinigt. Ungespeicherte Änderungen werden im Browser zwischengespeichert und beim nächsten Öffnen angeboten; beim Schließen fragt der Writer nach.
- „Neues Word-Dokument“ per Rechtsklick auf den Desktop oder im Explorer.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/os-icons.css, OS/explorer.js, OS/docx.js (neu), OS/writer.js (neu)
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (21)

### Desktop-Modus: Symbole entfernen, Ordner auf dem Desktop
- Apps lassen sich vom Desktop entfernen: Rechtsklick → „Vom Desktop entfernen“ oder Symbol markieren und Entf drücken (auch mehrere markierte auf einmal). Die App bleibt im Startmenü; dort per Rechtsklick „Auf dem Desktop anzeigen“ holt sie zurück. Unter Einstellungen → System → Desktop stehen alle ausgeblendeten Symbole mit „Alle wieder anzeigen“.
- Ordner auf dem Desktop: Rechtsklick auf den Desktop → „Neuer Ordner“. Der Ordner ist ein normaler Ordner in „Eigene Dateien“ und öffnet sich per Doppelklick im Explorer. Dateien vom Desktop auf den Ordner ziehen verschiebt sie hinein; Dateien vom Computer oder aus dem Explorer auf den Ordner ziehen lädt bzw. verschiebt sie direkt dorthin. Rechtsklick auf den Ordner: Öffnen, Dateien hineinladen, Umbenennen, Vom Desktop entfernen, Löschen.
- Im Explorer kann jeder Ordner per Rechtsklick „Auf den Desktop gelegt“ werden.
- Fehler behoben: Ein Rechtsklick auf ein Desktop-Symbol hat alle anderen Symbole mit markiert.
- Geänderte Dateien: OS/os.js, OS/os.css, OS/os-icons.css, OS/explorer.js, OS/shell.js, OS/setwin.js
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (20)

### Desktop-Modus: ZIP im Explorer, Texteditor, Task-Manager
- Explorer – mehrere Dateien auswählen: Strg+Klick einzeln, Umschalt+Klick für einen Bereich, Strg+A für alle. Mehrere auf einmal herunterladen (als ZIP), verschieben oder in den Papierkorb legen.
- Explorer – ZIP: Neuer Knopf „ZIP“ lädt die Auswahl als ZIP-Datei herunter (auch ganze Ordner per Rechtsklick). „ZIP-Datei hier erstellen“ speichert das Archiv direkt in den Dokumenten (bis 3 MB). Rechtsklick auf eine ZIP-Datei → „Entpacken …“ legt alle passenden Dateien in einen neuen Ordner. Die Vorschau und die Schnellvorschau (Leertaste) zeigen den Inhalt eines Archivs; in der Vorschau lässt sich jede Datei einzeln herunterladen.
- Neue App „Texteditor“: öffnet .txt-, .md-, .json-, .log- und .csv-Dateien aus dem Explorer (Doppelklick auf Textdateien), speichert sie zurück (Strg+S) oder als neue Datei in einen Ordner (Strg+Umschalt+S). Mehrere Dateien als Tabs, Suchen und Ersetzen (Strg+F), Zeilenumbruch, Schriftgröße, Markdown-Vorschau, Zeile/Spalte und Wörter in der Statusleiste. Ungespeicherte Änderungen bleiben auch nach dem Neuladen erhalten und werden beim Schließen abgefragt. „Neues Textdokument“ per Rechtsklick auf den Desktop oder im Explorer.
- .md-, .json- und .log-Dateien können jetzt hochgeladen werden.
- Neue App „Task-Manager“ (Alt+Entf, Startmenü oder Rechtsklick auf die freie Taskleiste): Prozesse mit allen Fenstern (Status, Elemente, Ladezeit, geladene Daten; wechseln, neu laden, beenden) und den Diensten des Desktops; Leistung mit Bildrate, Arbeitsspeicher (Chrome/Edge), Elementen und Netzwerk als Verlauf, dazu Gerätedaten und Leistungsmodus; Speicher mit belegtem Platz nach Dateiart und den größten Dateien; Benutzer mit Online-Status. Optional eine kleine FPS-Anzeige oben rechts.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/os-icons.css, OS/explorer.js, OS/more.js, OS/zip.js (neu), OS/editor.js (neu), OS/taskman.js (neu)
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (19)

### Desktop-Modus: Leistungsmodus (automatisch in Firefox)
- Neuer Leistungsmodus unter Einstellungen → System → Bildschirm: Automatisch, An oder Aus (gilt nur für das jeweilige Gerät). „Automatisch“ schaltet ihn in Firefox ein, weil Firefox die Glas-Unschärfe über dem bewegten Sternenhimmel bei jedem Bild neu berechnen muss.
- Im Leistungsmodus: keine Glas-Unschärfe (Taskleiste, Widgets, Menüs bekommen dafür dichtere Flächen), Sternenhimmel ohne Funkeln, Sternschnuppen, Wetter und Schnee mit 30 statt 60 Bildern pro Sekunde, keine funkelnden Sterne in den App-Fenstern, Astro ohne weichen Schatten.
- Allgemein: Ist gerade keine Sternschnuppe und kein Wetter zu sehen, wird der Himmel gar nicht mehr neu gezeichnet.
- Geänderte Dateien: OS/os.js, OS/os.css, OS/live.js, OS/season.js, OS/setwin.js
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (18)

### Desktop-Modus: Fenster verschieben ohne Ruckeln (vor allem in Firefox)
- Fenster werden beim Ziehen nur noch verschoben statt bei jeder Mausbewegung neu aufgebaut, höchstens einmal pro Bild. Größe ändern genauso.
- Sternenhimmel, Sternschnuppen, Wetter und Schnee pausieren, solange ein Fenster gezogen wird. Das Funkeln der Sterne wird außerdem seltener neu gezeichnet (spart auch im Ruhezustand Leistung, sieht gleich aus).
- In Firefox ist die Glas-Unschärfe während des Ziehens kurz aus.
- Geänderte Dateien: OS/os.js, OS/os.css, OS/live.js, OS/season.js
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (17)

### Finanzen: neue Kategorien, eigene Bezeichnungen, Sparziele und Schulden
- Neue Kategorien: Einnahmen (Einnahmen, Sonstige Einnahmen) und Ausgaben (Wohnen, Versicherungen, Abos, Gesundheit, Auto, Lebensmittel, Freizeit, Gastro, Sparen / Rücklagen, Schulden / Rückzahlungen, Sonstiges). Die Auswahl passt sich an, je nachdem ob Einnahme oder Ausgabe. Alte Buchungen, Fixkosten, Budgets und Rechnungen werden beim Laden automatisch auf die neuen Kategorien umgestellt.
- Eigene Bezeichnung pro Buchung (z. B. „Wocheneinkauf Aldi“), mit Vorschlägen aus früheren Bezeichnungen.
- Budgets für jede Ausgaben-Kategorie.
- Neuer Reiter „Sparen & Schulden“: Sparziele (Sparglas) mit Titel, Zielbetrag, schon gespartem Betrag und eigenem Bild oder Planeten-Bild als Platzhalter; Fortschritt in Prozent. Schulden mit Name (wem), Gesamtbetrag, monatlicher Rate und Notiz; zeigt, was noch offen ist.
- Buchungen und Fixkosten mit der Kategorie „Sparen / Rücklagen“ oder „Schulden / Rückzahlungen“ lassen sich einem Sparglas bzw. einer Schuld zuordnen und zählen dort automatisch mit. „Einzahlen“ bzw. „Rate zahlen“ direkt am Sparglas oder an der Schuld.
- In der Übersicht neue Kachel „Sparen & Schulden pro Monat“ neben den Fixkosten (Sparen +X / Schulden −Y).
- Geänderte Dateien: finanzen.html, js/pages/finanzen.js, assets/icons.css
- Firestore-Regeln: neue Blöcke `finance_goals` (Sparziele) und `finance_debts` (Schulden).

## 25.11.2026 (16)

### Zeiterfassung: eigene Arbeitstage und Sollstunden, Bundesland, Stundenzettel aus der Firmen-Vorlage
- Arbeitstage und Sollstunden pro Wochentag (z. B. nur Mo, Mi, Fr mit je 7 Stunden). Tage mit 0 Stunden sind frei: kein Soll, Urlaub zählt dort nicht. Schnellwahl „Mo–Fr 8 Std“, „Mo–Do 8 Std“, „Mo, Mi, Fr 7 Std“. Die Startseite und der Desktop-Modus rechnen genauso.
- Feiertage nach dem eigenen Bundesland statt fest NRW (gleiche Einstellung wie im Kalender).
- Stundenzettel: die Excel-Vorlage der Firma (.xlsx) einmal hochladen, das Dashboard erkennt die Felder aus den Überschriften (Name, Monat, Beginn, Pause, Ende, Kürzel, Aufgezeichnet am, Bemerkung) und lässt sie per Klick korrigieren. Danach erstellt ein Klick den ausgefüllten Zettel für einen Monat als Excel-Datei; Formeln der Vorlage (z. B. Dauer und Summe) rechnen beim Öffnen neu. Krank, Urlaub und Feiertage bekommen ihre Kürzel (einstellbar).
- Geänderte Dateien: js/calendar-core.js, js/pages/zeiterfassung.js, zeiterfassung.html, js/timesheet.js (neu), js/pages/menu.js, OS/widgets.js, assets/icons.css
- Firestore-Regeln: neuer Block `timesheet_tpl` (Stundenzettel-Vorlage).

## 25.11.2026 (15)

### Kalender: Feiertage & Ferien, mehrere Wochentage, Ort & Notizen, Erinnerungen, Teilen mit Personen, gemeinsame Kalender, Einladungen, Anhänge
- Feiertage und Schulferien je Bundesland im Kalender (Woche, Monat, Liste, Wandkalender), einzeln ein- und ausschaltbar über das Zahnrad im Kalender. Feiertage werden für alle 16 Bundesländer berechnet, Schulferien kommen von der OpenHolidays-API und werden im Browser zwischengespeichert.
- Wiederholung „wöchentlich an mehreren Tagen“, z. B. Mo, Di und Sa in einer einzigen Serie (auch alle 2 Wochen).
- Ort und Notizen zum Termin; der Ort steht auch in der Terminliste.
- Erinnerungen: Standard-Erinnerung in den Kalender-Einstellungen (z. B. 1 Stunde vorher), pro Termin änderbar oder abschaltbar. Erinnerungen erscheinen auf jeder Seite des Dashboards und im Desktop-Modus (dort auch von Astro angesagt), auf Wunsch zusätzlich als Mitteilung des Browsers. Ganztägige Termine erinnern nur, wenn es im Termin eingestellt ist.
- Sichtbar für: Nur ich, Alle, ausgewählte Personen oder einen gemeinsamen Kalender.
- Einladungen: Eingeladene sehen oben im Kalender „Neue Einladung“ und können zu- oder absagen; abgesagte Termine werden ausgeblendet. Der Besitzer sieht im Termin, wer zugesagt hat.
- Gemeinsame Kalender (z. B. Familie, Partner, WG) mit Name, Farbe und Mitgliedern; Termine darin sehen alle Mitglieder automatisch. Mitglieder können austreten, der Besitzer kann Mitglieder ändern (die Termine werden angepasst).
- Anhänge an Terminen (Tickets, PDFs, Fotos, je bis 3 MB); sehen und herunterladen kann sie jeder, der den Termin sieht.
- Die Suche, der Wandkalender und der Desktop-Modus zeigen geteilte Termine ebenfalls.
- Geänderte Dateien: js/calendar-core.js, js/cal-remind.js (neu), js/firebase-init.js, js/pages/menu.js, menu.html, js/pages/wand.js, js/search.js, OS/widgets.js, OS/tools.js, assets/icons.css
- Firestore-Regeln: geändert – Block `events` (Teilen, Zusagen, Anhänge) und neuer Block `calendars`.

## 25.11.2026 (14)

### Heller Modus: mehr Kontrast, lesbare Pinnwand
- Graue Schrift ist im hellen Modus deutlich dunkler (dunkelgrau bis fast schwarz), Umrandungen von Karten, Feldern und Listen sind kräftiger. Das gilt für alle Seiten mit hellem Design, auch für Texte, die bisher noch die hellen Farben des dunklen Designs hatten (z. B. Zeiten in „Tage im Monat“, Kalenderzeiten, Hinweise).
- Pinnwand: Zettel in kräftigem Gelb mit dunkelbrauner Schrift statt Gelb auf Gelb.
- Geänderte Dateien: assets/light.css
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (13)

### J.Mainz OS: Einstellungen wie bei Windows 11
- Die Einstellungen sind komplett neu aufgebaut: links Konto, Suchfeld und Kategorien (Startseite, System, Personalisierung, Taskleiste & Start, Astro, Konto, Datenschutz & Sicherheit, Info), rechts die jeweilige Seite mit Überschrift, gruppierten Einträgen und Symbolen.
- Startseite mit Vorschau des Desktops und empfohlenen Einstellungen; ein Klick springt direkt zur passenden Stelle.
- Personalisierung mit Live-Vorschau (Hintergrund, Akzentfarbe, Taskleiste), Konto mit Profilkarte, Info mit Stand des letzten Updates.
- Neu: Profil bearbeiten und Abmelden unter „Konto“; Zwischenablage-Verlauf an/aus, Zwischenablage leeren, „Zuletzt geöffnet“ leeren und geplante Erinnerungen löschen unter „Datenschutz & Sicherheit“; Tastenkürzel, Changelog und Neu laden unter „Info“.
- Suche über alle Einstellungen. Das Fenster ist größer; schmal (z. B. halbe Bildschirmbreite) wandert die Navigation nach oben.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/os-icons.css, OS/live.js, OS/social.js, OS/season.js, OS/setwin.js (neu)
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (12)

### J.Mainz OS: Jahreszeiten-Themen und Astro ausgebaut
- Jahreszeiten-Themen (automatisch, in den Einstellungen unter „Jahreszeiten & Astro“ abschaltbar oder als Vorschau wählbar):
  - Weihnachten (1.–26.12.): leiser Schneefall, Lichterkette über der Taskleiste, leicht roter Schimmer.
  - Silvester (31.12. ab mittags und 1.1.): Feuerwerk, ab 23 Uhr dichter, Countdown der letzten 10 Sekunden und „Frohes neues Jahr“ um Mitternacht.
  - Ostern (Gründonnerstag bis Ostermontag): fünf versteckte Ostereier auf dem Desktop zum Finden, mit Konfetti.
  - Halloween (24.–31.10.): Fledermäuse flattern über den Bildschirm, orange-violetter Schimmer.
- Astro bekommt Outfits: passend zur Jahreszeit (Weihnachtsmütze, Partyhut, Hasenohren, Hexenhut) oder fest gewählt (Krone, Cap, Sonnenbrille, Kopfhörer …) – per Rechtsklick auf Astro „Outfit wählen …“ oder in den Einstellungen.
- Astro sagt fällige Erinnerungen und neue Nachrichten in seiner Sprechblase an (abschaltbar).
- Minispiel „Sterne sammeln“: Astro mit der Maus steuern und in 30 Sekunden Sterne einsammeln (goldene +5, Meteore −3), mit Bestwert. Start per Rechtsklick auf Astro, in den Einstellungen oder über die Suche.
- Geänderte Dateien: OS/index.html, OS/os.css, OS/os-icons.css, OS/live.js, OS/season.js (neu)
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (11)

### J.Mainz OS: Mein Tag, Dateien per Chat, Bildschirmfoto, Admin-Konsole
- Widget „Mein Tag“: Begrüßung, heute gearbeitete Stunden (mit „läuft“, wenn eingestempelt), Termine heute mit dem nächsten, fällige und überfällige Rechnungen der Woche mit Summe, offene Aufgaben und Einkäufe. In groß zusätzlich die Termine des Tages. Klick auf eine Zeile öffnet den Bereich.
- Dateien per Chat: Eine Datei aus dem Explorer ziehen, dann erscheinen rechts die letzten Chats als Blasen; auf eine Person fallen lassen, und die Datei wird gesendet. Auch auf das offene Chatfenster oder vom Computer. Alternativ per Rechtsklick „Per Chat senden …“ (Explorer und Desktop). Bilder werden wie gewohnt verkleinert, andere Dateien gehen bis 500 KB.
- Messenger: zeigt Dateianhänge als Karte zum Herunterladen (auch auf dem Handy). Beim Löschen einer Nachricht wird der Anhang mit entfernt.
- Bildschirmfoto (Alt+Umschalt+S, Startmenü oder Suche): Der Browser fragt einmal nach dem Tab, dann einen Bereich aufziehen oder „Ganzer Bildschirm“. Danach: in Dokumente speichern, kopieren, per Chat senden oder herunterladen.
- Admin-Konsole (nur Admins, im Startmenü): Befehle wie `wartung an finanzen`, `wartung aus alle`, `nutzer`, `nutzer <name>`, `online`, `öffne <app>`, `cache leeren`, `version`. Mit Verlauf (Pfeil hoch/runter) und Tab-Vervollständigung. Wartungs-Änderungen landen wie im Admin-Menü im Protokoll.
- Geänderte Dateien: OS/index.html, OS/os.css, OS/os-icons.css, OS/explorer.js, OS/social.js, OS/tools.js (neu), js/messenger-core.js, js/pages/messenger.js, messenger.html, assets/icons.css
- Firestore-Regeln: geändert – Nachrichten dürfen einen Dateianhang `file` enthalten (Block `match /messages/{mid}`).

## 25.11.2026 (10)

### J.Mainz OS: Snap-Layouts, Fenster mit Tabs, Schnellvorschau, Tastenkürzel, Offline-Anzeige
- Snap-Layouts: Maus kurz über den Maximieren-Knopf halten, dann erscheinen sechs Layouts (halb/halb, zwei Drittel/ein Drittel, drei Spalten, links groß mit zwei rechts, vier Ecken). Klick auf ein Feld ordnet das Fenster dort ein.
- Fenster mit Tabs: Ein Fenster an der Titelleiste auf die Titelleiste eines anderen Fensters ziehen („Als Tab einfügen“ erscheint), dann teilen sich beide ein Fenster mit Tabs. Klick wechselt, Mittelklick oder ✕ schließt, Rechtsklick „Als eigenes Fenster lösen“. Tab-Gruppen bleiben nach dem Neuladen erhalten.
- Schnellvorschau im Explorer: Datei markieren und Leertaste drücken. Pfeiltasten blättern, Enter öffnet, Leertaste oder Esc schließt.
- Tastenkürzel-Übersicht mit Alt+? oder F1 (auch über die Suche „Tastenkürzel“).
- Offline-Anzeige: Ohne Internet erscheint oben ein Hinweis und das Symbol in der Taskleiste wird rot. Kommt die Verbindung zurück, meldet das OS „Wieder online“ und bestätigt, wenn alle Änderungen gespeichert sind.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/os-icons.css, OS/explorer.js, OS/more.js (neu)
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (9)

### J.Mainz OS: Startmenü als Liste wie bei Windows
- Das Startmenü zeigt unter „Zuletzt geöffnet“ jetzt alle Apps alphabetisch als Liste mit Buchstaben (A, B, C …), kleinen Symbolen und Namen, wie die Listenansicht bei Windows 11. Spiele und Web-Apps stehen mit kleinem „Web“-Hinweis mit in der Liste.
- Klick auf einen Buchstaben öffnet die Übersicht A–Z zum schnellen Springen.
- Oben rechts lässt sich zwischen Liste und Raster umschalten; die Wahl wird gespeichert.
- Das Startmenü ist schmaler und dadurch aufgeräumter.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (8)

### J.Mainz OS: Musik in der Taskleiste immer sichtbar
- Die Musik-Anzeige in der Taskleiste ist jetzt immer da: „Spotify – Verbinden“, wenn Spotify in diesem Browser noch nicht verbunden ist (Klick öffnet die Spotify-App zum Verbinden), „Nichts läuft“, wenn gerade nichts spielt, sonst Titel, Interpret, Pause und Weiter. Vorher blieb sie in beiden ersten Fällen unsichtbar.
- Die Spotify-Anmeldung wird jetzt auch gefunden, wenn sie ohne „angemeldet bleiben“ in einem anderen Fenster erfolgt ist, sofern sie im Browser noch vorhanden ist. Podcasts werden ebenfalls angezeigt.
- Geänderte Dateien: OS/social.js, OS/apps.js, OS/os.css
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (7)

### J.Mainz OS: lebendiger Desktop, Animationen, Bildschirmschoner, Astro, als App installieren
- Lebendiger Hintergrund: ab und zu ziehen Sternschnuppen über den Himmel, der Himmel färbt sich je nach Tageszeit (Morgen, Tag, Abend, Nacht) und zeigt das Wetter von draußen (Regen, Schnee, Gewitter mit Blitzen, Nebel; Ort wie beim Wetter-Widget). Alles einzeln abschaltbar unter Einstellungen → „Lebendiger Desktop“.
- Start-Animation: Symbole, Taskleiste und Widgets fliegen beim Start nacheinander herein. Abmelde-Animation: Fenster blenden aus, „Auf Wiedersehen“ erscheint.
- Bildschirmschoner: Flug durch die Sterne mit großer Uhr, standardmäßig nach 10 Minuten ohne Maus und Tastatur (einstellbar, mit Vorschau). Eine Bewegung oder Taste beendet ihn.
- Astro, der kleine Astronaut: schwebt über den Desktop, sagt beim Anklicken etwas (Begrüßung, Weltraum-Fakten, nächste Erinnerung), lässt sich herumziehen und per Rechtsklick ausblenden.
- Als App installieren: Das OS hat ein eigenes App-Manifest. In Chrome und Edge lässt es sich als eigenes Programm installieren (Einstellungen → „Als App installieren“ oder Symbol in der Adressleiste).
- Fenster herauslösen: Seiten-Apps (z. B. Zeiterfassung, Finanzen) haben in der Titelleiste einen neuen Knopf, der sie als eigenes Browserfenster an gleicher Stelle öffnet, z. B. für einen zweiten Bildschirm.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/os-icons.css, OS/live.js (neu), OS/manifest.webmanifest (neu)
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (6)

### J.Mainz OS: Familien-Zettel, Chat-Blasen, Papierkorb, Dateien auf dem Desktop, Musik
- Widget „Familien-Zettel“: ein gemeinsamer Zettel, den alle freigegebenen Familienmitglieder sehen und bearbeiten, mit Anzeige, wer zuletzt geschrieben hat.
- Chat-Blasen: Kommt eine neue Nachricht, erscheint rechts eine runde Blase mit Bild bzw. Anfangsbuchstaben und Zähler. Ein Klick öffnet ein kleines Chatfenster zum direkten Antworten, ohne den Messenger zu öffnen. Abschaltbar in den Einstellungen („Chat & Musik“).
- Papierkorb: Gelöschte Dateien landen zuerst im Papierkorb (Explorer und Desktop-Symbol) und werden nach 30 Tagen automatisch endgültig gelöscht. Wiederherstellen, endgültig löschen und Papierkorb leeren sind möglich. Dateien lassen sich auch per Ziehen auf „Papierkorb“ löschen.
- Dateien auf dem Desktop: per Rechtsklick „Auf den Desktop legen“, per Ziehen aus dem Explorer oder direkt vom Computer auf den Desktop ziehen (wird hochgeladen). Bilder erscheinen als Vorschau.
- Musik in der Taskleiste: Läuft Spotify, zeigt die Taskleiste Titel und Interpret mit Pause und Weiter. Abschaltbar.
- Dokumente-Seite: Dateien im Papierkorb werden dort nicht mehr angezeigt.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/os-icons.css, OS/explorer.js, OS/apps.js, OS/social.js (neu), js/pages/dokumente.js
- Firestore-Regeln: neuer Block `os_shared` (Familien-Zettel).

## 25.11.2026 (5)

### J.Mainz OS: Schnellstart, mehrere Desktops, Zwischenablage, Erinnerungen
- Schnellstart-Leiste (Klick auf das WLAN-Symbol oder Alt+A): Kacheln für Nicht stören, Ein-/Ausstempeln, Sperren, Desktop anzeigen, Zwischenablage, Fensterübersicht, Widgets und Einstellungen, Lautstärke der Hinweistöne, nächster Termin mit Countdown und schnelle Erinnerung.
- Mehrere Desktops: in der Fensterübersicht neue Desktops anlegen (z. B. „Arbeit“, „Privat“), umbenennen per Doppelklick, wechseln per Klick oder Alt+Bild auf/ab. Jeder Desktop hat eigene Fenster, Widgets und Hintergrund. Fenster lassen sich per Rechtsklick in der Taskleiste auf einen anderen Desktop verschieben.
- Zwischenablage-Verlauf (Alt+V): Was im OS kopiert wird, landet in einer Liste und lässt sich mit einem Klick erneut kopieren. Nur in diesem Browser, nie aus dem Passwort-Safe, abschaltbar.
- Erinnerungen: in der Schnellstart-Leiste oder in der Suche („erinnere mich in 20 min an …“, „… um 17:30 an …“). Zur Zeit kommen Ton und Mitteilung.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/os-icons.css, OS/extras.js, OS/shell.js, OS/plus.js (neu)
- Firestore-Regeln: keine Änderung.

## 25.11.2026 (4)

### J.Mainz OS: neue Widgets und Apps
- Fehler behoben: „PIN festlegen“ und die Eingabefelder im Explorer (Umbenennen, Neuer Ordner) erschienen nur als kleines Schloss bzw. Stift am Rand, statt als Dialog.
- Widget Messenger: die letzten Chats mit ungelesenen Nachrichten, ein Klick öffnet den Chat.
- Widget Spotify: was gerade läuft, mit Zurück, Pause/Abspielen und Weiter (nutzt die Spotify-Verbindung aus der App „Spotify“).
- Widget Budgets: Fortschrittsbalken je Budget-Kategorie im aktuellen Monat.
- Widget Überstunden-Verlauf: Mehr- und Minderstunden der letzten Monate als Balken.
- App Fotos: alle Bilder aus deinen Dokumenten nach Monat, mit Bildbetrachter zum Blättern.
- App Aufgaben-Board: Aufgaben und Einkäufe als Karten in „Offen“, „In Arbeit“, „Erledigt“, per Ziehen verschieben.
- App Stoppuhr & Timer: Stoppuhr mit Runden, Timer mit Schnellwahl und Ton am Ende.
- Geänderte Dateien: OS/index.html, OS/os.css, OS/os-icons.css, OS/widgets.js, OS/apps.js (neu)
- Firestore-Regeln: todos dürfen zusätzlich das Feld „stage“ (Board-Spalte) ändern.

## 25.11.2026 (3)

### J.Mainz OS: Fenster, Taskleiste, Sperrbildschirm, Personalisierung
- Fensterübersicht: neuer Knopf in der Taskleiste zeigt alle offenen Fenster als Karten. Alt+Q gedrückt halten und wiederholt drücken wechselt zwischen den Fenstern.
- Andocken in die Ecken (Viertel des Bildschirms). Nach dem Andocken an eine Hälfte schlägt das OS vor, welches Fenster die andere Hälfte füllen soll.
- Tastenkürzel: Alt+Umschalt+Pfeile andocken/Vollbild, Alt+M minimieren, Alt+Umschalt+D Desktop anzeigen, Alt+1…9 angeheftete Apps, Alt+L sperren.
- Apps an die Taskleiste anheften (Rechtsklick auf Symbol, Startmenü oder Fenster). Im Startmenü gibt es „Zuletzt geöffnet“ mit Apps und Dateien.
- Sperrbildschirm mit Uhr, Datum und deinem Hintergrund: per Knopf im Startmenü, Alt+L oder automatisch nach einstellbarer Zeit. Optional mit PIN.
- Personalisierung: eigenes Hintergrundbild hochladen, Akzentfarbe wählen (8 Farben), Symbolgröße, Taskleiste links oder in der Mitte.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/os-icons.css, OS/explorer.js, OS/shell.js (neu)
- Firestore-Regeln: users/{uid}/meta/os für das eigene Hintergrundbild.

## 25.11.2026 (2)

### J.Mainz OS: Mitteilungen, Explorer, Suche
- Mitteilungen: Glocke in der Taskleiste mit Zähler und Mitteilungsleiste. Meldet neue Messenger-Nachrichten, heute fällige und überfällige Rechnungen, Termine in den nächsten 15 Minuten und wenn man seit 9 bzw. 10 Stunden eingestempelt ist. Neue Meldungen erscheinen kurz unten rechts, ein Klick öffnet die passende App. „Nicht stören“ schaltet die Hinweise ab.
- Explorer: eigenes Datei-Fenster mit Ordnern (Eigene Dateien, eigene Ordner, Rechnungen, Lohnabrechnungen), Symbol- und Listenansicht, Sortieren, Suchen. Hochladen per Knopf oder Drag & Drop, Ordner anlegen/umbenennen/löschen, Dateien umbenennen, verschieben (auch per Ziehen auf einen Ordner), herunterladen, löschen. Tastatur: Enter, Entf, F2, Pfeiltasten.
- Vorschau: Bilder mit Zoom und Blättern, PDFs und Textdateien in einem eigenen Fenster.
- Suche über alles im Startmenü (auch mit Strg+Leertaste): Termine, Aufgaben, Pinnwand, Dateien, Rechnungen, Buchungen, Chats und Aktionen. Mit Pfeiltasten auswählen, Enter öffnet.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/os-icons.css, OS/widgets.js, OS/explorer.js (neu), OS/extras.js (neu)
- Firestore-Regeln: keine Änderung.

## 25.11.2026

### J.Mainz OS: Widgets und Desktop-Modus
- Widgets auf dem Desktop: Uhr & Datum, Wetter, Stempeluhr (ein- und ausstempeln direkt vom Desktop), Nächste Termine, Aufgaben & Einkauf, Finanzen, Pinnwand, Notiz-Zettel und Kalender. Alle zeigen echte Daten.
- Hinzufügen über den neuen Knopf in der Taskleiste oder per Rechtsklick auf den Desktop. Verschieben per Ziehen, Größe klein/mittel/groß und Entfernen über das ⋯-Menü.
- Jeder sieht nur die Widgets, für die er die Berechtigung hat. J.Mainz OS braucht keine Web-Apps-Berechtigung mehr.
- Desktop, Widgets, Hintergrund, offene Fenster und Notizen werden jetzt im Profil gespeichert und sind auf allen Geräten gleich.
- Neu im Dashboard: Eintrag „Desktop-Modus“ unter System und in den Einstellungen „Desktop-Modus als Start“. Damit startet man nach der Anmeldung am PC direkt im Desktop. Am Handy startet immer das normale Dashboard.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/widgets.js (neu), js/drawer.js, js/settings.js, js/pages/login.js, assets/icons.css
- Firestore-Regeln: keine Änderung.

## 24.11.2026

### Neue Web-App: J.Mainz OS (Testversion)
- Das Dashboard als Desktop wie bei Windows, im dunklen Weltall-Stil: Desktop-Symbole, Taskleiste unten mit Startknopf links, Suche, geöffneten Apps, Uhr mit Kalender und „Desktop anzeigen“.
- Apps öffnen sich in Fenstern: verschieben, Größe ändern, minimieren, maximieren, schließen. An den oberen Rand ziehen = Vollbild, links/rechts = halber Bildschirm. Doppelklick auf die Titelleiste = Vollbild.
- Alle Bereiche des Dashboards laufen als Fenster (je nach Berechtigung), dazu Spiele-Ordner, Uhr, Game Center und eigene kleine Apps: Notizblock, Rechner, Einstellungen (Hintergrund wählen).
- Startmenü mit Suche, Rechtsklick-Menüs, Symbole frei verschiebbar. Offene Fenster und Positionen werden gemerkt.
- Am Handy öffnen sich die Apps im Vollbild.
- Erreichbar unter julian-mainz.de/OS/. Das bestehende Dashboard wurde dafür nicht verändert.
- Geänderte Dateien: OS/index.html, OS/os.js, OS/os.css, OS/os-icons.css (alle neu)
- Firestore-Regeln: keine Änderung.

## 20.11.2026

### Technik: schneller und ohne Strg+F5
- Kein Strg+F5 mehr nach Updates: Jede Datei bekommt automatisch eine Versionsnummer. Ändert sie sich, lädt jeder Browser sie von selbst neu, unveränderte Dateien bleiben im Zwischenspeicher.
- Seiten erscheinen schneller: Die großen Skripte (Firebase, Seiten-Code) blockieren das erste Anzeigen nicht mehr. Hell/Dunkel wird trotzdem sofort richtig angezeigt.
- Der Code jeder Seite liegt jetzt in einer eigenen Datei (js/pages/…) und wird vom Browser zwischengespeichert.
- Eigene Dialoge im Dashboard-Design statt der grauen Browser-Fenster (Löschen bestätigen, Hinweise). Bei Löschen steht der Fokus auf „Abbrechen“, Esc bricht ab.
- App-Modus: Nach der Anmeldung speichert ein Service Worker die Dateien des Dashboards. Es startet dadurch schneller und öffnet bereits besuchte Seiten auch ohne Netz.
- Aufgeräumt: doppelte Hilfsfunktionen zusammengelegt, altes Hintergrundbild entfernt. Datenschutzerklärung um den Service Worker ergänzt.
- Geänderte Dateien: alle Seiten (.html), js/pages/* (neu), js/theme.js (neu), stamp.mjs (neu), js/firebase-init.js, js/drawer.js, js/layout.js, js/settings.js, js/emoji-picker.js, firebase-messaging-sw.js, .github/workflows/build-css.yml, assets/icons.css
- Firestore-Regeln: keine Änderung.

### Standard-Layout für alle
- Start, Zeiterfassung und Finanzen: Admins sehen unter „Anpassen“ den neuen Knopf „Als Standard für alle“. Die aktuelle Anordnung der Karten (Reihenfolge, Größen, ausgeblendete Karten, Reiter) wird damit zum Standard.
- Den Standard bekommen alle, die auf der Seite noch kein eigenes Layout gespeichert haben, und „Zurücksetzen“ springt jetzt auf diesen Standard. Eigene Layouts bleiben unverändert.
- Geänderte Dateien: js/layout.js
- Firestore-Regeln: neue Sammlung `layout_defaults` (lesen alle Angemeldeten, schreiben nur Admins).

### Wartungsmodus
- Admin: neuer Reiter „Wartung“. Dort lässt sich jede Seite einzeln in Wartung setzen (Start, Messenger, Wandkalender, Zeiterfassung, Finanzen, Dokumente, Passwort-Safe, Spotify, Changelog, Profil) oder gleich die Anmeldung samt ganzem System.
- Wer kein Admin ist, sieht statt der Seite eine Wartungsseite mit eigenem Hinweistext und auf Wunsch „Voraussichtlich wieder da“. Ist die Wartung vorbei, lädt die Seite von selbst neu.
- Admins kommen immer rein und sehen oben eine Hinweisleiste. Auf der Anmeldeseite gibt es während der Wartung nur die „Admin-Anmeldung“, alle anderen werden direkt wieder abgemeldet.
- Im Menü zeigt ein kleines Werkzeug-Symbol, welche Seiten gerade in Wartung sind.
- Geänderte Dateien: js/firebase-init.js, js/drawer.js, admin.html, index.html, assets/ui.css, assets/icons.css
- Firestore-Regeln: neue Sammlung `maintenance` (lesen alle, schreiben nur Admins).

### Design
- Helles Design: neuer Weltall-Hintergrund in Pastell (Blau, Lila, Rosa) mit funkelnden Sternen; Karten und Menü scheinen leicht durch.
- Unten im Menü schweben jetzt auch im hellen Design Planeten (weiße Planeten mit Ring).
- Einstellung „Weltall-Hintergrund“ gilt jetzt für hell und dunkel; ausgeschaltet bleibt alles wie bisher.
- Geänderte Dateien: assets/space.css, js/space.js, js/settings.js, assets/img/space-bg-hell.webp, assets/img/menu-planet-hell.webp

### Admin
- Benutzerkarten: Berechtigungen, die in eine zweite Zeile umbrechen, stehen jetzt bündig neben der Gruppen-Überschrift statt darunter; am Handy steht die Überschrift über den Schaltern.

### Neue Seite: Changelog
- Unter „System“ gibt es für alle die Seite „Changelog“: alle Änderungen nach Datum, mit Suche und Filter nach Bereichen (Finanzen, Spiele, Zeiterfassung …).
- Neues seit deinem letzten Besuch ist mit „Neu für dich“ markiert.
- Technische Hinweise (geänderte Dateien, Firestore-Regeln) sehen nur Admins.

### Finanzen: Rechnungen
- Neuer Reiter „Rechnungen“: Rechnungen mit Anbieter, Betrag, Rechnungsdatum, Fälligkeit, Kategorie, Rechnungsnummer, IBAN, Verwendungszweck und Notiz anlegen.
- PDF oder Foto anhängen (bis 3 MB, Handyfotos werden automatisch verkleinert); Ansehen mit einem Klick.
- Übersicht nach Dringlichkeit (überfällig, diese Woche, später, bezahlt) mit Kennzahlen, Filter und Suche; IBAN kopieren per Knopf.
- „Bezahlt“ abhaken trägt die Rechnung automatisch als Ausgabe in die Buchungen ein (pro Rechnung abschaltbar, rückgängig möglich).
- Neue Karte „Nächste Rechnungen“ auf der Übersicht (verschieb- und ausblendbar).
- Dokumente: neuer Bereich „Rechnungen“ mit allen angehängten Dateien.
- Rechnungen importieren: CSV-Datei (z. B. aus Excel) mit Vorschau, automatischer Spalten-Erkennung, Kategorie-Vorschlag und Erkennung doppelter Einträge; bezahlte Zeilen kommen ohne neue Buchung rein. Rechnungen ohne Betrag oder Fälligkeit sind jetzt möglich, der Verwendungszweck lässt sich kopieren.
- Buchungen: neuer Knopf „Löschen“ – entweder alle angezeigten Buchungen (Monat und Filter) oder alle Buchungen auf einmal löschen.
- Firestore-Regeln: neue Sammlung `invoices` (mit Unter-Sammlung `chunks`).

### Sternenkolonie: neue Kolonien, Tag & Nacht, Rover
- Kolonieschiff freigeschaltet (Werft Stufe 3, Kommandozentrale Stufe 4). Über das Sprungtor auf der Sternenkarte gründest du neue Kolonien in Sektor 1: Boreas (Eiswelt, viele Kristallfelder) und Ignis (Lavawelt, viele Erzadern).
- Jede Kolonie hat eigene Gebäude, Bewohner, Bauland und Kommandozentrale; Rohstoffe, Schiffe und Forschung sind gemeinsam. Lager und Landeplätze aller Kolonien zählen zusammen, Kolonien im Hintergrund produzieren weiter (auch offline) und können angegriffen werden.
- Neuer Knopf 🪐 Kolonien zum Wechseln; jede Welt hat ihre eigene 3D-Optik (Eis, Lava mit glühenden Rissen, eigener Planet am Himmel).
- Tag-Nacht-Wechsel (10 Minuten), nachts leuchten Fenster und Gebäude; im Menü abschaltbar.
- Rover fahren auf den Wegen zwischen den Gebäuden (mit Wegfindung, nachts mit Scheinwerfern).
- Gebäude lassen sich drehen: beim Bauen mit R oder ⟳, fertige Gebäude im Info-Fenster.
- 3 neue Aufträge (jetzt 26) und 2 neue Erfolge (jetzt 16), auch im Game Center.

### Sternenkolonie in 3D
- Die Kolonie wird jetzt in echtem 3D dargestellt (Three.js): schwebender Asteroid, alle 14 Gebäude als 3D-Modelle mit sichtbaren Stufen, Schatten, Leuchten und Animationen (Bohrer, Rauch, Radarschüsseln, Fackeln, Kristalle).
- Kamera wie in Aufbauspielen: linke Maustaste verschieben, rechte Maustaste drehen und neigen, Mausrad zoomen, WASD und Q/E auf der Tastatur. Am Handy: ein Finger verschiebt, zwei Finger zoomen, drehen und neigen.
- Bauen, Verschieben und Auswählen mit 3D-Vorschau (grün = frei, rot = geht nicht), Baugerüst und Fortschrittsbalken beim Bauen, Kran beim Ausbauen.
- Schiffe stehen auf den Landeplätzen, starten und landen in 3D; Piratenangriffe mit anfliegenden Piraten, Laserfeuer der Türme und Jägern.
- Spielstand, Spiellogik und alle Fenster bleiben gleich. „Effekte: sparsam“ im Menü schaltet Schatten und Animationen für schwächere Geräte ab.

## 19.11.2026

### Zeiterfassung
- Überstundenkonto mit Monatsabschluss: Das Konto ändert sich erst, wenn ein Monat abgeschlossen wird (neuer Stand = alter Stand + gearbeitet − ausgezahlt). Fenster „Monat abschließen“ mit Vorschau und Schnellwahl „wie Soll“ / „wie gearbeitet“; Abschluss lässt sich aufheben.
- Startstand des Überstundenkontos bezieht sich jetzt auf einen Monat (z. B. „nach Oktober 2026“). Ältere Stände mitten im Monat werden weiter korrekt verrechnet.
- Urlaub: neues Feld „schon genommen, aber nicht eingetragen“ für den Einstieg mitten im Jahr. Einstellungen auch über das Zahnrad im Urlaubskonto erreichbar.
- Stempeluhr passt sich der Kartenhöhe an (Ring wird kleiner, Nebensächliches blendet aus), kein Scrollbalken mehr.
- Neue Karte „Tage im Monat“ auf der Übersicht: jeder Tag mit Uhrzeiten, Stunden und ± zum Soll; Klick öffnet das Tagesmenü.

### Anpassen-Modus (Zeiterfassung, Startseite, Finanzen)
- Neue Anordnung „Frei im Raster“: Karten bleiben genau dort, wo sie abgelegt werden, Lücken sind erlaubt, überlappende Karten rutschen nach unten. Ein Platzhalter zeigt beim Ziehen die Zielposition. Pfeiltasten verschieben um eine Spalte bzw. Reihe.
- Auf dem Handy liegen die Karten weiterhin untereinander.

### Kalender
- Termine farblich codierbar: 9 Farben oder „Automatisch“ (nach Titel). Die Farbe erscheint auch im Wandkalender.
- Neue Wiederholung „Werktags“: Montag bis Freitag ohne gesetzliche Feiertage in NRW.

### Startseite
- Überstunden und Resturlaub nach derselben Logik wie in der Zeiterfassung (Monatsabschlüsse, vorher genommene Urlaubstage).

### Datenschutz
- Ergänzt: Startstand und Monatsabschlüsse des Überstundenkontos, Position und Größe der Karten im gespeicherten Layout.

### Neu: Sternenkolonie (Aufbau-Strategiespiel)
- Neues Spiel unter /Kolonie/: Weltraumkolonie auf einem Asteroiden aufbauen, im Iso-Stil mit eigener Grafik.
- 15 Gebäude (Kommandozentrale, Wohnkuppel, Gewächshaus, Solarfeld, Mine, Kristallbohrer, Fabrik, Raffinerie, Lager, Landeplatz, Werft, Abwehrturm, Schildgenerator, Labor), ausbaubar, reparierbar, abreißbar.
- Wirtschaft mit Erz, Kristallen, Bauteilen, Treibstoff und Credits; Energie und Arbeiter müssen reichen. Kommandozentrale bis Stufe 5, jede Stufe bringt mehr Bauland.
- 5 Schiffe (Drohne, Frachter, Forscher, Jäger, Kreuzer), die auf Landeplätzen parken und animiert starten und landen.
- Sternenkarte mit Missionen: Erz abbauen, handeln, Anomalien scannen, unbekannte Systeme erkunden, Piratennest angreifen.
- Piratenangriffe mit Vorwarnung, sichtbarem Kampf und Bericht; Händler-Angebote.
- Forschung (8 Technologien), Markt, 23 Aufträge, 14 Erfolge.
- Läuft bis zu 8 Stunden offline weiter. Steuerung mit Maus und Mausrad oder Wischen und Pinch-Zoom.
- Spielstand im Konto, auf jedem Gerät weiterspielbar.
- Gebäude lassen sich kostenlos verschieben (Gebäude antippen → „Verschieben“ → neuen Platz wählen).

### Game Center
- Sternenkolonie in der Bibliothek, mit Titelbild, Fortschritt (Aufträge, Zentrale, Forschung, Sternenkarte), Statistiken und Erfolgen.

### Spielstände im Konto
- Lehnt das Konto ein einzelnes Spiel ab, werden die anderen trotzdem gespeichert (vorher war 10 Minuten lang alles blockiert).

### Optik
- Echtes helles Design mit eigenem Farbschema auf allen Seiten statt Filter; Klasse heißt jetzt `hell` (kein Konflikt mehr mit dem Admin-Bereich).
- Weltall-Hintergrund im dunklen Design: animierter Sternenhimmel mit Funkeln und Sternschnuppen, Planeten-Motiv unten im Menü. Abschaltbar in den Einstellungen.

### Firestore-Regeln
- gamesaves: Feld `kolonie` erlaubt.

### Geänderte Dateien
zeiterfassung.html, menu.html, wand.html, datenschutz.html, js/layout.js, js/calendar-core.js, assets/layout.css, Kolonie/ (neu), Spiele/index.html, js/gamesave.js, assets/light.css, assets/space.css, js/space.js, js/settings.js, js/firebase-init.js, assets/img/menu-planet.webp
