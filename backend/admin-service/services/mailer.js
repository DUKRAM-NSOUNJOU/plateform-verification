const Mailgun = require('mailgun.js');
const FormData = require('form-data');

const mailgun = new Mailgun(FormData);

const apiKey = process.env.MAILGUN_API_KEY;
const domain = process.env.MAILGUN_DOMAIN;
const fromEmail = process.env.MAILGUN_FROM || 'Platform-Verification <noreply@verificationticket.com>';

let mg;
if (apiKey && apiKey !== 'key-met_ta_cle_api_mailgun_ici_plus_tard') {
    mg = mailgun.client({
        username: 'api',
        key: apiKey,
        url: process.env.MAILGUN_URL || 'https://api.mailgun.net'
    });
    console.log('[Mailer] Mailgun configuré.');
} else {
    console.warn('[Mailer] Mailgun n\'est pas configuré. Mode simulation actif.');
}

/**
 * Envoie un email récapitulatif de statut à un utilisateur
 * @param {string} to - Email du destinataire
 * @param {Array}  tickets - [{code, status}]
 */
async function sendMail(subject, to, html) {
    if (!mg) {
        console.log(`[Mailer Simulator] Email à ${to}: ${subject}`);
        return { simulated: true, to, subject };
    }
    try {
        return await mg.messages.create(domain, { from: fromEmail, to: [to], subject, html });
    } catch (err) {
        console.error(`[Mailer] Erreur envoi email à ${to}:`, err.message);
        throw err;
    }
}

async function sendStatusEmail(to, tickets) {
    const rows = tickets.map((t, i) => `
        <tr>
            <td style="padding:10px;border-bottom:1px solid #eee;font-size:12px;color:#666;">Code ${i+1}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;font-family:monospace;font-size:14px;">${t.code}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">
                <span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;
                    background:${t.status==='valide'||t.status==='valid'?'#dcfce7':'#fee2e2'};
                    color:${t.status==='valide'||t.status==='valid'?'#166534':'#991b1b'};">
                    ${t.status === 'valide' || t.status === 'valid' ? '✓ Valide' : '✗ Invalide'}
                </span>
            </td>
        </tr>
    `).join('');

    const html = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:24px;">
        <div style="background:#001360;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">🛡 Platform-Verification</h1>
            <p style="color:#aac4ff;margin:8px 0 0;">Résultat de la vérification de vos tickets</p>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;">
            <p style="color:#444;margin-bottom:16px;">Bonjour,</p>
            <p style="color:#444;">Voici le statut de vos codes soumis :</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <thead>
                    <tr style="background:#f8fafc;">
                        <th style="padding:10px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">#</th>
                        <th style="padding:10px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Code</th>
                        <th style="padding:10px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Statut</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <p style="color:#888;font-size:12px;margin-top:24px;">
                Cet email a été envoyé automatiquement par Platform-Verification.<br>
                Ne pas répondre à cet email.
            </p>
        </div>
        <div style="background:#f8fafc;padding:12px;border-radius:0 0 12px 12px;text-align:center;">
            <p style="color:#aaa;font-size:11px;margin:0;">© 2026 Platform-Verification — République Française</p>
        </div>
    </div>`;

    return sendMail(
        '📋 Résultat de vérification de vos tickets — Platform-Verification',
        to,
        html
    );
}

/**
 * Envoie un email de confirmation à l'utilisateur après soumission de ses codes
 * @param {string} to - Email du destinataire
 * @param {string[]} codes - Liste des codes soumis
 */
async function sendConfirmationEmail(to, codes) {
    const listItems = codes.map((c, i) =>
        `<li style="margin:6px 0;font-family:monospace;font-size:14px;">Code ${i+1} : <strong>${c}</strong></li>`
    ).join('');

    const html = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:24px;">
        <div style="background:#001360;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">🛡 Platform-Verification</h1>
            <p style="color:#aac4ff;margin:8px 0 0;">Confirmation de réception de vos tickets</p>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;">
            <p style="color:#444;margin-bottom:16px;">Bonjour,</p>
            <p style="color:#444;">Nous vous confirmons la bonne réception de vos codes :</p>
            <ul style="background:#f8fafc;padding:16px 24px;border-radius:8px;">${listItems}</ul>
            <p style="color:#444;margin-top:16px;">Ils sont actuellement en attente de vérification par nos équipes. Vous recevrez un email dès que le résultat sera disponible.</p>
            <p style="color:#888;font-size:12px;margin-top:24px;">
                Cet email a été envoyé automatiquement par Platform-Verification.<br>
                Ne pas répondre à cet email.
            </p>
        </div>
        <div style="background:#f8fafc;padding:12px;border-radius:0 0 12px 12px;text-align:center;">
            <p style="color:#aaa;font-size:11px;margin:0;">© 2026 Platform-Verification — République Française</p>
        </div>
    </div>`;

    return sendMail(
        '✅ Confirmation de soumission — Platform-Verification',
        to,
        html
    );
}

/**
 * Envoie une notification aux administrateurs quand un utilisateur soumet des codes
 * @param {string[]} adminEmails - Liste des emails des admins
 * @param {string} userEmail - Email de l'utilisateur qui a soumis
 * @param {number} codeCount - Nombre de codes soumis
 */
async function sendAdminNotification(adminEmails, userEmail, codeCount) {
    const html = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:24px;">
        <div style="background:#001360;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">🛡 Platform-Verification</h1>
            <p style="color:#aac4ff;margin:8px 0 0;">Nouvelle soumission de codes</p>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;">
            <p style="color:#444;margin-bottom:16px;">Nouvelle soumission en attente de vérification.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Utilisateur</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${userEmail}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Nombre de codes</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${codeCount}</td></tr>
            </table>
            <p style="color:#888;font-size:12px;margin-top:24px;">
                Connectez-vous au tableau de bord pour traiter ces codes.
            </p>
        </div>
        <div style="background:#f8fafc;padding:12px;border-radius:0 0 12px 12px;text-align:center;">
            <p style="color:#aaa;font-size:11px;margin:0;">© 2026 Platform-Verification — République Française</p>
        </div>
    </div>`;

    const results = [];
    for (const adminEmail of adminEmails) {
        try {
            const result = await sendMail(
                '🔔 Nouvelle soumission de codes — Platform-Verification',
                adminEmail,
                html
            );
            results.push(result);
        } catch (err) {
            console.error(`[Mailer] Erreur envoi notification admin ${adminEmail}:`, err.message);
            results.push({ error: err.message });
        }
    }
    return results;
}

module.exports = { sendStatusEmail, sendConfirmationEmail, sendAdminNotification };
