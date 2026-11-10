import { OllamaModelTag } from '../services/ollama';
import type { CustomProviderConfig, Settings } from './db';

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

// Fallbacks essenciais caso a internet esteja indisponível ao iniciar
const STATIC_FALLBACK_MODELS: AIModel[] = [
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    provider: 'gemini',
    description: 'Mais moderno da Google para coding e agentes.',
    contextLimit: 250000,
    pricing: 'free_tier',
    inputPrice: 0,
    outputPrice: 0,
    priceNote: 'Cota gratuita Google AI Studio',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    description: 'Líder em arquitetura de software.',
    contextLimit: 200000,
    pricing: 'paid_only',
    inputPrice: 3.0,
    outputPrice: 15.0,
    priceNote: 'Anthropic API',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    description: 'Raciocínio lógico e matemático profundo.',
    contextLimit: 64000,
    pricing: 'paid_only',
    inputPrice: 0.55,
    outputPrice: 2.19,
    priceNote: 'DeepSeek API',
    supportsImages: false,
    supportsSearch: false,
  },
];

let customModelsCache: AIModel[] = [];
let localOllamaModelsCache: AIModel[] = [];
let dynamicCloudModelsCache: AIModel[] = [];

export let AVAILABLE_MODELS: AIModel[] = [...STATIC_FALLBACK_MODELS];

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
  const uniqueMap = new Map();
  // Prioridade: Dinâmicos da Nuvem + Customizados + Ollama Local + Fallbacks Estáticos
  [...dynamicCloudModelsCache, ...customModelsCache, ...localOllamaModelsCache, ...STATIC_FALLBACK_MODELS].forEach((m) => {
    if (!uniqueMap.has(m.id)) uniqueMap.set(m.id, m);
  });
  AVAILABLE_MODELS = Array.from(uniqueMap.values());
  listeners.forEach((l) => l());
}

/**
 * Consulta em tempo real as APIs de nuvem para carregar novos modelos sem atualizar o app
 */
export async function loadDynamicCloudModels(settings: Settings) {
  const fetchedModels: AIModel[] = [];

  // 1. OpenRouter (Catálogo público global com centenas de modelos)
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data)) {
        data.data.forEach((m: any) => {
          const isFree = m.id.endsWith(':free') || (m.pricing && parseFloat(m.pricing.prompt || '1') === 0);
          fetchedModels.push({
            id: m.id,
            name: `OpenRouter: ${m.name || m.id}`,
            provider: 'openrouter',
            description: m.description || 'Modelo via OpenRouter Hub',
            contextLimit: m.context_length || 128000,
            pricing: isFree ? 'free_tier' : 'paid_only',
            inputPrice: m.pricing ? parseFloat(m.pricing.prompt || '0') * 1000000 : 2.0,
            outputPrice: m.pricing ? parseFloat(m.pricing.completion || '0') * 1000000 : 8.0,
            priceNote: isFree ? '100% Gratuito (OpenRouter)' : 'Saldo OpenRouter',
            supportsImages: true,
            supportsSearch: false,
          });
        });
      }
    }
  } catch (e) {
    console.warn('OpenRouter dynamic fetch:', e);
  }

  // 2. Google Gemini (Lista modelos dinâmicos da chave do usuário)
  if (settings.geminiApiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${settings.geminiApiKey.trim()}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models)) {
          data.models.forEach((m: any) => {
            const cleanName = m.name?.replace('models/', '') || '';
            if (cleanName) {
              fetchedModels.push({
                id: cleanName,
                name: `Gemini: ${m.displayName || cleanName}`,
                provider: 'gemini',
                description: m.description || 'Modelo oficial Google Gemini',
                contextLimit: m.inputTokenLimit || 250000,
                pricing: 'free_tier',
                inputPrice: 0,
                outputPrice: 0,
                priceNote: 'Cota Google AI Studio',
                supportsImages: true,
                supportsSearch: true,
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('Gemini dynamic fetch:', e);
    }
  }

  // 3. OpenAI (Lista modelos dinâmicos da conta)
  if (settings.openaiApiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${settings.openaiApiKey.trim()}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          data.data.forEach((m: any) => {
            if (m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3') || m.id.includes('chatgpt')) {
              fetchedModels.push({
                id: m.id,
                name: `OpenAI: ${m.id}`,
                provider: 'openai',
                description: 'Modelo oficial OpenAI',
                contextLimit: 128000,
                pricing: 'paid_only',
                inputPrice: 2.5,
                outputPrice: 10.0,
                priceNote: 'Conta OpenAI',
                supportsImages: true,
                supportsSearch: false,
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('OpenAI dynamic fetch:', e);
    }
  }

  // 4. DeepSeek (Lista modelos dinâmicos da conta)
  if (settings.deepseekApiKey) {
    try {
      const res = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${settings.deepseekApiKey.trim()}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const items = data.data || data.models || [];
        if (Array.isArray(items)) {
          items.forEach((m: any) => {
            const mId = m.id || m.name;
            fetchedModels.push({
              id: mId,
              name: `DeepSeek: ${mId}`,
              provider: 'deepseek',
              description: 'Modelo oficial DeepSeek',
              contextLimit: 64000,
              pricing: 'paid_only',
              inputPrice: 0.14,
              outputPrice: 0.28,
              priceNote: 'Conta DeepSeek',
              supportsImages: false,
              supportsSearch: false,
            });
          });
        }
      }
    } catch (e) {
      console.warn('DeepSeek dynamic fetch:', e);
    }
  }

  dynamicCloudModelsCache = fetchedModels;
  notifyListeners();
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
      supportsImages: /vl|vision|llava|moondream|minicpm/i.test(t.name),
      supportsSearch: true,
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
    description: 'Modelo dinâmico',
    contextLimit: 128000,
    pricing: 'paid_only',
    inputPrice: 2.0,
    outputPrice: 8.0,
    supportsImages: true,
    supportsSearch: false,
  };
}

export function getModelCapabilities(modelId: string): ModelCapabilities {
  const lower = modelId.toLowerCase();
  const provider = getProviderByModel(modelId);

  const isReasoningModel =
    lower.includes('deepseek-reasoner') ||
    lower.includes('deepseek-r1') ||
    lower.startsWith('o1') ||
    lower.startsWith('o3');

  const supportsThinking =
    lower.includes('gemini-3') ||
    lower.includes('claude-3-7') ||
    lower.startsWith('o1') ||
    lower.startsWith('o3');

  const supportsSearch = provider === 'gemini' || provider === 'ollama';
  const supportsContextAdjustment = provider === 'ollama' || provider === 'custom';
  const supportsMediaResolution =
    provider === 'gemini' || lower.includes('vl') || lower.includes('vision') || lower.includes('gpt-4o');

  return {
    supportsTemperature: !isReasoningModel,
    temperatureLockReason: isReasoningModel ? 'Modelos de raciocínio usam amostragem fixa.' : undefined,
    supportsThinking,
    thinkingLockReason: !supportsThinking ? 'Este modelo não suporta Thinking/CoT.' : undefined,
    supportsSearch,
    searchLockReason: !supportsSearch ? 'Pesquisa web não disponível para este provedor.' : undefined,
    supportsContextAdjustment,
    contextLockReason: !supportsContextAdjustment ? 'Contexto fixo na nuvem.' : undefined,
    supportsMediaResolution,
    mediaLockReason: !supportsMediaResolution ? 'Modelo textual puro.' : undefined,
  };
}