<div align="center">

# Esperto

**Cliente desktop de alta performance para multiplos modelos de Inteligencia Artificial.**

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-orange?logo=tauri)](https://tauri.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.3.3-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)

</div>

---

## Sobre o Projeto

O **Esperto** e um cliente desktop nativo projetado para oferecer execucao de alta performance, baixa latencia e controle granular sobre modelos de linguagem (LLMs) proprietarios e abertos.

Construido sobre a arquitetura do **Tauri v2 (Rust)** em conjunto com **React 18 e TypeScript**, o aplicativo elimina a sobrecarga de memoria tradicional de ambientes baseados em Chromium/Electron, operando com consumo base de RAM inferior a 50MB e comunicacao de streaming de baixa latencia via Server-Sent Events (SSE) e WebSockets.

---

## Principais Recursos e Arquitetura

### 1. Roteador de Modelos Multi-Provedor (BYOK)
Suporte nativo e desacoplado para as principais APIs do mercado, permitindo alternar provedores instantaneamente:
- **Google Gemini:** Modelos Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini 3.5 Flash Lite e versoes Pro/Image com suporte a Thinking e Grounding com Google Search.
- **Anthropic Claude:** Claude 3.7 Sonnet (com suporte a Extended Thinking configuravel), Claude 3.5 Sonnet, Claude 3.5 Haiku e Claude 3 Opus com blocos multimodais de imagem em Base64.
- **OpenAI ChatGPT:** GPT-4o, GPT-4o Mini, GPT-4.5 Preview, o1 e o3-mini (com controle de `reasoning_effort`).
- **DeepSeek:** DeepSeek V3 (Chat) e DeepSeek R1 (Reasoner com Chain of Thought nativo).
- **OpenRouter:** Acesso unificado a mais de 200 modelos adicionais (incluindo Meta Llama 3.3 70B/405B, Mistral Codestral, Qwen 2.5 Coder e modelos gratuitos com sufixo `:free`).
- **Ollama (IA Local e Offline):** Conexao direta com instâncias locais do Ollama (`http://localhost:11434`), permitindo execucao com privacidade total e custo zero de tokens.

### 2. Contexto de Multiplos Diretorios Locais (Smart Codebase RAG)
- **Varredura Nativa em Rust:** O backend em Rust percorre recursivamente multiplas pastas locais selecionadas pelo usuario, aplicando filtros estritos para ignorar dependencias (`node_modules`, `target`, `dist`, `.git`), arquivos binarios e lockfiles pesados.
- **Ranqueamento de Relevancia Lexica:** Analisa a consulta do usuario e injeta no prompt apenas os arquivos mais pertinentes a pergunta, acompanhados pelo manifesto estrutural completo do projeto.
- **Orcamento Dinamico de Tokens:** Limita a carga de arquivos a uma faixa segura de caracteres (~45.000 tokens), prevenindo estouro de cotas por minuto (TPM) e erros de `429: Resource Exhausted`.
- **Predefinicoes de Projetos (Workspaces):** Permite salvar agrupamentos de pastas como workspaces nomeados no banco local para carregamento com um clique.

### 3. Live Artifacts & Sandbox Interativo
- Identifica automaticamente saidas de codigo estruturado (HTML, SVG, Tailwind CSS, JSX/TSX).
- Renderiza o codigo gerado em tempo real dentro de um iframe sandbox isolado, permitindo visualizar componentes, dashboards e interfaces interativas diretamente no aplicativo sem necessidade de deploy externo.
- Permite alternar entre a visualizacao renderizada e o codigo-fonte bruto com ferramentas de expansao de tela e copia de codigo.

### 4. Multimodalidade e Clipboard
- Suporte a envio de imagens (PNG, JPG, WEBP, GIF) e documentos (PDF, TXT, arquivos de codigo-fonte).
- Captura de area de transferencia (`Ctrl + V`), permitindo colar capturas de tela e recortes de imagem diretamente no campo de mensagem.
- Detecao automatica de textos longos colados (>800 caracteres), convertendo-os em snippets encapsulados com indicacao do custo estimado em tokens.

### 5. Controle de Inferencia e Memoria Global
- **Grimorio / Memoria Permanente:** Campo de contexto persistente injetado em todas as sessoes para manter instrucoes fixas sobre identidade do desenvolvedor, stack tecnologica e diretrizes de formatacao.
- **Ajustes de Parametros:** Controles deslizantes para Temperature, Top-P, Max Output Tokens, Thinking Level e Media Resolution (Low / Medium / High).
- **Pesquisa na Web:** Habilitacao opcional de Search Grounding em modelos compativeis.

### 6. Gestao de Sessao e Produtividade
- **Edicao e Reenvio:** Edicao de mensagens anteriores com exclusao do historico posterior e reexecucao imediata do fluxo.
- **Regeneracao de Resposta:** Botao dedicado para solicitar nova geracao da ultima resposta.
- **Copia por Bloco de Codigo:** Cabecalho dedicado em cada bloco de codigo com identificador de sintaxe e botao de copia exclusivo para o trecho.
- **Cancelamento de Requisicao (`AbortController`):** Interrupcao imediata do streaming ao clicar no botao de parada.
- **Cronometro em Tempo Real:** Indicador numerico de tempo de resposta durante a emissao de tokens.
- **Contador de Tokens:** Estimador de consumo de contexto baseado na razao de caracteres/tokens com alerta visual de aproximacao do limite do modelo.
- **Exportacao em Markdown:** Geracao de arquivos `.md` estruturados com o conteudo integral da sessao de conversa.

### 7. Atualizacoes e Persistencia
- **Persistencia Local Segura:** Toda a estrutura de conversas, configuracoes e chaves permanece salva localmente via IndexedDB (Dexie.js).
- **Atualizador Integrado:** Verificador nativo conectado a API do GitHub Releases para download e atualizacao das builds mais recentes.

---

## Tecnologias Utilizadas

- **Backend Nativo:** [Tauri v2](https://tauri.app/) (Rust)
- **Frontend:** [React 18](https://react.dev/) e [TypeScript 5.9](https://www.typescriptlang.org/)
- **Build Tool:** [Vite 8](https://vitejs.dev/)
- **Estilizacao:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Banco de Dados Local:** [Dexie.js](https://dexie.org/) (IndexedDB)
- **Processamento de Markdown:** `react-markdown` e `react-syntax-highlighter` (Prism vscDarkPlus)
- **Biblioteca de Icones:** [Lucide React](https://lucide.dev/)
- **SDK de IA:** `@google/genai` e adaptadores HTTP nativos para OpenAI, Anthropic, DeepSeek e Ollama

---

## Como Instalar e Executar

### Pre-requisitos

Certifique-se de que os seguintes componentes estejam instalados:
1. [Node.js](https://nodejs.org/) (versao 20+) ou [Bun](https://bun.sh/)
2. [Rust & Cargo](https://www.rust-lang.org/tools/install) (versao stable)
3. Dependencias de desenvolvimento do sistema operacional (C++ Build Tools no Windows ou `libwebkit2gtk-4.1-dev` no Linux)

### Passos de Instalacao

1. Clone o repositorio:
   ```bash
   git clone https://github.com/samuelspineli34/Esperto.git
   cd Esperto
   ```

2. Instale as dependencias do projeto:
   ```bash
   npm install
   ```

3. Inicie a aplicacao em modo de desenvolvimento com hot-reload:
   ```bash
   npm run tauri:dev
   ```

---

## Compilacao de Executaveis de Producao

Para compilar o binario otimizado para distribuicao no sistema operacional corrente:

```bash
npm run tauri:build
```

Os artefatos compilados serao gerados no diretorio `src-tauri/target/release/bundle/`:
- **Windows:** `.exe` (instalador NSIS) e `.msi`
- **Linux:** `.deb` e `.AppImage`
- **macOS:** `.dmg` e `.app`

---

## Configuracao de Provedores de API

O Esperto opera sob o modelo **BYOK (Bring Your Own Key)**. As chaves devem ser obtidas diretamente nos respectivos paineis dos provedores:
- [Google AI Studio](https://aistudio.google.com/)
- [OpenRouter](https://openrouter.ai/keys)
- [DeepSeek Platform](https://platform.deepseek.com/)
- [Anthropic Console](https://console.anthropic.com/)
- [OpenAI Platform](https://platform.openai.com/)
- [Ollama](https://ollama.com/) (Instancia local rodando na porta padrao `11434`)

As chaves sao gravadas exclusivamente no armazenamento local da aplicacao.

---

## Licenca

Distribuido sob a licenca **MIT**. Consulte o arquivo [LICENSE](LICENSE) para obter mais informacoes.

---

<div align="center">
Desenvolvido por <a href="https://www.linkedin.com/in/samuel-spineli/">Samuel Spineli</a> • 2026
</div>