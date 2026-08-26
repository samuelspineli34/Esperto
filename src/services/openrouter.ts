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

export async function* streamOpenRouter({
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
    throw new Error('Chave de API do OpenRouter não configurada. Insira sua chave nas Configurações.');
  }

  // Prepara histórico no padrão OpenAI
  const messagesPayload: any[] = [
    {
      role: 'system',
      content: systemInstruction || 'Você é o Esperto, um assistente desktop de inteligência artificial de alta performance.',
    },
  ];

  // Adiciona mensagens anteriores
  history.forEach((m) => {
    messagesPayload.push({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content,
    });
  });

  // Monta a mensagem atual com suporte a texto e imagens em Base64
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
    model: model,
    messages: messagesPayload,
    temperature,
    top_p: topP,
    stream: true,
  };

  if (maxOutputTokens) {
    bodyPayload.max_tokens = maxOutputTokens;
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
      'HTTP-Referer': 'https://github.com/samuelspineli34/Esperto',
      'X-Title': 'Esperto Desktop',
    },
    body: JSON.stringify(bodyPayload),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro OpenRouter (${res.status}): ${errorText}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal?.aborted) break;

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