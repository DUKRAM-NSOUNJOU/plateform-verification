#!/usr/bin/env node
/**
 * backend/db/migrate.js — Migration idempotente
 * ──────────────────────────────────────────────
 * Usage : node db/migrate.js   (depuis backend/)
 *
 * 1. Ajoute les colonnes manquantes sur `tickets` (si absentes)
 * 2. Publie les tickets existants (released = true) uniquement
 *    lors de la toute première exécution de la migration.
 */

const fs   = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'admin-service', '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    });
}

const adminServiceModules = path.join(__dirname, '..', 'admin-service', 'node_modules');
const { Pool } = require(path.join(adminServiceModules, 'pg'));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const TICKET_COLUMNS = [
    ['recharge',      'TEXT'],
    ['montant',       'NUMERIC'],
    ['devise',        'TEXT'],
    ['pays',          'TEXT'],
    ['released',      'BOOLEAN NOT NULL DEFAULT FALSE'],
    ['released_at',   'TIMESTAMPTZ'],
    ['original_code', 'TEXT']
];

async function columnExists(table, column) {
    const res = await pool.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, column]
    );
    return res.rowCount > 0;
}

async function main() {
    console.log('🗄️  Migration de la base de données PostgreSQL...\n');

    try {
        const added = [];

        for (const [name, definition] of TICKET_COLUMNS) {
            if (!(await columnExists('tickets', name))) {
                await pool.query(`ALTER TABLE tickets ADD COLUMN ${name} ${definition}`);
                added.push(name);
                console.log(`  + colonne tickets.${name} ajoutée`);
            }
        }

        await pool.query(
            'CREATE INDEX IF NOT EXISTS idx_tickets_released ON tickets(released)'
        );

        // Liste blanche des super admins (accès à /superadmin.html)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS super_admins (
                email      TEXT PRIMARY KEY,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await pool.query(
            `INSERT INTO super_admins (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
            [process.env.SUPER_ADMIN_EMAIL || 'dukram.nsounjou@ens-uy1.cm']
        );

        if (added.includes('released')) {
            const r = await pool.query(
                'UPDATE tickets SET released = TRUE, released_at = NOW() WHERE released = FALSE'
            );
            console.log(`  → ${r.rowCount} ticket(s) existant(s) publié(s) dans la section admin`);
        } else {
            console.log('  → colonne `released` déjà présente, aucun ticket existant modifié');
        }

        console.log('\n✅ Migration terminée.\n');
    } catch (err) {
        console.error('❌ Erreur de migration:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
