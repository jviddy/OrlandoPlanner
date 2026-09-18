CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('anonymous', 'seeded', 'owned', 'archived')),
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'unlisted')),
  payload_schema_version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  allow_anonymous_edit INTEGER NOT NULL DEFAULT 0 CHECK (allow_anonymous_edit IN (0, 1)),
  allow_duplication INTEGER NOT NULL DEFAULT 1 CHECK (allow_duplication IN (0, 1)),
  duplicated_from_trip_id TEXT REFERENCES trips(id),
  source_attribution TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX trips_status_updated ON trips(status, updated_at);
CREATE INDEX trips_expiry ON trips(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE trip_capabilities (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('view', 'edit')),
  token_hash TEXT NOT NULL UNIQUE,
  key_version INTEGER NOT NULL,
  created_by_user_id TEXT,
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX trip_capabilities_trip ON trip_capabilities(trip_id, kind, revoked_at);
CREATE INDEX trip_capabilities_expiry ON trip_capabilities(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE idempotency_records (
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  capability_key_version INTEGER NOT NULL,
  response_revision INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (scope, key_hash)
);

CREATE INDEX idempotency_records_expiry ON idempotency_records(expires_at);

CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_revision INTEGER,
  to_revision INTEGER NOT NULL,
  actor_user_id TEXT,
  actor_capability_id TEXT REFERENCES trip_capabilities(id),
  actor_display_name TEXT,
  action TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX activity_log_trip_revision ON activity_log(trip_id, to_revision);

CREATE TABLE rate_limit_buckets (
  bucket_hash TEXT NOT NULL,
  scope TEXT NOT NULL,
  requests INTEGER NOT NULL,
  window_started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (scope, bucket_hash)
);

INSERT INTO trips (
  id, status, visibility, payload_schema_version, payload_json, revision,
  allow_anonymous_edit, allow_duplication, expires_at, created_at, updated_at, deleted_at
)
SELECT
  id, 'anonymous', 'unlisted', 2, payload, revision,
  1, 1, expires_at, created_at, updated_at, deleted_at
FROM anonymous_trips;

INSERT INTO trip_capabilities (
  id, trip_id, kind, token_hash, key_version, expires_at, revoked_at, created_at
)
SELECT id || ':edit', id, 'edit', edit_token_hash, 1, expires_at, deleted_at, created_at
FROM anonymous_trips;

INSERT INTO trip_capabilities (
  id, trip_id, kind, token_hash, key_version, expires_at, revoked_at, created_at
)
SELECT id || ':view', id, 'view', view_token_hash, 1, expires_at, deleted_at, created_at
FROM anonymous_trips;

INSERT INTO idempotency_records (
  scope, key_hash, resource_id, capability_key_version, response_revision, expires_at, created_at
)
SELECT 'anonymous-trip-create', c.idempotency_hash, c.trip_id, 1, t.revision, t.expires_at, c.created_at
FROM anonymous_trip_creations c
JOIN anonymous_trips t ON t.id = c.trip_id;

INSERT INTO activity_log (trip_id, to_revision, action, created_at)
SELECT trip_id, revision, action, created_at
FROM anonymous_trip_activity;

INSERT INTO rate_limit_buckets (bucket_hash, scope, requests, window_started_at, updated_at)
SELECT bucket, 'anonymous-api', requests, substr(updated_at, 1, 13) || ':00:00.000Z', updated_at
FROM anonymous_rate_limits;
