
import { GoogleGenAI } from '@google/genai';
import { Message, Attachment } from '../lib/db';

interface StreamOptions {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  history: Message[];
  newMessage: string;
  attachments?: Attachment[];
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  thinkingLevel?: string;
  thinkingBudget?: number;
  mediaResolution?: string;
  googleSearch?: boolean;
  signal?: AbortSignal;
}

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface GeminiFailureInfo {
  status: number;
  isQuota: boolean;
  isDailyQuota: boolean;
  retryAfterMs: number;
  message: string;
}

const GEMINI_COOLDOWN_PREFIX = 'esperto:gemini-cooldown:';

function parseRetryDelay(message: string): number {
  const seconds = message.match(/retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/i);
  if (seconds) return Math.max(1_000, Number(seconds[1]) * 1_000);
  const human = message.match(/retry in\s+(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/i);
  if (human) {
    const total = (Number(human[1] || 0) * 3600 + Number(human[2] || 0) * 60 + Number(human[3] || 0)) * 1000;
    if (total > 0) return total;
  }
  return 60_000;
}

function getGeminiFailure(error: unknown): GeminiFailureInfo {
  const raw = error instanceof Error ? error.message : String(error ?? 'Erro desconhecido');
  let parsed: any;
  try {
    const candidate = raw.slice(raw.indexOf('{'));
    parsed = candidate ? JSON.parse(candidate) : undefined;
  } catch {
    parsed = undefined;
  }

  const status = Number((error as any)?.status || (error as any)?.code || parsed?.error?.code || (/\b429\b/.test(raw) ? 429 : 0));
  const quotaText = `${raw} ${JSON.stringify(parsed?.error?.details || [])}`;
  const isQuota = status === 429 || /RESOURCE_EXHAUSTED|quota exceeded|rate.?limit/i.test(quotaText);
  const isDailyQuota = /RequestsPerDay|per day|daily|limit:\s*0/i.test(quotaText);
  return {
    status,
    isQuota,
    isDailyQuota,
    retryAfterMs: parseRetryDelay(raw),
    message: raw,
  };
}

function getCooldownUntil(model: string): number {
  try {
    return Number(localStorage.getItem(`${GEMINI_COOLDOWN_PREFIX}${model}`) || 0);
  } catch {
    return 0;
  }
}

function setCooldown(model: string, durationMs: number): number {
  const until = Date.now() + Math.max(30_000, durationMs);
  try {
    localStorage.setItem(`${GEMINI_COOLDOWN_PREFIX}${model}`, String(until));
  } catch {
    // Storage may be unavailable; the current request still receives a useful error.
  }
  return until;
}

function formatCooldown(until: number): string {
  const seconds = Math.max(1, Math.ceil((until - Date.now()) / 1000));
  if (seconds >= 3600) return `${Math.ceil(seconds / 3600)} hora(s)`;
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} minuto(s)`;
  return `${seconds} segundo(s)`;
}

function throwQuotaError(model: string, failure: GeminiFailureInfo): never {
  const until = setCooldown(model, failure.retryAfterMs);
  const daily = failure.isDailyQuota
    ? 'A cota diária do plano/projeto foi esgotada ou está configurada como zero. Aguardar alguns minutos não resolve uma cota diária zerada.'
    : 'O limite de requisições ou tokens foi atingido.';
  throw new Error(
    `GEMINI_QUOTA_EXCEEDED: ${daily} O Esperto bloqueou novas tentativas para ${model} por aproximadamente ${formatCooldown(until)} para evitar chamadas repetidas. Troque de modelo/provedor ou confira o plano e os limites em https://ai.google.dev/gemini-api/docs/rate-limits e https://ai.dev/rate-limit.`,
  );
}

function assertModelAvailable(model: string) {
  const until = getCooldownUntil(model);
  if (until > Date.now()) {
    throw new Error(
      `GEMINI_COOLDOWN: O modelo ${model} está temporariamente pausado pelo Esperto após atingir a cota. Nova tentativa permitida em aproximadamente ${formatCooldown(until)}. Use outro modelo/provedor enquanto isso.`,
    );
  }
}

export async function* streamGemini({
  apiKey,
  model,
  systemInstruction,
  history,
  newMessage,
  attachments = [],
  temperature = 0.7,
  topP = 0.95,
  maxOutputTokens,
  thinkingLevel = 'off',
  thinkingBudget,
  mediaResolution = 'default',
  googleSearch = false,
  signal,
}: StreamOptions) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chave de API do Gemini não configurada.');
  }

  const selectedModel = model.trim() || 'gemini-3.7-flash';
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  // Detecção automática de pedido de imagem.
  const isImageRequest =
    /(?:gere|gerar|crie|criar|faça|faca|desenhe|generate|draw).{0,40}(?:imagem|image)/i.test(newMessage) ||
    /^(?:imagem|image)\s*:/i.test(newMessage.trim());
  const imageModel = /image/i.test(selectedModel)
    ? selectedModel
    : 'gemini-3-pro-image-preview';

  if (isImageRequest) {
    assertModelAvailable(imageModel);
    yield `Gerando imagem com ${imageModel}...\n\n`;

    try {
      const response = await ai.models.generateContent({
        model: imageModel,
        contents: [newMessage],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      });

      let imageFound = false;

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            const b64 = part.inlineData.data;

            yield `\n\n![Imagem Gerada](data:${mime};base64,${b64})\n\n`;
            imageFound = true;
          }
        }
      }

      if (!imageFound && response.text) {
        yield response.text;
      } else if (!imageFound) {
        yield 'A IA processou o pedido, mas o provedor não retornou os dados binários da imagem. Tente refinar o prompt.';
      }

      return;
    } catch (imgErr: any) {
      if (signal?.aborted) return;
      const failure = getGeminiFailure(imgErr);
      if (failure.isQuota) {
        // Do not fall through to a second Gemini request: it would hit the same
        // exhausted project quota and can amplify rate-limit errors.
        throwQuotaError(imageModel, failure);
      }
      yield `\n\n*(Não foi possível gerar a imagem pelo endpoint de imagem: ${imgErr?.message || 'Erro desconhecido'}. O Esperto não repetiu a chamada de imagem; você pode tentar outro provedor ou usar o Image Studio local.)*\n\n`;
      return;
    }
  }

  // Montagem do histórico.
  const boundedHistory = history.slice(-10);

  const contents = boundedHistory.map((msg) => {
    const parts: any[] = [{ text: msg.content }];

    if (msg.attachments) {
      msg.attachments.forEach((att) => {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data,
          },
        });
      });
    }

    return {
      role: msg.role === 'model' ? 'model' : 'user',
      parts,
    };
  });

  // Mensagem atual e anexos.
  const newParts: any[] = [{ text: newMessage }];

  attachments.forEach((att) => {
    newParts.push({
      inlineData: {
        mimeType: att.mimeType,
        data: att.data,
      },
    });
  });

  contents.push({
    role: 'user',
    parts: newParts,
  });

  // Configurações do Gemini.
  const config: any = {
    systemInstruction:
      systemInstruction ||
      'Você é o Esperto, um assistente desktop de inteligência artificial de alta performance.',
    temperature,
    topP,
  };

  if (maxOutputTokens) {
    config.maxOutputTokens = maxOutputTokens;
  }

  if (thinkingLevel !== 'off' || thinkingBudget) {
    config.thinkingConfig = {
      thinkingBudget:
        thinkingBudget ||
        (thinkingLevel === 'high'
          ? 8192
          : thinkingLevel === 'medium'
            ? 2048
            : 1024),
    };
  }

  if (googleSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  if (mediaResolution && mediaResolution !== 'default') {
    config.mediaResolution = `MEDIA_RESOLUTION_${mediaResolution.toUpperCase()}`;
  }

  // Evita chamadas repetidas quando a API já informou cota esgotada.
  assertModelAvailable(selectedModel);

  // Tentativas de geração.
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      if (signal?.aborted) return;

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config,
      });

      if (signal?.aborted) return;

      const responseText = response.text;

      if (responseText && responseText.trim().length > 0) {
        yield responseText;
      } else {
        const finishReason = response.candidates?.[0]?.finishReason;

        throw new Error(
          `Gemini não retornou texto. Motivo: ${finishReason || 'Resposta vazia'
          }`
        );
      }

      return;
    } catch (err: any) {
      if (signal?.aborted) return;

      attempts++;

      const failure = getGeminiFailure(err);
      const errMessage = failure.message;

      if (failure.isQuota) {
        throwQuotaError(selectedModel, failure);
      }

      const retryableServerError = failure.status === 503 || /\b503\b|UNAVAILABLE|overloaded/i.test(errMessage);
      if (retryableServerError && attempts < 2) {
        yield '\n\n*(O serviço Gemini está temporariamente indisponível. Uma nova tentativa será feita.)*\n\n';
        await sleep(2500);
        continue;
      }

      throw new Error(`Erro Gemini${failure.status ? ` (HTTP ${failure.status})` : ''}: ${errMessage}`);
    }
  }
}
