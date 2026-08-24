import { GoogleGenAI } from '@google/genai';
import { Message } from '../lib/db';

interface StreamOptions {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  history: Message[];
  newMessage: string;
}

export async function* streamGeminiResponse({
  apiKey,
  model,
  systemInstruction,
  history,
  newMessage,
}: StreamOptions) {
  const ai = new GoogleGenAI({ apiKey });

  // Converte o histórico local para o formato do Gemini
  const contents = history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  // Adiciona a nova mensagem do usuário
  contents.push({
    role: 'user',
    parts: [{ text: newMessage }],
  });

  const responseStream = await ai.models.generateContentStream({
    model: model || 'gemini-2.5-flash',
    contents: contents,
    config: {
      systemInstruction: systemInstruction || 'Você é o Esperto, um assistente prestativo, inteligente e direto ao ponto.',
      temperature: 0.7,
    },
  });

  for await (const chunk of responseStream) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}