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
  signal?: AbortSignal;
}

export async function* streamDeepSeek({
  apiKey,
  model,
  systemInstruction,
  history,
  newMessage,
  attachments = [],
  temperature = 0.7,
  topP = 0.95,
  maxOutputTokens,
  signal,
}: StreamOptions) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chave de API da DeepSeek não configurada. Abra as Configurações.');
  }

  const boundedHistory = history.slice(-10);

  const messagesPayload: any[] = [
    {
      role: 'system',
      content: systemInstruction || 'Você é o Esperto, um assistente desktop de inteligência artificial de alta performance.',
    },
  ];

  boundedHistory.forEach((m) => {
    messagesPayload.push({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content,
    });
  });

  // DeepSeek API oficial aceita texto puro
  let finalPrompt = newMessage;
  if (attachments.length > 0) {
    const textAttachments = attachments.filter((a) => !a.mimeType.startsWith('image/'));
    if (textAttachments.length > 0) {
      finalPrompt += '\n\n=== ANEXOS DE TEXTO ===\n';
      textAttachments.forEach((att) => {
        finalPrompt += `\n[${att.name}]:\n${atob(att.data)}\n`;
      });
    }
  }

  messagesPayload.push({ role: 'user', content: finalPrompt });

  const bodyPayload: any = {
    model: model || 'deepseek-chat',
    messages: messagesPayload,
    temperature,
    top_p: topP,
    stream: true,
  };

  if (maxOutputTokens) bodyPayload.max_tokens = maxOutputTokens;

  const res = await fetch('https://api.deepseek.com/chat/completions', {
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
    throw new Error(`Erro DeepSeek (${res.status}): ${errorText}`);
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
          const delta = parsed.choices?.[0]?.delta;
          // DeepSeek R1 pode enviar reasoning_content ou content
          const content = delta?.content || delta?.reasoning_content || '';
          if (content) {
            yield content;
          }
        } catch (_) {}
      }
    }
  }
}