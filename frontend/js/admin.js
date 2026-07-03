/**
 * admin.js — Tableau de bord administration
 * Platform-Verification (PostgreSQL + JWT Auth)
 */

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3000'
        : '';

    /* ── JWT Auth ───────────────────────────────────────── */
    let authToken = localStorage.getItem('admin_token') || null;

    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        };
    }

    function logout() {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_info');
        authToken = null;
        document.getElementById('login-modal').style.display = 'flex';
    }

    /* ── Modal de login ─────────────────────────────────── */
    const loginModal  = document.getElementById('login-modal');
    const loginForm   = document.getElementById('login-form');
    const loginError  = document.getElementById('login-error');
    const loginSubmit = document.getElementById('login-submit-btn');
    const togglePw    = document.getElementById('toggle-pw');
    const pwInput     = document.getElementById('login-password');

    // Afficher/masquer le mot de passe
    if (togglePw) {
        togglePw.addEventListener('click', () => {
            const isHidden = pwInput.type === 'password';
            pwInput.type = isHidden ? 'text' : 'password';
            togglePw.querySelector('span').textContent = isHidden ? 'visibility_off' : 'visibility';
        });
    }

    async function tryLogin(email, password) {
        loginSubmit.disabled = true;
        loginSubmit.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Connexion…';
        loginError.classList.add('hidden');

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (res.ok) {
                authToken = data.token;
                localStorage.setItem('admin_token', data.token);
                localStorage.setItem('admin_info', JSON.stringify(data.admin));
                // Mettre à jour le nom dans le dashboard
                const greetEl = document.querySelector('h1.font-headline-lg');
                if (greetEl && data.admin?.nom) greetEl.textContent = `Bonjour, ${data.admin.nom}`;
                // Masquer le modal avec animation
                loginModal.style.transition = 'opacity 0.4s ease';
                loginModal.style.opacity = '0';
                setTimeout(() => { loginModal.style.display = 'none'; }, 400);
                // Charger les données
                loadDataForTab('analytics');
                setTimeout(animateChart, 600);
            } else {
                loginError.textContent = data.error || 'Identifiants incorrects.';
                loginError.classList.remove('hidden');
            }
        } catch (err) {
            // Fallback démo si le backend est hors ligne
            console.warn('[Admin] Backend injoignable — mode démo activé');
            loginModal.style.transition = 'opacity 0.4s ease';
            loginModal.style.opacity = '0';
            setTimeout(() => { loginModal.style.display = 'none'; }, 400);
            useFallback = true;
        } finally {
            loginSubmit.disabled = false;
            loginSubmit.innerHTML = '<span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1;">lock_open</span> Se connecter';
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email    = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            tryLogin(email, password);
        });
    }

    // Vérifier si déjà connecté
    if (authToken) {
        loginModal.style.display = 'none';
    } else {
        loginModal.style.display = 'flex';
    }

    // Bouton de déconnexion (à ajouter dynamiquement)
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logout-btn';
    logoutBtn.className = 'text-on-surface-variant hover:bg-surface-container-high rounded-lg mx-2 flex items-center px-4 py-3 font-label-md text-label-md transition-all mt-auto';
    logoutBtn.innerHTML = '<span class="material-symbols-outlined mr-3">logout</span>Déconnexion';
    logoutBtn.addEventListener('click', logout);
    const sidebarNav = document.querySelector('aside nav');
    if (sidebarNav) sidebarNav.appendChild(logoutBtn);


    const tabBtns   = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    /* ── Fonction de changement d'onglet (partagée Desktop + Mobile) ── */
    function switchToTab(targetTab) {
        // Desktop tabs
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        const desktopBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
        if (desktopBtn) desktopBtn.classList.add('active');
        document.getElementById('tab-' + targetTab)?.classList.add('active');

        // Mobile tabs
        document.querySelectorAll('.mobile-tab-btn').forEach(b => {
            b.classList.remove('text-primary');
            b.classList.add('text-on-surface-variant');
        });
        const mobileBtn = document.querySelector(`.mobile-tab-btn[data-tab="${targetTab}"]`);
        if (mobileBtn) {
            mobileBtn.classList.remove('text-on-surface-variant');
            mobileBtn.classList.add('text-primary');
        }

        loadDataForTab(targetTab);
        if (targetTab === 'analytics') animateChart();
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchToTab(btn.dataset.tab));
    });

    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchToTab(btn.dataset.tab));
    });


    function animateChart() {
        const path = document.querySelector('.chart-line');
        if (path) {
            const length = path.getTotalLength();
            path.style.strokeDasharray = length;
            path.style.strokeDashoffset = length;
            // Force reflow
            path.getBoundingClientRect();
            path.style.transition = 'stroke-dashoffset 2.5s ease-in-out';
            path.style.strokeDashoffset = '0';
        }
    }

    /* ── Données locales de secours (Fallback Démo) ────── */
    let localPending = [
        { id: '1', code: 'A7X-92B-441', email: 'jean.dupont@entreprise.fr', date: 'Il y a 5 min' },
        { id: '2', code: 'B22-88C-190', email: 'jean.dupont@entreprise.fr', date: 'Il y a 5 min' },
        { id: '3', code: 'RAD-314-159', email: 'marie.curie@lab.fr', date: 'Il y a 12 min' },
        { id: '4', code: 'PCS-771-002', email: 'pierre.martin@societe.fr', date: 'Il y a 28 min' }
    ];
    const validesData    = [];
    const invalidesData  = [];
    const historiqueData = [];
    let useFallback = false;
    let lastPendingCount = 0;
    let autoRefreshTimer = null;
    const activeTab = () => document.querySelector('.tab-btn.active')?.dataset.tab || 'analytics';

    /* ── Rafraîchir l'onglet actif ─────────────────────── */
    function refreshCurrentTab() {
        loadDataForTab(activeTab());
        updateNotificationBadge();
    }

    /* ── Bouton rafraîchir ─────────────────────────────── */
    document.getElementById('refresh-tickets-btn')?.addEventListener('click', refreshCurrentTab);

    /* ── Auto-rafraîchissement toutes les 30s ──────────── */
    function startAutoRefresh() {
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        autoRefreshTimer = setInterval(refreshCurrentTab, 30000);
    }
    startAutoRefresh();

    /* ── Notification popup ────────────────────────────── */
    const notifPopup = document.getElementById('notification-popup');
    let notifTimeout = null;

    function showNotification(count, email) {
        if (!notifPopup) return;
        const title = notifPopup.querySelector('#notif-title');
        const text = notifPopup.querySelector('#notif-text');
        const userText = email ? ` de ${email}` : '';
        if (title) title.textContent = 'Nouveaux tickets reçus !';
        if (text) text.textContent = `${count} nouveau(x) ticket(s)${userText} en attente`;
        notifPopup.classList.remove('hidden', 'translate-x-full', 'opacity-0');
        notifPopup.classList.add('flex', 'translate-x-0', 'opacity-100');
        if (notifTimeout) clearTimeout(notifTimeout);
        notifTimeout = setTimeout(hideNotification, 10000);
    }

    function hideNotification() {
        if (!notifPopup) return;
        notifPopup.classList.add('translate-x-full', 'opacity-0');
        notifPopup.classList.remove('translate-x-0', 'opacity-100');
        if (notifTimeout) { clearTimeout(notifTimeout); notifTimeout = null; }
    }

    document.getElementById('notif-close-btn')?.addEventListener('click', hideNotification);
    document.getElementById('notif-refresh-btn')?.addEventListener('click', () => {
        hideNotification();
        switchToTab('recus');
    });

    async function updateNotificationBadge() {
        if (useFallback) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/tickets`, { headers: getAuthHeaders() });
            if (!res.ok) return;
            const data = await res.json();
            const count = data.tickets?.length || 0;
            if (count > lastPendingCount && lastPendingCount > 0) {
                const newCount = count - lastPendingCount;
                showNotification(newCount);
            }
            lastPendingCount = count;
        } catch (_) {}
    }

    /* ── Chargement Initial ────────────────────────────── */
    loadDataForTab('analytics');
    setTimeout(animateChart, 200);

    async function loadDataForTab(tab) {
        if (tab === 'analytics') {
            if (useFallback) {
                document.getElementById('stat-valides').textContent = validesData.length;
                document.getElementById('stat-invalides').textContent = invalidesData.length;
                document.getElementById('stat-pending').textContent = localPending.length;
                document.getElementById('stat-total').textContent = validesData.length + invalidesData.length + localPending.length;
                return;
            }
            try {
                const headers = getAuthHeaders();
                const [resR, resV, resI] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/admin/tickets`, { headers }),
                    fetch(`${API_BASE_URL}/api/admin/tickets/valides`, { headers }),
                    fetch(`${API_BASE_URL}/api/admin/tickets/invalides`, { headers })
                ]);
                if (resR.status === 401 || resV.status === 401 || resI.status === 401) { logout(); return; }
                if (resR.ok && resV.ok && resI.ok) {
                    const dataR = await resR.json();
                    const dataV = await resV.json();
                    const dataI = await resI.json();
                    const countPending = dataR.tickets?.length || 0;
                    const countValides = dataV.tickets?.length || 0;
                    const countInvalides = dataI.tickets?.length || 0;
                    document.getElementById('stat-pending').textContent = countPending;
                    document.getElementById('stat-valides').textContent = countValides;
                    document.getElementById('stat-invalides').textContent = countInvalides;
                    document.getElementById('stat-total').textContent = countPending + countValides + countInvalides;
                }
            } catch (err) {
                console.warn('Erreur lors du chargement des statistiques', err);
            }
            return;
        }

        if (useFallback) {
            renderFallback(tab);
            return;
        }

        try {
            if (tab === 'recus') {
                const res = await fetch(`${API_BASE_URL}/api/admin/tickets`, { headers: getAuthHeaders() });
                if (res.status === 401) { logout(); return; }
                if (!res.ok) throw new Error();
                const data = await res.json();
                renderPendingTickets(data.tickets);
            } else if (tab === 'valides') {
                const res = await fetch(`${API_BASE_URL}/api/admin/tickets/valides`, { headers: getAuthHeaders() });
                if (res.status === 401) { logout(); return; }
                if (!res.ok) throw new Error();
                const data = await res.json();
                refreshList('valides-list', data.tickets, 'valid');
            } else if (tab === 'invalides') {
                const res = await fetch(`${API_BASE_URL}/api/admin/tickets/invalides`, { headers: getAuthHeaders() });
                if (res.status === 401) { logout(); return; }
                if (!res.ok) throw new Error();
                const data = await res.json();
                refreshList('invalides-list', data.tickets, 'invalid');
            } else if (tab === 'historique') {
                const res = await fetch(`${API_BASE_URL}/api/admin/historique`, { headers: getAuthHeaders() });
                if (res.status === 401) { logout(); return; }
                if (!res.ok) throw new Error();
                const data = await res.json();
                refreshHistorique(data.historique);
            }
        } catch (err) {
            console.warn('API Gateway indisponible pour l\'onglet', tab, '- Passage en mode démo local.');
            useFallback = true;
            renderFallback(tab);
        }
    }

    /* ── Rendu des tickets en attente (Dynamique) ──────── */
    function renderPendingTickets(tickets) {
        const grid = document.getElementById('users-grid');
        const counter = document.getElementById('pending-count');
        if (!grid) return;

        if (!tickets || tickets.length === 0) {
            grid.innerHTML = '<div class="col-span-full py-12 text-center text-[#444653]">Aucun ticket en attente de traitement.</div>';
            if (counter) counter.textContent = '0 ticket en attente';
            return;
        }

        // Grouper les tickets par email
        const groups = {};
        tickets.forEach(t => {
            if (!groups[t.email]) groups[t.email] = [];
            groups[t.email].push(t);
        });

        if (counter) {
            counter.textContent = `${tickets.length} ticket${tickets.length > 1 ? 's' : ''} en attente`;
        }

        grid.innerHTML = Object.keys(groups).map(email => {
            const userTickets = groups[email];
            return `
                <div class="bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-outline-variant overflow-hidden flex flex-col mb-8 user-block-card" data-email="${email}">
                    <div class="bg-surface-container-low px-6 py-4 border-b border-outline-variant flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined text-outline">mail</span>
                            <h3 class="font-label-md text-label-md text-on-surface font-semibold">${email}</h3>
                        </div>
                    </div>
                    <div class="p-6 flex-1 flex flex-col gap-4 user-card-body">
                        ${userTickets.map((t, idx) => `
                            <div class="code-row flex items-center justify-between gap-4 p-4 rounded-lg bg-surface border border-outline-variant/50 transition-all" data-id="${t.id}" data-code="${t.code}" data-status="pending">
                                <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                                    <span class="text-xs font-semibold text-primary tracking-wider uppercase" style="font-size:10px;">Code ${idx + 1}</span>
                                    <div class="code-value font-headline-md tracking-widest text-on-surface font-mono overflow-hidden text-ellipsis whitespace-nowrap max-w-[140px] sm:max-w-[200px]" title="${t.code}">${t.code}</div>
                                </div>
                                
                                <div class="flex gap-2 shrink-0">
                                    <button class="view-code-btn p-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary transition-colors" title="Voir tout le code">
                                        <span class="material-symbols-outlined" style="font-size:18px;">visibility</span>
                                    </button>
                                    <button class="copy-code-btn p-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary transition-colors" title="Copier le code">
                                        <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
                                    </button>
                                </div>
                                
                                <div class="flex gap-2 shrink-0 actions-container">
                                    <button class="btn-validate flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-on-primary font-label-md text-sm hover:opacity-90 transition-opacity shadow-sm">
                                        <span class="material-symbols-outlined" style="font-size:16px;">check_circle</span><span class="hidden xl:inline">Valider</span>
                                    </button>
                                    <button class="btn-invalidate flex items-center gap-1 px-3 py-2 rounded-lg bg-error text-on-error font-label-md text-sm hover:opacity-90 transition-opacity shadow-sm">
                                        <span class="material-symbols-outlined" style="font-size:16px;">cancel</span><span class="hidden xl:inline">Invalider</span>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end">
                        <button class="btn-send-mail flex items-center gap-2 px-6 py-2 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md hover:opacity-90 transition-opacity shadow-sm">
                            <span class="material-symbols-outlined" style="font-size:18px;">send</span>Envoyer le statut par mail
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.btn-validate').forEach(btn => {
            btn.addEventListener('click', () => handleTicketAction(btn, 'valider'));
        });
        grid.querySelectorAll('.btn-invalidate').forEach(btn => {
            btn.addEventListener('click', () => handleTicketAction(btn, 'invalider'));
        });
        grid.querySelectorAll('.view-code-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const code = e.currentTarget.closest('.code-row').dataset.code;
                document.getElementById('full-code-display').textContent = code;
                document.getElementById('view-code-modal').classList.remove('hidden');
                document.getElementById('view-code-modal').classList.add('flex');
            });
        });
        grid.querySelectorAll('.copy-code-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const code = e.currentTarget.closest('.code-row').dataset.code;
                navigator.clipboard.writeText(code).then(() => {
                    const original = e.currentTarget.innerHTML;
                    e.currentTarget.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">check</span>';
                    setTimeout(() => e.currentTarget.innerHTML = original, 1500);
                });
            });
        });

        // Email modal logic
        grid.querySelectorAll('.btn-send-mail').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.currentTarget.closest('.user-block-card');
                const email = card.dataset.email;
                const rows = card.querySelectorAll('.code-row');
                
                document.getElementById('mail-target-email').textContent = email;
                const mailList = document.getElementById('mail-tickets-list');
                mailList.innerHTML = '';
                
                rows.forEach(row => {
                    const code = row.dataset.code;
                    const status = row.dataset.status;
                    let statusBadge = '<span class="px-2 py-1 bg-surface-container text-on-surface-variant rounded text-xs">En attente</span>';
                    if (status === 'valid') statusBadge = '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Valide</span>';
                    if (status === 'invalid') statusBadge = '<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Invalide</span>';
                    
                    mailList.innerHTML += `
                        <div class="flex justify-between items-center bg-surface p-3 rounded-lg border border-outline-variant/50">
                            <span class="font-mono text-sm max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title="${code}">${code}</span>
                            ${statusBadge}
                        </div>
                    `;
                });
                
                document.getElementById('send-mail-modal').classList.remove('hidden');
                document.getElementById('send-mail-modal').classList.add('flex');
                
                // Store email context
                document.getElementById('confirm-send-mail-btn').dataset.targetEmail = email;
            });
        });
    }

    /* ── Action Valider / Invalider (API / Fallback) ───── */
    async function handleTicketAction(btn, action) {
        const row = btn.closest('.code-row');
        const id = row.dataset.id;
        const code = row.dataset.code;
        const email = row.closest('[data-email]')?.dataset.email || 'Inconnu';
        const actionsContainer = row.querySelector('.actions-container');

        // Animation de chargement
        const originalHTML = actionsContainer.innerHTML;
        actionsContainer.innerHTML = '<span class="material-symbols-outlined animate-spin text-primary">sync</span>';

        if (useFallback) {
            setTimeout(() => {
                localPending = localPending.filter(t => t.id !== id);
                const now = new Date().toLocaleString('fr-FR');
                const entry = { code, email, date: now };
                if (action === 'valider') {
                    validesData.push(entry);
                    row.dataset.status = 'valid';
                    row.classList.add('border-green-500', 'bg-green-50');
                    actionsContainer.innerHTML = '<span class="text-green-600 font-bold text-sm flex items-center gap-1"><span class="material-symbols-outlined" style="font-size:16px;">check_circle</span> Validé</span>';
                } else {
                    invalidesData.push(entry);
                    row.dataset.status = 'invalid';
                    row.classList.add('border-red-500', 'bg-red-50');
                    actionsContainer.innerHTML = '<span class="text-red-600 font-bold text-sm flex items-center gap-1"><span class="material-symbols-outlined" style="font-size:16px;">cancel</span> Invalidé</span>';
                }
                historiqueData.push({ ...entry, action: action === 'valider' ? 'valide' : 'invalide' });
            }, 300);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/tickets/${id}/${action}`, {
                method: 'PATCH',
                headers: getAuthHeaders()
            });
            if (res.status === 401) { logout(); return; }
            if (!res.ok) throw new Error();

            // Mettre à jour visuellement la ligne
            if (action === 'valider') {
                row.dataset.status = 'valid';
                row.classList.add('border-green-500', 'bg-green-50');
                actionsContainer.innerHTML = '<span class="text-green-600 font-bold text-sm flex items-center gap-1"><span class="material-symbols-outlined" style="font-size:16px;">check_circle</span> Validé</span>';
            } else {
                row.dataset.status = 'invalid';
                row.classList.add('border-red-500', 'bg-red-50');
                actionsContainer.innerHTML = '<span class="text-red-600 font-bold text-sm flex items-center gap-1"><span class="material-symbols-outlined" style="font-size:16px;">cancel</span> Invalidé</span>';
            }
        } catch (err) {
            console.error(err);
            actionsContainer.innerHTML = originalHTML;
            alert("Erreur lors de l'opération.");
        }
    }

    /* ── Listes Valides / Invalides ────────────────────── */
    function refreshList(listId, data, type) {
        const el = document.getElementById(listId);
        if (!el) return;

        if (!data || data.length === 0) {
            el.innerHTML = '<div class="empty-state p-12 text-center text-on-surface-variant">Aucun ticket pour le moment.</div>';
            return;
        }

        const badge = type === 'valid'
            ? '<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1"><span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Valide</span>'
            : '<span class="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1"><span class="material-symbols-outlined" style="font-size:14px;">cancel</span> Invalide</span>';

        el.innerHTML = data.map((d, idx) => `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors gap-4">
                <div class="flex flex-col gap-0.5 overflow-hidden">
                    <span class="font-semibold text-primary uppercase tracking-wider" style="font-size:10px;">Code ${idx + 1}</span>
                    <span class="font-mono text-lg font-bold tracking-wider text-on-surface text-ellipsis overflow-hidden whitespace-nowrap max-w-[250px] md:max-w-[400px]" title="${d.code}">${d.code}</span>
                    <div class="flex items-center gap-2 text-on-surface-variant text-sm mt-0.5">
                        <span class="material-symbols-outlined" style="font-size:16px;">mail</span>
                        <span class="text-ellipsis overflow-hidden whitespace-nowrap">${d.email}</span>
                    </div>
                </div>
                <div class="flex items-center gap-4 shrink-0">
                    <span class="text-xs text-on-surface-variant bg-surface-container px-3 py-1 rounded-lg border border-outline-variant/50">${new Date(d.updatedAt || d.date).toLocaleString('fr-FR')}</span>
                    ${badge}
                </div>
            </div>
        `).join('');
    }

    /* ── Historique ────────────────────────────────────── */
    function refreshHistorique(data) {
        const el = document.getElementById('historique-list');
        if (!el) return;

        if (!data || data.length === 0) {
            el.innerHTML = '<div class="empty-state p-12 text-center text-on-surface-variant">Aucune action enregistrée.</div>';
            return;
        }

        el.innerHTML = data.map((d, idx) => {
            const badge = d.action === 'valide'
                ? '<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1"><span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Validé</span>'
                : '<span class="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1"><span class="material-symbols-outlined" style="font-size:14px;">cancel</span> Invalidé</span>';
            return `
                <div class="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors gap-4">
                    <div class="flex flex-col gap-0.5 overflow-hidden">
                        <span class="font-semibold text-primary uppercase tracking-wider" style="font-size:10px;">Code ${idx + 1}</span>
                        <span class="font-mono text-lg font-bold tracking-wider text-on-surface text-ellipsis overflow-hidden whitespace-nowrap max-w-[250px] md:max-w-[400px]" title="${d.code}">${d.code}</span>
                        <div class="flex items-center gap-2 text-on-surface-variant text-sm mt-0.5">
                            <span class="material-symbols-outlined" style="font-size:16px;">mail</span>
                            <span class="text-ellipsis overflow-hidden whitespace-nowrap">${d.email}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-4 shrink-0">
                        <span class="text-xs text-on-surface-variant bg-surface-container px-3 py-1 rounded-lg border border-outline-variant/50">${new Date(d.date).toLocaleString('fr-FR')}</span>
                        ${badge}
                    </div>
                </div>
            `;
        }).join('');
    }

    /* ── Rendu Fallback Local ──────────────────────────── */
    function renderFallback(tab) {
        if (tab === 'recus') {
            renderPendingTickets(localPending);
        } else if (tab === 'valides') {
            refreshList('valides-list', validesData, 'valid');
        } else if (tab === 'invalides') {
            refreshList('invalides-list', invalidesData, 'invalid');
        } else if (tab === 'historique') {
            refreshHistorique(historiqueData);
        }
    }

    /* ── Modal Logic ───────────────────────────────────── */
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.currentTarget.closest('.fixed.inset-0');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        });
    });

    const confirmSendBtn = document.getElementById('confirm-send-mail-btn');
    if (confirmSendBtn) {
        confirmSendBtn.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const email = btn.dataset.targetEmail;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:18px;">sync</span> Envoi...';
            btn.disabled = true;

            const card = document.querySelector(`.user-block-card[data-email="${email}"]`);
            const rows = card ? card.querySelectorAll('.code-row') : [];
            const tickets = Array.from(rows).map(row => ({
                code: row.dataset.code,
                status: row.dataset.status
            }));

            if (useFallback) {
                setTimeout(() => {
                    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">check</span> Envoyé !';
                    btn.classList.add('bg-green-600', 'text-white');
                    btn.classList.remove('bg-primary', 'text-on-primary');
                    
                    setTimeout(() => {
                        document.getElementById('send-mail-modal').classList.add('hidden');
                        document.getElementById('send-mail-modal').classList.remove('flex');
                        btn.innerHTML = originalHTML;
                        btn.disabled = false;
                        btn.classList.remove('bg-green-600', 'text-white');
                        btn.classList.add('bg-primary', 'text-on-primary');
                        if (card) card.remove();
                    }, 1000);
                }, 1000);
            } else {
                fetch(`${API_BASE_URL}/api/admin/send-status-email`, {
                    method: 'POST',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, tickets })
                })
                .then(res => {
                    if (res.status === 401) { logout(); return; }
                    if (!res.ok) throw new Error("Erreur serveur lors de l'envoi");
                    return res.json();
                })
                .then(() => {
                    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">check</span> Envoyé !';
                    btn.classList.add('bg-green-600', 'text-white');
                    btn.classList.remove('bg-primary', 'text-on-primary');
                    
                    setTimeout(() => {
                        document.getElementById('send-mail-modal').classList.add('hidden');
                        document.getElementById('send-mail-modal').classList.remove('flex');
                        btn.innerHTML = originalHTML;
                        btn.disabled = false;
                        btn.classList.remove('bg-green-600', 'text-white');
                        btn.classList.add('bg-primary', 'text-on-primary');
                        loadDataForTab('recus');
                    }, 1000);
                })
                .catch(err => {
                    console.error(err);
                    alert("Impossible d'envoyer l'email via l'API.");
                    btn.innerHTML = originalHTML;
                    btn.disabled = false;
                });
            }
        });
    }

    /* ── Mobile Sidebar Logic ──────────────────────────── */
    const mobileMenuBtn  = document.getElementById('mobile-menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebar         = document.getElementById('admin-sidebar');
    const backdrop        = document.getElementById('sidebar-backdrop');

    function openSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('hidden');
        sidebar.classList.add('flex');
        if (backdrop) backdrop.classList.add('active');
        document.body.style.overflow = 'hidden'; // empêche scroll du fond
    }

    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.add('hidden');
        sidebar.classList.remove('flex');
        if (backdrop) backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (mobileMenuBtn)  mobileMenuBtn.addEventListener('click', openSidebar);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
    if (backdrop)        backdrop.addEventListener('click', closeSidebar);
});
