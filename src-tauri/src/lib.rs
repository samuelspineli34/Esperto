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

#[tauri::command]
pub async fn get_system_specs() -> Result<SystemHardwareInfo, String> {
    let mut info = SystemHardwareInfo {
        os_name: std::env::consts::OS.to_string(),
        os_version: "Desconhecida".to_string(),
        total_ram_mb: 16384,
        available_ram_mb: 8192,
        cpu_cores: std::thread::available_parallelism()
            .map(|p| p.get())
            .unwrap_or(8),
        cpu_brand: "Processador x86_64 / ARM".to_string(),
        gpu_name: "GPU Integrada / Não Detectada".to_string(),
        gpu_vram_mb: 4096,
        has_nvidia_gpu: false,
        has_amd_gpu: false,
        has_apple_silicon: cfg!(target_os = "macos")
            && (cfg!(target_arch = "aarch64") || cfg!(target_arch = "arm")),
    };

    #[cfg(target_os = "windows")]
    {
        // 1. Detecção da GPU NVIDIA via nvidia-smi
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

        // 2. Detecção de Memória RAM total no Windows
        if let Ok(output) = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB)",
            ])
            .output()
        {
            if output.status.success() {
                let str_ram = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if let Ok(ram_val) = str_ram.parse::<u64>() {
                    info.total_ram_mb = ram_val;
                }
            }
        }

        // 3. Nome do processador
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
pub async fn check_comfyui_status(host: Option<String>) -> Result<ComfyCheckResult, String> {
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
pub async fn comfyui_upload_image(
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
pub async fn comfyui_get_output_image(
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

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(p, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_multiple_directories(dir_paths: Vec<String>) -> Result<Vec<LoadedFileItem>, String> {
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
pub async fn select_folder() -> Result<Option<String>, String> {
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
pub async fn download_and_run_installer(url: String) -> Result<String, String> {
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
pub async fn open_url(url: String) -> Result<(), String> {
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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            get_system_specs,
            check_comfyui_status,
            comfyui_upload_image,
            comfyui_get_output_image,
            write_file,
            read_multiple_directories,
            select_folder,
            download_and_run_installer,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("erro ao rodar o aplicativo Esperto");
}