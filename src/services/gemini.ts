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
  const ai = new GoogleGenAI({ apiKey });

  const contents = history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  contents.push({
    role: 'user',
    parts: [{ text: newMessage }],
  });

  const responseStream = await ai.models.generateContentStream({
    model: model.trim() || 'gemini-3.7-flash',
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
}