/* ================================================================
   NAVBAR.JS — Menu hamburger, dropdown, modals A propos/Contact
   Injecte le header dans #navbar-root au chargement de la page.
   IMPORTANT : doit etre charge AVANT admin.js et main.js puisque
   ces fichiers font reference a des elements du header
   (admin-trigger, theme-icon, week-info, notif-status...).
================================================================ */

(function injectNavbar() {
    var root = document.getElementById('navbar-root');
    if (!root) return;
    root.innerHTML = `<header class="bg-blue-700 text-white px-6 py-4 shadow-2xl z-50 flex justify-between items-center shrink-0">
        <div class="flex flex-col">
            <h1 id="admin-trigger" class="text-xl lg:text-2xl font-black italic tracking-tighter cursor-pointer select-none">🏠 GESTION APPART 48</h1>
            <p id="week-info" class="text-[10px] font-bold uppercase tracking-widest opacity-80 italic">Chargement...</p>
        </div>
        <div class="relative">
            <div id="notif-status" class="hidden"></div>
            <button id="menu-trigger" onclick="toggleMenu()" class="text-2xl px-3 py-2 bg-white/10 rounded-2xl hover:bg-white/20 transition-all active:scale-95">
                ☰
            </button>
            <div id="dropdown-menu" class="hidden absolute right-0 top-full mt-2 w-60 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[100] text-left">
                <button onclick="toggleDarkMode()" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3">
                    <span id="theme-icon">🌓</span> Mode sombre / clair
                </button>
                <button onclick="showNotifInfo()" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3">
                    🔔 Mon canal Ntfy
                </button>
                <button onclick="openAboutModal()" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3">
                    ℹ️ À propos
                </button>
                <button onclick="openContactModal()" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3">
                    ✉️ Contact
                </button>
                <div class="border-t border-slate-200 dark:border-slate-700"></div>
                <button onclick="closeMenuThen(confirmLogout)" class="w-full text-left px-4 py-3 text-sm font-black text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3">
                    🚪 Se déconnecter
                </button>
            </div>
        </div>
    </header>`;
})();

        /* ── MENU HAMBURGER ── */
        function toggleMenu() {
            document.getElementById('dropdown-menu').classList.toggle('hidden');
        }
        function closeMenu() {
            document.getElementById('dropdown-menu').classList.add('hidden');
        }
        function closeMenuThen(fn) {
            closeMenu();
            fn();
        }
        /* Ferme le menu si on clique en dehors */
        document.addEventListener('click', function(e) {
            var menu = document.getElementById('dropdown-menu');
            var trigger = document.getElementById('menu-trigger');
            if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !trigger.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });

        function openAboutModal() {
            closeMenu();
            document.getElementById('about-modal').classList.remove('hidden');
        }
        function openContactModal() {
            closeMenu();
            document.getElementById('contact-modal').classList.remove('hidden');
        }

