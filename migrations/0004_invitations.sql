CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by_user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  accepted_by_user_id TEXT REFERENCES users(id),
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX invitations_lookup ON invitations(token_hash, accepted_at, revoked_at, expires_at);
CREATE INDEX invitations_trip ON invitations(trip_id, revoked_at);
CREATE UNIQUE INDEX invitations_active_per_email ON invitations(trip_id, email, role) WHERE accepted_at IS NULL AND revoked_at IS NULL;
