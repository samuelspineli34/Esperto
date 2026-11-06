
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

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

  // Detecção automática de pedido de imagem.
  const isImageRequest =
    newMessage.toLowerCase().startsWith('gere uma imagem') ||
    newMessage.toLowerCase().startsWith('crie uma imagem') ||
    newMessage.toLowerCase().startsWith('generate an image') ||
    newMessage.toLowerCase().startsWith('desenhe ');

  if (isImageRequest) {
    yield 'Gerando imagem solicitada...\n\n';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [newMessage],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      });

      let imageFound = false;

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            const b64 = part.inlineData.data;

            yield `\n\n![Imagem Gerada](data:${mime};base64,${b64})\n\n`;
            imageFound = true;
          }
        }
      }

      if (!imageFound && response.text) {
        yield response.text;
      } else if (!imageFound) {
        yield 'A IA processou o pedido, mas o provedor não retornou os dados binários da imagem. Tente refinar o prompt.';
      }

      return;
    } catch (imgErr: any) {
      if (signal?.aborted) return;

      yield `\n\n*(Aviso: Falha ao gerar imagem nativa: ${
        imgErr?.message || 'Erro desconhecido'
      }. Tentando processar como chat normal...)*\n\n`;
    }
  }

  // Montagem do histórico.
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

  // Mensagem atual e anexos.
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

  // Configurações do Gemini.
  const config: any = {
    systemInstruction:
      systemInstruction ||
      'Você é o Esperto, um assistente desktop de inteligência artificial de alta performance.',
    temperature,
    topP,
  };

  if (maxOutputTokens) {
    config.maxOutputTokens = maxOutputTokens;
  }

  if (thinkingLevel !== 'off' || thinkingBudget) {
    config.thinkingConfig = {
      thinkingBudget:
        thinkingBudget ||
        (thinkingLevel === 'high'
          ? 8192
          : thinkingLevel === 'medium'
            ? 2048
            : 1024),
    };
  }

  if (googleSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  if (mediaResolution && mediaResolution !== 'default') {
    config.mediaResolution = `MEDIA_RESOLUTION_${mediaResolution.toUpperCase()}`;
  }

  // Tentativas de geração.
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      if (signal?.aborted) return;

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config,
      });

      if (signal?.aborted) return;

      const responseText = response.text;

      if (responseText && responseText.trim().length > 0) {
        yield responseText;
      } else {
        const finishReason = response.candidates?.[0]?.finishReason;

        throw new Error(
          `Gemini não retornou texto. Motivo: ${
            finishReason || 'Resposta vazia'
          }`
        );
      }

      return;
    } catch (err: any) {
      if (signal?.aborted) return;

      attempts++;

      const errMessage = err?.message || JSON.stringify(err);

      const retryable =
        errMessage.includes('429') ||
        errMessage.includes('503') ||
        errMessage.includes('RESOURCE_EXHAUSTED');

      if (retryable && attempts < maxAttempts) {
        yield '\n\n*(Limite temporário da API. Tentando novamente...)*\n\n';

        await sleep(4500);
        continue;
      }

      throw new Error(`Erro Gemini: ${errMessage}`);
    }
  }
}
