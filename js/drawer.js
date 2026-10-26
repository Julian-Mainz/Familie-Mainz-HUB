// js/drawer.js - Menü, blendet Punkte ohne Berechtigung aus und markiert die aktuelle Seite
const DRAWER_LINKS = [
    { href: '/',                        label: 'Start Menü',             icon: 'fa-border-all',     icon_c: 'text-indigo-400',  text_c: 'text-slate-200' },
    { href: '/zeiterfassung.html',      label: 'Zeiterfassung',         icon: 'fa-business-time',  icon_c: 'text-emerald-400', text_c: 'text-emerald-300', perm: 'zeit' },
    { href: '/finanzen.html',           label: 'Finanzen & Sparkasse',  icon: 'fa-coins',          icon_c: 'text-yellow-400',  text_c: 'text-yellow-300',  perm: 'finanzen' },
    { href: '/passwort.html',           label: 'Passwort-Safe',         icon: 'fa-shield-halved',  icon_c: 'text-amber-400',   text_c: 'text-amber-300',   perm: 'tresor' },
    { href: '/whatsapp.html',           label: 'WhatsApp Quick-Chat',   icon: 'fa-whatsapp',       icon_c: 'text-emerald-400', text_c: 'text-emerald-300', perm: 'tresor' }, // <-- HIER NEU EINGEFÜGT
    { href: '/admin.html',              label: 'Admin & Rechte',        icon: 'fa-user-shield',    icon_c: 'text-indigo-400',  text_c: 'text-indigo-300',  admin: true },
    { href: '/logs.html',               label: 'System-Logs',           icon: 'fa-timeline',       icon_c: 'text-cyan-400',    text_c: 'text-cyan-300',    admin: true },
    { href: '/status.html',             label: 'System-Status & Limits', icon: 'fa-server',        icon_c: 'text-indigo-400',  text_c: 'text-indigo-300',  admin: true }
];

function normPath(p) {
    return p.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1') || '/';
}

function renderDrawer() {
    if (document.getElementById('side-drawer')) return;

    const here = normPath(window.location.pathname);
    const user = (typeof currentUser !== 'undefined') ? currentUser : null;

    const links = DRAWER_LINKS
        .filter(l => !l.perm || (typeof can === 'function' && can(user, l.perm)))
        .filter(l => !l.admin || (typeof isAdmin === 'function' && isAdmin(user)))
        .map(l => {
            const active = normPath(l.href) === here;
            return `
            <a href="${l.href}" class="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all hover:bg-slate-800/80 ${active ? 'bg-indigo-600/20 border border-indigo-500/30' : ''}">
                <i class="fa-solid ${l.icon} w-5 ${l.icon_c}"></i>
                <span class="${l.text_c}">${l.label}</span>
            </a>`;
        }).join('');

    const html = `
    <div id="menu-backdrop" onclick="toggleSideMenu(false)" class="fixed inset-0 bg-slate-950/70 z-50 opacity-0 pointer-events-none transition-opacity duration-200"></div>
    <aside id="side-drawer" class="fixed top-0 left-0 bottom-0 w-72 bg-slate-900 border-r border-slate-800 z-50 p-6 flex flex-col justify-between shadow-2xl -translate-x-full transition-transform duration-200 ease-out">
        <div>
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                        <i class="fa-solid fa-house"></i>
                    </div>
                    <span class="font-bold text-sm tracking-wide text-slate-200">J.Mainz Dashboard</span>
                </div>
                <button onclick="toggleSideMenu(false)" class="text-slate-400 hover:text-slate-200 p-1.5 transition-colors">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>
            <nav class="space-y-1.5">${links}
                <button onclick="toggleSideMenu(false); if (typeof openSettingsModal === 'function') openSettingsModal();" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all hover:bg-slate-800/80 border border-slate-800 text-left">
                    <i class="fa-solid fa-gear w-5 text-slate-400"></i>
                    <span class="text-slate-200">Einstellungen &amp; Alarm</span>
                </button>
            </nav>
        </div>
        <div class="pt-4 border-t border-slate-800/80">
            <div class="text-[11px] text-slate-500 text-center font-medium">J.Mainz Dashboard &bull; v4.0</div>
        </div>
    </aside>`;

    document.body.insertAdjacentHTML('afterbegin', html);

    // Einstellungen & Push nachladen, damit auf den Seiten nichts ergänzt werden muss
    if (!document.getElementById('settings-js')) {
        const s = document.createElement('script');
        s.id = 'settings-js';
        s.src = '/js/settings.js';
        document.head.appendChild(s);
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleSideMenu(false); });
}

function toggleSideMenu(open) {
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('menu-backdrop');
    if (!drawer || !backdrop) return;
    if (open) {
        backdrop.classList.remove('opacity-0', 'pointer-events-none');
        drawer.classList.remove('-translate-x-full');
    } else {
        drawer.classList.add('-translate-x-full');
        backdrop.classList.add('opacity-0', 'pointer-events-none');
    }
}
