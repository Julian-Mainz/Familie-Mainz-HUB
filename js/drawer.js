// js/drawer.js - Aktualisiertes Menü mit Status-Modul
function renderDrawer() {
    if (document.getElementById('side-drawer')) return;

    const drawerHtml = `
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

            <nav class="space-y-1.5">
                <a href="/" class="flex items-center gap-3 text-slate-300 hover:bg-slate-800/80 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all">
                    <i class="fa-solid fa-border-all w-5 text-indigo-400"></i>
                    <span>Start Menü</span>
                </a>
                <a href="/zeiterfassung.html" class="flex items-center gap-3 text-slate-300 hover:bg-slate-800/80 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all">
                    <i class="fa-solid fa-business-time w-5 text-emerald-400"></i>
                    <span class="text-emerald-300">Zeiterfassung</span>
                </a>
                <a href="/finanzen.html" class="flex items-center gap-3 text-slate-300 hover:bg-slate-800/80 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all">
                    <i class="fa-solid fa-coins w-5 text-yellow-400"></i>
                    <span class="text-yellow-300">Finanzen & Sparkasse</span>
                </a>
                <a href="/passwort.html" class="flex items-center gap-3 text-slate-300 hover:bg-slate-800/80 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all">
                    <i class="fa-solid fa-shield-halved w-5 text-amber-400"></i>
                    <span class="text-amber-300">Passwort-Safe</span>
                </a>
                <a href="/admin.html" class="flex items-center gap-3 text-slate-300 hover:bg-slate-800/80 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all">
                    <i class="fa-solid fa-user-shield w-5 text-indigo-400"></i>
                    <span class="text-indigo-300">Admin & Rechte</span>
                </a>
                <a href="/logs.html" class="flex items-center gap-3 text-slate-300 hover:bg-slate-800/80 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all">
                    <i class="fa-solid fa-timeline w-5 text-cyan-400"></i>
                    <span class="text-cyan-300">System-Logs</span>
                </a>
                <a href="/status.html" class="flex items-center gap-3 text-slate-300 hover:bg-slate-800/80 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all border border-indigo-500/20 bg-indigo-600/10">
                    <i class="fa-solid fa-server w-5 text-indigo-400"></i>
                    <span class="text-indigo-300 font-semibold">System-Status & Limits</span>
                </a>
            </nav>
        </div>

        <div class="space-y-3 pt-4 border-t border-slate-800/80">
            <div>
                <div class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-2">
                    <i class="fa-solid fa-server text-indigo-400 text-xs"></i> System-Status
                </div>
                <div class="space-y-1.5">
                    <div class="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800/60 text-xs">
                        <span class="text-slate-300">Netzwerk</span>
                        <span id="stat-conn-status" class="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
                        </span>
                    </div>
                </div>
            </div>
            <div class="text-[11px] text-slate-500 text-center font-medium">J.Mainz Dashboard</div>
        </div>
    </aside>
    `;

    document.body.insertAdjacentHTML('afterbegin', drawerHtml);
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
