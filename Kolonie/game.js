// Kolonie/game.js - Spiellogik der Sternenkolonie: Daten, Wirtschaft, Schiffe, Missionen, Ereignisse, Speichern.
// Die Darstellung steht in ui.js, die Zeichnungen in art.js und ships.js.
(function () {
  'use strict';
  const KEY = 'sternenkolonie-v1', N = 16, OFFLINE_MAX = 8 * 3600e3;
  const now = () => Date.now();
  const RES = ['ore', 'crys', 'parts', 'fuel', 'cred'];
  const RN = { ore: 'Erz', crys: 'Kristalle', parts: 'Bauteile', fuel: 'Treibstoff', cred: 'Credits' };

  // ---------- Gebäude ----------
  // e: Energie (+ erzeugt, − verbraucht), w: Arbeiter, hq: ab Stufe der Kommandozentrale
  const B = {
    hq: { n: 'Kommandozentrale', s: 2, max: 5, hq: 0, e: 12, house: 8, d: 'Herz der Kolonie. Höhere Stufen schalten Gebäude, Bauland und Gebäudestufen frei.', ups: [null, null, { ore: 800, parts: 40 }, { ore: 2500, parts: 200, crys: 80 }, { ore: 7000, parts: 600, crys: 300, cred: 5000 }, { ore: 18000, parts: 1500, crys: 900, cred: 20000 }], uptime: [0, 0, 40, 120, 240, 420] },
    hab: { n: 'Wohnkuppel', s: 1, max: 3, hq: 1, cost: { ore: 60 }, time: 8, e: -1, house: 10, cat: 'basis', d: 'Wohnraum für 10 Bewohner.' },
    green: { n: 'Gewächshaus', s: 1, max: 3, hq: 1, cost: { ore: 80 }, time: 10, e: -2, w: 2, food: 18, cat: 'basis', d: 'Nahrung für 18 Bewohner.' },
    solar: { n: 'Solarfeld', s: 1, max: 3, hq: 1, cost: { ore: 50 }, time: 6, e: 7, cat: 'basis', d: 'Erzeugt Energie.' },
    store: { n: 'Lager', s: 1, max: 3, hq: 1, cost: { ore: 150 }, time: 12, store: 1200, cat: 'basis', d: '+1.200 Platz für jeden Rohstoff.' },
    mine: { n: 'Erzbohrer', s: 1, max: 3, hq: 1, cost: { ore: 40 }, time: 8, e: -2, w: 3, out: { ore: 1.1 }, cat: 'prod', d: 'Fördert Erz. Auf Erzadern 60 % mehr.' },
    crys: { n: 'Kristallbohrer', s: 1, max: 3, hq: 2, cost: { ore: 250 }, time: 20, e: -4, w: 4, out: { crys: .18 }, tile: 'crys', cat: 'prod', d: 'Fördert Kristalle. Nur auf Kristallfeldern.' },
    factory: { n: 'Fabrik', s: 2, max: 3, hq: 2, cost: { ore: 400, crys: 15 }, time: 30, e: -6, w: 8, conv: { ore: 1.6, out: 'parts', rate: .4 }, cat: 'prod', d: 'Macht aus Erz Bauteile für Schiffe und große Gebäude.' },
    refinery: { n: 'Raffinerie', s: 2, max: 3, hq: 2, cost: { ore: 350 }, time: 25, e: -5, w: 6, conv: { ore: 1.2, out: 'fuel', rate: .5 }, cat: 'prod', d: 'Macht aus Erz Treibstoff für Missionen.' },
    pad: { n: 'Landeplatz', s: 2, max: 3, hq: 2, cost: { ore: 300, parts: 30 }, time: 25, dock: 2, cat: 'space', d: 'Platz für 2 Schiffe (+1 je Stufe).' },
    yard: { n: 'Werft', s: 2, max: 3, hq: 3, cost: { ore: 1200, parts: 150, crys: 60 }, time: 60, e: -8, w: 10, cat: 'space', d: 'Baut Raumschiffe. Höhere Stufen bauen schneller und größere Schiffe.' },
    tower: { n: 'Abwehrturm', s: 1, max: 3, hq: 2, cost: { ore: 250, crys: 20, parts: 20 }, time: 20, e: -3, w: 2, def: 15, cat: 'def', d: 'Verteidigt die Kolonie gegen Piraten.' },
    lab: { n: 'Forschungslabor', s: 1, max: 3, hq: 3, cost: { ore: 600, parts: 80, crys: 40 }, time: 40, e: -4, w: 4, cat: 'def', d: 'Ermöglicht Forschung. Höhere Stufen forschen schneller.' },
    shield: { n: 'Schildgenerator', s: 1, max: 3, hq: 3, cost: { ore: 800, parts: 120, crys: 120 }, time: 45, e: -10, w: 2, prot: .3, cat: 'def', d: 'Verringert Verluste bei Angriffen um 30 % (+10 % je Stufe).' }
  };
  const LVF = [0, 1, 1.8, 2.8], LVE = [0, 1, 1.6, 2.2], LVW = [0, 1, 1.5, 2];
  const upCost = (k, l) => { const d = B[k]; if (k === 'hq') return d.ups[l]; const o = {}; for (const r in d.cost) o[r] = Math.round(d.cost[r] * Math.pow(2.3, l - 1)); return o; };
  const upTime = (k, l) => k === 'hq' ? B.hq.uptime[l] : Math.round(B[k].time * (l === 1 ? 1 : 1.8 * (l - 1)));
  const CATS = { basis: 'Basis', prod: 'Produktion', space: 'Raumfahrt', def: 'Forschung & Abwehr' };

  // ---------- Schiffe ----------
  const SH = {
    drone: { n: 'Bergbau-Drohne', cost: { parts: 25 }, time: 30, cargo: 150, atk: 0, def: 0, d: 'Sammelt Erz und Kristalle auf Missionen.' },
    freighter: { n: 'Frachter', cost: { parts: 80, cred: 300 }, time: 60, cargo: 400, atk: 0, def: 0, d: 'Handel mit anderen Systemen, großer Laderaum.' },
    scout: { n: 'Forscher', cost: { parts: 60, crys: 25 }, time: 50, cargo: 0, atk: 0, def: 0, d: 'Erkundet unbekannte Systeme und scannt Anomalien.' },
    fighter: { n: 'Abfangjäger', cost: { parts: 50, crys: 15 }, time: 40, cargo: 0, atk: 10, def: 8, d: 'Verteidigt die Kolonie und greift Piraten an.' },
    cruiser: { n: 'Kreuzer', cost: { parts: 350, crys: 150, cred: 2500 }, time: 180, cargo: 100, atk: 60, def: 45, yard: 2, d: 'Schweres Kampfschiff. Braucht Werft Stufe 2.' },
    colony: { n: 'Kolonieschiff', cost: { parts: 1200, crys: 500, fuel: 400, cred: 12000 }, time: 480, cargo: 0, atk: 0, def: 4, yard: 3, hq: 4, d: 'Gründet eine neue Kolonie in Sektor 1. Flieg damit durchs Sprungtor (Sternenkarte). Braucht Werft Stufe 3 und Kommandozentrale Stufe 4.' }
  };
  const NAMES = ['Kolibri', 'Lumen', 'Aurora', 'Nova', 'Falke', 'Komet', 'Polaris', 'Vega', 'Orion', 'Zephyr', 'Atlas', 'Luna', 'Sirius', 'Phoenix', 'Merkur', 'Iris', 'Titan', 'Juno', 'Rigel', 'Halley'];

  // ---------- Sternenkarte ----------
  // m: Missionen, ships: erlaubte Schiffe, dur: Sekunden, fuel: je Schiff
  // Plätze für neue Kolonien hinter dem Sprungtor
  const SITES = [
    { id: 'boreas', n: 'Boreas', kind: 'ice', sub: 'Eiswelt · viele Kristallfelder' },
    { id: 'ignis', n: 'Ignis', kind: 'lava', sub: 'Lavawelt · reich an Erzadern' }
  ];
  const SYS = [
    { id: 'home', n: 'Nova Prime', sub: 'Deine Kolonie', x: 470, y: 380, col: '#67e8f9', r: 22, known: 1 },
    { id: 'belt', n: 'Ceres-Gürtel', sub: 'Asteroiden · Erz', x: 640, y: 250, col: '#fbbf24', r: 0, known: 1, m: [{ id: 'mine', n: 'Erz abbauen', ships: ['drone', 'freighter'], dur: 120, fuel: 4, give: s => ({ ore: cargo(s) }) }] },
    { id: 'k3', n: 'Kepler-3', sub: 'Eismond · Handelsposten', x: 300, y: 230, col: '#a5f3fc', r: 14, known: 1, m: [
      { id: 'sell-ore', n: 'Erz verkaufen', ships: ['freighter'], dur: 180, fuel: 10, take: s => ({ ore: 300 * cnt(s, 'freighter') }), give: s => ({ cred: 650 * cnt(s, 'freighter') }) },
      { id: 'sell-parts', n: 'Bauteile verkaufen', ships: ['freighter'], dur: 180, fuel: 10, take: s => ({ parts: 50 * cnt(s, 'freighter') }), give: s => ({ cred: 900 * cnt(s, 'freighter') }) }] },
    { id: 'ano', n: 'Anomalie Ω', sub: 'Unbekannte Strahlung', x: 220, y: 520, col: '#a78bfa', r: 12, known: 1, m: [{ id: 'scan', n: 'Anomalie scannen', ships: ['scout'], dur: 240, fuel: 15, give: s => ({ crys: 45 * cnt(s, 'scout'), cred: 250 * cnt(s, 'scout') }) }] },
    { id: 'vega', n: 'Vega IV', sub: 'Kristallwelt', x: 720, y: 520, col: '#f0abfc', r: 16, known: 0, m: [{ id: 'crys', n: 'Kristalle abbauen', ships: ['drone', 'freighter'], dur: 300, fuel: 8, give: s => ({ crys: Math.round(cargo(s) / 6) }) }] },
    { id: 'wrack', n: 'Wrackfeld', sub: 'Alte Raumschlacht', x: 880, y: 600, col: '#94a3b8', r: 10, known: 0, m: [{ id: 'salvage', n: 'Wracks bergen', ships: ['drone', 'freighter'], dur: 200, fuel: 6, give: s => ({ parts: Math.round(cargo(s) / 5) }) }] },
    { id: 'titan', n: 'Titan-Station', sub: 'Großer Handelsplatz', x: 1080, y: 470, col: '#fde68a', r: 14, known: 0, m: [
      { id: 'sell-ore2', n: 'Erz verkaufen', ships: ['freighter'], dur: 300, fuel: 14, take: s => ({ ore: 300 * cnt(s, 'freighter') }), give: s => ({ cred: 1000 * cnt(s, 'freighter') }) },
      { id: 'buy-crys', n: 'Kristalle kaufen', ships: ['freighter'], dur: 300, fuel: 14, take: s => ({ cred: 900 * cnt(s, 'freighter') }), give: s => ({ crys: 70 * cnt(s, 'freighter') }) }] },
    { id: 'pir', n: 'Piratennest', sub: 'Sektor 3', x: 960, y: 300, col: '#ef4444', r: 12, known: 1, m: [{ id: 'attack', n: 'Angreifen', ships: ['fighter', 'cruiser'], dur: 240, fuel: 20, combat: true }] },
    { id: 'gate', n: 'Sprungtor', sub: 'zu Sektor 1 · neue Kolonien gründen', x: 600, y: 110, col: '#818cf8', r: 14, known: 1, gate: true, m: SITES.map(z => ({ id: 'found-' + z.id, n: `Kolonie gründen: ${z.n}`, sub: z.sub, ships: ['colony'], dur: 360, fuel: 60, found: z.id })) }
  ];
  const LANES = [['home', 'k3'], ['home', 'belt'], ['home', 'ano'], ['home', 'vega'], ['belt', 'pir'], ['vega', 'wrack'], ['pir', 'titan'], ['belt', 'gate'], ['k3', 'gate'], ['vega', 'pir']];
  const SBY = Object.fromEntries(SYS.map(s => [s.id, s]));
  const cnt = (s, t) => s[t] || 0;
  const cargo = s => Object.entries(s).reduce((a, [t, n]) => a + (SH[t] ? SH[t].cargo * n : 0), 0);

  // ---------- Forschung ----------
  const RS = [
    { id: 'drill', n: 'Tiefbohrung', d: '+30 % Erz', cost: { crys: 40, cred: 500 }, time: 120 },
    { id: 'hydro', n: 'Hydrokultur', d: '+50 % Nahrung', cost: { crys: 30, cred: 400 }, time: 90 },
    { id: 'logi', n: 'Logistik', d: '+50 % Lagerplatz', cost: { crys: 50, cred: 600 }, time: 150 },
    { id: 'solar2', n: 'Perowskit-Zellen', d: '+30 % Energie', cost: { crys: 60, cred: 800 }, time: 180 },
    { id: 'auto', n: 'Fertigungsroboter', d: '+30 % Bauteile und Treibstoff', cost: { crys: 80, cred: 1200 }, time: 240 },
    { id: 'light', n: 'Leichtbau', d: 'Schiffe 20 % günstiger', cost: { crys: 100, cred: 1500 }, time: 300 },
    { id: 'warp', n: 'Warpantrieb', d: 'Missionen 25 % schneller', cost: { crys: 150, cred: 2500 }, time: 420 },
    { id: 'armor', n: 'Verbundpanzerung', d: '+40 % Angriff und Verteidigung', cost: { crys: 200, cred: 3000 }, time: 480 }
  ];

  // ---------- Aufträge (führen durchs Spiel) ----------
  const Q = [
    { n: 'Baue ein Solarfeld', d: 'Ohne Energie läuft nichts.', ok: s => has(s, 'solar'), r: { ore: 100 } },
    { n: 'Baue einen Erzbohrer', d: 'Erz ist der wichtigste Rohstoff. Tipp: auf Erzadern (goldene Flecken) fördert er mehr.', ok: s => has(s, 'mine'), r: { ore: 150 } },
    { n: 'Baue eine Wohnkuppel', d: 'Bewohner arbeiten in deinen Gebäuden.', ok: s => has(s, 'hab'), r: { ore: 150 } },
    { n: 'Baue ein Gewächshaus', d: 'Bewohner brauchen Nahrung.', ok: s => has(s, 'green'), r: { ore: 200 } },
    { n: 'Erreiche 20 Bewohner', d: 'Mehr Wohnkuppeln und Gewächshäuser lassen die Kolonie wachsen.', ok: s => s.pop >= 20, r: { ore: 300 } },
    { n: 'Baue ein Lager', d: 'Mehr Platz für Rohstoffe.', ok: s => has(s, 'store'), r: { ore: 300 } },
    { n: 'Kommandozentrale auf Stufe 2', d: 'Tippe die Zentrale an und baue sie aus. Schaltet Fabriken, Raumhafen und mehr Bauland frei.', ok: s => hqLvl(s) >= 2, r: { cred: 1000 } },
    { n: 'Baue eine Fabrik', d: 'Fabriken machen aus Erz Bauteile.', ok: s => has(s, 'factory'), r: { parts: 50 } },
    { n: 'Baue eine Raffinerie', d: 'Treibstoff brauchst du für Missionen.', ok: s => has(s, 'refinery'), r: { fuel: 100 } },
    { n: 'Baue einen Landeplatz', d: 'Hier parken deine Raumschiffe.', ok: s => has(s, 'pad'), r: { parts: 80 } },
    { n: 'Baue einen Abwehrturm', d: 'Piraten kommen bald vorbei.', ok: s => has(s, 'tower'), r: { crys: 30 } },
    { n: 'Kommandozentrale auf Stufe 3', d: 'Schaltet Werft, Labor und Schildgenerator frei.', ok: s => hqLvl(s) >= 3, r: { cred: 2000 } },
    { n: 'Baue eine Werft', d: 'Endlich eigene Raumschiffe!', ok: s => has(s, 'yard'), r: { parts: 150 } },
    { n: 'Baue 2 Bergbau-Drohnen', d: 'In der Werft. Drohnen holen Erz aus dem Asteroidengürtel.', ok: s => fleetN(s, 'drone') >= 2, r: { fuel: 100 } },
    { n: 'Starte eine Mission', d: 'Öffne die Sternenkarte und schicke Schiffe los.', ok: s => s.st.missions >= 1, r: { cred: 1000 } },
    { n: 'Erkunde ein unbekanntes System', d: 'Baue einen Forscher und schicke ihn zu einem „???“ auf der Karte.', ok: s => s.known.length > 0, r: { crys: 60 } },
    { n: 'Erforsche eine Technologie', d: 'Baue ein Forschungslabor und starte eine Forschung.', ok: s => s.research.length >= 1, r: { crys: 80 } },
    { n: 'Wehre einen Piratenangriff ab', d: 'Abwehrtürme, Jäger und Kreuzer schützen die Kolonie.', ok: s => s.st.raidsWon >= 1, r: { cred: 2500 } },
    { n: 'Baue einen Kreuzer', d: 'Braucht Werft Stufe 2.', ok: s => fleetN(s, 'cruiser') >= 1, r: { crys: 200 } },
    { n: 'Zerstöre das Piratennest', d: 'Schicke Jäger und Kreuzer zum Piratennest.', ok: s => s.st.nestWins >= 1, r: { cred: 10000 } },
    { n: 'Kommandozentrale auf Stufe 4', d: 'Mehr Bauland und Gebäudestufen.', ok: s => hqLvl(s) >= 4, r: { crys: 300 } },
    { n: 'Erreiche 150 Bewohner', d: 'Eine richtige Stadt im All.', ok: s => s.pop >= 150, r: { cred: 15000 } },
    { n: 'Kommandozentrale auf Stufe 5', d: 'Die höchste Stufe.', ok: s => hqLvl(s) >= 5, r: { crys: 1000 } },
    { n: 'Baue ein Kolonieschiff', d: 'In der Werft (Stufe 3). Damit gründest du hinter dem Sprungtor eine neue Kolonie.', ok: s => s.st.colShips >= 1, r: { fuel: 400 } },
    { n: 'Gründe eine zweite Kolonie', d: 'Schicke das Kolonieschiff auf der Sternenkarte durchs Sprungtor.', ok: s => (s.cols || []).length >= 1, r: { cred: 20000 } },
    { n: 'Gründe beide Kolonien in Sektor 1', d: 'Boreas und Ignis: zusammen ein kleines Sternenreich.', ok: s => (s.cols || []).length >= 2, r: { crys: 2000, cred: 30000 } }
  ];
  const ACH = [
    { id: 'b1', e: '🏗️', n: 'Grundstein', d: 'Baue dein erstes Gebäude.', ok: s => s.st.built >= 1 },
    { id: 'b25', e: '🏙️', n: 'Stadtplaner', d: 'Baue 25 Gebäude.', ok: s => s.st.built >= 25 },
    { id: 'p50', e: '👩‍🚀', n: 'Kleine Gemeinde', d: 'Erreiche 50 Bewohner.', ok: s => s.pop >= 50 },
    { id: 'p200', e: '🌆', n: 'Metropole', d: 'Erreiche 200 Bewohner.', ok: s => s.pop >= 200 },
    { id: 's1', e: '🚀', n: 'Abheben', d: 'Baue dein erstes Raumschiff.', ok: s => s.st.shipsBuilt >= 1 },
    { id: 's10', e: '🛸', n: 'Flottenchef', d: 'Besitze 10 Schiffe.', ok: s => s.fleet.length >= 10 },
    { id: 'm1', e: '🗺️', n: 'Erste Reise', d: 'Schließe eine Mission ab.', ok: s => s.st.missionsDone >= 1 },
    { id: 'm25', e: '🧭', n: 'Weltraumhändler', d: 'Schließe 25 Missionen ab.', ok: s => s.st.missionsDone >= 25 },
    { id: 'x3', e: '🔭', n: 'Entdecker', d: 'Erkunde alle unbekannten Systeme.', ok: s => s.known.length >= 3 },
    { id: 'r1', e: '🛡️', n: 'Verteidiger', d: 'Wehre einen Piratenangriff ab.', ok: s => s.st.raidsWon >= 1 },
    { id: 'r10', e: '⚔️', n: 'Festung', d: 'Wehre 10 Piratenangriffe ab.', ok: s => s.st.raidsWon >= 10 },
    { id: 'n1', e: '☠️', n: 'Piratenschreck', d: 'Zerstöre das Piratennest.', ok: s => s.st.nestWins >= 1 },
    { id: 'hq5', e: '🏛️', n: 'Gouverneur', d: 'Kommandozentrale auf Stufe 5.', ok: s => hqLvl(s) >= 5 },
    { id: 'rs', e: '🔬', n: 'Wissenschaft', d: 'Erforsche alle Technologien.', ok: s => s.research.length >= RS.length },
    { id: 'c1', e: '🪐', n: 'Kolonist', d: 'Gründe eine zweite Kolonie.', ok: s => (s.cols || []).length >= 1 },
    { id: 'c2', e: '🌌', n: 'Sternenreich', d: 'Gründe alle Kolonien in Sektor 1.', ok: s => (s.cols || []).length >= SITES.length }
  ];

  // ---------- Zustand ----------
  let S = null;
  const has = (s, k) => s.bld.some(b => b.type === k && !b.build);
  const hqLvl = s => (s.bld.find(b => b.type === 'hq') || { lvl: 1 }).lvl;
  const fleetN = (s, t) => s.fleet.filter(f => f.type === t && f.state !== 'lost').length;
  const R = k => S.research.includes(k);
  function rng(seed) { let x = seed % 2147483647; if (x <= 0) x += 2147483646; return () => (x = x * 16807 % 2147483647) / 2147483647; }
  function terrain(seed, kind) {
    const r = rng(seed), t = []; for (let i = 0; i < N; i++) { t.push([]); for (let j = 0; j < N; j++) t[i].push('rock'); }
    const blob = (type, n, size) => { for (let k = 0; k < n; k++) { let i = 2 + Math.floor(r() * (N - 4)), j = 2 + Math.floor(r() * (N - 4)); if (Math.abs(i - 7.5) < 2.5 && Math.abs(j - 7.5) < 2.5) { k--; continue; } for (let q = 0; q < size; q++) { if (t[i] && t[i][j] === 'rock') t[i][j] = type; i += Math.round(r() * 2 - 1); j += Math.round(r() * 2 - 1); i = Math.max(0, Math.min(N - 1, i)); j = Math.max(0, Math.min(N - 1, j)); } } };
    if (kind === 'ice') { blob('ore', 3, 3); blob('crys', 6, 4); blob('crater', 4, 1); }
    else if (kind === 'lava') { blob('ore', 8, 4); blob('crys', 2, 3); blob('crater', 9, 1); }
    else { blob('ore', 5, 4); blob('crys', 3, 3); blob('crater', 6, 1); }
    t[4][5] = 'ore'; t[5][4] = 'ore'; t[10][11] = 'crys'; t[11][10] = 'crys';          // garantiert in der Nähe des Starts
    return t;
  }
  function fresh() {
    const seed = 1 + Math.floor(Math.random() * 2e9);
    return { v: 1, seed, name: 'Nova Prime', created: now(), lastSave: now(), playMs: 0,
      res: { ore: 400, crys: 0, parts: 0, fuel: 0, cred: 500 }, pop: 6, popF: 6,
      bld: [{ id: 1, type: 'hq', i: 7, j: 7, lvl: 1 }], nid: 2,
      fleet: [], sid: 1, queue: [], missions: [], mid: 1, known: [], research: [], rq: null,
      quest: 0, ach: [], st: { built: 0, shipsBuilt: 0, missions: 0, missionsDone: 0, raids: 0, raidsWon: 0, nestWins: 0, colShips: 0 },
      cid: 0, kind: 'rock', site: null, cols: [], cidN: 1,
      raid: { next: 26 * 60, warn: 0, str: 0 }, merch: { next: 7 * 60, offer: null, left: 0 }, nest: 0, nestQuietUntil: 0,
      log: [], cam: null, opt: { fx: 'full', dn: 1 } };
  }
  let T = null;                                     // Gelände (aus seed)
  // ---------- Mehrere Kolonien ----------
  // Die gerade angezeigte Kolonie liegt oben in S (bld, pop, seed …), die anderen in S.cols. Rohstoffe, Flotte und Forschung gehören allen.
  const COLF = ['cid', 'seed', 'name', 'kind', 'site', 'bld', 'pop', 'popF', 'raid', 'cam'];
  const TC = {}; const terr = (seed, kind) => TC[seed + kind] || (TC[seed + kind] = terrain(seed, kind));
  let inCol = 0, aggO = { store: 0, docks: 0 };
  function withCol(c, fn) { const keep = {}; for (const k of COLF) { keep[k] = S[k]; S[k] = c[k]; } const kT = T; T = terr(c.seed, c.kind); inCol++;
    try { return fn(); } finally { inCol--; for (const k of COLF) { c[k] = S[k]; S[k] = keep[k]; } T = kT; } }
  function calcAgg() { let st = 0, dk = 0; for (const c of S.cols) withCol(c, () => { const o = stats(); st += o.store; dk += o.docks; }); aggO = { store: st, docks: dk }; }
  const colList = () => [{ cid: S.cid, name: S.name, kind: S.kind, site: S.site, bld: S.bld, pop: S.pop, active: true }].concat(S.cols.map(c => ({ cid: c.cid, name: c.name, kind: c.kind, site: c.site, bld: c.bld, pop: c.pop, active: false }))).sort((a, b) => a.cid - b.cid);
  function switchCol(cid) {
    if (cid === S.cid) return true; const c = S.cols.find(x => x.cid === cid); if (!c) return false;
    const pack = {}; for (const k of COLF) { pack[k] = S[k]; S[k] = c[k]; } S.cols = S.cols.filter(x => x !== c).concat([pack]).sort((a, b) => a.cid - b.cid);
    T = terr(S.seed, S.kind); calcAgg(); return true;
  }
  const mainDo = fn => { if (S.cid === 0) return fn(); const m = S.cols.find(c => c.cid === 0); return m ? withCol(m, fn) : fn(); };
  const founded = id => S.site === id || S.cols.some(c => c.site === id);
  function foundColony(siteId) {
    const z = SITES.find(x => x.id === siteId); if (!z || founded(siteId)) return null;
    const c = { cid: S.cidN++, seed: 1 + Math.floor(Math.random() * 2e9), name: z.n, kind: z.kind, site: z.id, bld: [{ id: S.nid++, type: 'hq', i: 7, j: 7, lvl: 1 }], pop: 6, popF: 6, raid: { next: 40 * 60, warn: 0, str: 0 }, cam: null };
    S.cols.push(c); calcAgg(); return c;
  }
  const tileAt = (i, j) => (T[i] && T[i][j]) || 'void';
  const area = s => { const l = hqLvl(s), r = [5, 5, 6, 7, 8, 8][l] || 8; return { lo: 8 - r, hi: 8 + r - 1 }; };
  const inArea = (i, j) => { const a = area(S); return i >= a.lo && i <= a.hi && j >= a.lo && j <= a.hi; };
  const bAt = (i, j) => S.bld.find(b => i >= b.i && i < b.i + B[b.type].s && j >= b.j && j < b.j + B[b.type].s);

  // ---------- Kennzahlen ----------
  function stats() {
    let eP = 0, eU = 0, house = 0, food = 0, work = 0, store = 1500, def = 0, prot = 0, docks = 0, labLvl = 0, yards = [];
    const hq = hqLvl(S); store += (hq - 1) * 1000;
    for (const b of S.bld) {
      const d = B[b.type]; if (b.build && !b.up) continue; const off = b.dmg || b.up; const l = b.type === 'hq' ? 1 : b.lvl;
      if (b.type === 'hq') { eP += d.e * b.lvl; house += d.house * b.lvl; continue; }
      if (d.house && !b.dmg) house += d.house * LVF[l];
      if (d.store && !b.dmg) store += d.store * LVF[l];
      if (d.dock && !b.build) docks += d.dock + (l - 1);
      if (off) continue;
      if (d.e > 0) eP += d.e * LVF[l]; else if (d.e < 0) eU += -d.e * LVE[l];
      if (d.w) work += d.w * LVW[l];
      if (d.food) food += d.food * LVF[l];
      if (d.def) def += d.def * LVF[l];
      if (d.prot) prot = Math.max(prot, d.prot + .1 * (l - 1));
      if (b.type === 'lab') labLvl = Math.max(labLvl, l);
      if (b.type === 'yard') yards.push(b);
    }
    if (R('solar2')) eP *= 1.3; if (R('hydro')) food *= 1.5; if (R('logi')) store *= 1.5;
    const eff = eU <= 0 ? 1 : Math.min(1, eP / eU), wf = work <= 0 ? 1 : Math.min(1, S.pop / work);
    let fdef = 0, fatk = 0; for (const f of S.fleet) if (f.state === 'home') { fdef += SH[f.type].def; } if (R('armor')) { def *= 1.4; fdef *= 1.4; }
    if (!inCol) { store += aggO.store; docks += aggO.docks; }
    return { eP, eU, eff, house, food, cap: Math.floor(Math.min(house, food + 6)), work, wf, f: eff * wf, store: Math.round(store), def: Math.round(def + fdef), towerDef: Math.round(def), prot, docks, labLvl, yards, hq };
  }
  function rates(st) {
    const r = { ore: 0, crys: 0, parts: 0, fuel: 0, cred: 0 }, use = { ore: 0 };
    for (const b of S.bld) {
      const d = B[b.type]; if (b.build || b.dmg) continue; const l = b.lvl;
      if (d.out) for (const k in d.out) { let v = d.out[k] * LVF[l] * st.f; if (k === 'ore') { if (tileAt(b.i, b.j) === 'ore') v *= 1.6; if (R('drill')) v *= 1.3; } r[k] += v; }
      if (d.conv) { const m = st.f * LVF[l] * (R('auto') ? 1.3 : 1); use.ore += d.conv.ore * LVF[l] * st.f; r[d.conv.out] += d.conv.rate * m; }
    }
    return { r, use };
  }
  const shipCost = t => { const c = {}; for (const k in SH[t].cost) c[k] = Math.round(SH[t].cost[k] * (R('light') ? .8 : 1)); return c; };
  const canPay = c => Object.entries(c || {}).every(([k, v]) => (S.res[k] || 0) >= v);
  const pay = c => { for (const k in c) S.res[k] -= c[k]; };
  const give = (c, st) => { st = st || stats(); for (const k in c) { S.res[k] = (S.res[k] || 0) + c[k]; if (k !== 'cred') S.res[k] = Math.min(S.res[k], Math.max(st.store, S.res[k] - c[k])); } };

  // ---------- Simulation ----------
  const events = [];                                  // für die Oberfläche: {type, ...}
  const emit = e => events.push(e);
  function tick(dt, quiet) {
    const t = now(), st = stats();
    // Bauarbeiten
    for (const b of S.bld) if (b.build && t >= b.build) { const wasUp = b.up; b.build = 0; if (b.up) { b.lvl = b.up; b.up = 0; } S.st.built += wasUp ? 0 : 1; if (!quiet) emit({ type: 'built', b, up: !!wasUp }); }
    // Produktion
    const { r, use } = rates(st);
    if (use.ore > 0) { const need = use.ore * dt, avail = S.res.ore + r.ore * dt, k = need > 0 ? Math.min(1, avail / need) : 1; r.parts *= k; r.fuel *= k; S.res.ore -= Math.min(need, avail) ; }
    for (const k of ['ore', 'crys', 'parts', 'fuel']) { S.res[k] = Math.max(0, Math.min(st.store, S.res[k] + r[k] * dt)); }
    // Bevölkerung
    const cap = st.cap; if (S.popF < cap) S.popF = Math.min(cap, S.popF + dt * (.25 + cap * .004)); else S.popF = Math.max(cap, S.popF - dt * 1); S.pop = Math.floor(S.popF);
    // Werft
    for (const q of S.queue) if (!q.done && t >= q.end) { q.done = 1; const f = S.fleet.find(x => x.id === q.ship); if (f) { f.state = 'home'; S.st.shipsBuilt++; if (!quiet) emit({ type: 'ship', f }); } }
    S.queue = S.queue.filter(q => !q.done);
    // Forschung
    if (S.rq && t >= S.rq.end) { S.research.push(S.rq.id); if (!quiet) emit({ type: 'research', id: S.rq.id }); S.rq = null; }
    // Missionen
    for (const m of S.missions) if (!m.done && t >= m.end) resolveMission(m, quiet);
    S.missions = S.missions.filter(m => !m.done);
    // Ereignisse nur beim Spielen
    if (!quiet) events_(dt, st);
    // andere Kolonien laufen im Hintergrund mit (Produktion in den gemeinsamen Vorrat)
    if (S.cols.length) { const cap = st.store; for (const c of S.cols) withCol(c, () => colTick(dt, quiet, cap)); calcAgg(); }
    mainDo(() => { checkQuest(quiet); checkAch(quiet); });
  }
  function colTick(dt, quiet, cap) {
    const t = now();
    for (const b of S.bld) if (b.build && t >= b.build) { const wasUp = b.up; b.build = 0; if (b.up) { b.lvl = b.up; b.up = 0; } S.st.built += wasUp ? 0 : 1; if (!quiet) emit({ type: 'built', b, up: !!wasUp, col: S.name }); }
    const st = stats(), { r, use } = rates(st);
    if (use.ore > 0) { const need = use.ore * dt, avail = S.res.ore + r.ore * dt, k = need > 0 ? Math.min(1, avail / need) : 1; r.parts *= k; r.fuel *= k; S.res.ore -= Math.min(need, avail); }
    for (const k of ['ore', 'crys', 'parts', 'fuel']) S.res[k] = Math.max(0, Math.min(Math.max(cap, S.res[k]), S.res[k] + r[k] * dt));
    const c2 = st.cap; if (S.popF < c2) S.popF = Math.min(c2, S.popF + dt * (.25 + c2 * .004)); else S.popF = Math.max(c2, S.popF - dt); S.pop = Math.floor(S.popF);
    if (!quiet && st.hq >= 2 && now() > S.nestQuietUntil) { const R_ = S.raid; if (R_.warn > 0) { R_.warn -= dt; if (R_.warn <= 0) { R_.warn = 0; fightRaid(st, S.name); } } else { R_.next -= dt; if (R_.next <= 0) { R_.warn = 120; R_.str = Math.round(40 + S.st.raids * 18 + st.hq * 25); emit({ type: 'raidWarn', str: R_.str, col: S.name }); } } }
  }
  function events_(dt, st) {
    // Piraten
    const R_ = S.raid;
    if (st.hq >= 2 && now() > S.nestQuietUntil) {
      if (R_.warn > 0) { R_.warn -= dt; if (R_.warn <= 0) { R_.warn = 0; fightRaid(st); } }
      else { R_.next -= dt; if (R_.next <= 0) { R_.warn = 120; R_.str = Math.round(40 + S.st.raids * 18 + st.hq * 25); emit({ type: 'raidWarn', str: R_.str }); } }
    }
    // Händler
    const M = S.merch;
    if (M.offer) { M.left -= dt; if (M.left <= 0) { M.offer = null; M.next = 360 + Math.random() * 360; emit({ type: 'merchGone' }); } }
    else { M.next -= dt; if (M.next <= 0) { M.offer = offer(); M.left = 120; emit({ type: 'merch', o: M.offer }); } }
  }
  function offer() {
    const hq = hqLvl(S), m = 1 + (hq - 1) * .8, L = [
      { give: { ore: Math.round(600 * m) }, get: { crys: Math.round(30 * m) } },
      { give: { ore: Math.round(500 * m) }, get: { cred: Math.round(400 * m) } },
      { give: { cred: Math.round(500 * m) }, get: { parts: Math.round(40 * m) } },
      { give: { cred: Math.round(400 * m) }, get: { fuel: Math.round(120 * m) } }];
    if (hq >= 2) L.push({ give: { parts: Math.round(40 * m) }, get: { cred: Math.round(800 * m) } }, { give: { fuel: Math.round(100 * m) }, get: { crys: Math.round(25 * m) } });
    return L[Math.floor(Math.random() * L.length)];
  }
  function acceptOffer() { const o = S.merch.offer; if (!o || !canPay(o.give)) return false; pay(o.give); give(o.get); S.merch.offer = null; S.merch.next = 360 + Math.random() * 360; save(); return true; }
  function fightRaid(st, col) {
    const str = S.raid.str, def = st.def; S.st.raids++;
    const res = { type: 'raid', str, def, won: def >= str, loss: {}, dmg: null, col: col || null };
    if (res.won) { const c = Math.round(300 + 60 * S.st.raidsWon); give({ cred: c }); res.loss = null; res.gain = { cred: c }; S.st.raidsWon++; }
    else { const k = .14 * (1 - st.prot); for (const r of ['ore', 'parts', 'fuel', 'crys']) { const v = Math.floor(S.res[r] * k); if (v > 0) { S.res[r] -= v; res.loss[r] = v; } }
      const cand = S.bld.filter(b => b.type !== 'hq' && !b.build && !b.dmg); if (cand.length && Math.random() > st.prot) { const b = cand[Math.floor(Math.random() * cand.length)]; b.dmg = 1; res.dmg = b; }
      // Jäger zu Hause können verloren gehen
      const home = S.fleet.filter(f => f.state === 'home' && (f.type === 'fighter')); const lose = Math.floor(home.length * .3); for (let q = 0; q < lose; q++) home[q].state = 'lost'; res.lostShips = lose; }
    S.fleet = S.fleet.filter(f => f.state !== 'lost');
    S.raid.next = (18 + Math.random() * 12) * 60; S.raid.str = 0;
    log((res.won ? '🛡️ Piratenangriff abgewehrt' : '💥 Piratenangriff verloren') + (col ? ' (' + col + ')' : ''), res.won ? 'good' : 'bad');
    emit(res); save();
  }
  const repairCost = b => { const c = upCost(b.type, Math.max(1, b.lvl)), o = {}; for (const k in c) o[k] = Math.ceil(c[k] * .3); return o; };
  function repair(b) { const c = repairCost(b); if (!canPay(c)) return false; pay(c); b.dmg = 0; save(); return true; }

  // ---------- Bauen ----------
  function canPlace(k, i, j, ign) {
    const d = B[k]; if (!d) return { ok: false, why: '' };
    for (let a = 0; a < d.s; a++) for (let c = 0; c < d.s; c++) { const t = tileAt(i + a, j + c); if (t === 'void' || t === 'crater' || !inArea(i + a, j + c)) return { ok: false, why: t === 'crater' ? 'Krater' : 'außerhalb des Baulands' }; { const o = bAt(i + a, j + c); if (o && o !== ign) return { ok: false, why: 'belegt' }; } }
    if (d.tile && tileAt(i, j) !== d.tile) return { ok: false, why: 'nur auf Kristallfeldern' };
    return { ok: true };
  }
  function unlocked(k) { return hqLvl(S) >= B[k].hq; }
  function place(k, i, j, rot) {
    const d = B[k]; if (!unlocked(k)) return { ok: false, why: `ab Kommandozentrale Stufe ${d.hq}` };
    const p = canPlace(k, i, j); if (!p.ok) return p; if (!canPay(d.cost)) return { ok: false, why: 'nicht genug Rohstoffe' };
    pay(d.cost); const b = { id: S.nid++, type: k, i, j, lvl: 1, build: now() + d.time * 1000, t0: now() }; if (rot) b.rot = rot & 3; S.bld.push(b); save(); return { ok: true, b };
  }
  function move(b, i, j) {
    if (!S.bld.includes(b)) return { ok: false, why: '' }; if (b.i === i && b.j === j) return { ok: true, same: true };
    const p = canPlace(b.type, i, j, b); if (!p.ok) return p; b.i = i; b.j = j; save(); return { ok: true };
  }
  function rotate(b) { if (!S.bld.includes(b)) return false; b.rot = ((b.rot || 0) + 1) & 3; save(); return true; }
  function maxLvl(k) { const hq = hqLvl(S); return k === 'hq' ? 5 : Math.min(B[k].max, hq >= 4 ? 3 : hq >= 3 ? 2 : hq >= 2 ? 2 : 1); }
  function upgrade(b) {
    const nl = b.lvl + 1; if (b.build || b.dmg) return { ok: false, why: 'gerade beschäftigt' };
    if (b.type === 'hq' ? nl > 5 : nl > maxLvl(b.type)) return { ok: false, why: nl > B[b.type].max ? 'höchste Stufe' : 'Kommandozentrale zuerst ausbauen' };
    const c = upCost(b.type, nl); if (!canPay(c)) return { ok: false, why: 'nicht genug Rohstoffe' };
    pay(c); b.up = nl; b.t0 = now(); b.build = now() + upTime(b.type, nl) * 1000; save(); return { ok: true };
  }
  function demolish(b) {
    if (b.type === 'hq') return false; if (b.type === 'yard' && S.queue.some(q => q.yard === b.id)) return false;
    const d = B[b.type]; if (!b.build) give(Object.fromEntries(Object.entries(d.cost).map(([k, v]) => [k, Math.floor(v * .5)])));
    else if (!b.up) give(d.cost);
    S.bld = S.bld.filter(x => x !== b); fixDocks(); save(); return true;
  }
  function fixDocks() { const st = stats(); let home = S.fleet.filter(f => f.state === 'home' || f.state === 'building'); }   // Schiffe bleiben, auch wenn ein Landeplatz fehlt (sie warten im Orbit)

  // ---------- Werft ----------
  const busyYards = () => new Set(S.queue.map(q => q.yard));
  function canBuild(t) {
    const st = stats(), d = SH[t]; if (d.locked) return { ok: false, why: 'kommt später' };
    if (!st.yards.length) return { ok: false, why: 'Werft nötig' };
    if (d.yard && !st.yards.some(y => y.lvl >= d.yard)) return { ok: false, why: `Werft Stufe ${d.yard} nötig` };
    if (d.hq && mainDo(() => hqLvl(S)) < d.hq) return { ok: false, why: `Kommandozentrale (Nova Prime) Stufe ${d.hq} nötig` };
    if (t === 'colony' && fleetN(S, 'colony') + SITES.filter(z => founded(z.id)).length >= SITES.length) return { ok: false, why: 'Alle Kolonieplätze vergeben' };
    if (S.fleet.length + 0 >= st.docks) return { ok: false, why: 'Landeplätze voll' };
    const free = st.yards.find(y => !busyYards().has(y.id)); if (!free) return { ok: false, why: 'Werft beschäftigt' };
    if (!canPay(shipCost(t))) return { ok: false, why: 'nicht genug Rohstoffe' };
    return { ok: true, yard: free };
  }
  function buildShip(t) {
    const c = canBuild(t); if (!c.ok) return c; pay(shipCost(t));
    const f = { id: S.sid++, type: t, name: NAMES[(S.sid - 2) % NAMES.length] + (S.sid > NAMES.length + 1 ? ' ' + Math.ceil((S.sid - 1) / NAMES.length) : ''), state: 'building' };
    const speed = [1, 1, 1.5, 2][c.yard.lvl] || 1; if (t === 'colony') S.st.colShips = (S.st.colShips || 0) + 1; S.fleet.push(f); S.queue.push({ ship: f.id, yard: c.yard.id, t0: now(), end: now() + SH[t].time * 1000 / speed });
    save(); return { ok: true, f };
  }
  function scrapShip(f) { if (f.state !== 'home') return false; const c = shipCost(f.type); give(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.floor(v * .4)]))); S.fleet = S.fleet.filter(x => x !== f); save(); return true; }

  // ---------- Missionen ----------
  const home = t => S.fleet.filter(f => f.state === 'home' && f.type === t);
  const known = id => { const s = SBY[id]; return s.known || S.known.includes(id); };
  function missionInfo(sys, m, sel) {
    const n = Object.values(sel).reduce((a, b) => a + b, 0), fuel = n * m.fuel, dur = Math.round(m.dur * (R('warp') ? .75 : 1));
    const take = m.take ? m.take(sel) : {}, gain = m.give ? m.give(sel) : {}; const need = Object.assign({ fuel: 0 }, take); need.fuel = (need.fuel || 0) + fuel;
    return { n, fuel, dur, take, gain, need };
  }
  function launch(sysId, mId, sel) {
    const sys = SBY[sysId], m = sysId === '?' ? null : (sys.m || []).find(x => x.id === mId);
    const isExplore = mId === 'explore';
    const mm = isExplore ? { id: 'explore', n: 'Erkunden', ships: ['scout'], dur: 150, fuel: 12 } : m; if (!mm) return { ok: false, why: '' };
    for (const t in sel) if (sel[t] > home(t).length || !mm.ships.includes(t)) return { ok: false, why: 'Schiffe nicht verfügbar' };
    const info = missionInfo(sys, mm, sel); if (info.n < 1) return { ok: false, why: 'Wähle mindestens ein Schiff' };
    if (mm.found) { if (founded(mm.found) || S.missions.some(x => x.m === mm.id)) return { ok: false, why: 'Dort gibt es schon eine Kolonie' }; if ((sel.colony || 0) !== 1) return { ok: false, why: 'Schicke genau ein Kolonieschiff' }; }
    if (!canPay(info.need)) return { ok: false, why: 'nicht genug ' + (S.res.fuel < info.need.fuel ? 'Treibstoff' : 'Rohstoffe') };
    pay(info.need); const ids = []; for (const t in sel) home(t).slice(0, sel[t]).forEach(f => { f.state = 'away'; ids.push(f.id); });
    const ms = { id: S.mid++, sys: sysId, m: mm.id, ships: ids, sel: Object.assign({}, sel), t0: now(), end: now() + info.dur * 1000 };
    S.missions.push(ms); S.st.missions++; save(); return { ok: true, ms };
  }
  function resolveMission(ms, quiet) {
    ms.done = 1; const sys = SBY[ms.sys], ships = S.fleet.filter(f => ms.ships.includes(f.id)); let rep = { type: 'mission', sys: sys.n, ok: true, gain: {}, lost: 0, title: '' };
    if (ms.m === 'explore') { const unk = ['vega', 'wrack', 'titan'].filter(x => !S.known.includes(x)); const pick = sys && !sys.known && !S.known.includes(sys.id) ? sys.id : unk[0];
      if (pick) { S.known.push(pick); rep.title = `${SBY[pick].n} entdeckt!`; rep.gain = { crys: 20, cred: 300 }; } else { rep.title = 'Nichts Neues gefunden'; rep.gain = { cred: 200 }; } }
    else { const m = (sys.m || []).find(x => x.id === ms.m);
      if (m && m.combat) { const atk = ships.reduce((a, f) => a + SH[f.type].atk, 0) * (R('armor') ? 1.4 : 1), str = Math.round(160 * Math.pow(1.7, S.nest));
        rep.combat = { atk: Math.round(atk), str };
        if (atk >= str) { const lose = Math.floor(ships.length * Math.min(.5, .25 * str / atk)); ships.slice(0, lose).forEach(f => f.state = 'lost'); rep.lost = lose; rep.gain = { crys: 150 + 80 * S.nest, cred: 2000 + 1500 * S.nest }; rep.title = 'Piratennest zerstört!'; S.nest++; S.st.nestWins++; S.nestQuietUntil = now() + 90 * 60e3; S.raid.warn = 0; }
        else { const lose = Math.ceil(ships.length * .6); ships.slice(0, lose).forEach(f => f.state = 'lost'); rep.lost = lose; rep.ok = false; rep.title = 'Angriff gescheitert'; rep.gain = {}; } }
      else if (m && m.found) { const c = foundColony(m.found); ships.forEach(f => f.state = 'lost'); S.fleet = S.fleet.filter(f => f.state !== 'lost'); if (c) { rep.title = `Kolonie ${c.name} gegründet!`; rep.found = c.cid; rep.gain = {}; } else { rep.title = 'Kolonie war schon gegründet'; rep.ok = false; } }
      else if (m) { rep.gain = m.give ? m.give(ms.sel) : {}; rep.title = m.n + ' erfolgreich'; } }
    give(rep.gain); ships.forEach(f => { if (f.state !== 'lost') f.state = 'home'; }); S.fleet = S.fleet.filter(f => f.state !== 'lost');
    S.st.missionsDone++; rep.ships = ships.filter(f => f.state === 'home').map(f => f.type); log((rep.ok ? '✅ ' : '❌ ') + rep.title, rep.ok ? 'good' : 'bad');
    if (!quiet) emit(rep); else offlineReports.push(rep);
  }
  const offlineReports = [];

  // ---------- Forschung ----------
  function startResearch(id) {
    const r = RS.find(x => x.id === id), st = stats(); if (!r || S.research.includes(id) || S.rq) return { ok: false, why: S.rq ? 'Forschung läuft bereits' : '' };
    if (!st.labLvl) return { ok: false, why: 'Forschungslabor nötig' }; if (!canPay(r.cost)) return { ok: false, why: 'nicht genug Rohstoffe' };
    pay(r.cost); S.rq = { id, t0: now(), end: now() + r.time * 1000 / [1, 1, 1.5, 2][st.labLvl] }; save(); return { ok: true };
  }

  // ---------- Markt ----------
  const MARKET = [{ r: 'ore', n: 100, sell: 35, buy: 90 }, { r: 'parts', n: 10, sell: 110, buy: 260 }, { r: 'fuel', n: 20, sell: 50, buy: 130 }, { r: 'crys', n: 10, sell: 180, buy: 420 }];
  function trade(r, dir) { const m = MARKET.find(x => x.r === r); const st = stats(); if (dir === 'sell') { if (S.res[r] < m.n) return false; S.res[r] -= m.n; S.res.cred += m.sell; }
    else { if (S.res.cred < m.buy || S.res[r] + m.n > st.store) return false; S.res.cred -= m.buy; S.res[r] += m.n; } return true; }

  // ---------- Aufträge & Erfolge ----------
  function checkQuest(quiet) { while (S.quest < Q.length && Q[S.quest].ok(S)) { const q = Q[S.quest]; give(q.r); S.quest++; if (!quiet) emit({ type: 'quest', q }); } }
  function checkAch(quiet) { for (const a of ACH) if (!S.ach.includes(a.id) && a.ok(S)) { S.ach.push(a.id); if (!quiet) emit({ type: 'ach', a }); } }
  function log(t, kind) { S.log.unshift({ t, kind, at: now() }); S.log = S.log.slice(0, 30); }

  // ---------- Speichern ----------
  function valid(o) { return o && o.v === 1 && Array.isArray(o.bld) && o.res && typeof o.res === 'object'; }
  function load() {
    let o = null; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; }
    if (!valid(o)) return false;
    const f = fresh(); S = Object.assign(f, o); S.st = Object.assign(fresh().st, o.st || {}); S.raid = Object.assign(f.raid, o.raid || {}); S.merch = Object.assign(f.merch, o.merch || {}); S.opt = Object.assign(f.opt, o.opt || {});
    for (const k of RES) S.res[k] = Math.max(0, +S.res[k] || 0);
    S.cols = Array.isArray(o.cols) ? o.cols : []; if (S.cid == null) S.cid = 0; if (!S.kind) S.kind = 'rock'; if (!S.cidN) S.cidN = 1 + S.cols.reduce((a, c) => Math.max(a, c.cid), 0);
    T = terr(S.seed, S.kind); calcAgg(); if (o.view && S.cols.some(c => c.cid === o.view)) switchCol(o.view); delete S.view; return true;
  }
  function newGame() { S = fresh(); T = terr(S.seed, S.kind); aggO = { store: 0, docks: 0 }; save(); }
  let lastWrite = 0;
  function save() { if (!S || inCol) return; S.lastSave = now();
    // gespeichert wird immer mit der Hauptkolonie oben (Game Center und ältere Stände lesen das so); die angezeigte merkt sich view
    let o = S; if (S.cid !== 0) { const m = S.cols.find(c => c.cid === 0); if (m) { o = Object.assign({}, S); const pack = {}; for (const k of COLF) { pack[k] = S[k]; o[k] = m[k]; } o.cols = S.cols.map(c => c === m ? pack : c); o.view = S.cid; } }
    try { localStorage.setItem(KEY, JSON.stringify(o)); lastWrite = now(); } catch (e) { } }
  // Offline weiterrechnen (max. 8 Std, nur Produktion, fertige Bauten, Schiffe, Forschung, Missionen)
  function catchUp() {
    const away = Math.min(OFFLINE_MAX, Math.max(0, now() - (S.lastSave || now())));
    if (away < 60e3) return null;
    const before = Object.assign({}, S.res), steps = Math.min(480, Math.ceil(away / 60e3)), dt = away / steps / 1000;
    // Zeitpunkte der Bauarbeiten bleiben absolut; Produktion schrittweise
    const realNow = Date.now; let fake = S.lastSave; Date.now = () => fake;
    try { for (let k = 0; k < steps; k++) { fake += dt * 1000; tick(dt, true); } } finally { Date.now = realNow; }
    const gain = {}; for (const k of RES) { const d = Math.round(S.res[k] - before[k]); if (d) gain[k] = d; }
    return { away, gain, reports: offlineReports.splice(0) };
  }

  window.G = {
    KEY, N, B, SH, SYS, SBY, LANES, RS, Q, ACH, CATS, RN, RES, MARKET, LVF, SITES,
    get S() { return S; }, get T() { return T; }, tileAt, inArea, area, bAt, stats, rates, upCost, upTime, maxLvl, unlocked, canPlace, place, move, upgrade, demolish, repair, repairCost,
    canBuild, buildShip, scrapShip, shipCost, home, known, missionInfo, launch, startResearch, trade, acceptOffer, canPay, hqLvl: () => hqLvl(S), fleetN: t => fleetN(S, t),
    tick, events, load, newGame, save, catchUp, valid, log, cargo, rotate, colList, switchCol, founded, mainHq: () => mainDo(() => hqLvl(S))
  };
})();
