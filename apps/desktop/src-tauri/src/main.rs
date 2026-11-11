// Prevents an additional console window on Windows in release. DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Single source of truth for the app entrypoint lives in lib.rs (which also
// serves the mobile entry point). main.rs just delegates — no duplicated
// Builder, command, or setup logic.
fn main() {
    kroex_desktop_lib::run();
}
