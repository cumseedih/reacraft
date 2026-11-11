use std::process::Child;
use std::sync::Mutex;
use tauri::Manager;

#[cfg(not(debug_assertions))]
use std::net::{TcpListener, TcpStream};
#[cfg(not(debug_assertions))]
use std::process::Command;
#[cfg(not(debug_assertions))]
use std::time::Duration;

/// Holds the spawned Next.js standalone server so it can be killed on exit.
struct SidecarServer(Mutex<Option<Child>>);

#[cfg(not(debug_assertions))]
fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
        .unwrap_or(31820)
}

/// Returns true once something accepts TCP connections on the port.
#[cfg(not(debug_assertions))]
fn wait_for_port(port: u16, tries: u32) -> bool {
    for _ in 0..tries {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(SidecarServer(Mutex::new(None)))
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                // Dev: Tauri loads devUrl (the Next dev server); just open devtools.
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            // Production: spawn the bundled Next standalone server as a sidecar
            // and navigate the window to it once it is accepting connections.
            // (Requires a Node.js runtime on the host; bundling a Node runtime
            // is a documented follow-up.)
            #[cfg(not(debug_assertions))]
            {
                if let Ok(server_js) = app
                    .path()
                    .resource_dir()
                    .map(|d| d.join("kroex-server/apps/web/server.js"))
                {
                    let cwd = server_js.parent().map(|p| p.to_path_buf());
                    let port = free_port();
                    let backend = std::env::var("BACKEND_URL")
                        .unwrap_or_else(|_| "http://127.0.0.1:8000".to_string());

                    let mut cmd = Command::new("node");
                    cmd.arg(&server_js)
                        .env("PORT", port.to_string())
                        .env("HOSTNAME", "127.0.0.1")
                        .env("BACKEND_URL", backend);
                    if let Some(dir) = cwd {
                        cmd.current_dir(dir);
                    }

                    match cmd.spawn() {
                        Ok(child) => {
                            app.state::<SidecarServer>().0.lock().unwrap().replace(child);
                            let handle = app.handle().clone();
                            std::thread::spawn(move || {
                                if wait_for_port(port, 150) {
                                    if let (Some(window), Ok(url)) = (
                                        handle.get_webview_window("main"),
                                        tauri::Url::parse(&format!("http://127.0.0.1:{port}")),
                                    ) {
                                        let _ = window.navigate(url);
                                    }
                                } else {
                                    eprintln!("KROEX: embedded server did not start on port {port}");
                                }
                            });
                        }
                        Err(e) => eprintln!("KROEX: failed to start embedded server: {e}"),
                    }
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building KROEX desktop app")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(mut child) =
                    app_handle.state::<SidecarServer>().0.lock().unwrap().take()
                {
                    let _ = child.kill();
                }
            }
        });
}
