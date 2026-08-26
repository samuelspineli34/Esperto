export type Provider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'openrouter' | 'ollama';
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
  // === OPENROUTER - MODELOS 100% GRATUITOS (:free) ===
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'OpenRouter: DeepSeek R1 (Free)',
    provider: 'openrouter',
    description: 'Raciocínio profundo e Chain of Thought sem custos via OpenRouter.',
    contextLimit: 64000,
    pricing: 'free_tier',
    priceNote: '100% Gratuito (:free)',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'OpenRouter: Llama 3.3 70B (Free)',
    provider: 'openrouter',
    description: 'Modelo de código aberto de alto desempenho da Meta sem custos.',
    contextLimit: 131072,
    pricing: 'free_tier',
    priceNote: '100% Gratuito (:free)',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct:free',
    name: 'OpenRouter: Qwen 2.5 Coder 32B (Free)',
    provider: 'openrouter',
    description: 'Especialista em programação e arquitetura de software.',
    contextLimit: 32768,
    pricing: 'free_tier',
    priceNote: '100% Gratuito (:free)',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'OpenRouter: Mistral 7B (Free)',
    provider: 'openrouter',
    description: 'Rápido, leve e eficiente para tarefas gerais e resumos.',
    contextLimit: 32768,
    pricing: 'free_tier',
    priceNote: '100% Gratuito (:free)',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'OpenRouter: Gemini 2.0 Flash Exp (Free)',
    provider: 'openrouter',
    description: 'Versão experimental de alta velocidade do Gemini via OpenRouter.',
    contextLimit: 1048576,
    pricing: 'free_tier',
    priceNote: '100% Gratuito (:free)',
    supportsImages: true,
    supportsSearch: false,
  },

  // === OPENROUTER - MODELOS PREMIUM VIA SALDO UNIFICADO ===
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: 'OpenRouter: Claude 3.7 Sonnet',
    provider: 'openrouter',
    description: 'Claude 3.7 Sonnet híbrido com saldo único do OpenRouter.',
    contextLimit: 200000,
    pricing: 'paid_only',
    priceNote: 'Saldo OpenRouter • ~$3 / $15 por 1M',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'openai/gpt-4o',
    name: 'OpenRouter: GPT-4o',
    provider: 'openrouter',
    description: 'GPT-4o multimodal com saldo único do OpenRouter.',
    contextLimit: 128000,
    pricing: 'paid_only',
    priceNote: 'Saldo OpenRouter',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'mistralai/codestral-2501',
    name: 'OpenRouter: Mistral Codestral 2501',
    provider: 'openrouter',
    description: 'Modelo de ponta da Mistral focado em geração e refatoração de código.',
    contextLimit: 256000,
    pricing: 'paid_only',
    priceNote: 'Saldo OpenRouter',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'meta-llama/llama-3.1-405b-instruct',
    name: 'OpenRouter: Llama 3.1 405B',
    provider: 'openrouter',
    description: 'O maior modelo aberto do mundo com conhecimento enciclopédico.',
    contextLimit: 131072,
    pricing: 'paid_only',
    priceNote: 'Saldo OpenRouter',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    name: 'OpenRouter: Qwen 2.5 72B',
    provider: 'openrouter',
    description: 'Excelente para raciocínio multilíngue, matemática e lógica.',
    contextLimit: 131072,
    pricing: 'paid_only',
    priceNote: 'Saldo OpenRouter',
    supportsImages: false,
    supportsSearch: false,
  },

  // === GOOGLE GEMINI (Nativo) ===
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    provider: 'gemini',
    description: 'Mais avançado para coding, agentes e workflows multi-etapa.',
    contextLimit: 250000,
    pricing: 'free_tier',
    priceNote: 'Cota Grátis disponível • Suporta Thinking e Busca Web',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    provider: 'gemini',
    description: 'Rápido, multimodal, estável e econômico.',
    contextLimit: 250000,
    pricing: 'free_tier',
    priceNote: 'Cota Grátis disponível',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    provider: 'gemini',
    description: 'Ultra rápido e otimizado para alta vazão de mensagens.',
    contextLimit: 250000,
    pricing: 'free_tier',
    priceNote: 'Cota Grátis disponível',
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'gemini',
    description: 'Raciocínio profundo para tarefas de alta complexidade.',
    contextLimit: 200000,
    pricing: 'paid_only',
    priceNote: 'Exige Faturamento no Google Cloud',
    supportsImages: true,
    supportsSearch: true,
  },

  // === ANTHROPIC CLAUDE (Chave Direta) ===
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet (Direto)',
    provider: 'anthropic',
    description: 'Raciocínio adaptativo híbrido via chave direta Anthropic.',
    contextLimit: 200000,
    pricing: 'paid_only',
    priceNote: 'Chave Direta Anthropic',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet (Direto)',
    provider: 'anthropic',
    description: 'Referência da indústria em geração de código e análise.',
    contextLimit: 200000,
    pricing: 'paid_only',
    priceNote: 'Chave Direta Anthropic',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku (Direto)',
    provider: 'anthropic',
    description: 'Ultra veloz e leve para automações.',
    contextLimit: 200000,
    pricing: 'paid_only',
    priceNote: 'Chave Direta Anthropic',
    supportsImages: true,
    supportsSearch: false,
  },

  // === DEEPSEEK (Chave Direta) ===
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 (Direto)',
    provider: 'deepseek',
    description: 'Alta inteligência geral e custo ultrabaixo.',
    contextLimit: 64000,
    pricing: 'paid_only',
    priceNote: 'Chave Direta DeepSeek • ~$0.14 / 1M',
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
    priceNote: 'Chave Direta DeepSeek • ~$0.55 / 1M',
    supportsImages: false,
    supportsSearch: false,
  },

  // === OPENAI (Chave Direta) ===
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Direto)',
    provider: 'openai',
    description: 'Multimodal de ponta da OpenAI.',
    contextLimit: 128000,
    pricing: 'paid_only',
    priceNote: 'Chave Direta OpenAI',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini (Direto)',
    provider: 'openai',
    description: 'Rápido, econômico e com suporte a visão.',
    contextLimit: 128000,
    pricing: 'paid_only',
    priceNote: 'Chave Direta OpenAI',
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'o3-mini',
    name: 'OpenAI o3 Mini (Direto)',
    provider: 'openai',
    description: 'Raciocínio matemático e STEM ultra veloz.',
    contextLimit: 200000,
    pricing: 'paid_only',
    priceNote: 'Chave Direta OpenAI',
    supportsImages: false,
    supportsSearch: false,
  },
  // === OLLAMA LOCAL (100% Offline / Zero Custo) ===
  {
    id: 'ollama:deepseek-r1:8b',
    name: 'Ollama: DeepSeek R1 8B (Local)',
    provider: 'ollama',
    description: 'Roda direto na sua máquina via Ollama local sem gastar tokens.',
    contextLimit: 128000,
    pricing: 'free_tier',
    priceNote: '100% Local (Offline)',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'ollama:llama3.3',
    name: 'Ollama: Llama 3.3 (Local)',
    provider: 'ollama',
    description: 'Modelo Llama 3.3 da Meta rodando direto na sua placa de vídeo/CPU.',
    contextLimit: 128000,
    pricing: 'free_tier',
    priceNote: '100% Local (Offline)',
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'ollama:qwen2.5-coder:7b',
    name: 'Ollama: Qwen 2.5 Coder 7B (Local)',
    provider: 'ollama',
    description: 'Especialista local em código sem envio de dados para a internet.',
    contextLimit: 32768,
    pricing: 'free_tier',
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
    supportsImages: true,
    supportsSearch: true,
  };
}