use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemHardwareInfo {
    pub os_name: String,
    pub os_version: String,
    pub total_ram_mb: u64,
    pub available_ram_mb: u64,
    pub cpu_cores: usize,
    pub cpu_brand: String,
    pub gpu_name: String,
    pub gpu_vram_mb: u64,
    pub has_nvidia_gpu: bool,
    pub has_amd_gpu: bool,
    pub has_apple_silicon: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ComfyCheckResult {
    pub is_online: bool,
    pub version: String,
    pub devices: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LoadedFileItem {
    pub path: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TerminalExecutionResult {
    pub output: String,
    pub exit_code: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalAIDiagnostics {
    pub platform: String,
    pub ollama_installed: bool,
    pub ollama_path: Option<String>,
    pub gpu: Option<String>,
    pub gpu_available: bool,
    pub ollama_online: bool,
}

// ==========================================
// 1. HARDWARE & DIAGNÓSTICO
// ==========================================

#[tauri::command]
async fn get_system_specs() -> Result<SystemHardwareInfo, String> {
    let mut info = SystemHardwareInfo {
        os_name: std::env::consts::OS.to_string(),
        os_version: "10/11".to_string(),
        total_ram_mb: 0,
        available_ram_mb: 0,
        cpu_cores: std::thread::available_parallelism()
            .map(|p| p.get())
            .unwrap_or(8),
        cpu_brand: "Processador x86_64".to_string(),
        gpu_name: "GPU Integrada / Não Detectada".to_string(),
        gpu_vram_mb: 0,
        has_nvidia_gpu: false,
        has_amd_gpu: false,
        has_apple_silicon: cfg!(target_os = "macos")
            && (cfg!(target_arch = "aarch64") || cfg!(target_arch = "arm")),
    };

    #[cfg(target_os = "windows")]
    {
        // Detecta RAM total/disponível e versão real do Windows. Nunca usa valores fictícios.
        if let Ok(output) = Command::new("powershell").args([
            "-NoProfile", "-Command",
            "$os=Get-CimInstance Win32_OperatingSystem; [pscustomobject]@{Total=[math]::Round($os.TotalVisibleMemorySize/1024);Free=[math]::Round($os.FreePhysicalMemory/1024);Version=$os.Caption+' '+$os.Version} | ConvertTo-Json -Compress"
        ]).output() {
            if output.status.success() {
                if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
                    info.total_ram_mb = v["Total"].as_u64().unwrap_or(0);
                    info.available_ram_mb = v["Free"].as_u64().unwrap_or(0);
                    info.os_version = v["Version"].as_str().unwrap_or("Windows").to_string();
                }
            }
        }

        // Detecção NVIDIA via nvidia-smi
        if let Ok(output) = Command::new("nvidia-smi")
            .args([
                "--query-gpu=gpu_name,memory.total",
                "--format=csv,noheader,nounits",
            ])
            .output()
        {
            if output.status.success() {
                let out_str = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = out_str.lines().next() {
                    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                    if parts.len() >= 2 {
                        info.gpu_name = parts[0].to_string();
                        if let Ok(vram) = parts[1].parse::<u64>() {
                            info.gpu_vram_mb = vram;
                        }
                        info.has_nvidia_gpu = true;
                    }
                }
            }
        }

        // Fallback para GPUs AMD/Intel via WMI. A VRAM dedicada pode não ser reportada
        // de forma confiável por todos os drivers; nesse caso permanece zero.
        if !info.has_nvidia_gpu {
            if let Ok(output) = Command::new("powershell").args([
                "-NoProfile", "-Command",
                "Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name"
            ]).output() {
                if output.status.success() {
                    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !name.is_empty() {
                        info.gpu_name = name.clone();
                        info.has_amd_gpu = name.to_lowercase().contains("amd") || name.to_lowercase().contains("radeon");
                    }
                }
            }
        }

        // Nome da CPU
        if let Ok(output) = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_Processor).Name",
            ])
            .output()
        {
            if output.status.success() {
                let cpu_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !cpu_str.is_empty() {
                    info.cpu_brand = cpu_str;
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = Command::new("nvidia-smi")
            .args([
                "--query-gpu=gpu_name,memory.total",
                "--format=csv,noheader,nounits",
            ])
            .output()
        {
            if output.status.success() {
                let out_str = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = out_str.lines().next() {
                    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                    if parts.len() >= 2 {
                        info.gpu_name = parts[0].to_string();
                        if let Ok(vram) = parts[1].parse::<u64>() {
                            info.gpu_vram_mb = vram;
                        }
                        info.has_nvidia_gpu = true;
                    }
                }
            }
        }
    }

    Ok(info)
}

#[tauri::command]
async fn diagnose_local_ai() -> Result<String, String> {
    let mut installed = false;
    let mut online = false;
    let mut gpu_name: Option<String> = None;

    if Command::new("ollama").arg("--version").output().is_ok() {
        installed = true;
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1500))
        .build()
        .map_err(|e| e.to_string())?;

    if let Ok(res) = client.get("http://127.0.0.1:11434/api/tags").send().await {
        if res.status().is_success() {
            online = true;
        }
    }

    if let Ok(output) = Command::new("nvidia-smi")
        .args(["--query-gpu=gpu_name", "--format=csv,noheader"])
        .output()
    {
        if output.status.success() {
            let out = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !out.is_empty() {
                gpu_name = Some(out);
            }
        }
    }

    let diag = LocalAIDiagnostics {
        platform: std::env::consts::OS.to_string(),
        ollama_installed: installed,
        ollama_path: None,
        gpu: gpu_name.clone(),
        gpu_available: gpu_name.is_some(),
        ollama_online: online,
    };

    serde_json::to_string(&diag).map_err(|e| e.to_string())
}

// ==========================================
// 2. COMFYUI & IMAGE STUDIO
// ==========================================

#[tauri::command]
async fn check_comfyui_status(host: Option<String>) -> Result<ComfyCheckResult, String> {
    let target_host = host
        .unwrap_or_else(|| "http://127.0.0.1:8188".to_string())
        .trim_end_matches('/')
        .to_string();
    let url = format!("{}/system_stats", target_host);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(2500))
        .build()
        .map_err(|e| e.to_string())?;

    match client.get(&url).send().await {
        Ok(res) => {
            if res.status().is_success() {
                let body: serde_json::Value = res.json().await.unwrap_or_default();
                let mut devices = Vec::new();
                if let Some(dev_list) = body["devices"].as_array() {
                    for dev in dev_list {
                        if let Some(name) = dev["name"].as_str() {
                            devices.push(name.to_string());
                        }
                    }
                }
                Ok(ComfyCheckResult {
                    is_online: true,
                    version: "Disponível".to_string(),
                    devices,
                })
            } else {
                Ok(ComfyCheckResult {
                    is_online: false,
                    version: "".to_string(),
                    devices: vec![],
                })
            }
        }
        Err(_) => Ok(ComfyCheckResult {
            is_online: false,
            version: "".to_string(),
            devices: vec![],
        }),
    }
}

#[tauri::command]
async fn comfyui_upload_image(
    host: String,
    image_base64: String,
    file_name: String,
) -> Result<String, String> {
    let target_host = host.trim_end_matches('/');
    let url = format!("{}/upload/image", target_host);

    let clean_b64 = image_base64
        .replace("data:image/png;base64,", "")
        .replace("data:image/jpeg;base64,", "")
        .replace("data:image/webp;base64,", "");

    let image_bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        clean_b64.trim(),
    )
    .map_err(|e| format!("Erro ao decodificar base64: {}", e))?;

    let part = reqwest::multipart::Part::bytes(image_bytes)
        .file_name(file_name)
        .mime_str("image/png")
        .map_err(|e| e.to_string())?;

    let form = reqwest::multipart::Form::new().part("image", part);

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Falha ao enviar imagem ao ComfyUI: {}", e))?;

    if response.status().is_success() {
        let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        let saved_name = json["name"]
            .as_str()
            .ok_or_else(|| "ComfyUI não retornou o nome do arquivo".to_string())?;
        Ok(saved_name.to_string())
    } else {
        Err(format!(
            "Erro de upload no ComfyUI (HTTP {}): {}",
            response.status(),
            response.text().await.unwrap_or_default()
        ))
    }
}

#[tauri::command]
async fn comfyui_get_output_image(
    host: String,
    filename: String,
    subfolder: Option<String>,
    folder_type: Option<String>,
) -> Result<String, String> {
    let target_host = host.trim_end_matches('/');
    let mut url = format!("{}/view?filename={}", target_host, filename);
    if let Some(sub) = subfolder {
        if !sub.is_empty() {
            url.push_str(&format!("&subfolder={}", sub));
        }
    }
    if let Some(ftype) = folder_type {
        if !ftype.is_empty() {
            url.push_str(&format!("&type={}", ftype));
        }
    }

    let client = reqwest::Client::new();
    let bytes = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Erro ao obter imagem gerada: {}", e))?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
    Ok(format!("data:image/png;base64,{}", b64))
}

// Requisições do Image Studio executadas no backend nativo, fora do WebView.
fn comfy_endpoint(endpoint: &str) -> Result<String, String> {
    let endpoint = endpoint.trim().trim_end_matches('/');
    let parsed = reqwest::Url::parse(endpoint)
        .map_err(|e| format!("Endpoint ComfyUI inválido: {e}"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("O endpoint do ComfyUI deve usar HTTP ou HTTPS.".into());
    }
    Ok(endpoint.to_string())
}

fn comfy_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(4))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Não foi possível inicializar o cliente HTTP: {e}"))
}

#[tauri::command]
async fn comfy_check_status(endpoint: String) -> Result<bool, String> {
    let base = comfy_endpoint(&endpoint)?;
    let client = comfy_client()?;
    for path in ["/system_stats", "/"] {
        if let Ok(response) = client.get(format!("{base}{path}")).send().await {
            if response.status().is_success() { return Ok(true); }
        }
    }
    Ok(false)
}

#[tauri::command]
async fn comfy_queue_prompt(endpoint: String, payload: serde_json::Value) -> Result<serde_json::Value, String> {
    let base = comfy_endpoint(&endpoint)?;
    let client = comfy_client()?;
    let response = client.post(format!("{base}/prompt"))
        .json(&payload).send().await
        .map_err(|e| format!("Falha ao enviar workflow ao ComfyUI: {e}"))?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("ComfyUI recusou o workflow (HTTP {status}): {body}"));
    }
    serde_json::from_str(&body)
        .map_err(|e| format!("Resposta inválida do ComfyUI: {e}. Conteúdo: {body}"))
}

#[tauri::command]
async fn comfy_get_history(endpoint: String, prompt_id: String) -> Result<serde_json::Value, String> {
    if prompt_id.is_empty() || !prompt_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("ID de tarefa do ComfyUI inválido.".into());
    }
    let base = comfy_endpoint(&endpoint)?;
    let client = comfy_client()?;
    let response = client.get(format!("{base}/history/{prompt_id}"))
        .send().await
        .map_err(|e| format!("Falha ao consultar histórico do ComfyUI: {e}"))?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("ComfyUI retornou HTTP {status} ao consultar histórico: {body}"));
    }
    serde_json::from_str(&body).map_err(|e| format!("Histórico inválido do ComfyUI: {e}"))
}

#[tauri::command]
async fn comfy_get_view_image(
    endpoint: String, filename: String, subfolder: String, type_folder: String
) -> Result<Vec<u8>, String> {
    let base = comfy_endpoint(&endpoint)?;
    let client = comfy_client()?;
    let response = client.get(format!("{base}/view"))
        .query(&[("filename", filename), ("subfolder", subfolder), ("type", type_folder)])
        .send().await
        .map_err(|e| format!("Falha ao baixar imagem do ComfyUI: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("ComfyUI retornou HTTP {status} ao baixar imagem: {body}"));
    }
    response.bytes().await
        .map(|b| b.to_vec())
        .map_err(|e| format!("Falha ao ler bytes da imagem: {e}"))
}

// ==========================================
// 3. ARQUIVOS & TERMINAL
// ==========================================

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(p, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn read_multiple_directories(dir_paths: Vec<String>) -> Result<Vec<LoadedFileItem>, String> {
    let mut files = Vec::new();
    for base in dir_paths {
        let p = PathBuf::from(base);
        if p.exists() && p.is_dir() {
            collect_files_recursive(&p, &mut files, 0);
        }
    }
    Ok(files)
}

fn collect_files_recursive(dir: &Path, acc: &mut Vec<LoadedFileItem>, depth: usize) {
    if depth > 7 || acc.len() > 300 {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with('.')
                || name == "node_modules"
                || name == "target"
                || name == "dist"
                || name == "build"
            {
                continue;
            }

            if path.is_dir() {
                collect_files_recursive(&path, acc, depth + 1);
            } else if path.is_file() {
                if let Ok(meta) = path.metadata() {
                    if meta.len() < 300_000 {
                        if let Ok(content) = fs::read_to_string(&path) {
                            acc.push(LoadedFileItem {
                                path: path.to_string_lossy().to_string(),
                                content,
                            });
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
async fn select_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let ps_cmd = r#"
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.FolderBrowserDialog
        $f.Description = "Selecione a pasta do projeto"
        if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            Write-Output $f.SelectedPath
        }
        "#;
        let out = Command::new("powershell")
            .args(["-NoProfile", "-Command", ps_cmd])
            .output()
            .map_err(|e| e.to_string())?;

        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if s.is_empty() {
            Ok(None)
        } else {
            Ok(Some(s))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

#[tauri::command]
async fn execute_terminal_command(
    command: String,
    cwd: Option<String>,
) -> Result<TerminalExecutionResult, String> {
    #[cfg(target_os = "windows")]
    let mut cmd = Command::new("powershell");
    #[cfg(target_os = "windows")]
    cmd.args(["-NoProfile", "-Command", &command]);

    #[cfg(not(target_os = "windows"))]
    let mut cmd = Command::new("sh");
    #[cfg(not(target_os = "windows"))]
    cmd.arg("-c").arg(&command);

    if let Some(dir) = cwd {
        if Path::new(&dir).exists() {
            cmd.current_dir(dir);
        }
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let full_output = if stderr.is_empty() {
        stdout
    } else {
        format!("{}\n{}", stdout, stderr)
    };

    Ok(TerminalExecutionResult {
        output: full_output,
        exit_code: output.status.code().unwrap_or(-1),
    })
}

// ==========================================
// 4. ATUALIZADOR E UTILITÁRIOS WEB
// ==========================================

#[tauri::command]
async fn download_and_run_installer(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let temp_dir = std::env::temp_dir();
    let installer_path = temp_dir.join("esperto-setup-update.exe");

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Falha de conexão com a release: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("O servidor retornou HTTP {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Erro no download: {}", e))?;
    fs::write(&installer_path, bytes).map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        Command::new(&installer_path)
            .spawn()
            .map_err(|e| format!("Falha ao disparar o instalador: {}", e))?;
        std::process::exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok("Instalador baixado com sucesso.".to_string())
    }
}

#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Apenas protocolos HTTP/HTTPS são permitidos.".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open").arg(&url).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ==========================================
// 5. INICIALIZAÇÃO
// ==========================================

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            get_system_specs,
            diagnose_local_ai,
            check_comfyui_status,
            comfy_check_status,
            comfy_queue_prompt,
            comfy_get_history,
            comfy_get_view_image,
            comfyui_upload_image,
            comfyui_get_output_image,
            write_file,
            read_multiple_directories,
            select_folder,
            execute_terminal_command,
            download_and_run_installer,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("erro ao rodar o aplicativo Esperto");
}