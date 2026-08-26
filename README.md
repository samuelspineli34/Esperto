<div align="center">

# Esperto

**High-performance desktop AI client for multiple Large Language Models.**

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-orange?logo=tauri)](https://tauri.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.3.3-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)

</div>

---

## About the Project

**Esperto** is a native high-performance desktop AI client built to provide fine-grained control over conversations, codebases, and language models.

Unlike resource-heavy Electron wrappers, Esperto relies on **Tauri v2 (Rust)** combined with **React 18 and TypeScript**, running with minimal RAM usage (<50MB) and delivering real-time streaming responses across multiple AI providers.

---

## Key Features & Architecture

### 1. Multi-Provider AI Router (BYOK)
Native, decoupled support for leading market APIs, allowing instant switching between providers:
- **Google Gemini:** Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini 3.5 Flash Lite, and Pro/Image models with Thinking and Google Search Grounding support.
- **Anthropic Claude:** Claude 3.7 Sonnet (with configurable Extended Thinking), Claude 3.5 Sonnet, Claude 3.5 Haiku, and Claude 3 Opus with multimodal Base64 image blocks.
- **OpenAI ChatGPT:** GPT-4o, GPT-4o Mini, GPT-4.5 Preview, o1, and o3-mini (with `reasoning_effort` tuning).
- **DeepSeek:** DeepSeek V3 (Chat) and DeepSeek R1 (Reasoner with native Chain of Thought).
- **OpenRouter:** Unified gateway to 200+ additional models (including Meta Llama 3.3 70B/405B, Mistral Codestral, Qwen 2.5 Coder, and free models via the `:free` suffix).
- **Ollama (Local & Offline AI):** Direct integration with local Ollama instances (`http://localhost:11434`), enabling full privacy and zero token cost.

### 2. Local Multi-Directory Context (Smart Codebase RAG)
- **Native Rust File Scanner:** The Rust backend recursively scans selected local folders while applying strict filters to ignore dependencies (`node_modules`, `target`, `dist`, `.git`), binary files, and heavy lockfiles.
- **Lexical Relevance Scoring:** Analyzes user queries and injects only the most pertinent code files into the prompt along with the project's structural file tree manifest.
- **Dynamic Token Budgeting:** Restricts file payload to a safe character budget (~45,000 tokens), preventing Per-Minute Rate Limit errors (`429: Resource Exhausted`).
- **Workspace Presets:** Save folder groupings as named workspaces in the local database for one-click loading.

### 3. Live Artifacts & Interactive Sandbox
- Automatically detects structured code outputs (HTML, SVG, Tailwind CSS, JSX/TSX).
- Renders generated code in real-time inside an isolated iframe sandbox, allowing instant preview of components, dashboards, and interactive UIs without external deployment.
- Seamlessly toggle between rendered previews and raw source code with expansion and copying tools.

### 4. Multimodal & Clipboard Integration
- Support for image uploads (PNG, JPG, WEBP, GIF) and documents (PDF, TXT, source code).
- Direct clipboard capture (`Ctrl + V`), enabling screenshots and image snips to be pasted directly into the input field.
- Automatic detection of long pasted text blocks (>800 characters), encapsulating them into token-metered code snippets.

### 5. Inference Control & Global Memory
- **Persistent Global Memory:** A persistent context field injected across all sessions to preserve developer identity, tech stack preferences, and formatting guidelines.
- **Inference Tuning:** Sliders for Temperature, Top-P, Max Output Tokens, Thinking Level, and Media Resolution (Low / High).
- **Web Search:** Optional Google Search Grounding enablement on compatible models.

### 6. Session & Productivity Management
- **In-place Message Editing:** Edit previous user messages, truncate subsequent history, and instantly re-trigger execution flow.
- **Response Regeneration:** Dedicated button to request a fresh generation of the last assistant response.
- **Code Block Copying:** Syntax identifier and standalone copy button tailored to individual code snippets.
- **Stream Cancellation (`AbortController`):** Immediate termination of token streaming upon clicking the stop button.
- **Real-Time Stopwatch:** Numeric response generation timer tracking token emission latency.
- **Token Counter & Meter:** Context consumption estimator based on character-to-token heuristics with visual warning thresholds.
- **Markdown Export:** Generate structured `.md` files containing the full conversation session.

### 7. Updates & Local Persistence
- **Secure Local Persistence:** Conversations, configurations, and API keys are stored exclusively on-device via IndexedDB (Dexie.js).
- **Integrated Updater:** Native update checker tied directly to GitHub Releases for seamless binary distribution.

---

## Tech Stack

- **Desktop Core:** [Tauri v2](https://tauri.app/) (Rust)
- **Frontend:** [React 18](https://react.dev/) & [TypeScript 5.9](https://www.typescriptlang.org/)
- **Build Tool:** [Vite 8](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Local Database:** [Dexie.js](https://dexie.org/) (IndexedDB)
- **Markdown Rendering:** `react-markdown` & `react-syntax-highlighter` (Prism vscDarkPlus)
- **Icons:** [Lucide Icons](https://lucide.dev/)
- **AI SDKs:** `@google/genai` and native HTTP adapters for OpenAI, Anthropic, DeepSeek, and Ollama.

---

## Installation & Local Setup

### Prerequisites

Ensure the following tools are installed on your machine:
1. [Node.js](https://nodejs.org/) (version 20+) or [Bun](https://bun.sh/)
2. [Rust & Cargo](https://www.rust-lang.org/tools/install) (stable version)
3. OS build dependencies (C++ Build Tools on Windows or `libwebkit2gtk-4.1-dev` on Linux)

### Step-by-Step

1. **Clone the repository:**
   ```bash
   git clone https://github.com/samuelspineli34/Esperto.git
   cd Esperto

2.  Install dependencies:

    npm install

3.  Start development mode with hot-reload:

    npm run tauri:dev

Production Build

To compile optimized binaries for your current operating system:

npm run tauri:build

Compiled deliverables will be generated in src-tauri/target/release/bundle/:

  - Windows: .exe (NSIS installer) and .msi
  - Linux: .deb and .AppImage
  - macOS: .dmg and .app

API Provider Configuration

Esperto operates under a BYOK (Bring Your Own Key) model. Obtain your keys
directly from provider dashboards:

  - Google AI Studio
  - OpenRouter
  - DeepSeek Platform
  - Anthropic Console
  - OpenAI Platform
  - Ollama (Local instance running on default port 11434)

API keys are stored exclusively in local application storage.

License

Distributed under the MIT License. See LICENSE for details.
