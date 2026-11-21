/**
 * admin-service/routes/admin.js — VERSION PostgreSQL + JWT Auth
 * -------------------------------------------------------------
 * Routes publiques:
 *   POST /api/admin/login               → authentification admin
 *
 * Routes protégées (JWT requis):
 *   GET  /api/admin/me                 → profil admin connecté
 *   GET  /api/admin/tickets             → tickets publiés (admin)
 *   GET  /api/admin/tickets/stats       → statistiques globales
 *   GET  /api/admin/historique          → historique des actions
 *   PATCH /api/admin/tickets/:id/valider   → valider un ticket
 *   PATCH /api/admin/tickets/:id/invalider → invalider un ticket
 *   POST /api/admin/send-status-email       → envoyer email de statut
 *
 * Routes super admin (JWT + rôle superadmin + whitelist):
 *   POST /api/admin/super/login          → authentification super admin
 *   GET  /api/admin/super/tickets        → tickets NON publiés
 *   PATCH /api/admin/super/tickets/:id   → modifier un ticket
 *   DELETE /api/admin/super/tickets/:id  → supprimer un ticket
 *   POST  /api/admin/super/release        → publier les tickets vers admin
 *   GET  /api/admin/super/mode           → état du mode manuel/auto
 *   POST /api/admin/super/toggle-mode    → basculer mode manuel/auto
 *   GET  /api/admin/super/digit-mode     → état du bouton de modification du 11ᵉ chiffre
 *   POST /api/admin/super/toggle-digit-mode → basculer le bouton de modification
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { sendStatusEmail, sendConfirmationEmail, sendAdminNotification } = require('../services/mailer');

const router = express.Router();

const TICKET_SERVICE = process.env.TICKET_SERVICE_URL || 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'plate-verification-secret-change-in-prod';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

/* -------------------------------------------------------------------
   Middleware JWT
   ------------------------------------------------------------------- */
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Token d'authentification manquant." });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.admin = payload; // { id, email, nom, role }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token invalide ou expiré.' });
    }
}

/* -------------------------------------------------------------------
   Middleware Super Admin
   ------------------------------------------------------------------- */
async function isSuperAdminEmail(email) {
    if (!email) return false;
    const result = await query('SELECT 1 FROM super_admins WHERE lower(email) = lower($1)', [String(email).trim()]);
    return result.rowCount > 0;
}
function requireSuperAdmin(req, res, next) {
    if (!req.admin) return res.status(401).json({ error: "Token d'authentification manquant." });
    if (req.admin.role !== 'superadmin') return res.status(403).json({ error: 'Accès réservé au super administrateur.' });
    isSuperAdminEmail(req.admin.email)
        .then(allowed => {
            if (!allowed) return res.status(403).json({ error: 'Accès réservé au super administrateur.' });
            next();
        })
        .catch(err => {
            console.error('[admin-service] Erreur vérification super admin:', err.message);
            res.status(500).json({ error: 'Erreur de vérification des accès.' });
        });
}

/* -------------------------------------------------------------------
   Helper : appel ticket‑service
   ------------------------------------------------------------------- */
async function callTicketService(path, method = 'GET', body = null) {
    const url = `${TICKET_SERVICE}/api/tickets${path}`;
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
}

/* -------------------------------------------------------------------
   Public routes
   ------------------------------------------------------------------- */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
    try {
        const result = await query('SELECT * FROM admins WHERE email = $1', [email.toLowerCase().trim()]);
        if (result.rowCount === 0) return res.status(401).json({ error: 'Identifiants incorrects.' });
        const admin = result.rows[0];
        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) return res.status(401).json({ error: 'Identifiants incorrects.' });
        const token = jwt.sign({ id: admin.id, email: admin.email, nom: admin.nom, role: admin.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
        return res.json({ message: 'Connexion réussie.', token, admin: { id: admin.id, email: admin.email, nom: admin.nom, role: admin.role } });
    } catch (err) {
        console.error('[admin-service] Erreur login:', err.message);
        return res.status(500).json({ error: 'Erreur interne.' });
    }
});

/* -------------------------------------------------------------------
   Super admin authentication (separate endpoint, already exists in other file)
   ------------------------------------------------------------------- */
router.post('/super/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
    try {
        const result = await query('SELECT * FROM admins WHERE email = $1', [email.toLowerCase().trim()]);
        if (result.rowCount === 0) return res.status(401).json({ error: 'Identifiants incorrects.' });
        const admin = result.rows[0];
        if (admin.role !== 'superadmin') return res.status(403).json({ error: 'Accès réservé au super administrateur.' });
        const isWhite = await isSuperAdminEmail(email);
        if (!isWhite) return res.status(403).json({ error: 'Compte non autorisé.' });
        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) return res.status(401).json({ error: 'Identifiants incorrects.' });
        const token = jwt.sign({ id: admin.id, email: admin.email, nom: admin.nom, role: admin.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
        return res.json({ message: 'Connexion super admin réussie.', token, admin: { id: admin.id, email: admin.email, nom: admin.nom, role: admin.role } });
    } catch (err) {
        console.error('[admin-service] Erreur super login:', err.message);
        return res.status(500).json({ error: 'Erreur interne.' });
    }
});

/* -------------------------------------------------------------------
   Protected routes – profil
   ------------------------------------------------------------------- */
router.get('/me', requireAuth, async (req, res) => {
    try {
        const result = await query('SELECT id, email, nom, role, created_at FROM admins WHERE id = $1', [req.admin.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Admin introuvable.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération profil.' });
    }
});

/* -------------------------------------------------------------------
   Stats (admin view)
   ------------------------------------------------------------------- */
router.get('/tickets/stats', requireAuth, async (req, res) => {
    try {
        const result = await query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE statut = 'en_attente') AS en_attente,
                COUNT(*) FILTER (WHERE statut = 'valide') AS valides,
                COUNT(*) FILTER (WHERE statut = 'invalide') AS invalides,
                COUNT(DISTINCT email) AS utilisateurs
            FROM tickets
            WHERE released = TRUE`);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération stats.' });
    }
});

/* -------------------------------------------------------------------
   Tickets (admin – déjà publiés)
   ------------------------------------------------------------------- */
router.get('/tickets', requireAuth, async (_req, res) => {
    try {
        const data = await callTicketService('/pending');
        res.json({ count: data.tickets.length, tickets: data.tickets });
    } catch (err) {
        console.error('[admin-service] Erreur ticket-service:', err);
        res.status(err.status || 503).json({ error: 'Impossible de contacter ticket-service.' });
    }
});

/* -------------------------------------------------------------------
   Super admin – tickets non publiés
   ------------------------------------------------------------------- */
router.get('/super/tickets', requireSuperAdmin, async (req, res) => {
    try {
        const data = await callTicketService('/unreleased');
        res.json({ count: data.tickets.length, tickets: data.tickets });
    } catch (err) {
        console.error('[admin-service] Erreur ticket-service (super):', err);
        res.status(err.status || 503).json({ error: 'Impossible de contacter ticket-service.' });
    }
});

/* -------------------------------------------------------------------
   Super admin – mode manuel / auto
   ------------------------------------------------------------------- */
router.get('/super/mode', requireSuperAdmin, async (req, res) => {
    try {
        const sRes = await query("SELECT value FROM app_settings WHERE key = 'manual_validation'");
        const manual = sRes.rowCount > 0 && sRes.rows[0].value === 'true';
        res.json({ manual_validation: manual });
    } catch (err) {
        console.error('[admin-service] Erreur lecture mode:', err);
        res.status(500).json({ error: 'Erreur interne.' });
    }
});
router.post('/super/toggle-mode', requireSuperAdmin, async (req, res) => {
    const { manual_validation } = req.body;
    if (typeof manual_validation !== 'boolean') return res.status(400).json({ error: 'Valeur booléenne attendue.' });
    try {
        await query(`INSERT INTO app_settings (key, value) VALUES ('manual_validation', $1::text)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [manual_validation ? 'true' : 'false']);
        res.json({ manual_validation });
    } catch (err) {
        console.error('[admin-service] Erreur écriture mode:', err);
        res.status(500).json({ error: 'Erreur interne.' });
    }
});

/* -------------------------------------------------------------------
   New feature – état et bascule du bouton "modification du 11ᵉ chiffre"
   ------------------------------------------------------------------- */
router.get('/super/digit-mode', requireSuperAdmin, async (req, res) => {
    try {
        const result = await query(`SELECT value FROM app_settings WHERE key = 'digit_modification_enabled'`);
        const enabled = result.rowCount > 0 && result.rows[0].value === 'true';
        res.json({ digit_modification_enabled: enabled });
    } catch (err) {
        console.error('[admin-service] Erreur lecture digit_modification_enabled:', err);
        res.status(500).json({ error: 'Erreur interne' });
    }
});
router.post('/super/toggle-digit-mode', requireSuperAdmin, async (req, res) => {
    const { digit_modification_enabled } = req.body;
    if (typeof digit_modification_enabled !== 'boolean') return res.status(400).json({ error: 'Valeur booléenne attendue.' });
    try {
        await query(`INSERT INTO app_settings (key, value) VALUES ('digit_modification_enabled', $1::text)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [digit_modification_enabled ? 'true' : 'false']);
        res.json({ digit_modification_enabled });
    } catch (err) {
        console.error('[admin-service] Erreur écriture digit_modification_enabled:', err);
        res.status(500).json({ error: 'Erreur interne' });
    }
});

/* -------------------------------------------------------------------
   Export router
   ------------------------------------------------------------------- */
module.exports = router;
