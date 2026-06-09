use rusqlite::{params, Connection};
use std::sync::Mutex;

use super::schema::{
    EventQueryOptions, KitConfigData, KitEventEntry, KitSchemaData, KitStateData, SCHEMA_SQL,
};

// ─── BridgeStorage ─────────────────────────────────────────────────

pub struct BridgeStorage {
    conn: Mutex<Connection>,
}

impl BridgeStorage {
    /// Create a new BridgeStorage at the given file path.
    /// Initializes WAL mode and creates tables if they don't exist.
    pub fn new(db_path: &str) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        conn.execute_batch(SCHEMA_SQL)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    // ── Kit lifecycle ──────────────────────────────────────────

    pub fn kit_register(&self, schema: &KitSchemaData) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = chrono_now_ms();
        conn.execute(
            "INSERT OR REPLACE INTO kit_schemas
             (kit_key, display_name, description, version, state_keys, event_types, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                schema.kit_key,
                schema.display_name,
                schema.description,
                schema.version,
                serde_json::to_string(&schema.state_keys).unwrap_or_default(),
                serde_json::to_string(&schema.event_types).unwrap_or_default(),
                now,
                now,
            ],
        )?;
        Ok(())
    }

    pub fn kit_unregister(&self, kit_key: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM kit_state WHERE kit_key = ?1", params![kit_key])?;
        conn.execute("DELETE FROM kit_events WHERE kit_key = ?1", params![kit_key])?;
        conn.execute("DELETE FROM kit_config WHERE kit_key = ?1", params![kit_key])?;
        conn.execute("DELETE FROM kit_schemas WHERE kit_key = ?1", params![kit_key])?;
        Ok(())
    }

    // ── State ──────────────────────────────────────────────────

    pub fn push_state(
        &self,
        kit_key: &str,
        instance_id: &str,
        state: &serde_json::Value,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = chrono_now_ms();
        let state_json = serde_json::to_string(state).unwrap_or_default();
        conn.execute(
            "INSERT INTO kit_state (kit_key, instance_id, state, updated_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (kit_key, instance_id)
             DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at",
            params![kit_key, instance_id, state_json, now],
        )?;
        Ok(())
    }

    pub fn get_state(
        &self,
        kit_key: &str,
        instance_id: Option<&str>,
    ) -> Result<Option<KitStateData>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let id = instance_id.unwrap_or("default");
        let mut stmt = conn.prepare(
            "SELECT kit_key, instance_id, state, updated_at
             FROM kit_state WHERE kit_key = ?1 AND instance_id = ?2",
        )?;
        let mut rows = stmt.query_map(params![kit_key, id], |row| {
            Ok(KitStateData {
                kit_key: row.get(0)?,
                instance_id: row.get(1)?,
                state: serde_json::from_str(&row.get::<_, String>(2)?)
                    .unwrap_or(serde_json::Value::Null),
                updated_at: row.get(3)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn get_all_states(&self) -> Result<Vec<KitStateData>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT kit_key, instance_id, state, updated_at FROM kit_state",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(KitStateData {
                kit_key: row.get(0)?,
                instance_id: row.get(1)?,
                state: serde_json::from_str(&row.get::<_, String>(2)?)
                    .unwrap_or(serde_json::Value::Null),
                updated_at: row.get(3)?,
            })
        })?;
        rows.collect()
    }

    // ── Events ─────────────────────────────────────────────────

    pub fn append_event(
        &self,
        kit_key: &str,
        instance_id: &str,
        event_type: &str,
        payload: &serde_json::Value,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = chrono_now_ms();
        let payload_json = serde_json::to_string(payload).unwrap_or_default();
        conn.execute(
            "INSERT INTO kit_events (kit_key, instance_id, type, ts, payload)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![kit_key, instance_id, event_type, now, payload_json],
        )?;
        Ok(())
    }

    pub fn get_events(
        &self,
        kit_key: &str,
        opts: &EventQueryOptions,
    ) -> Result<Vec<KitEventEntry>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let limit = opts.limit.unwrap_or(100);
        let since = opts.since.unwrap_or(0);

        let (sql, result) = if let Some(ref event_type) = opts.event_type {
            let mut stmt = conn.prepare(
                "SELECT id, kit_key, instance_id, type, ts, payload
                 FROM kit_events
                 WHERE kit_key = ?1 AND type = ?2 AND ts >= ?3
                 ORDER BY id DESC LIMIT ?4",
            )?;
            let rows: Vec<KitEventEntry> = stmt
                .query_map(params![kit_key, event_type, since, limit], |row| {
                    Ok(KitEventEntry {
                        id: row.get(0)?,
                        kit_key: row.get(1)?,
                        instance_id: row.get(2)?,
                        event_type: row.get(3)?,
                        ts: row.get(4)?,
                        payload: serde_json::from_str(&row.get::<_, String>(5)?)
                            .unwrap_or(serde_json::Value::Null),
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            ("typed", rows)
        } else {
            let mut stmt = conn.prepare(
                "SELECT id, kit_key, instance_id, type, ts, payload
                 FROM kit_events
                 WHERE kit_key = ?1 AND ts >= ?2
                 ORDER BY id DESC LIMIT ?3",
            )?;
            let rows: Vec<KitEventEntry> = stmt
                .query_map(params![kit_key, since, limit], |row| {
                    Ok(KitEventEntry {
                        id: row.get(0)?,
                        kit_key: row.get(1)?,
                        instance_id: row.get(2)?,
                        event_type: row.get(3)?,
                        ts: row.get(4)?,
                        payload: serde_json::from_str(&row.get::<_, String>(5)?)
                            .unwrap_or(serde_json::Value::Null),
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            ("all", rows)
        };

        let _ = sql; // suppress unused variable warning
        Ok(result)
    }

    // ── Config ─────────────────────────────────────────────────

    pub fn push_config(
        &self,
        kit_key: &str,
        config: &serde_json::Value,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = chrono_now_ms();
        let config_json = serde_json::to_string(config).unwrap_or_default();
        conn.execute(
            "INSERT INTO kit_config (kit_key, config, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT (kit_key)
             DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at",
            params![kit_key, config_json, now],
        )?;
        Ok(())
    }

    pub fn get_config(&self, kit_key: &str) -> Result<Option<KitConfigData>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT kit_key, config, updated_at FROM kit_config WHERE kit_key = ?1",
        )?;
        let mut rows = stmt.query_map(params![kit_key], |row| {
            Ok(KitConfigData {
                kit_key: row.get(0)?,
                config: serde_json::from_str(&row.get::<_, String>(1)?)
                    .unwrap_or(serde_json::Value::Null),
                updated_at: row.get(2)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }
}

// ─── Helpers ───────────────────────────────────────────────────────

/// Current time in epoch milliseconds.
/// Uses std::time::SystemTime to avoid adding a chrono dependency.
fn chrono_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
