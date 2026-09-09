import { Message, Attachment } from '../lib/db';

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

// Usamos 127.0.0.1 fixo para evitar a lentidão de resolução IPv6 do Windows
const OLLAMA_HOST = 'http://127.0.0.1:11434';

export async function checkOllamaOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4 segundos de tolerância

    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    console.warn('[Esperto] Falha ao checar status do Ollama:', err);
    return false;
  }
}

export async function getInstalledOllamaModels(): Promise<OllamaModelTag[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    return (data.models as OllamaModelTag[]) || [];
  } catch (err) {
    console.warn('[Esperto] Erro ao buscar lista de modelos do Ollama:', err);
    return [];
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
  signal,
}: StreamOptions) {
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

  const images: string[] = [];
  attachments.forEach((att) => {
    if (att.mimeType.startsWith('image/')) {
      images.push(att.data);
    }
  });

  const currentUserMsg: any = {
    role: 'user',
    content: newMessage,
  };

  if (images.length > 0) {
    currentUserMsg.images = images;
  }

  messagesPayload.push(currentUserMsg);

  const cleanModelName = model.startsWith('ollama:') ? model.replace('ollama:', '') : model;
  const targetContext = contextLength || (cleanModelName.toLowerCase().includes('14b') ? 8192 : 16384);

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    throw new Error(`Não foi possível conectar ao Ollama em ${OLLAMA_HOST}. Verifique se o comando 'ollama serve' está ativo.`);
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