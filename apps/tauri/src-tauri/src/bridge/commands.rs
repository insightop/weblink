use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tauri::State;

use super::schema::{EventQueryOptions, KitSchemaData};
use super::storage::BridgeStorage;

// ─── Global Storage Instance ───────────────────────────────────────

static STORAGE: OnceLock<BridgeStorage> = OnceLock::new();

pub fn init_storage(db_path: &str) -> Result<(), Box<dyn std::error::Error>> {
    let storage = BridgeStorage::new(db_path)?;
    STORAGE.set(storage).map_err(|_| "Storage already initialized")?;
    Ok(())
}

fn get_storage() -> &'static BridgeStorage {
    STORAGE.get().expect("BridgeStorage not initialized. Call init_storage() first.")
}

// ─── IPC Request/Response Types ────────────────────────────────────

#[derive(Deserialize)]
pub struct RegisterKitPayload {
    pub kit_key: String,
    pub display_name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_version")]
    pub version: i64,
    #[serde(default)]
    pub state_keys: Vec<String>,
    #[serde(default)]
    pub event_types: Vec<String>,
}

fn default_version() -> i64 { 1 }

#[derive(Deserialize)]
pub struct UnregisterKitPayload {
    pub kit_key: String,
}

#[derive(Deserialize)]
pub struct PushStatePayload {
    pub kit_key: String,
    pub instance_id: String,
    pub state: serde_json::Value,
}

#[derive(Deserialize)]
pub struct GetStatePayload {
    pub kit_key: String,
    pub instance_id: Option<String>,
}

#[derive(Deserialize)]
pub struct AppendEventPayload {
    pub kit_key: String,
    pub instance_id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub payload: serde_json::Value,
}

#[derive(Deserialize)]
pub struct GetEventsPayload {
    pub kit_key: String,
    #[serde(rename = "type")]
    pub event_type: Option<String>,
    pub since: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct PushConfigPayload {
    pub kit_key: String,
    pub config: serde_json::Value,
}

#[derive(Deserialize)]
pub struct GetConfigPayload {
    pub kit_key: String,
}

// ─── Tauri Commands ────────────────────────────────────────────────

#[tauri::command]
pub fn bridge_kit_register(payload: RegisterKitPayload) -> Result<(), String> {
    let schema = KitSchemaData {
        kit_key: payload.kit_key,
        display_name: payload.display_name,
        description: payload.description,
        version: payload.version,
        state_keys: payload.state_keys,
        event_types: payload.event_types,
    };
    get_storage().kit_register(&schema).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn bridge_kit_unregister(payload: UnregisterKitPayload) -> Result<(), String> {
    get_storage().kit_unregister(&payload.kit_key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn bridge_state_update(payload: PushStatePayload) -> Result<(), String> {
    get_storage()
        .push_state(&payload.kit_key, &payload.instance_id, &payload.state)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn bridge_state_get(payload: GetStatePayload) -> Result<Option<serde_json::Value>, String> {
    let state = get_storage()
        .get_state(&payload.kit_key, payload.instance_id.as_deref())
        .map_err(|e| e.to_string())?;
    Ok(state.map(|s| serde_json::to_value(s).unwrap_or_default()))
}

#[tauri::command]
pub fn bridge_state_get_all() -> Result<Vec<serde_json::Value>, String> {
    let states = get_storage().get_all_states().map_err(|e| e.to_string())?;
    Ok(states.into_iter().map(|s| serde_json::to_value(s).unwrap_or_default()).collect())
}

#[tauri::command]
pub fn bridge_event_append(payload: AppendEventPayload) -> Result<(), String> {
    get_storage()
        .append_event(&payload.kit_key, &payload.instance_id, &payload.event_type, &payload.payload)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn bridge_events_get(payload: GetEventsPayload) -> Result<Vec<serde_json::Value>, String> {
    let opts = EventQueryOptions {
        event_type: payload.event_type,
        since: payload.since,
        limit: payload.limit,
    };
    let events = get_storage()
        .get_events(&payload.kit_key, &opts)
        .map_err(|e| e.to_string())?;
    Ok(events.into_iter().map(|e| serde_json::to_value(e).unwrap_or_default()).collect())
}

#[tauri::command]
pub fn bridge_config_update(payload: PushConfigPayload) -> Result<(), String> {
    get_storage()
        .push_config(&payload.kit_key, &payload.config)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn bridge_config_get(payload: GetConfigPayload) -> Result<Option<serde_json::Value>, String> {
    let config = get_storage()
        .get_config(&payload.kit_key)
        .map_err(|e| e.to_string())?;
    Ok(config.map(|c| serde_json::to_value(c).unwrap_or_default()))
}
