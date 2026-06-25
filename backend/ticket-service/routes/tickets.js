/**
 * ticket-service/routes/tickets.js
 * ─────────────────────────────────
 * Routes du microservice ticket-service.
 *
 * POST   /api/tickets/verify   → soumettre des tickets pour vérification
 * GET    /api/tickets           → lister tous les tickets (lu par admin-service)
 * GET    /api/tickets/:id       → détail d'un ticket
 * PATCH  /api/tickets/:id       → mise à jour du statut (appelé par admin-service)
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/* ── Store en mémoire (→ remplacer par DB) ─────────────── */
// Exporté pour que les tests puissent l'inspecter
const store = { tickets: [] };

/* ── POST /verify — utilisateur soumet ses tickets ─────── */
router.post('/verify', (req, res) => {
    const { email, tickets: codes } = req.body;

    if (!email || !Array.isArray(codes) || codes.length === 0) {
        return res.status(400).json({
            error: 'Champs requis : email (string) et tickets (array non vide).'
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Adresse email invalide.' });
    }

    const created = codes
        .map(c => c.trim().toUpperCase())
        .filter(c => c.length > 0)
        .map(code => ({
            id:        uuidv4(),
            email:     email.toLowerCase().trim(),
            code,
            statut:    'en_attente',   // en_attente | valide | invalide
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }));

    store.tickets.push(...created);

    console.log(`[ticket-service] ${created.length} ticket(s) reçu(s) de ${email}`);

    return res.status(201).json({
        message: `${created.length} ticket(s) envoyé(s) pour vérification.`,
        tickets: created.map(({ id, code, statut }) => ({ id, code, statut }))
    });
});

/* ── GET / — liste tous les tickets (consultable par admin-service) */
router.get('/', (_req, res) => {
    res.json({ count: store.tickets.length, tickets: store.tickets });
});

/* ── GET /pending — tickets en attente uniquement ─────── */
router.get('/pending', (_req, res) => {
    const pending = store.tickets.filter(t => t.statut === 'en_attente');
    res.json({ count: pending.length, tickets: pending });
});

/* ── GET /:id — détail d'un ticket ────────────────────── */
router.get('/:id', (req, res) => {
    const ticket = store.tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable.' });
    res.json(ticket);
});

/* ── PATCH /:id — mise à jour du statut ────────────────── */
// Appelé UNIQUEMENT par admin-service via communication inter-services
router.patch('/:id', (req, res) => {
    const { statut } = req.body;
    const allowed = ['valide', 'invalide', 'en_attente'];

    if (!allowed.includes(statut)) {
        return res.status(400).json({ error: `Statut invalide. Valeurs : ${allowed.join(', ')}` });
    }

    const ticket = store.tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable.' });

    ticket.statut    = statut;
    ticket.updatedAt = new Date().toISOString();

    console.log(`[ticket-service] Ticket ${ticket.code} → ${statut}`);
    res.json({ message: `Ticket mis à jour : ${statut}.`, ticket });
});

module.exports = router;
module.exports.store = store;   // exposé pour les tests
