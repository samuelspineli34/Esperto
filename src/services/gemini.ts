import { GoogleGenAI } from '@google/genai';
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
  mediaResolution?: string;
  googleSearch?: boolean;
  signal?: AbortSignal;
}

// Função auxiliar para aguardar milissegundos
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function* streamGemini({
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
  thinkingBudget,
  mediaResolution = 'default',
  googleSearch = false,
  signal,
}: StreamOptions) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chave de API do Gemini não configurada.');
  }

  const selectedModel = model.trim() || 'gemini-3.7-flash';
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  // Janela deslizante: limita o histórico enviado a no máximo as últimas 10 mensagens para economizar cota TPM
  const boundedHistory = history.slice(-10);

  const contents = boundedHistory.map((msg) => {
    const parts: any[] = [{ text: msg.content }];
    if (msg.attachments) {
      msg.attachments.forEach((att) => {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data,
          },
        });
      });
    }
    return {
      role: msg.role === 'model' ? 'model' : 'user',
      parts,
    };
  });

  const newParts: any[] = [{ text: newMessage }];
  attachments.forEach((att) => {
    newParts.push({
      inlineData: {
        mimeType: att.mimeType,
        data: att.data,
      },
    });
  });

  contents.push({
    role: 'user',
    parts: newParts,
  });

  const config: any = {
    systemInstruction: systemInstruction || 'Você é o Esperto, um assistente desktop de inteligência artificial de alta performance.',
    temperature,
    topP,
  };

  if (maxOutputTokens) config.maxOutputTokens = maxOutputTokens;
  if (thinkingLevel !== 'off' || thinkingBudget) {
    config.thinkingConfig = {
      thinkingBudget: thinkingBudget || (thinkingLevel === 'high' ? 8192 : thinkingLevel === 'medium' ? 2048 : 1024),
    };
  }
  if (googleSearch) config.tools = [{ googleSearch: {} }];
  if (mediaResolution && mediaResolution !== 'default') {
    config.mediaResolution = `MEDIA_RESOLUTION_${mediaResolution.toUpperCase()}`;
  }

  // AUTO-RETRY: Tenta até 3 vezes caso o Google dê erro 429 ou 503 temporário
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model: selectedModel,
        contents,
        config,
      });

      for await (const chunk of responseStream) {
        if (signal?.aborted) break;
        if (chunk.text) {
          yield chunk.text;
        }
      }
      return; // Sucesso, encerra o gerador
    } catch (err: any) {
      if (signal?.aborted) return;
      attempts++;
      const errMessage = err?.message || JSON.stringify(err);

      // Se for erro de cota por minuto (429) ou sobrecarga (503), aguarda e tenta novamente
      if ((errMessage.includes('429') || errMessage.includes('503') || errMessage.includes('RESOURCE_EXHAUSTED')) && attempts < maxAttempts) {
        // Aguarda 4 segundos antes de retentar
        yield `\n\n*(Aguardando cota da API gratuita liberar em instantes...)*\n\n`;
        await sleep(4500);
        continue;
      }

      throw new Error(`Erro Gemini: ${errMessage}`);
    }
  }
}