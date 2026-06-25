/**
 * admin-service/routes/admin.js
 * ─────────────────────────────
 * Routes du microservice admin-service.
 * Communique avec ticket-service via HTTP (inter-service).
 *
 * GET    /api/admin/tickets              → tous les tickets en attente
 * GET    /api/admin/tickets/valides      → tickets validés
 * GET    /api/admin/tickets/invalides    → tickets invalidés
 * GET    /api/admin/historique           → historique de toutes les actions
 * PATCH  /api/admin/tickets/:id/valider  → valider un ticket
 * PATCH  /api/admin/tickets/:id/invalider→ invalider un ticket
 */

const express = require('express');

const router = express.Router();

/* ── URL du ticket-service ─────────────────────────────── */
const TICKET_SERVICE = process.env.TICKET_SERVICE_URL || 'http://localhost:3001';

/* ── Historique local ──────────────────────────────────── */
// Dans une vraie prod → base de données partagée ou message broker (RabbitMQ, Kafka)
const historique = [];

/* ── Helper : appel HTTP vers ticket-service ───────────── */
async function callTicketService(path, method = 'GET', body = null) {
    const url = `${TICKET_SERVICE}/api/tickets${path}`;
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
}

/* ── GET /tickets — tickets en attente ─────────────────── */
router.get('/tickets', async (_req, res) => {
    try {
        const data = await callTicketService('/pending');
        res.json(data);
    } catch (err) {
        console.error('[admin-service] Erreur ticket-service:', err);
        res.status(err.status || 503).json({ error: 'Impossible de contacter ticket-service.' });
    }
});

/* ── GET /tickets/valides ──────────────────────────────── */
router.get('/tickets/valides', async (_req, res) => {
    try {
        const { tickets } = await callTicketService('/');
        const valides = (tickets || []).filter(t => t.statut === 'valide');
        res.json({ count: valides.length, tickets: valides });
    } catch (err) {
        res.status(err.status || 503).json({ error: 'Impossible de contacter ticket-service.' });
    }
});

/* ── GET /tickets/invalides ────────────────────────────── */
router.get('/tickets/invalides', async (_req, res) => {
    try {
        const { tickets } = await callTicketService('/');
        const invalides = (tickets || []).filter(t => t.statut === 'invalide');
        res.json({ count: invalides.length, tickets: invalides });
    } catch (err) {
        res.status(err.status || 503).json({ error: 'Impossible de contacter ticket-service.' });
    }
});

/* ── GET /historique ───────────────────────────────────── */
router.get('/historique', (_req, res) => {
    res.json({ count: historique.length, historique });
});

/* ── PATCH /tickets/:id/valider ────────────────────────── */
router.patch('/tickets/:id/valider', async (req, res) => {
    try {
        // 1. Récupérer le ticket depuis ticket-service
        const ticket = await callTicketService(`/${req.params.id}`);

        // 2. Mettre à jour le statut dans ticket-service
        const updated = await callTicketService(`/${req.params.id}`, 'PATCH', { statut: 'valide' });

        // 3. Enregistrer dans l'historique local
        historique.push({
            ticketId:  req.params.id,
            email:     ticket.email,
            code:      ticket.code,
            action:    'valide',
            date:      new Date().toISOString()
        });

        console.log(`[admin-service] ✓ Ticket ${ticket.code} validé`);
        res.json({ message: 'Ticket validé avec succès.', ticket: updated.ticket });
    } catch (err) {
        console.error('[admin-service] Erreur validation:', err);
        res.status(err.status || 503).json({ error: err.error || 'Erreur lors de la validation.' });
    }
});

/* ── PATCH /tickets/:id/invalider ──────────────────────── */
router.patch('/tickets/:id/invalider', async (req, res) => {
    try {
        // 1. Récupérer le ticket
        const ticket = await callTicketService(`/${req.params.id}`);

        // 2. Mettre à jour le statut
        const updated = await callTicketService(`/${req.params.id}`, 'PATCH', { statut: 'invalide' });

        // 3. Enregistrer dans l'historique
        historique.push({
            ticketId:  req.params.id,
            email:     ticket.email,
            code:      ticket.code,
            action:    'invalide',
            date:      new Date().toISOString()
        });

        console.log(`[admin-service] ✗ Ticket ${ticket.code} invalidé`);
        res.json({ message: 'Ticket invalidé avec succès.', ticket: updated.ticket });
    } catch (err) {
        console.error('[admin-service] Erreur invalidation:', err);
        res.status(err.status || 503).json({ error: err.error || 'Erreur lors de l\'invalidation.' });
    }
});

module.exports = router;
