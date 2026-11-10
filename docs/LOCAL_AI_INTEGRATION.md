# Relatorio tecnico — Integracao de IA local e pesquisa web

## Objetivo

Adicionar visao multimodal e pesquisa web ao provedor Ollama existente, preservando a arquitetura desktop Tauri 2 + React + TypeScript e o sistema atual de persistencia e provedores.

## Alteracoes realizadas

| Arquivo | Alteracao |
|---|---|
| `src-tauri/src/lib.rs` | Comandos nativos `search_web` e `fetch_webpage_text`; limites de tamanho, timeout, validacao de esquema e bloqueio de hosts locais explicitos. Corrigida a anotacao Tauri do comando de midia ja existente. |
| `src-tauri/Cargo.toml` | Inclusao de `regex` para remocao de elementos HTML e extracao textual. |
| `src-tauri/Cargo.lock` | Registro de `regex` como dependencia direta do pacote. |
| `src/services/ollama.ts` | Pesquisa opcional via SearXNG, recuperacao de ate duas paginas, contexto de fontes e suporte a imagens no payload Ollama. Tempo de permanencia do modelo reduzido para 10 minutos. |
| `src/services/ai.ts` | Encaminhamento das configuracoes de pesquisa e endpoint SearXNG ao adaptador Ollama. |
| `src/lib/db.ts` | Campo persistente `searxngHost` nas configuracoes. |
| `src/lib/models.ts` | Capacidades de pesquisa habilitadas para Ollama e deteccao de modelos visuais pelos identificadores. |
| `src/components/SettingsModal.tsx` | Endpoint SearXNG, perfis de download e recomendacoes de contexto para GPU de 8 GB. |
| `src/components/RunSettingsDrawer.tsx` | Pesquisa web habilitada para modelos Ollama e textos ajustados para RTX 2060 Super 8 GB. |
| `src/components/ChatMessage.tsx` | Links Markdown das fontes abrem no navegador externo do sistema, limitados a HTTP/HTTPS. |
| `src/App.tsx` | Endpoint SearXNG padrao e contexto inicial de 4.096 tokens. |
| `package.json` / `package-lock.json` | Scripts PowerShell de instalacao/diagnostico e inclusao explicita de `@tauri-apps/api`, ja utilizado pelos imports Tauri do frontend. |
| `infra/searxng/*` | Compose local e configuracao SearXNG com API JSON. |
| `scripts/*` | Instalacao de modelos, inicializacao do SearXNG e diagnostico local. |
| `README.md` | Instalacao, arquitetura, modelos, privacidade, operacao e diagnostico. |
| `requirements.txt` | Dependencias opcionais do prototipo Python; PyTorch removido por nao participar do fluxo desktop. |

## Fluxo de pesquisa

1. O usuario ativa a pesquisa no painel de configuracoes da conversa.
2. `streamOllama` chama o comando Tauri `search_web`.
3. O backend consulta a API JSON do SearXNG.
4. O backend seleciona resultados HTTP(S) publicos e retorna metadados.
5. O cliente recupera o texto de ate duas paginas.
6. O conteudo e delimitado como dado externo nao confiavel e e enviado ao modelo local.
7. O prompt orienta o modelo a citar as URLs fornecidas.

A pesquisa nao e executada automaticamente quando o controle esta desativado.

## Limites intencionais

- O fluxo recupera no maximo dois documentos por mensagem para limitar latencia e uso de contexto.
- O texto extraido de cada pagina e limitado no frontend antes de ser anexado ao prompt.
- O corpo HTTP e limitado a 1,5 MB no backend.
- Paginas que nao retornam HTML/texto sao ignoradas.
- Redirecionamentos para hosts locais explicitos sao bloqueados.
- O bloqueio de hosts locais por nome/IP nao substitui protecao de rede contra DNS rebinding.
- SearXNG depende de mecanismos externos; Google pode sofrer CAPTCHA, bloqueio ou indisponibilidade.
- Pesquisa web nao e equivalente a um browser interativo completo. Nao ha execucao de JavaScript, login, interacao com formularios ou automacao de navegador nesta implementacao.

## Perfil de hardware

Para a RTX 2060 Super 8 GB:
- `qwen3-vl:4b`: perfil multimodal principal.
- `qwen2.5-coder:7b`: perfil alternativo de codigo textual.
- Contexto inicial: 4.096 tokens.
- Um modelo por vez.

O tamanho do arquivo do modelo nao equivale ao consumo total de VRAM. Cache KV, projetor visual, contexto e runtime acrescentam memoria.

## Validacao

A compilacao TypeScript e Rust deve ser concluida em ambiente Windows com Node.js, Rust stable, MSVC Build Tools e WebView2. O ambiente de preparacao utilizado para gerar este pacote nao disponibilizou Cargo e nao concluiu o download das dependencias npm; portanto, nao e correto declarar que `npm run build`, `cargo check` ou o instalador Tauri foram aprovados. As verificacoes estaticas de estrutura e configuracao foram realizadas, mas o build final deve ser executado no Windows de destino conforme o README.
