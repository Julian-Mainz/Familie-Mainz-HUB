# Changelog

Alle Änderungen am J.Mainz Dashboard, die neuesten oben.

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
