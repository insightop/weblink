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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
