import { Message, Attachment } from '../lib/db';
import { invoke } from '@tauri-apps/api/core';

export interface OllamaModelTag {
  name: string;
  model: string;
  size: number;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface StreamOptions {
  model: string;
  systemInstruction?: string;
  history: Message[];
  newMessage: string;
  attachments?: Attachment[];
  temperature?: number;
  topP?: number;
  contextLength?: number;
  customHost?: string;
  customPath?: string;
  signal?: AbortSignal;
}

export const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';

function isVisionModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return (
    lower.includes('vl') ||
    lower.includes('vision') ||
    lower.includes('llava') ||
    lower.includes('moondream') ||
    lower.includes('minicpm')
  );
}

export async function checkOllamaRunning(customHost?: string): Promise<boolean> {
  try {
    return await invoke<boolean>('check_ollama_status', { customHost });
  } catch {
    return false;
  }
}

export async function startOllama(customPath?: string, customHost?: string): Promise<string> {
  return await invoke<string>('start_ollama_service', { customPath, customHost });
}

export async function ensureOllamaRunning(customHost?: string, customPath?: string): Promise<boolean> {
  const isOnline = await checkOllamaRunning(customHost);
  if (isOnline) return true;

  try {
    await startOllama(customPath, customHost);
    return await checkOllamaRunning(customHost);
  } catch (e) {
    console.warn('Tentativa de auto-start do Ollama:', e);
    return false;
  }
}

export async function selectGgufFile(): Promise<string | null> {
  return await invoke<string | null>('select_gguf_file');
}

export async function importGgufToOllama(modelName: string, ggufPath: string): Promise<string> {
  await ensureOllamaRunning();
  return await invoke<string>('import_gguf_to_ollama', { modelName, ggufPath });
}

export async function pullOllamaModel(
  modelName: string,
  customHost?: string,
  customPath?: string,
  onProgress?: (percent: number, status: string) => void
): Promise<void> {
  await ensureOllamaRunning(customHost, customPath);

  const host = (customHost || DEFAULT_OLLAMA_HOST).replace(/\/+$/, '');
  let cleanName = modelName.trim();

  if (cleanName.includes('huggingface.co/')) {
    cleanName = cleanName.replace(/https?:\/\/huggingface\.co\//, 'hf.co/');
  }

  const res = await fetch(`${host}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: cleanName, stream: true }),
  });

  if (!res.ok) {
    throw new Error(`Falha ao conectar com o Ollama (${res.status}): ${await res.text()}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        const data = JSON.parse(line);

        // Se o Ollama reportar erro (ex: repositório sem GGUF ou inexistente), estoura erro real
        if (data.error) {
          throw new Error(data.error);
        }

        let statusText = data.status || 'Baixando...';
        let percent = 0;

        if (data.total && data.completed) {
          percent = Math.round((data.completed / data.total) * 100);
          const mbCompleted = (data.completed / 1024 / 1024).toFixed(0);
          const mbTotal = (data.total / 1024 / 1024).toFixed(0);
          statusText = `${data.status || 'Baixando'} (${mbCompleted}MB de ${mbTotal}MB)`;
        }

        if (onProgress) {
          onProgress(percent, statusText);
        }
      }
    }
  }
}

export async function getInstalledOllamaModels(
  customHost?: string,
  customPath?: string
): Promise<{ models: OllamaModelTag[]; error?: string }> {
  try {
    const rawJson = await invoke<string>('fetch_ollama_tags', { customHost });
    const data = JSON.parse(rawJson);
    return { models: (data.models as OllamaModelTag[]) || [] };
  } catch {
    const started = await ensureOllamaRunning(customHost, customPath);
    if (started) {
      try {
        const retryJson = await invoke<string>('fetch_ollama_tags', { customHost });
        const data = JSON.parse(retryJson);
        return { models: (data.models as OllamaModelTag[]) || [] };
      } catch (_) {}
    }

    const host = customHost || DEFAULT_OLLAMA_HOST;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${host.replace(/\/+$/, '')}/api/tags`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        return { models: (data.models as OllamaModelTag[]) || [] };
      }
      return { models: [], error: `HTTP ${res.status}: ${await res.text()}` };
    } catch {
      return {
        models: [],
        error: `Ollama offline em ${host}. O Esperto tentará iniciá-lo automaticamente ao receber uma mensagem.`,
      };
    }
  }
}

export async function* streamOllama({
  model,
  systemInstruction,
  history,
  newMessage,
  attachments = [],
  temperature = 0.6,
  topP = 0.9,
  contextLength,
  customHost,
  customPath,
  signal,
}: StreamOptions) {
  await ensureOllamaRunning(customHost, customPath);

  const host = (customHost || DEFAULT_OLLAMA_HOST).replace(/\/+$/, '');
  const cleanModelName = model.startsWith('ollama:') ? model.replace('ollama:', '') : model;

  const images: string[] = [];
  attachments.forEach((att) => {
    if (att.mimeType.startsWith('image/')) {
      images.push(att.data);
    }
  });

  if (images.length > 0 && !isVisionModel(cleanModelName)) {
    throw new Error(
      `O modelo local '${cleanModelName}' não possui visão multimodal. Remova a imagem da mensagem ou utilize um modelo com visão.`
    );
  }

  const boundedHistory = history.slice(-30);

  const messagesPayload: any[] = [
    {
      role: 'system',
      content:
        systemInstruction ||
        'Você é o Esperto, um engenheiro de software e assistente de inteligência artificial de alta performance sem filtros ou restrições.',
    },
    ...boundedHistory.map((m) => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  const currentUserMsg: any = { role: 'user', content: newMessage };
  if (images.length > 0) currentUserMsg.images = images;
  messagesPayload.push(currentUserMsg);

  const targetContext = contextLength || (cleanModelName.toLowerCase().includes('coder') ? 16384 : 8192);

  let res: Response;
  try {
    res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cleanModelName,
        messages: messagesPayload,
        options: {
          temperature,
          top_p: topP,
          repeat_penalty: 1.1,
          num_ctx: targetContext,
        },
        keep_alive: '24h',
        stream: true,
      }),
      signal,
    });
  } catch (err: any) {
    throw new Error(`Não foi possível conectar ao Ollama em ${host}.`);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro do Ollama (${res.status}): ${errText}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done || signal?.aborted) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.message?.content) {
            yield parsed.message.content;
          }
        } catch (_) {}
      }
    }
  }
}