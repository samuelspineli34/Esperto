# Esperto

Esperto is a Windows desktop AI assistant designed for software development. It brings local and cloud AI models together in a single workspace, with project-aware conversations, multimodal assistance, image generation and editing, and integrated development tools.

The application focuses on making local AI accessible, helping users choose models that match their hardware and providing a streamlined environment for everyday development tasks.

## Features

- **AI conversations:** Use supported cloud providers or locally installed models through Ollama.
- **Local model management:** Discover, download, import, and manage compatible GGUF models from Hugging Face and the Ollama library.
- **Hardware detection:** Inspect CPU, system memory, NVIDIA GPUs, and available VRAM to understand local inference capabilities.
- **Model recommendations:** Get model suggestions based on available hardware and intended workloads.
- **Image Studio:** Generate images and edit existing images using natural-language instructions and ComfyUI integration.
- **Project workspaces:** Link project folders so the assistant can inspect source files and assist with development.
- **Multimodal conversations:** Attach images and files when supported by the selected model.
- **Web search:** Retrieve current information through a configured SearXNG endpoint or the DuckDuckGo fallback.
- **Persistent conversations:** Keep conversation history and application settings locally using IndexedDB.
- **Custom generation settings:** Configure model parameters and system instructions globally or per conversation.
- **Command Palette:** Quickly access commands, switch models, open conversations, manage workspaces, and launch agent tasks.
- **Application updates:** Check for and install application updates through the integrated updater.

## Requirements

To build Esperto from source on Windows, install:

- Windows 10 (22H2 or later) or Windows 11.
- Node.js 20 or later and npm.
- Rust stable and Cargo.
- Microsoft C++ Build Tools with the MSVC toolchain.
- WebView2 Runtime.

For local AI inference, a compatible GPU is recommended but not mandatory. Install a current NVIDIA driver when using an NVIDIA GPU.

Ollama can be installed through Esperto or downloaded separately.

Official resources:

- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Ollama for Windows](https://ollama.com/download/windows)

Docker Desktop is optional and is only needed when hosting your own SearXNG instance.

Image Studio requires a running ComfyUI installation and compatible image-generation models.

## Installation and development

Clone the repository:

```powershell
git clone https://github.com/samuelspineli34/Esperto.git
cd Esperto
```

Install dependencies:

```powershell
npm install
```

Start the application in development mode:

```powershell
npm run tauri:dev
```

To build a Windows release:

```powershell
npm run tauri:build:signed
```

The generated installer and updater artifacts are available under:

```text
src-tauri/target/release/bundle/
```

## Application setup

### Local AI and Ollama

Open **Settings > Ollama & GPU** to configure local inference.

Esperto checks whether Ollama is installed and reachable, retrieves installed models, and displays available hardware diagnostics.

If Ollama is not installed, use **Install Ollama** when available or download it from the [official website](https://ollama.com/download/windows).

The default Ollama endpoint is:

```text
http://127.0.0.1:11434
```

If Ollama is already installed but not running, start it from the application settings.

Use **Refresh** to synchronize the installed model list with Ollama. The displayed model count should reflect the models currently available on the configured Ollama instance.

### Installing models

Esperto supports two model installation workflows.

#### Ollama library

1. Open **Settings > Ollama & GPU**.
2. Find the model installation field.
3. Enter an Ollama model identifier.
4. Start the download.
5. Wait for the installation to finish.
6. Refresh the installed model list and select the model.

Example:

```text
qwen3-vl:4b
```

Some useful starting points:

| Workload | Model | Image input |
|---|---|---|
| General assistance and vision | `qwen3-vl:4b` | Supported |
| Software development | `qwen2.5-coder:7b` | Not supported |

Model references:

- [Qwen3-VL](https://ollama.com/library/qwen3-vl)
- [Qwen2.5-Coder](https://ollama.com/library/qwen2.5-coder)

#### Hugging Face GGUF

1. Open **Settings > Ollama & GPU**.
2. Locate the Hugging Face model installation section.
3. Search for a model or enter a repository identifier.
4. Select a compatible GGUF file.
5. Choose the local Ollama model name if requested.
6. Start the download and import.
7. Refresh the installed model list.

Example repositories:

- [Qwen3-VL GGUF](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF)
- [Qwen2.5-Coder GGUF](https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF)

The current importer supports public repositories containing a single compatible GGUF file. Multi-part GGUF models, gated repositories, and models requiring separate projector files may need a different installation method.

## Hardware detection and model recommendations

Esperto provides hardware diagnostics to help users understand which local models are appropriate for their computers.

The application can inspect:

- Processor information.
- Available system memory.
- NVIDIA GPU information.
- Available GPU memory (VRAM).
- Local Ollama availability and model status.

Recommendations should be considered estimates rather than guarantees. Actual performance depends on model architecture, quantization, context length, GPU memory, available system RAM, and other running applications.

For computers with 8 GB of VRAM and 16 GB of system memory, smaller quantized models are generally a sensible starting point.

Useful diagnostic commands:

```powershell
ollama list
ollama ps
nvidia-smi
```

## Image Studio

Image Studio provides a dedicated environment for image generation and image-to-image editing.

It integrates with ComfyUI, allowing Esperto to communicate with a locally running image-generation workflow.

Default ComfyUI endpoint:

```text
http://127.0.0.1:8188
```

The editing workflow supports:

- Selecting an image-generation model.
- Providing an original image as a reference.
- Writing natural-language editing instructions.
- Adjusting the intensity of image modifications.
- Submitting generation jobs.
- Tracking generation progress.
- Previewing generated images.

FLUX.2 Klein is the intended image-editing model family.

ComfyUI must be running with the required models, encoders, VAE, and compatible workflow nodes installed. Model availability and hardware requirements depend on the selected workflow and configuration.

Image Studio communicates with ComfyUI through native Rust commands rather than direct browser HTTP requests. This avoids relying on cross-origin browser permissions for local ComfyUI communication.

For troubleshooting, verify that ComfyUI is running and that its configured endpoint is reachable.

## Web search

Web search is optional and can be enabled individually for each conversation.

Esperto supports SearXNG and a DuckDuckGo fallback.

The default local SearXNG endpoint is:

```text
http://127.0.0.1:8080
```

To configure a local SearXNG instance, Docker Desktop and Docker Compose are required.

Run:

```powershell
npm run setup:search
```

This setup is optional. DuckDuckGo can be used without Docker when SearXNG is unavailable or not configured.

Enable **Real-time Web Search** in the conversation settings when external information is required.

## Project workspaces

Esperto can work with local project folders.

1. Create or open a conversation.
2. Add a project folder using the workspace controls.
3. Allow the application to synchronize the selected folder.
4. Ask the assistant to inspect, explain, review, or modify project files.
5. Review proposed changes and confirmation prompts before approving file or command actions.

The application includes starter prompts for project inspection, debugging, feature implementation, and code review.

## Conversations and controls

The model selector allows users to choose a model for the current conversation. A conversation-specific selection can override the global default.

Additional controls include:

- Generation parameters and system instructions.
- Conversation memory settings.
- Image and file attachments.
- Response cancellation.
- Workspace management.
- Persistent conversation history.

Conversation history and application settings are stored locally using IndexedDB.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + N` | New conversation |
| `Ctrl + B` | Toggle sidebar |
| `Ctrl + I` | Open run settings |
| `Ctrl + Shift + P` | Open Command Palette |
| `Ctrl + ,` | Open application settings |
| `Esc` | Stop generation or close the active dialog |
| `Enter` | Send message |
| `Shift + Enter` | Insert a new line |

## Application updates

Esperto includes an integrated application updater.

Use the update controls in the application interface to check for available releases and install updates.

Release builds use Tauri's updater signing and verification mechanism. Signed update artifacts must be generated with the private key matching the public key configured in the application.

### Signing configuration

Keep the signing keys in the local `.tauri` directory:

```text
.tauri/
├── esperto.key
└── esperto.key.pub
```

- `esperto.key`: Private signing key. Never commit or distribute it.
- `esperto.key.pub`: Public signing key. Must match `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.

Build signed release artifacts:

```powershell
npm run tauri:build:signed
```

The build script checks the signing configuration, sets the required private-key environment variable, and runs the release build.

Never commit private signing keys, API credentials, access tokens, or local environment files.

## Troubleshooting

### Ollama is not detected

- Confirm that Ollama is installed.
- Check that the configured endpoint is correct.
- Start Ollama from the application settings.
- Refresh the model list.
- If using a custom installation path, verify the executable path in settings.

### Installed model count is incorrect

- Confirm that the configured Ollama endpoint is reachable.
- Run `ollama list` to check the models available to the local Ollama instance.
- Refresh the model list in Esperto.
- Make sure the application is connected to the same Ollama installation where the models were downloaded.

### Model download or import fails

- Check your internet connection.
- Verify available disk space.
- Confirm that the repository is public and the GGUF file is compatible.
- For multi-part or multimodal models, use a compatible installation method.

### Model runs out of GPU memory

- Reduce the context length.
- Close other GPU-intensive applications.
- Avoid keeping multiple models loaded simultaneously.
- Check model placement using `ollama ps`.
- Check GPU memory usage using `nvidia-smi`.

### Image Studio cannot connect to ComfyUI

- Confirm that ComfyUI is running.
- Verify the configured endpoint, normally `http://127.0.0.1:8188`.
- Open the ComfyUI interface directly to check whether the service is responding.
- Verify that the selected workflow's required models and nodes are installed.
- Check the application error details for failed generation requests.

### Web search does not return results

- Enable web search in the current conversation.
- Check your internet connection.
- Verify the SearXNG endpoint if configured.
- Remember that external search providers may rate-limit automated requests.

### Application updates fail

- Confirm that the release contains the required signed updater artifacts.
- Verify that the configured public key matches the signing key.
- Check the internet connection and release availability.
- Do not replace the updater configuration with an unrelated signing key.

## Privacy and security

Local model inference is handled through Ollama. Conversation content sent to cloud providers is subject to their respective terms and privacy policies.

Web search sends queries to external search services and may retrieve information from third-party websites.

Image Studio communicates with a locally running ComfyUI service.

Treat retrieved web content and project files as untrusted input. Review proposed file changes and command execution requests before confirming them.

Never commit API keys, private signing keys, access tokens, or sensitive local configuration files.

## License

Esperto is distributed under the MIT License. See [LICENSE](LICENSE) for details.