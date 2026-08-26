export type Provider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'openrouter' | 'ollama';
export type PricingType = 'free_tier' | 'paid_only';

export interface AIModel {
  id: string;
  name: string;
  provider: Provider;
  description: string;
  contextLimit: number;
  pricing: PricingType;
  inputPrice?: number; // Preço por 1M tokens de entrada em USD
  outputPrice?: number; // Preço por 1M tokens de saída em USD
  priceNote?: string;
  supportsImages: boolean;
  supportsSearch: boolean;
}

const RAW_MODELS: AIModel[] = [
  // === OPENROUTER - ROTA GRATUITA ===
  {
    id: 'openrouter/free',
    name: 'OpenRouter: Free Models Router',
    provider: 'openrouter',
    description: 'Roteador oficial que seleciona automaticamente o melhor modelo gratuito online.',
    contextLimit: 128000,
    pricing: 'free_tier',
    inputPrice: 0,
    outputPrice: 0,
    priceNote: '100% Gratuito (Rota Oficial)',
    supportsImages: true,
    supportsSearch: false,
  },

  // === GOOGLE GEMINI (Nativo) ===
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    provider: 'gemini',
    description: 'Mais avançado para coding, agentes e raciocínio com suporte a Thinking e Busca.',
    contextLimit: 250000,
    pricing: 'free_tier',
    inputPrice: 0,
    outputPrice: 0,
    priceNote: 'Cota Grátis disponível (250k TPM)',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    provider: 'gemini',
    description: 'Rápido, multimodal, estável e altamente confiável.',
    contextLimit: 250000,
    pricing: 'free_tier',
    inputPrice: 0,
    outputPrice: 0,
    priceNote: 'Cota Grátis disponível',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    provider: 'gemini',
    description: 'Ultra rápido e econômico para grande volume de mensagens.',
    contextLimit: 250000,
    pricing: 'free_tier',
    inputPrice: 0,
    outputPrice: 0,
    priceNote: 'Cota Grátis disponível',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'gemini',
    description: 'Raciocínio complexo e análise multimodal profunda.',
    contextLimit: 200000,
    pricing: 'paid_only',
    inputPrice: 2.00,
    outputPrice: 12.00,
    priceNote: 'Exige Faturamento no Google Cloud',
    supportsImages: true,
    supportsSearch: true,
  },

  // === ANTHROPIC CLAUDE ===
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet (Direto)',
    provider: 'anthropic',
    description: 'Raciocínio adaptativo híbrido e liderança em engenharia de software.',
    contextLimit: 200000,
    pricing: 'paid_only',
    inputPrice: 3.00,
    outputPrice: 15.00,
    priceNote: '$3.00 / $15.00 por 1M',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet (Direto)',
    provider: 'anthropic',
    description: 'Referência em geração de código, refatoração e análise.',
    contextLimit: 200000,
    pricing: 'paid_only',
    inputPrice: 3.00,
    outputPrice: 15.00,
    priceNote: '$3.00 / $15.00 por 1M',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku (Direto)',
    provider: 'anthropic',
    description: 'Ultra veloz e leve para respostas diretas.',
    contextLimit: 200000,
    pricing: 'paid_only',
    inputPrice: 0.80,
    outputPrice: 4.00,
    priceNote: '$0.80 / $4.00 por 1M',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: 'OpenRouter: Claude 3.7 Sonnet',
    provider: 'openrouter',
    description: 'Claude 3.7 Sonnet acessível com saldo único do OpenRouter.',
    contextLimit: 200000,
    pricing: 'paid_only',
    inputPrice: 3.00,
    outputPrice: 15.00,
    priceNote: 'Saldo OpenRouter',
    supportsImages: true,
    supportsSearch: false,
  },

  // === OPENAI CHATGPT ===
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Omni - Direto)',
    provider: 'openai',
    description: 'Multimodal de alto desempenho da OpenAI.',
    contextLimit: 128000,
    pricing: 'paid_only',
    inputPrice: 2.50,
    outputPrice: 10.00,
    priceNote: '$2.50 / $10.00 por 1M',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini (Direto)',
    provider: 'openai',
    description: 'Rápido, leve e muito econômico com suporte a visão.',
    contextLimit: 128000,
    pricing: 'paid_only',
    inputPrice: 0.15,
    outputPrice: 0.60,
    priceNote: '$0.15 / $0.60 por 1M',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'gpt-4.5-preview',
    name: 'GPT-4.5 Preview (Direto)',
    provider: 'openai',
    description: 'Maior modelo da OpenAI com compreensão de nuances avançada.',
    contextLimit: 128000,
    pricing: 'paid_only',
    inputPrice: 75.00,
    outputPrice: 150.00,
    priceNote: 'Modelo Titan de Pesquisa',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'o1',
    name: 'OpenAI o1 (Reasoner)',
    provider: 'openai',
    description: 'Raciocínio lógico e científico de nível avançado.',
    contextLimit: 200000,
    pricing: 'paid_only',
    inputPrice: 15.00,
    outputPrice: 60.00,
    priceNote: 'Raciocínio Avançado',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'o3-mini',
    name: 'OpenAI o3 Mini (STEM)',
    provider: 'openai',
    description: 'Raciocínio matemático e código ultra veloz com Chain of Thought.',
    contextLimit: 200000,
    pricing: 'paid_only',
    inputPrice: 1.10,
    outputPrice: 4.40,
    priceNote: '$1.10 / $4.40 por 1M',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'openai/gpt-4o',
    name: 'OpenRouter: GPT-4o',
    provider: 'openrouter',
    description: 'GPT-4o oficial via saldo único do OpenRouter.',
    contextLimit: 128000,
    pricing: 'paid_only',
    inputPrice: 2.50,
    outputPrice: 10.00,
    priceNote: 'Saldo OpenRouter',
    supportsImages: true,
    supportsSearch: false,
  },

  // === DEEPSEEK ===
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 (Direto)',
    provider: 'deepseek',
    description: 'Alta inteligência geral e custo ultrabaixo.',
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
    description: 'Raciocínio passo a passo profundo (Chain of Thought).',
    contextLimit: 64000,
    pricing: 'paid_only',
    inputPrice: 0.55,
    outputPrice: 2.19,
    priceNote: '$0.55 / $2.19 por 1M',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'OpenRouter: DeepSeek R1',
    provider: 'openrouter',
    description: 'DeepSeek R1 via saldo único do OpenRouter.',
    contextLimit: 64000,
    pricing: 'paid_only',
    inputPrice: 0.55,
    outputPrice: 2.19,
    priceNote: 'Saldo OpenRouter',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'OpenRouter: DeepSeek V3',
    provider: 'openrouter',
    description: 'DeepSeek V3 via saldo único do OpenRouter.',
    contextLimit: 64000,
    pricing: 'paid_only',
    inputPrice: 0.14,
    outputPrice: 0.28,
    priceNote: 'Saldo OpenRouter',
    supportsImages: false,
    supportsSearch: false,
  },

  // === META LLAMA (via OpenRouter) ===
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'OpenRouter: Llama 3.3 70B',
    provider: 'openrouter',
    description: 'O melhor modelo aberto de 70B da Meta para uso geral e código.',
    contextLimit: 131072,
    pricing: 'paid_only',
    inputPrice: 0.40,
    outputPrice: 0.40,
    priceNote: 'Saldo OpenRouter',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'meta-llama/llama-3.1-405b-instruct',
    name: 'OpenRouter: Llama 3.1 405B',
    provider: 'openrouter',
    description: 'O maior modelo aberto do mundo com capacidade comparável ao GPT-4o.',
    contextLimit: 131072,
    pricing: 'paid_only',
    inputPrice: 2.00,
    outputPrice: 2.00,
    priceNote: 'Saldo OpenRouter',
    supportsImages: false,
    supportsSearch: false,
  },

  // === MISTRAL AI ===
  {
    id: 'mistralai/codestral-2501',
    name: 'OpenRouter: Mistral Codestral 2501',
    provider: 'openrouter',
    description: 'Especialista de ponta da Mistral para programação e refatoração.',
    contextLimit: 256000,
    pricing: 'paid_only',
    inputPrice: 0.30,
    outputPrice: 0.90,
    priceNote: 'Saldo OpenRouter',
    supportsImages: false,
    supportsSearch: false,
  },

  // === QWEN ===
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct',
    name: 'OpenRouter: Qwen 2.5 Coder 32B',
    provider: 'openrouter',
    description: 'Um dos modelos mais bem avaliados do mundo para desenvolvimento de software.',
    contextLimit: 32768,
    pricing: 'paid_only',
    inputPrice: 0.20,
    outputPrice: 0.20,
    priceNote: 'Saldo OpenRouter',
    supportsImages: false,
    supportsSearch: false,
  },

  // === OLLAMA (100% Local / Offline) ===
  {
    id: 'ollama:deepseek-r1:8b',
    name: 'Ollama: DeepSeek R1 8B (Local)',
    provider: 'ollama',
    description: 'Roda na sua máquina via Ollama sem internet e sem custo.',
    contextLimit: 128000,
    pricing: 'free_tier',
    inputPrice: 0,
    outputPrice: 0,
    priceNote: '100% Local (Offline)',
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
  if (modelId.startsWith('ollama:')) return 'ollama';
  if (modelId.includes('/')) return 'openrouter';
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
    contextLimit: 200000,
    pricing: 'paid_only',
    inputPrice: 2.50,
    outputPrice: 10.00,
    supportsImages: true,
    supportsSearch: true,
  };
}