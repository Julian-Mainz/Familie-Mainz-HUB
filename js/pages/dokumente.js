// js/pages/dokumente.js - Seiten-Code von /dokumente.html (ausgelagert, damit der Browser ihn zwischenspeichern kann)
const openModal = id => $(id).classList.remove('hidden'), closeModal = id => $(id).classList.add('hidden');
const MAX = 3 * 1024 * 1024, QUOTA = 100 * 1024 * 1024, CH = 700000;       // 700.000 Zeichen Base64 (durch 4 teilbar) = ca. 525 KB je Teil
const ALLOWED = /\.(pdf|png|jpe?g|webp|gif|txt|csv|docx?|xlsx?|pptx?|odt|ods|zip)$/i;
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'], pad2 = n => String(n).padStart(2, '0');
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
const fmtD = t => t ? new Date(t).toLocaleDateString('de-DE') : '–';
const tms = t => (t && t.toDate ? t.toDate().getTime() : t && t.seconds ? t.seconds * 1000 : typeof t === 'number' ? t : 0);
const TYPES = { pdf: ['fa-file-pdf', '248,113,113', 'PDF'], img: ['fa-image', '56,189,248', 'Bild'], doc: ['fa-file-word', '96,165,250', 'Dokument'], sheet: ['fa-file-excel', '52,211,153', 'Tabelle'], txt: ['fa-file-lines', '148,163,184', 'Text'], zip: ['fa-file-zipper', '251,191,36', 'Archiv'], other: ['fa-file', '148,163,184', 'Datei'] };
const SAFE_IMG = /^image\/(png|jpeg|webp|gif)$/;    // bewusst ohne SVG: SVG ist eine Textdatei und darf Programmcode enthalten
function kind(name, mime) {
    const n = (name || '').toLowerCase(), m = mime || '';
    if (m === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf'; if (SAFE_IMG.test(m) || /\.(png|jpe?g|webp|gif)$/.test(n)) return 'img';
    if (/\.(docx?|odt|pptx?)$/.test(n)) return 'doc'; if (/\.(xlsx?|ods|csv)$/.test(n)) return 'sheet'; if (/\.txt$/.test(n)) return 'txt'; if (/\.zip$/.test(n)) return 'zip'; return 'other';
}
const grp = k => (k === 'pdf' ? 'pdf' : k === 'img' ? 'img' : ['doc', 'sheet', 'txt'].includes(k) ? 'doc' : 'other');
const dataSize = u => { const m = /^data:[^;,]*;base64,(.*)$/.exec(u || ''); return m ? Math.floor(m[1].length * 0.75) : 0; };
const dataMime = u => (/^data:([^;,]+)/.exec(u || '') || [])[1] || '';
const b64Bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const dataToBlob = u => { const m = /^data:([^;,]*);base64,(.*)$/.exec(u || ''); if (!m) throw new Error('Datei nicht lesbar.'); return new Blob([b64Bytes(m[2])], { type: m[1] || 'application/octet-stream' }); };
function bufToB64(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }

// ---------- Zustand ----------
let uploads = [], pays = [], invs = [], chat = [], folders = [], view = 'all', selKey = null, mode = ls.get('dok_mode') === 'list' ? 'list' : 'grid', year = new Date().getFullYear();
let started = false, canFin = false, canMsg = false, pvToken = 0, pvUrl = '', nameCtx = null, uploading = 0; const blobCache = new Map();
const BUILTIN = ['all', 'lohn', 'rech', 'chat', 'profil', 'root'];

initAuthGuard(user => {
    if (!user || started) return; started = true;
    renderDrawer(); canFin = can(currentUser, 'finanzen'); canMsg = can(currentUser, 'messenger');
    folders = Array.isArray(currentUser.userPrefs?.docFolders) ? currentUser.userPrefs.docFolders.filter(f => f && f.id && f.name) : [];
    const h = location.hash.slice(1); if (BUILTIN.includes(h) && !((h === 'lohn' || h === 'rech') && !canFin) && !(h === 'chat' && !canMsg)) view = h;
    $('modes').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    db.collection('documents').where('owner', '==', currentUser.email).onSnapshot(s => { uploads = s.docs.map(d => ({ id: d.id, ...d.data() })); cleanStale(); renderAll(); }, err => { $('files').innerHTML = `<div class="ux-card ux-empty neg">Dokumente konnten nicht geladen werden: ${esc(err.message)}</div>`; });
    if (canFin) db.collection('invoices').where('owner', '==', currentUser.email).onSnapshot(s => { invs = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.fileName && v.fileChunks); renderAll(); }, () => { invs = []; renderAll(); });
    if (canFin) db.collection('payslips').where('owner', '==', currentUser.email).onSnapshot(s => { pays = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); }, () => { pays = []; renderAll(); });
    loadChatImages(); wire(); renderAll();
}, { perm: 'dokumente' });

// Angefangene Uploads (Tab geschlossen) nach 15 Minuten wegräumen
function cleanStale() { uploads.filter(d => d.status === 'uploading' && tms(d.createdAt) && Date.now() - tms(d.createdAt) > 15 * 60 * 1000).forEach(d => removeDoc(d.id).catch(() => {})); }
async function loadChatImages() {
    if (!canMsg) return; const out = [];
    try {
        const chats = await db.collection('chats').where('members', 'array-contains', currentUser.uid).get();
        for (const c of chats.docs) {
            const x = c.data(), title = x.type === 'group' ? (x.title || 'Gruppe') : 'Direktchat';
            const sn = await c.ref.collection('messages').where('image', '>', '').get();
            sn.docs.forEach(d => { const m = d.data(); if (m.from === currentUser.uid && PHOTO_OK.test(m.image || '')) out.push({ id: c.id + '_' + d.id, image: m.image, date: tms(m.createdAt) || m.createdMs || 0, chatTitle: title }); });
        }
    } catch (e) { /* kein Zugriff: dann gibt es hier nichts zu zeigen */ }
    chat = out; renderAll();
}

// ---------- Alle Dateien als eine Liste ----------
function items() {
    const out = [];
    uploads.filter(d => d.status === 'ready').forEach(d => out.push({ key: 'up:' + d.id, src: 'up', id: d.id, name: d.name || 'Datei', mime: d.mime || '', size: d.size || 0, date: tms(d.createdAt) || Date.now(), folder: d.folder || '', thumb: PHOTO_OK.test(d.thumb || '') ? d.thumb : '', k: kind(d.name, d.mime) }));
    pays.forEach(p => { const mime = dataMime(p.fileData), ext = (p.fileName || '').split('.').pop().toLowerCase(); out.push({ key: 'lohn:' + p.id, src: 'lohn', id: p.id, name: `Lohnabrechnung_${p.month}.${/^[a-z0-9]{2,4}$/.test(ext) ? ext : 'pdf'}`, mime, size: dataSize(p.fileData), date: tms(p.createdAt) || Date.parse(p.month + '-01') || 0, folder: '', data: p.fileData, p, thumb: '', k: kind(p.fileName, mime) }); });
    invs.forEach(v => out.push({ key: 'rech:' + v.id, src: 'rech', id: v.id, name: `Rechnung_${String(v.vendor || 'Anbieter').replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 40)}_${v.date || v.due || ''}.${/pdf/.test(v.fileMime || '') ? 'pdf' : /png/.test(v.fileMime || '') ? 'png' : /webp/.test(v.fileMime || '') ? 'webp' : 'jpg'}`, mime: v.fileMime || '', size: v.fileSize || 0, date: Date.parse((v.date || v.due || '2000-01-01') + 'T12:00:00') || 0, folder: '', v, thumb: '', k: kind(v.fileName, v.fileMime) }));
    chat.forEach(c => out.push({ key: 'chat:' + c.id, src: 'chat', id: c.id, name: `Chat-Bild_${new Date(c.date).toISOString().slice(0, 10)}.${/jpeg/.test(dataMime(c.image)) ? 'jpg' : (dataMime(c.image).split('/')[1] || 'jpg')}`, mime: dataMime(c.image), size: dataSize(c.image), date: c.date, folder: '', data: c.image, thumb: c.image, k: 'img', chatTitle: c.chatTitle }));
    if (PHOTO_OK.test(currentUser.photo || '')) out.push({ key: 'profil:me', src: 'profil', id: 'me', name: `Profilbild.${/jpeg/.test(dataMime(currentUser.photo)) ? 'jpg' : dataMime(currentUser.photo).split('/')[1]}`, mime: dataMime(currentUser.photo), size: dataSize(currentUser.photo), date: 0, folder: '', data: currentUser.photo, thumb: currentUser.photo, k: 'img' });
    return out;
}
const srcLabel = it => it.src === 'lohn' ? 'Lohn' : it.src === 'rech' ? 'Rechnungen' : it.src === 'chat' ? 'Chat' : it.src === 'profil' ? 'Profil' : (folders.find(f => f.id === it.folder)?.name || 'Ohne Ordner');
const inView = it => view === 'all' || (view === 'root' ? it.src === 'up' && !it.folder : BUILTIN.includes(view) ? it.src === view : it.src === 'up' && it.folder === view);
const usedBytes = () => uploads.filter(d => d.status !== 'uploading' || true).reduce((s, d) => s + (d.size || 0), 0);

// ---------- Anzeige ----------
function renderAll() { renderTree(); renderMatrix(); renderFiles(); renderPreview(); }
function renderTree() {
    const all = items(), cnt = f => all.filter(f).length;
    const row = (v, ic, label, n, extra = '') => `<button class="tr${view === v ? ' on' : ''}" data-view="${esc(v)}"><i class="fa-solid ${ic} ic"></i><span class="t">${esc(label)}</span>${extra}<em>${n}</em></button>`;
    let h = '<div class="tgrp">Übersicht</div>' + row('all', 'fa-layer-group', 'Alle Dateien', all.length);
    if (canFin) h += row('lohn', 'fa-file-invoice-dollar', 'Lohnabrechnungen', cnt(i => i.src === 'lohn'));
    if (canFin) h += row('rech', 'fa-file-invoice', 'Rechnungen', cnt(i => i.src === 'rech'));
    if (canMsg) h += row('chat', 'fa-image', 'Chat-Bilder', cnt(i => i.src === 'chat'));
    h += row('profil', 'fa-user', 'Profilbild', cnt(i => i.src === 'profil'));
    h += '<div class="tgrp">Meine Ordner</div>' + row('root', 'fa-inbox', 'Ohne Ordner', cnt(i => i.src === 'up' && !i.folder));
    h += folders.map(f => row(f.id, 'fa-folder', f.name, cnt(i => i.src === 'up' && i.folder === f.id), `<span class="fe"><span data-fe="ren" data-id="${esc(f.id)}" role="button" title="Umbenennen" aria-label="Ordner ${esc(f.name)} umbenennen"><i class="fa-solid fa-pen"></i></span><span data-fe="del" data-id="${esc(f.id)}" role="button" title="Ordner löschen" aria-label="Ordner ${esc(f.name)} löschen"><i class="fa-solid fa-trash-can"></i></span></span>`)).join('');
    h += '<button class="tr" data-newfolder style="color:var(--m)"><i class="fa-solid fa-folder-plus ic" style="color:var(--m)"></i><span class="t">Neuer Ordner</span></button>';
    const used = usedBytes();
    h += `<div class="meter"><div style="display:flex;justify-content:space-between"><span>Dein Speicher</span><b id="used" style="color:#e2e8f0">${fmtSize(used)} von 100 MB</b></div><div class="bar"><i style="width:${Math.max(used ? 1 : 0, Math.min(100, used / QUOTA * 100)).toFixed(1)}%"></i></div><span>Gilt für eigene Uploads. Lohnabrechnungen, Rechnungen und Bilder aus anderen Bereichen zählen nicht mit.</span></div>`;
    $('tree').innerHTML = h;
}
function renderMatrix() {
    const box = $('mx'); if (view !== 'lohn' || !canFin) return box.classList.add('hidden'); box.classList.remove('hidden');
    const first = pays.map(p => p.month || '').filter(Boolean).sort()[0] || '', now = new Date(), cur = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    const mine = new Map(pays.filter(p => (p.month || '').startsWith(year + '-')).map(p => [+p.month.slice(5), p]));
    let ok = 0, miss = 0;
    const cells = MONTHS.map((m, i) => {
        const key = `${year}-${pad2(i + 1)}`, have = mine.get(i + 1);
        const st = have ? 'ok' : (!first || key < first) ? 'na' : key < cur ? 'miss' : key === cur ? 'now' : 'na';
        if (st === 'ok') ok++; if (st === 'miss') miss++;
        const [ic, txt] = { ok: ['fa-circle-check', 'vorhanden'], miss: ['fa-circle-exclamation', 'fehlt'], now: ['fa-clock', 'noch offen'], na: ['fa-minus', '–'] }[st];
        return `<button class="mo ${st}" ${have ? `data-pick="lohn:${esc(have.id)}"` : st === 'miss' ? 'data-miss' : 'disabled'} title="${m} ${year}: ${txt}"><b>${m}</b><i class="fa-solid ${ic}"></i><small>${txt}</small></button>`;
    }).join('');
    box.innerHTML = `<div class="ux-t"><i class="fa-solid fa-calendar-check"></i>Lohnabrechnungen ${year}<small><span class="chip g" id="mx-ok">${ok} vorhanden</span>${miss ? `<span class="chip r" id="mx-miss">${miss} ${miss === 1 ? 'fehlt' : 'fehlen'}</span>` : ''}
        <span class="ux-pill" style="margin-left:6px"><button type="button" data-year="-1" aria-label="Vorjahr"><i class="fa-solid fa-chevron-left"></i></button><span style="padding:0 10px;font-weight:600">${year}</span><button type="button" data-year="1" aria-label="Nächstes Jahr"><i class="fa-solid fa-chevron-right"></i></button></span></small></div>
        <div class="mxg">${cells}</div><div class="ux-note" style="margin-top:10px">Ein roter Monat ist vorbei, aber es liegt noch keine Abrechnung vor. Klicke darauf, um sie in Finanzen hochzuladen. Monate vor deiner ersten Abrechnung werden nicht gezählt.</div>`;
}
function visibleItems() {
    const q = $('q').value.trim().toLowerCase(), t = $('type').value, s = $('sort').value;
    const list = items().filter(inView).filter(it => (!t || grp(it.k) === t) && (!q || `${it.name} ${srcLabel(it)}`.toLowerCase().includes(q)));
    const cmp = { new: (a, b) => b.date - a.date, old: (a, b) => a.date - b.date, name: (a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }), size: (a, b) => b.size - a.size }[s];
    return list.sort(view === 'lohn' && s === 'new' ? (a, b) => (b.p.month || '').localeCompare(a.p.month || '') : cmp);
}
function renderFiles() {
    const list = visibleItems(), box = $('files');
    box.className = mode === 'list' ? 'lst' : 'fg';
    const total = list.reduce((s, i) => s + i.size, 0); $('count').textContent = `${list.length} ${list.length === 1 ? 'Datei' : 'Dateien'} · ${fmtSize(total)}`;
    box.innerHTML = list.length ? list.map(it => {
        const [ic, cr, lbl] = TYPES[it.k];
        const th = `<div class="th" style="--cr:${cr}">${it.thumb ? `<img src="${esc(it.thumb)}" alt="" loading="lazy">` : `<i class="fa-solid ${ic}"></i>`}<span>${lbl}</span></div>`;
        const meta = it.src === 'lohn' ? `${MONTHS[+it.p.month.slice(5) - 1] || ''} ${it.p.month.slice(0, 4)} · ${fmtSize(it.size)}` : `${fmtD(it.date)} · ${fmtSize(it.size)}`;
        return `<button class="fl${it.key === selKey ? ' sel' : ''}" data-key="${esc(it.key)}">${th}<span class="fn">${esc(it.name)}</span><small>${meta}</small><span class="chip src">${esc(srcLabel(it))}</span></button>`;
    }).join('') : `<div class="ux-card ux-empty" style="grid-column:1/-1"><i class="fa-solid fa-folder-open"></i>${$('q').value ? 'Keine Datei gefunden.' : view === 'lohn' ? 'Noch keine Lohnabrechnungen. Lade sie in Finanzen hoch, dann erscheinen sie hier.' : view === 'chat' ? 'Keine eigenen Bilder in deinen Chats.' : view === 'profil' ? 'Du hast noch kein Profilbild.' : 'Noch keine Dateien. Ziehe sie hierher oder klicke auf „Hochladen“.'}</div>`;
}
function selected() { return items().find(i => i.key === selKey) || null; }
async function renderPreview() {
    const it = selected(), box = $('pv'), tok = ++pvToken;
    if (pvUrl) { URL.revokeObjectURL(pvUrl); pvUrl = ''; }
    if (!it) { box.innerHTML = '<div class="pvv"><i class="fa-solid fa-file"></i></div><div class="ux-note">Wähle eine Datei aus, um Vorschau und Details zu sehen.</div>'; return; }
    const [ic, cr, lbl] = TYPES[it.k], kv = (a, b) => `<div class="kv"><span>${a}</span><b>${b}</b></div>`;
    const rows = kv('Typ', lbl) + kv('Größe', fmtSize(it.size)) +
        (it.src === 'lohn' ? kv('Abrechnung', `${MONTHS[+it.p.month.slice(5) - 1]} ${it.p.month.slice(0, 4)}`) + kv('Netto', Number(it.p.netto || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })) + kv('Herkunft', 'Finanzen › Lohn')
        : it.src === 'rech' ? kv('Anbieter', esc(it.v.vendor || '')) + kv('Betrag', Number(it.v.amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })) + kv('Fällig', it.v.due ? new Date(it.v.due + 'T12:00:00').toLocaleDateString('de-DE') : '–') + kv('Status', it.v.status === 'paid' ? 'bezahlt' : 'offen')
        : it.src === 'chat' ? kv('Gesendet', fmtD(it.date)) + kv('Herkunft', 'Messenger · ' + esc(it.chatTitle))
        : it.src === 'profil' ? kv('Herkunft', 'Profil')
        : kv('Hochgeladen', fmtD(it.date)) + `<div class="kv"><span>Ordner</span><select id="mv" class="ux-in" style="width:auto;padding:5px 8px;font-size:12px" aria-label="Ordner wählen"><option value="">Ohne Ordner</option>${folders.map(f => `<option value="${esc(f.id)}"${f.id === it.folder ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div>`);
    const acts = `<button class="ux-btn pri" data-a="dl"><i class="fa-solid fa-download"></i>Laden</button>` + (it.src === 'up' ? `<button class="ux-btn" data-a="ren"><i class="fa-solid fa-pen"></i>Umbenennen</button><button class="ux-btn full neg" data-a="del"><i class="fa-solid fa-trash-can"></i>Löschen</button>`
        : it.src === 'rech' ? '<a class="ux-btn" href="/finanzen.html#inv"><i class="fa-solid fa-arrow-up-right-from-square"></i>In Finanzen</a>' : it.src === 'lohn' ? '<a class="ux-btn" href="/finanzen.html#pay"><i class="fa-solid fa-arrow-up-right-from-square"></i>In Finanzen</a>' : it.src === 'chat' ? '<a class="ux-btn" href="/messenger.html"><i class="fa-solid fa-arrow-up-right-from-square"></i>Im Messenger</a>' : '<a class="ux-btn" href="/profil.html"><i class="fa-solid fa-arrow-up-right-from-square"></i>Im Profil ändern</a>');
    const note = it.src === 'chat' ? '<div class="ux-note" style="margin-top:12px">Chat-Nachrichten werden nach 90 Tagen gelöscht. Lade das Bild herunter, wenn du es behalten möchtest.</div>' : '';
    box.innerHTML = `<div class="pvv" id="pvv"><i class="fa-solid ${ic}" style="color:rgb(${cr})"></i></div><h3>${esc(it.name)}</h3>${rows}<div class="pa">${acts}</div>${note}`;
    if (it.k === 'img' || it.k === 'pdf') {
        try {
            const blob = await getBlob(it); if (tok !== pvToken) return; pvUrl = URL.createObjectURL(blob);
            $('pvv').innerHTML = it.k === 'img' ? `<img src="${pvUrl}" alt="Vorschau">` : `<iframe src="${pvUrl}" title="PDF-Vorschau"></iframe>`;
        } catch (e) { if (tok === pvToken) $('pvv').innerHTML = '<div class="ux-note neg" style="padding:14px;text-align:center;font-size:12.5px">Vorschau nicht möglich: ' + esc(e.message) + '</div>'; }
    }
}

// ---------- Dateien lesen, laden, löschen ----------
async function getBlob(it) {
    if (blobCache.has(it.key)) return blobCache.get(it.key);
    let blob;
    if (it.src === 'up' || it.src === 'rech') {
        const sn = await db.collection(it.src === 'rech' ? 'invoices' : 'documents').doc(it.id).collection('chunks').orderBy('i').get();
        if (!sn.size) throw new Error('Dateiinhalt fehlt.');
        blob = new Blob(sn.docs.map(d => b64Bytes(d.data().data)), { type: it.mime || 'application/octet-stream' });
        if (it.size && blob.size !== it.size) throw new Error('Datei ist unvollständig gespeichert.');
    } else blob = dataToBlob(it.data);
    blobCache.set(it.key, blob); if (blobCache.size > 6) blobCache.delete(blobCache.keys().next().value);
    return blob;
}
async function download(it) {
    try { const blob = await getBlob(it), a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: it.name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    catch (e) { UX.toast('Laden fehlgeschlagen: ' + e.message, true); }
}
async function removeDoc(id) {
    const ref = db.collection('documents').doc(id), sn = await ref.collection('chunks').get();
    for (let i = 0; i < sn.docs.length; i += 400) { const b = db.batch(); sn.docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); }
    await ref.delete();
}

// ---------- Hochladen ----------
async function makeThumb(file) {
    if (!SAFE_IMG.test(file.type)) return '';
    try {
        const url = URL.createObjectURL(file), img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        const s = 160, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'), r = Math.max(s / img.width, s / img.height);
        x.drawImage(img, (s - img.width * r) / 2, (s - img.height * r) / 2, img.width * r, img.height * r); URL.revokeObjectURL(url); return c.toDataURL('image/jpeg', .7);
    } catch (e) { return ''; }
}
function upNote(text, bad) { const d = document.createElement('div'); d.className = 'upi' + (bad ? ' bad' : ''); d.innerHTML = `<span>${esc(text)}</span><div class="bar"><i style="width:0"></i></div>`; if (bad) d.querySelector('.bar').remove(); $('upl').appendChild(d); if (bad) setTimeout(() => d.remove(), 6000); return d; }
async function uploadFiles(list) {
    const folder = BUILTIN.includes(view) ? '' : view; let done = 0;
    for (const f of [...list]) {
        if (!ALLOWED.test(f.name) && !SAFE_IMG.test(f.type) && f.type !== 'application/pdf') { upNote(`„${f.name}“: Dateityp nicht erlaubt.`, true); continue; }
        if (f.size > MAX) { upNote(`„${f.name}“ ist größer als 3 MB.`, true); continue; }
        if (!f.size) { upNote(`„${f.name}“ ist leer.`, true); continue; }
        if (usedBytes() + f.size > QUOTA) { upNote('Dein Speicher (100 MB) ist voll. Lösche zuerst Dateien.', true); break; }
        const note = upNote(`${f.name} wird hochgeladen …`), bar = note.querySelector('.bar i'); let ref = null; uploading++;
        try {
            const b64 = bufToB64(await f.arrayBuffer()), n = Math.ceil(b64.length / CH), thumb = await makeThumb(f);
            ref = db.collection('documents').doc();
            await ref.set({ owner: currentUser.email, name: f.name.slice(0, 120), mime: f.type || '', size: f.size, folder, chunks: n, status: 'uploading', thumb, createdAt: TS() });
            for (let i = 0; i < n; i++) { await ref.collection('chunks').doc(String(i).padStart(3, '0')).set({ i, data: b64.slice(i * CH, (i + 1) * CH) }); bar.style.width = Math.round((i + 1) / n * 100) + '%'; }
            await ref.update({ status: 'ready' }); done++; note.remove(); selKey = 'up:' + ref.id;
            logSystemEvent('data', 'Dokument hochgeladen', { typ: kind(f.name, f.type), groesse: f.size });
        } catch (e) { if (ref) removeDoc(ref.id).catch(() => {}); note.remove(); upNote(`„${f.name}“ konnte nicht hochgeladen werden: ${e.message}`, true); }
        finally { uploading--; }
    }
    if (done) { UX.toast(done === 1 ? 'Datei hochgeladen' : done + ' Dateien hochgeladen'); if (['lohn', 'rech', 'chat', 'profil'].includes(view)) { view = 'root'; renderAll(); } }
}

// ---------- Ordner und Namen ----------
async function saveFolders(arr) {
    folders = arr; currentUser.userPrefs = { ...(currentUser.userPrefs || {}), docFolders: arr };
    await db.collection('users').doc(currentUser.uid).update({ 'userPrefs.docFolders': arr }); renderAll();
}
function askName(ctx, title, label, value) { nameCtx = ctx; $('nm-title').textContent = title; $('nm-label').textContent = label; $('nm-input').value = value || ''; openModal('m-name'); setTimeout(() => $('nm-input').select(), 30); }
async function saveName(e) {
    e.preventDefault(); const v = $('nm-input').value.trim(); if (!v || !nameCtx) return; const c = nameCtx;
    try {
        if (c.t === 'file') await db.collection('documents').doc(c.id).update({ name: v.slice(0, 120) });
        else if (c.t === 'folder-new') { if (folders.length >= 30) throw new Error('Mehr als 30 Ordner sind nicht möglich.'); const id = 'f' + Math.random().toString(36).slice(2, 8); await saveFolders([...folders, { id, name: v.slice(0, 40) }]); view = id; renderAll(); }
        else if (c.t === 'folder-ren') await saveFolders(folders.map(f => f.id === c.id ? { ...f, name: v.slice(0, 40) } : f));
        closeModal('m-name');
    } catch (err) { UX.toast('Speichern fehlgeschlagen: ' + err.message, true); }
}
async function deleteFolder(id) {
    const f = folders.find(x => x.id === id); if (!f) return; const files = uploads.filter(d => d.folder === id);
    if (!(await uiConfirm(files.length ? `Ordner „${f.name}“ löschen? Die ${files.length} Dateien darin bleiben erhalten und wandern nach „Ohne Ordner“.` : `Ordner „${f.name}“ löschen?`, { danger: true, ok: 'Löschen' }))) return;
    try { for (const d of files) await db.collection('documents').doc(d.id).update({ folder: '' }); await saveFolders(folders.filter(x => x.id !== id)); if (view === id) view = 'all'; renderAll(); }
    catch (err) { UX.toast('Löschen fehlgeschlagen: ' + err.message, true); }
}

// ---------- Bedienung ----------
function wire() {
    $('btn-up').onclick = () => $('file').click(); $('drop').onclick = () => $('file').click();
    $('file').onchange = e => { const l = [...e.target.files]; e.target.value = ''; if (l.length) uploadFiles(l); };
    ['q', 'sort', 'type'].forEach(id => $(id).addEventListener('input', renderFiles));
    $('modes').onclick = e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.mode; ls.set('dok_mode', mode); $('modes').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); renderFiles(); };
    $('tree').onclick = e => {
        const fe = e.target.closest('[data-fe]'); if (fe) { e.stopPropagation(); return fe.dataset.fe === 'del' ? deleteFolder(fe.dataset.id) : askName({ t: 'folder-ren', id: fe.dataset.id }, 'Ordner umbenennen', 'Ordnername', folders.find(f => f.id === fe.dataset.id)?.name); }
        if (e.target.closest('[data-newfolder]')) return askName({ t: 'folder-new' }, 'Neuer Ordner', 'Ordnername', '');
        const b = e.target.closest('[data-view]'); if (b) { view = b.dataset.view; selKey = null; if (BUILTIN.includes(view)) history.replaceState(null, '', '#' + view); renderAll(); if (view === 'chat') loadChatImages(); }
    };
    $('mx').onclick = e => {
        const y = e.target.closest('[data-year]'); if (y) { year += +y.dataset.year; return renderMatrix(); }
        const p = e.target.closest('[data-pick]'); if (p) { selKey = p.dataset.pick; renderAll(); return $('pv').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        if (e.target.closest('[data-miss]')) location.href = '/finanzen.html#pay';
    };
    $('files').onclick = e => { const b = e.target.closest('[data-key]'); if (!b) return; selKey = b.dataset.key; renderFiles(); renderPreview(); if (innerWidth < 1300) $('pv').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
    $('pv').onclick = async e => {
        const b = e.target.closest('[data-a]'), it = selected(); if (!b || !it) return;
        if (b.dataset.a === 'dl') download(it);
        else if (b.dataset.a === 'ren') askName({ t: 'file', id: it.id }, 'Datei umbenennen', 'Dateiname', it.name);
        else if (b.dataset.a === 'del' && (await uiConfirm(`„${it.name}“ endgültig löschen?`, { danger: true, ok: 'Löschen' }))) removeDoc(it.id).then(() => { selKey = null; blobCache.delete(it.key); UX.toast('Datei gelöscht'); logSystemEvent('data', 'Dokument gelöscht'); }).catch(err => UX.toast('Löschen fehlgeschlagen: ' + err.message, true));
    };
    $('pv').onchange = e => { if (e.target.id !== 'mv') return; const it = selected(); if (it) db.collection('documents').doc(it.id).update({ folder: e.target.value }).catch(err => UX.toast('Verschieben fehlgeschlagen: ' + err.message, true)); };
    // Ziehen und Ablegen (auch auf die ganze Seite)
    const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
    window.addEventListener('dragenter', e => { if (hasFiles(e)) document.body.classList.add('dragging'); });
    window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
    window.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); document.body.classList.remove('dragging'); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); });
    window.addEventListener('beforeunload', e => { if (uploading) { e.preventDefault(); e.returnValue = ''; } });
}
