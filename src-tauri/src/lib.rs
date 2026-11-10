use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{Emitter, Manager};

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

#[tauri::command]
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

    let exec_path = find_ollama_executable(custom_path);

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

    let ollama_exe = find_ollama_executable(None);
    let output = std::process::Command::new(&ollama_exe)
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


#[derive(Serialize)]
struct WebSearchResult {
    title: String,
    url: String,
    snippet: String,
    engine: Option<String>,
    published_date: Option<String>,
}

fn allowed_external_url(url: &reqwest::Url) -> bool {
    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }
    let Some(host) = url.host_str() else { return false; };
    let host_lower = host.to_ascii_lowercase();
    if host_lower == "localhost" || host_lower.ends_with(".localhost") || host_lower.ends_with(".local") {
        return false;
    }
    if let Ok(ip) = host.parse::<std::net::IpAddr>() {
        return match ip {
            std::net::IpAddr::V4(v4) => !(v4.is_private() || v4.is_loopback() || v4.is_link_local() || v4.is_unspecified() || v4.is_broadcast()),
            std::net::IpAddr::V6(v6) => !(v6.is_loopback() || v6.is_unspecified() || v6.is_unique_local() || v6.is_unicast_link_local()),
        };
    }
    true
}

fn external_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .connect_timeout(Duration::from_secs(6))
        .user_agent("EspertoDesktop/0.2 (+https://github.com/samuelspineli34/Esperto)")
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 4 || !allowed_external_url(attempt.url()) {
                attempt.stop()
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|e| format!("Não foi possível inicializar o cliente HTTP: {e}"))
}


async fn search_duckduckgo_fallback(query: &str) -> Result<String, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(20)).user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36").build().map_err(|e| e.to_string())?;
    let response = client.get("https://html.duckduckgo.com/html/").query(&[("q", query)]).send().await.map_err(|e| format!("SearXNG offline e DuckDuckGo indisponível: {e}"))?;
    if !response.status().is_success() { return Err(format!("SearXNG offline; DuckDuckGo retornou HTTP {}.", response.status())); }
    let html = response.text().await.map_err(|e| e.to_string())?;
    let links_re = regex::Regex::new(r#"(?is)<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>(.*?)</a>"#).map_err(|e| e.to_string())?;
    let snippet_re = regex::Regex::new(r#"(?is)<a[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>(.*?)</a>|<div[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>(.*?)</div>"#).map_err(|e| e.to_string())?;
    let tag_re = regex::Regex::new(r"(?s)<[^>]+>").map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    for (index, cap) in links_re.captures_iter(&html).take(8).enumerate() {
        let href = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        let ddg_base = reqwest::Url::parse("https://duckduckgo.com/").map_err(|e| e.to_string())?;
        let mut parsed = match ddg_base.join(href) { Ok(u) => u, Err(_) => continue };
        if let Some(target) = parsed.query_pairs().find(|(k, _)| k == "uddg").map(|(_, v)| v.to_string()) {
            if let Ok(decoded) = reqwest::Url::parse(&target) { parsed = decoded; }
        }
        if !allowed_external_url(&parsed) { continue; }
        let raw_title = cap.get(2).map(|m| m.as_str()).unwrap_or("");
        let title = tag_re.replace_all(raw_title, "").replace("&amp;", "&").replace("&quot;", "\"").trim().to_string();
        let snippet = snippet_re.captures_iter(&html).nth(index).map(|sc| {
            let raw = sc.get(1).or_else(|| sc.get(2)).map(|m| m.as_str()).unwrap_or("");
            tag_re.replace_all(raw, "").replace("&amp;", "&").replace("&quot;", "\"").trim().to_string()
        }).unwrap_or_default();
        results.push(WebSearchResult { title, url: parsed.to_string(), snippet, engine: Some("DuckDuckGo (fallback)".to_string()), published_date: None });
    }
    if results.is_empty() { return Err("SearXNG está offline e o DuckDuckGo não retornou resultados legíveis. Configure um provedor de pesquisa ou inicie o SearXNG.".to_string()); }
    serde_json::to_string(&results).map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_web(query: String, searxng_host: Option<String>) -> Result<String, String> {
    let query = query.trim();
    if query.is_empty() {
        return Err("Informe uma consulta para pesquisar.".to_string());
    }
    if query.len() > 500 {
        return Err("A consulta de pesquisa excede 500 caracteres.".to_string());
    }

    let base = searxng_host.unwrap_or_else(|| "http://127.0.0.1:8080".to_string());
    let parsed = reqwest::Url::parse(base.trim()).map_err(|e| format!("Endereço do SearXNG inválido: {e}"))?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return Err("O endereço do SearXNG deve utilizar HTTP ou HTTPS.".to_string());
    }
    let endpoint = parsed.join("search").map_err(|e| e.to_string())?;
    let client = external_http_client()?;
    let response = match client.get(endpoint)
        .query(&[("q", query), ("format", "json"), ("language", "pt-BR"), ("safesearch", "0")])
        .send().await {
        Ok(response) if response.status().is_success() => response,
        _ => return search_duckduckgo_fallback(query).await,
    };
    let payload: serde_json::Value = response.json().await
        .map_err(|e| format!("Resposta JSON inválida do SearXNG: {e}"))?;
    let mut results = Vec::new();
    if let Some(items) = payload.get("results").and_then(|v| v.as_array()) {
        for item in items.iter().take(8) {
            let url = item.get("url").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Sem título").to_string();
            let snippet = item.get("content").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            if url.is_empty() { continue; }
            let parsed_url = match reqwest::Url::parse(&url) { Ok(u) => u, Err(_) => continue };
            if !allowed_external_url(&parsed_url) { continue; }
            results.push(WebSearchResult {
                title,
                url,
                snippet,
                engine: item.get("engine").and_then(|v| v.as_str()).map(str::to_string),
                published_date: item.get("publishedDate").and_then(|v| v.as_str()).map(str::to_string),
            });
        }
    }
    serde_json::to_string(&results).map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_webpage_text(url: String) -> Result<String, String> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|e| format!("URL inválida: {e}"))?;
    if !allowed_external_url(&parsed) {
        return Err("A URL não é permitida. Apenas páginas HTTP/HTTPS públicas podem ser consultadas.".to_string());
    }

    let client = external_http_client()?;
    let response = client.get(parsed.clone()).send().await
        .map_err(|e| format!("Falha ao abrir {}: {e}", parsed.host_str().unwrap_or("site")))?;
    if !response.status().is_success() {
        return Err(format!("A página retornou HTTP {}.", response.status()));
    }
    let content_type = response.headers().get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok()).unwrap_or("");
    if !content_type.contains("text/html") && !content_type.contains("text/plain") && !content_type.contains("application/xhtml") {
        return Err("O endereço não retornou HTML ou texto legível.".to_string());
    }

    let mut response = response;
    let mut bytes = Vec::with_capacity(256 * 1024);
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        let remaining = 1_500_000usize.saturating_sub(bytes.len());
        if remaining == 0 { break; }
        bytes.extend_from_slice(&chunk[..chunk.len().min(remaining)]);
        if bytes.len() >= 1_500_000 { break; }
    }
    let body = String::from_utf8_lossy(&bytes).to_string();
    let without_scripts = regex::Regex::new(r"(?is)<(script|style|noscript|svg|iframe)[^>]*>.*?</(script|style|noscript|svg|iframe)>")
        .map_err(|e| e.to_string())?.replace_all(&body, " ");
    let with_breaks = regex::Regex::new(r"(?i)</(p|div|article|section|h[1-6]|li|tr|br)>")
        .map_err(|e| e.to_string())?.replace_all(&without_scripts, "\n");
    let without_tags = regex::Regex::new(r"(?s)<[^>]+>")
        .map_err(|e| e.to_string())?.replace_all(&with_breaks, " ");
    let decoded = without_tags
        .replace("&nbsp;", " ")
        .replace("&#160;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'");
    let normalized = regex::Regex::new(r"[ \t\r]+")
        .map_err(|e| e.to_string())?.replace_all(&decoded, " ");
    let compact = regex::Regex::new(r"\n\s*\n+")
        .map_err(|e| e.to_string())?.replace_all(&normalized, "\n");
    let text = compact.trim();
    if text.is_empty() {
        return Err("Não foi possível extrair texto útil da página.".to_string());
    }
    Ok(text.chars().take(14000).collect())
}


#[derive(Serialize)]
struct HfModelResult { id: String, downloads: u64, likes: u64 }

#[derive(Serialize)]
struct HfFileResult { path: String, size: u64 }

fn find_ollama_executable(custom_path: Option<String>) -> String {
    if let Some(p) = custom_path {
        let trimmed = p.trim().trim_matches('"').trim_matches('\'');
        if !trimmed.is_empty() && Path::new(trimmed).exists() { return trimmed.to_string(); }
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let candidate = PathBuf::from(local_app_data).join("Programs").join("Ollama").join("ollama.exe");
            if candidate.exists() { return candidate.to_string_lossy().to_string(); }
        }
        if let Ok(program_files) = std::env::var("ProgramW6432") {
            let candidate = PathBuf::from(program_files).join("Ollama").join("ollama.exe");
            if candidate.exists() { return candidate.to_string_lossy().to_string(); }
        }
    }
    "ollama".to_string()
}

#[tauri::command]
fn install_ollama() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("winget")
            .args(["install", "--id", "Ollama.Ollama", "-e", "--silent", "--accept-package-agreements", "--accept-source-agreements"])
            .output()
            .map_err(|e| format!("Não foi possível iniciar o instalador do Ollama pelo Windows Package Manager (winget): {e}. Instale pelo site oficial https://ollama.com/download/windows."))?;
        let result = format!("{}\n{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
        if output.status.success() { Ok(result.trim().to_string()) }
        else { Err(format!("Instalação do Ollama falhou (código {:?}): {}", output.status.code(), result.trim())) }
    }
    #[cfg(not(target_os = "windows"))]
    { Err("A instalação automática está preparada para Windows. Consulte https://ollama.com/download para outros sistemas.".to_string()) }
}

#[tauri::command]
fn diagnose_local_ai() -> Result<String, String> {
    let ollama_path = find_ollama_executable(None);
    let ollama_installed = Path::new(&ollama_path).exists() || std::process::Command::new(&ollama_path).arg("--version").output().map(|o| o.status.success()).unwrap_or(false);
    let gpu = std::process::Command::new("nvidia-smi")
        .args(["--query-gpu=name,memory.total,memory.free", "--format=csv,noheader,nounits"])
        .output().ok().filter(|o| o.status.success()).map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());
    let gpu_available = gpu.is_some();
    let payload = serde_json::json!({
        "platform": std::env::consts::OS,
        "ollamaInstalled": ollama_installed,
        "ollamaPath": if ollama_installed { Some(ollama_path) } else { None::<String> },
        "gpu": gpu,
        "gpuAvailable": gpu_available,
        "ollamaOnline": TcpStream::connect_timeout(&"127.0.0.1:11434".parse().unwrap(), Duration::from_millis(300)).is_ok()
    });
    serde_json::to_string(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_huggingface_gguf(query: String) -> Result<String, String> {
    let q = query.trim();
    if q.len() < 2 || q.len() > 120 { return Err("Digite pelo menos 2 caracteres (máximo 120).".to_string()); }
    let client = reqwest::Client::builder().timeout(Duration::from_secs(20)).user_agent("EspertoDesktop/0.2").build().map_err(|e| e.to_string())?;
    let response = client.get("https://huggingface.co/api/models")
        .query(&[("search", q), ("filter", "gguf"), ("limit", "15"), ("sort", "downloads"), ("direction", "-1")])
        .send().await.map_err(|e| format!("Falha ao consultar Hugging Face: {e}"))?;
    if !response.status().is_success() { return Err(format!("Hugging Face retornou HTTP {}", response.status())); }
    let rows: Vec<serde_json::Value> = response.json().await.map_err(|e| format!("Resposta inválida do Hugging Face: {e}"))?;
    let models: Vec<HfModelResult> = rows.into_iter().filter_map(|v| Some(HfModelResult {
        id: v.get("id")?.as_str()?.to_string(),
        downloads: v.get("downloads").and_then(|x| x.as_u64()).unwrap_or(0),
        likes: v.get("likes").and_then(|x| x.as_u64()).unwrap_or(0),
    })).collect();
    serde_json::to_string(&models).map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_huggingface_gguf_files(repo_id: String) -> Result<String, String> {
    let repo = repo_id.trim();
    if repo.is_empty() || repo.len() > 200 || repo.contains("..") || repo.contains('\\') || repo.starts_with('/') { return Err("Identificador de repositório inválido.".to_string()); }
    let url = format!("https://huggingface.co/api/models/{}/tree/main", repo);
    let client = reqwest::Client::builder().timeout(Duration::from_secs(20)).user_agent("EspertoDesktop/0.2").build().map_err(|e| e.to_string())?;
    let response = client.get(url).query(&[("recursive", "true"), ("expand", "true")]).send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() { return Err(format!("Não foi possível listar o repositório (HTTP {}). Ele pode ser privado ou exigir autenticação.", response.status())); }
    let rows: Vec<serde_json::Value> = response.json().await.map_err(|e| e.to_string())?;
    let files: Vec<HfFileResult> = rows.into_iter().filter_map(|v| {
        let path = v.get("path")?.as_str()?.to_string();
        if !path.to_ascii_lowercase().ends_with(".gguf") { return None; }
        Some(HfFileResult { size: v.get("size").and_then(|x| x.as_u64()).unwrap_or(0), path })
    }).collect();
    serde_json::to_string(&files).map_err(|e| e.to_string())
}

#[tauri::command]
async fn download_huggingface_gguf(app: tauri::AppHandle, repo_id: String, file_name: String) -> Result<String, String> {
    let repo = repo_id.trim();
    let file = file_name.trim();
    if repo.is_empty() || repo.len() > 200 || repo.contains("..") || repo.contains('\\') || repo.starts_with('/') || file.is_empty() || file.starts_with('/') || file.split('/').any(|p| p == "..") {
        return Err("Repositório ou arquivo inválido.".to_string());
    }
    if !file.to_ascii_lowercase().ends_with(".gguf") { return Err("Por segurança, o importador baixa apenas arquivos GGUF.".to_string()); }
    let url = format!("https://huggingface.co/{}/resolve/main/{}", repo, file);
    let client = reqwest::Client::builder().timeout(Duration::from_secs(3600)).user_agent("EspertoDesktop/0.2").build().map_err(|e| e.to_string())?;
    let mut response = client.get(url).send().await.map_err(|e| format!("Falha no download: {e}"))?;
    if !response.status().is_success() { return Err(format!("Hugging Face retornou HTTP {}. Para repositórios gated/privados, o token HF ainda precisa ser configurado.", response.status())); }
    let total = response.content_length().unwrap_or(0);
    if total > 20 * 1024 * 1024 * 1024 { return Err("O arquivo excede o limite de 20 GB deste importador.".to_string()); }
    let root = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("models").join("huggingface");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let safe_repo = repo.replace('/', "--");
    let safe_file = file.replace('/', "_");
    let destination = root.join(format!("{}-{}", safe_repo, safe_file));
    let mut output = fs::File::create(&destination).map_err(|e| format!("Não foi possível criar o arquivo local: {e}"))?;
    let mut downloaded: u64 = 0;
    while let Some(chunk) = response.chunk().await.map_err(|e| format!("Download interrompido: {e}"))? {
        downloaded += chunk.len() as u64;
        output.write_all(&chunk).map_err(|e| format!("Falha ao gravar o modelo: {e}"))?;
        let _ = app.emit("hf-download-progress", serde_json::json!({"downloaded": downloaded, "total": total}));
    }
    output.flush().map_err(|e| e.to_string())?;
    if downloaded == 0 { let _ = fs::remove_file(&destination); return Err("O arquivo baixado está vazio.".to_string()); }
    Ok(destination.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            open_url,
            search_web,
            fetch_webpage_text,
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
            fetch_media_from_hf,
            install_ollama,
            diagnose_local_ai,
            search_huggingface_gguf,
            list_huggingface_gguf_files,
            download_huggingface_gguf
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