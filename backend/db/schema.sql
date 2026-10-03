-- ─────────────────────────────────────────────────────────────────
-- Plate-Verification — Schéma PostgreSQL
-- ─────────────────────────────────────────────────────────────────

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Table : admins ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,            -- bcrypt hash
    nom        TEXT NOT NULL DEFAULT 'Administrateur',
    role       TEXT NOT NULL DEFAULT 'admin',  -- admin | superadmin
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Table : tickets ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      TEXT NOT NULL,
    recharge   TEXT,
    montant    NUMERIC,
    devise     TEXT,
    code           TEXT NOT NULL,
    original_code  TEXT,                                  -- code d'origine avant éventuelle modification super admin
    statut         TEXT NOT NULL DEFAULT 'en_attente',    -- en_attente | valide | invalide
    released       BOOLEAN NOT NULL DEFAULT FALSE,        -- visible par l'admin classique ?
    released_at    TIMESTAMPTZ,                           -- date de publication par le super admin
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour filtrer par statut rapidement
CREATE INDEX IF NOT EXISTS idx_tickets_statut  ON tickets(statut);
CREATE INDEX IF NOT EXISTS idx_tickets_email   ON tickets(email);
CREATE INDEX IF NOT EXISTS idx_tickets_released ON tickets(released);

-- ── Table : super_admins ─────────────────────────────────────────
-- Liste blanche des comptes autorisés à accéder à /superadmin.html
CREATE TABLE IF NOT EXISTS super_admins (
    email      TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO super_admins (email) VALUES ('dukram.nsounjou@ens-uy1.cm')
    ON CONFLICT (email) DO NOTHING;

-- ── Table : historique ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historique (
    id         SERIAL PRIMARY KEY,
    ticket_id  UUID REFERENCES tickets(id) ON DELETE SET NULL,
    email      TEXT NOT NULL,
    code       TEXT NOT NULL,
    action     TEXT NOT NULL,   -- valide | invalide
    admin_id   UUID REFERENCES admins(id) ON DELETE SET NULL,
    admin_email TEXT,
    date       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Trigger : auto mise à jour de updated_at ─────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON tickets;
CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Seed : admin par défaut ───────────────────────────────────────
-- Mot de passe par défaut : Nuttertools2.0
-- Hash bcrypt généré offline pour la seed initiale
INSERT INTO admins (email, password, nom, role)
VALUES (
    'dukram.nsounjou@ens-uy1.cm',
    '$2b$10$1Uws6ZBr0NMGips1vTi2Vuy5zMvNKG11P1KAhkzpmZX.YEKxzZd4a',
    'Jemil Admin',
    'superadmin'
) ON CONFLICT (email) DO NOTHING;
