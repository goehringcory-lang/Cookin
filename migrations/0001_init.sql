-- Generic JSON document store. One row per (collection, id).
-- v is a global sequence number used as the sync cursor.
CREATE TABLE IF NOT EXISTS docs (
  c          TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  data       TEXT,              -- JSON; NULL = deleted (tombstone)
  updated_at INTEGER NOT NULL,  -- client ms timestamp, last-writer-wins
  v          INTEGER NOT NULL,
  PRIMARY KEY (c, id)
);
CREATE INDEX IF NOT EXISTS docs_v ON docs (v);
CREATE TABLE IF NOT EXISTS seq (k TEXT PRIMARY KEY, n INTEGER NOT NULL);
INSERT OR IGNORE INTO seq (k, n) VALUES ('docs', 0);
