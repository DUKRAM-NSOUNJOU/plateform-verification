/**
 * admin-service/routes/admin.js — VERSION PostgreSQL + JWT Auth
 * ─────────────────────────────────────────────────────────────
 *
 * Routes publiques :
 *   POST  /api/admin/login               → authentification admin
 *
 * Routes protégées (JWT requis) :
 *   GET   /api/admin/tickets             → tickets publiés en attente
 *   GET   /api/admin/tickets/valides     → tickets validés
 *   GET   /api/admin/tickets/invalides   → tickets invalidés
 *   GET   /api/admin/tickets/stats       → statistiques globales
 *   GET   /api/admin/historique          → historique des actions
 *   PATCH /api/admin/tickets/:id/valider   → valider un ticket
 *   PATCH /api/admin/tickets/:id/invalider → invalider un ticket
 *   GET   /api/admin/me                  → profil admin connecté
 *   DELETE /api/admin/tickets/:id        → supprimer un ticket
 *   POST  /api/admin/send-status-email   → envoyer le résultat par mail
 *
 * Routes super admin (JWT requis + rôle superadmin + liste blanche) :
 *   POST   /api/admin/super/login          → authentification super admin
 *   GET    /api/admin/super/tickets        → codes NON encore publiés
 *   PATCH  /api/admin/super/tickets/:id    → modifier un code (CRUD)
 *   DELETE /api/admin/super/tickets/:id    → supprimer un code (CRUD)
 *   POST   /api/admin/super/release        → publier les codes vers l'admin
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
   Middleware Super Admin
   Exige : rôle `superadmin` ET email présent dans la table super_admins
──────────────────────────────────────────────────────────────── */
async function isSuperAdminEmail(email) {
    if (!email) return false;
    const result = await query(
        'SELECT 1 FROM super_admins WHERE lower(email) = lower($1)',
        [String(email).trim()]
    );
    return result.rowCount > 0;
}

function requireSuperAdmin(req, res, next) {
    if (!req.admin) {
        return res.status(401).json({ error: 'Token d\'authentification manquant.' });
    }
    if (req.admin.role !== 'superadmin') {
        return res.status(403).json({ error: 'Accès réservé au super administrateur.' });
    }
    isSuperAdminEmail(req.admin.email)
        .then(allowed => {
            if (!allowed) {
                return res.status(403).json({ error: 'Accès réservé au super administrateur.' });
            }
            next();
        })
        .catch(err => {
            console.error('[admin-service] Erreur vérification super admin:', err.message);
            res.status(500).json({ error: 'Erreur de vérification des accès.' });
        });
}

/* ────────────────────────────────────────────────────────────────
   Helper : appel HTTP vers ticket-service
──────────────────────────────────────────────────────────────── */
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
   Helper : ne garder que les tickets publiés par le super admin
──────────────────────────────────────────────────────────────── */
function filterReleased(tickets) {
    return (tickets || []).filter(t => t.released === true);
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
            WHERE released = TRUE
        `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération stats.' });
    }
});

/* ────────────────────────────────────────────────────────────────
   GET /tickets — tickets publiés et en attente (protégé)
──────────────────────────────────────────────────────────────── */
router.get('/tickets', requireAuth, async (_req, res) => {
    try {
        const data = await callTicketService('/pending');
        res.json({ count: data.tickets.length, tickets: data.tickets });
    } catch (err) {
        console.error('[admin-service] Erreur ticket-service:', err);
        res.status(err.status || 503).json({ error: 'Impossible de contacter ticket-service.' });
    }
});

/* ── GET /tickets/valides (protégé) ───────────────────────────── */
router.get('/tickets/valides', requireAuth, async (_req, res) => {
    try {
        const { tickets } = await callTicketService('/');
        const valides = filterReleased(tickets).filter(t => t.statut === 'valide');
        res.json({ count: valides.length, tickets: valides });
    } catch (err) {
        res.status(err.status || 503).json({ error: 'Impossible de contacter ticket-service.' });
    }
});

/* ── GET /tickets/invalides (protégé) ────────────────────────── */
router.get('/tickets/invalides', requireAuth, async (_req, res) => {
    try {
        const { tickets } = await callTicketService('/');
        const invalides = filterReleased(tickets).filter(t => t.statut === 'invalide');
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

/* ══════════════════════════════════════════════════════════════
   SECTION SUPER ADMIN
   Accès : JWT valide + rôle `superadmin` + email dans super_admins
══════════════════════════════════════════════════════════════ */

/* ── POST /super/login — authentification super admin ────────── */
router.post('/super/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    try {
        const normalized = String(email).toLowerCase().trim();

        // Liste blanche : l'email doit être déclaré comme super admin
        if (!(await isSuperAdminEmail(normalized))) {
            return res.status(401).json({ error: 'Identifiants incorrects.' });
        }

        const result = await query('SELECT * FROM admins WHERE email = $1', [normalized]);
        if (result.rowCount === 0) {
            return res.status(401).json({ error: 'Identifiants incorrects.' });
        }

        const admin = result.rows[0];
        if (admin.role !== 'superadmin') {
            return res.status(401).json({ error: 'Identifiants incorrects.' });
        }

        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) {
            return res.status(401).json({ error: 'Identifiants incorrects.' });
        }

        const token = jwt.sign(
            { id: admin.id, email: admin.email, nom: admin.nom, role: admin.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        console.log(`[admin-service] ✓ Login super admin: ${admin.email}`);
        return res.json({
            message: 'Connexion réussie.',
            token,
            admin: { id: admin.id, email: admin.email, nom: admin.nom, role: admin.role }
        });
    } catch (err) {
        console.error('[admin-service] Erreur login super admin:', err.message);
        return res.status(500).json({ error: 'Erreur interne.' });
    }
});

/* ── GET /super/mode — lire le mode de validation ─────────────── */
router.get('/super/mode', requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        const result = await query("SELECT value FROM app_settings WHERE key = 'manual_validation'");
        const isManual = result.rowCount === 0 || result.rows[0].value !== 'false';
        res.json({ manual_validation: isManual });
    } catch (err) {
        console.error('[admin-service] Erreur lecture mode:', err);
        res.status(500).json({ error: 'Erreur lecture paramètre de mode.' });
    }
});

/* ── POST /super/toggle-mode — changer le mode de validation ─── */
router.post('/super/toggle-mode', requireAuth, requireSuperAdmin, async (req, res) => {
    const { manual_validation } = req.body;
    if (typeof manual_validation !== 'boolean') {
        return res.status(400).json({ error: 'Le champ manual_validation (boolean) est requis.' });
    }
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await query(
            `INSERT INTO app_settings (key, value)
             VALUES ('manual_validation', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [manual_validation ? 'true' : 'false']
        );
        console.log(`[admin-service] ⚙️ Mode validation manuelle changé à [${manual_validation}] par ${req.admin.email}`);
        res.json({
            message: manual_validation ? 'Validation manuelle activée.' : 'Transmission automatique activée.',
            manual_validation
        });
    } catch (err) {
        console.error('[admin-service] Erreur mise à jour mode:', err);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du mode.' });
    }
});

/* ── GET /super/tickets — codes pour la console super admin ────── */
router.get('/super/tickets', requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
        const data = await callTicketService('/super').catch(() => callTicketService('/unreleased'));
        res.json({ count: data.tickets.length, tickets: data.tickets });
    } catch (err) {
        console.error('[admin-service] Erreur super/tickets:', err);
        res.status(err.status || 503).json({ error: 'Impossible de contacter ticket-service.' });
    }
});

/* ── PATCH /super/tickets/:id — modifier un code (CRUD) ──────── */
router.patch('/super/tickets/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    const { code } = req.body;
    if (typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ error: 'Le code ne peut pas être vide.' });
    }

    try {
        const data = await callTicketService(`/${req.params.id}`, 'PATCH', { code: code.trim() });
        console.log(`[admin-service] ✎ Code ${req.params.id} modifié par ${req.admin.email}`);
        res.json({ message: 'Code mis à jour.', ticket: data.ticket });
    } catch (err) {
        console.error('[admin-service] Erreur modification code:', err);
        res.status(err.status || 503).json({ error: err.error || 'Erreur lors de la modification.' });
    }
});

/* ── DELETE /super/tickets/:id — supprimer un code (CRUD) ────── */
router.delete('/super/tickets/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const data = await callTicketService(`/${req.params.id}`, 'DELETE');
        console.log(`[admin-service] 🗑 Code ${req.params.id} supprimé par ${req.admin.email}`);
        res.json({ message: 'Code supprimé.', ticket: data.ticket });
    } catch (err) {
        console.error('[admin-service] Erreur suppression code:', err);
        res.status(err.status || 503).json({ error: err.error || 'Erreur lors de la suppression.' });
    }
});

/* ── POST /super/release — publier les codes vers l'admin ────── */
/* 1. Publie les tickets  2. Email de confirmation à l'utilisateur
   3. Notification à tous les administrateurs                     */
router.post('/super/release', requireAuth, requireSuperAdmin, async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Aucun code sélectionné.' });
    }

    // Récupérer l'état AVANT publication (emails + codes originaux)
    let snapshot;
    try {
        snapshot = await callTicketService('/unreleased');
    } catch (err) {
        return res.status(err.status || 503).json({ error: 'Impossible de contacter ticket-service.' });
    }

    const releasing = (snapshot.tickets || []).filter(t => ids.includes(t.id));
    if (releasing.length === 0) {
        return res.status(404).json({ error: 'Aucun code à publier.' });
    }

    let released;
    try {
        released = await callTicketService('/release', 'POST', { ids: releasing.map(t => t.id) });
    } catch (err) {
        console.error('[admin-service] Erreur publication:', err);
        return res.status(err.status || 503).json({ error: err.error || 'Erreur lors de la publication.' });
    }

    // Regrouper les codes PAR utilisateur
    const groups = {};
    releasing.forEach(t => {
        if (!groups[t.email]) groups[t.email] = [];
        groups[t.email].push(t.code);
    });

    let adminEmails = [];
    try {
        const admins = await query('SELECT email FROM admins');
        adminEmails = admins.rows.map(a => a.email);
    } catch (err) {
        console.warn('[admin-service] Impossible de lister les admins:', err.message);
    }

    const notifications = { confirmation: [], admins: [] };

    for (const userEmail of Object.keys(groups)) {
        const codes = groups[userEmail];

        try {
            await sendConfirmationEmail(userEmail, codes);
            notifications.confirmation.push(userEmail);
            console.log(`[admin-service] ✉ Confirmation envoyée à ${userEmail}`);
        } catch (err) {
            console.warn(`[admin-service] Échec confirmation ${userEmail}:`, err.message);
        }

        if (adminEmails.length > 0) {
            try {
                await sendAdminNotification(adminEmails, userEmail, codes.length);
                notifications.admins.push(userEmail);
            } catch (err) {
                console.warn('[admin-service] Échec notification admins:', err.message);
            }
        }
    }

    console.log(`[admin-service] 🚀 ${released.tickets.length} code(s) publié(s) vers le tableau admin par ${req.admin.email}`);

    res.json({
        message: `${released.tickets.length} code(s) publié(s) dans le tableau de bord admin.`,
        tickets: released.tickets,
        notifications
    });
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
