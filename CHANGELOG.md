# Changelog

Alle Änderungen am J.Mainz Dashboard, die neuesten oben.

## 20.11.2026

### Finanzen: Rechnungen
- Neuer Reiter „Rechnungen“: Rechnungen mit Anbieter, Betrag, Rechnungsdatum, Fälligkeit, Kategorie, Rechnungsnummer, IBAN, Verwendungszweck und Notiz anlegen.
- PDF oder Foto anhängen (bis 3 MB, Handyfotos werden automatisch verkleinert); Ansehen mit einem Klick.
- Übersicht nach Dringlichkeit (überfällig, diese Woche, später, bezahlt) mit Kennzahlen, Filter und Suche; IBAN kopieren per Knopf.
- „Bezahlt“ abhaken trägt die Rechnung automatisch als Ausgabe in die Buchungen ein (pro Rechnung abschaltbar, rückgängig möglich).
- Neue Karte „Nächste Rechnungen“ auf der Übersicht (verschieb- und ausblendbar).
- Dokumente: neuer Bereich „Rechnungen“ mit allen angehängten Dateien.
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
