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
const rateLimit    = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app  = express();
const PORT = process.env.PORT || 3000;

const TICKET_SERVICE_URL = process.env.TICKET_SERVICE_URL || 'http://localhost:3001';
const ADMIN_SERVICE_URL  = process.env.ADMIN_SERVICE_URL  || 'http://localhost:3002';

/* ── CORS ──────────────────────────────────────────────── */
app.use(cors({
    origin: (origin, callback) => {
        // En développement, on accepte le localhost et les adresses IP du réseau local
        if (!origin || origin.includes('localhost') || origin.includes('192.168.') || origin.includes('172.')) {
            callback(null, true);
        } else {
            callback(new Error('Non autorisé par le CORS'));
        }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

/* ── Rate limiting global ──────────────────────────────── */
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requêtes, veuillez réessayer dans 15 minutes.' }
});
app.use(limiter);

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
