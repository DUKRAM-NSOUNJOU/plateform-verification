/**
 * admin.js — Tableau de bord administration
 * Platform-Verification (Vraie connexion Microservices)
 */

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = `http://${window.location.hostname}:3000`; // Gateway

    /* ── Onglets (tabs) ────────────────────────────────── */
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

    /* ── Chargement Initial ────────────────────────────── */
    loadDataForTab('analytics');
    setTimeout(animateChart, 200);

    async function loadDataForTab(tab) {
        if (tab === 'analytics') return;
        if (useFallback) {
            renderFallback(tab);
            return;
        }

        try {
            if (tab === 'recus') {
                const res = await fetch(`${API_BASE_URL}/api/admin/tickets`);
                if (!res.ok) throw new Error();
                const data = await res.json();
                renderPendingTickets(data.tickets);
            } else if (tab === 'valides') {
                const res = await fetch(`${API_BASE_URL}/api/admin/tickets/valides`);
                if (!res.ok) throw new Error();
                const data = await res.json();
                refreshList('valides-list', data.tickets, 'valid');
            } else if (tab === 'invalides') {
                const res = await fetch(`${API_BASE_URL}/api/admin/tickets/invalides`);
                if (!res.ok) throw new Error();
                const data = await res.json();
                refreshList('invalides-list', data.tickets, 'invalid');
            } else if (tab === 'historique') {
                const res = await fetch(`${API_BASE_URL}/api/admin/historique`);
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
                <div class="bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-outline-variant overflow-hidden flex flex-col" data-email="${email}">
                    <div class="bg-surface-container-low px-6 py-4 border-b border-outline-variant flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined text-outline">mail</span>
                            <h3 class="font-label-md text-label-md text-on-surface font-semibold">${email}</h3>
                        </div>
                    </div>
                    <div class="p-6 flex-1 flex flex-col gap-4 user-card-body">
                        ${userTickets.map(t => `
                            <div class="code-row flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-surface border border-outline-variant/50" data-id="${t.id}">
                                <div class="code-value font-headline-md tracking-widest text-on-surface font-mono">${t.code}</div>
                                <div class="flex gap-2">
                                    <button class="btn-validate flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-90 transition-opacity shadow-sm">
                                        <span class="material-symbols-outlined" style="font-size:18px;">check_circle</span>Valider
                                    </button>
                                    <button class="btn-invalidate flex items-center gap-2 px-4 py-2 rounded-lg bg-error text-on-error font-label-md text-label-md hover:opacity-90 transition-opacity shadow-sm">
                                        <span class="material-symbols-outlined" style="font-size:18px;">cancel</span>Invalider
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        // Attacher les écouteurs d'événements
        grid.querySelectorAll('.btn-validate').forEach(btn => {
            btn.addEventListener('click', () => handleTicketAction(btn, 'valider'));
        });
        grid.querySelectorAll('.btn-invalidate').forEach(btn => {
            btn.addEventListener('click', () => handleTicketAction(btn, 'invalider'));
        });
    }

    /* ── Action Valider / Invalider (API / Fallback) ───── */
    async function handleTicketAction(btn, action) {
        const row = btn.closest('.code-row');
        const id = row.dataset.id;
        const code = row.querySelector('.code-value').textContent.trim();
        const email = row.closest('[data-email]')?.dataset.email || 'Inconnu';

        // Animation de sortie
        row.style.opacity = '0';
        row.style.transform = 'translateX(16px)';
        row.style.transition = 'all 0.3s ease';

        if (useFallback) {
            setTimeout(() => {
                row.remove();
                localPending = localPending.filter(t => t.id !== id);
                const now = new Date().toLocaleString('fr-FR');
                const entry = { code, email, date: now };
                if (action === 'valider') {
                    validesData.push(entry);
                } else {
                    invalidesData.push(entry);
                }
                historiqueData.push({ ...entry, action: action === 'valider' ? 'valide' : 'invalide' });
                loadDataForTab('recus');
            }, 300);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/tickets/${id}/${action}`, {
                method: 'PATCH'
            });
            if (!res.ok) throw new Error();

            setTimeout(() => {
                row.remove();
                loadDataForTab('recus');
            }, 300);
        } catch (err) {
            console.error('Erreur lors du traitement du ticket:', err);
            row.style.opacity = '1';
            row.style.transform = 'none';
            alert('Impossible de traiter cette action. Le microservice admin-service est injoignable.');
        }
    }

    /* ── Listes Valides / Invalides ────────────────────── */
    function refreshList(listId, data, type) {
        const el = document.getElementById(listId);
        if (!el) return;

        if (!data || data.length === 0) {
            el.innerHTML = '<div class="empty-state">Aucun ticket pour le moment.</div>';
            return;
        }

        const badge = type === 'valid'
            ? '<span class="badge-valid">Valide</span>'
            : '<span class="badge-invalid">Invalide</span>';

        el.innerHTML = data.map(d => `
            <div class="flex items-center justify-between px-6 py-4 border-b border-[#c5c5d5] last:border-0">
                <div>
                    <span class="font-mono font-semibold text-[#111c2c]">${d.code}</span>
                    <p class="text-xs text-[#444653] mt-0.5">${d.email}</p>
                </div>
                <div class="flex items-center gap-3">
                    ${badge}
                    <span class="text-xs text-[#757684]">${new Date(d.updatedAt || d.date).toLocaleString('fr-FR')}</span>
                </div>
            </div>
        `).join('');
    }

    /* ── Historique ────────────────────────────────────── */
    function refreshHistorique(data) {
        const el = document.getElementById('historique-list');
        if (!el) return;

        if (!data || data.length === 0) {
            el.innerHTML = '<div class="empty-state">Aucune action enregistrée.</div>';
            return;
        }

        el.innerHTML = data.map(d => {
            const badge = d.action === 'valide'
                ? '<span class="badge-valid">Validé</span>'
                : '<span class="badge-invalid">Invalidé</span>';
            return `
                <div class="flex items-center justify-between px-6 py-4 border-b border-[#c5c5d5] last:border-0">
                    <div>
                        <span class="font-mono font-semibold text-[#111c2c]">${d.code}</span>
                        <p class="text-xs text-[#444653] mt-0.5">${d.email}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        ${badge}
                        <span class="text-xs text-[#757684]">${new Date(d.date).toLocaleString('fr-FR')}</span>
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
});
