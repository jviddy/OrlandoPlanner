CREATE TABLE anonymous_trips (
  id TEXT PRIMARY KEY,
  edit_token_hash TEXT NOT NULL,
  view_token_hash TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE anonymous_trip_creations (
  idempotency_hash TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES anonymous_trips(id),
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE anonymous_trip_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES anonymous_trips(id),
  revision INTEGER NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX anonymous_trip_activity_trip ON anonymous_trip_activity(trip_id, revision);
