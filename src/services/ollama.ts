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

export async function getInstalledOllamaModels(
  customHost?: string,
  customPath?: string
): Promise<{ models: OllamaModelTag[]; error?: string }> {
  try {
    const rawJson = await invoke<string>('fetch_ollama_tags', { customHost });
    const data = JSON.parse(rawJson);
    return { models: (data.models as OllamaModelTag[]) || [] };
  } catch {
    try {
      await startOllama(customPath, customHost);
      const retryJson = await invoke<string>('fetch_ollama_tags', { customHost });
      const data = JSON.parse(retryJson);
      return { models: (data.models as OllamaModelTag[]) || [] };
    } catch (rustErr: any) {
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
      } catch (fetchErr: any) {
        return {
          models: [],
          error: `Ollama offline em ${host}. Inicie com 'ollama serve' ou revise as configurações.`,
        };
      }
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
  signal,
}: StreamOptions) {
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
      `O modelo local '${cleanModelName}' não possui visão multimodal. Remova a imagem ou use um modelo com suporte a visão (ex: 'llava', 'qwen2.5-vl' ou Gemini).`
    );
  }

  const boundedHistory = history.slice(-30);

  const messagesPayload: any[] = [
    {
      role: 'system',
      content:
        systemInstruction ||
        'Você é o Esperto, um engenheiro de software e assistente desktop de inteligência artificial de alta performance.',
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
    throw new Error(`Não foi possível conectar ao Ollama em ${host}. Verifique se o servidor está ativo.`);
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
