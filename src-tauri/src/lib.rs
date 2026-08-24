use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone)]
pub struct FileContext {
    pub path: String,
    pub content: String,
}

fn should_ignore(path_str: &str) -> bool {
    let lower = path_str.to_lowercase();
    lower.contains("/.git/") || lower.contains("\\.git\\")
        || lower.contains("/node_modules/") || lower.contains("\\node_modules\\")
        || lower.contains("/target/") || lower.contains("\\target\\")
        || lower.contains("/dist/") || lower.contains("\\dist\\")
        || lower.contains("/build/") || lower.contains("\\build\\")
        || lower.contains("/.next/") || lower.contains("\\.next\\")
        || lower.contains("/.venv/") || lower.contains("\\.venv\\")
        || lower.ends_with("package-lock.json")
        || lower.ends_with("cargo.lock")
        || lower.ends_with("yarn.lock")
        || lower.ends_with("pnpm-lock.yaml")
        || lower.ends_with(".lock")
        || lower.ends_with(".map")
        || lower.ends_with(".min.js")
        || lower.ends_with(".min.css")
        || lower.ends_with(".svg")
        || lower.ends_with(".png")
        || lower.ends_with(".jpg")
        || lower.ends_with(".ico")
        || lower.ends_with(".exe")
        || lower.ends_with(".wasm")
}

fn collect_files(base_path: &Path, current_path: &Path, results: &mut Vec<FileContext>, max_files: usize) {
    if results.len() >= max_files {
        return;
    }
    if let Ok(entries) = fs::read_dir(current_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            let path_str = path.to_string_lossy().to_string();

            if should_ignore(&path_str) {
                continue;
            }

            if path.is_dir() {
                collect_files(base_path, &path, results, max_files);
            } else if path.is_file() {
                if let Ok(metadata) = fs::metadata(&path) {
                    if metadata.len() > 350_000 {
                        continue; // Ignora arquivos individuais maiores que 350KB
                    }
                }
                if let Ok(content) = fs::read_to_string(&path) {
                    let rel_path = path.strip_prefix(base_path)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .to_string();
                    results.push(FileContext {
                        path: rel_path,
                        content,
                    });
                }
            }
        }
    }
}

#[tauri::command]
fn read_multiple_directories(dir_paths: Vec<String>) -> Result<Vec<FileContext>, String> {
    let mut all_files = Vec::new();
    for dir in dir_paths {
        let clean = dir.trim();
        if clean.is_empty() {
            continue;
        }
        let path = Path::new(clean);
        if path.exists() && path.is_dir() {
            collect_files(path, path, &mut all_files, 300);
        }
    }
    Ok(all_files)
}

#[tauri::command]
fn open_url(url: String) {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd").args(["/C", "start", "", &url]).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&url).spawn();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![open_url, read_multiple_directories])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}