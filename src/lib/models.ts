export type Provider = 'gemini' | 'openai' | 'anthropic' | 'deepseek';

export interface AIModel {
  id: string;
  name: string;
  provider: Provider;
  description: string;
}

const RAW_MODELS: AIModel[] = [
  // Anthropic Claude
  { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', provider: 'anthropic', description: 'Ultra rápido e econômico' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Referência em codificação e análise' },
  { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet', provider: 'anthropic', description: 'Modelo híbrido com raciocínio adaptativo' },
  { id: 'claude-3-opus-latest', name: 'Claude 3 Opus', provider: 'anthropic', description: 'Raciocínio profundo para tarefas complexas' },

  // DeepSeek
  { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)', provider: 'deepseek', description: 'Excelente custo-benefício e inteligência geral' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)', provider: 'deepseek', description: 'Raciocínio passo a passo (Chain of Thought)' },

  // Google Gemini
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', description: 'Baixíssima latência e multimodal' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', description: 'Excelente equilíbrio de velocidade e capacidade' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', description: 'Raciocínio complexo e contexto gigante' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', provider: 'gemini', description: 'Próxima geração de raciocínio Google' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', provider: 'gemini', description: 'O mais capaz para coding, workflows e agentes' },

  // OpenAI ChatGPT
  { id: 'gpt-4o', name: 'GPT-4o (Omni)', provider: 'openai', description: 'Modelo multimodal carro-chefe da OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Rápido, leve e muito eficiente' },
  { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview', provider: 'openai', description: 'Maior base de conhecimento e empatia' },
  { id: 'o1', name: 'OpenAI o1', provider: 'openai', description: 'Raciocínio lógico e científico avançado' },
  { id: 'o3-mini', name: 'OpenAI o3 Mini', provider: 'openai', description: 'Raciocínio matemático e STEM ultra veloz' },
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