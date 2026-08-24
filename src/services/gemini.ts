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

  const contents = history.map((msg) => {
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
    systemInstruction: systemInstruction || 'Você é o Esperto, uma entidade oracular de inteligência e sabedoria.',
    temperature,
    topP,
  };

  if (maxOutputTokens) config.maxOutputTokens = maxOutputTokens;

  // Thinking Config (Gemini 3.7 Flash)
  if (thinkingLevel !== 'off' || thinkingBudget) {
    config.thinkingConfig = {
      thinkingBudget: thinkingBudget || (thinkingLevel === 'high' ? 8192 : thinkingLevel === 'medium' ? 2048 : 1024),
    };
  }

  if (googleSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  if (mediaResolution && mediaResolution !== 'default') {
    config.mediaResolution = `MEDIA_RESOLUTION_${mediaResolution.toUpperCase()}`;
  }

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
  } catch (err: any) {
    if (signal?.aborted) return;
    const errMessage = err?.message || JSON.stringify(err);
    throw new Error(`Erro Gemini: ${errMessage}`);
  }
}