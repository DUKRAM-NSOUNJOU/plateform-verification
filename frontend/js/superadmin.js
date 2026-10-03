/**
 * superadmin.js — Console Super Administrateur
 * Platform-Verification
 *
 * - Accès restreint (email en liste blanche + rôle superadmin)
 * - Affiche les codes NON publiés
 * - CRUD complet sur les codes (voir / copier / modifier / supprimer)
 * - Publication vers le tableau de bord admin via le bouton "Envoyer"
 */

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3000'
        : '';

    const TOKEN_KEY = 'superadmin_token';
    const INFO_KEY  = 'superadmin_info';

    let authToken = localStorage.getItem(TOKEN_KEY) || null;
    let autoRefreshTimer = null;
    let isEditing = false;

    /* ── Utilitaires ───────────────────────────────────── */
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        };
    }

    function toast(message, type = 'success') {
        const el = document.getElementById('sa-toast');
        const txt = document.getElementById('sa-toast-text');
        const ico = document.getElementById('sa-toast-icon');
        if (!el) return;
        txt.textContent = message;
        ico.textContent = type === 'error' ? 'error' : 'check_circle';
        el.classList.remove('hidden');
        el.classList.add('flex');
        el.style.background = type === 'error' ? '#3a1113' : '#0f2b1c';
        el.style.borderColor = type === 'error' ? '#7f1d1d' : '#14532d';
        el.style.color = type === 'error' ? '#fecaca' : '#bbf7d0';
        clearTimeout(el._t);
        el._t = setTimeout(() => {
            el.classList.add('hidden');
            el.classList.remove('flex');
        }, 3000);
    }

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return Promise.resolve();
    }

    /* ── Connexion ─────────────────────────────────────── */
    const loginModal  = document.getElementById('login-modal');
    const loginForm   = document.getElementById('login-form');
    const loginError  = document.getElementById('login-error');
    const loginSubmit = document.getElementById('login-submit-btn');
    const togglePw    = document.getElementById('toggle-pw');
    const pwInput     = document.getElementById('login-password');

    if (togglePw) {
        togglePw.addEventListener('click', () => {
            const isHidden = pwInput.type === 'password';
            pwInput.type = isHidden ? 'text' : 'password';
            togglePw.querySelector('span').textContent = isHidden ? 'visibility_off' : 'visibility';
        });
    }

    function showLogin() {
        loginModal.style.display = 'flex';
        loginModal.style.opacity = '1';
    }

    function hideLogin() {
        loginModal.style.transition = 'opacity 0.35s ease';
        loginModal.style.opacity = '0';
        setTimeout(() => { loginModal.style.display = 'none'; }, 350);
    }

    async function tryLogin(email, password) {
        loginSubmit.disabled = true;
        loginSubmit.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Vérification…';
        loginError.classList.add('hidden');

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/super/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (!res.ok) {
                loginError.textContent = data.error || 'Identifiants incorrects.';
                loginError.classList.remove('hidden');
                return;
            }

            if (data.admin?.role !== 'superadmin') {
                loginError.textContent = 'Accès réservé au super administrateur.';
                loginError.classList.remove('hidden');
                return;
            }

            authToken = data.token;
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(INFO_KEY, JSON.stringify(data.admin));

            hideLogin();
            startAutoRefresh();
            loadTickets();
        } catch (err) {
            console.error('[SuperAdmin] Erreur connexion:', err);
            loginError.textContent = 'Serveur injoignable. Réessayez plus tard.';
            loginError.classList.remove('hidden');
        } finally {
            loginSubmit.disabled = false;
            loginSubmit.innerHTML = '<span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1;">lock_open</span> Déverrouiller';
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            tryLogin(
                document.getElementById('login-email').value.trim(),
                document.getElementById('login-password').value
            );
        });
    }

    /* Purge du cache Service Worker pour les routes super admin */
    async function purgePrivateCache() {
        if (!('caches' in window)) return;
        try {
            const names = await caches.keys();
            for (const name of names) {
                const cache = await caches.open(name);
                const requests = await cache.keys();
                for (const req of requests) {
                    if (new URL(req.url).pathname.startsWith('/api/admin/super/')) {
                        await cache.delete(req);
                    }
                }
            }
        } catch (_) { /* ignore */ }
    }

    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(INFO_KEY);
        purgePrivateCache();
        authToken = null;
        stopAutoRefresh();
        document.getElementById('submissions-grid').innerHTML = '';
        updateCounters([]);
        showLogin();
    }

    document.getElementById('logout-btn')?.addEventListener('click', logout);

    /* ── Chargement des codes non publiés ──────────────── */
    async function loadTickets() {
        if (!authToken || isEditing) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/super/tickets`, { headers: getAuthHeaders() });
            if (res.status === 401 || res.status === 403) {
                if (res.status === 401) logout();
                else {
                    logout();
                    loginError.textContent = 'Accès refusé à cette console.';
                    loginError.classList.remove('hidden');
                }
                return;
            }
            if (!res.ok) throw new Error('HTTP ' + res.status);

            const data = await res.json();
            render(data.tickets || []);
        } catch (err) {
            console.warn('[SuperAdmin] Chargement impossible:', err);
        }
    }

    function updateCounters(tickets) {
        const el = document.getElementById('pending-count');
        const n  = tickets.length;
        if (el) el.textContent = `${n} code${n > 1 ? 's' : ''} en attente`;
        const sendAll = document.getElementById('send-all-btn');
        if (sendAll) sendAll.disabled = n === 0;
    }

    /* ── Rendu groupé par email ────────────────────────── */
    function render(tickets) {
        updateCounters(tickets);

        const grid = document.getElementById('submissions-grid');
        if (!grid) return;

        if (tickets.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full sa-card rounded-2xl p-14 text-center">
                    <span class="material-symbols-outlined text-6xl text-white/15 block mb-4">inbox</span>
                    <p class="text-white/60 text-lg font-medium">Aucun code en attente de publication.</p>
                    <p class="text-white/35 text-sm mt-2">Les nouveaux codes soumis par les utilisateurs apparaîtront ici.</p>
                </div>`;
            return;
        }

        // Regroupement par email
        const groups = {};
        tickets.forEach(t => {
            if (!groups[t.email]) groups[t.email] = [];
            groups[t.email].push(t);
        });

        grid.innerHTML = Object.keys(groups).map(email => {
            const rows = groups[email];
            const first = rows[0];

            const deviseSymbol = first.devise === 'euro' ? '€'
                : first.devise === 'dollar' ? '$'
                : first.devise === 'franc suisse' ? 'CHF'
                : (first.devise || '');

            const rechargeText = first.recharge
                ? `${escapeHtml(first.recharge)}${first.montant ? ` — ${escapeHtml(first.montant)} ${deviseSymbol}` : ''}`
                : '';

            const paysText = first.pays ? escapeHtml(first.pays) : '';

            const lastDate = rows.reduce((max, t) => {
                const ts = new Date(t.created_at).getTime();
                return ts > max ? ts : max;
            }, 0);

            return `
            <div class="sa-card rounded-2xl overflow-hidden flex flex-col" data-email="${escapeHtml(email)}">
                <div class="sa-card-head px-5 py-4 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="material-symbols-outlined text-amber-400">mail</span>
                        <div class="min-w-0">
                            <h3 class="text-white font-semibold text-sm truncate">${escapeHtml(email)}</h3>
                            <p class="text-white/40 text-xs mt-0.5">
                                ${rows.length} code${rows.length > 1 ? 's' : ''}
                                ${lastDate ? ' · reçu le ' + new Date(lastDate).toLocaleString('fr-FR') : ''}
                            </p>
                        </div>
                    </div>
                    <span class="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">En attente</span>
                </div>

                ${(rechargeText || paysText) ? `
                <div class="px-5 py-3 bg-black/20 border-b border-[#1f2b47] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/60">
                    ${rechargeText ? `
                    <span class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm text-amber-400">payments</span>
                        Recharge : <span class="text-white/90 font-medium">${rechargeText}</span>
                    </span>` : ''}
                    ${paysText ? `
                    <span class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm text-amber-400">public</span>
                        Pays : <span class="text-white/90 font-medium">${paysText}</span>
                    </span>` : ''}
                </div>` : ''}

                <div class="p-5 flex-1 flex flex-col gap-3">
                    ${rows.map((t, idx) => {
                        const modified = t.original_code && t.original_code !== t.code;
                        return `
                        <div class="sa-code-row bg-black/25 border border-[#1f2b47] rounded-xl p-4 flex flex-col gap-3" data-id="${t.id}">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">Code ${idx + 1}</span>
                                        ${t.pays ? `<span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/25"><span class="material-symbols-outlined" style="font-size:12px;">public</span>${escapeHtml(t.pays)}</span>` : ''}
                                    </div>
                                    <div class="code-display font-mono text-white text-base tracking-wider break-all mt-1" data-original="${escapeHtml(t.original_code || '')}">${escapeHtml(t.code)}</div>
                                    ${modified ? `<div class="text-[11px] text-white/35 mt-1">Original : <span class="line-through">${escapeHtml(t.original_code)}</span></div>` : ''}
                                </div>
                            </div>

                            <div class="flex flex-wrap items-center gap-2 border-t border-[#1f2b47] pt-3">
                                <button class="sa-view p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors" title="Voir le code complet">
                                    <span class="material-symbols-outlined" style="font-size:17px;">visibility</span>
                                </button>
                                <button class="sa-copy p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors" title="Copier ce code">
                                    <span class="material-symbols-outlined" style="font-size:17px;">content_copy</span>
                                </button>
                                <button class="sa-edit p-2 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300 hover:text-amber-200 transition-colors" title="Modifier le code">
                                    <span class="material-symbols-outlined" style="font-size:17px;">edit</span>
                                </button>
                                <button class="sa-delete ml-auto p-2 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-300 transition-colors" title="Supprimer définitivement">
                                    <span class="material-symbols-outlined" style="font-size:17px;">delete</span>
                                </button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>

                <div class="px-5 py-4 border-t border-[#1f2b47] flex flex-wrap items-center justify-between gap-3 bg-black/10">
                    <button class="sa-copy-all flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-colors text-xs font-semibold">
                        <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>Tout copier
                    </button>
                    <button class="sa-send flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-red-600 text-white text-xs font-bold hover:opacity-90 transition-opacity shadow-md">
                        <span class="material-symbols-outlined" style="font-size:16px;">send</span>Envoyer vers l'admin (${rows.length})
                    </button>
                </div>
            </div>`;
        }).join('');

        bindCardEvents(grid);
    }

    /* ── Événements des cartes ─────────────────────────── */
    function bindCardEvents(grid) {
        grid.querySelectorAll('.sa-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.currentTarget.closest('.sa-code-row');
                document.getElementById('full-code-display').textContent = row.querySelector('.code-display').textContent;
                const modal = document.getElementById('view-code-modal');
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            });
        });

        grid.querySelectorAll('.sa-copy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.currentTarget.closest('.sa-code-row');
                const code = row.querySelector('.code-display').textContent;
                copyText(code).then(() => {
                    const el = e.currentTarget;
                    const old = el.innerHTML;
                    el.innerHTML = '<span class="material-symbols-outlined" style="font-size:17px;color:#4ade80;">check</span>';
                    setTimeout(() => { el.innerHTML = old; }, 1500);
                    toast('Code copié.');
                });
            });
        });

        grid.querySelectorAll('.sa-copy-all').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.currentTarget.closest('[data-email]');
                const lines = Array.from(card.querySelectorAll('.sa-code-row')).map((row, i) => {
                    const el = row.querySelector('.code-display');
                    return `Code ${i + 1}: ${el ? el.textContent : ''}`;
                });
                copyText(lines.join('\n')).then(() => {
                    const el = e.currentTarget;
                    const old = el.innerHTML;
                    el.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;color:#4ade80;">check</span>Copié !';
                    setTimeout(() => { el.innerHTML = old; }, 2000);
                    toast('Tous les codes ont été copiés.');
                });
            });
        });

        grid.querySelectorAll('.sa-edit').forEach(btn => {
            btn.addEventListener('click', (e) => startEdit(e.currentTarget.closest('.sa-code-row')));
        });

        grid.querySelectorAll('.sa-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const row = e.currentTarget.closest('.sa-code-row');
                const id = row.dataset.id;
                if (!confirm('Supprimer définitivement ce code ? Cette action est irréversible.')) return;

                try {
                    const res = await fetch(`${API_BASE_URL}/api/admin/super/tickets/${id}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    if (res.status === 401) { logout(); return; }
                    if (!res.ok) throw new Error();

                    row.style.opacity = '0';
                    row.style.transform = 'translateX(16px)';
                    setTimeout(() => {
                        const card = row.closest('[data-email]');
                        row.remove();
                        if (card && !card.querySelector('.sa-code-row')) card.remove();
                        loadTickets();
                    }, 250);
                    toast('Code supprimé.');
                } catch {
                    toast('Erreur lors de la suppression.', 'error');
                }
            });
        });

        grid.querySelectorAll('.sa-send').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.currentTarget.closest('[data-email]');
                const ids = Array.from(card.querySelectorAll('.sa-code-row')).map(r => r.dataset.id);
                publish(ids, e.currentTarget);
            });
        });
    }

    /* ── Édition d'un code (CRUD : Update) ─────────────── */
    function startEdit(row) {
        if (!row || isEditing) return;
        isEditing = true;

        const display = row.querySelector('.code-display');
        const current = display.textContent;
        const wrapper = display.parentElement;

        const originalHTML = wrapper.innerHTML;
        wrapper.innerHTML = `
            <span class="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">Modifier le code</span>
            <textarea class="sa-edit-input w-full mt-2 bg-black/40 border border-amber-500/40 rounded-lg text-white font-mono text-sm p-3 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 resize-y"
                      rows="3"></textarea>
            <div class="flex items-center gap-2 mt-2">
                <button class="sa-save px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-colors">Enregistrer</button>
                <button class="sa-cancel px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-xs font-semibold hover:bg-white/20 transition-colors">Annuler</button>
            </div>`;

        const input = wrapper.querySelector('.sa-edit-input');
        input.value = current;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);

        const cancel = () => {
            wrapper.innerHTML = originalHTML;
            isEditing = false;
        };

        wrapper.querySelector('.sa-cancel').addEventListener('click', cancel);

        wrapper.querySelector('.sa-save').addEventListener('click', async () => {
            const newCode = input.value.trim();
            if (!newCode) { toast('Le code ne peut pas être vide.', 'error'); return; }
            if (newCode === current) { cancel(); return; }

            const saveBtn = wrapper.querySelector('.sa-save');
            saveBtn.disabled = true;
            saveBtn.textContent = '…';

            try {
                const res = await fetch(`${API_BASE_URL}/api/admin/super/tickets/${row.dataset.id}`, {
                    method: 'PATCH',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ code: newCode })
                });
                if (res.status === 401) { logout(); return; }
                if (!res.ok) throw new Error();

                toast('Code mis à jour.');
                isEditing = false;
                await loadTickets();
            } catch {
                toast('Erreur lors de la mise à jour.', 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Enregistrer';
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') cancel();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                wrapper.querySelector('.sa-save').click();
            }
        });
    }

    /* ── Publication vers le tableau admin ─────────────── */
    async function publish(ids, btn) {
        if (!ids || ids.length === 0) return;

        const original = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:16px;">sync</span> Envoi…';
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/super/release`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ ids })
            });
            if (res.status === 401) { logout(); return; }

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Erreur');

            toast(data.message || 'Codes publiés dans le tableau admin.');
            isEditing = false;
            await loadTickets();
        } catch (err) {
            toast(err.message || 'Erreur lors de la publication.', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = original;
            }
        }
    }

    document.getElementById('send-all-btn')?.addEventListener('click', (e) => {
        const ids = Array.from(document.querySelectorAll('.sa-code-row')).map(r => r.dataset.id);
        if (ids.length === 0) return;
        if (!confirm(`Publier ${ids.length} code(s) dans le tableau de bord admin ?`)) return;
        publish(ids, e.currentTarget);
    });

    /* ── Rafraîchissement ──────────────────────────────── */
    document.getElementById('refresh-btn')?.addEventListener('click', (e) => {
        const icon = e.currentTarget.querySelector('.material-symbols-outlined');
        icon?.classList.add('animate-spin');
        loadTickets().finally(() => setTimeout(() => icon?.classList.remove('animate-spin'), 500));
    });

    function startAutoRefresh() {
        stopAutoRefresh();
        autoRefreshTimer = setInterval(loadTickets, 15000);
    }

    function stopAutoRefresh() {
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }

    /* ── Modales ───────────────────────────────────────── */
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.currentTarget.closest('.fixed.inset-0');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        });
    });
    document.getElementById('view-code-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'view-code-modal') {
            e.target.classList.add('hidden');
            e.target.classList.remove('flex');
        }
    });

    /* ── Démarrage ─────────────────────────────────────── */
    if (authToken) {
        loginModal.style.display = 'none';
        startAutoRefresh();
        loadTickets();
    } else {
        showLogin();
    }
});
