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
  signal?: AbortSignal;
}

const OLLAMA_HOST = 'http://127.0.0.1:11434';

// Detecta se o modelo tem visão (capacidade multimodal)
function isVisionModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return lower.includes('vl') || lower.includes('vision') || lower.includes('llava') || lower.includes('moondream') || lower.includes('minicpm');
}

export async function getInstalledOllamaModels(): Promise<{ models: OllamaModelTag[]; error?: string }> {
  try {
    const rawJson = await invoke<string>('fetch_ollama_tags');
    const data = JSON.parse(rawJson);
    return { models: (data.models as OllamaModelTag[]) || [] };
  } catch (initialErr: any) {
    try {
      await invoke('start_ollama_service');
      const retryJson = await invoke<string>('fetch_ollama_tags');
      const data = JSON.parse(retryJson);
      return { models: (data.models as OllamaModelTag[]) || [] };
    } catch (rustErr: any) {
      const rustMsg = rustErr?.toString() || '';
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
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
          error: `Ollama offline. Falha ao auto-iniciar: ${rustMsg}`,
        };
      }
    }
  }
}

export async function checkOllamaOnline(): Promise<boolean> {
  const result = await getInstalledOllamaModels();
  return !result.error && Array.isArray(result.models);
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
  signal,
}: StreamOptions) {
  const cleanModelName = model.startsWith('ollama:') ? model.replace('ollama:', '') : model;

  const images: string[] = [];
  attachments.forEach((att) => {
    if (att.mimeType.startsWith('image/')) {
      images.push(att.data);
    }
  });

  // Proteção Amigável: Avisa antes de quebrar se tentar mandar imagem para modelo que só lê texto
  if (images.length > 0 && !isVisionModel(cleanModelName)) {
    throw new Error(
      `O modelo local '${cleanModelName}' é focado em texto/código e NÃO suporta imagens. ` +
      `Remova o anexo de imagem da mensagem, ou use um modelo com suporte a visão (como o Gemini 3.7 Flash ou o modelo local 'qwen2-vl').`
    );
  }

  const boundedHistory = history.slice(-25);

  const messagesPayload: any[] = [
    {
      role: 'system',
      content: systemInstruction || 'Você é o Esperto, um assistente desktop de inteligência artificial de alta performance focado em código e raciocínio.',
    },
    ...boundedHistory.map((m) => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  const currentUserMsg: any = { role: 'user', content: newMessage };
  if (images.length > 0) currentUserMsg.images = images;
  messagesPayload.push(currentUserMsg);

  const targetContext = contextLength || (cleanModelName.toLowerCase().includes('14b') ? 8192 : 16384);

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cleanModelName,
        messages: messagesPayload,
        options: {
          temperature,
          top_p: topP,
          top_k: 40,
          repeat_penalty: 1.1,
          num_ctx: targetContext,
          num_predict: -1,
          num_thread: 6,
        },
        keep_alive: '24h',
        stream: true,
      }),
      signal,
    });
  } catch (err: any) {
    throw new Error(`Não foi possível conectar ao Ollama em ${OLLAMA_HOST}. Verifique se o servidor está ativo.`);
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