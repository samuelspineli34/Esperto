use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::time::Duration;

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
                        continue;
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

// 🔥 NOVO: Inicia o Ollama em segundo plano 100% INVISÍVEL (sem abrir janela preta do CMD)
#[tauri::command]
fn start_ollama_service() -> Result<String, String> {
    let addr = "127.0.0.1:11434";
    let socket_addr = addr.parse().map_err(|e| format!("Endereço local inválido: {}", e))?;

    // 1. Testa se o Ollama já está rodando
    if TcpStream::connect_timeout(&socket_addr, Duration::from_millis(400)).is_ok() {
        return Ok("Ollama já está ativo em segundo plano.".to_string());
    }

    // 2. Se estiver fechado, inicia o executável silenciosamente
    let mut cmd = std::process::Command::new("ollama");
    cmd.arg("serve");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000; // Flag que esconde a janela do CMD
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn().map_err(|e| format!("Falha ao disparar o executável do Ollama: {}", e))?;

    // 3. Aguarda até 4 segundos para o servidor responder na porta
    for _ in 0..8 {
        std::thread::sleep(Duration::from_millis(500));
        if TcpStream::connect_timeout(&socket_addr, Duration::from_millis(400)).is_ok() {
            return Ok("Ollama iniciado com sucesso em segundo plano!".to_string());
        }
    }

    Err("O comando de iniciar o Ollama foi disparado, mas o servidor demorou para responder.".to_string())
}

#[tauri::command]
fn fetch_ollama_tags() -> Result<String, String> {
    let addr = "127.0.0.1:11434";
    let socket_addr = addr.parse().map_err(|e| format!("Endereço local inválido: {}", e))?;

    let mut stream = TcpStream::connect_timeout(&socket_addr, Duration::from_millis(2500))
        .map_err(|e| format!("Não foi possível conectar ao Ollama em {}: {}", addr, e))?;

    stream.set_read_timeout(Some(Duration::from_millis(4000))).map_err(|e| e.to_string())?;

    let request = format!("GET /api/tags HTTP/1.1\r\nHost: {}\r\nConnection: close\r\nAccept: application/json\r\n\r\n", addr);
    stream.write_all(request.as_bytes()).map_err(|e| format!("Erro ao enviar requisição ao Ollama: {}", e))?;

    let mut response = Vec::new();
    stream.read_to_end(&mut response).map_err(|e| format!("Erro ao receber resposta do Ollama: {}", e))?;

    let response_str = String::from_utf8_lossy(&response);
    if let Some(idx) = response_str.find("\r\n\r\n") {
        let body = &response_str[idx + 4..];
        Ok(body.to_string())
    } else {
        Err("Resposta inválida do serviço Ollama".to_string())
    }
}

#[tauri::command]
fn select_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.FolderBrowserDialog
        $f.Description = "Selecione a pasta do projeto para o Esperto"
        $f.ShowNewFolderButton = $true
        if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            Write-Output $f.SelectedPath
        }
        "#;
        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", script])
            .output()
            .map_err(|e| e.to_string())?;
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            Ok(None)
        } else {
            Ok(Some(path))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<String, String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Erro ao criar diretórios: {}", e))?;
        }
    }
    fs::write(p, content).map_err(|e| format!("Erro ao gravar arquivo {}: {}", path, e))?;
    Ok(format!("Arquivo salvo com sucesso em: {}", path))
}

#[tauri::command]
fn execute_terminal_command(command: String, cwd: Option<String>) -> Result<String, String> {
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = std::process::Command::new("cmd");
        c.args(["/C", &command]);
        c
    } else {
        let mut c = std::process::Command::new("sh");
        c.args(["-c", &command]);
        c
    };

    if let Some(dir) = cwd {
        if Path::new(&dir).exists() {
            cmd.current_dir(dir);
        }
    }

    let output = cmd.output().map_err(|e| format!("Falha ao executar comando: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let combined = format!("{}\n{}", stdout, stderr).trim().to_string();
    Ok(combined)
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
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![
        open_url, 
        read_multiple_directories,
        start_ollama_service, // <--- Registrado!
        fetch_ollama_tags,
        select_folder,
        write_file,
        execute_terminal_command
    ])
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