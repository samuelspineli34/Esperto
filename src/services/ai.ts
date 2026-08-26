import { Message, Settings, Attachment } from '../lib/db';
import { getProviderByModel } from '../lib/models';
import { streamGemini } from './gemini';
import { streamClaude } from './claude';
import { streamOpenAI } from './openai';
import { streamDeepSeek } from './deepseek';
import { streamOpenRouter } from './openrouter';
import { streamOllama } from './ollama'; // <--- Importado

export interface StreamOptions {
  model: string;
  settings: Settings;
  systemInstruction?: string;
  globalMemory?: string;
  directoryContext?: string;
  history: Message[];
  newMessage: string;
  attachments?: Attachment[];
  useMemory?: boolean;
  signal?: AbortSignal;
}

export async function* streamAIResponse({
  model,
  settings,
  systemInstruction,
  globalMemory,
  directoryContext,
  history,
  newMessage,
  attachments = [],
  useMemory = true,
  signal,
}: StreamOptions) {
  const provider = getProviderByModel(model);
  const relevantHistory = useMemory ? history : [];

  let finalSystemInstruction = systemInstruction || 'Você é o Esperto, um assistente desktop de inteligência artificial de alta performance.';
  
  if (globalMemory && globalMemory.trim()) {
    finalSystemInstruction += `\n\n[MEMÓRIA GLOBAL DO USUÁRIO]:\n${globalMemory.trim()}`;
  }

  if (directoryContext && directoryContext.trim()) {
    finalSystemInstruction += `\n\n[BASE DE CONHECIMENTO DO DIRETÓRIO LOCAL]:\n${directoryContext.trim()}`;
  }

  // 0. OLLAMA LOCAL (100% Offline / Gratuito)
  if (provider === 'ollama') {
    yield* streamOllama({
      model,
      systemInstruction: finalSystemInstruction,
      history: relevantHistory,
      newMessage,
      temperature: settings.temperature,
      signal,
    });
    return;
  }

  // 1. OPENROUTER
  if (provider === 'openrouter') {
    if (!settings.openrouterApiKey) {
      throw new Error('Chave de API do OpenRouter não configurada. Abra as Configurações.');
    }
    yield* streamOpenRouter({
      apiKey: settings.openrouterApiKey,
      model,
      systemInstruction: finalSystemInstruction,
      history: relevantHistory,
      newMessage,
      attachments,
      temperature: settings.temperature,
      topP: settings.topP,
      maxOutputTokens: settings.maxOutputTokens,
      signal,
    });
    return;
  }

  // 2. GOOGLE GEMINI
  if (provider === 'gemini') {
    const key = settings.geminiApiKey || (settings as any).apiKey;
    if (!key) throw new Error('Chave de API do Gemini não configurada. Abra as Configurações.');
    yield* streamGemini({
      apiKey: key,
      model,
      systemInstruction: finalSystemInstruction,
      history: relevantHistory,
      newMessage,
      attachments,
      temperature: settings.temperature,
      topP: settings.topP,
      maxOutputTokens: settings.maxOutputTokens,
      thinkingLevel: settings.thinkingLevel,
      thinkingBudget: settings.thinkingBudget,
      mediaResolution: settings.mediaResolution,
      googleSearch: settings.googleSearch,
      signal,
    });
    return;
  }

  // 3. ANTHROPIC CLAUDE
  if (provider === 'anthropic') {
    if (!settings.anthropicApiKey) throw new Error('Chave de API do Claude não configurada.');
    yield* streamClaude({
      apiKey: settings.anthropicApiKey,
      model,
      systemInstruction: finalSystemInstruction,
      history: relevantHistory,
      newMessage,
      attachments,
      temperature: settings.temperature,
      topP: settings.topP,
      maxOutputTokens: settings.maxOutputTokens,
      thinkingLevel: settings.thinkingLevel,
      thinkingBudget: settings.thinkingBudget,
      signal,
    });
    return;
  }

  // 4. OPENAI
  if (provider === 'openai') {
    if (!settings.openaiApiKey) throw new Error('Chave de API da OpenAI não configurada.');
    yield* streamOpenAI({
      apiKey: settings.openaiApiKey,
      model,
      systemInstruction: finalSystemInstruction,
      history: relevantHistory,
      newMessage,
      attachments,
      temperature: settings.temperature,
      topP: settings.topP,
      maxOutputTokens: settings.maxOutputTokens,
      thinkingLevel: settings.thinkingLevel,
      signal,
    });
    return;
  }

  // 5. DEEPSEEK
  if (provider === 'deepseek') {
    if (!settings.deepseekApiKey) throw new Error('Chave de API da DeepSeek não configurada.');
    yield* streamDeepSeek({
      apiKey: settings.deepseekApiKey,
      model,
      systemInstruction: finalSystemInstruction,
      history: relevantHistory,
      newMessage,
      attachments,
      temperature: settings.temperature,
      topP: settings.topP,
      maxOutputTokens: settings.maxOutputTokens,
      signal,
    });
    return;
  }
}