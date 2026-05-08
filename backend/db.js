const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'ratings.db'));

// Run once on startup — creates tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id  TEXT NOT NULL,
    applied_at  INTEGER NOT NULL,
    responded_at INTEGER,
    outcome     TEXT CHECK(outcome IN ('rejected','interview','offer','ghosted','pending')),
    days_to_response INTEGER,
    created_at  INTEGER DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_events_company ON events(company_id);

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    name          TEXT NOT NULL,
    avatar_url    TEXT,
    bio           TEXT,
    location      TEXT,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    last_seen  INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS password_resets (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS applications (
    id         TEXT NOT NULL,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company    TEXT NOT NULL,
    role       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'applied',
    url        TEXT,
    applied_at TEXT NOT NULL,
    updated_at TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
`);

module.exports = db;
