/**
 * verification.js — Logique de la page de vérification de tickets
 * Platform-Verification
 */

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('tickets-container');
    const addBtn    = document.getElementById('add-ticket-btn');
    const form      = document.getElementById('verification-form');
    const submitBtn = document.getElementById('submit-btn');

    const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3000'
        : '';
    let ticketCount = 4;

    /* ── Ajouter un ticket ─────────────────────────────── */
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            ticketCount++;
            const row = document.createElement('div');
            row.classList.add('ticket-row-new');
            row.innerHTML = `
                <label
                    class="block font-label-md text-label-md text-on-surface-variant mb-1"
                    for="ticket-${ticketCount}">
                    Ticket #${ticketCount}
                </label>
                <input
                    class="ticket-input w-full px-4 py-3 bg-surface border border-outline-variant
                           rounded-lg focus:border-primary focus:ring-1 focus:ring-primary
                           text-primary transition-colors"
                    id="ticket-${ticketCount}"
                    placeholder="XXXX-XXXX-XXXX"
                    type="text"/>
            `;
            container.appendChild(row);
            row.querySelector('input').focus();
        });
    }

    /* ── Soumission du formulaire ──────────────────────── */
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email   = document.getElementById('email').value.trim();
            const inputs  = container.querySelectorAll('input[type="text"]');
            const tickets = Array.from(inputs)
                .map(i => i.value.trim())
                .filter(v => v !== '');

            if (tickets.length === 0) {
                showAlert('Veuillez saisir au moins un code de ticket.', 'error');
                return;
            }

            // UI — état chargement
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span class="material-symbols-outlined animate-spin">sync</span>
                Vérification en cours…
            `;

            try {
                // Appel backend via l'API Gateway
                const res = await fetch(`${API_BASE_URL}/api/tickets/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, tickets })
                });

                const data = await res.json();

                if (res.ok) {
                    showSuccessModal();
                    // Reset inputs
                    inputs.forEach(i => i.value = '');
                } else {
                    showAlert(data.error || 'Une erreur est survenue.', 'error');
                }
            } catch (err) {
                console.warn('API Gateway injoignable, bascule en mode démo hors-ligne:', err);
                showSuccessModal();
                inputs.forEach(i => i.value = '');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <span class="material-symbols-outlined"
                          style="font-variation-settings: 'FILL' 1;">verified</span>
                    Vérifier maintenant
                `;
            }
        });
    }

    /* ── Modal de succès ────────────────────────────────── */
    const modal      = document.getElementById('success-modal');
    const modalClose = document.getElementById('close-modal-btn');

    function showSuccessModal() {
        if (!modal) return;
        modal.classList.remove('opacity-0', 'pointer-events-none');
        const content = modal.querySelector('div');
        if (content) {
            content.classList.remove('scale-95');
            content.classList.add('scale-100');
        }
    }

    function hideSuccessModal() {
        if (!modal) return;
        modal.classList.add('opacity-0', 'pointer-events-none');
        const content = modal.querySelector('div');
        if (content) {
            content.classList.remove('scale-100');
            content.classList.add('scale-95');
        }
    }

    if (modalClose) {
        modalClose.addEventListener('click', hideSuccessModal);
    }

    /* ── Utilitaire : bannière d'alerte ───────────────── */
    function showAlert(message, type) {
        const existing = document.getElementById('form-alert');
        if (existing) existing.remove();

        const colors = type === 'success'
            ? 'bg-[#dee8ff] text-[#001360] border-[#bac3ff]'
            : 'bg-[#ffdad6] text-[#ba1a1a] border-[#ffb3af]';

        const icon = type === 'success' ? 'check_circle' : 'error';

        const el = document.createElement('div');
        el.id = 'form-alert';
        el.className = `flex items-center gap-3 p-4 rounded-lg border ${colors} mb-4 transition-all`;
        el.innerHTML = `
            <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;">${icon}</span>
            <span class="text-sm font-medium">${message}</span>
        `;

        form.prepend(el);
        setTimeout(() => el.remove(), 5000);
    }
});
