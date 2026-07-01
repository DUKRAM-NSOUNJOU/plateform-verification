/**
 * db/pool.js — Connexion partagée PostgreSQL (pg Pool)
 * Utilisé par ticket-service et admin-service.
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
    console.error('[DB] Erreur inattendue sur le pool:', err.message);
});

/**
 * Helper : exécuter une requête SQL paramétrée
 * @param {string} text  - requête SQL
 * @param {Array}  params - paramètres
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.DB_DEBUG === 'true') {
            console.log(`[DB] query(${duration}ms): ${text.substring(0, 80).replace(/\n/g, ' ')}`);
        }
        return result;
    } catch (err) {
        console.error('[DB] Erreur SQL:', err.message, '→', text.substring(0, 120));
        throw err;
    }
}

module.exports = { pool, query };
