use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::time::Duration;

#[derive(Serialize, Deserialize, Clone)]
pub struct FileContext {
    pub path: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CommandResult {
    pub output: String,
    pub exit_code: i32,
    pub success: bool,
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

#[tauri::command]
fn read_multiple_directories(dir_paths: Vec<String>, ignore_list: Vec<String>) -> Result<Vec<FileContext>, String> {
    let mut all_files = Vec::new();
    for dir in dir_paths {
        let clean = dir.trim();
        if clean.is_empty() { continue; }
        
        let path = Path::new(clean);
        if path.exists() && path.is_dir() {
            // Função interna atualizada para aceitar o ignore_list
            collect_files_with_ignore(path, path, &mut all_files, 400, &ignore_list);
        }
    }
    Ok(all_files)
}

fn collect_files_with_ignore(base_path: &Path, current_path: &Path, results: &mut Vec<FileContext>, max: usize, ignores: &[String]) {
    if results.len() >= max { return; }
    
    if let Ok(entries) = fs::read_dir(current_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            let path_str = path.to_string_lossy().to_lowercase();

            // Filtro rígido + Filtro customizado do usuário
            if should_ignore(&path_str) || ignores.iter().any(|i| path_str.contains(&i.to_lowercase())) {
                continue;
            }

            if path.is_dir() {
                collect_files_with_ignore(base_path, &path, results, max, ignores);
            } else if path.is_file() && path.metadata().map(|m| m.len() < 350_000).unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path) {
                    results.push(FileContext {
                        path: path.strip_prefix(base_path).unwrap_or(&path).to_string_lossy().into_owned(),
                        content,
                    });
                }
            }
        }
    }
}

fn parse_host_port(host_str: Option<String>) -> (String, u16) {
    let raw = host_str.unwrap_or_else(|| "127.0.0.1:11434".to_string());
    let clean = raw.trim().replace("http://", "").replace("https://", "");
    let parts: Vec<&str> = clean.split(':').collect();
    let host = parts.first().unwrap_or(&"127.0.0.1").to_string();
    let port: u16 = parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(11434);
    (host, port)
}

#[tauri::command]
fn check_ollama_status(custom_host: Option<String>) -> Result<bool, String> {
    let (host, port) = parse_host_port(custom_host);
    let socket_str = format!("{}:{}", host, port);
    let socket_addr = socket_str.parse().map_err(|e| format!("Endereço inválido: {}", e))?;
    Ok(TcpStream::connect_timeout(&socket_addr, Duration::from_millis(500)).is_ok())
}

#   [tauri::command]
async fn fetch_media_from_hf(prompt: String, token: String, is_video: bool) -> Result<String, String> {
    let client = reqwest::Client::new();
    // FLUX.1 para imagem, SVD para vídeo
    let endpoint = if is_video {
        "https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid-xt"
    } else {
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell"
    };

    let response = client.post(endpoint)
        .header("Authorization", format!("Bearer {}", token.trim()))
        .json(&serde_json::json!({ "inputs": prompt }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Hugging Face status: {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    use base64::Engine;
    let base64 = base64::engine::general_purpose::STANDARD.encode(bytes);

    let mime = if is_video { "video/mp4" } else { "image/png" };
    Ok(format!("data:{};base64,{}", mime, base64))
}

#[tauri::command]
fn start_ollama_service(custom_path: Option<String>, custom_host: Option<String>) -> Result<String, String> {
    let (host, port) = parse_host_port(custom_host);
    let socket_str = format!("{}:{}", host, port);
    let socket_addr = socket_str.parse().map_err(|e| format!("Endereço inválido: {}", e))?;

    if TcpStream::connect_timeout(&socket_addr, Duration::from_millis(400)).is_ok() {
        return Ok("Ollama já está ativo em segundo plano.".to_string());
    }

    let mut exec_path = "ollama".to_string();

    if let Some(p) = custom_path {
        let trimmed = p.trim().replace("\"", "").replace("'", "");
        if !trimmed.is_empty() && Path::new(&trimmed).exists() {
            exec_path = trimmed;
        }
    } else {
        #[cfg(target_os = "windows")]
        {
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                let default_win_path = PathBuf::from(&local_app_data)
                    .join("Programs")
                    .join("Ollama")
                    .join("ollama.exe");
                if default_win_path.exists() {
                    exec_path = default_win_path.to_string_lossy().to_string();
                }
            }
        }
    }

    let mut cmd = std::process::Command::new(&exec_path);
    cmd.arg("serve");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn()
        .map_err(|e| format!("Falha ao iniciar o executável do Ollama ('{}'): {}", exec_path, e))?;

    for _ in 0..10 {
        std::thread::sleep(Duration::from_millis(500));
        if TcpStream::connect_timeout(&socket_addr, Duration::from_millis(400)).is_ok() {
            return Ok("Ollama iniciado com sucesso em segundo plano!".to_string());
        }
    }

    Err("O comando de iniciar o Ollama foi disparado, mas o servidor demorou para responder.".to_string())
}

#[tauri::command]
fn fetch_ollama_tags(custom_host: Option<String>) -> Result<String, String> {
    let (host, port) = parse_host_port(custom_host);
    let socket_str = format!("{}:{}", host, port);
    let socket_addr = socket_str.parse().map_err(|e| format!("Endereço inválido: {}", e))?;

    let mut stream = TcpStream::connect_timeout(&socket_addr, Duration::from_millis(2500))
        .map_err(|e| format!("Não foi possível conectar ao Ollama em {}: {}", socket_str, e))?;

    stream.set_read_timeout(Some(Duration::from_millis(4000))).map_err(|e| e.to_string())?;

    let request = format!(
        "GET /api/tags HTTP/1.1\r\nHost: {}\r\nConnection: close\r\nAccept: application/json\r\n\r\n",
        socket_str
    );
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
fn select_gguf_file() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.OpenFileDialog
        $f.Filter = "Arquivos GGUF (*.gguf)|*.gguf|Todos os Arquivos (*.*)|*.*"
        $f.Title = "Selecione o arquivo de modelo GGUF sem censura"
        if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            Write-Output $f.FileName
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
fn import_gguf_to_ollama(model_name: String, gguf_path: String) -> Result<String, String> {
    let clean_name = model_name.trim().to_lowercase().replace(' ', "-");
    let clean_path = gguf_path.trim().replace('\\', "/");

    if clean_name.is_empty() || clean_path.is_empty() {
        return Err("Nome do modelo e caminho do arquivo GGUF são obrigatórios.".to_string());
    }

    let temp_dir = std::env::temp_dir();
    let modelfile_path = temp_dir.join(format!("Modelfile-{}", clean_name));
    let modelfile_content = format!("FROM \"{}\"\nPARAMETER temperature 0.7\n", clean_path);

    fs::write(&modelfile_path, modelfile_content)
        .map_err(|e| format!("Erro ao criar Modelfile temporário: {}", e))?;

    let output = std::process::Command::new("ollama")
        .args(["create", &clean_name, "-f", &modelfile_path.to_string_lossy()])
        .output()
        .map_err(|e| format!("Falha ao executar 'ollama create': {}", e))?;

    let _ = fs::remove_file(modelfile_path);

    if output.status.success() {
        Ok(format!("Modelo '{}' importado e pronto no Ollama!", clean_name))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<String, String> {
    let clean_path = path.trim().trim_matches('"').trim_matches('\'').trim();
    if clean_path.is_empty() {
        return Err("O caminho do arquivo não pode ser vazio.".to_string());
    }

    let p = Path::new(clean_path);
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Erro ao criar diretórios para '{}': {}", clean_path, e))?;
        }
    }

    fs::write(p, content)
        .map_err(|e| format!("Erro ao gravar arquivo em '{}': {}", clean_path, e))?;

    Ok(format!("Arquivo salvo com sucesso em: {}", clean_path))
}

#[tauri::command]
fn execute_terminal_command(command: String, cwd: Option<String>) -> Result<CommandResult, String> {
    let clean_cmd = command.trim();
    if clean_cmd.is_empty() {
        return Ok(CommandResult {
            output: "Nenhum comando para executar.".to_string(),
            exit_code: 0,
            success: true,
        });
    }

    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = std::process::Command::new("powershell");
        c.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", clean_cmd]);
        c
    } else {
        let mut c = std::process::Command::new("sh");
        c.args(["-c", clean_cmd]);
        c
    };

    if let Some(dir) = cwd {
        let clean_dir = dir.trim().trim_matches('"').trim_matches('\'').to_string();
        if !clean_dir.is_empty() && Path::new(&clean_dir).exists() {
            cmd.current_dir(clean_dir);
        }
    }

    let output = cmd.output().map_err(|e| format!("Falha ao executar comando: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    let combined = format!("{}\n{}", stdout, stderr).trim().to_string();

    Ok(CommandResult {
        output: combined,
        exit_code,
        success: output.status.success(),
    })
}

/// Baixa o instalador (.exe) diretamente da Release do GitHub em segundo plano e o dispara sem abrir navegador
#[tauri::command]
fn download_and_run_installer(url: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let script = format!(
            r#"
            $dest = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "Esperto-AutoUpdate-Setup.exe")
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $client = New-Object System.Net.WebClient
            $client.DownloadFile("{}", $dest)
            Start-Process $dest
            "#,
            url
        );

        std::process::Command::new("powershell")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &script])
            .spawn()
            .map_err(|e| format!("Erro ao disparar instalador: {}", e))?;

        // Fecha a instância atual após 2 segundos para permitir a substituição limpa
        std::thread::spawn(|| {
            std::thread::sleep(Duration::from_millis(2000));
            std::process::exit(0);
        });

        Ok("Instalador disparado com sucesso.".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Auto-instalação automática disponível para Windows.".to_string())
    }
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
            check_ollama_status,
            start_ollama_service,
            fetch_ollama_tags,
            select_folder,
            select_gguf_file,
            import_gguf_to_ollama,
            write_file,
            execute_terminal_command,
            download_and_run_installer,
            fetch_media_from_hf 
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