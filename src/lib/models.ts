export type Provider = 'gemini' | 'openai' | 'anthropic' | 'deepseek';
export type PricingType = 'free_tier' | 'paid_only';

export interface AIModel {
  id: string;
  name: string;
  provider: Provider;
  description: string;
  contextLimit: number;
  pricing: PricingType;
  priceNote?: string;
  supportsImages: boolean;
  supportsSearch: boolean;
}

const RAW_MODELS: AIModel[] = [
  // === GOOGLE GEMINI ===
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    provider: 'gemini',
    description: 'Mais avançado para coding, agentes e workflows multi-etapa.',
    contextLimit: 1048576, // 1M tokens
    pricing: 'free_tier',
    priceNote: 'Cota Grátis disponível • Pago: $0.75 / $3.75',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    provider: 'gemini',
    description: 'Alias dinâmico apontando para o Gemini 3.7 Flash.',
    contextLimit: 1048576,
    pricing: 'free_tier',
    priceNote: 'Cota Grátis disponível',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    provider: 'gemini',
    description: 'Ultra rápido e altamente econômico para alto volume.',
    contextLimit: 250000, // 250k
    pricing: 'free_tier',
    priceNote: 'Cota Grátis • Pago: $0.30 / $2.50',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-flash-lite-latest',
    name: 'Gemini Flash-Lite Latest',
    provider: 'gemini',
    description: 'Alias dinâmico apontando para o 3.5 Flash Lite.',
    contextLimit: 250000,
    pricing: 'free_tier',
    priceNote: 'Cota Grátis disponível',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'gemini',
    description: 'Velocidade base e consistência para tarefas rotineiras.',
    contextLimit: 250000, // 250k
    pricing: 'free_tier',
    priceNote: 'Cota Grátis • Pago: $1.50 / $9.00',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'gemini',
    description: 'Otimizado para tarefas de agentes em lote e traduções.',
    contextLimit: 250000,
    pricing: 'free_tier',
    priceNote: 'Cota Grátis • Pago: $0.25 / $1.50',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    provider: 'gemini',
    description: 'Inteligência de ponta combinada com busca e grounding superior.',
    contextLimit: 250000,
    pricing: 'free_tier',
    priceNote: 'Cota Grátis • Pago: $0.50 / $3.00',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    name: 'Gemini 3.1 Flash Lite Image (Nano 2)',
    provider: 'gemini',
    description: 'Geração e edição visual rápida e leve.',
    contextLimit: 65536,
    pricing: 'free_tier',
    priceNote: 'Cota Grátis • Pago: $0.25 / $1.50',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'gemini',
    description: 'Raciocínio SOTA com profundidade inédita e multimodal avançada.',
    contextLimit: 200000,
    pricing: 'paid_only',
    priceNote: 'Exige Faturamento • $2.00 / $12.00',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-pro-latest',
    name: 'Gemini Pro Latest',
    provider: 'gemini',
    description: 'Alias dinâmico apontando para o Gemini 3.1 Pro Preview.',
    contextLimit: 200000,
    pricing: 'paid_only',
    priceNote: 'Exige Faturamento • $2.00 / $12.00',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.1-flash-image',
    name: 'Gemini 3.1 Flash Image (Nano Banana 2)',
    provider: 'gemini',
    description: 'Inteligência visual de nível Pro com velocidade Flash.',
    contextLimit: 65536,
    pricing: 'paid_only',
    priceNote: 'Exige Faturamento • $0.50 / $3.00',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'gemini-3-pro-image',
    name: 'Gemini 3 Pro Image (Nano Pro)',
    provider: 'gemini',
    description: 'Modelo de ponta para criação e edição de imagens de alta fidelidade.',
    contextLimit: 65536,
    pricing: 'paid_only',
    priceNote: 'Exige Faturamento • $2.00 / $12.00',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'gemini-3.5-live-translate-preview',
    name: 'Gemini 3.5 Live Translate Preview',
    provider: 'gemini',
    description: 'Tradução em tempo real speech-to-speech para 70+ idiomas.',
    contextLimit: 128000,
    pricing: 'paid_only',
    priceNote: 'Exige Faturamento • Áudio: $3.50 / $21.00',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'gemini-robotics-er-2-preview',
    name: 'Gemini Robotics-ER 2 Preview',
    provider: 'gemini',
    description: 'Raciocínio espacial e orquestração de ferramentas multi-robô.',
    contextLimit: 128000,
    pricing: 'paid_only',
    priceNote: 'Exige Faturamento • $2.00 / $10.00',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-omni-flash-preview',
    name: 'Gemini Omni Flash Preview',
    provider: 'gemini',
    description: 'Geração de vídeo poderosa e edição conversacional.',
    contextLimit: 128000,
    pricing: 'paid_only',
    priceNote: 'Exige Faturamento • Vídeo: $17.50',
    supportsImages: true,
    supportsSearch: false,
  },

  // === ANTHROPIC CLAUDE ===
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    description: 'Raciocínio adaptativo híbrido e visão de alta fidelidade.',
    contextLimit: 200000,
    pricing: 'paid_only',
    priceNote: 'API Key Anthropic • $3.00 / $15.00',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Líder em geração de código e análise de dados.',
    contextLimit: 200000,
    pricing: 'paid_only',
    priceNote: 'API Key Anthropic • $3.00 / $15.00',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    description: 'Ultra veloz e leve para automações.',
    contextLimit: 200000,
    pricing: 'paid_only',
    priceNote: 'API Key Anthropic • $0.80 / $4.00',
    supportsImages: true,
    supportsSearch: false,
  },

  // === DEEPSEEK ===
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 (Chat)',
    provider: 'deepseek',
    description: 'Alta inteligência geral e custo ultrabaixo.',
    contextLimit: 64000,
    pricing: 'paid_only',
    priceNote: 'API Key DeepSeek • $0.14 / $0.28',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 (Reasoner)',
    provider: 'deepseek',
    description: 'Raciocínio profundo passo a passo (Chain of Thought).',
    contextLimit: 64000,
    pricing: 'paid_only',
    priceNote: 'API Key DeepSeek • $0.55 / $2.19',
    supportsImages: false,
    supportsSearch: false,
  },

  // === OPENAI ===
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Omni)',
    provider: 'openai',
    description: 'Multimodal de ponta da OpenAI.',
    contextLimit: 128000,
    pricing: 'paid_only',
    priceNote: 'API Key OpenAI • $2.50 / $10.00',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Rápido, econômico e com visão.',
    contextLimit: 128000,
    pricing: 'paid_only',
    priceNote: 'API Key OpenAI • $0.15 / $0.60',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'o3-mini',
    name: 'OpenAI o3 Mini',
    provider: 'openai',
    description: 'Raciocínio matemático e STEM ultra veloz.',
    contextLimit: 200000,
    pricing: 'paid_only',
    priceNote: 'API Key OpenAI • $1.10 / $4.40',
    supportsImages: false,
    supportsSearch: false,
  },
];

export const AVAILABLE_MODELS: AIModel[] = [...RAW_MODELS].sort((a, b) =>
  a.name.localeCompare(b.name)
);

export function getProviderByModel(modelId: string): Provider {
  const found = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (found) return found.provider;
  if (modelId.startsWith('claude')) return 'anthropic';
  if (modelId.startsWith('deepseek')) return 'deepseek';
  if (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3')) return 'openai';
  return 'gemini';
}

export function getModelInfo(modelId: string): AIModel {
  const found = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (found) return found;
  return {
    id: modelId,
    name: modelId,
    provider: getProviderByModel(modelId),
    description: 'Modelo customizado',
    contextLimit: 1048576,
    pricing: 'free_tier',
    supportsImages: true,
    supportsSearch: true,
  };
}