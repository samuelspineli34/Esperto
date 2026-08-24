<div align="center">

# Esperto

**Um cliente desktop ultrarrápido, leve e moderno para múltiplos modelos de Inteligência Artificial.**

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-orange?logo=tauri)](https://tauri.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.3.3-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)

</div>

---

## Sobre o Projeto

O **Esperto** é um cliente desktop de inteligência artificial de alta performance construído para oferecer controle total sobre conversas, código e modelos de linguagem.

Diferente de aplicações construídas sobre Electron, o **Esperto** utiliza a arquitetura nativa do **Tauri v2 (Rust)** com **React e TypeScript**, operando com baixo consumo de memória RAM (< 50MB) e entregando respostas em tempo real via streaming para múltiplos provedores de IA.

---

## Principais Recursos

- **Arquitetura em Rust:** Desenvolvido com Tauri v2, proporcionando baixo consumo de recursos e inicialização rápida.
- **Multi-Provedores (BYOK):** Suporte nativo e catálogo em ordem alfabética com busca em tempo real:
  - **Google Gemini:** Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini Flash Lite e modelos multimodais.
  - **Anthropic Claude:** Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku e Claude 3 Opus.
  - **OpenAI ChatGPT:** GPT-4o, GPT-4o Mini, GPT-4.5 Preview, o1 e o3-mini.
  - **DeepSeek:** DeepSeek V3 (Chat) e DeepSeek R1 (Reasoner).
- **Base de Conhecimento com Múltiplos Diretórios:** Permite vincular pastas locais do sistema. O aplicativo indexa arquivos de código e seleciona os trechos mais relevantes para a pergunta atual sem ultrapassar o limite de tokens da requisição.
- **Multimodalidade e Clipboard (Ctrl + V):** Suporte para envio de imagens (PNG, JPG, WEBP), documentos (PDF, TXT, código) e colagem direta de capturas de tela.
- **Memória Permanente do Usuário:** Campo de contexto global editável injetado em todas as conversas para manter preferências, stack técnica e instruções fixas.
- **Contador de Tokens e Monitor de Contexto:** Cálculo estimado de tokens consumidos e medidor da porcentagem utilizada do limite de contexto de cada modelo.
- **Controles de Inferência:**
  - Ajuste de Temperature e Top-P.
  - Configuração de Thinking Level e Budget para modelos de raciocínio.
  - Resolução de Mídia (Low / High) para controle de consumo de tokens.
  - Grounding com Pesquisa Google em tempo real.
- **Gestão de Conversas:**
  - Edição de mensagens com reenvio do fluxo a partir do ponto editado.
  - Regeneração de respostas.
  - Renomeação de títulos de conversas na barra lateral e duplicação/ramificação de chats.
  - Interrupção de resposta em andamento (Stop Generation).
  - Atalhos de teclado: Enter para envio e Ctrl + Enter / Shift + Enter para quebra de linha.
- **Central de Atualizações:** Verificação e download de novas versões diretamente pelo GitHub Releases.
- **Privacidade e Persistência Local:** Chaves de API e dados de conversas são armazenados exclusivamente no banco de dados local do dispositivo (IndexedDB via Dexie).

---

## Tecnologias Utilizadas

- **Core Desktop:** [Tauri v2](https://tauri.app/) (Rust)
- **Frontend:** [React 18](https://react.dev/) e [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite 8](https://vitejs.dev/)
- **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Banco de Dados Local:** [Dexie.js](https://dexie.org/) (IndexedDB)
- **Renderização de Markdown:** `react-markdown` e `react-syntax-highlighter`
- **Ícones:** [Lucide Icons](https://lucide.dev/)

---

## Como Instalar e Rodar Localmente

### Pré-requisitos

Certifique-se de ter instalado no sistema:
1. [Node.js](https://nodejs.org/) (versão 20+) ou [Bun](https://bun.sh/)
2. [Rust e Cargo](https://www.rust-lang.org/tools/install)
3. Dependências de sistema para o Tauri (consulte os [pré-requisitos do Tauri](https://tauri.app/start/prerequisites/))

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/samuelspineli34/Esperto.git
   cd Esperto
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie em modo de desenvolvimento:**
   ```bash
   npm run tauri:dev
   ```

---

## Como Gerar o Executável de Produção

Para compilar o binário otimizado para o sistema operacional:

```bash
npm run tauri:build
```

Os instaladores serão gerados no diretório `src-tauri/target/release/bundle/`:
- **Windows:** `.exe` (NSIS) e `.msi`
- **Linux:** `.deb` e `.AppImage`
- **macOS:** `.dmg` e `.app`

---

## Configuração de Chaves de API

O Esperto opera sob o modelo **BYOK (Bring Your Own Key)**. Insira suas chaves nos campos correspondentes na tela de Configurações:
- [Google AI Studio](https://aistudio.google.com/)
- [Anthropic Console](https://console.anthropic.com/)
- [OpenAI Platform](https://platform.openai.com/)
- [DeepSeek Platform](https://platform.deepseek.com/)

As chaves são salvas apenas localmente no seu computador.

---

## Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [`LICENSE`](LICENSE) para mais detalhes.

---

<div align="center">
Desenvolvido por <a href="https://www.linkedin.com/in/samuel-spineli/">Samuel Spineli</a> • 2026
</div>
