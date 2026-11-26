// OS/explorer.js – Explorer und Vorschau für J.Mainz OS.
// Dieselben Dateien wie auf der Seite „Dokumente“: eigene Uploads (documents + chunks), Rechnungen (invoices) und Lohnabrechnungen (payslips).
// Hochladen per Knopf oder Drag & Drop, Ordner anlegen/umbenennen/löschen, Dateien umbenennen, verschieben, herunterladen, löschen.
// Doppelklick öffnet die Vorschau in einem eigenen Fenster (Bilder mit Zoom und Blättern, PDF, Text).
(function () {
    'use strict';
    const MAX = 3 * 1024 * 1024, QUOTA = 100 * 1024 * 1024, CH = 700000;
    const ALLOWED = /\.(pdf|png|jpe?g|webp|gif|txt|md|json|log|csv|docx?|xlsx?|pptx?|odt|ods|zip)$/i, SAFE_IMG = /^image\/(png|jpeg|webp|gif)$/;
    const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
    const KIND = { pdf: ['fa-file-pdf', '#f87171', 'PDF'], img: ['fa-file-image', '#38bdf8', 'Bild'], doc: ['fa-file-word', '#60a5fa', 'Dokument'], sheet: ['fa-file-excel', '#34d399', 'Tabelle'], txt: ['fa-file-lines', '#94a3b8', 'Text'], zip: ['fa-file-zipper', '#fbbf24', 'Archiv'], other: ['fa-file', '#94a3b8', 'Datei'] };
    const kind = (name, mime) => { const n = (name || '').toLowerCase(), m = mime || '';
        if (m === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf'; if (SAFE_IMG.test(m) || /\.(png|jpe?g|webp|gif)$/.test(n)) return 'img';
        if (/\.(docx?|odt|pptx?)$/.test(n)) return 'doc'; if (/\.(xlsx?|ods|csv)$/.test(n)) return 'sheet'; if (/\.(txt|md|json|log)$/.test(n)) return 'txt'; if (/\.zip$/.test(n)) return 'zip'; return 'other'; };
    const size = b => b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
    const tms = t => (t && t.toDate ? t.toDate().getTime() : t && t.seconds ? t.seconds * 1000 : typeof t === 'number' ? t : 0);
    const dataMime = u => (/^data:([^;,]+)/.exec(u || '') || [])[1] || '';
    const dataSize = u => { const m = /^data:[^;,]*;base64,(.*)$/.exec(u || ''); return m ? Math.floor(m[1].length * 0.75) : 0; };
    const b64Bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const bufToB64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
    let API, U, e, D = { docs: [], inv: [], pays: [], shared: [] }, folders = [];
    const blobs = new Map(), VIEWS = new Set();

    // ---------- Alle Dateien als eine Liste ----------
    function items() {
        const out = [];
        D.docs.filter(d => d.status === 'ready' && !d.deletedAt).forEach(d => out.push({ key: 'up:' + d.id, src: 'up', id: d.id, name: d.name || 'Datei', mime: d.mime || '', size: d.size || 0, date: tms(d.updatedAt) || tms(d.createdAt), folder: d.folder || '', thumb: PHOTO.test(d.thumb || '') ? d.thumb : '', own: true, shared: (d.sharedWith || []).length, sharedWith: d.sharedWith || [], sharedNames: d.sharedNames || {} }));
        const hideSh = (API && API.state().shHide) || [];
        D.shared.filter(d => d.status === 'ready' && !d.deletedAt && d.owner !== U.email && !hideSh.includes(d.id)).forEach(d => out.push({ key: 'sh:' + d.id, src: 'sh', id: d.id, name: d.name || 'Datei', mime: d.mime || '', size: d.size || 0, date: tms(d.updatedAt) || tms(d.createdAt), folder: '', thumb: PHOTO.test(d.thumb || '') ? d.thumb : '', own: false, from: d.ownerName || d.owner || '' }));
        D.inv.filter(v => v.fileName && v.fileChunks).forEach(v => { const ext = /pdf/.test(v.fileMime || '') ? 'pdf' : /png/.test(v.fileMime || '') ? 'png' : /webp/.test(v.fileMime || '') ? 'webp' : 'jpg';
            out.push({ key: 'rech:' + v.id, src: 'rech', id: v.id, name: `Rechnung_${String(v.vendor || 'Anbieter').replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 40)}_${v.date || v.due || ''}.${ext}`, mime: v.fileMime || '', size: v.fileSize || 0, date: Date.parse((v.date || v.due || '2000-01-01') + 'T12:00:00') || 0, folder: '', thumb: '' }); });
        D.pays.filter(p => p.fileData).forEach(p => { const mime = dataMime(p.fileData), ext = (p.fileName || '').split('.').pop().toLowerCase();
            out.push({ key: 'lohn:' + p.id, src: 'lohn', id: p.id, name: `Lohnabrechnung_${p.month}.${/^[a-z0-9]{2,4}$/.test(ext) ? ext : 'pdf'}`, mime, size: dataSize(p.fileData), date: tms(p.createdAt) || Date.parse(p.month + '-01') || 0, folder: '', data: p.fileData, thumb: '' }); });
        out.forEach(it => it.k = kind(it.name, it.mime));
        return out;
    }
    const used = () => D.docs.reduce((s, d) => s + (d.size || 0), 0);
    // Papierkorb: gelöschte eigene Dateien (deletedAt), nach 30 Tagen endgültig weg
    const trash = () => D.docs.filter(d => d.status === 'ready' && d.deletedAt).map(d => ({ key: 'up:' + d.id, src: 'up', id: d.id, name: d.name || 'Datei', mime: d.mime || '', size: d.size || 0, date: d.deletedAt, folder: d.folder || '', thumb: PHOTO.test(d.thumb || '') ? d.thumb : '', own: true, trash: true, k: kind(d.name, d.mime) }));
    const toTrash = it => { if (window.JMOS_SOUND) JMOS_SOUND.play('trash'); return db.collection('documents').doc(it.id).update({ deletedAt: Date.now() }); };
    const restore = it => db.collection('documents').doc(it.id).update({ deletedAt: firebase.firestore.FieldValue.delete() });
    let purged = false;
    function purgeOld() { if (purged) return; purged = true; const lim = Date.now() - 30 * 864e5; D.docs.filter(d => d.deletedAt && d.deletedAt < lim).forEach(d => removeDoc(d.id).catch(() => {})); }
    async function getBlob(it) {
        if (blobs.has(it.key)) return blobs.get(it.key);
        let blob;
        if (it.src === 'up' || it.src === 'rech' || it.src === 'sh') {
            const sn = await db.collection(it.src === 'rech' ? 'invoices' : 'documents').doc(it.id).collection('chunks').orderBy('i').get();
            if (!sn.size) throw new Error('Dateiinhalt fehlt.');
            blob = new Blob(sn.docs.map(d => b64Bytes(d.data().data)), { type: it.mime || 'application/octet-stream' });
        } else { const m = /^data:([^;,]*);base64,(.*)$/.exec(it.data || ''); if (!m) throw new Error('Datei nicht lesbar.'); blob = new Blob([b64Bytes(m[2])], { type: m[1] }); }
        blobs.set(it.key, blob); if (blobs.size > 8) blobs.delete(blobs.keys().next().value);
        return blob;
    }
    async function download(it) {
        try { const b = await getBlob(it), a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: it.name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
        catch (x) { uiAlert('Herunterladen fehlgeschlagen: ' + x.message); }
    }
    function saveBlob(b, name) { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    async function makeZip(list, onStep) {
        if (!window.JMZIP || !JMZIP.ok) throw new Error('Dein Browser kann keine ZIP-Dateien erstellen.');
        const files = []; for (const { it, path } of list) files.push([path, await getBlob(it)]);
        return JMZIP.zip(files, onStep);
    }
    const EXT_MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', txt: 'text/plain', md: 'text/markdown', json: 'application/json', log: 'text/plain', csv: 'text/csv', zip: 'application/zip',
        doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet' };
    const mimeOf = n => EXT_MIME[(n.split('.').pop() || '').toLowerCase()] || '';
    // ZIP entpacken: alle erlaubten Dateien in einen neuen Ordner (Name wie das Archiv)
    async function unzipTo(it) {
        if (!window.JMZIP || !JMZIP.ok) return uiAlert('Dein Browser kann keine ZIP-Dateien entpacken.');
        let buf, ents;
        try { buf = new Uint8Array(await (await getBlob(it)).arrayBuffer()); ents = JMZIP.list(buf).filter(x => !x.dir && !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/i.test(x.name)); }
        catch (x) { return uiAlert('Entpacken nicht möglich: ' + x.message); }
        if (!ents.length) return uiAlert('Das Archiv ist leer.');
        const base = it.name.replace(/\.zip$/i, '').slice(0, 40) || 'Entpackt'; let fname = base, k = 1; while (folders.some(f => f.name.toLowerCase() === fname.toLowerCase())) fname = `${base} (${++k})`;
        const ok = ents.filter(x => ALLOWED.test(x.name) && x.size > 0 && x.size <= MAX), skip = ents.filter(x => !ok.includes(x));
        if (!ok.length) return uiAlert(`Im Archiv ist keine Datei, die hier gespeichert werden kann (erlaubt: PDF, Bilder, Text, Office-Dateien, ZIP bis 3 MB).`);
        const sum = ok.reduce((a, x) => a + x.size, 0);
        if (used() + sum > QUOTA) return uiAlert(`Dafür reicht der Speicher nicht: ${size(sum)} nötig, ${size(QUOTA - used())} frei.`);
        if (!(await uiConfirm(`${ok.length} ${ok.length === 1 ? 'Datei' : 'Dateien'} (${size(sum)}) in den neuen Ordner „${fname}“ entpacken?${skip.length ? `\n\n${skip.length} übersprungen (Dateityp nicht erlaubt, leer oder größer als 3 MB): ${skip.slice(0, 6).map(x => x.name.split('/').pop()).join(', ')}${skip.length > 6 ? ' …' : ''}` : ''}`, { ok: 'Entpacken', title: 'Entpacken' }))) return;
        try {
            const files = [], seen = new Set();
            for (const ent of ok) { let n = ent.name.split('/').pop().slice(0, 120), j = 1; const n0 = n; while (seen.has(n.toLowerCase())) { const d = n0.lastIndexOf('.'); n = d > 0 ? `${n0.slice(0, d)} (${++j})${n0.slice(d)}` : `${n0} (${++j})`; } seen.add(n.toLowerCase());
                files.push(new File([await JMZIP.extract(buf, ent)], n, { type: mimeOf(n) })); }
            const id = 'f' + Date.now().toString(36); await saveFolders([...folders, { id, name: fname }]);
            const n = await upload(files, id, null);
            API.openApp('explorer', { params: { view: id } });
        } catch (x) { uiAlert('Entpacken fehlgeschlagen: ' + x.message); }
    }
    // Inhaltsliste eines Archivs (Vorschau und Schnellvorschau)
    async function zipView(m, it, big) {
        const buf = new Uint8Array(await (await getBlob(it)).arrayBuffer()), ents = JMZIP.list(buf).filter(x => !x.dir);
        const tot = ents.reduce((a, x) => a + x.size, 0);
        m.innerHTML = `<div class="zv"><div class="zv-h"><i class="fa-solid fa-file-zipper"></i><b>${ents.length} ${ents.length === 1 ? 'Datei' : 'Dateien'}</b><span>${size(tot)} entpackt · ${size(it.size)} gepackt</span>${big && can(U, 'dokumente') ? '<button type="button" class="btn pri" data-zu><i class="fa-solid fa-box-open"></i>Alle entpacken</button>' : ''}</div>
            <div class="zv-l">${ents.slice(0, 500).map((x, i) => { const k = kind(x.name, ''); return `<div class="zv-r"><i class="fa-solid ${KIND[k][0]}" style="color:${KIND[k][1]}"></i><span class="zv-n" title="${e(x.name)}">${e(x.name)}</span><small>${size(x.size)}</small>${big ? `<button type="button" data-ze="${i}" title="Diese Datei herunterladen"><i class="fa-solid fa-download"></i></button>` : ''}</div>`; }).join('')}${ents.length > 500 ? `<div class="zv-r"><span class="zv-n">… und ${ents.length - 500} weitere</span></div>` : ''}</div></div>`;
        if (!big) return;
        m.onclick = async ev => { const b = ev.target.closest('[data-ze]'); if (b) { try { const x = ents[+b.dataset.ze]; saveBlob(new Blob([await JMZIP.extract(buf, x)], { type: mimeOf(x.name) }), x.name.split('/').pop()); } catch (er) { uiAlert(er.message); } } if (ev.target.closest('[data-zu]')) unzipTo(it); };
    }
    // ---------- Dateien mit anderen Mitgliedern teilen (nur lesen; sie können eine Kopie speichern) ----------
    let dir = null;
    async function members() { if (dir) return dir; const sn = await db.collection('directory').get(); dir = sn.docs.map(d => ({ uid: d.id, name: (d.data().name || '').trim(), color: d.data().color || '#8b5cf6' })).filter(m => m.uid !== U.uid && m.name).sort((a, b) => a.name.localeCompare(b.name, 'de')); return dir; }
    async function shareDlg(list) {
        let ms; try { ms = await members(); } catch (x) { return uiAlert('Die Mitglieder konnten nicht geladen werden. Zum Teilen brauchst du den Messenger (dort stehen alle, die dabei sind).'); }
        if (!ms.length) return uiAlert('Es gibt noch keine anderen Mitglieder im Messenger-Verzeichnis.');
        const cur = new Set(list.length === 1 ? list[0].sharedWith : list.flatMap(x => x.sharedWith).filter((u, i, a) => list.every(x => x.sharedWith.includes(u))));
        const bg = document.createElement('div'); bg.className = 'uidlg-bg';
        bg.innerHTML = `<form class="uidlg" style="max-width:440px"><div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-share-nodes"></i></span><span>${list.length === 1 ? `„${e(list[0].name)}“ teilen` : `${list.length} Dateien teilen`}</span></div>
            <p class="uidlg-m">Wer soll ${list.length === 1 ? 'die Datei' : 'die Dateien'} sehen? Sie erscheinen dort im Explorer unter „Mit mir geteilt“. Ändern kannst nur du – die anderen können sie öffnen, herunterladen oder eine eigene Kopie speichern.</p>
            <div class="xp-shl">${ms.map(m => `<label class="xp-shm"><input type="checkbox" value="${e(m.uid)}"${cur.has(m.uid) ? ' checked' : ''}><span class="xp-sha" style="background:${e(/^#[0-9a-f]{3,8}$/i.test(m.color) ? m.color : '#8b5cf6')}">${e(m.name.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase())}</span><b>${e(m.name)}</b></label>`).join('')}</div>
            <div class="uidlg-a"><button type="button" data-r="0">Abbrechen</button><button type="submit" class="ok">Übernehmen</button></div></form>`;
        const done = () => bg.remove();
        bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-r="0"]')) done(); });
        bg.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); done(); } });
        bg.querySelector('form').addEventListener('submit', async ev => { ev.preventDefault();
            const pick = [...bg.querySelectorAll('input:checked')].map(i => i.value), names = Object.fromEntries(ms.filter(m => pick.includes(m.uid)).map(m => [m.uid, m.name]));
            const b = bg.querySelector('.ok'); b.disabled = true;
            try { for (const it of list) { const keep = list.length > 1 ? it.sharedWith.filter(u => !cur.has(u) && !pick.includes(u)) : []; const sw = [...new Set([...keep, ...pick])];
                    await db.collection('documents').doc(it.id).update({ sharedWith: sw, sharedNames: Object.assign({}, it.sharedNames, names), ownerName: U.name || U.email }); }
                done(); } catch (x) { b.disabled = false; uiAlert('Teilen fehlgeschlagen: ' + (/permission/i.test(x.message) ? 'Die Firestore-Regeln fürs Teilen fehlen noch.' : x.message)); } });
        document.body.appendChild(bg); bg.querySelector('input').focus();
    }
    async function copyShared(it) {
        if (!can(U, 'dokumente')) return uiAlert('Zum Speichern brauchst du die Berechtigung „Dokumente“.');
        try { const b = await getBlob(it); await createText(it.name, new Uint8Array(await b.arrayBuffer()), ''); uiAlert(`„${it.name}“ liegt jetzt auch in deinen eigenen Dateien.`); } catch (x) { uiAlert('Kopieren fehlgeschlagen: ' + x.message); }
    }
    function hideShared(it) { const S = API.state(); S.shHide = [...(S.shHide || []), it.id].slice(-300); API.save(); VIEWS.forEach(v => v.render()); }
    let shFirst = true;
    function shareNotes() {
        if (!window.JMOS_NOTIFY) return; const lim = Date.now() - 14 * 864e5;
        JMOS_NOTIFY('share', items().filter(it => it.src === 'sh' && (it.date || 0) > lim).map(it => ({ id: 'share:' + it.id, icon: 'fa-share-nodes', c: '#f472b6', prio: 2, time: it.date, title: 'Geteilte Datei', text: `${it.from} hat „${it.name}“ mit dir geteilt`, appName: 'Explorer', run: () => API.openApp('explorer', { params: { view: 'shared' } }) })));
    }
    // ---------- Volltextsuche: Inhalte von Word-, Excel-, PowerPoint- und Textdateien (Text wird im Browser zwischengespeichert) ----------
    const fts = (() => {
        const mem = new Map(), FT = /\.(docx|xlsx|pptx|txt|md|csv|json|log)$/i; let db_ = null, run = null;
        const idb = () => db_ || (db_ = new Promise(res => { try { const r = indexedDB.open('jmos-fts', 1); r.onupgradeneeded = () => r.result.createObjectStore('t'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (x) { res(null); } }));
        const get = async k => { const d = await idb(); if (!d) return null; return new Promise(res => { try { const q = d.transaction('t').objectStore('t').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (x) { res(null); } }); };
        const put = async (k, v) => { const d = await idb(); if (d) try { d.transaction('t', 'readwrite').objectStore('t').put(v, k); } catch (x) {} };
        const sig = it => it.size + ':' + it.date, ok = it => it.own && it.src === 'up' && FT.test(it.name) && it.size <= MAX;
        const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
        const strip = x => x.replace(/<\/(w:p|a:p|si|row|text:p)>/g, '\n').replace(/<\/(c|w:tc)>|<w:tab\/>|<a:br\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, n) => n[0] === '#' ? String.fromCodePoint(n[1] === 'x' || n[1] === 'X' ? parseInt(n.slice(2), 16) : +n.slice(1)) : ENT[n] || m);
        async function extract(it) {
            const blob = await getBlob(it); if (!/\.(docx|xlsx|pptx)$/i.test(it.name)) return (await blob.text()).slice(0, 300000);
            const bytes = new Uint8Array(await blob.arrayBuffer()), want = /\.docx$/i.test(it.name) ? /^word\/(document|header\d*|footer\d*)\.xml$/ : /\.xlsx$/i.test(it.name) ? /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/ : /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/;
            let out = ''; for (const en of JMZIP.list(bytes)) { const n = en.name.replace(/^\/+/, ''); if (!want.test(n)) continue; let x = new TextDecoder().decode(await JMZIP.extract(bytes, en));
                if (/sheet\d+\.xml$/.test(n)) x = x.replace(/<c [^>]*t="s"[^>]*>.*?<\/c>/g, '').replace(/<f>.*?<\/f>/g, '');          // Textverweise stehen in sharedStrings, Formeln nicht durchsuchen
                out += strip(x) + '\n'; if (out.length > 300000) break; }
            return out;
        }
        async function textOf(it) {
            const m = mem.get(it.id); if (m && m.sig === sig(it)) return m.text;
            const k = U.uid + ':' + it.id, c = await get(k); if (c && c.sig === sig(it)) { mem.set(it.id, c); return c.text; }
            let text = ''; try { text = await extract(it); } catch (x) { text = ''; }
            const v = { sig: sig(it), text: text.replace(/[ \t]+/g, ' ') }; mem.set(it.id, v); put(k, v); return v.text;
        }
        return {
            ok,
            todo: () => items().filter(it => ok(it) && !(mem.get(it.id) && mem.get(it.id).sig === sig(it))),
            index(onStep) { if (run) return run; const list = this.todo(); run = (async () => { for (let i = 0; i < list.length; i++) { await textOf(list[i]); onStep && onStep(i + 1, list.length); } })().finally(() => { run = null; }); return run; },
            hit(it, nq) { const m = mem.get(it.id); if (!m || !nq) return ''; const t = m.text, i = t.toLowerCase().indexOf(nq); if (i < 0) return ''; const a = Math.max(0, i - 40), b = Math.min(t.length, i + nq.length + 60);
                return (a ? '…' : '') + t.slice(a, b).replace(/\s+/g, ' ').trim() + (b < t.length ? '…' : ''); },
            hits(q) { const nq = String(q || '').trim().toLowerCase(); return items().map(it => ({ key: it.key, name: it.name, snip: this.hit(it, nq) })).filter(x => x.snip); },
        };
    })();
    // Textdateien für den Texteditor
    const B64b = b => { let o = ''; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return { b64: btoa(o), size: b.length }; };
    const B64 = s => B64b(typeof s === 'string' ? new TextEncoder().encode(s) : s);
    // ---------- Versionen und Vorlagen (versteckte Einträge in documents: status 'version' / 'template') ----------
    const hidden = st => D.docs.filter(d => d.status === st);
    const versionsOf = id => hidden('version').filter(d => d.verOf === id).sort((a, b) => (b.verAt || 0) - (a.verAt || 0));
    async function putHidden(name, bytes, status, extra) {
        const { b64, size: sz } = B64b(bytes); if (sz > MAX) throw new Error('Die Datei ist größer als 3 MB.'); if (used() + sz > QUOTA) throw new Error('Dein Speicher (100 MB) ist voll.');
        const n = Math.max(1, Math.ceil(b64.length / CH)), ref = db.collection('documents').doc();
        await ref.set(Object.assign({ owner: U.email, name: name.slice(0, 120), mime: mimeOf(name) || 'application/octet-stream', size: sz, folder: '', chunks: n, status: 'uploading', thumb: '', createdAt: TS() }, extra));
        try { for (let i = 0; i < n; i++) await ref.collection('chunks').doc(String(i).padStart(3, '0')).set({ i, data: b64.slice(i * CH, (i + 1) * CH) }); await ref.update({ status }); }
        catch (x) { removeDoc(ref.id).catch(() => {}); throw x; }
        return ref.id;
    }
    const hiddenBlob = d => getBlob({ key: 'h:' + d.id, src: 'up', id: d.id, mime: d.mime || '' });
    // Stand vor dem Überschreiben sichern: höchstens alle 10 Minuten (force = sofort), die letzten 5 bleiben
    async function snapshot(key, force) {
        const it = items().find(x => x.key === key); if (!it || !it.own || it.src !== 'up') return;
        const vs = versionsOf(it.id); if (!force && vs[0] && Date.now() - (vs[0].verAt || 0) < 10 * 60000) return;
        const blob = await getBlob(it), bytes = new Uint8Array(await blob.arrayBuffer()); if (!bytes.length) return;
        const nid = await putHidden(it.name, bytes, 'version', { verOf: it.id, verAt: Date.now(), mime: it.mime || mimeOf(it.name) || '' });
        versionsOf(it.id).filter(v => v.id !== nid).slice(4).forEach(v => removeDoc(v.id).catch(() => {}));
    }
    async function saveText(key, text, opts) {
        const it = items().find(x => x.key === key); if (!it || !it.own) throw new Error('Die Datei gibt es nicht mehr oder sie gehört dir nicht.');
        if (opts && opts.version) { try { await snapshot(key, opts.version === 'force'); } catch (x) { /* Version ist ein Extra – Speichern geht trotzdem */ } }
        const { b64, size: sz } = B64(text); if (sz > MAX) throw new Error(`Die Datei ist ${size(sz)} groß – gespeichert werden können höchstens 3 MB. Tipp: Bilder verkleinern.`);
        if (used() - it.size + sz > QUOTA) throw new Error('Dein Speicher (100 MB) ist voll.');
        const ref = db.collection('documents').doc(it.id), n = Math.max(1, Math.ceil(b64.length / CH)), old = (D.docs.find(d => d.id === it.id) || {}).chunks || 0;
        for (let i = 0; i < n; i++) await ref.collection('chunks').doc(String(i).padStart(3, '0')).set({ i, data: b64.slice(i * CH, (i + 1) * CH) });
        for (let i = n; i < old; i++) await ref.collection('chunks').doc(String(i).padStart(3, '0')).delete().catch(() => {});
        await ref.update({ size: sz, chunks: n, updatedAt: TS() });
        blobs.delete(key);
    }
    async function createText(name, text, folder) {
        const { b64, size: sz } = B64(text); if (sz > MAX) throw new Error(`Die Datei ist ${size(sz)} groß – gespeichert werden können höchstens 3 MB. Tipp: Bilder verkleinern.`);
        if (used() + sz > QUOTA) throw new Error('Dein Speicher (100 MB) ist voll.');
        const n = Math.max(1, Math.ceil(b64.length / CH)), ref = db.collection('documents').doc();
        await ref.set({ owner: U.email, name: name.slice(0, 120), mime: mimeOf(name) || 'text/plain', size: sz, folder: folder || '', chunks: n, status: 'uploading', thumb: '', createdAt: TS() });
        try { for (let i = 0; i < n; i++) await ref.collection('chunks').doc(String(i).padStart(3, '0')).set({ i, data: b64.slice(i * CH, (i + 1) * CH) }); await ref.update({ status: 'ready' }); }
        catch (x) { removeDoc(ref.id).catch(() => {}); throw x; }
        return 'up:' + ref.id;
    }
    async function newText(folder) {
        const taken = new Set(items().filter(x => x.src === 'up' && (x.folder || '') === (folder || '')).map(x => x.name.toLowerCase()));
        let n = 'Neues Textdokument.txt', k = 1; while (taken.has(n.toLowerCase())) n = `Neues Textdokument (${++k}).txt`;
        try { const key = await createText(n, '', folder); window.JMOS_EDITOR && JMOS_EDITOR.open(key, { name: n }); } catch (x) { uiAlert('Anlegen fehlgeschlagen: ' + x.message); }
    }
    async function removeDoc(id) {
        const ref = db.collection('documents').doc(id), sn = await ref.collection('chunks').get();
        for (let i = 0; i < sn.docs.length; i += 400) { const b = db.batch(); sn.docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); }
        await ref.delete();
        hidden('version').filter(d => d.verOf === id).forEach(v => removeDoc(v.id).catch(() => {}));          // Versionen einer gelöschten Datei gleich mit
    }
    async function makeThumb(file) {
        if (!SAFE_IMG.test(file.type)) return '';
        try { const url = URL.createObjectURL(file), img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = url; });
            const s = 160, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'), k = Math.max(s / img.width, s / img.height);
            x.drawImage(img, (s - img.width * k) / 2, (s - img.height * k) / 2, img.width * k, img.height * k); URL.revokeObjectURL(url); return c.toDataURL('image/jpeg', .7); } catch (x) { return ''; }
    }
    async function upload(list, folder, onProgress) {
        let done = 0; const errs = [];
        for (const f of [...list]) {
            if (!ALLOWED.test(f.name) && !SAFE_IMG.test(f.type) && f.type !== 'application/pdf') { errs.push(`„${f.name}“: Dateityp nicht erlaubt`); continue; }
            if (f.size > MAX) { errs.push(`„${f.name}“ ist größer als 3 MB`); continue; }
            if (!f.size) { errs.push(`„${f.name}“ ist leer`); continue; }
            if (used() + f.size > QUOTA) { errs.push('Dein Speicher (100 MB) ist voll'); break; }
            let ref = null;
            try {
                onProgress && onProgress(f.name, 0);
                const b64 = bufToB64(await f.arrayBuffer()), n = Math.ceil(b64.length / CH), thumb = await makeThumb(f);
                ref = db.collection('documents').doc();
                await ref.set({ owner: U.email, name: f.name.slice(0, 120), mime: f.type || '', size: f.size, folder: folder || '', chunks: n, status: 'uploading', thumb, createdAt: TS() });
                for (let i = 0; i < n; i++) { await ref.collection('chunks').doc(String(i).padStart(3, '0')).set({ i, data: b64.slice(i * CH, (i + 1) * CH) }); onProgress && onProgress(f.name, (i + 1) / n); }
                await ref.update({ status: 'ready' }); done++;
                logSystemEvent('data', 'Dokument hochgeladen', { typ: kind(f.name, f.type), groesse: f.size, ueber: 'OS' });
            } catch (x) { if (ref) removeDoc(ref.id).catch(() => {}); errs.push(`„${f.name}“: ${x.message}`); }
        }
        onProgress && onProgress(null);
        if (errs.length) uiAlert(errs.join('\n'), { title: 'Nicht alles hochgeladen' });
        return done;
    }
    async function saveFolders(arr) {
        folders = arr; U.userPrefs = { ...(U.userPrefs || {}), docFolders: arr };
        await db.collection('users').doc(U.uid).update({ 'userPrefs.docFolders': arr });
        VIEWS.forEach(v => v.render()); syncDesk();
    }
    async function deleteFolder(f) {
        const inside = D.docs.filter(d => d.folder === f.id);
        if (!(await uiConfirm(`Ordner „${f.name}“ löschen?${inside.length ? `\n\nDie ${inside.length} Datei(en) darin bleiben erhalten und landen in „Eigene Dateien“.` : ''}`, { danger: true, ok: 'Löschen' }))) return false;
        try { for (const d of inside) await db.collection('documents').doc(d.id).update({ folder: '' }); unDesk('dir:' + f.id); await saveFolders(folders.filter(x => x.id !== f.id)); } catch (x) { uiAlert(x.message); }
        return true;
    }
    async function renameFolder(f) { const v = await ask('Ordner umbenennen', f.name, 'Umbenennen'); if (v) await saveFolders(folders.map(x => x.id === f.id ? { ...x, name: v.slice(0, 40) } : x)).catch(x => uiAlert(x.message)); }
    async function newFolderNamed(onDesk) {
        let base = 'Neuer Ordner', n = base, k = 1; while (folders.some(f => f.name.toLowerCase() === n.toLowerCase())) n = `${base} (${++k})`;
        const v = await ask('Neuer Ordner', n, 'Anlegen'); if (!v) return null;
        const id = 'f' + Date.now().toString(36); await saveFolders([...folders, { id, name: v.slice(0, 40) }]).catch(x => uiAlert(x.message));
        if (onDesk) toDesk('dir:' + id); return id;
    }
    const moveDocs = (keys, folder) => Promise.all(keys.map(k => { const it = items().find(x => x.key === k); return it && it.own && it.folder !== folder ? db.collection('documents').doc(it.id).update({ folder }) : null; }));
    // Eigenes kleines Eingabefeld im Dashboard-Stil (statt prompt)
    function ask(title, value, okLabel) {
        return new Promise(res => {
            const bg = document.createElement('div'); bg.className = 'uidlg-bg';
            bg.innerHTML = `<form class="uidlg" style="max-width:400px"><div class="uidlg-h"><span class="uidlg-i"><i class="fa-solid fa-pen"></i></span><span>${e(title)}</span></div>
                <input class="xp-ask" maxlength="120" value="${e(value || '')}"><div class="uidlg-a"><button type="button" data-r="0">Abbrechen</button><button type="submit" class="ok">${e(okLabel || 'OK')}</button></div></form>`;
            const done = v => { bg.remove(); res(v); };
            bg.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); done(bg.querySelector('input').value.trim() || null); });
            bg.addEventListener('click', ev => { if (ev.target === bg || ev.target.closest('[data-r="0"]')) done(null); });
            bg.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); done(null); } });
            document.body.appendChild(bg); const i = bg.querySelector('input'); i.focus(); const dot = i.value.lastIndexOf('.'); i.setSelectionRange(0, dot > 0 ? dot : i.value.length);
        });
    }

    // ---------- Explorer-Fenster ----------
    function explorer(body, win) {
        const canFin = can(U, 'finanzen');
        let view = (win.params && win.params.view) || 'root', sel = null, picks = new Set(), anchor = null, mode = API.state().xpMode || 'grid', q = '', sort = API.state().xpSort || 'name';
        body.innerHTML = `<div class="xp">
            <div class="xp-bar">
                <button type="button" class="xp-b" data-a="up" title="Zur Übersicht" aria-label="Zur Übersicht"><i class="fa-solid fa-arrow-up"></i></button>
                <div class="xp-path"></div>
                <label class="xp-q"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Durchsuchen" aria-label="Dateien durchsuchen"></label>
            </div>
            <div class="xp-tools">
                <button type="button" class="xp-t pri" data-a="upload"><i class="fa-solid fa-upload"></i>Hochladen</button>
                <button type="button" class="xp-t" data-a="newfolder"><i class="fa-solid fa-folder-plus"></i>Neuer Ordner</button>
                <span class="xp-sep"></span>
                <button type="button" class="xp-t" data-a="open" disabled><i class="fa-solid fa-up-right-from-square"></i>Öffnen</button>
                <button type="button" class="xp-t" data-a="dl" disabled><i class="fa-solid fa-download"></i>Herunterladen</button>
                <button type="button" class="xp-t" data-a="zip" disabled title="Ausgewählte Dateien als ZIP herunterladen"><i class="fa-solid fa-file-zipper"></i>ZIP</button>
                <button type="button" class="xp-t" data-a="ren" disabled><i class="fa-solid fa-pen"></i>Umbenennen</button>
                <button type="button" class="xp-t" data-a="restore" hidden disabled><i class="fa-solid fa-rotate-left"></i>Wiederherstellen</button>
                <button type="button" class="xp-t bad" data-a="del" disabled><i class="fa-solid fa-trash-can"></i>Löschen</button>
                <button type="button" class="xp-t bad" data-a="empty" hidden><i class="fa-solid fa-trash-can"></i>Papierkorb leeren</button>
                <span class="xp-fill"></span>
                <select class="xp-sort" aria-label="Sortieren"><option value="name">Name</option><option value="date">Datum</option><option value="size">Größe</option><option value="type">Typ</option></select>
                <div class="xp-mode" role="group" aria-label="Ansicht"><button type="button" data-m="grid" title="Symbole"><i class="fa-solid fa-grip"></i></button><button type="button" data-m="list" title="Liste"><i class="fa-solid fa-list"></i></button></div>
            </div>
            <div class="xp-main"><nav class="xp-side" aria-label="Ordner"></nav><div class="xp-files" tabindex="0" aria-label="Dateien"></div></div>
            <div class="xp-status"><span class="xp-count"></span><span class="xp-prog"></span><span class="xp-used"></span></div>
            <input type="file" multiple hidden class="xp-file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.json,.log,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.zip">
            <div class="xp-drop"><i class="fa-solid fa-upload"></i><b>Loslassen zum Hochladen</b><span class="xp-drop-t"></span></div></div>`;
        const $q = s => body.querySelector(s), files = $q('.xp-files');
        const VIEW_NAMES = () => ({ all: ['Alle Dateien', 'fa-layer-group', '#a78bfa'], root: ['Eigene Dateien', 'fa-house', '#818cf8'], shared: ['Mit mir geteilt', 'fa-share-nodes', '#f472b6'], rech: ['Rechnungen', 'fa-file-invoice', '#fbbf24'], lohn: ['Lohnabrechnungen', 'fa-file-pdf', '#f87171'], trash: ['Papierkorb', 'fa-trash-can', '#94a3b8'], ...Object.fromEntries(folders.map(f => [f.id, [f.name, 'fa-folder', '#f59e0b']])) });
        const isFolderView = () => !['all', 'rech', 'lohn', 'trash', 'shared'].includes(view);
        const canUpload = () => view === 'root' || folders.some(f => f.id === view);
        const inView = it => view === 'all' || (view === 'shared' ? it.src === 'sh' : view === 'root' ? it.src === 'up' && !it.folder : view === 'rech' || view === 'lohn' ? it.src === view : it.src === 'up' && it.folder === view);
        const list = () => {
            const all = view === 'trash' ? trash() : items(), nq = q.toLowerCase();
            let out = all.filter(it => (q || view === 'trash' ? true : inView(it)) && (!q || it.name.toLowerCase().includes(nq) || (view !== 'trash' && nq.length >= 2 && fts.hit(it, nq))));
            const by = { name: (a, b) => a.name.localeCompare(b.name, 'de'), date: (a, b) => b.date - a.date, size: (a, b) => b.size - a.size, type: (a, b) => a.k.localeCompare(b.k) || a.name.localeCompare(b.name, 'de') }[sort];
            return out.sort(by);
        };
        const subFolders = () => (view === 'root' && !q) ? folders : [];
        const render = () => {
            const names = VIEW_NAMES(); if (!names[view]) view = 'root';
            const all = items(), cnt = v => all.filter(it => v === 'all' ? true : v === 'shared' ? it.src === 'sh' : v === 'root' ? it.src === 'up' && !it.folder : v === 'rech' || v === 'lohn' ? it.src === v : it.src === 'up' && it.folder === v).length;
            const side = (v, sub) => { const [n, ic, c] = names[v]; return `<button type="button" class="xp-s${view === v ? ' on' : ''}${sub ? ' sub' : ''}" data-view="${e(v)}" data-drop="${v === 'root' || sub ? e(v) : ''}"><i class="fa-solid ${ic}" style="color:${c}"></i><span>${e(n)}</span><em>${cnt(v)}</em></button>`; };
            const tcount = trash().length;
            $q('.xp-side').innerHTML = `<div class="xp-g">Schnellzugriff</div>${side('all')}${side('root')}${folders.map(f => side(f.id, true)).join('')}${side('shared')}${canFin ? `<div class="xp-g">Finanzen</div>${side('rech')}${side('lohn')}` : ''}<div class="xp-g">System</div><button type="button" class="xp-s${view === 'trash' ? ' on' : ''}" data-view="trash" data-drop="trash"><i class="fa-solid fa-trash-can" style="color:#94a3b8"></i><span>Papierkorb</span><em>${tcount}</em></button>`;
            $q('.xp-path').innerHTML = `<i class="fa-solid fa-hard-drive"></i><button type="button" data-view="root">Dieser Desktop</button>${view !== 'root' ? `<i class="fa-solid fa-chevron-right sep"></i><span>${e(names[view][0])}</span>` : ''}${q ? `<i class="fa-solid fa-chevron-right sep"></i><span>Suche „${e(q)}“</span>` : ''}`;
            const L = list(), F = subFolders();
            if (sel && !L.some(it => it.key === sel) && !F.some(f => 'f:' + f.id === sel)) sel = null;
            picks = new Set([...picks].filter(k => L.some(it => it.key === k) || F.some(f => 'f:' + f.id === k)));
            files.className = 'xp-files ' + mode;
            const nq = q.toLowerCase(), snip = it => q.length >= 2 && !it.name.toLowerCase().includes(nq) ? fts.hit(it, nq) : '';
            const hl = t => e(t).replace(new RegExp(nq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), 'gi'), m => `<mark>${m}</mark>`);
            const thumb = it => it.thumb ? `<img src="${it.thumb}" alt="" loading="lazy">` : `<i class="fa-solid ${KIND[it.k][0]}" style="color:${KIND[it.k][1]}"></i>`;
            const dt = t => t ? new Date(t).toLocaleDateString('de-DE') : '–';
            if (mode === 'grid') files.innerHTML = (F.map(f => `<button type="button" class="xp-i dir${sel === 'f:' + f.id ? ' sel' : ''}" data-key="f:${e(f.id)}" data-drop="${e(f.id)}"><span class="th"><i class="fa-solid fa-folder"></i></span><span class="nm">${e(f.name)}</span></button>`).join('') +
                L.map(it => `<button type="button" class="xp-i${sel === it.key ? ' sel' : ''}" data-key="${e(it.key)}" draggable="${it.own ? 'true' : 'false'}" title="${e(it.name)} · ${size(it.size)}"><span class="th">${thumb(it)}${it.shared || it.src === 'sh' ? `<i class="fa-solid fa-share-nodes xp-shb" title="${it.src === 'sh' ? 'Geteilt von ' + e(it.from) : 'Geteilt mit ' + it.shared}"></i>` : ''}</span><span class="nm">${e(it.name)}</span>${snip(it) ? `<span class="xp-hit">${hl(snip(it))}</span>` : ''}</button>`).join('')) || empty();
            else files.innerHTML = (F.length + L.length) ? `<div class="xp-lh"><span>Name</span><span>Geändert</span><span>Typ</span><span>Größe</span></div>` +
                F.map(f => `<button type="button" class="xp-r dir${sel === 'f:' + f.id ? ' sel' : ''}" data-key="f:${e(f.id)}" data-drop="${e(f.id)}"><span class="nm"><i class="fa-solid fa-folder" style="color:#f59e0b"></i>${e(f.name)}</span><span></span><span>Ordner</span><span></span></button>`).join('') +
                L.map(it => `<button type="button" class="xp-r${sel === it.key ? ' sel' : ''}" data-key="${e(it.key)}" draggable="${it.own ? 'true' : 'false'}"><span class="nm"><i class="fa-solid ${KIND[it.k][0]}" style="color:${KIND[it.k][1]}"></i>${e(it.name)}${it.src === 'sh' ? `<small class="xp-from"><i class="fa-solid fa-share-nodes"></i>von ${e(it.from)}</small>` : it.shared ? `<small class="xp-from"><i class="fa-solid fa-share-nodes"></i>geteilt</small>` : ''}${snip(it) ? `<small class="xp-hit">${hl(snip(it))}</small>` : ''}</span><span>${dt(it.date)}</span><span>${KIND[it.k][2]}</span><span>${size(it.size)}</span></button>`).join('') : empty();
            $q('.xp-used').textContent = `${size(used())} von 100 MB belegt`;
            $q('.xp-sort').value = sort; body.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
            $q('[data-a="upload"]').disabled = !canUpload(); $q('[data-a="newfolder"]').hidden = view !== 'root';
            const tr = view === 'trash'; ['upload', 'ren', 'open', 'dl'].forEach(k => { $q(`[data-a="${k}"]`).hidden = tr; }); $q('[data-a="restore"]').hidden = !tr; $q('[data-a="empty"]').hidden = !tr || !trash().length;
            $q('[data-a="del"]').innerHTML = tr ? '<i class="fa-solid fa-trash-can"></i>Endgültig löschen' : '<i class="fa-solid fa-trash-can"></i>Löschen';
            $q('[data-a="up"]').disabled = view === 'root' && !q;
            win.el.querySelector('.wt-title').textContent = 'Explorer – ' + (q ? 'Suche' : names[view][0]); API.renderTasks();
            selUI();
        };
        // Auswahl nur umschalten, ohne neu zu zeichnen (sonst gehen Doppelklicks verloren)
        const selUI = () => {
            if (!sel) picks.clear(); else if (!picks.has(sel)) picks = new Set([sel]);            // einfache Auswahl = genau ein Element
            files.querySelectorAll('[data-key]').forEach(x => x.classList.toggle('sel', picks.has(x.dataset.key)));
            const n = files.querySelectorAll('[data-key]').length; $q('.xp-count').textContent = `${n} ${n === 1 ? 'Element' : 'Elemente'}${picks.size ? ` · ${picks.size} ausgewählt` : ''}`;
            const it = cur(), dir = sel && sel.startsWith('f:'), many = picks.size > 1, pk = picked();
            $q('[data-a="restore"]').disabled = !it;
            $q('[data-a="open"]').disabled = !sel || many; $q('[data-a="dl"]').disabled = !(it || (many && pk.length)); $q('[data-a="ren"]').disabled = many || !(dir || (it && it.own));
            $q('[data-a="del"]').disabled = many ? !pk.some(x => x.own) : !(dir || (it && it.own));
            const zb = $q('[data-a="zip"]'); zb.hidden = view === 'trash'; zb.disabled = !zipList().length;
        };
        // ausgewählte Dateien (ohne Ordner) und für ZIP: Ordner mit ihrem Inhalt
        const picked = () => { const all = view === 'trash' ? trash() : items(); return [...picks].filter(k => !k.startsWith('f:')).map(k => all.find(it => it.key === k)).filter(Boolean); };
        const zipList = () => { if (view === 'trash') return []; const out = picked().map(it => ({ it, path: it.name }));
            [...picks].filter(k => k.startsWith('f:')).forEach(k => { const f = folders.find(x => x.id === k.slice(2)); if (f) items().filter(it => it.src === 'up' && it.folder === f.id).forEach(it => out.push({ it, path: f.name + '/' + it.name })); });
            return out; };
        const zipName = () => { const pk = [...picks]; if (pk.length === 1) { const k = pk[0]; if (k.startsWith('f:')) return (folders.find(x => x.id === k.slice(2)) || {}).name || 'Ordner'; const it = cur(); return it ? it.name.replace(/\.[^.]+$/, '') : 'Dateien'; } return VIEW_NAMES()[view] ? VIEW_NAMES()[view][0] : 'Dateien'; };
        const prog = (t, p) => { $q('.xp-prog').innerHTML = t ? `<i class="fa-solid fa-file-zipper"></i>${e(t)} <b style="width:${Math.round((p || 0) * 60)}px"></b>` : ''; };
        async function doZip(save) {
            const L = zipList(); if (!L.length) return;
            try { const blob = await makeZip(L, (i, n) => prog(`ZIP wird erstellt (${i}/${n})`, i / n)), name = zipName() + '.zip'; prog('');
                if (!save) return saveBlob(blob, name);
                if (blob.size > MAX) return uiAlert(`Die ZIP-Datei ist ${size(blob.size)} groß. Speichern geht bis 3 MB – lade sie stattdessen herunter.`);
                await upload([new File([blob], name, { type: 'application/zip' })], view === 'root' || !isFolderView() ? '' : view);
            } catch (x) { prog(''); uiAlert('ZIP fehlgeschlagen: ' + x.message); }
        }
        const empty = () => `<div class="xp-empty"><i class="fa-regular fa-folder-open"></i><b>${q ? 'Nichts gefunden' : 'Dieser Ordner ist leer'}</b>${canUpload() && !q ? '<span>Dateien hierher ziehen oder auf „Hochladen“ klicken</span>' : ''}</div>`;
        const cur = () => sel && !sel.startsWith('f:') ? (view === 'trash' ? trash() : items()).find(it => it.key === sel) : null;
        const go = v => { view = v; sel = null; q = ''; $q('.xp-q input').value = ''; render(); };
        const openSel = () => { if (!sel) return; if (sel.startsWith('f:')) return go(sel.slice(2)); const it = cur(); if (it && !it.trash) openViewer(it, list()); };
        async function rename() {
            if (sel && sel.startsWith('f:')) { const f = folders.find(x => x.id === sel.slice(2)); const v = await ask('Ordner umbenennen', f.name, 'Umbenennen'); if (v) await saveFolders(folders.map(x => x.id === f.id ? { ...x, name: v.slice(0, 40) } : x)).catch(x => uiAlert(x.message)); return; }
            const it = cur(); if (!it || !it.own) return; const v = await ask('Datei umbenennen', it.name, 'Umbenennen');
            if (v && v !== it.name) db.collection('documents').doc(it.id).update({ name: v.slice(0, 120) }).catch(x => uiAlert('Umbenennen fehlgeschlagen: ' + x.message));
        }
        async function del() {
            if (picks.size > 1) {
                const L = picked().filter(it => it.own); if (!L.length) return;
                if (view === 'trash') { if (!(await uiConfirm(`${L.length} Dateien endgültig löschen? Das lässt sich nicht rückgängig machen.`, { danger: true, ok: 'Endgültig löschen' }))) return; for (const it of L) await removeDoc(it.id).catch(() => {}); }
                else { for (const it of L) { await toTrash(it).catch(() => {}); unDesk(it.key); } }
                sel = null; return selUI();
            }
            if (sel && sel.startsWith('f:')) { const f = folders.find(x => x.id === sel.slice(2)); if (f) await deleteFolder(f); return; }
            const it = cur(); if (!it || !it.own) return;
            if (!it.trash) { try { await toTrash(it); sel = null; unDesk(it.key); } catch (x) { uiAlert('Löschen fehlgeschlagen: ' + x.message); } return; }
            if (!(await uiConfirm(`„${it.name}“ endgültig löschen? Das lässt sich nicht rückgängig machen.`, { danger: true, ok: 'Endgültig löschen' }))) return;
            try { await removeDoc(it.id); sel = null; logSystemEvent('data', 'Dokument gelöscht', { ueber: 'OS' }); } catch (x) { uiAlert('Löschen fehlgeschlagen: ' + x.message); }
        }
        async function newFolder() { const v = await ask('Neuer Ordner', 'Neuer Ordner', 'Anlegen'); if (v) saveFolders([...folders, { id: 'f' + Date.now().toString(36), name: v.slice(0, 40) }]).catch(x => uiAlert(x.message)); }
        const move1 = (key, folder) => { const it = items().find(x => x.key === key); if (it && it.own && it.folder !== folder) db.collection('documents').doc(it.id).update({ folder }).catch(x => uiAlert(x.message)); };
        const move = (key, folder) => { if (picks.size > 1 && picks.has(key)) [...picks].filter(k => !k.startsWith('f:')).forEach(k => move1(k, folder)); else move1(key, folder); };
        const doUpload = list => { if (!canUpload()) return uiAlert('Hochladen geht in „Eigene Dateien“ und in eigene Ordner.'); const fd = view === 'root' ? '' : view;
            upload(list, fd, (name, p) => { $q('.xp-prog').innerHTML = name ? `<i class="fa-solid fa-upload"></i>${e(name)} <b style="width:${Math.round((p || 0) * 60)}px"></b>` : ''; }); };
        // Bedienung
        body.addEventListener('click', ev => {
            const v = ev.target.closest('[data-view]'); if (v) return go(v.dataset.view);
            const m = ev.target.closest('[data-m]'); if (m) { mode = m.dataset.m; API.state().xpMode = mode; API.save(); return render(); }
            const a = ev.target.closest('[data-a]'); if (a) return ({ up: () => go('root'), upload: () => $q('.xp-file').click(), newfolder: newFolder, open: openSel, dl: () => { if (picks.size > 1) return doZip(false); const it = cur(); if (it) download(it); }, zip: () => doZip(false), ren: rename, del,
                restore: () => { const it = cur(); if (it) restore(it).catch(x => uiAlert(x.message)); },
                empty: async () => { const t = trash(); if (!t.length || !(await uiConfirm(`Papierkorb leeren? ${t.length} Datei(en) werden endgültig gelöscht.`, { danger: true, ok: 'Leeren' }))) return; if (window.JMOS_SOUND) JMOS_SOUND.play('trash'); for (const it of t) await removeDoc(it.id).catch(() => {}); } })[a.dataset.a]();
            if (!ev.target.closest('.xp-files')) return;
            const i = ev.target.closest('[data-key]'), k = i ? i.dataset.key : null;
            if (k && (ev.ctrlKey || ev.metaKey)) { if (picks.has(k)) { picks.delete(k); sel = picks.size ? [...picks].pop() : null; } else { picks.add(k); sel = k; } anchor = k; return selUI(); }
            if (k && ev.shiftKey && anchor) { const all = [...files.querySelectorAll('[data-key]')].map(x => x.dataset.key), a = all.indexOf(anchor), b = all.indexOf(k);
                if (a >= 0 && b >= 0) { picks = new Set(all.slice(Math.min(a, b), Math.max(a, b) + 1)); sel = k; return selUI(); } }
            picks = new Set(k ? [k] : []); sel = k; anchor = k; selUI();
            if (i && matchMedia('(pointer: coarse)').matches) openSel();
        });
        files.addEventListener('dblclick', ev => { const i = ev.target.closest('[data-key]'); if (i) { sel = i.dataset.key; openSel(); } });
        files.addEventListener('keydown', ev => {
            if (ev.key === ' ' && !ev.repeat) { ev.preventDefault(); const it = cur(); if (it && sel && !sel.startsWith('f:')) quickLook(it, () => [...files.querySelectorAll('[data-key]')].map(x => x.dataset.key), k => { sel = k; selUI(); files.querySelector(`[data-key="${CSS.escape(k)}"]`)?.scrollIntoView({ block: 'nearest' }); return cur(); }, () => files.focus()); return; }
            if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'a' || ev.key === 'A')) { ev.preventDefault(); const all = [...files.querySelectorAll('[data-key]')].map(x => x.dataset.key).filter(k => !k.startsWith('f:')); picks = new Set(all); sel = all[0] || null; anchor = sel; return selUI(); }
            if (ev.key === 'Enter') openSel(); else if (ev.key === 'Delete') del(); else if (ev.key === 'F2') { ev.preventDefault(); rename(); }
            else if (ev.key === 'Backspace' && view !== 'root') go('root');
            else if (/^Arrow/.test(ev.key)) { const all = [...files.querySelectorAll('[data-key]')], k = all.findIndex(x => x.dataset.key === sel), cols = mode === 'grid' ? Math.max(1, Math.floor(files.clientWidth / 112)) : 1;
                const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[ev.key], nx = all[Math.max(0, Math.min(all.length - 1, (k < 0 ? 0 : k + d)))]; if (nx) { ev.preventDefault(); sel = nx.dataset.key; selUI(); files.querySelector(`[data-key="${CSS.escape(sel)}"]`)?.scrollIntoView({ block: 'nearest' }); } }
        });
        let ftsT = 0;
        const deep = () => { clearTimeout(ftsT); if (q.length < 2 || view === 'trash' || !fts.todo().length) return; ftsT = setTimeout(() => { const pr = $q('.xp-prog'), mine = q; let last = 0;
            fts.index((i, n) => { if (pr) pr.textContent = i < n ? `Inhalte werden durchsucht … ${i}/${n}` : ''; if (Date.now() - last > 600 && q === mine) { last = Date.now(); render(); } }).then(() => { if (pr) pr.textContent = ''; if (q) render(); }); }, 350); };
        $q('.xp-q input').addEventListener('input', ev => { q = ev.target.value.trim(); render(); deep(); });
        $q('.xp-sort').addEventListener('change', ev => { sort = ev.target.value; API.state().xpSort = sort; API.save(); render(); });
        $q('.xp-file').addEventListener('change', ev => { if (ev.target.files.length) doUpload(ev.target.files); ev.target.value = ''; });
        body.addEventListener('contextmenu', ev => {
            ev.preventDefault(); const i = ev.target.closest('[data-key]'); if (i) { sel = i.dataset.key; selUI(); }
            const it = cur(), dir = sel && sel.startsWith('f:');
            if (i && picks.size > 1) { const pk = picked(), own = pk.filter(x => x.own);
                if (view === 'trash') return API.ctx(ev.clientX, ev.clientY, [['fa-rotate-left', `${pk.length} wiederherstellen`, () => pk.forEach(x => restore(x).catch(() => {}))], null, ['fa-trash-can', `${pk.length} endgültig löschen`, del]]);
                return API.ctx(ev.clientX, ev.clientY, [pk.some(x => x.own && x.src === 'up') && ['fa-share-nodes', `${pk.filter(x => x.own && x.src === 'up').length} teilen …`, () => shareDlg(pk.filter(x => x.own && x.src === 'up'))], ['fa-file-zipper', `Als ZIP herunterladen (${picks.size})`, () => doZip(false)], canUpload() && ['fa-file-zipper', 'ZIP-Datei hier erstellen', () => doZip(true)],
                    ...(own.length ? [null, ...[['', 'Eigene Dateien'], ...folders.map(f => [f.id, f.name])].map(([id, n]) => ['fa-folder', 'Verschieben nach „' + n + '“', () => move(own[0].key, id)]), null, ['fa-trash-can', `In den Papierkorb (${own.length})`, del]] : [])]); }
            if (i && dir) return API.ctx(ev.clientX, ev.clientY, [['fa-folder-open', 'Öffnen', openSel], ['fa-display', onDesk('dir:' + sel.slice(2)) ? 'Vom Desktop entfernen' : 'Auf den Desktop legen', () => { const k = 'dir:' + sel.slice(2); onDesk(k) ? unDesk(k) : toDesk(k); }], ['fa-file-zipper', 'Als ZIP herunterladen', () => doZip(false)], ['fa-pen', 'Umbenennen', rename], null, ['fa-trash-can', 'Ordner löschen', del]]);
            if (i && it && it.trash) return API.ctx(ev.clientX, ev.clientY, [['fa-rotate-left', 'Wiederherstellen', () => restore(it).catch(x => uiAlert(x.message))], null, ['fa-trash-can', 'Endgültig löschen', del]]);
            if (i && it) return API.ctx(ev.clientX, ev.clientY, [['fa-up-right-from-square', 'Öffnen', openSel], /\.docx$/i.test(it.name) && (it.own || it.src === 'sh') && window.JMOS_WRITER && ['fa-file-word', 'Im Writer bearbeiten', () => JMOS_WRITER.open(it.key)], /\.(xlsx|csv)$/i.test(it.name) && (it.own || it.src === 'sh') && window.JMOS_CALC && ['fa-file-excel', 'In Tabellen öffnen', () => JMOS_CALC.open(it.key)], /\.pptx$/i.test(it.name) && (it.own || it.src === 'sh') && window.JMOS_SLIDES && ['fa-file-powerpoint', 'In Präsentation öffnen', () => JMOS_SLIDES.open(it.key)], it.k === 'txt' && it.own && window.JMOS_EDITOR && ['fa-file-pen', 'Im Texteditor bearbeiten', () => JMOS_EDITOR.open(it.key)], it.k !== 'txt' && /\.csv$/i.test(it.name) && it.own && window.JMOS_EDITOR && ['fa-file-pen', 'Als Text bearbeiten', () => JMOS_EDITOR.open(it.key)],
                it.k === 'zip' && can(U, 'dokumente') && ['fa-box-open', 'Entpacken …', () => unzipTo(it)], ['fa-download', 'Herunterladen', () => download(it)], it.k !== 'zip' && ['fa-file-zipper', 'Als ZIP herunterladen', () => doZip(false)], window.JMOS_CHAT && ['fa-paper-plane', 'Per Chat senden …', () => JMOS_CHAT.sendVia({ key: it.key })], ['fa-display', onDesk(it.key) ? 'Vom Desktop entfernen' : 'Auf den Desktop legen', () => (onDesk(it.key) ? unDesk(it.key) : toDesk(it.key))],
                it.own && ['fa-pen', 'Umbenennen', rename], ...(it.own ? [null, ...[['', 'Eigene Dateien'], ...folders.map(f => [f.id, f.name])].filter(([id]) => id !== it.folder).map(([id, n]) => ['fa-folder', 'Verschieben nach „' + n + '“', () => move(it.key, id)])] : []),
                it.own && it.src === 'up' && null, it.own && it.src === 'up' && ['fa-share-nodes', it.shared ? `Geteilt mit ${it.shared} – ändern …` : 'Teilen …', () => shareDlg([it])],
                it.src === 'sh' && null, it.src === 'sh' && ['fa-copy', 'In meine Dateien kopieren', () => copyShared(it)], it.src === 'sh' && ['fa-eye-slash', 'Aus „Mit mir geteilt“ ausblenden', () => hideShared(it)],
                it.own && null, it.own && ['fa-trash-can', 'In den Papierkorb', del]]);
            API.ctx(ev.clientX, ev.clientY, [canUpload() && ['fa-upload', 'Dateien hochladen', () => $q('.xp-file').click()], view === 'root' && ['fa-folder-plus', 'Neuer Ordner', newFolder], canUpload() && window.JMOS_SLIDES && ['fa-file-powerpoint', 'Neue Präsentation (.pptx)', () => JMOS_SLIDES.create(view === 'root' || !isFolderView() ? '' : view)], canUpload() && window.JMOS_CALC && ['fa-file-excel', 'Neue Tabelle (.xlsx)', () => JMOS_CALC.create(view === 'root' || !isFolderView() ? '' : view)], canUpload() && window.JMOS_WRITER && ['fa-file-word', 'Neues Word-Dokument', () => JMOS_WRITER.create(view === 'root' || !isFolderView() ? '' : view)], canUpload() && window.JMOS_EDITOR && ['fa-file-lines', 'Neues Textdokument', () => newText(view === 'root' ? '' : view)], null,
                ['fa-grip', 'Ansicht: Symbole', () => { mode = 'grid'; API.state().xpMode = mode; API.save(); render(); }], ['fa-list', 'Ansicht: Liste', () => { mode = 'list'; API.state().xpMode = mode; API.save(); render(); }]]);
        });
        // Drag & Drop: Dateien vom Computer hochladen, eigene Dateien in Ordner ziehen
        let depth = 0; const drop = $q('.xp-drop');
        body.addEventListener('dragstart', ev => { const i = ev.target.closest('[data-key]'); if (i) ev.dataTransfer.setData('text/x-jmos-file', i.dataset.key); });
        body.addEventListener('dragenter', ev => { if ([...ev.dataTransfer.types].includes('Files')) { depth++; drop.classList.add('on'); drop.querySelector('.xp-drop-t').textContent = canUpload() ? 'nach „' + VIEW_NAMES()[view][0] + '“' : 'Hier nicht möglich – öffne „Eigene Dateien“ oder einen Ordner'; } });
        body.addEventListener('dragleave', ev => { if ([...ev.dataTransfer.types].includes('Files') && --depth <= 0) { depth = 0; drop.classList.remove('on'); } });
        body.addEventListener('dragover', ev => { ev.preventDefault(); body.querySelectorAll('.drop-on').forEach(x => x.classList.remove('drop-on')); const t = ev.target.closest('[data-drop]'); if (t && t.dataset.drop !== undefined && [...ev.dataTransfer.types].includes('text/x-jmos-file')) t.classList.add('drop-on'); });
        body.addEventListener('drop', ev => {
            ev.preventDefault(); depth = 0; drop.classList.remove('on'); body.querySelectorAll('.drop-on').forEach(x => x.classList.remove('drop-on'));
            const key = ev.dataTransfer.getData('text/x-jmos-file');
            if (key) { const t = ev.target.closest('[data-drop]'); if (t && t.dataset.drop === 'trash') { const it = items().find(x => x.key === key); if (it && it.own) toTrash(it).then(() => unDesk(key)).catch(x => uiAlert(x.message)); } else if (t) move(key, t.dataset.drop === 'root' ? '' : t.dataset.drop); return; }
            if (ev.dataTransfer.files.length) doUpload(ev.dataTransfer.files);
        });
        const v = { render }; VIEWS.add(v); win.onClose = () => VIEWS.delete(v);
        win.onParams = p => { if (p.view) go(p.view); if (p.select) { sel = p.select; selUI(); } };
        render(); if (win.params && win.params.select) { sel = win.params.select; selUI(); }
        setTimeout(() => files.focus(), 60);
    }

    // ---------- Schnellvorschau mit der Leertaste (wie „Quick Look“) ----------
    let qlEl = null;
    function quickLook(it, keysFn, pick, back) {
        if (qlEl) { qlEl._close(); return; }
        let url = '', cur = it, token = 0;
        const el = document.createElement('div'); el.className = 'ql'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Schnellvorschau'); el.tabIndex = -1;
        document.body.appendChild(el); qlEl = el;
        const show = async () => {
            const my = ++token; if (url) URL.revokeObjectURL(url); url = '';
            const k = keysFn(), i = k.indexOf(cur.key);
            el.innerHTML = `<div class="ql-card"><div class="ql-h"><i class="fa-solid ${KIND[cur.k][0]}" style="color:${KIND[cur.k][1]}"></i><b>${e(cur.name)}</b><small>${size(cur.size)}${k.length > 1 ? ` · ${i + 1} von ${k.length}` : ''}</small>
                <button type="button" data-q="open" title="Öffnen (Enter)"><i class="fa-solid fa-up-right-from-square"></i></button><button type="button" data-q="x" title="Schließen (Leertaste)"><i class="fa-solid fa-xmark"></i></button></div>
                <div class="ql-m"><div class="wb-load">${API.tile({ icon: KIND[cur.k][0], c: KIND[cur.k][1] })}<span>Wird geladen …</span></div></div>
                <small class="ql-f">Leertaste oder Esc schließt · ← → nächste Datei · Enter öffnet</small></div>`;
            const m = el.querySelector('.ql-m');
            if (cur.k === 'zip' && window.JMZIP) { try { await zipView(m, cur, false); } catch (x) { m.innerHTML = `<div class="xp-empty"><i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i><b>Vorschau nicht möglich</b><span>${e(x.message)}</span></div>`; } return; }
            if (!['img', 'pdf', 'txt'].includes(cur.k) && !/\.csv$/i.test(cur.name)) { m.innerHTML = `<div class="xp-empty"><span class="ql-big">${API.tile({ icon: KIND[cur.k][0], c: KIND[cur.k][1] })}</span><b>${e(cur.name)}</b><span>Keine Vorschau für diesen Dateityp</span></div>`; return; }
            try {
                const blob = await getBlob(cur); if (my !== token) return; url = URL.createObjectURL(blob);
                if (cur.k === 'img') m.innerHTML = `<img src="${url}" alt="${e(cur.name)}">`;
                else if (cur.k === 'pdf') m.innerHTML = `<iframe src="${url}" title="${e(cur.name)}"></iframe>`;
                else m.innerHTML = `<pre>${e((await blob.text()).slice(0, 60000))}</pre>`;
            } catch (x) { if (my === token) m.innerHTML = `<div class="xp-empty"><i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i><b>Vorschau nicht möglich</b><span>${e(x.message)}</span></div>`; }
        };
        const close = () => { token++; if (url) URL.revokeObjectURL(url); el.remove(); qlEl = null; document.removeEventListener('keydown', key, true); back && back(); };
        el._close = close;
        const step = d => { const k = keysFn(), i = k.indexOf(cur.key); if (k.length < 2) return; let j = i, n; do { j = (j + d + k.length) % k.length; n = k[j]; } while (n.startsWith('f:') && j !== i); const it2 = pick(n); if (it2 && it2.key) { cur = it2; show(); } };
        const key = ev => {
            if (ev.key === ' ' || ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
            else if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { ev.preventDefault(); ev.stopPropagation(); step(1); }
            else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { ev.preventDefault(); ev.stopPropagation(); step(-1); }
            else if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); const c = cur; close(); openViewer(c, items()); }
        };
        document.addEventListener('keydown', key, true);
        el.addEventListener('click', ev => { const b = ev.target.closest('[data-q]'); if (ev.target === el || (b && b.dataset.q === 'x')) close(); else if (b && b.dataset.q === 'open') { const c = cur; close(); openViewer(c, items()); } });
        show(); el.focus();
    }

    // ---------- Vorschau / Bildbetrachter ----------
    // zuletzt geöffnete Dateien (für „Empfohlen“ im Startmenü)
    function touch(key, name) { if (!key || !API) return; const S = API.state(); S.recentFiles = [{ key, name, t: Date.now() }, ...(S.recentFiles || []).filter(f => f.key !== key)].slice(0, 16); API.save(); }
    function openViewer(it, list) {
        if (/\.pptx$/i.test(it.name) && it.own && window.JMOS_SLIDES) { touch(it.key, it.name); return JMOS_SLIDES.open(it.key); }
        if (/\.xlsx$/i.test(it.name) && it.own && window.JMOS_CALC) { touch(it.key, it.name); return JMOS_CALC.open(it.key); }
        if (/\.docx$/i.test(it.name) && it.own && window.JMOS_WRITER) { touch(it.key, it.name); return JMOS_WRITER.open(it.key); }
        if (it.k === 'txt' && it.own && window.JMOS_EDITOR) { touch(it.key, it.name); return JMOS_EDITOR.open(it.key); }
        const imgs = (list || []).filter(x => x.k === 'img');
        touch(it.key, it.name);
        API.openApp('vorschau', { key: it.key, title: it.name, params: { it, imgs }, w: it.k === 'img' ? 900 : 860, h: 680 });
    }
    function viewer(body, win) {
        let { it, imgs } = win.params, zoom = 1, url = '';
        const show = async () => {
            if (url) URL.revokeObjectURL(url); url = ''; zoom = 1;
            win.el.querySelector('.wt-title').textContent = it.name; API.renderTasks();
            const idx = imgs.findIndex(x => x.key === it.key), many = it.k === 'img' && imgs.length > 1;
            body.innerHTML = `<div class="vw"><div class="vw-bar"><span class="vw-n"><i class="fa-solid ${KIND[it.k][0]}" style="color:${KIND[it.k][1]}"></i>${e(it.name)}<small>${size(it.size)}</small></span>
                ${it.k === 'img' ? '<button type="button" data-v="out" title="Verkleinern"><i class="fa-solid fa-magnifying-glass-minus"></i></button><span class="vw-z">100 %</span><button type="button" data-v="in" title="Vergrößern"><i class="fa-solid fa-magnifying-glass-plus"></i></button>' : ''}
                <button type="button" data-v="dl" title="Herunterladen"><i class="fa-solid fa-download"></i></button></div>
                <div class="vw-main"><div class="wb-load">${API.tile({ icon: KIND[it.k][0], c: KIND[it.k][1] })}<span>Wird geladen …</span></div></div>
                ${many ? `<button type="button" class="vw-nav l" data-v="prev" aria-label="Vorheriges Bild"><i class="fa-solid fa-chevron-left"></i></button><button type="button" class="vw-nav r" data-v="next" aria-label="Nächstes Bild"><i class="fa-solid fa-chevron-right"></i></button><span class="vw-cnt">${idx + 1} / ${imgs.length}</span>` : ''}</div>`;
            const main = body.querySelector('.vw-main');
            try {
                const blob = await getBlob(it); url = URL.createObjectURL(blob);
                if (it.k === 'img') main.innerHTML = `<img src="${url}" alt="${e(it.name)}" class="vw-img" draggable="false">`;
                else if (it.k === 'pdf') main.innerHTML = `<iframe src="${url}" title="${e(it.name)}" class="vw-pdf"></iframe>`;
                else if (it.k === 'zip' && window.JMZIP) await zipView(main, it, true);
                else if (it.k === 'txt' || /\.csv$/i.test(it.name)) main.innerHTML = `<pre class="vw-txt">${e((await blob.text()).slice(0, 200000))}</pre>`;
                else main.innerHTML = `<div class="xp-empty"><i class="fa-solid ${KIND[it.k][0]}" style="color:${KIND[it.k][1]}"></i><b>Keine Vorschau für diesen Dateityp</b><button type="button" class="btn pri" data-v="dl"><i class="fa-solid fa-download"></i>Herunterladen</button></div>`;
            } catch (x) { main.innerHTML = `<div class="xp-empty"><i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i><b>Vorschau nicht möglich</b><span>${e(x.message)}</span></div>`; }
        };
        const setZoom = z => { zoom = Math.max(.25, Math.min(5, z)); const img = body.querySelector('.vw-img'); if (img) { img.style.transform = `scale(${zoom})`; img.classList.toggle('zoomed', zoom > 1); } const zl = body.querySelector('.vw-z'); if (zl) zl.textContent = Math.round(zoom * 100) + ' %'; };
        const step = d => { const i = imgs.findIndex(x => x.key === it.key); if (i < 0) return; it = imgs[(i + d + imgs.length) % imgs.length]; win.key = it.key; show(); };
        body.addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (!b) return; ({ in: () => setZoom(zoom * 1.25), out: () => setZoom(zoom / 1.25), dl: () => download(it), prev: () => step(-1), next: () => step(1) })[b.dataset.v](); });
        body.addEventListener('wheel', ev => { if (it.k === 'img' && (ev.ctrlKey || ev.metaKey || true) && ev.target.closest('.vw-main')) { ev.preventDefault(); setZoom(zoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)); } }, { passive: false });
        body.addEventListener('dblclick', ev => { if (ev.target.closest('.vw-img')) setZoom(zoom > 1 ? 1 : 2); });
        body.tabIndex = 0;
        body.addEventListener('keydown', ev => { if (ev.key === 'ArrowRight') step(1); else if (ev.key === 'ArrowLeft') step(-1); else if (ev.key === '+') setZoom(zoom * 1.25); else if (ev.key === '-') setZoom(zoom / 1.25); });
        win.onClose = () => { if (url) URL.revokeObjectURL(url); };
        win.onParams = p => { it = p.it; imgs = p.imgs || imgs; show(); };
        show(); setTimeout(() => body.focus(), 60);
    }

    // ---------- Dateien auf dem Desktop ----------
    const dk = () => (API.state().deskFiles = Array.isArray(API.state().deskFiles) ? API.state().deskFiles : []);
    const onDesk = key => dk().includes(key);
    function toDesk(key) { if (!onDesk(key)) { API.state().deskFiles = [...dk(), key]; API.save(); syncDesk(); } }
    function unDesk(key) { if (onDesk(key)) { API.state().deskFiles = dk().filter(k => k !== key); API.save(); syncDesk(); } }
    let deskSig = '';
    function syncDesk() {
        const its = items(), map = Object.fromEntries(its.map(it => [it.key, it]));
        Object.keys(API.apps()).filter(id => id.startsWith('file:')).forEach(id => API.unregisterApp(id));
        dk().forEach(key => { const it = map[key]; if (!it) return;
            API.registerApp({ id: 'file:' + key, name: it.name, icon: KIND[it.k][0], c: KIND[it.k][1], thumb: it.thumb || '', file: true, hidden: true,
                run: () => openViewer(it, its),
                ctx: () => [['fa-up-right-from-square', 'Öffnen', () => openViewer(it, items())], ['fa-folder-open', 'Im Explorer zeigen', () => API.openApp('explorer', { params: { view: it.src === 'up' ? (it.folder || 'root') : it.src, select: it.key } })], ['fa-download', 'Herunterladen', () => download(it)], window.JMOS_CHAT && ['fa-paper-plane', 'Per Chat senden …', () => JMOS_CHAT.sendVia({ key })], null, ['fa-display', 'Vom Desktop entfernen', () => unDesk(key)], it.own && ['fa-trash-can', 'In den Papierkorb', () => toTrash(it).then(() => unDesk(key)).catch(x => uiAlert(x.message))]] }); });
        dk().filter(k => k.startsWith('dir:')).forEach(key => { const f = folders.find(x => x.id === key.slice(4)); if (!f) return;
            const n = D.docs.filter(d => d.folder === f.id && d.status === 'ready' && !d.deletedAt).length;
            API.registerApp({ id: 'file:' + key, name: f.name, folder: true, file: true, hidden: true, c: '#f59e0b', icon: 'fa-folder', run: () => API.openApp('explorer', { params: { view: f.id } }),
                ctx: () => [['fa-folder-open', 'Öffnen', () => API.openApp('explorer', { params: { view: f.id } })], ['fa-upload', 'Dateien hineinladen …', () => pickInto(f.id)], ['fa-pen', 'Umbenennen', () => renameFolder(f)], null,
                    ['fa-eye-slash', 'Vom Desktop entfernen', () => unDesk(key)], ['fa-trash-can', `Ordner löschen${n ? ` (${n} Dateien bleiben erhalten)` : ''}`, () => deleteFolder(f)]] }); });
        const nm = k => k.startsWith('dir:') ? ((folders.find(x => x.id === k.slice(4)) || {}).name || '') : (map[k] || {}).name || '';
        const sig = dk().filter(k => nm(k)).map(k => k + nm(k)).join('|'); if (sig !== deskSig) { deskSig = sig; API.renderIcons(); }
    }
    // für andere Module (Chat-Blasen, Bildschirmfoto): Datei lesen, Dateien hochladen, auf den Desktop legen
    window.JMOS_FILES = {
        async blobOf(key) { const it = items().find(x => x.key === key); if (!it) throw new Error('Datei nicht gefunden.'); const blob = await getBlob(it); return { blob: it.mime && !blob.type ? new Blob([blob], { type: it.mime }) : blob, name: it.name, k: it.k }; },
        upload: (files, folder) => upload(files, folder || ''),
        toDesk: key => toDesk(key),
        unDesk: key => unDesk(key),
        newDeskFolder: () => newFolderNamed(true),
        saveText, createText, newText, touch, snapshot,
        versions: key => { const it = items().find(x => x.key === key); return it && it.src === 'up' ? versionsOf(it.id).slice(0, 5).map(d => ({ id: d.id, at: d.verAt || 0, size: d.size || 0, name: d.name })) : []; },
        versionBlob: id => { const d = D.docs.find(x => x.id === id && x.status === 'version'); if (!d) return Promise.reject(new Error('Version nicht gefunden.')); return hiddenBlob(d); },
        templates: ext => hidden('template').filter(d => !ext || (d.name || '').toLowerCase().endsWith('.' + ext)).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de')).map(d => ({ id: d.id, name: d.name, size: d.size || 0 })),
        templateBlob: id => { const d = D.docs.find(x => x.id === id && x.status === 'template'); if (!d) return Promise.reject(new Error('Vorlage nicht gefunden.')); return hiddenBlob(d); },
        saveTemplate: (name, bytes) => putHidden(name, bytes, 'template', {}),
        deleteTemplate: id => { const d = D.docs.find(x => x.id === id && x.status === 'template'); return d ? removeDoc(id) : Promise.resolve(); },
        contentHits: (q) => fts.hits(q),
        all: () => items(),
        textFiles: () => items().filter(x => x.own && (x.k === 'txt' || /\.csv$/i.test(x.name))),
        wordFiles: () => items().filter(x => x.own && /\.docx$/i.test(x.name)),
        slideFiles: () => items().filter(x => x.own && /\.pptx$/i.test(x.name)),
        sheetFiles: () => items().filter(x => x.own && /\.(xlsx|csv)$/i.test(x.name)),
        item: key => items().find(x => x.key === key) || null,
        folders: () => folders.slice(),
        onChange: fn => { const v = { render: fn }; VIEWS.add(v); return () => VIEWS.delete(v); },
        latestKey: name => { const it = items().filter(x => x.src === 'up' && x.name === name).sort((a, b) => (b.date || 0) - (a.date || 0))[0]; return it && it.key; },
    };
    window.JMOS_DESK_EXTRA = () => (API ? dk().map(k => 'file:' + k) : []);      // vor init() gibt es noch keine API
    // Dateien vom Computer in einen Ordner laden (Rechtsklick auf Ordner auf dem Desktop)
    function pickInto(fid) { const i = Object.assign(document.createElement('input'), { type: 'file', multiple: true }); i.accept = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.json,.log,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.zip';
        i.onchange = () => { if (i.files.length) upload(i.files, fid, null); }; i.click(); }
    // Desktop-Symbole auf einen Ordner auf dem Desktop ziehen: Dateien wandern in den Ordner (und verschwinden vom Desktop)
    window.JMOS_DESK_DROP = (ids, target) => {
        if (!target || !target.startsWith('file:dir:')) return false;
        const fid = target.slice(9), keys = ids.filter(id => /^file:up:/.test(id)).map(id => id.slice(5)); if (!keys.length) return false;
        moveDocs(keys, fid).then(() => keys.forEach(unDesk)).catch(x => uiAlert('Verschieben fehlgeschlagen: ' + x.message));
        return true;
    };
    function wireDeskDrop() {
        const desk = document.getElementById('desk'); let depth = 0;
        const hint = document.createElement('div'); hint.className = 'desk-drop'; hint.innerHTML = '<i class="fa-solid fa-upload"></i><b>Auf den Desktop legen</b><span>Dateien werden in „Eigene Dateien“ hochgeladen</span>'; document.body.appendChild(hint);
        desk.addEventListener('dragover', ev => { if (ev.target.closest('.wg')) return; ev.preventDefault(); const fo = ev.target.closest('.ico[data-id^="file:dir:"]');
            desk.querySelectorAll('.ico.drop-on').forEach(x => x !== fo && x.classList.remove('drop-on')); if (fo) fo.classList.add('drop-on');
            hint.querySelector('b').textContent = fo ? `In „${fo.querySelector('.ico-l').textContent}“ ablegen` : 'Auf den Desktop legen'; });
        desk.addEventListener('dragenter', ev => { if ([...ev.dataTransfer.types].includes('Files')) { depth++; hint.classList.add('on'); } });
        desk.addEventListener('dragleave', ev => { if ([...ev.dataTransfer.types].includes('Files') && --depth <= 0) { depth = 0; hint.classList.remove('on'); } });
        desk.addEventListener('drop', async ev => {
            if (ev.target.closest('.wg')) return; ev.preventDefault(); depth = 0; hint.classList.remove('on'); desk.querySelectorAll('.ico.drop-on').forEach(x => x.classList.remove('drop-on'));
            const fo = ev.target.closest && ev.target.closest('.ico[data-id^="file:dir:"]'), fid = fo ? fo.dataset.id.slice(9) : '';
            const key = ev.dataTransfer.getData('text/x-jmos-file');
            if (key && fid) return moveDocs([key], fid).then(() => unDesk(key)).catch(x => uiAlert(x.message));
            if (key) return toDesk(key);
            if (fid && ev.dataTransfer.files.length && can(U, 'dokumente')) return upload(ev.dataTransfer.files, fid, null);
            if (!ev.dataTransfer.files.length || !can(U, 'dokumente')) return;
            const before = new Set(D.docs.map(d => d.id)), n = await upload(ev.dataTransfer.files, '', null);
            if (n) setTimeout(() => { D.docs.filter(d => !before.has(d.id) && d.status === 'ready').forEach(d => toDesk('up:' + d.id)); }, 800);
        });
    }

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        apps: [
            { id: 'explorer', name: 'Explorer', icon: 'fa-folder-open', c: '#f59e0b', native: 'explorer', perm: 'dokumente', w: 980, h: 620 },
            { id: 'papierkorb', name: 'Papierkorb', icon: 'fa-trash-can', c: '#64748b', perm: 'dokumente', run: () => API.openApp('explorer', { params: { view: 'trash' } }) },
            { id: 'vorschau', name: 'Vorschau', icon: 'fa-file-image', c: '#38bdf8', native: 'viewer', hidden: true, noRestore: true, w: 900, h: 680 },
        ],
        ui: { explorer, viewer },
        init(api, user) {
            API = api; U = user; e = api.esc;
            folders = Array.isArray(user.userPrefs?.docFolders) ? user.userPrefs.docFolders.filter(f => f && f.id && f.name) : [];
            const re = () => { VIEWS.forEach(v => v.render()); syncDesk(); };
            db.collection('documents').where('sharedWith', 'array-contains', user.uid).onSnapshot(sn => { D.shared = sn.docs.map(d => ({ id: d.id, ...d.data() })); re(); if (!shFirst || D.shared.length) shareNotes(); shFirst = false; }, () => { D.shared = []; });
            if (!can(user, 'dokumente')) return;
            JMOS_WIDGETS.use('docs', d => { D.docs = d; re(); purgeOld(); });
            wireDeskDrop();
            if (can(user, 'finanzen')) { JMOS_WIDGETS.use('fin', d => { D.inv = d.inv; re(); }); JMOS_WIDGETS.use('pays', d => { D.pays = d; re(); }); }
        },
        items: () => items(), openViewer: (it, list) => openViewer(it, list),
    });
})();
