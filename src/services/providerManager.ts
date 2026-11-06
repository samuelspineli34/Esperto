import type { CustomProviderConfig } from '../lib/db';
import { discoverCustomModels } from './custom';

export interface ProviderHealth {
  ok: boolean;
  latencyMs: number;
  models: string[];
  error?: string;
}

export async function inspectProvider(provider: CustomProviderConfig): Promise<ProviderHealth> {
  const started = performance.now();
  try {
    const models = await discoverCustomModels(provider);
    const latencyMs = Math.round(performance.now() - started);
    return {
      ok: true,
      latencyMs,
      models: models.map((m) => m.id),
    };
  } catch (error: any) {
    const latencyMs = Math.round(performance.now() - started);
    return {
      ok: false,
      latencyMs,
      models: [],
      error: error?.message || 'Falha ao conectar ao servidor.',
    };
  }
}

export function createOpenAICompatibleProvider(input: {
  name: string;
  baseUrl: string;
  apiKey?: string;
}): CustomProviderConfig {
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, '');
  if (!input.name.trim()) throw new Error('Informe um nome para o servidor.');
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error('A URL precisa começar com http:// ou https://');
  }

  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    baseUrl,
    apiKey: input.apiKey?.trim() || '',
    protocol: 'openai-compatible',
    models: [],
    enabled: true,
  };
}
