import type { Attachment, CustomProviderConfig, Message } from '../lib/db';

export interface CustomModel {
  id: string;
  name: string;
}

function normalizedBaseUrl(value: string): string {
  const base = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) throw new Error('A URL do servidor deve começar com http:// ou https://.');
  return base;
}

function endpoint(base: string, path: string): string {
  // Aceita tanto http://host quanto http://host/v1, sem duplicar /v1.
  return `${base}${path}`;
}

function headers(provider: CustomProviderConfig): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
  };
}

export async function discoverCustomModels(provider: CustomProviderConfig): Promise<CustomModel[]> {
  const base = normalizedBaseUrl(provider.baseUrl);
  if (!base) throw new Error('Informe a URL base do servidor.');
  const response = await fetch(endpoint(base, base.endsWith('/v1') ? '/models' : '/v1/models'), {
    headers: headers(provider),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Falha ao listar modelos (${response.status}): ${await response.text()}`);
  const data = await response.json();
  const items = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
  return items
    .map((item: any) => String(item.id || item.name || ''))
    .filter(Boolean)
    .map((id: string) => ({ id, name: id }));
}

export async function testCustomProvider(provider: CustomProviderConfig): Promise<void> {
  const models = await discoverCustomModels(provider);
  if (!models.length) throw new Error('Servidor respondeu, mas não retornou modelos.');
}

interface StreamOptions {
  provider: CustomProviderConfig;
  model: string;
  systemInstruction: string;
  history: Message[];
  newMessage: string;
  attachments?: Attachment[];
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export async function* streamCustomProvider({
  provider, model, systemInstruction, history, newMessage, attachments = [],
  temperature = 0.7, topP = 0.9, maxOutputTokens, signal,
}: StreamOptions): AsyncGenerator<string> {
  const base = normalizedBaseUrl(provider.baseUrl);
  const messages: any[] = [{ role: 'system', content: systemInstruction }];
  for (const item of history.slice(-30)) {
    messages.push({
      role: item.role === 'model' ? 'assistant' : 'user',
      content: item.content,
    });
  }

  const imageAttachments = attachments.filter((item) => item.mimeType.startsWith('image/'));
  let userContent: any = newMessage;
  if (imageAttachments.length) {
    userContent = [
      { type: 'text', text: newMessage },
      ...imageAttachments.map((item) => ({
        type: 'image_url',
        image_url: { url: `data:${item.mimeType};base64,${item.data}` },
      })),
    ];
  }
  messages.push({ role: 'user', content: userContent });

  const response = await fetch(endpoint(base, base.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions'), {
    method: 'POST',
    headers: headers(provider),
    body: JSON.stringify({
      model,
      messages,
      temperature,
      top_p: topP,
      ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Servidor ${provider.name} retornou ${response.status}: ${await response.text()}`);
  }
  if (!response.body) throw new Error('O servidor não disponibilizou streaming.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || signal?.aborted) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const data = JSON.parse(payload);
          const delta = data.choices?.[0]?.delta?.content;
          if (typeof delta === 'string') yield delta;
          else if (Array.isArray(delta)) {
            for (const part of delta) if (part.type === 'text' && part.text) yield part.text;
          }
        } catch {
          // Ignora frames SSE incompletos ou metadados não textuais.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
