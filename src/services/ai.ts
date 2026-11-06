import { Message, Settings, Attachment } from '../lib/db';
import { getProviderByModel } from '../lib/models';
import { streamGemini } from './gemini';
import { streamClaude } from './claude';
import { streamOpenAI } from './openai';
import { streamDeepSeek } from './deepseek';
import { streamOpenRouter } from './openrouter';
import { streamOllama } from './ollama';
import { streamCustomProvider } from './custom';

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

  let finalSystemInstruction =
    systemInstruction || 'Você é o Esperto, um assistente desktop de inteligência artificial de alta performance.';

  if (globalMemory && globalMemory.trim()) {
    finalSystemInstruction += `\n\n[MEMÓRIA GLOBAL DO USUÁRIO]:\n${globalMemory.trim()}`;
  }

  if (directoryContext && directoryContext.trim()) {
    finalSystemInstruction += `\n\n[ESTRUTURA E CÓDIGO DO PROJETO LOCAL]:\n${directoryContext.trim()}`;
  }

  // 1. SERVIDOR PERSONALIZADO (OpenAI Compatible)
  if (provider === 'custom') {
    const [, providerId, ...modelParts] = model.split(':');
    const customProvider = settings.customProviders?.find((item) => item.id === providerId);
    if (!customProvider) {
      throw new Error('Servidor personalizado não encontrado. Confira as configurações de modelos.');
    }
    const customModel = modelParts.join(':');
    yield* streamCustomProvider({
      provider: customProvider,
      model: customModel,
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

  // 2. OLLAMA LOCAL (GPU Offline)
  if (provider === 'ollama') {
    yield* streamOllama({
      model,
      systemInstruction: finalSystemInstruction,
      history: relevantHistory,
      newMessage,
      attachments,
      temperature: settings.temperature,
      topP: settings.topP,
      customHost: settings.ollamaHost,
      signal,
    });
    return;
  }

  // 3. OPENROUTER
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

  // 4. GOOGLE GEMINI
  if (provider === 'gemini') {
    const key = settings.geminiApiKey;
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

  // 5. ANTHROPIC CLAUDE
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

  // 6. OPENAI
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

  // 7. DEEPSEEK
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
