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

// Função utilitária para chamar a API de Imagem/Vídeo Gratuita do Hugging Face
async function* streamHuggingFaceMedia(prompt: string, hfToken?: string): AsyncGenerator<string> {
  if (!hfToken || !hfToken.trim()) {
    yield `⚠️ Para gerar imagens ou mídias via Hugging Face, insira sua Hugging Face Token nas Configurações (aba Chaves de Nuvem).`;
    return;
  }

  yield `Processando geração multimodal no Hugging Face...\n\n`;

  const isVideo = prompt.toLowerCase().includes('vídeo') || prompt.toLowerCase().includes('video');
  const modelEndpoint = isVideo
    ? 'https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid-xt'
    : 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';

  try {
    const response = await fetch(modelEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Hugging Face erro (${response.status}): ${errText}`);
    }

    const blob = await response.blob();
    const reader = new FileReader();

    const base64Data = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    if (isVideo) {
      yield `\n\n### Vídeo Gerado:\n<video controls src="${base64Data}" class="max-w-md rounded-xl"></video>\n\n`;
    } else {
      yield `\n\n![Imagem Gerada](${base64Data})\n\n`;
    }
  } catch (err: any) {
    yield `\n\n⚠️ Falha na geração de mídia: ${err?.message || err}\n\n`;
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
  if (lowerMsg.startsWith('hf: ') || lowerMsg.startsWith('gerar imagem') || lowerMsg.startsWith('gerar vídeo')) {
    const cleanPrompt = newMessage.replace(/^(hf:\s*|gerar imagem\s*(de)?\s*|gerar vídeo\s*(de)?\s*)/i, '').trim();
    yield* streamHuggingFaceMedia(cleanPrompt, (settings as any).huggingfaceApiKey);
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