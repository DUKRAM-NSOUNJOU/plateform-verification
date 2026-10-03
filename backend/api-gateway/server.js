/**
 * api-gateway/server.js
 * ─────────────────────
 * Point d'entrée UNIQUE du frontend.
 * Reçoit toutes les requêtes et les proxifie
 * vers le bon microservice.
 *
 * Routage :
 *   /api/tickets/*  → ticket-service  (port 3001)
 *   /api/admin/*    → admin-service   (port 3002)
 *   /api/health     → réponse locale
 */

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app  = express();
const PORT = process.env.PORT || 3000;

// Faire confiance au proxy Nginx pour le rate limiting
app.set('trust proxy', 1);

const TICKET_SERVICE_URL = process.env.TICKET_SERVICE_URL || 'http://localhost:3001';
const ADMIN_SERVICE_URL  = process.env.ADMIN_SERVICE_URL  || 'http://localhost:3002';

/* ── CORS ──────────────────────────────────────────────── */
const allowedOrigins = [
    'http://localhost:9000',
    'http://localhost:3000',
    'http://127.0.0.1:9000',
    'http://127.0.0.1:3000',
    'https://verificationticket.com',
    'http://verificationticket.com'
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.some(o => origin.startsWith(o) || origin.includes('localhost') || origin.includes('192.168.') || origin.startsWith('http://172.') || origin.startsWith('https://172.'))) {
            callback(null, true);
        } else {
            callback(new Error('Non autorisé par le CORS'));
        }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

/* ── Rate limiting ───────────────────────────────────── */
// Désactivé volontairement : la connexion, l'envoi de codes et le
// tableau de bord doivent rester utilisables en permanence.

/* ── Health check local ────────────────────────────────── */
app.get('/api/health', (_req, res) => {
    res.json({
        gateway: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            ticketService: TICKET_SERVICE_URL,
            adminService:  ADMIN_SERVICE_URL
        }
    });
});

/* ── Proxy → ticket-service ────────────────────────────── */
app.use('/api/tickets', createProxyMiddleware({
    target:       TICKET_SERVICE_URL,
    changeOrigin: true,
    on: {
        error: (err, _req, res) => {
            console.error('[Gateway] ticket-service unreachable:', err.message);
            res.status(503).json({ error: 'Service de tickets indisponible.' });
        }
    }
}));

/* ── Proxy → admin-service ─────────────────────────────── */
app.use('/api/admin', createProxyMiddleware({
    target:       ADMIN_SERVICE_URL,
    changeOrigin: true,
    on: {
        error: (err, _req, res) => {
            console.error('[Gateway] admin-service unreachable:', err.message);
            res.status(503).json({ error: "Service d'administration indisponible." });
        }
    }
}));

/* ── 404 fallback ──────────────────────────────────────── */
app.use((_req, res) => {
    res.status(404).json({ error: 'Route introuvable.' });
});

/* ── Démarrage ─────────────────────────────────────────── */
app.listen(PORT, () => {
    console.log(`✓ [API Gateway]     http://localhost:${PORT}`);
    console.log(`  → ticket-service: ${TICKET_SERVICE_URL}`);
    console.log(`  → admin-service:  ${ADMIN_SERVICE_URL}`);
});

module.exports = app;
