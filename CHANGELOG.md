# Changelog

Alle Änderungen am J.Mainz Dashboard, die neuesten oben.

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
