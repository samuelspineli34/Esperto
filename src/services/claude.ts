import { Message, Attachment } from '../lib/db';

interface StreamOptions {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  history: Message[];
  newMessage: string;
  attachments?: Attachment[];
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  thinkingLevel?: string;
  thinkingBudget?: number;
  signal?: AbortSignal;
}

export async function* streamClaude({
  apiKey,
  model,
  systemInstruction,
  history,
  newMessage,
  attachments = [],
  temperature = 0.7,
  topP,
  maxOutputTokens = 4096,
  thinkingLevel = 'off',
  thinkingBudget,
  signal,
}: StreamOptions) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chave de API do Claude não configurada. Abra as Configurações.');
  }

  // Janela deslizante para economizar tokens
  const boundedHistory = history.slice(-10);

  const messagesPayload: any[] = [];

  boundedHistory.forEach((m) => {
    messagesPayload.push({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content,
    });
  });

  // Monta a mensagem atual no formato oficial de blocos de conteúdo da Anthropic
  const contentBlocks: any[] = [];

  // Suporte a Imagens no Claude (PNG, JPG, WEBP, GIF)
  attachments.forEach((att) => {
    if (att.mimeType.startsWith('image/')) {
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: att.mimeType,
          data: att.data,
        },
      });
    }
  });

  contentBlocks.push({
    type: 'text',
    text: newMessage,
  });

  messagesPayload.push({
    role: 'user',
    content: contentBlocks,
  });

  const bodyPayload: any = {
    model: model || 'claude-3-7-sonnet-latest',
    system: systemInstruction || 'Você é o Esperto, um assistente desktop de inteligência artificial de alta performance.',
    messages: messagesPayload,
    max_tokens: maxOutputTokens,
    stream: true,
  };

  // Suporte a Extended Thinking do Claude 3.7 Sonnet
  if (thinkingLevel !== 'off' || thinkingBudget) {
    bodyPayload.thinking = {
      type: 'enabled',
      budget_tokens: thinkingBudget || (thinkingLevel === 'high' ? 8192 : thinkingLevel === 'medium' ? 2048 : 1024),
    };
    // Na API da Anthropic, quando o thinking está ativo a temperature deve ser 1.0
    bodyPayload.temperature = 1.0;
  } else {
    bodyPayload.temperature = temperature;
    if (topP) bodyPayload.top_p = topP;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(bodyPayload),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro Claude (${res.status}): ${errorText}`);
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
      if (trimmed.startsWith('data: ')) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.type === 'content_block_delta' && data.delta?.text) {
            yield data.delta.text;
          }
        } catch (_) {}
      }
    }
  }
}