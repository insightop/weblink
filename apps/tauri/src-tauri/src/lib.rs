mod bridge;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // option_env! evaluates at compile time. If SENTRY_DSN is unset, the SDK
    // silently disables itself (no warning, no errors). This is idiomatic for
    // sentry-rust: set SENTRY_DSN only in production builds.
    let _guard = sentry::init((
        option_env!("SENTRY_DSN").unwrap_or(""),
        sentry::ClientOptions {
            release: sentry::release_name!(),
            traces_sample_rate: 1.0,
            ..Default::default()
        },
    ));

    tauri::Builder::default()
        .setup(|app| {
            // Initialize bridge storage in app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();
            let db_path = app_data_dir.join("weblink.db");
            let db_path_str = db_path.to_string_lossy().to_string();

            if let Err(e) = bridge::init_storage(&db_path_str) {
                eprintln!("[bridge] Failed to initialize storage: {}", e);
            } else {
                println!("[bridge] Storage initialized: {}", db_path_str);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bridge::bridge_kit_register,
            bridge::bridge_kit_unregister,
            bridge::bridge_state_update,
            bridge::bridge_state_get,
            bridge::bridge_state_get_all,
            bridge::bridge_event_append,
            bridge::bridge_events_get,
            bridge::bridge_config_update,
            bridge::bridge_config_get,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
