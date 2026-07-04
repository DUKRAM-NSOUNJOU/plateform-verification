/**
 * routes/tickets.js — API des tickets
 * Plate-Verification Backend
 *
 * Routes :
 *   POST   /api/tickets/verify          → Soumettre des tickets pour vérification
 *   GET    /api/tickets                 → Lister tous les tickets (admin)
 *   GET    /api/tickets/valides         → Lister les tickets valides
 *   GET    /api/tickets/invalides       → Lister les tickets invalides
 *   PATCH  /api/tickets/:id/valider     → Marquer un ticket comme valide
 *   PATCH  /api/tickets/:id/invalider   → Marquer un ticket comme invalide
 *   GET    /api/tickets/historique      → Historique de toutes les actions
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/* ── Stockage en mémoire (remplacer par une base de données) ── */
let tickets = [];
let historique = [];

/* ── POST /verify — utilisateur soumet ses tickets ─────────── */
router.post('/verify', (req, res) => {
    const { email, tickets: codes } = req.body;

    if (!email || !codes || !Array.isArray(codes) || codes.length === 0) {
        return res.status(400).json({ error: 'Email et au moins un code de ticket requis.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Adresse email invalide.' });
    }

    const newTickets = codes.map(code => ({
        id:        uuidv4(),
        email:     email.toLowerCase().trim(),
        code:      code.trim(),
        statut:    'en_attente',        // en_attente | valide | invalide
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }));

    tickets.push(...newTickets);

    return res.status(201).json({
        message: `${newTickets.length} ticket(s) envoyé(s) pour vérification.`,
        tickets: newTickets.map(t => ({ id: t.id, code: t.code, statut: t.statut }))
    });
});

/* ── GET / — admin : tous les tickets en attente ───────────── */
router.get('/', (_req, res) => {
    const enAttente = tickets.filter(t => t.statut === 'en_attente');
    res.json({ count: enAttente.length, tickets: enAttente });
});

/* ── GET /valides ───────────────────────────────────────────── */
router.get('/valides', (_req, res) => {
    const valides = tickets.filter(t => t.statut === 'valide');
    res.json({ count: valides.length, tickets: valides });
});

/* ── GET /invalides ─────────────────────────────────────────── */
router.get('/invalides', (_req, res) => {
    const invalides = tickets.filter(t => t.statut === 'invalide');
    res.json({ count: invalides.length, tickets: invalides });
});

/* ── GET /historique ────────────────────────────────────────── */
router.get('/historique', (_req, res) => {
    res.json({ count: historique.length, historique });
});

/* ── PATCH /:id/valider ─────────────────────────────────────── */
router.patch('/:id/valider', (req, res) => {
    const ticket = tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable.' });

    ticket.statut    = 'valide';
    ticket.updatedAt = new Date().toISOString();

    historique.push({
        ticketId:  ticket.id,
        email:     ticket.email,
        code:      ticket.code,
        action:    'valide',
        date:      ticket.updatedAt
    });

    res.json({ message: 'Ticket validé.', ticket });
});

/* ── PATCH /:id/invalider ───────────────────────────────────── */
router.patch('/:id/invalider', (req, res) => {
    const ticket = tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable.' });

    ticket.statut    = 'invalide';
    ticket.updatedAt = new Date().toISOString();

    historique.push({
        ticketId:  ticket.id,
        email:     ticket.email,
        code:      ticket.code,
        action:    'invalide',
        date:      ticket.updatedAt
    });

    res.json({ message: 'Ticket invalidé.', ticket });
});

module.exports = router;
