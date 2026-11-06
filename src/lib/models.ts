import { OllamaModelTag } from '../services/ollama';
import type { CustomProviderConfig } from './db';

export type Provider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'openrouter' | 'ollama' | 'custom';
export type PricingType = 'free_tier' | 'paid_only';

export interface AIModel {
  id: string;
  name: string;
  provider: Provider;
  description: string;
  contextLimit: number;
  pricing: PricingType;
  inputPrice?: number;
  outputPrice?: number;
  priceNote?: string;
  supportsImages: boolean;
  supportsSearch: boolean;
  isLocal?: boolean;
  providerId?: string;
}

export interface ModelCapabilities {
  supportsTemperature: boolean;
  temperatureLockReason?: string;
  supportsThinking: boolean;
  thinkingLockReason?: string;
  supportsSearch: boolean;
  searchLockReason?: string;
  supportsContextAdjustment: boolean;
  contextLockReason?: string;
  supportsMediaResolution: boolean;
  mediaLockReason?: string;
}

export const STATIC_MODELS: AIModel[] = [
  {
    id: 'openrouter/free',
    name: 'OpenRouter: Free Router',
    provider: 'openrouter',
    description: 'Roteador inteligente que seleciona automaticamente o melhor modelo gratuito.',
    contextLimit: 128000,
    pricing: 'free_tier',
    inputPrice: 0,
    outputPrice: 0,
    priceNote: '100% Gratuito',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    provider: 'gemini',
    description: 'Mais moderno da Google para coding, agentes e raciocínio com Thinking.',
    contextLimit: 250000,
    pricing: 'free_tier',
    inputPrice: 0,
    outputPrice: 0,
    priceNote: 'Cota gratuita disponível no AI Studio',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    provider: 'gemini',
    description: 'Rápido, multimodal e estável para tarefas rotineiras de código.',
    contextLimit: 250000,
    pricing: 'free_tier',
    inputPrice: 0,
    outputPrice: 0,
    priceNote: 'Cota gratuita disponível',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet (Direto)',
    provider: 'anthropic',
    description: 'Líder em arquitetura de software com suporte a Extended Thinking.',
    contextLimit: 200000,
    pricing: 'paid_only',
    inputPrice: 3.0,
    outputPrice: 15.0,
    priceNote: '$3.00 / $15.00 por 1M',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet (Direto)',
    provider: 'anthropic',
    description: 'Referência clássica para programação, testes e refatoração.',
    contextLimit: 200000,
    pricing: 'paid_only',
    inputPrice: 3.0,
    outputPrice: 15.0,
    priceNote: '$3.00 / $15.00 por 1M',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Direto)',
    provider: 'openai',
    description: 'Modelo omnimodal equilibrado com excelente interpretação visual.',
    contextLimit: 128000,
    pricing: 'paid_only',
    inputPrice: 2.5,
    outputPrice: 10.0,
    priceNote: '$2.50 / $10.00 por 1M',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'o3-mini',
    name: 'OpenAI o3 Mini',
    provider: 'openai',
    description: 'Raciocínio lógico, matemático e algoritmos via Chain of Thought.',
    contextLimit: 200000,
    pricing: 'paid_only',
    inputPrice: 1.1,
    outputPrice: 4.4,
    priceNote: '$1.10 / $4.40 por 1M',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 (Direto)',
    provider: 'deepseek',
    description: 'Excelente capacidade de raciocínio com custo de inferência ultrabaixo.',
    contextLimit: 64000,
    pricing: 'paid_only',
    inputPrice: 0.14,
    outputPrice: 0.28,
    priceNote: '$0.14 / $0.28 por 1M',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 (Direto)',
    provider: 'deepseek',
    description: 'Raciocínio matemático e algoritmo profundo com passo a passo aberto.',
    contextLimit: 64000,
    pricing: 'paid_only',
    inputPrice: 0.55,
    outputPrice: 2.19,
    priceNote: '$0.55 / $2.19 por 1M',
    supportsImages: false,
    supportsSearch: false,
  },
];

let customModelsCache: AIModel[] = [];
let localOllamaModelsCache: AIModel[] = [];
export let AVAILABLE_MODELS: AIModel[] = [...STATIC_MODELS];

type ModelChangeListener = () => void;
const listeners: ModelChangeListener[] = [];

export function subscribeModelChanges(listener: ModelChangeListener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifyListeners() {
  AVAILABLE_MODELS = [...customModelsCache, ...localOllamaModelsCache, ...STATIC_MODELS];
  listeners.forEach((l) => l());
}

export function registerCustomProviderModels(providers: CustomProviderConfig[] = []) {
  customModelsCache = providers
    .filter((p) => p.enabled !== false)
    .flatMap((provider) =>
      (provider.models || []).map((modelId) => ({
        id: `custom:${provider.id}:${modelId}`,
        name: `${provider.name}: ${modelId}`,
        provider: 'custom' as Provider,
        description: `Servidor OpenAI-compatible: ${provider.baseUrl}`,
        contextLimit: 64000,
        pricing: 'free_tier' as PricingType,
        inputPrice: 0,
        outputPrice: 0,
        priceNote: 'Endpoint Personalizado',
        supportsImages: true,
        supportsSearch: false,
        isLocal: /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/)/i.test(provider.baseUrl),
        providerId: provider.id,
      }))
    );
  notifyListeners();
}

export function registerLocalOllamaModels(tags: OllamaModelTag[]) {
  localOllamaModelsCache = tags.map((t) => {
    const param = t.details?.parameter_size ? ` (${t.details.parameter_size})` : '';
    const quant = t.details?.quantization_level ? ` • ${t.details.quantization_level}` : '';

    let displayName = t.name;
    if (displayName.includes('hf.co/')) {
      const parts = displayName.split('/');
      displayName = parts[parts.length - 1];
    }

    return {
      id: `ollama:${t.name}`,
      name: `Ollama: ${displayName}${param}`,
      provider: 'ollama' as Provider,
      description: `Modelo Local na sua GPU • Sem internet${quant}`,
      contextLimit: 128000,
      pricing: 'free_tier' as PricingType,
      inputPrice: 0,
      outputPrice: 0,
      priceNote: '100% Local (GPU)',
      supportsImages: true,
      supportsSearch: false,
      isLocal: true,
    };
  });

  notifyListeners();
}

export function getProviderByModel(modelId: string): Provider {
  if (modelId.startsWith('custom:')) return 'custom';
  if (modelId.startsWith('ollama:') || modelId.startsWith('ollama')) return 'ollama';
  const found = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (found) return found.provider;
  if (modelId.includes('/')) return 'openrouter';
  if (modelId.startsWith('claude')) return 'anthropic';
  if (modelId.startsWith('deepseek')) return 'deepseek';
  if (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3')) return 'openai';
  return 'gemini';
}

export function getModelInfo(modelId: string, customProviders?: CustomProviderConfig[]): AIModel {
  if (customProviders && customProviders.length > 0 && customModelsCache.length === 0) {
    registerCustomProviderModels(customProviders);
  }

  const found = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (found) return found;

  if (modelId.startsWith('ollama:')) {
    const rawName = modelId.replace('ollama:', '');
    return {
      id: modelId,
      name: `Ollama: ${rawName}`,
      provider: 'ollama',
      description: 'Modelo local executado via Ollama',
      contextLimit: 128000,
      pricing: 'free_tier',
      inputPrice: 0,
      outputPrice: 0,
      priceNote: '100% Local (Offline)',
      supportsImages: true,
      supportsSearch: false,
      isLocal: true,
    };
  }

  return {
    id: modelId,
    name: modelId,
    provider: getProviderByModel(modelId),
    description: 'Modelo configurado',
    contextLimit: 128000,
    pricing: 'paid_only',
    inputPrice: 2.0,
    outputPrice: 8.0,
    supportsImages: true,
    supportsSearch: false,
  };
}

/**
 * Avalia as capacidades de um modelo para aplicar travas e cadeados dinâmicos
 */
export function getModelCapabilities(modelId: string): ModelCapabilities {
  const lower = modelId.toLowerCase();
  const provider = getProviderByModel(modelId);

  // Modelos de raciocínio puro com amostragem fixa (proíbem mexer na temperatura)
  const isReasoningModel =
    lower.includes('deepseek-reasoner') ||
    lower.includes('deepseek-r1') ||
    lower.startsWith('o1') ||
    lower.startsWith('o3');

  // Suporte a Thinking configurável
  const supportsThinking =
    lower.includes('gemini-3') ||
    lower.includes('claude-3-7') ||
    lower.startsWith('o1') ||
    lower.startsWith('o3');

  // Grounding com busca no Google
  const supportsSearch = provider === 'gemini';

  // Ajuste manual de VRAM/contexto
  const supportsContextAdjustment = provider === 'ollama' || provider === 'custom';

  // Multimodal de imagens
  const supportsMediaResolution =
    provider === 'gemini' || lower.includes('vl') || lower.includes('vision') || lower.includes('gpt-4o');

  return {
    supportsTemperature: !isReasoningModel,
    temperatureLockReason: isReasoningModel
      ? 'Modelos de raciocínio usam amostragem fixa para manter a coerência da cadeia lógica.'
      : undefined,

    supportsThinking,
    thinkingLockReason: !supportsThinking
      ? 'Este modelo não possui camada de raciocínio adaptativo (Thinking).'
      : undefined,

    supportsSearch,
    searchLockReason: !supportsSearch
      ? 'A pesquisa no Google (Grounding) é um recurso exclusivo dos modelos Google Gemini.'
      : undefined,

    supportsContextAdjustment,
    contextLockReason: !supportsContextAdjustment
      ? 'Modelos em nuvem possuem janela de contexto pré-fixada pelo provedor.'
      : undefined,

    supportsMediaResolution,
    mediaLockReason: !supportsMediaResolution
      ? 'Modelo textual puro. Não processa imagens ou documentos visuais.'
      : undefined,
  };
}