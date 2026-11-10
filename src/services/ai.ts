import { Message, Settings, Attachment } from '../lib/db';
import { getProviderByModel } from '../lib/models';
import { streamGemini } from './gemini';
import { streamClaude } from './claude';
import { streamOpenAI } from './openai';
import { streamDeepSeek } from './deepseek';
import { streamOpenRouter } from './openrouter';
import { streamOllama } from './ollama';
import { streamCustomProvider } from './custom';
import { invoke } from '@tauri-apps/api/core';

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

// Roteador Multimídia do Hugging Face (Suporta Texto->Imagem e Imagem->Vídeo)
async function* streamHuggingFaceMedia(
  prompt: string,
  attachments: Attachment[] = [],
  hfToken?: string
): AsyncGenerator<string> {
  if (!hfToken || !hfToken.trim()) {
    yield `⚠️ Configure sua Hugging Face Token nas Configurações.`;
    return;
  }

  yield `Consultando motor de mídia...`;

  try {
    // Agora usamos o backend Rust para buscar a imagem, evitando erros de CORS do browser
    const base64Data = await invoke<string>('fetch_media_from_hf', { 
      prompt, 
      token: hfToken,
      isVideo: prompt.toLowerCase().includes('vídeo')
    });

    if (prompt.toLowerCase().includes('vídeo')) {
      yield `\n\n### Vídeo Gerado:\n<video controls src="${base64Data}" class="max-w-md rounded-xl"></video>\n\n`;
    } else {
      yield `\n\n![Imagem Gerada](${base64Data})\n\n`;
    }
  } catch (err: any) {
    yield `\n\n Erro na renderização: ${err?.toString()}\n\n`;
  }
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
  const lowerMsg = newMessage.toLowerCase();
  if (lowerMsg.includes('crie uma imagem') || lowerMsg.includes('gerar imagem')) {
      const cleanPrompt = newMessage.replace(/.*?(crie uma imagem|gerar imagem)\s*(de|do|da)?\s*/i, '').trim();
      yield* streamHuggingFaceMedia(cleanPrompt, attachments, settings.huggingfaceApiKey);
      return;
  }
  

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

  if (provider === 'ollama') {
    yield* streamOllama({
      model,
      systemInstruction: finalSystemInstruction,
      history: relevantHistory,
      newMessage,
      attachments,
      temperature: settings.temperature,
      topP: settings.topP,
      contextLength: settings.ollamaContextLength || 8192,
      customHost: settings.ollamaHost,
      customPath: settings.ollamaCustomPath,
      googleSearch: settings.googleSearch,
      searxngHost: settings.searxngHost,
      signal,
    });
    return;
  }

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