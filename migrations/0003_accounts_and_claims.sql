CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  global_role TEXT NOT NULL DEFAULT 'user' CHECK (global_role IN ('user', 'agent', 'admin')),
  email_verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (provider, provider_subject)
);

CREATE INDEX auth_identities_user ON auth_identities(user_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX sessions_user_active ON sessions(user_id, revoked_at, expires_at);

CREATE TABLE auth_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('magic_link')),
  token_hash TEXT NOT NULL UNIQUE,
  redirect_path TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_by_user_id TEXT REFERENCES users(id),
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX auth_tokens_lookup ON auth_tokens(token_hash, purpose, used_at, expires_at);
CREATE INDEX auth_tokens_expiry ON auth_tokens(expires_at);

CREATE TABLE trip_memberships (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'agent', 'editor', 'viewer')),
  invited_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE UNIQUE INDEX trip_memberships_active_user
  ON trip_memberships(trip_id, user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX trip_memberships_active_owner
  ON trip_memberships(trip_id) WHERE role = 'owner' AND revoked_at IS NULL;
CREATE INDEX trip_memberships_user ON trip_memberships(user_id, revoked_at);

CREATE TABLE claim_tokens (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_by_user_id TEXT REFERENCES users(id),
  used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX claim_tokens_lookup ON claim_tokens(token_hash, used_at, revoked_at, expires_at);
CREATE INDEX claim_tokens_trip ON claim_tokens(trip_id, revoked_at);
