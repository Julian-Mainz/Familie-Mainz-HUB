// js/pages/passwort.js - Seiten-Code von /passwort.html (ausgelagert, damit der Browser ihn zwischenspeichern kann)
const openModal = id => $(id).classList.remove('hidden');
const closeModal = id => $(id).classList.add('hidden');
const run = async fn => { try { await fn(); } catch (e) { alert('Fehler: ' + e.message); } };

// ---------- Kryptografie ----------
const ITER = 600000, LEGACY_ITER = 100000, MASK = '••••••••';
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function deriveKey(password, salt, iter) {
    const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encWith(key, text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
    return { cipher: b64(new Uint8Array(ct)), iv: b64(iv) };
}
async function decWith(key, cipher, iv) {
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(cipher)));
}
async function legacyDecrypt(item, pass) {
    return decWith(await deriveKey(pass, unb64(item.salt), LEGACY_ITER), item.cipher, item.iv);
}

// ---------- Zustand ----------
let vaultKey = null, checkDoc = null, items = [], started = false;
let failures = 0, lockoutUntil = 0, lastActivity = Date.now();
const secrets = new Map();       // id -> Klartext, nur im Speicher

initAuthGuard(user => {
    if (!user || started) return;
    started = true;
    renderDrawer();
    db.collection('vault').where('owner', '==', currentUser.email).onSnapshot(s => {
        const all = s.docs.map(d => ({ id: d.id, ...d.data() }));
        checkDoc = all.find(i => i.kind === 'check') || null;
        items = all.filter(i => !i.kind);
        updateUnlockMode();
        if (vaultKey) renderVaultItems();
    }, err => { $('vault-hint').innerText = 'Safe konnte nicht geladen werden: ' + err.message; });
    $('vault-items-list').addEventListener('click', onListClick);
    ['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
    setInterval(() => {
        if (!vaultKey) return;
        const left = 5 * 60 * 1000 - (Date.now() - lastActivity);
        if (left <= 0) return lockVault();
        $('lock-eta').textContent = `sperrt in ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    }, 1000);
}, { perm: 'tresor' });

function updateUnlockMode() {
    const setup = !checkDoc && items.length === 0;
    $('pass2-wrap').classList.toggle('hidden', !setup);
    $('vault-master-pass2').required = setup;
    $('btn-unlock').disabled = false;
    $('btn-unlock').innerHTML = setup ? '<i class="fa-solid fa-shield-halved"></i>Safe einrichten' : '<i class="fa-solid fa-lock-open"></i>Safe entsperren';
    $('vault-hint').innerText = setup
        ? 'Lege ein Master-Passwort fest (mind. 8 Zeichen). Es wird nirgends gespeichert. Wer es vergisst, verliert den Zugriff auf alle Einträge.'
        : 'Deine Einträge sind per AES-256 direkt im Browser verschlüsselt. Ohne Master-Passwort sind sie unlesbar.';
}

// ---------- Entsperren / Sperren ----------
async function createCheck(pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(pass, salt, ITER);
    const { cipher, iv } = await encWith(key, 'vault-ok');
    const doc = { kind: 'check', v: 2, salt: b64(salt), iter: ITER, cipher, iv, owner: currentUser.email };
    await db.collection('vault').doc('meta-' + currentUser.uid).set({ ...doc, createdAt: TS() });
    checkDoc = doc; vaultKey = key;
}

// Alte Einträge (v1, 100.000 Iterationen, Titel im Klartext) einmalig neu verschlüsseln
async function migrateLegacy(pass) {
    for (const it of items.filter(i => i.v !== 2)) {
        try {
            const secret = await legacyDecrypt(it, pass);
            const { cipher, iv } = await encWith(vaultKey, JSON.stringify({ title: it.title || '', username: it.username || '', secret }));
            const del = firebase.firestore.FieldValue.delete();
            await db.collection('vault').doc(it.id).update({ v: 2, cipher, iv, title: del, username: del, salt: del });
        } catch (e) { /* bleibt als "nicht lesbar" stehen */ }
    }
}

async function unlockVault(e) {
    e.preventDefault();
    if (Date.now() < lockoutUntil) return alert(`Bitte ${Math.ceil((lockoutUntil - Date.now()) / 1000)} Sekunden warten.`);
    const pass = $('vault-master-pass').value;
    if (!pass) return;
    const btn = $('btn-unlock'), label = btn.innerHTML;
    btn.disabled = true; btn.innerText = 'Prüfe...';
    const fail = () => { failures++; lockoutUntil = Date.now() + Math.min(30000, 2000 * failures); alert('Falsches Master-Passwort.'); logSystemEvent('auth', 'Tresor: falsches Master-Passwort'); };
    try {
        const legacy = items.filter(i => i.v !== 2);
        if (checkDoc) {
            const key = await deriveKey(pass, unb64(checkDoc.salt), checkDoc.iter || ITER);
            let ok = false;
            try { ok = (await decWith(key, checkDoc.cipher, checkDoc.iv)) === 'vault-ok'; } catch (err) {}
            if (!ok) return fail();
            vaultKey = key;
        } else if (legacy.length) {
            try { await legacyDecrypt(legacy[0], pass); } catch (err) { return fail(); }
            await createCheck(pass);
        } else {
            if (pass.length < 8) return alert('Das Master-Passwort braucht mindestens 8 Zeichen.');
            if (pass !== $('vault-master-pass2').value) return alert('Die beiden Passwörter stimmen nicht überein.');
            await createCheck(pass);
            logSystemEvent('data', 'Tresor eingerichtet');
        }
        failures = 0;
        await migrateLegacy(pass);
        lastActivity = Date.now();
        $('vault-locked-view').classList.add('hidden');
        $('vault-unlocked-view').classList.remove('hidden'); $('vault-actions').classList.remove('hidden'); $('lock-eta').textContent = 'sperrt in 5:00';
        await renderVaultItems();
    } catch (err) {
        alert('Fehler: ' + err.message);
    } finally {
        $('vault-master-pass').value = ''; $('vault-master-pass2').value = '';
        btn.disabled = false; btn.innerHTML = label;
    }
}

function lockVault() {
    vaultKey = null; secrets.clear();
    $('vault-items-list').innerHTML = '';
    $('vault-unlocked-view').classList.add('hidden'); $('vault-actions').classList.add('hidden'); $('vault-sub').textContent = 'Verschlüsselt, nur mit deinem Master-Passwort lesbar';
    $('vault-locked-view').classList.remove('hidden');
    updateUnlockMode();
}

// ---------- Einträge ----------
async function renderVaultItems() {
    const list = $('vault-items-list');
    if (!vaultKey) return;
    secrets.clear();
    const rows = [];
    for (const it of items) {
        if (it.v === 2) {
            try { rows.push({ id: it.id, ...JSON.parse(await decWith(vaultKey, it.cipher, it.iv)) }); }
            catch (e) { rows.push({ id: it.id, title: 'Nicht lesbar', username: 'Eintrag konnte nicht entschlüsselt werden', secret: null }); }
        } else rows.push({ id: it.id, title: it.title || 'Alter Eintrag', username: 'Altes Format. Bitte Safe sperren und neu entsperren.', secret: null });
    }
    rows.sort((a, b) => a.title.localeCompare(b.title, 'de'));
    rows.forEach(r => { if (r.secret !== null) secrets.set(r.id, r.secret); });
    const PAL = [['#f472b6', '244,114,182'], ['#22d3ee', '34,211,238'], ['#fb923c', '251,146,60'], ['#f87171', '248,113,113'], ['#818cf8', '129,140,248'], ['#34d399', '52,211,153'], ['#fbbf24', '251,191,36'], ['#a78bfa', '167,139,250']];
    $('vault-sub').textContent = `${rows.length} ${rows.length === 1 ? 'Eintrag' : 'Einträge'}`;
    list.innerHTML = rows.length ? rows.map(r => {
        const c = PAL[[...r.title].reduce((s, ch) => s + ch.charCodeAt(0), 0) % PAL.length];
        return `<div class="ux-card vi" data-id="${esc(r.id)}" style="--c:${c[0]};--cr:${c[1]}">
            <div class="top"><div class="tile"><i class="fa-solid fa-key"></i></div><div class="nm"><div class="ell">${esc(r.title)}</div>${r.username ? `<small class="ell">${esc(r.username)}</small>` : ''}</div>
                <button data-act="del" class="ux-ib bad" title="Löschen" aria-label="Eintrag löschen"><i class="fa-solid fa-trash-can"></i></button></div>
            <div class="sec"><span data-val class="dots">${r.secret === null ? '—' : MASK}</span><span class="acts">
                <button data-act="show" class="ux-ib" ${r.secret === null ? 'disabled' : ''} title="Anzeigen / Maskieren" aria-label="Passwort anzeigen"><i class="fa-regular fa-eye"></i></button>
                <button data-act="copy" class="ux-ib" ${r.secret === null ? 'disabled' : ''} title="Kopieren" aria-label="Passwort kopieren"><i class="fa-regular fa-copy"></i></button></span></div></div>`;
    }).join('') : '<div class="ux-card ux-empty" style="grid-column:1/-1"><i class="fa-solid fa-key"></i>Noch keine Einträge im Tresor.</div>';
}

async function onListClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const box = btn.closest('[data-id]'), id = box.dataset.id, val = box.querySelector('[data-val]');
    if (btn.dataset.act === 'show') val.textContent = val.textContent === MASK ? secrets.get(id) : MASK;
    else if (btn.dataset.act === 'copy') run(async () => {
        await navigator.clipboard.writeText(secrets.get(id));
        setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30000);
        alert('Kopiert! Die Zwischenablage wird nach 30 Sekunden geleert.');
    });
    else if (btn.dataset.act === 'del' && (await uiConfirm('Eintrag wirklich löschen?', { danger: true, ok: 'Löschen' })))
        run(async () => { await db.collection('vault').doc(id).delete(); logSystemEvent('data', 'Tresor-Eintrag gelöscht'); });
}

function openAddVaultItemModal() {
    ['vault-title', 'vault-username', 'vault-secret'].forEach(id => $(id).value = '');
    openModal('modal-vault-add');
}

function generatePassword() {
    const set = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?-_';
    const limit = Math.floor(4294967296 / set.length) * set.length, out = [];
    while (out.length < 20) { const [r] = crypto.getRandomValues(new Uint32Array(1)); if (r < limit) out.push(set[r % set.length]); }
    $('vault-secret').value = out.join('');
}

function saveVaultItem(e) {
    e.preventDefault();
    if (!vaultKey) return;
    const payload = JSON.stringify({ title: $('vault-title').value.trim(), username: $('vault-username').value.trim(), secret: $('vault-secret').value });
    return run(async () => {
        const { cipher, iv } = await encWith(vaultKey, payload);
        await db.collection('vault').add({ v: 2, cipher, iv, owner: currentUser.email, createdAt: TS() });
        closeModal('modal-vault-add');
        logSystemEvent('data', 'Tresor-Eintrag angelegt');
    });
}
