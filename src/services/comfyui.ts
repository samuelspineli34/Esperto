import { invoke } from '@tauri-apps/api/core';

export interface ComfyServerStatus {
  isOnline: boolean;
  devices: string[];
  version: string;
}

export interface ComfyModelInventory {
  checkpoints: string[];
  diffusion_models: string[];
  text_encoders: string[];
  vaes: string[];
}

export type ComfyModelOption =
  | {
      id: string;
      kind: 'checkpoint';
      name: string;
      label: string;
      description: string;
      recommendedSteps: number;
      recommendedCfg: number;
      samplerName: string;
      scheduler: string;
    }
  | {
      id: string;
      kind: 'flux2';
      name: string;
      label: string;
      description: string;
      textEncoder: string;
      vae: string;
      recommendedSteps: number;
    };

export interface ImageEditOptions {
  host?: string;
  model: ComfyModelOption;
  prompt: string;
  negativePrompt?: string;
  referenceImageBase64?: string;
  denoiseStrength: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  width?: number;
  height?: number;
  onProgress?: (progressPercent: number, status: string) => void;
}

export const DEFAULT_COMFY_HOST = 'http://127.0.0.1:8188';

const normalizeHost = (host: string = DEFAULT_COMFY_HOST) => host.trim().replace(/\/+$/, '');

export async function checkComfyStatus(host: string = DEFAULT_COMFY_HOST): Promise<ComfyServerStatus> {
  try {
    const result = await invoke<any>('check_comfyui_status', { host: normalizeHost(host) });
    return {
      isOnline: Boolean(result?.is_online),
      devices: Array.isArray(result?.devices) ? result.devices : [],
      version: result?.version || '',
    };
  } catch {
    return { isOnline: false, devices: [], version: '' };
  }
}

export async function getComfyModelOptions(host: string = DEFAULT_COMFY_HOST): Promise<{
  inventory: ComfyModelInventory;
  options: ComfyModelOption[];
}> {
  const raw = await invoke<ComfyModelInventory>('comfyui_get_models', { host: normalizeHost(host) });
  const inventory: ComfyModelInventory = {
    checkpoints: raw?.checkpoints || [],
    diffusion_models: raw?.diffusion_models || [],
    text_encoders: raw?.text_encoders || [],
    vaes: raw?.vaes || [],
  };

  // CheckpointLoaderSimple must expose a usable CLIP output. Files that are
  // clearly component-only weights are not full checkpoints and frequently
  // produce CLIP=null at runtime (the exact failure reported by ComfyUI).
  const checkpointCandidates = inventory.checkpoints.filter((name) =>
    !/(^|[\/_ .-])(clip|text[_ -]?encoder|t5|qwen|vae|unet|diffusion[_ -]?model)([\/_ .-]|$)/i.test(name) &&
    !/flux[._ -]?2|flux2.*klein/i.test(name)
  );

  const options: ComfyModelOption[] = checkpointCandidates.map((name): ComfyModelOption => ({
    id: `checkpoint:${name}`,
    kind: 'checkpoint',
    name,
    label: name.replace(/\.safetensors$/i, ''),
    description: /sdxl.*turbo|turbo.*sdxl/i.test(name)
      ? 'SDXL Turbo · checkpoint · 4 passos'
      : 'Checkpoint · modelo completo',
    recommendedSteps: /sdxl.*turbo|turbo.*sdxl/i.test(name) ? 4 : 20,
    recommendedCfg: /sdxl.*turbo|turbo.*sdxl/i.test(name) ? 1.5 : 3.5,
    samplerName: /sdxl.*turbo|turbo.*sdxl/i.test(name) ? 'euler_ancestral' : 'euler',
    scheduler: /sdxl.*turbo|turbo.*sdxl/i.test(name) ? 'sgm_uniform' : 'normal',
  }));

  // FLUX.2 Klein is loaded as a diffusion model + text encoder + VAE,
  // not through CheckpointLoaderSimple. Only offer it when all components exist.
  const fluxUnets = inventory.diffusion_models.filter((name) => /flux.*klein|klein.*flux/i.test(name));
  const fluxClips = inventory.text_encoders.filter((name) => /qwen.*3.*4b|qwen_3_4b/i.test(name));
  const fluxVaes = inventory.vaes.filter((name) => /flux2.*vae|vae.*flux2/i.test(name));

  if (fluxUnets.length && fluxClips.length && fluxVaes.length) {
    for (const name of fluxUnets) {
      const encoder = fluxClips.find((item) => /4b/i.test(item)) || fluxClips[0];
      const vae = fluxVaes[0];
      options.push({
        id: `flux2:${name}`,
        kind: 'flux2',
        name,
        label: name.replace(/\.safetensors$/i, ''),
        description: `FLUX.2 Klein · ${encoder} · ${vae}`,
        textEncoder: encoder,
        vae,
        recommendedSteps: /base/i.test(name) ? 20 : 4,
      });
    }
  }

  return { inventory, options };
}

function buildCheckpointWorkflow(opts: {
  model: Extract<ComfyModelOption, { kind: 'checkpoint' }>;
  uploadedImageName?: string;
  prompt: string;
  negativePrompt: string;
  denoise: number;
  steps: number;
  cfg: number;
  seed: number;
  width: number;
  height: number;
}) {
  const isImg2Img = Boolean(opts.uploadedImageName);
  const graph: Record<string, any> = {
    '1': {
      inputs: { ckpt_name: opts.model.name },
      class_type: 'CheckpointLoaderSimple',
    },
    '2': {
      inputs: { text: opts.prompt, clip: ['1', 1] },
      class_type: 'CLIPTextEncode',
    },
    '3': {
      inputs: { text: opts.negativePrompt, clip: ['1', 1] },
      class_type: 'CLIPTextEncode',
    },
    '4': {
      inputs: {
        seed: opts.seed,
        steps: opts.steps,
        cfg: opts.cfg,
        sampler_name: opts.model.samplerName,
        scheduler: opts.model.scheduler,
        denoise: isImg2Img ? opts.denoise : 1,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: isImg2Img ? ['7', 0] : ['5', 0],
      },
      class_type: 'KSampler',
    },
    '6': { inputs: { samples: ['4', 0], vae: ['1', 2] }, class_type: 'VAEDecode' },
    '8': { inputs: { filename_prefix: 'Esperto', images: ['6', 0] }, class_type: 'SaveImage' },
  };

  if (isImg2Img) {
    graph['9'] = { inputs: { image: opts.uploadedImageName }, class_type: 'LoadImage' };
    graph['7'] = { inputs: { pixels: ['9', 0], vae: ['1', 2] }, class_type: 'VAEEncode' };
  } else {
    graph['5'] = {
      inputs: { width: opts.width, height: opts.height, batch_size: 1 },
      class_type: 'EmptyLatentImage',
    };
  }

  return graph;
}

function buildFlux2KleinWorkflow(opts: {
  model: Extract<ComfyModelOption, { kind: 'flux2' }>;
  uploadedImageName?: string;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  steps: number;
}) {
  const isImg2Img = Boolean(opts.uploadedImageName);
  const graph: Record<string, any> = {
    '94': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'Esperto_FLUX2_Klein', images: ['92:65', 0] },
    },
    '92:61': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    '92:62': {
      class_type: 'Flux2Scheduler',
      inputs: {
        width: isImg2Img ? ['92:81', 0] : opts.width,
        height: isImg2Img ? ['92:81', 1] : opts.height,
        steps: opts.steps,
      },
    },
    '92:63': {
      class_type: 'CFGGuider',
      inputs: {
        cfg: 1,
        model: ['92:70', 0],
        negative: isImg2Img ? ['92:79:76', 0] : ['92:86', 0],
        positive: isImg2Img ? ['92:79:77', 0] : ['92:74', 0],
      },
    },
    '92:64': {
      class_type: 'SamplerCustomAdvanced',
      inputs: {
        guider: ['92:63', 0],
        latent_image: ['92:66', 0],
        noise: ['92:73', 0],
        sampler: ['92:61', 0],
        sigmas: ['92:62', 0],
      },
    },
    '92:65': { class_type: 'VAEDecode', inputs: { samples: ['92:64', 0], vae: ['92:72', 0] } },
    '92:66': {
      class_type: 'EmptyFlux2LatentImage',
      inputs: {
        batch_size: 1,
        width: isImg2Img ? ['92:81', 0] : opts.width,
        height: isImg2Img ? ['92:81', 1] : opts.height,
      },
    },
    '92:70': {
      class_type: 'UNETLoader',
      inputs: { unet_name: opts.model.name, weight_dtype: 'default' },
    },
    '92:71': {
      class_type: 'CLIPLoader',
      inputs: { clip_name: opts.model.textEncoder, device: 'default', type: 'flux2' },
    },
    '92:72': { class_type: 'VAELoader', inputs: { vae_name: opts.model.vae } },
    '92:73': { class_type: 'RandomNoise', inputs: { noise_seed: opts.seed } },
    '92:74': { class_type: 'CLIPTextEncode', inputs: { clip: ['92:71', 0], text: opts.prompt } },
    '92:86': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['92:74', 0] } },
  };

  if (isImg2Img) {
    graph['76'] = { class_type: 'LoadImage', inputs: { image: opts.uploadedImageName } };
    graph['92:80'] = {
      class_type: 'ImageScaleToTotalPixels',
      inputs: { image: ['76', 0], megapixels: 1, resolution_steps: 1, upscale_method: 'nearest-exact' },
    };
    graph['92:81'] = { class_type: 'GetImageSize', inputs: { image: ['92:80', 0] } };
    graph['92:79:78'] = {
      class_type: 'VAEEncode',
      inputs: { pixels: ['92:80', 0], vae: ['92:72', 0] },
    };
    graph['92:79:76'] = {
      class_type: 'ReferenceLatent',
      inputs: { conditioning: ['92:86', 0], latent: ['92:79:78', 0] },
    };
    graph['92:79:77'] = {
      class_type: 'ReferenceLatent',
      inputs: { conditioning: ['92:74', 0], latent: ['92:79:78', 0] },
    };
  }

  return graph;
}

/** True when ComfyUI reports a checkpoint whose loader returned no CLIP. */
export function isCheckpointClipCompatibilityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /clip input is invalid:\s*None|checkpoint does not contain a valid clip|CLIP.*(?:invalid|null|None)/i.test(message);
}

export async function executeComfyWorkflow(opts: ImageEditOptions): Promise<string> {
  const host = normalizeHost(opts.host);
  const steps = Math.max(1, Math.min(50, opts.steps ?? (opts.model.kind === 'flux2' ? 4 : 20)));
  const cfg = opts.model.kind === 'flux2' ? 1 : (opts.cfgScale ?? 3.5);
  const seed = opts.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const width = opts.width ?? 1024;
  const height = opts.height ?? 1024;
  let uploadedFileName: string | undefined;

  if (opts.referenceImageBase64) {
    opts.onProgress?.(10, 'Enviando imagem de referência ao ComfyUI...');
    uploadedFileName = await invoke<string>('comfyui_upload_image', {
      host,
      imageBase64: opts.referenceImageBase64,
      fileName: `esperto_input_${Date.now()}.png`,
    });
  }

  opts.onProgress?.(22, `Preparando workflow para ${opts.model.label}...`);
  const promptGraph = opts.model.kind === 'flux2'
    ? buildFlux2KleinWorkflow({
        model: opts.model,
        uploadedImageName: uploadedFileName,
        prompt: opts.prompt,
        seed,
        width,
        height,
        steps,
      })
    : buildCheckpointWorkflow({
        model: opts.model,
        uploadedImageName: uploadedFileName,
        prompt: opts.prompt,
        negativePrompt: opts.negativePrompt || 'low quality, blurry, distorted, watermark',
        denoise: Math.max(0.05, Math.min(1, opts.denoiseStrength)),
        steps,
        cfg,
        seed,
        width,
        height,
      });

  opts.onProgress?.(30, 'Enviando workflow para a fila do ComfyUI...');
  const promptResponse = await invoke<any>('comfyui_queue_prompt', {
    host,
    payload: { prompt: promptGraph, client_id: crypto.randomUUID() },
  });
  const promptId = promptResponse?.prompt_id;
  if (!promptId || typeof promptId !== 'string') {
    throw new Error('O ComfyUI não retornou um identificador de execução.');
  }

  opts.onProgress?.(35, `Renderizando com ${opts.model.label}...`);
  const startedAt = Date.now();
  const timeoutMs = 10 * 60 * 1000;
  let lastError = '';

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    opts.onProgress?.(
      Math.min(94, 35 + Math.round((elapsedSeconds / 90) * 59)),
      `Processando ${opts.model.label} · ${elapsedSeconds}s`,
    );

    try {
      const history = await invoke<Record<string, any>>('comfyui_get_history', { host, promptId });
      const task = history?.[promptId];
      if (!task) continue;

      if (task.status?.status_str === 'error' || task.status?.completed === false && task.status?.messages?.some((m: any[]) => m?.[0] === 'execution_error')) {
        const details = task.status?.messages?.map((m: any[]) => JSON.stringify(m)).join('\n') || 'O ComfyUI informou uma falha durante a execução.';
        throw new Error(`COMFY_EXECUTION_ERROR: ${details}`);
      }

      if (task.outputs) {
        const imageEntry = Object.values(task.outputs as Record<string, any>)
          .flatMap((output: any) => output?.images || [])[0];
        if (imageEntry?.filename) {
          opts.onProgress?.(97, 'Baixando imagem gerada...');
          const imageData = await invoke<string>('comfyui_get_output_image', {
            host,
            filename: imageEntry.filename,
            subfolder: imageEntry.subfolder || '',
            folderType: imageEntry.type || 'output',
          });
          opts.onProgress?.(100, 'Imagem concluída.');
          return imageData;
        }
      }
    } catch (error: any) {
      lastError = error?.message || String(error);
      if (/COMFY_EXECUTION_ERROR|Value not in list|Prompt outputs failed validation|execution_error/i.test(lastError)) {
        throw new Error(`O workflow foi rejeitado pelo ComfyUI.\n${lastError}`);
      }
    }
  }

  throw new Error(
    `Tempo limite aguardando o ComfyUI finalizar a geração.${lastError ? ` Último erro: ${lastError}` : ''}`,
  );
}
