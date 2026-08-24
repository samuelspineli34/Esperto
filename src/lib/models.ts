export type Provider = 'gemini' | 'openai' | 'anthropic' | 'deepseek';

export interface AIModel {
  id: string;
  name: string;
  provider: Provider;
  description: string;
  contextLimit: number; // Limite de tokens
  supportsImages: boolean;
  supportsSearch: boolean;
}

const RAW_MODELS: AIModel[] = [
  // Google Gemini
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    provider: 'gemini',
    description: 'Mais avançado para código, raciocínio híbrido e multimodal',
    contextLimit: 1048576, // 1M tokens
    supportsImages: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    provider: 'gemini',
    description: 'Rápido, multimodal e estável',
    contextLimit: 1048576, // 1M tokens
    supportsImages: true,
    supportsSearch: true,
  },

  // Anthropic Claude
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    description: 'Raciocínio adaptativo híbrido e visão de alta fidelidade',
    contextLimit: 200000,
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Líder em geração de código e análise visual',
    contextLimit: 200000,
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    description: 'Ultra veloz e leve',
    contextLimit: 200000,
    supportsImages: true,
    supportsSearch: false,
  },

  // DeepSeek
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 (Chat)',
    provider: 'deepseek',
    description: 'Alta inteligência geral e custo eficiente',
    contextLimit: 64000,
    supportsImages: false,
    supportsSearch: false,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 (Reasoner)',
    provider: 'deepseek',
    description: 'Raciocínio profundo passo a passo (Chain of Thought)',
    contextLimit: 64000,
    supportsImages: false,
    supportsSearch: false,
  },

  // OpenAI ChatGPT
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Omni)',
    provider: 'openai',
    description: 'Multimodal carro-chefe da OpenAI',
    contextLimit: 128000,
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Rápido, econômico e com suporte a visão',
    contextLimit: 128000,
    supportsImages: true,
    supportsSearch: false,
  },
  {
    id: 'o3-mini',
    name: 'OpenAI o3 Mini',
    provider: 'openai',
    description: 'Raciocínio matemático e STEM',
    contextLimit: 200000,
    supportsImages: false,
    supportsSearch: false,
  },
];

export const AVAILABLE_MODELS: AIModel[] = [...RAW_MODELS].sort((a, b) =>
  a.name.localeCompare(b.name)
);

export function getModelInfo(modelId: string): AIModel {
  const found = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (found) return found;
  return {
    id: modelId,
    name: modelId,
    provider: 'gemini',
    description: 'Modelo customizado',
    contextLimit: 1048576,
    supportsImages: true,
    supportsSearch: true,
  };
}