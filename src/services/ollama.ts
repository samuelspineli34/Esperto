import { Message } from '../lib/db';

interface StreamOptions {
  model: string;
  systemInstruction?: string;
  history: Message[];
  newMessage: string;
  temperature?: number;
  signal?: AbortSignal;
}

export async function* streamOllama({
  model,
  systemInstruction,
  history,
  newMessage,
  temperature = 0.7,
  signal,
}: StreamOptions) {
  const boundedHistory = history.slice(-10);

  const messagesPayload = [
    {
      role: 'system',
      content: systemInstruction || 'Você é o Esperto, um assistente desktop de inteligência artificial de alta performance.',
    },
    ...boundedHistory.map((m) => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: newMessage },
  ];

  // Conecta ao servidor local do Ollama
  const cleanModelName = model.replace('ollama:', '');
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cleanModelName,
      messages: messagesPayload,
      options: {
        temperature,
      },
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Erro ao conectar ao Ollama local (porta 11434). Verifique se o Ollama está em execução.`);
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