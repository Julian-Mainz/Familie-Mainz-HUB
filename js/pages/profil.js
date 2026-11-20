// js/pages/profil.js - Seiten-Code von /profil.html (ausgelagert, damit der Browser ihn zwischenspeichern kann)
const e2 = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PERM_GROUPS = [['Startseite', { termine: 'Kalender & Termine', pinnwand: 'Pinnwand', aufgaben: 'Aufgaben & Einkauf' }], ['Bereiche', { zeit: 'Zeiterfassung', finanzen: 'Finanzen', tresor: 'Passwort-Safe', wand: 'Wandkalender', spotify: 'Spotify', webapps: 'Web-Apps', dokumente: 'Dokumente' }], ['Kommunikation', { messenger: 'Messenger', gruppen: 'Gruppen erstellen' }]];
const userRef = () => db.collection('users').doc(currentUser.uid);
const fmtD = t => t && t.toDate ? t.toDate().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '–';
const fmtDT = t => t && t.toDate ? t.toDate().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '–';
function toast(msg, bad) { document.querySelectorAll('.pf-toast').forEach(x => x.remove()); const t = document.createElement('div'); t.className = 'pf-toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3600); }
const callOrWait = fn => { if (typeof window[fn] === 'function') window[fn](); else toast('Wird noch geladen. Bitte gleich noch einmal klicken.', true); };

initAuthGuard(user => {
    if (!user) return;
    renderDrawer(); renderAll();
    $('file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) openCrop(f); });
});

function renderAll() {
    const u = currentUser, hasPhoto = PHOTO_OK.test(u.photo || '');
    $('hero-av').style.background = avatarGradient(u.avatarColor); $('hero-av').innerHTML = avatarInner(u);
    $('hero-name').textContent = u.name; $('hero-mail').textContent = u.email;
    $('hero-chips').innerHTML = `<span class="pf-chip role"><i class="fa-solid fa-user-shield"></i>${roleLabel(u)}</span><span class="pf-chip"><i class="fa-regular fa-calendar-days"></i>Mitglied seit ${fmtD(u.createdAt)}</span><span class="pf-chip"><i class="fa-solid fa-clock"></i>Letzter Login ${fmtDT(u.lastLogin)}</span>`;
    $('btn-rmphoto').style.display = hasPhoto ? '' : 'none';
    $('f-first').value = u.firstName === (u.email || '').split('@')[0] && !u.lastName ? '' : u.firstName; $('f-last').value = u.lastName || ''; $('f-mail').value = u.email;
    $('swatches').innerHTML = AVATAR_COLORS.map((_, i) => `<button type="button" class="pf-sw${(+u.avatarColor || 0) % AVATAR_COLORS.length === i ? ' on' : ''}" data-i="${i}" style="background:${avatarGradient(i)}" aria-label="Farbe ${i + 1}"></button>`).join('');
    $('swatches').onclick = e => { const b = e.target.closest('[data-i]'); if (b) setColor(+b.dataset.i); };
    $('perms').innerHTML = PERM_GROUPS.map(([g, m]) => `<div class="pf-grouplbl">${g}</div><div class="pf-perms">${Object.entries(m).map(([k, l]) => `<span class="pf-perm ${can(u, k) ? 'yes' : 'no'}"><i class="fa-solid ${can(u, k) ? 'fa-check' : 'fa-xmark'}"></i>${l}</span>`).join('')}</div>`).join('')
        + (isAdmin(u) ? '<div class="pf-grouplbl">Verwaltung</div><div class="pf-perms"><span class="pf-perm yes"><i class="fa-solid fa-check"></i>Administration</span></div>' : '');
    refreshSidebarUser();
}

async function saveField(data) { await userRef().update(data); Object.assign(currentUser, data); }
async function saveProfile(e) {
    e.preventDefault();
    const first = $('f-first').value.trim(), last = $('f-last').value.trim();
    if (!first) return toast('Bitte einen Vornamen eingeben.', true);
    const btn = $('btn-save'); btn.disabled = true;
    try {
        const displayName = `${first} ${last}`.trim();
        await saveField({ firstName: first, lastName: last, displayName });
        currentUser.name = displayName; logSystemEvent('data', 'Profil geändert'); renderAll(); toast('Profil gespeichert');
    } catch (err) { toast('Speichern fehlgeschlagen: ' + err.message, true); } finally { btn.disabled = false; }
}
async function setColor(i) { try { await saveField({ avatarColor: i }); renderAll(); } catch (err) { toast('Konnte die Farbe nicht speichern: ' + err.message, true); } }
async function removePhoto() {
    if (!(await uiConfirm('Profilbild wirklich entfernen?', { danger: true, ok: 'Entfernen' }))) return;
    try { await userRef().update({ photo: firebase.firestore.FieldValue.delete() }); currentUser.photo = ''; logSystemEvent('data', 'Profilbild entfernt'); renderAll(); toast('Bild entfernt'); }
    catch (err) { toast('Entfernen fehlgeschlagen: ' + err.message, true); }
}

// ---------- Profilbild: zuschneiden und verkleinern ----------
const CR = { img: null, size: 280, min: 1, scale: 1, x: 0, y: 0, drag: null }, cv = $('crop-canvas'), cx = cv.getContext('2d');
function openCrop(file) {
    if (!/^image\//.test(file.type)) return toast('Bitte eine Bilddatei auswählen.', true);
    if (file.size > 15 * 1024 * 1024) return toast('Das Bild ist zu groß (höchstens 15 MB).', true);
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
        URL.revokeObjectURL(url); CR.img = img; CR.min = CR.size / Math.min(img.width, img.height); CR.scale = CR.min;
        CR.x = (CR.size - img.width * CR.scale) / 2; CR.y = (CR.size - img.height * CR.scale) / 2; $('crop-zoom').value = 1; drawCrop(); $('crop-modal').classList.add('show');
    };
    img.onerror = () => toast('Dieses Bild konnte nicht gelesen werden.', true); img.src = url;
}
function clampCrop() { const w = CR.img.width * CR.scale, h = CR.img.height * CR.scale; CR.x = Math.min(0, Math.max(CR.size - w, CR.x)); CR.y = Math.min(0, Math.max(CR.size - h, CR.y)); }
function drawCrop() { cx.fillStyle = '#0b1220'; cx.fillRect(0, 0, CR.size, CR.size); cx.drawImage(CR.img, CR.x, CR.y, CR.img.width * CR.scale, CR.img.height * CR.scale); }
$('crop-zoom').addEventListener('input', e => {       // Zoom um die Mitte
    const ns = CR.min * +e.target.value, k = ns / CR.scale, c = CR.size / 2; CR.x = c - (c - CR.x) * k; CR.y = c - (c - CR.y) * k; CR.scale = ns; clampCrop(); drawCrop();
});
const stage = $('stage');
stage.addEventListener('pointerdown', e => { CR.drag = { x: e.clientX, y: e.clientY }; stage.setPointerCapture(e.pointerId); });
stage.addEventListener('pointermove', e => { if (!CR.drag || !CR.img) return; CR.x += e.clientX - CR.drag.x; CR.y += e.clientY - CR.drag.y; CR.drag = { x: e.clientX, y: e.clientY }; clampCrop(); drawCrop(); });
['pointerup', 'pointercancel'].forEach(t => stage.addEventListener(t, () => { CR.drag = null; }));
function closeCrop() { $('crop-modal').classList.remove('show'); CR.img = null; }
async function applyCrop() {
    if (!CR.img) return; const btn = $('btn-crop'); btn.disabled = true;
    try {
        const out = document.createElement('canvas'); out.width = out.height = 256; const o = out.getContext('2d'), r = 256 / CR.size;
        o.fillStyle = '#0b1220'; o.fillRect(0, 0, 256, 256); o.drawImage(CR.img, CR.x * r, CR.y * r, CR.img.width * CR.scale * r, CR.img.height * CR.scale * r);
        let q = 0.88, data = out.toDataURL('image/jpeg', q);
        while (data.length > 120000 && q > 0.4) { q -= 0.1; data = out.toDataURL('image/jpeg', q); }          // bleibt klein (Datenbank-Limit)
        if (!PHOTO_OK.test(data)) throw new Error('Das Bild konnte nicht erstellt werden.');
        await saveField({ photo: data }); logSystemEvent('data', 'Profilbild geändert'); closeCrop(); renderAll(); toast('Profilbild gespeichert');
    } catch (err) { toast('Speichern fehlgeschlagen: ' + err.message, true); } finally { btn.disabled = false; }
}

// ---------- Passwort ----------
function strength(p) { let s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++; return Math.min(4, s); }
function meter() {
    const p = $('p-new').value, s = p ? Math.max(1, strength(p)) : 0, L = [['', '#475569'], ['Schwach', '#ef4444'], ['Geht so', '#f59e0b'], ['Gut', '#84cc16'], ['Stark', '#22c55e']][s];
    $('meter-bar').style.width = (p ? Math.max(12, s * 25) : 0) + '%'; $('meter-bar').style.background = L[1]; $('meter-txt').textContent = p ? L[0] : '';
}
async function changePassword(e) {
    e.preventDefault();
    const cur = $('p-cur').value, nw = $('p-new').value, rep = $('p-rep').value;
    if (nw.length < 8) return toast('Das neue Passwort braucht mindestens 8 Zeichen.', true);
    if (nw !== rep) return toast('Die beiden neuen Passwörter stimmen nicht überein.', true);
    if (nw === cur) return toast('Das neue Passwort muss sich vom alten unterscheiden.', true);
    const btn = $('btn-pw'); btn.disabled = true;
    try {
        const u = auth.currentUser; await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, cur)); await u.updatePassword(nw);
        logSystemEvent('auth', 'Passwort geändert'); ['p-cur', 'p-new', 'p-rep'].forEach(i => { $(i).value = ''; }); meter(); toast('Passwort geändert');
    } catch (err) {
        const m = { 'auth/wrong-password': 'Das aktuelle Passwort stimmt nicht.', 'auth/invalid-credential': 'Das aktuelle Passwort stimmt nicht.', 'auth/weak-password': 'Das neue Passwort ist zu schwach.', 'auth/too-many-requests': 'Zu viele Versuche. Bitte später erneut versuchen.', 'auth/requires-recent-login': 'Bitte melde dich neu an und versuche es noch einmal.' };
        toast(m[err.code] || 'Passwort ändern fehlgeschlagen: ' + err.message, true);
    } finally { btn.disabled = false; }
}
