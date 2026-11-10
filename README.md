<div align="center">

# Esperto

**Cliente desktop de IA para desenvolvimento de software, modelos locais e pesquisa na web.**

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-orange?logo=tauri)](https://v2.tauri.app/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Ollama](https://img.shields.io/badge/Ollama-local%20inference-black)](https://ollama.com/)

</div>

---

## 1. Visao geral

Esperto e um cliente desktop nativo baseado em Tauri 2, Rust, React e TypeScript. O projeto combina provedores de IA em nuvem com inferencia local por Ollama, contexto de projetos locais, conversas persistentes e ferramentas de desenvolvimento.

Esta versao amplia o provedor Ollama com entrada multimodal, recuperacao de pesquisa web via SearXNG e extracao controlada de texto de paginas publicas. A inferencia do modelo permanece local; somente as consultas de pesquisa e as paginas explicitamente recuperadas trafegam pela internet.

## 2. Arquitetura

```text
Esperto Desktop
|
+-- React 18 / TypeScript
|   +-- Conversas e historico (Dexie / IndexedDB)
|   +-- Anexos e imagens
|   +-- Selecao de modelos
|   +-- Configuracoes por conversa
|   +-- Contexto de workspace
|
+-- Tauri 2 / Rust
|   +-- Comandos nativos e acesso a arquivos
|   +-- Cliente Ollama (HTTP streaming)
|   +-- Pesquisa web (SearXNG JSON API)
|   +-- Extracao de texto de paginas HTTP(S)
|
+-- Servicos locais
    +-- Ollama: http://127.0.0.1:11434
    +-- SearXNG: http://127.0.0.1:8080
```

### Pesquisa web

Ao ativar **Pesquisa Web em Tempo Real** nas configuracoes da conversa, o provedor Ollama:

1. Envia a consulta para a API JSON do SearXNG.
2. Seleciona ate dois resultados publicos.
3. Tenta extrair o texto das paginas, com limite de tamanho e tempo.
4. Injeta os resultados no prompt como conteudo externo nao confiavel.
5. Instrui o modelo a citar as fontes usando links Markdown.

Se o SearXNG estiver indisponivel, o Esperto tenta automaticamente uma busca HTML publica no DuckDuckGo. Essa alternativa nao exige Docker, mas depende da disponibilidade do site e pode ser limitada por bloqueios ou mudancas no HTML. Se ambos falharem, a conversa continua sem fontes e o modelo e informado da falha.

O mecanismo e independente do Google. O SearXNG agrega motores configurados, incluindo Google quando disponivel, e pode recorrer a outros motores. A disponibilidade depende de bloqueios, CAPTCHA, limites e politicas dos provedores de busca.

## 3. Hardware recomendado

Configuracao de referencia para desenvolvimento local:

| Componente | Equipamento | Perfil recomendado |
|---|---|---|
| GPU | NVIDIA RTX 2060 Super 8 GB | Qwen3-VL 4B Q4 |
| CPU | AMD Ryzen 5 5600 | Inferencia assistida por GPU |
| RAM | 16 GB | Um modelo carregado por vez |
| Contexto inicial | 4.096 tokens | Aumentar para 8.192 apos validar VRAM |

O uso de VRAM varia com driver, versao do Ollama, tamanho de imagem, cache KV, contexto e outros processos graficos. Nao existe garantia de que todo o modelo permanecera na GPU em qualquer configuracao. Verifique a distribuicao com `ollama ps` e o uso de memoria com `nvidia-smi`.

### Modelos recomendados

| Finalidade | Modelo Ollama | Entrada visual | Observacao |
|---|---|---|---|
| Assistente multimodal principal | `qwen3-vl:4b` | Sim | Melhor ponto de partida para 8 GB |
| Programacao textual | `qwen2.5-coder:7b` | Nao | Alternativa especializada em codigo |

Os modelos sao carregados sob demanda. Em uma GPU de 8 GB, mantenha apenas um modelo carregado por vez. Qwen3-VL 4B no catalogo Ollama usa quantizacao Q4_K_M para o modelo e projetor visual separado; o tamanho em disco nao representa o consumo total de VRAM.

Fontes dos modelos:
- [Ollama: Qwen3-VL](https://ollama.com/library/qwen3-vl)
- [Ollama: Qwen2.5-Coder](https://ollama.com/library/qwen2.5-coder)
- [Hugging Face: Qwen3-VL-4B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF)
- [Hugging Face: Qwen2.5-Coder-7B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF)

## 4. Requisitos de desenvolvimento

- Windows 10 22H2 ou Windows 11.
- Node.js 20 ou superior.
- npm.
- Rust stable e Cargo.
- Microsoft C++ Build Tools / Visual Studio Build Tools com MSVC.
- WebView2 Runtime.
- Driver NVIDIA atualizado.
- Ollama para inferencia local (0.12.7 ou superior para Qwen3-VL).
- Docker Desktop com Docker Compose apenas se voce quiser hospedar uma instancia SearXNG local (opcional).

Referencias:
- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Ollama para Windows](https://ollama.com/download/windows)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## 5. Instalacao

### 5.1 Dependencias do projeto

No diretorio raiz:

```powershell
npm install
```

### 5.2 Instalar e baixar os modelos locais

Abra PowerShell no diretorio raiz e execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-local-ai.ps1
```

O script verifica o Ollama e baixa:
- `qwen3-vl:4b`
- `qwen2.5-coder:7b`

Para baixar somente o modelo visual:

```powershell
.\scripts\setup-local-ai.ps1 -SkipCoderModel
```

Para baixar somente o modelo de codigo:

```powershell
.\scripts\setup-local-ai.ps1 -SkipVisionModel
```

O instalador oficial do Ollama e utilizado quando o comando `ollama` nao esta disponivel e o WinGet esta instalado. Caso contrario, instale manualmente pelo link oficial.

### 5.3 Instalar a pesquisa web local

Opcional: para hospedar sua propria instancia SearXNG, instale e inicie o Docker Desktop. Depois execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-searxng.ps1
```

O script cria `infra/searxng/.env` com um segredo aleatorio e inicia o SearXNG em `127.0.0.1:8080`. O servico fica vinculado ao loopback e nao e publicado na rede local.

Teste manual:

```powershell
Invoke-RestMethod "http://127.0.0.1:8080/search?q=ollama&format=json"
```

A configuracao `infra/searxng/settings.yml` habilita os formatos HTML e JSON. A API JSON e necessaria para a integracao do Esperto.

Comandos de manutencao:

```powershell
cd infra/searxng
docker compose --env-file .env -f docker-compose.yml ps
docker compose --env-file .env -f docker-compose.yml logs -f
docker compose --env-file .env -f docker-compose.yml down
```

### 5.4 Executar o Esperto

Na raiz do projeto:

```powershell
npm run tauri:dev
```

Para gerar instaladores:

```powershell
npm run tauri:build
```

## 6. Configuracao dentro do Esperto

1. Abra **Configuracoes > Ollama & GPU**.
2. Confirme o endereco `http://127.0.0.1:11434`.
3. Defina a janela de contexto inicial em **4k**.
4. Atualize a lista de modelos instalados.
5. Em **Configuracoes > Modelos & Servidores**, selecione `Ollama: qwen3-vl:4b` para conversas multimodais.
6. Para tarefas de codigo sem imagens, selecione `Ollama: qwen2.5-coder:7b`.
7. Em **Configuracoes > Ollama & GPU**, defina SearXNG como `http://127.0.0.1:8080`.
8. Abra as configuracoes da conversa e habilite **Pesquisa Web em Tempo Real** quando precisar de fontes atuais.

O controle de pesquisa web e por conversa. Ele nao envia automaticamente todas as mensagens para mecanismos externos.

## 7. Imagens e multimodalidade

O provedor Ollama envia anexos de imagem como Base64 no campo `images` da API `/api/chat`. O nome do modelo e verificado para evitar o envio de imagens a modelos textuais sem capacidade visual.

Modelos visuais reconhecidos incluem nomes com `vl`, `vision`, `llava`, `moondream` e `minicpm`. A lista de capacidades exibida pelo Esperto e inferida a partir do identificador do modelo; confirme a ficha do modelo antes de utiliza-lo.

## 8. Pesquisa, privacidade e seguranca

- A inferencia local e realizada pelo Ollama. As mensagens enviadas ao provedor local nao sao submetidas a moderacao de uma API de nuvem, mas o alinhamento e as recusas aprendidas durante o treinamento ainda dependem do modelo; nao existe garantia de comportamento totalmente sem censura.
- A pesquisa web envia a consulta ao SearXNG e aos motores externos configurados nele.
- A recuperacao de paginas envia requisicoes HTTP(S) para os sites selecionados.
- O texto das paginas e tratado como dado nao confiavel, nunca como instrucao de sistema.
- O extrator limita a resposta a 1,5 MB antes de converter HTML em texto e limita o conteudo injetado no prompt.
- URLs com esquemas diferentes de HTTP/HTTPS, hosts locais e enderecos IP privados/loopback sao recusados pelo extrator.
- SearXNG fica exposto somente em `127.0.0.1`.
- Chaves de API e arquivos `.env` nao devem ser versionados.

A validacao de host impede destinos locais explicitos, mas nao substitui um firewall ou uma politica de rede contra DNS malicioso. Nao exponha a instancia SearXNG publicamente sem revisar a documentacao oficial e a configuracao de seguranca.

## 9. Diagnostico

Execute:

```powershell
.\scripts\test-local-ai.ps1
```

Verifique o Ollama:

```powershell
ollama list
ollama ps
nvidia-smi
```

Se o modelo nao utilizar toda a GPU, reduza o contexto para 4k, feche aplicacoes que consomem VRAM e confira a coluna `PROCESSOR` em `ollama ps`.

Se a pesquisa retornar erro:
- Confirme se Docker Desktop esta em execucao.
- Verifique `docker compose logs` em `infra/searxng`.
- Teste `http://127.0.0.1:8080/search?q=test&format=json`.
- Confirme se o campo `search.formats` contem `json`.
- Considere que motores externos podem estar temporariamente indisponiveis ou bloqueando requisicoes.

## 10. Dependencias Python opcionais

A aplicacao desktop nao utiliza Python para inferencia, pesquisa ou leitura de paginas. `requirements.txt` contem somente dependencias do prototipo FastAPI legado em `main.py`; PyTorch foi removido por nao participar do fluxo atual e por adicionar uma instalacao pesada desnecessaria.

Para instalar o ambiente Python opcional:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 11. Estrutura relevante

```text
src/
  components/
  lib/
  services/
    ai.ts
    ollama.ts
    ...
src-tauri/
  src/
    lib.rs
  Cargo.toml
infra/
  searxng/
    docker-compose.yml
    settings.yml
scripts/
  setup-local-ai.ps1
  setup-searxng.ps1
  test-local-ai.ps1
```

## 12. Build e verificacao

```powershell
npm run build
cd src-tauri
cargo check
cd ..
npm run tauri:build
```

A compilacao do frontend e do backend deve ser validada no ambiente Windows de destino, especialmente para conferir toolchain MSVC, WebView2, drivers NVIDIA e o instalador final.

## 13. Licenca

Projeto distribuido sob a licenca MIT. Consulte [LICENSE](LICENSE).

## Configuracao pela interface (Windows)

Na primeira abertura, o Esperto exibe a aba **Ollama & GPU**. Nela voce pode:

1. Instalar o Ollama pelo `winget` (sem abrir PowerShell manualmente).
2. Iniciar o servidor local e verificar se a GPU NVIDIA/VRAM esta visivel via `nvidia-smi`.
3. Baixar os modelos recomendados diretamente da biblioteca Ollama.
4. Pesquisar repositorios publicos GGUF no Hugging Face, selecionar um arquivo, acompanhar o download e importar o GGUF de arquivo unico no Ollama.
5. Usar pesquisa web sem Docker: SearXNG e opcional; quando indisponivel, o Esperto tenta DuckDuckGo como fallback.

O download de modelos exige consentimento do usuario e espaco em disco. O importador Hugging Face atual aceita somente GGUF publico de arquivo unico; repositorios privados/gated, modelos safetensors e modelos multimodais que dependem de projetor separado nao sao importados por esse fluxo. Para modelos de visao como Qwen3-VL, use o perfil recomendado do Ollama.

