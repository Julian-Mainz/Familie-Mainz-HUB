// OS/zip.js – ZIP-Archive im Browser lesen und schreiben (ohne Bibliothek).
// Lesen: gespeichert (0) und Deflate (8). Schreiben: Deflate, bei Dateien, die nicht kleiner werden, unkomprimiert.
(function () {
    'use strict';
    const u16 = (b, o) => b[o] | (b[o + 1] << 8), u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
    const pipe = (data, s) => new Response(new Blob([data]).stream().pipeThrough(s)).arrayBuffer().then(b => new Uint8Array(b));
    const inflate = d => pipe(d, new DecompressionStream('deflate-raw'));
    const deflate = d => pipe(d, new CompressionStream('deflate-raw'));
    const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    const crc32 = d => { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const utf8 = new TextDecoder('utf-8', { fatal: true }), latin = new TextDecoder('windows-1252');
    const nameOf = (bytes, flag) => { if (flag & 0x800) return new TextDecoder().decode(bytes); try { return utf8.decode(bytes); } catch (x) { return latin.decode(bytes); } };

    // Inhaltsverzeichnis lesen: [{ name, size, csize, method, off, dir, date }]
    function list(buf) {
        const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
        let e = b.length - 22; while (e >= 0 && u32(b, e) !== 0x06054b50) e--;
        if (e < 0) throw new Error('Das ist keine gültige ZIP-Datei.');
        const n = u16(b, e + 10); let p = u32(b, e + 16); const out = [];
        for (let i = 0; i < n; i++) {
            if (u32(b, p) !== 0x02014b50) throw new Error('Die ZIP-Datei ist beschädigt.');
            const flag = u16(b, p + 8), method = u16(b, p + 10), tm = u16(b, p + 12), dt = u16(b, p + 14), csize = u32(b, p + 20), size = u32(b, p + 24), nlen = u16(b, p + 28), xlen = u16(b, p + 30), clen = u16(b, p + 32), off = u32(b, p + 42);
            const name = nameOf(b.subarray(p + 46, p + 46 + nlen), flag);
            const date = new Date(1980 + (dt >> 9), ((dt >> 5) & 15) - 1, dt & 31, tm >> 11, (tm >> 5) & 63, (tm & 31) * 2).getTime();
            out.push({ name, size, csize, method, off, flag, dir: name.endsWith('/'), date });
            p += 46 + nlen + xlen + clen;
        }
        return out;
    }
    async function extract(buf, ent) {
        const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
        if (ent.flag & 1) throw new Error(`„${ent.name}“ ist mit Passwort geschützt.`);
        const lo = ent.off + 30 + u16(b, ent.off + 26) + u16(b, ent.off + 28), raw = b.subarray(lo, lo + ent.csize);
        if (ent.method === 0) return raw.slice();
        if (ent.method === 8) return inflate(raw);
        throw new Error(`„${ent.name}“ nutzt eine Komprimierung, die der Browser nicht kennt.`);
    }
    // files: [[name, Uint8Array | Blob | string]]
    async function zip(files, onStep) {
        const enc = new TextEncoder(), parts = [], cen = []; let off = 0, i = 0;
        const le = (n, size) => { const a = new Uint8Array(size); for (let k = 0; k < size; k++) a[k] = (n >>> (8 * k)) & 255; return a; };
        const d = new Date(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
        const used = new Set();
        for (let [name, data] of files) {
            if (typeof data === 'string') data = enc.encode(data); else if (data instanceof Blob) data = new Uint8Array(await data.arrayBuffer());
            let nm0 = name.replace(/^\/+/, ''), k = 1; while (used.has(nm0.toLowerCase())) { const dot = name.lastIndexOf('.'); nm0 = dot > 0 ? `${name.slice(0, dot)} (${++k})${name.slice(dot)}` : `${name} (${++k})`; } used.add(nm0.toLowerCase());
            const nm = enc.encode(nm0), crc = crc32(data); let comp = await deflate(data), method = 8;
            if (comp.length >= data.length) { comp = data; method = 0; }
            const head = [le(0x04034b50, 4), le(20, 2), le(0x0800, 2), le(method, 2), le(tm, 2), le(dt, 2), le(crc, 4), le(comp.length, 4), le(data.length, 4), le(nm.length, 2), le(0, 2), nm];
            const hl = head.reduce((a, x) => a + x.length, 0); parts.push(...head, comp);
            cen.push(le(0x02014b50, 4), le(20, 2), le(20, 2), le(0x0800, 2), le(method, 2), le(tm, 2), le(dt, 2), le(crc, 4), le(comp.length, 4), le(data.length, 4), le(nm.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(off, 4), nm);
            off += hl + comp.length; onStep && onStep(++i, files.length);
        }
        const cl = cen.reduce((a, x) => a + x.length, 0), n = files.length;
        return new Blob([...parts, ...cen, le(0x06054b50, 4), le(0, 2), le(0, 2), le(n, 2), le(n, 2), le(cl, 4), le(off, 4), le(0, 2)], { type: 'application/zip' });
    }
    window.JMZIP = { list, extract, zip, ok: typeof DecompressionStream === 'function' && typeof CompressionStream === 'function' };
})();
