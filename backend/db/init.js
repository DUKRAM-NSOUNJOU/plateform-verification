#!/usr/bin/env node
/**
 * backend/db/init.js — Initialisation de la base de données
 * ──────────────────────────────────────────────────────────
 * Usage : node db/init.js   (depuis backend/admin-service/)
 *
 * Ce script :
 *   1. Applique le schéma SQL (schema.sql)
 *   2. Crée le compte admin par défaut avec le bon hash bcrypt
 */

// Chargement manuel du .env (sans dépendance externe)
const fs   = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'admin-service', '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    });
}

// Utiliser les node_modules de admin-service
const adminServiceModules = path.join(__dirname, '..', 'admin-service', 'node_modules');
const { Pool } = require(path.join(adminServiceModules, 'pg'));
const bcrypt   = require(path.join(adminServiceModules, 'bcryptjs'));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function main() {
    console.log('🗄️  Initialisation de la base de données PostgreSQL...\n');

    try {
        // 1. Appliquer le schéma
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema     = fs.readFileSync(schemaPath, 'utf8');
        
        // On retire la ligne de seed initiale (le hash pré-calculé) pour la remplacer
        const schemaWithoutSeed = schema.replace(
            /-- ── Seed.*?ON CONFLICT \(email\) DO NOTHING;/s,
            '-- Seed géré par init.js'
        );
        
        await pool.query(schemaWithoutSeed);
        console.log('✅ Schéma appliqué avec succès.');

        // 2. Créer l'admin par défaut
        const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@plate-verification.fr';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2024';
        const adminNom      = process.env.ADMIN_NOM      || 'Super Admin';

        const hash = await bcrypt.hash(adminPassword, 10);

        await pool.query(
            `INSERT INTO admins (email, password, nom, role)
             VALUES ($1, $2, $3, 'superadmin')
             ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password`,
            [adminEmail, hash, adminNom]
        );

        console.log(`✅ Compte admin créé/mis à jour :`);
        console.log(`   📧 Email    : ${adminEmail}`);
        console.log(`   🔐 Password : ${adminPassword}`);
        console.log(`   👤 Rôle     : superadmin\n`);

        console.log('🎉 Base de données prête ! Vous pouvez démarrer les services.\n');
        console.log('   → npm run dev  (dans backend/)');

    } catch (err) {
        console.error('❌ Erreur lors de l\'initialisation:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
