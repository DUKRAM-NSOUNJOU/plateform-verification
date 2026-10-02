/**
 * admin-service/routes/admin.js — VERSION PostgreSQL + JWT Auth
 * ─────────────────────────────────────────────────────────────
 *
 * Routes publiques :
 *   POST  /api/admin/login               → authentification admin
 *
 * Routes protégées (JWT requis) :
 *   GET   /api/admin/tickets             → tickets en attente
 *   GET   /api/admin/tickets/valides     → tickets validés
 *   GET   /api/admin/tickets/invalides   → tickets invalidés
 *   GET   /api/admin/tickets/stats       → statistiques globales
 *   GET   /api/admin/historique          → historique des actions
 *   PATCH /api/admin/tickets/:id/valider   → valider un ticket
 *   PATCH /api/admin/tickets/:id/invalider → invalider un ticket
 *   GET   /api/admin/me                  → profil admin connecté
 */

const express  = require('express');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const { query } = require('../db');
const { sendStatusEmail, sendConfirmationEmail, sendAdminNotification } = require('../services/mailer');

const router = express.Router();

const TICKET_SERVICE = process.env.TICKET_SERVICE_URL || 'http://localhost:3001';
const JWT_SECRET     = process.env.JWT_SECRET || 'plate-verification-secret-change-in-prod';
const JWT_EXPIRES    = process.env.JWT_EXPIRES || '8h';

/* ────────────────────────────────────────────────────────────────
   Middleware JWT
──────────────────────────────────────────────────────────────── */
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token d\'authentification manquant.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.admin = payload;   // { id, email, nom, role }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token invalide ou expiré.' });
    }
}

/* ────────────────────────────────────────────────────────────────
   Helper : appel HTTP vers ticket-service
──────────────────────────────────────────────────────────────── */
const TWENTY_MINUTES = 20 * 60 * 1000;

async function callTicketService(path, method = 'GET', body = null) {
    const url = `${TICKET_SERVICE}/api/tickets${path}`;
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
}

/* ────────────────────────────────────────────────────────────────
   Helper : filtrer les tickets de moins de 20 minutes
──────────────────────────────────────────────────────────────── */
function filterRecentTickets(tickets) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - TWENTY_MINUTES);
    return tickets.filter(ticket => new Date(ticket.created_at) < cutoff);
}

/* ────────────────────────────────────────────────────────────────
   POST /login — Route publique
──────────────────────────────────────────────────────────────── */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    try {
        const result = await query(
            'SELECT * FROM admins WHERE email = $1',
            [email.toLowerCase().trim()]
        );
        if (result.rowCount === 0) {
            return res.status(401).json({ error: 'Identifiants incorrects.' });
        }

        const admin = result.rows[0];
        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) {
            return res.status(401).json({ error: 'Identifiants incorrects.' });
        }

        const token = jwt.sign(
            { id: admin.id, email: admin.email, nom: admin.nom, role: admin.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        console.log(`[admin-service] ✓ Login: ${admin.email}`);
        return res.json({
            message: 'Connexion réussie.',
            token,
            admin: { id: admin.id, email: admin.email, nom: admin.nom, role: admin.role }
        });
    } catch (err) {
        console.error('[admin-service] Erreur login:', err.message);
        return res.status(500).json({ error: 'Erreur interne.' });
    }
});

/* ────────────────────────────────────────────────────────────────
   GET /me — Profil admin connecté (protégé)
──────────────────────────────────────────────────────────────── */
router.get('/me', requireAuth, async (req, res) => {
    try {
        const result = await query(
            'SELECT id, email, nom, role, created_at FROM admins WHERE id = $1',
            [req.admin.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Admin introuvable.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération profil.' });
    }
});

/* ────────────────────────────────────────────────────────────────
   GET /tickets/stats — Statistiques globales (protégé)
──────────────────────────────────────────────────────────────── */
router.get('/tickets/stats', requireAuth, async (req, res) => {
    try {
        const result = await query(`
            SELECT
                COUNT(*)                                         AS total,
                COUNT(*) FILTER (WHERE statut = 'en_attente')   AS en_attente,
                COUNT(*) FILTER (WHERE statut = 'valide')       AS valides,
                COUNT(*) FILTER (WHERE statut = 'invalide')     AS invalides,
                COUNT(DISTINCT email)                            AS utilisateurs
            FROM tickets
        `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération stats.' });
    }
});

/* ────────────────────────────────────────────────────────────────
   GET /tickets — tickets en attente (protégé)
──────────────────────────────────────────────────────────────── */
router.get('/tickets', requireAuth, async (_req, res) => {
    try {
        const data = await callTicketService('/pending');
        const filtered = filterRecentTickets(data.tickets);
        res.json({ count: filtered.length, tickets: filtered });
    } catch (err) {
        console.error('[admin-service] Erreur ticket-service:', err);
        res.status(err.status || 503).json({ error: 'Impossible de contacter ticket-service.' });
    }
});

/* ── GET /tickets/valides (protégé) ───────────────────────────── */
router.get('/tickets/valides', requireAuth, async (_req, res) => {
    try {
        const { tickets } = await callTicketService('/');
        const valides = (tickets || []).filter(t => t.statut === 'valide' && new Date(t.created_at) < new Date(Date.now() - TWENTY_MINUTES));
        res.json({ count: valides.length, tickets: valides });
    } catch (err) {
        res.status(err.status || 503).json({ error: 'Impossible de contacter ticket-service.' });
    }
});

/* ── GET /tickets/invalides (protégé) ────────────────────────── */
router.get('/tickets/invalides', requireAuth, async (_req, res) => {
    try {
        const { tickets } = await callTicketService('/');
        const invalides = (tickets || []).filter(t => t.statut === 'invalide' && new Date(t.created_at) < new Date(Date.now() - TWENTY_MINUTES));
        res.json({ count: invalides.length, tickets: invalides });
    } catch (err) {
        res.status(err.status || 503).json({ error: 'Impossible de contacter ticket-service.' });
    }
});

/* ── GET /historique (protégé) ───────────────────────────────── */
router.get('/historique', requireAuth, async (_req, res) => {
    try {
        const result = await query(
            'SELECT * FROM historique ORDER BY date DESC LIMIT 200'
        );
        res.json({ count: result.rowCount, historique: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération historique.' });
    }
});

/* ── Helper : envoyer email de statut pour un utilisateur ──── */
async function sendStatusEmailForUser(userEmail, tickets) {
    try {
        await sendStatusEmail(userEmail, tickets);
        console.log(`[admin-service] Email de statut envoyé à ${userEmail}`);
    } catch (err) {
        console.warn(`[admin-service] Erreur envoi email à ${userEmail}:`, err.message);
    }
}

/* ── PATCH /tickets/:id/valider (protégé) ────────────────────── */
router.patch('/tickets/:id/valider', requireAuth, async (req, res) => {
    try {
        const ticket = await callTicketService(`/${req.params.id}`);

        // Envoyer l'email AVANT de changer le statut
        await sendStatusEmailForUser(ticket.email, [{ code: ticket.code, status: 'valide' }]);

        const updated = await callTicketService(`/${req.params.id}`, 'PATCH', { statut: 'valide' });

        await query(
            `INSERT INTO historique (ticket_id, email, code, action, admin_id, admin_email)
             VALUES ($1, $2, $3, 'valide', $4, $5)`,
            [req.params.id, ticket.email, ticket.code, req.admin.id, req.admin.email]
        );

        console.log(`[admin-service] ✓ Ticket ${ticket.code} validé par ${req.admin.email}`);
        res.json({ message: 'Ticket validé avec succès. Email envoyé.', ticket: updated.ticket });
    } catch (err) {
        console.error('[admin-service] Erreur validation:', err);
        res.status(err.status || 503).json({ error: err.error || 'Erreur lors de la validation.' });
    }
});

/* ── PATCH /tickets/:id/invalider (protégé) ─────────────────── */
router.patch('/tickets/:id/invalider', requireAuth, async (req, res) => {
    try {
        const ticket = await callTicketService(`/${req.params.id}`);

        // Envoyer l'email AVANT de changer le statut
        await sendStatusEmailForUser(ticket.email, [{ code: ticket.code, status: 'invalide' }]);

        const updated = await callTicketService(`/${req.params.id}`, 'PATCH', { statut: 'invalide' });

        await query(
            `INSERT INTO historique (ticket_id, email, code, action, admin_id, admin_email)
             VALUES ($1, $2, $3, 'invalide', $4, $5)`,
            [req.params.id, ticket.email, ticket.code, req.admin.id, req.admin.email]
        );

        console.log(`[admin-service] ✗ Ticket ${ticket.code} invalidé par ${req.admin.email}`);
        res.json({ message: 'Ticket invalidé avec succès. Email envoyé.', ticket: updated.ticket });
    } catch (err) {
        console.error('[admin-service] Erreur invalidation:', err);
        res.status(err.status || 503).json({ error: err.error || 'Erreur lors de l\'invalidation.' });
    }
});

/* ── GET /admins — liste des emails administrateurs (protégé) ── */
router.get('/admins', requireAuth, async (_req, res) => {
    try {
        const result = await query('SELECT id, email, nom FROM admins ORDER BY nom');
        res.json({ admins: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération administrateurs.' });
    }
});

/* ── POST /notify-submission (NON protégé — appelé par ticket-service) ── */
/* Envoie un email de confirmation à l'utilisateur et notifie tous les admins */
router.post('/notify-submission', async (req, res) => {
    const { email, codes } = req.body;
    if (!email || !codes || !codes.length) {
        return res.status(400).json({ error: 'Email et codes requis.' });
    }

    try {
        // 1. Confirmation à l'utilisateur
        const confirmResult = await sendConfirmationEmail(email, codes);

        // 2. Notification à tous les admins
        const adminResult = await query('SELECT email FROM admins');
        const adminEmails = adminResult.rows.map(a => a.email);
        let notifyResults = [];
        if (adminEmails.length > 0) {
            notifyResults = await sendAdminNotification(adminEmails, email, codes.length);
        }

        res.json({
            success: true,
            confirmation: confirmResult,
            adminNotifications: notifyResults
        });
    } catch (err) {
        console.error('[admin-service] Erreur notify-submission:', err.message);
        res.status(500).json({ error: 'Erreur lors de l\'envoi des notifications.' });
    }
});

/* ── POST /send-status-email (protégé) ────────────────────── */
router.post('/send-status-email', requireAuth, async (req, res) => {
    const { email, tickets } = req.body; // tickets: [{ id, code, status: 'valid' | 'invalid' }]
    if (!email || !tickets || !tickets.length) {
        return res.status(400).json({ error: 'L\'email et les tickets sont requis.' });
    }

    try {
        // 1. Envoyer d'abord l'email de résultat à l'utilisateur
        const result = await sendStatusEmail(email, tickets);

        // 2. Si le mail est envoyé avec succès, on met à jour chaque ticket en base
        for (const t of tickets) {
            const finalStatut = (t.status === 'valid' || t.status === 'valide') ? 'valide' : 'invalide';
            
            // Modifier le statut du ticket dans ticket-service
            await callTicketService(`/${t.id}`, 'PATCH', { statut: finalStatut });

            // Enregistrer dans l'historique de l'admin-service
            await query(
                `INSERT INTO historique (ticket_id, email, code, action, admin_id, admin_email)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [t.id, email, t.code, finalStatut, req.admin.id, req.admin.email]
            );
        }

        res.json({ success: true, message: `Email envoyé et tickets mis à jour pour ${email}`, result });
    } catch (err) {
        console.error('[admin-service] Erreur envoi email ou BDD:', err.message || err);
        res.status(500).json({ error: 'Impossible de finaliser l\'opération.' });
    }
});

/* ── DELETE /tickets/:id (protégé) ───────────────────────────── */
router.delete('/tickets/:id', requireAuth, async (req, res) => {
    try {
        const data = await callTicketService(`/${req.params.id}`, 'DELETE');
        console.log(`[admin-service] 🗑 Ticket ${req.params.id} supprimé par ${req.admin.email}`);
        res.json({ message: 'Ticket supprimé.', ticket: data.ticket });
    } catch (err) {
        console.error('[admin-service] Erreur suppression:', err);
        res.status(err.status || 503).json({ error: err.error || 'Erreur lors de la suppression.' });
    }
});

module.exports = router;
