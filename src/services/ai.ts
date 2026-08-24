import { Message, Settings } from '../lib/db';
import { getProviderByModel } from '../lib/models';
import { streamGemini } from './gemini';
import { streamClaude } from './claude';
import { streamOpenAI } from './openai';
import { streamDeepSeek } from './deepseek';

interface StreamOptions {
  model: string;
  settings: Settings;
  systemInstruction?: string;
  globalMemory?: string;
  history: Message[];
  newMessage: string;
  useMemory?: boolean;
}

export async function* streamAIResponse({
  model,
  settings,
  systemInstruction,
  globalMemory,
  history,
  newMessage,
  useMemory = true,
}: StreamOptions) {
  const provider = getProviderByModel(model);
  const relevantHistory = useMemory ? history : [];

  let finalSystemInstruction = systemInstruction || 'Você é o Esperto, uma entidade oracular de inteligência e sabedoria.';
  if (globalMemory && globalMemory.trim()) {
    finalSystemInstruction += `\n\n[MEMÓRIA GLOBAL DO USUÁRIO]:\n${globalMemory.trim()}`;
  }

  // 1. Google Gemini (suporta a chave nova e a legada)
  if (provider === 'gemini') {
    const key = settings.geminiApiKey || (settings as any).apiKey;
    if (!key) throw new Error('Chave de API do Gemini não configurada. Abra as Configurações e cole sua chave.');
    yield* streamGemini({
      apiKey: key,
      model,
      systemInstruction: finalSystemInstruction,
      history: relevantHistory,
      newMessage,
    });
    return;
  }

  // 2. Anthropic Claude
  if (provider === 'anthropic') {
    if (!settings.anthropicApiKey) throw new Error('Chave de API do Claude não configurada.');
    yield* streamClaude({
      apiKey: settings.anthropicApiKey,
      model,
      systemInstruction: finalSystemInstruction,
      history: relevantHistory,
      newMessage,
    });
    return;
  }

  // 3. OpenAI ChatGPT
  if (provider === 'openai') {
    if (!settings.openaiApiKey) throw new Error('Chave de API da OpenAI não configurada.');
    yield* streamOpenAI({
      apiKey: settings.openaiApiKey,
      model,
      systemInstruction: finalSystemInstruction,
      history: relevantHistory,
      newMessage,
    });
    return;
  }

  // 4. DeepSeek
  if (provider === 'deepseek') {
    if (!settings.deepseekApiKey) throw new Error('Chave de API da DeepSeek não configurada.');
    yield* streamDeepSeek({
      apiKey: settings.deepseekApiKey,
      model,
      systemInstruction: finalSystemInstruction,
      history: relevantHistory,
      newMessage,
    });
    return;
  }
}