<div align="center">

# Esperto

**Um cliente desktop ultrarrápido, leve e elegante para o Google Gemini.**

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-orange?logo=tauri)](https://tauri.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)

</div>

---

## Sobre o Projeto

O **Esperto** é um assistente de inteligência artificial desktop construído para quem busca **alta performance** e controle total sobre as conversas. 

Diferente de wrappers pesados baseados em Electron, o **Esperto** utiliza a arquitetura nativa do **Tauri (Rust)**, consumindo pouquíssima memória RAM e entregando respostas instantâneas via streaming com a API do **Gemini**.

## Principais Recursos

-  **Extremamente Leve:** Desenvolvido com Tauri + Rust (menos de 50MB de uso de RAM).
-  **Memória Infinita por Chat:** Histórico completo persistido localmente via banco SQLite.
-  **Instruções Personalizadas (System Prompts):** Configure o comportamento e a persona de cada conversa individualmente.
-  **Streaming em Tempo Real:** Visualização dos tokens sendo gerados instantaneamente.
-  **Interface Moderna & Dark Mode:** UI elegante com Tailwind CSS, suporte completo a Markdown e realce de sintaxe de código.
-  **Privacidade & BYOK (Bring Your Own Key):** Sua chave de API fica armazenada com segurança no seu dispositivo local.

---

## Tecnologias Utilizadas

- **Core Desktop:** [Tauri v2](https://tauri.app/) (Rust)
- **Frontend:** [React](https://react.dev/) / [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
- **IA SDK:** [@google/genai](https://www.npmjs.com/package/@google/genai)
- **Persistência:** SQLite

---

## Como Instalar e Rodar Localmente

### Pré-requisitos

Certifique-se de ter instalado em sua máquina:
1. [Node.js](https://nodejs.org/) (versão 18+) ou [Bun](https://bun.sh/)
2. [Rust & Cargo](https://www.rust-lang.org/tools/install)
3. Dependências de sistema para o Tauri (veja o [guia de pré-requisitos do Tauri](https://tauri.app/start/prerequisites/))

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/SEU-USUARIO/esperto.git
   cd esperto
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   # ou
   pnpm install
   ```

3. **Inicie em modo de desenvolvimento:**
   ```bash
   npm run tauri dev
   ```

---

##  Como Gerar o Executável de Produção

Para compilar o binário otimizado para o seu sistema operacional (.msi/.exe no Windows, .dmg no macOS ou .deb/.AppImage no Linux):

```bash
npm run tauri build
```

Os arquivos de instalação serão gerados dentro da pasta `src-tauri/target/release/bundle/`.

---

## Obter Chave do Gemini

Para utilizar o app, gere uma chave de API gratuita no [Google AI Studio](https://aistudio.google.com/) e adicione-a no painel de configurações do **Esperto**.

---

## Licença

Distribuído sob a licença **MIT**. Veja o arquivo [`LICENSE`](LICENSE) para mais detalhes.
```
