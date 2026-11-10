# Esperto

Esperto is a Windows desktop AI assistant for software development. It combines cloud AI providers with local inference through Ollama, project-folder context, persistent conversations, image attachments, and optional web search.

This guide covers the requirements, installation, first launch, model setup, and the main features needed to run the application.

## Features

- Chat with supported cloud providers or locally installed Ollama models.
- Search, download, and import compatible single-file GGUF models from public Hugging Face repositories.
- Install and start Ollama from the application on supported Windows systems.
- Inspect local AI availability, NVIDIA GPU information, and VRAM diagnostics.
- Attach images and files to conversations when the selected model supports the relevant input type.
- Link project folders so the assistant can inspect source files and use the application's project tools.
- Keep conversations and settings locally in IndexedDB.
- Enable web search per conversation. Esperto uses a configured SearXNG endpoint when available and can fall back to DuckDuckGo without requiring Docker.
- Configure model parameters and system instructions globally or for an individual conversation.
- Use the Command Palette to search commands, switch models, open sessions, manage workspaces, and run predefined agent tasks.
- Check for application updates from the interface.

## Requirements

To build the application from source on Windows, install:

- Windows 10 (22H2 or later) or Windows 11.
- Node.js 20 or later and npm.
- Rust stable and Cargo.
- Microsoft C++ Build Tools with the MSVC toolchain.
- WebView2 Runtime.

For local AI, install a current NVIDIA driver when using an NVIDIA GPU. Ollama is installed from the application or from the [official Windows installer](https://ollama.com/download/windows). The Qwen3-VL model requires Ollama 0.12.7 or later.

Docker Desktop is optional. It is only needed if you want to run your own local SearXNG instance instead of using the built-in DuckDuckGo fallback.

Official prerequisites:

- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Ollama for Windows](https://ollama.com/download/windows)

## Install and run from source

1. Clone the repository and open its directory:

   ```powershell
   git clone https://github.com/samuelspineli34/Esperto.git
   cd Esperto
   ```

2. Install JavaScript dependencies:

   ```powershell
   npm install
   ```

3. Start the desktop application in development mode:

   ```powershell
   npm run tauri:dev
   ```

4. Create a distributable Windows installer and signed updater artifacts:

   ```powershell
   npm run tauri:build:signed
   ```

The generated installer is placed in the Tauri build output directory under `src-tauri/target/release/bundle/`. Use the signed build command when the updater public key is configured.

### Build signed updater releases

The updater is configured with a public key and requires the matching private key to sign release artifacts. Keep both key files in the local `.tauri` directory:

- `.tauri/esperto.key` — private signing key. Never commit or distribute this file.
- `.tauri/esperto.key.pub` — public key. Its contents must match `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.

Build and sign the release artifacts with:

```powershell
npm run tauri:build:signed
```

The script verifies that both key files exist and that the public key matches the application configuration. It sets `TAURI_SIGNING_PRIVATE_KEY` to the private-key file path, optionally prompts for the key password without echoing it, and runs the Tauri release build. Press Enter at the password prompt if the private key was generated without a password. Tauri creates the updater signatures alongside the Windows installer artifacts.

Do not remove the updater public key to bypass a missing private key. Tauri requires signed updater artifacts when updater verification is configured. If you only need a one-off unsigned installer, use a separate configuration with the updater disabled; do not ship that configuration as an update to users whose installed application trusts the current public key.

## First launch and local AI setup

1. Open Esperto and go to **Settings > Ollama & GPU**.
2. Review the local AI diagnostics. The application checks whether Ollama is installed and reachable and reports available NVIDIA GPU information when the required driver tools are present.
3. If Ollama is missing, select **Install Ollama**. This uses Windows Package Manager (`winget`). If `winget` is unavailable, install Ollama using the official installer linked above.
4. Start Ollama from the same settings page if it is installed but not running.
5. Keep the default local endpoint unless your Ollama server uses a different address:

   ```text
   http://127.0.0.1:11434
   ```

6. Select **Refresh** to load the models installed in Ollama.

The application can manage Ollama and its models, but model downloads require an internet connection and sufficient disk space. Model inference is performed locally after the model has been downloaded.

## Install models

There are two supported ways to add models.

### From the Ollama library

1. Open **Settings > Ollama & GPU**.
2. Use the model download field and enter an Ollama model identifier, for example:

   ```text
   qwen3-vl:4b
   ```

3. Start the download and wait for it to complete.
4. Refresh the installed model list and select the model in the model selector.

Recommended starting models for systems with 8 GB of GPU memory:

| Use | Model | Image input |
|---|---|---|
| General and multimodal assistance | `qwen3-vl:4b` | Supported |
| Software development and code tasks | `qwen2.5-coder:7b` | Not supported |

Model references:

- [Qwen3-VL on Ollama](https://ollama.com/library/qwen3-vl)
- [Qwen2.5-Coder on Ollama](https://ollama.com/library/qwen2.5-coder)

### From Hugging Face

1. Open **Settings > Ollama & GPU** and locate **Search and install GGUF from Hugging Face**.
2. Search for a model or enter a repository name such as `Qwen/Qwen2.5-Coder-7B-Instruct-GGUF`.
3. Select the repository, then choose a GGUF file from its file list.
4. Enter a local Ollama model name when prompted, if required by the interface.
5. Select **Download and import into Ollama** and wait for the download and import to finish.
6. Refresh the model list and select the imported model.

The current Hugging Face importer supports public repositories containing a single GGUF file. Private or gated repositories, multi-part GGUF shards, and multimodal models that require separate projector files may need additional setup. For Qwen3-VL, use the Ollama library installation flow unless the Hugging Face repository explicitly provides all required files in a compatible format.

Hugging Face references:

- [Qwen3-VL GGUF](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF)
- [Qwen2.5-Coder GGUF](https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF)

## Configure web search

Web search is optional and is controlled per conversation.

1. Open **Settings > Ollama & GPU**.
2. If you have a SearXNG instance, enter its base address. The default local address is:

   ```text
   http://127.0.0.1:8080
   ```

3. If SearXNG is not configured or cannot be reached, Esperto attempts to use DuckDuckGo as a fallback. This fallback does not require Docker Desktop.
4. Open the conversation's run settings and enable **Real-time Web Search** when current external information is needed.

To host SearXNG locally, Docker Desktop and Docker Compose are required. From the project directory, run:

```powershell
npm run setup:search
```

This optional setup creates the local SearXNG configuration and starts the service. It is not required for the DuckDuckGo fallback.

Search requests and retrieved web pages are sent to external websites. Local model inference and the local conversation database remain on the computer unless a cloud provider is selected.

## Work with a project

1. Create or open a conversation.
2. Use the workspace controls to add one or more project folders.
3. Allow Esperto to synchronize the selected folders.
4. Ask the assistant to inspect, explain, review, or modify files in the linked workspace.
5. Review proposed changes and confirmation prompts before allowing file or command actions.

The welcome screen provides starter prompts for project inspection, bug investigation, feature implementation, and code review. These prompts are starting points and can be edited in the conversation input.

## Conversation controls

- Select a model from the model control in the top bar. A model selected for one conversation can override the global default.
- Use **Run Settings** to configure generation parameters and the system instruction for the current conversation.
- Use the memory control to enable or disable global memory for a conversation.
- Attach supported files or images using the attachment control.
- Use the stop control or `Esc` to cancel an active response.
- Conversation history and application settings are stored locally in IndexedDB.

Keyboard shortcuts:

| Shortcut | Action |
|---|---|
| `Ctrl + N` | New conversation |
| `Ctrl + B` | Toggle the sidebar |
| `Ctrl + I` | Open run settings |
| `Ctrl + Shift + P` | Open Command Palette |
| `Ctrl + ,` | Open application settings |
| `Esc` | Stop generation or close the active dialog |
| `Enter` | Send message |
| `Shift + Enter` | Insert a new line |

## Hardware guidance

For a computer with an NVIDIA GPU with 8 GB of VRAM and 16 GB of system memory, begin with a 4,096-token context and run one local model at a time. Actual GPU memory usage depends on the model, quantization, context length, image size, Ollama version, and other running applications. Increase the context only after checking available memory and model placement.

Useful diagnostic commands, when available:

```powershell
ollama list
ollama ps
nvidia-smi
```

## Troubleshooting

**Ollama is not detected**

- Confirm that Ollama is installed.
- Check that the configured endpoint is `http://127.0.0.1:11434`.
- Use the application controls to start Ollama and refresh its status.
- If installed in a custom location, configure the executable path in settings.

**A model download or import fails**

- Confirm that Ollama is running and that the computer has internet access.
- Check available disk space; model files can occupy several gigabytes.
- For Hugging Face, use a public repository with a single compatible GGUF file.
- If the model requires multiple shards or separate projector files, use a compatible Ollama library package or a model-specific import procedure.

**A model runs out of GPU memory**

- Reduce the context length to 4,096 tokens.
- Close other GPU-intensive applications.
- Avoid keeping multiple models loaded simultaneously.
- Check model placement with `ollama ps` and GPU usage with `nvidia-smi`.

**Web search does not return results**

- Confirm that the conversation's web search option is enabled.
- Check the internet connection.
- If using SearXNG, confirm that its endpoint is reachable and its JSON search format is enabled.
- External search providers may rate-limit or block automated requests. The DuckDuckGo fallback is also subject to availability and website changes.

## Privacy and security

Local inference is handled by Ollama. Selecting a cloud provider sends conversation content to that provider according to its terms and privacy policy. Enabling web search sends search queries to external search services and may retrieve content from third-party websites.

Treat retrieved web content and files as untrusted input. Review file changes and command execution requests before confirming them. Do not commit API keys, access tokens, local environment files, or private model credentials to the repository.

## License

Esperto is distributed under the MIT License. See [LICENSE](LICENSE) for details.
