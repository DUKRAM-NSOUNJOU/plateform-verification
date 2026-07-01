/**
 * admin-service/server.js
 * ───────────────────────
 * Microservice indépendant — port 3002
 * Responsabilité : tableau de bord admin.
 * Communique avec ticket-service via HTTP
 * pour lire et mettre à jour les tickets.
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const adminRouter = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3002;

/* ── Middleware ────────────────────────────────────────── */
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

/* ── Routes ────────────────────────────────────────────── */
app.use('/api/admin', adminRouter);

/* ── Health check ──────────────────────────────────────── */
app.get('/health', (_req, res) => {
    res.json({ service: 'admin-service', status: 'ok', timestamp: new Date().toISOString() });
});

/* ── 404 ───────────────────────────────────────────────── */
app.use((_req, res) => {
    res.status(404).json({ error: 'Route introuvable dans admin-service.' });
});

/* ── Démarrage ─────────────────────────────────────────── */
app.listen(PORT, () => {
    console.log(`✓ [admin-service]   http://localhost:${PORT}`);
    console.log(`  → ticket-service: ${process.env.TICKET_SERVICE_URL || 'http://localhost:3001'}`);
});

module.exports = app;
