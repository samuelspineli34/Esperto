import { GoogleGenAI } from '@google/genai';
import { Message, Attachment } from '../lib/db';

interface StreamOptions {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  history: Message[];
  newMessage: string;
  attachments?: Attachment[];
  mediaResolution?: string;
  googleSearch?: boolean;
  thinkingLevel?: string;
}

export async function* streamGemini({
  apiKey,
  model,
  systemInstruction,
  history,
  newMessage,
  attachments = [],
  mediaResolution = 'default',
  googleSearch = false,
  thinkingLevel = 'off',
}: StreamOptions) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chave de API do Gemini não informada.');
  }

  const selectedModel = model.trim() || 'gemini-3.7-flash';
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  // 1. Converte histórico com textos e anexos passados
  const contents = history.map((msg) => {
    const parts: any[] = [{ text: msg.content }];
    if (msg.attachments && msg.attachments.length > 0) {
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

  // 2. Adiciona a nova mensagem com os novos anexos
  const newParts: any[] = [{ text: newMessage }];
  if (attachments.length > 0) {
    attachments.forEach((att) => {
      newParts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data,
        },
      });
    });
  }

  contents.push({
    role: 'user',
    parts: newParts,
  });

  // 3. Monta configuração com Google Search e Resolução de Mídia
  const config: any = {
    systemInstruction: systemInstruction || 'Você é o Esperto, uma entidade oracular de inteligência e sabedoria.',
    temperature: 0.7,
  };

  // Google Search Grounding
  if (googleSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  // Resolução de Mídia
  if (mediaResolution && mediaResolution !== 'default') {
    const resMap: Record<string, string> = {
      low: 'MEDIA_RESOLUTION_LOW',
      medium: 'MEDIA_RESOLUTION_MEDIUM',
      high: 'MEDIA_RESOLUTION_HIGH',
    };
    config.mediaResolution = resMap[mediaResolution];
  }

  try {
    const responseStream = await ai.models.generateContentStream({
      model: selectedModel,
      contents,
      config,
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (err: any) {
    const errMessage = err?.message || JSON.stringify(err);
    if (errMessage.includes('503') || errMessage.includes('high demand')) {
      throw new Error(`⚠️ O modelo '${selectedModel}' está sobrecarregado no Google. Tente o 'gemini-3.6-flash'.`);
    }
    throw new Error(`Erro Gemini: ${errMessage}`);
  }
}