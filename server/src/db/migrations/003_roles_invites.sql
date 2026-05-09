-- server/src/db/migrations/003_roles_invites.sql

-- 1. Ampliar el CHECK constraint de server_members para incluir 'moderator'
ALTER TABLE server_members DROP CONSTRAINT role_check;
ALTER TABLE server_members ADD CONSTRAINT role_check
  CHECK (role IN ('owner', 'moderator', 'member'));

-- 2. Tabla de invitaciones temporales
CREATE TABLE IF NOT EXISTS invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(12) UNIQUE NOT NULL,
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  creator_id  UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ,
  max_uses    INT,
  use_count   INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_server ON invites(server_id);
