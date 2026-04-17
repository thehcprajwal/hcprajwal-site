import Database   from 'better-sqlite3';
import { join }   from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync }     from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR  = process.env.DB_DIR  || join(__dirname, '..', 'data');
const DB_PATH   = process.env.DB_PATH || join(DATA_DIR, 'hcsystem.db');

mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

export function migrate() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS analytics_events (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type   TEXT    NOT NULL,
            payload      TEXT    NOT NULL DEFAULT '{}',
            ip_hash      TEXT    NOT NULL DEFAULT '',
            country      TEXT    NOT NULL DEFAULT 'unknown',
            country_code TEXT    NOT NULL DEFAULT 'xx',
            created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_events_type
            ON analytics_events (event_type);

        CREATE INDEX IF NOT EXISTS idx_events_created
            ON analytics_events (created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_events_ip_hash
            ON analytics_events (ip_hash);

        CREATE INDEX IF NOT EXISTS idx_events_type_created
            ON analytics_events (event_type, created_at DESC);
    `);
    console.log('[db] migrations complete');
}
