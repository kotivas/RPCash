// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs;

#[tauri::command]
fn save_goals(json: String) -> Result<(), String> {
    fs::write("goals.json", json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_goals() -> Result<String, String> {
    fs::read_to_string("goals.json").map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![save_goals, load_goals])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
