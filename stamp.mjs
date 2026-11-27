// stamp.mjs - hängt an alle eingebundenen JS- und CSS-Dateien eine Versionsnummer (?v=<Prüfsumme>).
// Ändert sich eine Datei, ändert sich ihre Nummer, und jeder Browser lädt sie neu (kein Strg+F5 mehr nötig).
// Unveränderte Dateien behalten ihre Nummer und bleiben im Zwischenspeicher. Läuft automatisch über GitHub Actions.
// Aufruf: node stamp.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SKIP = new Set(['node_modules', '.git', '.github']);
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => SKIP.has(d.name) || d.name.startsWith('.') ? [] : d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
const all = walk('.').map(f => f.split(path.sep).join('/'));
const hash = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 8);
const isAsset = f => /\.(js|css)$/.test(f);

// 1) Versionstabelle für nachgeladene Skripte in js/theme.js eintragen (ohne theme.js selbst)
const table = {};
for (const f of all) if ((f.startsWith('js/') || f.startsWith('assets/') || f.startsWith('OS/')) && isAsset(f) && f !== 'js/theme.js') table['/' + f] = hash(f);
const themeFile = 'js/theme.js', theme = fs.readFileSync(themeFile, 'utf8');
const sorted = Object.fromEntries(Object.keys(table).sort().map(k => [k, table[k]]));
const nextTheme = theme.replace(/window\.ASSET_V = \{.*?\}; \/\*ASSET_V\*\//, `window.ASSET_V = ${JSON.stringify(sorted)}; /*ASSET_V*/`);
if (nextTheme !== theme) fs.writeFileSync(themeFile, nextTheme);
table['/js/theme.js'] = hash(themeFile);

// 2) In allen HTML-Seiten src/href auf lokale JS-/CSS-Dateien mit ?v= versehen
let changed = 0;
for (const page of all.filter(f => f.endsWith('.html'))) {
    const html = fs.readFileSync(page, 'utf8'), dir = path.posix.dirname(page);
    const out = html.replace(/\b(src|href)="([^"?#]+\.(?:js|css))(\?v=[0-9a-f]*)?"/g, (m, attr, url) => {
        if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return m;
        const file = url.startsWith('/') ? url.slice(1) : path.posix.normalize(path.posix.join(dir, url));
        if (!fs.existsSync(file)) return m;
        const v = table['/' + file] || hash(file);
        return `${attr}="${url}?v=${v}"`;
    });
    if (out !== html) { fs.writeFileSync(page, out); changed++; }
}
console.log(`Versionen gestempelt: ${changed} Seiten geändert, ${Object.keys(table).length} Dateien in der Tabelle`);
