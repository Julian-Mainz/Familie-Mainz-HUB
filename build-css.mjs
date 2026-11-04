// Baut für jede Seite eine eigene, kleine CSS-Datei (assets/css/<seite>.css) mit Tailwind.
// Aufruf: npm install && npm run build:css  (läuft auch automatisch über GitHub Actions)
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import cssnano from 'cssnano';

// Klassen, die erst zur Laufzeit im Browser zusammengesetzt werden (Finanzen: bg-xyz -> text-xyz)
const safelist = [{ pattern: /^text-(emerald|yellow|indigo|orange|pink|cyan|teal|slate)-(400|500)$/ }];

const pages = fs.readdirSync('.').filter(f => f.endsWith('.html'));
fs.mkdirSync('assets/css', { recursive: true });

for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    // Eigene Komponenten-Klassen (.card, .inp ...) stehen in <style type="text/tailwindcss"> der jeweiligen Seite
    const blocks = [...html.matchAll(/<style type="text\/tailwindcss">([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
    const input = `@tailwind base;\n@tailwind components;\n${blocks ? `@layer components {\n${blocks}\n}` : ''}\n@tailwind utilities;\n`;
    const config = { content: [{ raw: html, extension: 'html' }, './js/**/*.js'], safelist };
    const result = await postcss([tailwind(config), cssnano({ preset: 'default' })]).process(input, { from: undefined });
    const out = `assets/css/${path.basename(page, '.html')}.css`;
    fs.writeFileSync(out, result.css);
    console.log(`${out}  ${(result.css.length / 1024).toFixed(1)} KB`);
}
