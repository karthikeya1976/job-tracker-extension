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
`);

module.exports = db;
