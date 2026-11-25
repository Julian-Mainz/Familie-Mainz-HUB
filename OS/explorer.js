// OS/explorer.js – Explorer und Vorschau für J.Mainz OS.
// Dieselben Dateien wie auf der Seite „Dokumente“: eigene Uploads (documents + chunks), Rechnungen (invoices) und Lohnabrechnungen (payslips).
// Hochladen per Knopf oder Drag & Drop, Ordner anlegen/umbenennen/löschen, Dateien umbenennen, verschieben, herunterladen, löschen.
// Doppelklick öffnet die Vorschau in einem eigenen Fenster (Bilder mit Zoom und Blättern, PDF, Text).
(function () {
    'use strict';
    const MAX = 3 * 1024 * 1024, QUOTA = 100 * 1024 * 1024, CH = 700000;
    const ALLOWED = /\.(pdf|png|jpe?g|webp|gif|txt|csv|docx?|xlsx?|pptx?|odt|ods|zip)$/i, SAFE_IMG = /^image\/(png|jpeg|webp|gif)$/;
    const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
    const KIND = { pdf: ['fa-file-pdf', '#f87171', 'PDF'], img: ['fa-file-image', '#38bdf8', 'Bild'], doc: ['fa-file-word', '#60a5fa', 'Dokument'], sheet: ['fa-file-excel', '#34d399', 'Tabelle'], txt: ['fa-file-lines', '#94a3b8', 'Text'], zip: ['fa-file-zipper', '#fbbf24', 'Archiv'], other: ['fa-file', '#94a3b8', 'Datei'] };
    const kind = (name, mime) => { const n = (name || '').toLowerCase(), m = mime || '';
        if (m === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf'; if (SAFE_IMG.test(m) || /\.(png|jpe?g|webp|gif)$/.test(n)) return 'img';
        if (/\.(docx?|odt|pptx?)$/.test(n)) return 'doc'; if (/\.(xlsx?|ods|csv)$/.test(n)) return 'sheet'; if (/\.txt$/.test(n)) return 'txt'; if (/\.zip$/.test(n)) return 'zip'; return 'other'; };
    const size = b => b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
    const tms = t => (t && t.toDate ? t.toDate().getTime() : t && t.seconds ? t.seconds * 1000 : typeof t === 'number' ? t : 0);
    const dataMime = u => (/^data:([^;,]+)/.exec(u || '') || [])[1] || '';
    const dataSize = u => { const m = /^data:[^;,]*;base64,(.*)$/.exec(u || ''); return m ? Math.floor(m[1].length * 0.75) : 0; };
    const b64Bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const bufToB64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
    let API, U, e, D = { docs: [], inv: [], pays: [] }, folders = [];
    const blobs = new Map(), VIEWS = new Set();

    // ---------- Alle Dateien als eine Liste ----------
    function items() {
        const out = [];
        D.docs.filter(d => d.status === 'ready').forEach(d => out.push({ key: 'up:' + d.id, src: 'up', id: d.id, name: d.name || 'Datei', mime: d.mime || '', size: d.size || 0, date: tms(d.createdAt), folder: d.folder || '', thumb: PHOTO.test(d.thumb || '') ? d.thumb : '', own: true }));
        D.inv.filter(v => v.fileName && v.fileChunks).forEach(v => { const ext = /pdf/.test(v.fileMime || '') ? 'pdf' : /png/.test(v.fileMime || '') ? 'png' : /webp/.test(v.fileMime || '') ? 'webp' : 'jpg';
            out.push({ key: 'rech:' + v.id, src: 'rech', id: v.id, name: `Rechnung_${String(v.vendor || 'Anbieter').replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 40)}_${v.date || v.due || ''}.${ext}`, mime: v.fileMime || '', size: v.fileSize || 0, date: Date.parse((v.date || v.due || '2000-01-01') + 'T12:00:00') || 0, folder: '', thumb: '' }); });
        D.pays.filter(p => p.fileData).forEach(p => { const mime = dataMime(p.fileData), ext = (p.fileName || '').split('.').pop().toLowerCase();
            out.push({ key: 'lohn:' + p.id, src: 'lohn', id: p.id, name: `Lohnabrechnung_${p.month}.${/^[a-z0-9]{2,4}$/.test(ext) ? ext : 'pdf'}`, mime, size: dataSize(p.fileData), date: tms(p.createdAt) || Date.parse(p.month + '-01') || 0, folder: '', data: p.fileData, thumb: '' }); });
        out.forEach(it => it.k = kind(it.name, it.mime));
        return out;
    }
    const used = () => D.docs.reduce((s, d) => s + (d.size || 0), 0);
    async function getBlob(it) {
        if (blobs.has(it.key)) return blobs.get(it.key);
        let blob;
        if (it.src === 'up' || it.src === 'rech') {
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
    async function removeDoc(id) {
        const ref = db.collection('documents').doc(id), sn = await ref.collection('chunks').get();
        for (let i = 0; i < sn.docs.length; i += 400) { const b = db.batch(); sn.docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); }
        await ref.delete();
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
        VIEWS.forEach(v => v.render());
    }
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
        let view = (win.params && win.params.view) || 'root', sel = null, mode = API.state().xpMode || 'grid', q = '', sort = API.state().xpSort || 'name';
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
                <button type="button" class="xp-t" data-a="ren" disabled><i class="fa-solid fa-pen"></i>Umbenennen</button>
                <button type="button" class="xp-t bad" data-a="del" disabled><i class="fa-solid fa-trash-can"></i>Löschen</button>
                <span class="xp-fill"></span>
                <select class="xp-sort" aria-label="Sortieren"><option value="name">Name</option><option value="date">Datum</option><option value="size">Größe</option><option value="type">Typ</option></select>
                <div class="xp-mode" role="group" aria-label="Ansicht"><button type="button" data-m="grid" title="Symbole"><i class="fa-solid fa-grip"></i></button><button type="button" data-m="list" title="Liste"><i class="fa-solid fa-list"></i></button></div>
            </div>
            <div class="xp-main"><nav class="xp-side" aria-label="Ordner"></nav><div class="xp-files" tabindex="0" aria-label="Dateien"></div></div>
            <div class="xp-status"><span class="xp-count"></span><span class="xp-prog"></span><span class="xp-used"></span></div>
            <input type="file" multiple hidden class="xp-file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.zip">
            <div class="xp-drop"><i class="fa-solid fa-upload"></i><b>Loslassen zum Hochladen</b><span class="xp-drop-t"></span></div></div>`;
        const $q = s => body.querySelector(s), files = $q('.xp-files');
        const VIEW_NAMES = () => ({ all: ['Alle Dateien', 'fa-layer-group', '#a78bfa'], root: ['Eigene Dateien', 'fa-house', '#818cf8'], rech: ['Rechnungen', 'fa-file-invoice', '#fbbf24'], lohn: ['Lohnabrechnungen', 'fa-file-pdf', '#f87171'], ...Object.fromEntries(folders.map(f => [f.id, [f.name, 'fa-folder', '#f59e0b']])) });
        const isFolderView = () => !['all', 'rech', 'lohn'].includes(view);
        const canUpload = () => view === 'root' || folders.some(f => f.id === view);
        const inView = it => view === 'all' || (view === 'root' ? it.src === 'up' && !it.folder : view === 'rech' || view === 'lohn' ? it.src === view : it.src === 'up' && it.folder === view);
        const list = () => {
            const all = items(), nq = q.toLowerCase();
            let out = all.filter(it => (q ? true : inView(it)) && (!q || it.name.toLowerCase().includes(nq)));
            const by = { name: (a, b) => a.name.localeCompare(b.name, 'de'), date: (a, b) => b.date - a.date, size: (a, b) => b.size - a.size, type: (a, b) => a.k.localeCompare(b.k) || a.name.localeCompare(b.name, 'de') }[sort];
            return out.sort(by);
        };
        const subFolders = () => (view === 'root' && !q) ? folders : [];
        const render = () => {
            const names = VIEW_NAMES(); if (!names[view]) view = 'root';
            const all = items(), cnt = v => all.filter(it => v === 'all' ? true : v === 'root' ? it.src === 'up' && !it.folder : v === 'rech' || v === 'lohn' ? it.src === v : it.src === 'up' && it.folder === v).length;
            const side = (v, sub) => { const [n, ic, c] = names[v]; return `<button type="button" class="xp-s${view === v ? ' on' : ''}${sub ? ' sub' : ''}" data-view="${e(v)}" data-drop="${v === 'root' || sub ? e(v) : ''}"><i class="fa-solid ${ic}" style="color:${c}"></i><span>${e(n)}</span><em>${cnt(v)}</em></button>`; };
            $q('.xp-side').innerHTML = `<div class="xp-g">Schnellzugriff</div>${side('all')}${side('root')}${folders.map(f => side(f.id, true)).join('')}${canFin ? `<div class="xp-g">Finanzen</div>${side('rech')}${side('lohn')}` : ''}`;
            $q('.xp-path').innerHTML = `<i class="fa-solid fa-hard-drive"></i><button type="button" data-view="root">Dieser Desktop</button>${view !== 'root' ? `<i class="fa-solid fa-chevron-right sep"></i><span>${e(names[view][0])}</span>` : ''}${q ? `<i class="fa-solid fa-chevron-right sep"></i><span>Suche „${e(q)}“</span>` : ''}`;
            const L = list(), F = subFolders();
            if (sel && !L.some(it => it.key === sel) && !F.some(f => 'f:' + f.id === sel)) sel = null;
            files.className = 'xp-files ' + mode;
            const thumb = it => it.thumb ? `<img src="${it.thumb}" alt="" loading="lazy">` : `<i class="fa-solid ${KIND[it.k][0]}" style="color:${KIND[it.k][1]}"></i>`;
            const dt = t => t ? new Date(t).toLocaleDateString('de-DE') : '–';
            if (mode === 'grid') files.innerHTML = (F.map(f => `<button type="button" class="xp-i dir${sel === 'f:' + f.id ? ' sel' : ''}" data-key="f:${e(f.id)}" data-drop="${e(f.id)}"><span class="th"><i class="fa-solid fa-folder"></i></span><span class="nm">${e(f.name)}</span></button>`).join('') +
                L.map(it => `<button type="button" class="xp-i${sel === it.key ? ' sel' : ''}" data-key="${e(it.key)}" draggable="${it.own ? 'true' : 'false'}" title="${e(it.name)} · ${size(it.size)}"><span class="th">${thumb(it)}</span><span class="nm">${e(it.name)}</span></button>`).join('')) || empty();
            else files.innerHTML = (F.length + L.length) ? `<div class="xp-lh"><span>Name</span><span>Geändert</span><span>Typ</span><span>Größe</span></div>` +
                F.map(f => `<button type="button" class="xp-r dir${sel === 'f:' + f.id ? ' sel' : ''}" data-key="f:${e(f.id)}" data-drop="${e(f.id)}"><span class="nm"><i class="fa-solid fa-folder" style="color:#f59e0b"></i>${e(f.name)}</span><span></span><span>Ordner</span><span></span></button>`).join('') +
                L.map(it => `<button type="button" class="xp-r${sel === it.key ? ' sel' : ''}" data-key="${e(it.key)}" draggable="${it.own ? 'true' : 'false'}"><span class="nm"><i class="fa-solid ${KIND[it.k][0]}" style="color:${KIND[it.k][1]}"></i>${e(it.name)}</span><span>${dt(it.date)}</span><span>${KIND[it.k][2]}</span><span>${size(it.size)}</span></button>`).join('') : empty();
            $q('.xp-used').textContent = `${size(used())} von 100 MB belegt`;
            $q('.xp-sort').value = sort; body.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
            $q('[data-a="upload"]').disabled = !canUpload(); $q('[data-a="newfolder"]').hidden = view !== 'root';
            $q('[data-a="up"]').disabled = view === 'root' && !q;
            win.el.querySelector('.wt-title').textContent = 'Explorer – ' + (q ? 'Suche' : names[view][0]); API.renderTasks();
            selUI();
        };
        // Auswahl nur umschalten, ohne neu zu zeichnen (sonst gehen Doppelklicks verloren)
        const selUI = () => {
            files.querySelectorAll('[data-key]').forEach(x => x.classList.toggle('sel', x.dataset.key === sel));
            const n = files.querySelectorAll('[data-key]').length; $q('.xp-count').textContent = `${n} ${n === 1 ? 'Element' : 'Elemente'}${sel ? ' · 1 ausgewählt' : ''}`;
            const it = cur(), dir = sel && sel.startsWith('f:');
            $q('[data-a="open"]').disabled = !sel; $q('[data-a="dl"]').disabled = !it; $q('[data-a="ren"]').disabled = !(dir || (it && it.own)); $q('[data-a="del"]').disabled = !(dir || (it && it.own));
        };
        const empty = () => `<div class="xp-empty"><i class="fa-regular fa-folder-open"></i><b>${q ? 'Nichts gefunden' : 'Dieser Ordner ist leer'}</b>${canUpload() && !q ? '<span>Dateien hierher ziehen oder auf „Hochladen“ klicken</span>' : ''}</div>`;
        const cur = () => sel && !sel.startsWith('f:') ? items().find(it => it.key === sel) : null;
        const go = v => { view = v; sel = null; q = ''; $q('.xp-q input').value = ''; render(); };
        const openSel = () => { if (!sel) return; if (sel.startsWith('f:')) return go(sel.slice(2)); const it = cur(); if (it) openViewer(it, list()); };
        async function rename() {
            if (sel && sel.startsWith('f:')) { const f = folders.find(x => x.id === sel.slice(2)); const v = await ask('Ordner umbenennen', f.name, 'Umbenennen'); if (v) await saveFolders(folders.map(x => x.id === f.id ? { ...x, name: v.slice(0, 40) } : x)).catch(x => uiAlert(x.message)); return; }
            const it = cur(); if (!it || !it.own) return; const v = await ask('Datei umbenennen', it.name, 'Umbenennen');
            if (v && v !== it.name) db.collection('documents').doc(it.id).update({ name: v.slice(0, 120) }).catch(x => uiAlert('Umbenennen fehlgeschlagen: ' + x.message));
        }
        async function del() {
            if (sel && sel.startsWith('f:')) {
                const f = folders.find(x => x.id === sel.slice(2)), inside = D.docs.filter(d => d.folder === f.id);
                if (!(await uiConfirm(`Ordner „${f.name}“ löschen?${inside.length ? `\n\nDie ${inside.length} Datei(en) darin bleiben erhalten und landen in „Eigene Dateien“.` : ''}`, { danger: true, ok: 'Löschen' }))) return;
                try { for (const d of inside) await db.collection('documents').doc(d.id).update({ folder: '' }); await saveFolders(folders.filter(x => x.id !== f.id)); } catch (x) { uiAlert(x.message); }
                return;
            }
            const it = cur(); if (!it || !it.own) return;
            if (!(await uiConfirm(`„${it.name}“ endgültig löschen?`, { danger: true, ok: 'Löschen' }))) return;
            try { await removeDoc(it.id); sel = null; logSystemEvent('data', 'Dokument gelöscht', { ueber: 'OS' }); } catch (x) { uiAlert('Löschen fehlgeschlagen: ' + x.message); }
        }
        async function newFolder() { const v = await ask('Neuer Ordner', 'Neuer Ordner', 'Anlegen'); if (v) saveFolders([...folders, { id: 'f' + Date.now().toString(36), name: v.slice(0, 40) }]).catch(x => uiAlert(x.message)); }
        const move = (key, folder) => { const it = items().find(x => x.key === key); if (it && it.own && it.folder !== folder) db.collection('documents').doc(it.id).update({ folder }).catch(x => uiAlert(x.message)); };
        const doUpload = list => { if (!canUpload()) return uiAlert('Hochladen geht in „Eigene Dateien“ und in eigene Ordner.'); const fd = view === 'root' ? '' : view;
            upload(list, fd, (name, p) => { $q('.xp-prog').innerHTML = name ? `<i class="fa-solid fa-upload"></i>${e(name)} <b style="width:${Math.round((p || 0) * 60)}px"></b>` : ''; }); };
        // Bedienung
        body.addEventListener('click', ev => {
            const v = ev.target.closest('[data-view]'); if (v) return go(v.dataset.view);
            const m = ev.target.closest('[data-m]'); if (m) { mode = m.dataset.m; API.state().xpMode = mode; API.save(); return render(); }
            const a = ev.target.closest('[data-a]'); if (a) return ({ up: () => go('root'), upload: () => $q('.xp-file').click(), newfolder: newFolder, open: openSel, dl: () => { const it = cur(); if (it) download(it); }, ren: rename, del })[a.dataset.a]();
            if (!ev.target.closest('.xp-files')) return;
            const i = ev.target.closest('[data-key]'); sel = i ? i.dataset.key : null; selUI();
            if (i && matchMedia('(pointer: coarse)').matches) openSel();
        });
        files.addEventListener('dblclick', ev => { const i = ev.target.closest('[data-key]'); if (i) { sel = i.dataset.key; openSel(); } });
        files.addEventListener('keydown', ev => {
            if (ev.key === 'Enter') openSel(); else if (ev.key === 'Delete') del(); else if (ev.key === 'F2') { ev.preventDefault(); rename(); }
            else if (ev.key === 'Backspace' && view !== 'root') go('root');
            else if (/^Arrow/.test(ev.key)) { const all = [...files.querySelectorAll('[data-key]')], k = all.findIndex(x => x.dataset.key === sel), cols = mode === 'grid' ? Math.max(1, Math.floor(files.clientWidth / 112)) : 1;
                const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[ev.key], nx = all[Math.max(0, Math.min(all.length - 1, (k < 0 ? 0 : k + d)))]; if (nx) { ev.preventDefault(); sel = nx.dataset.key; selUI(); files.querySelector(`[data-key="${CSS.escape(sel)}"]`)?.scrollIntoView({ block: 'nearest' }); } }
        });
        $q('.xp-q input').addEventListener('input', ev => { q = ev.target.value.trim(); render(); });
        $q('.xp-sort').addEventListener('change', ev => { sort = ev.target.value; API.state().xpSort = sort; API.save(); render(); });
        $q('.xp-file').addEventListener('change', ev => { if (ev.target.files.length) doUpload(ev.target.files); ev.target.value = ''; });
        body.addEventListener('contextmenu', ev => {
            ev.preventDefault(); const i = ev.target.closest('[data-key]'); if (i) { sel = i.dataset.key; selUI(); }
            const it = cur(), dir = sel && sel.startsWith('f:');
            if (i && dir) return API.ctx(ev.clientX, ev.clientY, [['fa-folder-open', 'Öffnen', openSel], ['fa-pen', 'Umbenennen', rename], null, ['fa-trash-can', 'Ordner löschen', del]]);
            if (i && it) return API.ctx(ev.clientX, ev.clientY, [['fa-up-right-from-square', 'Öffnen', openSel], ['fa-download', 'Herunterladen', () => download(it)],
                it.own && ['fa-pen', 'Umbenennen', rename], ...(it.own ? [null, ...[['', 'Eigene Dateien'], ...folders.map(f => [f.id, f.name])].filter(([id]) => id !== it.folder).map(([id, n]) => ['fa-folder', 'Verschieben nach „' + n + '“', () => move(it.key, id)])] : []),
                it.own && null, it.own && ['fa-trash-can', 'Löschen', del]]);
            API.ctx(ev.clientX, ev.clientY, [canUpload() && ['fa-upload', 'Dateien hochladen', () => $q('.xp-file').click()], view === 'root' && ['fa-folder-plus', 'Neuer Ordner', newFolder], null,
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
            if (key) { const t = ev.target.closest('[data-drop]'); if (t) move(key, t.dataset.drop === 'root' ? '' : t.dataset.drop); return; }
            if (ev.dataTransfer.files.length) doUpload(ev.dataTransfer.files);
        });
        const v = { render }; VIEWS.add(v); win.onClose = () => VIEWS.delete(v);
        win.onParams = p => { if (p.view) go(p.view); if (p.select) { sel = p.select; selUI(); } };
        render(); if (win.params && win.params.select) { sel = win.params.select; selUI(); }
        setTimeout(() => files.focus(), 60);
    }

    // ---------- Vorschau / Bildbetrachter ----------
    function openViewer(it, list) {
        const imgs = (list || []).filter(x => x.k === 'img');
        const S = API.state(); S.recentFiles = [{ key: it.key, name: it.name }, ...(S.recentFiles || []).filter(f => f.key !== it.key)].slice(0, 6); API.save();
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

    (window.JMOS_EXT = window.JMOS_EXT || []).push({
        apps: [
            { id: 'explorer', name: 'Explorer', icon: 'fa-folder-open', c: '#f59e0b', native: 'explorer', perm: 'dokumente', w: 980, h: 620 },
            { id: 'vorschau', name: 'Vorschau', icon: 'fa-file-image', c: '#38bdf8', native: 'viewer', hidden: true, noRestore: true, w: 900, h: 680 },
        ],
        ui: { explorer, viewer },
        init(api, user) {
            API = api; U = user; e = api.esc;
            folders = Array.isArray(user.userPrefs?.docFolders) ? user.userPrefs.docFolders.filter(f => f && f.id && f.name) : [];
            if (!can(user, 'dokumente')) return;
            const re = () => VIEWS.forEach(v => v.render());
            JMOS_WIDGETS.use('docs', d => { D.docs = d; re(); });
            if (can(user, 'finanzen')) { JMOS_WIDGETS.use('fin', d => { D.inv = d.inv; re(); }); JMOS_WIDGETS.use('pays', d => { D.pays = d; re(); }); }
        },
        items: () => items(), openViewer: (it, list) => openViewer(it, list),
    });
})();
