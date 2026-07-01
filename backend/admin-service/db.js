/**
 * admin-service/db.js — Connexion PostgreSQL locale
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
    console.error('[admin-service DB] Erreur pool:', err.message);
});

async function query(text, params) {
    try {
        const result = await pool.query(text, params);
        return result;
    } catch (err) {
        console.error('[admin-service DB] Erreur SQL:', err.message);
        throw err;
    }
}

module.exports = { pool, query };
