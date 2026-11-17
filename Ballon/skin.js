// Design-Umschaltung für Ballon-Alarm: "space" (Weltraum) oder "classic" (Ballons und Wiese).
// Nur Optik und Texte ändern sich; Regeln, Spielstände und Erfolge bleiben gleich.
// Die Spieldaten (TOWERS, MAPS, ...) stehen im Hauptskript; diese Datei greift erst beim Umschalten darauf zu.
let SKIN = 'space';
const SKIN_TEXT = {
  towers: {
    dart: ['Pulslaser', 'Schnell und günstig. Trifft einzelne Schiffe.', ['Fokuslinsen', 'Dreifachlaser', 'Plasmakern'], ['Zielerfassung', 'Schnellladung', 'Dauerfeuer']],
    boom: ['Diskuswerfer', 'Energiescheiben fliegen durch viele Schiffe hindurch.', ['Breitere Scheiben', 'Plasmakanten', 'Diskussturm'], ['Reichweite', 'Schneller werfen', 'Dauerwurf']],
    bomb: ['Torpedorampe', 'Flächenschaden: trifft alle in der Nähe. Knackt Panzerung.', ['Größere Sprengköpfe', 'Splittertorpedos', 'Plasmatorpedo'], ['Weitschuss', 'Schnell nachladen', 'Torpedosalve']],
    ice: ['Stasisfeld', 'Bremst alle Schiffe in der Nähe aus.', ['Längere Stasis', 'Tiefe Stasis', 'Zeitstillstand'], ['Reichweite', 'Schneller Puls', 'Stasissturm']],
    sniper: ['Railgun', 'Trifft überall auf der Karte und erkennt getarnte Schiffe.', ['Schwere Projektile', 'Panzerbrecher', 'Gaußkanone'], ['Schnelle Ladung', 'Automatik', 'Dauerfeuer']],
    bank: ['Handelsposten', 'Zahlt am Ende jeder Welle Credits aus.', ['Zinsen', 'Handelsroute', 'Handelsimperium'], []],
    tesla: ['Ionenkanone', 'Ionenblitz springt von Schiff zu Schiff. Knackt Panzerung.', ['Mehr Sprünge', 'Hochspannung', 'Ionensturm'], ['Reichweite', 'Schneller laden', 'Dauerstrom']],
    glue: ['Traktorstrahl', 'Hält Schiffe im Strahl fest, sie werden stark gebremst.', ['Starker Strahl', 'Säurefeld', 'Auflöser'], ['Doppelstrahl', 'Schneller fassen', 'Streufeld']],
    flame: ['Plasmawerfer', 'Kurze Reichweite, das Plasma trifft viele Schiffe. Stark gegen Schwerpanzer.', ['Heißeres Plasma', 'Plasmabrand', 'Inferno'], ['Längerer Strahl', 'Druckkammer', 'Plasmaring']],
    magnet: ['Gravitonanker', 'Zieht gepanzerte Schiffe zurück und reißt ihnen die Panzerung ab.', ['Stärkerer Zug', 'Doppelzug', 'Singularität'], ['Reichweite', 'Schneller ziehen', 'Dauerfeld']],
    farm: ['Kristallmine', 'Fördert während der Welle Energiekristalle. Antippen oder darüberfahren zum Einsammeln.', ['Mehr Kristalle', 'Reinkristalle', 'Großförderung'], ['Bessere Ausbeute', 'Lagerdepot', 'Sammeldrohnen']],
    heli: ['Jägerhangar', 'Ein Raumjäger fliegt zu den Schiffen und schießt. Erkennt Tarnung.', ['Doppelkanone', 'Raketen', 'Kampfjäger'], ['Schnellerer Antrieb', 'Mehr Reichweite', 'Dauerfeuer']],
    pilot: ['Kommandantin Pia', 'Heldin: Ihr Raumjäger kreist über der Karte und schießt auf alles in der Nähe. Erkennt Tarnung.', [], []],
    magier: ['Sternenmagier Merlin', 'Held: Plasmakugeln mit Flächenschaden, die Panzerung schmelzen.', [], []]
  },
  heroLv: { pilot: { 3: 'Doppelkanone', 4: 'knackt Panzerung', 6: 'Fähigkeit „Orbitalschlag“', 10: 'zweiter Raumjäger' }, magier: { 3: 'Plasmawand auf der Flugbahn', 6: 'Fähigkeit „Meteor“', 10: 'verwandelt Schiffe zurück in Späher' } },
  abil: { dart: ['Laserhagel', '8 Sekunden lang fünfmal so schnell'], boom: ['Diskussturm', '8 Sekunden dreimal so schnell, +10 Durchschlag'], bomb: ['Torpedosalve', '4 Schaden an allen Schiffen im doppelten Radius'], ice: ['Zeitstopp', 'Alle Schiffe 3 Sekunden eingefroren'],
    sniper: ['Präzisionsschuss', '500 Schaden am stärksten Schiff'], bank: ['Auszahlung', 'Sofort das 1,5-fache Welleneinkommen'], tesla: ['Ionengewitter', 'Blitz trifft bis zu 30 Schiffe mit 3 Schaden'], glue: ['Traktorfeld', 'Alle Schiffe 6 Sekunden festgehalten'],
    flame: ['Plasmasturm', 'Alles im doppelten Umkreis brennt 5 Sekunden'], magnet: ['Gravitationswelle', 'Zieht alle Schiffe (außer Bossen) 150 Pixel zurück'], farm: ['Kristallader', 'Sofort 600 Cr'], heli: ['Raketenhagel', '6 Schaden an den 20 stärksten Schiffen'],
    pilot: ['Orbitalschlag', '4 Schaden an allen Schiffen'], magier: ['Meteor', '80 Schaden am stärksten Schiff, 6 im Umkreis'] },
  items: { spikes: ['Minenfeld', '💣', 'Auf die Flugbahn legen: zerstört die nächsten 20 Schiffe. Höchstens 3 gleichzeitig.'], icebomb: ['Stasisbombe', '🧊', 'Irgendwo hinwerfen: friert alles im Umkreis 4 Sekunden ein.'], heart: ['+20 Hülle', '🛡️', 'Einmal pro Spiel, kostet 10 💎.'] },
  boss: { zeppelin: 'Mutterschiff', panzer: 'Panzerkreuzer', schwarm: 'Drohnenträger', tarn: 'Tarnkreuzer' },
  kind: { metal: 'Gepanzert', ceramic: 'Schwerpanzer' },
  layer: ['Späher', 'Jäger', 'Fregatte', 'Kreuzer', 'Schlachtschiff'],
  news: { metal: 'Gepanzertes Schiff: Laser und einfache Scheiben prallen ab. Torpedos, Ionenkanone, Plasma, Gravitonanker und Railgun helfen.', ceramic: 'Schwerpanzer: harte Hülle mit 10 Treffern, darin zwei Schlachtschiffe. Plasma ist besonders stark.', camo: 'Getarntes Schiff: Nur Plattformen mit 📡 Radar zielen darauf. Railgun, Jägerhangar und Kommandantin sehen es immer.', regrow: 'Regenerierendes Schiff: bekommt alle 3 Sekunden eine Schildstufe zurück. Schnell zerstören!',
    panzer: 'Panzerkreuzer: Nur Treffer, die Panzerung knacken, wirken. Bei der Explosion legt er Plattformen in der Nähe 3 Sekunden lahm.', schwarm: 'Drohnenträger: Wird er zerstört, schwärmen 30 Drohnen aus.', tarn: 'Tarnkreuzer: Nur Plattformen mit Radar sehen ihn.' },
  weather: { regen: ['Nebelfeld', '🌫️', 'Schiffe 15 % langsamer'], wind: ['Sonnenwind', '☀️', 'Laser und Scheiben driften ab'], sturm: ['Ionensturm', '⚡', 'Reichweite der Plattformen −20 %'] },
  maps: { wiese: ['Außenposten Terra', '🪐', 'Eine ruhige Route zum Üben.'], zickzack: ['Asteroidengürtel', '☄️', 'Lange Wege, viele Kurven.'], spirale: ['Nebel-Spirale', '🌀', 'Alles fliegt ins Zentrum.'], winter: ['Eisplanet Kryos', '❄️', 'Eis, Kristalle und Kälte.'], wueste: ['Marscanyon', '🔴', 'Die Flugbahn kreuzt sich selbst. Gut für Flächenschaden.'] },
  diff: { leicht: [null, '150 Hülle, günstigere Plattformen'], schwer: [null, '60 Hülle, schnellere Schiffe'], eins: ['Ein Treffer', 'Ein Schiff am Ziel und es ist vorbei'] },
  meta: { startMoney: ['Startkapital', '+50 Cr zum Start je Stufe'], lives: ['Verstärkte Hülle', '+5 Hülle je Stufe'], discount: ['Mengenrabatt', 'Plattformen und Upgrades 2 % günstiger je Stufe'], bonus: ['Kopfgeld', '+5 % Credits für jedes zerstörte Schiff je Stufe'], roundBonus: ['Wellenprämie', '+10 Cr Wellenbonus je Stufe'] },
  ach: { pop1: ['🛸', 'Erster Abschuss', 'Zerstöre dein erstes Schiff.'], pop1k: [null, 'Tausendsassa', 'Zerstöre 1.000 Schiffe.'], pop10k: [null, 'Sternenjäger', 'Zerstöre 10.000 Schiffe.'], pop100k: [null, 'Schrecken der Galaxis', 'Zerstöre 100.000 Schiffe.'], pop1m: [null, '1 Million Schiffe', 'Zerstöre 1.000.000 Schiffe.'],
    r10: [null, 'Welle 10', 'Erreiche Welle 10.'], r25: [null, 'Welle 25', 'Erreiche Welle 25.'], r50: [null, 'Welle 50', 'Erreiche Welle 50.'], r100: [null, 'Welle 100', 'Erreiche Welle 100.'],
    boss1: ['🛸', 'Mutterschiff-Knacker', 'Besiege einen Boss.'], boss10: [null, 'Flottenabwehr', 'Besiege 10 Bosse.'], nolife: [null, 'Unverwundbar', 'Welle 50, ohne Hülle zu verlieren.'], hard30: [null, 'Harter Brocken', 'Welle 30 auf Schwer.'], one20: [null, 'Auf Messers Schneide', 'Welle 20 im Modus „Ein Treffer“.'],
    maxtower: [null, 'Voll ausgebaut', 'Baue einen Pfad einer Plattform ganz aus.'], alltypes: [null, 'Sammler', 'Alle 8 klassischen Plattformen in einem Spiel.'], vet3: [null, 'Kriegsveteran', 'Eine Plattform zerstört 10.000 Schiffe.'], rich: [null, 'Dagobert', 'Habe 50.000 Cr auf einmal.'],
    allmaps: [null, 'Weltenbummler', 'Welle 10 in allen fünf Sektoren.'], stars3: [null, 'Perfekt', 'Hole 3 Sterne in einem Sektor.'], banana: ['💠', 'Kristallsammler', 'Sammle 100 Kristalle ein.'], builder: [null, 'Baumeister', 'Baue eine eigene Karte.'],
    coop: [null, 'Teamwork', 'Schaffe 10 Wellen zusammen mit jemandem.'], allnew: [null, 'Werkzeugkasten', 'Plasmawerfer, Gravitonanker, Kristallmine und Jägerhangar in einem Spiel.'] }
};
// Hintergrund je Karte im Weltraum
const SPACE_THEME = { wiese: 'orbit', zickzack: 'guertel', spirale: 'nebel', winter: 'eis', wueste: 'mars' };
const SPACE_THEME_BY = { wiese: 'orbit', winter: 'eis', wueste: 'mars' };
const skinTheme = (key, theme) => (SKIN === 'space' ? (SPACE_THEME[key] || SPACE_THEME_BY[theme || (MAPS[key] && MAPS[key].theme)] || 'orbit') : (theme || (MAPS[key] && MAPS[key].theme) || 'wiese'));

// Originaltexte einmal sichern, dann je Design einsetzen
let SKIN_ORIG = null;
function skinData(sk) {
  if (!SKIN_ORIG) SKIN_ORIG = JSON.parse(JSON.stringify({ T: Object.fromEntries(Object.entries(TOWERS).map(([k, d]) => [k, { n: d.n, d: d.d, A: d.A.map(x => x[0]), B: d.B.map(x => x[0]) }])), HL: HERO_LV, AB: ABIL, IT: ITEMS, BO: BOSS, KI: KIND, LA: LAYER.slice(1).map(l => l.n), NE: NEWS, WX: WEATHER, MA: Object.fromEntries(BUILTIN.map(k => [k, { n: MAPS[k].n, e: MAPS[k].e, d: MAPS[k].d }])), DI: DIFF, ME: META.map(m => [m[1], m[2]]), AC: ACH.map(a => [a[1], a[2], a[3]]) }));
  const O = SKIN_ORIG, X = SKIN_TEXT, sp = sk === 'space';
  Object.entries(TOWERS).forEach(([k, d]) => { const o = O.T[k], x = sp && X.towers[k]; d.n = x ? x[0] : o.n; d.d = x ? x[1] : o.d; d.A.forEach((u, i) => { u[0] = x && x[2][i] ? x[2][i] : o.A[i]; }); d.B.forEach((u, i) => { u[0] = x && x[3][i] ? x[3][i] : o.B[i]; }); });
  Object.keys(HERO_LV).forEach(k => { HERO_LV[k] = { ...(sp ? X.heroLv[k] : O.HL[k]) }; });
  Object.keys(ABIL).forEach(k => { const x = sp && X.abil[k]; ABIL[k][0] = x ? x[0] : O.AB[k][0]; ABIL[k][1] = x ? x[1] : O.AB[k][1]; });
  Object.keys(ITEMS).forEach(k => { const x = sp && X.items[k], o = O.IT[k]; ITEMS[k].n = x ? x[0] : o.n; ITEMS[k].e = x ? x[1] : o.e; ITEMS[k].d = x ? x[2] : o.d; });
  Object.keys(BOSS).forEach(k => { BOSS[k].n = sp ? X.boss[k] : O.BO[k].n; });
  Object.keys(KIND).forEach(k => { KIND[k].n = sp ? X.kind[k] : O.KI[k].n; });
  for (let l = 1; l <= 5; l++) LAYER[l].n = sp ? X.layer[l - 1] : O.LA[l - 1];
  Object.keys(NEWS).forEach(k => { NEWS[k] = sp ? X.news[k] : O.NE[k]; });
  Object.keys(WEATHER).forEach(k => { const x = sp && X.weather[k], o = O.WX[k]; WEATHER[k].n = x ? x[0] : o.n; WEATHER[k].e = x ? x[1] : o.e; WEATHER[k].d = x ? x[2] : o.d; });
  BUILTIN.forEach(k => { const x = sp && X.maps[k], o = O.MA[k]; MAPS[k].n = x ? x[0] : o.n; MAPS[k].e = x ? x[1] : o.e; MAPS[k].d = x ? x[2] : o.d; });
  Object.keys(DIFF).forEach(k => { const x = sp && X.diff[k], o = O.DI[k]; DIFF[k].n = x && x[0] ? x[0] : o.n; DIFF[k].d = x && x[1] ? x[1] : o.d; });
  META.forEach((m, i) => { const x = sp && X.meta[m[0]]; m[1] = x ? x[0] : O.ME[i][0]; m[2] = x ? x[1] : O.ME[i][1]; });
  ACH.forEach((a, i) => { const x = sp && X.ach[a[0]], o = O.AC[i]; a[1] = x && x[0] ? x[0] : o[0]; a[2] = x ? x[1] : o[1]; a[3] = x ? x[2] : o[2]; });
}

// Feste Texte der Oberfläche (Hilfe, Meldungen, Knöpfe) im Weltraum umschreiben.
// Reihenfolge wichtig: genaue Wendungen zuerst, einzelne Wörter zuletzt.
const SX_RULES = [
  [/Ballon-Alarm/g, '\u0001'],
  [/Tarn-Ballons sehen nur/g, 'Getarnte Schiffe sehen nur'], [/an Metall-Ballons prallen Darts ab/g, 'an gepanzerten Schiffen prallen Laser ab'], [/einen Turm und setze ihn/g, 'eine Plattform und setze sie'], [/einen Turm an, um ihn/g, 'eine Plattform an, um sie'],
  [/ Er rastet/g, ' Sie rastet'], [/ Er darf nicht/g, ' Sie darf nicht'], [/kein Turm/g, 'keine Plattform'], [/einem anderen Turm/g, 'einer anderen Plattform'], [/Verdientes Geld/g, 'Verdiente Credits'], [/(\d+) Leben verloren/g, '$1 Hüllenpunkte verloren'], [/dem Geld/g, 'den Credits'],
  [/Tarn-Ballons/g, 'getarnte Schiffe'], [/Tarn-Ballon/g, 'getarntes Schiff'], [/Tarn-Zeppelin/g, 'Tarnkreuzer'], [/Metall-Ballons/g, 'gepanzerte Schiffe'], [/Metall-Ballon/g, 'gepanzertes Schiff'],
  [/Jeder geplatzte Ballon bringt Geld/g, 'Jedes zerstörte Schiff bringt Credits'], [/Ein Ballon im Ziel/g, 'Ein Schiff am Ziel'], [/bevor sie ins Ziel kommen/g, 'bevor sie die Sternenbasis erreichen'], [/Halte die Ballons auf/g, 'Halte die Schiffe auf'],
  [/die Ballons laufen/g, 'die Schiffe fliegen'], [/den Ballon/g, 'das Schiff'], [/der Ballon/g, 'das Schiff'], [/einen Ballon/g, 'ein Schiff'], [/Ballons/g, 'Schiffe'], [/Ballon/g, 'Schiff'],
  [/kein Metall/g, 'keine Panzerung'], [/Metall und Keramik/g, 'Panzerung'], [/Metall\/Keramik/g, 'gepanzerte'], [/Metall/g, 'Panzerung'], [/Keramik/g, 'Schwerpanzer'],
  [/geplatzte/g, 'zerstörte'], [/geplatzt/g, 'zerstört'], [/Geplatzt/g, 'Zerstört'], [/platzt/g, 'zerstört'], [/Platze/g, 'Zerstöre'],
  [/Bananen/g, 'Kristalle'], [/Banane/g, 'Kristall'], [/🍌/g, '💠'], [/🎈/g, '🛸'], [/❤️/g, '🛡️'], [/🦸/g, '🧑‍🚀'],
  [/Dieser Turm/g, 'Diese Plattform'], [/Der Turm/g, 'Die Plattform'], [/der Turm/g, 'die Plattform'], [/den Turm/g, 'die Plattform'], [/einen Turm/g, 'eine Plattform'], [/ein Turm/g, 'eine Plattform'], [/Ein Turm/g, 'Eine Plattform'], [/eines Turms/g, 'einer Plattform'],
  [/Turmarten/g, 'Plattformen'], [/Türmen/g, 'Plattformen'], [/Türme/g, 'Plattformen'], [/Turm/g, 'Plattform'],
  [/Runden/g, 'Wellen'], [/Runde/g, 'Welle'],
  [/Ein Leben/g, 'Ein Treffer'], [/kein Leben verloren/g, 'keine Hülle verloren'], [/ein Leben zu verlieren/g, 'Hülle zu verlieren'], [/Leben/g, 'Hülle'],
  [/ €/g, ' Cr'], [/€/g, 'Cr'], [/Geld/g, 'Credits'], [/Wiese/g, 'Orbit'], [/Winter\b/g, 'Eisplanet'], [/Wüste\b/g, 'Mars'],
  [/\u0001/g, 'Ballon-Alarm']
];
const sxCache = new Map();
function sx(s) {
  if (SKIN !== 'space' || !s || typeof s !== 'string') return s;
  let r = sxCache.get(s); if (r !== undefined) return r;
  r = s; for (const [a, b] of SX_RULES) r = r.replace(a, b);
  if (sxCache.size > 4000) sxCache.clear(); sxCache.set(s, r); return r;
}
// Alles, was neu ins Dokument kommt, im Weltraum-Design umschreiben (Texte, Titel, Platzhalter).
// Eigene Inhalte von Personen (Namen, Kartennamen) tragen data-raw und bleiben unverändert.
let SX_OBS = null;
function sxNode(n) {
  if (n.nodeType === 3) { if (n.parentElement && n.parentElement.closest('[data-raw],script,style,textarea')) return; const v = n.nodeValue, r = sx(v); if (r !== v) n.nodeValue = r; return; }
  if (n.nodeType !== 1 || n.closest('[data-raw]') || /^(SCRIPT|STYLE|TEXTAREA|CANVAS)$/.test(n.tagName)) return;
  ['title', 'placeholder', 'aria-label'].forEach(a => { const v = n.getAttribute(a); if (v) { const r = sx(v); if (r !== v) n.setAttribute(a, r); } });
  const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let c; while ((c = w.nextNode())) { if (c.nodeType === 1) { if (c.hasAttribute('data-raw')) continue; ['title', 'placeholder', 'aria-label'].forEach(a => { const v = c.getAttribute(a); if (v) { const r = sx(v); if (r !== v) c.setAttribute(a, r); } }); } else sxNode(c); }
}
function sxWatch() {
  if (SX_OBS) SX_OBS.disconnect(); SX_OBS = null; if (SKIN !== 'space') return;
  sxNode(document.body);
  SX_OBS = new MutationObserver(list => { for (const m of list) { if (m.type === 'characterData') sxNode(m.target); else if (m.type === 'attributes') sxNode(m.target.nodeType === 1 ? m.target : m.target); else m.addedNodes.forEach(sxNode); } });
  SX_OBS.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
}
