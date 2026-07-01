/**
 * ticket-service/routes/tickets.js — VERSION PostgreSQL
 * ────────────────────────────────────────────────────────
 * POST   /api/tickets/verify   → soumettre des tickets
 * GET    /api/tickets          → liste tous les tickets
 * GET    /api/tickets/pending  → tickets en attente
 * GET    /api/tickets/:id      → détail d'un ticket
 * PATCH  /api/tickets/:id      → mise à jour du statut (par admin-service)
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');

const router = express.Router();

/* ── POST /verify ──────────────────────────────────────────────── */
router.post('/verify', async (req, res) => {
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

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCodes = codes
        .map(c => c.trim().toUpperCase())
        .filter(c => c.length > 0);

    if (normalizedCodes.length === 0) {
        return res.status(400).json({ error: 'Aucun code valide fourni.' });
    }

    try {
        // Insertion en masse via une transaction
        await query('BEGIN');
        const inserted = [];
        for (const code of normalizedCodes) {
            const id = uuidv4();
            await query(
                `INSERT INTO tickets (id, email, code, statut)
                 VALUES ($1, $2, $3, 'en_attente')`,
                [id, normalizedEmail, code]
            );
            inserted.push({ id, code, statut: 'en_attente' });
        }
        await query('COMMIT');

        console.log(`[ticket-service] ${inserted.length} ticket(s) reçu(s) de ${normalizedEmail}`);

        return res.status(201).json({
            message: `${inserted.length} ticket(s) envoyé(s) pour vérification.`,
            tickets: inserted
        });
    } catch (err) {
        await query('ROLLBACK').catch(() => {});
        console.error('[ticket-service] Erreur insertion:', err.message);
        return res.status(500).json({ error: 'Erreur interne lors de la soumission.' });
    }
});

/* ── GET / — tous les tickets ──────────────────────────────────── */
router.get('/', async (_req, res) => {
    try {
        const result = await query(
            'SELECT * FROM tickets ORDER BY created_at DESC'
        );
        res.json({ count: result.rowCount, tickets: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération tickets.' });
    }
});

/* ── GET /pending ──────────────────────────────────────────────── */
router.get('/pending', async (_req, res) => {
    try {
        const result = await query(
            "SELECT * FROM tickets WHERE statut = 'en_attente' ORDER BY created_at ASC"
        );
        res.json({ count: result.rowCount, tickets: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération tickets en attente.' });
    }
});

/* ── GET /:id — détail ─────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
    try {
        const result = await query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Ticket introuvable.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération ticket.' });
    }
});

/* ── PATCH /:id — mise à jour statut ──────────────────────────── */
router.patch('/:id', async (req, res) => {
    const { statut } = req.body;
    const allowed = ['valide', 'invalide', 'en_attente'];

    if (!allowed.includes(statut)) {
        return res.status(400).json({ error: `Statut invalide. Valeurs : ${allowed.join(', ')}` });
    }

    try {
        const result = await query(
            'UPDATE tickets SET statut = $1 WHERE id = $2 RETURNING *',
            [statut, req.params.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Ticket introuvable.' });
        }
        console.log(`[ticket-service] Ticket ${result.rows[0].code} → ${statut}`);
        res.json({ message: `Ticket mis à jour : ${statut}.`, ticket: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erreur mise à jour ticket.' });
    }
});

module.exports = router;
