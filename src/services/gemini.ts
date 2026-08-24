import { GoogleGenAI } from '@google/genai';
import { Message } from '../lib/db';

interface StreamOptions {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  history: Message[];
  newMessage: string;
}

export async function* streamGemini({
  apiKey,
  model,
  systemInstruction,
  history,
  newMessage,
}: StreamOptions) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chave de API do Gemini não configurada. Abra as Configurações e cole sua chave.');
  }

  const selectedModel = model.trim() || 'gemini-2.5-flash';
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  const contents = history.map((msg) => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  contents.push({
    role: 'user',
    parts: [{ text: newMessage }],
  });

  try {
    const responseStream = await ai.models.generateContentStream({
      model: selectedModel,
      contents,
      config: {
        systemInstruction: systemInstruction || 'Você é o Esperto, uma entidade oracular de inteligência e sabedoria.',
        temperature: 0.7,
      },
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (err: any) {
    const errMessage = err?.message || JSON.stringify(err);

    if (errMessage.includes('503') || errMessage.includes('high demand')) {
      throw new Error(
        `O modelo '${selectedModel}' está com sobrecarga temporária nos servidores do Google. Tente o 'gemini-2.5-flash' nas Configurações.`
      );
    }

    if (errMessage.includes('429') || errMessage.includes('limit: 0') || errMessage.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(
        `O modelo '${selectedModel}' não possui cota gratuita liberada nesta chave. Alterne para o 'gemini-2.5-flash' nas Configurações.`
      );
    }

    throw new Error(`Erro na API do Gemini: ${errMessage}`);
  }
}