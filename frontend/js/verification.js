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

    function showFieldError(input, message) {
        const existing = document.getElementById('code-error-dialog');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.id = 'code-error-dialog';
        dialog.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'code-error-title');
        dialog.innerHTML = `
            <div class="w-full max-w-md bg-white rounded-xl shadow-2xl border border-red-200 p-6 text-center">
                <div class="mx-auto mb-3 w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                    <span class="material-symbols-outlined">error</span>
                </div>
                <h2 id="code-error-title" class="text-lg font-bold text-red-700 mb-2">Code incorrect</h2>
                <p class="text-sm text-gray-700 mb-5"></p>
                <button type="button" class="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold">Fermer</button>
            </div>`;
        dialog.querySelector('p').textContent = message;
        const closeButton = dialog.querySelector('button');
        const closeDialog = () => {
            dialog.remove();
            input.focus();
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        closeButton.addEventListener('click', closeDialog);
        dialog.addEventListener('click', event => {
            if (event.target === dialog) closeDialog();
        });
        document.body.appendChild(dialog);
        closeButton.focus();
    }

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

            const recharge = document.getElementById('recharge').value;
            const montant  = document.getElementById('montant').value;
            const devise   = document.getElementById('devise').value;
            const pays     = document.getElementById('pays').value;
            const email    = document.getElementById('email').value.trim();

            if (!pays) {
                showAlert('Veuillez sélectionner le pays d\'où provient le code.', 'error');
                return;
            }

            const inputs  = container.querySelectorAll('input[type="text"]');
            const codeEntries = Array.from(inputs)
                .map((input, index) => ({ value: input.value.trim(), index }))
                .filter(entry => entry.value !== '');
            const tickets = codeEntries.map(entry => entry.value);

            if (tickets.length === 0) {
                showAlert('Veuillez saisir au moins un code de ticket.', 'error');
                return;
            }

            if (!recharge) {
                showAlert('Veuillez sélectionner une recharge.', 'error');
                return;
            }

            if (!window.CodeFormats) {
                showAlert('Le module de validation des codes est indisponible. Rechargez la page.', 'error');
                return;
            }

            const codeErrors = [];
            codeEntries.forEach(entry => {
                const result = window.CodeFormats.validateCode(recharge, entry.value);
                if (!result.ok) {
                    codeErrors.push({ entry, message: result.message });
                }
            });

            if (codeErrors.length > 0) {
                const firstError = codeErrors[0];
                showFieldError(inputs[firstError.entry.index], `Code incorrect : ${firstError.message}`);
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
                    body: JSON.stringify({ recharge, montant, devise, pays, email, tickets })
                });

                const data = await res.json();

                if (res.ok) {
                    showSuccessModal();
                    // Reset inputs
                    inputs.forEach(i => i.value = '');
                    document.getElementById('recharge').value = '';
                    document.getElementById('montant').value = '';
                    document.getElementById('devise').value = '';
                    document.getElementById('pays').value = '';
                    document.getElementById('email').value = '';
                } else {
                    const serverCodeError = (data.error || '').match(/^Code (\d+) incorrect\s*:\s*(.*)$/i);
                    if (serverCodeError) {
                        const input = inputs[Number(serverCodeError[1]) - 1];
                        if (input) {
                            showFieldError(input, `Code incorrect : ${serverCodeError[2]}`);
                        } else {
                            showAlert(data.error, 'error');
                        }
                    } else {
                        showAlert(data.error || 'Une erreur est survenue.', 'error');
                    }
                }
            } catch (err) {
                console.warn('API Gateway injoignable, bascule en mode démo hors-ligne:', err);
                showSuccessModal();
                inputs.forEach(i => i.value = '');
                document.getElementById('recharge').value = '';
                document.getElementById('montant').value = '';
                document.getElementById('devise').value = '';
                document.getElementById('email').value = '';
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <span class="material-symbols-outlined"
                          style="font-variation-settings: 'FILL' 1;">verified</span>
                    Valider
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

        const iconEl = document.createElement('span');
        iconEl.className = 'material-symbols-outlined';
        iconEl.style.fontVariationSettings = "'FILL' 1";
        iconEl.textContent = icon;

        const messageEl = document.createElement('span');
        messageEl.className = 'text-sm font-medium whitespace-pre-line';
        messageEl.textContent = message;

        el.appendChild(iconEl);
        el.appendChild(messageEl);

        form.prepend(el);
        setTimeout(() => el.remove(), 5000);
    }
});
