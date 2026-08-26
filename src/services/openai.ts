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
  signal?: AbortSignal;
}

export async function* streamOpenAI({
  apiKey,
  model,
  systemInstruction,
  history,
  newMessage,
  attachments = [],
  temperature = 0.7,
  topP = 0.95,
  maxOutputTokens,
  thinkingLevel = 'off',
  signal,
}: StreamOptions) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chave de API da OpenAI não configurada. Abra as Configurações.');
  }

  const isReasoningModel = model.startsWith('o1') || model.startsWith('o3');
  const boundedHistory = history.slice(-10);

  const messagesPayload: any[] = [];

  // Modelos o1/o3 usam role 'developer' ou 'system'
  if (systemInstruction && systemInstruction.trim()) {
    messagesPayload.push({
      role: isReasoningModel ? 'developer' : 'system',
      content: systemInstruction,
    });
  }

  boundedHistory.forEach((m) => {
    messagesPayload.push({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content,
    });
  });

  // Monta a mensagem com texto e imagens no padrão OpenAI
  if (attachments.length > 0) {
    const contentParts: any[] = [{ type: 'text', text: newMessage }];
    attachments.forEach((att) => {
      if (att.mimeType.startsWith('image/')) {
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${att.mimeType};base64,${att.data}`,
          },
        });
      }
    });
    messagesPayload.push({ role: 'user', content: contentParts });
  } else {
    messagesPayload.push({ role: 'user', content: newMessage });
  }

  const bodyPayload: any = {
    model: model || 'gpt-4o',
    messages: messagesPayload,
    stream: true,
  };

  if (!isReasoningModel) {
    bodyPayload.temperature = temperature;
    bodyPayload.top_p = topP;
    if (maxOutputTokens) bodyPayload.max_tokens = maxOutputTokens;
  } else {
    // Parâmetro de raciocínio para o1 e o3-mini
    if (thinkingLevel !== 'off') {
      bodyPayload.reasoning_effort = thinkingLevel === 'high' ? 'high' : thinkingLevel === 'medium' ? 'medium' : 'low';
    }
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(bodyPayload),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro OpenAI (${res.status}): ${errorText}`);
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
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          const parsed = JSON.parse(trimmed.replace('data: ', ''));
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            yield content;
          }
        } catch (_) {}
      }
    }
  }
}