/**
 * ticket-service/server.js
 * ────────────────────────
 * Microservice indépendant — port 3001
 * Responsabilité : recevoir et stocker les tickets
 * soumis par les utilisateurs via le formulaire.
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const ticketsRouter = require('./routes/tickets');

const app  = express();
const PORT = process.env.PORT || 3001;

/* ── Middleware ────────────────────────────────────────── */
// Seul le gateway peut appeler ce service (en prod)
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

/* ── Routes ────────────────────────────────────────────── */
app.use('/api/tickets', ticketsRouter);

/* ── Health check ──────────────────────────────────────── */
app.get('/health', (_req, res) => {
    res.json({ service: 'ticket-service', status: 'ok', timestamp: new Date().toISOString() });
});

/* ── 404 ───────────────────────────────────────────────── */
app.use((_req, res) => {
    res.status(404).json({ error: 'Route introuvable dans ticket-service.' });
});

/* ── Démarrage ─────────────────────────────────────────── */
app.listen(PORT, () => {
    console.log(`✓ [ticket-service]  http://localhost:${PORT}`);
});

module.exports = app;
