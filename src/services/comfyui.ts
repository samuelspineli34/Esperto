import { invoke } from '@tauri-apps/api/core';

export interface ComfyServerStatus {
  isOnline: boolean;
  devices: string[];
  version: string;
}

export interface ImageEditOptions {
  host?: string;
  model?: 'flux-2-klein' | 'flux-2-klein-distilled';
  prompt: string;
  negativePrompt?: string;
  referenceImageBase64?: string;
  guidanceStrength: number; // 0.05 a 1.0 (força de orientação do prompt)
  steps?: number;
  seed?: number;
  width?: number;
  height?: number;
  onProgress?: (progressPercent: number, status: string) => void;
}

export const DEFAULT_COMFY_HOST = 'http://127.0.0.1:8188';

/**
 * Verifica se a instância do ComfyUI está respondendo.
 */
export async function checkComfyStatus(host: string = DEFAULT_COMFY_HOST): Promise<ComfyServerStatus> {
  try {
    const isOnline = await invoke<boolean>('comfy_check_status', { endpoint: host });
    return { isOnline, devices: [], version: isOnline ? 'ComfyUI conectado' : '' };
  } catch {
    return {
      isOnline: false,
      devices: [],
      version: '',
    };
  }
}

/**
 * Constrói o grafo de nós JSON do ComfyUI otimizado para o FLUX.2 Klein 4B em Image-to-Image / Text-to-Image.
 */
function buildFluxKleinWorkflow(opts: {
  uploadedImageName?: string;
  model: 'flux-2-klein' | 'flux-2-klein-distilled';
  prompt: string;
  negativePrompt?: string;
  steps: number;
  cfg: number;
  seed: number;
  width: number;
  height: number;
}) {
  const isImg2Img = Boolean(opts.uploadedImageName);
  const modelFile = opts.model === 'flux-2-klein-distilled'
    ? 'flux-2-klein-4b-fp8.safetensors'
    : 'flux-2-klein-base-4b-fp8.safetensors';
  const steps = opts.model === 'flux-2-klein-distilled' ? 4 : opts.steps;
  const cfg = opts.model === 'flux-2-klein-distilled' ? 1 : opts.cfg;

  const common = {
    '9': {
      inputs: {
        filename_prefix: 'Esperto_FLUX2_Klein',
        images: ['75:65', 0],
      },
      class_type: 'SaveImage',
    },
    '75:61': {
      inputs: { sampler_name: 'euler' },
      class_type: 'KSamplerSelect',
    },
    '75:62': {
      inputs: {
        height: isImg2Img ? ['75:81', 1] : opts.height,
        steps,
        width: isImg2Img ? ['75:81', 0] : opts.width,
      },
      class_type: 'Flux2Scheduler',
    },
    '75:63': {
      inputs: {
        cfg,
        model: ['75:70', 0],
        negative: isImg2Img ? ['75:79:76', 0] : ['75:67', 0],
        positive: isImg2Img ? ['75:79:77', 0] : ['75:74', 0],
      },
      class_type: 'CFGGuider',
    },
    '75:64': {
      inputs: {
        guider: ['75:63', 0],
        latent_image: ['75:66', 0],
        noise: ['75:73', 0],
        sampler: ['75:61', 0],
        sigmas: ['75:62', 0],
      },
      class_type: 'SamplerCustomAdvanced',
    },
    '75:65': {
      inputs: {
        samples: ['75:64', 0],
        vae: ['75:72', 0],
      },
      class_type: 'VAEDecode',
    },
    '75:67': {
      inputs: {
        clip: ['75:71', 0],
        text: opts.negativePrompt || '',
      },
      class_type: 'CLIPTextEncode',
    },
    '75:70': {
      inputs: {
        unet_name: modelFile,
        weight_dtype: 'default',
      },
      class_type: 'UNETLoader',
    },
    '75:71': {
      inputs: {
        clip_name: 'qwen_3_4b.safetensors',
        device: 'default',
        type: 'flux2',
      },
      class_type: 'CLIPLoader',
    },
    '75:72': {
      inputs: { vae_name: 'flux2-vae.safetensors' },
      class_type: 'VAELoader',
    },
    '75:73': {
      inputs: { noise_seed: opts.seed },
      class_type: 'RandomNoise',
    },
    '75:74': {
      inputs: {
        clip: ['75:71', 0],
        text: opts.prompt,
      },
      class_type: 'CLIPTextEncode',
    },
  } as Record<string, any>;

  if (!isImg2Img) {
    return {
      ...common,
      '75:66': {
        inputs: {
          batch_size: 1,
          height: opts.height,
          width: opts.width,
        },
        class_type: 'EmptyFlux2LatentImage',
      },
    };
  }

  return {
    ...common,
    '76': {
      inputs: { image: opts.uploadedImageName },
      class_type: 'LoadImage',
    },
    '75:66': {
      inputs: {
        batch_size: 1,
        height: ['75:81', 1],
        width: ['75:81', 0],
      },
      class_type: 'EmptyFlux2LatentImage',
    },
    '75:79:76': {
      inputs: {
        conditioning: ['75:67', 0],
        latent: ['75:79:78', 0],
      },
      class_type: 'ReferenceLatent',
    },
    '75:79:77': {
      inputs: {
        conditioning: ['75:74', 0],
        latent: ['75:79:78', 0],
      },
      class_type: 'ReferenceLatent',
    },
    '75:79:78': {
      inputs: {
        pixels: ['75:80', 0],
        vae: ['75:72', 0],
      },
      class_type: 'VAEEncode',
    },
    '75:80': {
      inputs: {
        image: ['76', 0],
        megapixels: 1,
        resolution_steps: 1,
        upscale_method: 'nearest-exact',
      },
      class_type: 'ImageScaleToTotalPixels',
    },
    '75:81': {
      inputs: { image: ['75:80', 0] },
      class_type: 'GetImageSize',
    },
  };
}

export async function executeComfyWorkflow(opts: ImageEditOptions): Promise<string> {
  const host = (opts.host || DEFAULT_COMFY_HOST).replace(/\/+$/, '');
  const steps = opts.steps || 20;
  const seed = opts.seed || Math.floor(Math.random() * 1000000000);
  const width = opts.width || 1024;
  const height = opts.height || 1024;

  let uploadedFileName: string | undefined = undefined;

  if (opts.referenceImageBase64) {
    if (opts.onProgress) opts.onProgress(10, 'Carregando imagem base para o ComfyUI...');
    const tempName = `input_${Date.now()}.png`;
    uploadedFileName = await invoke<string>('comfyui_upload_image', {
      host,
      imageBase64: opts.referenceImageBase64,
      fileName: tempName,
    });
  }

  if (opts.onProgress) opts.onProgress(25, 'Construindo grafo FLUX.2 Klein 4B...');
  const promptGraph = buildFluxKleinWorkflow({
    uploadedImageName: uploadedFileName,
    model: opts.model || 'flux-2-klein',
    prompt: opts.prompt,
    negativePrompt: opts.negativePrompt,
    steps,
    cfg: opts.model === 'flux-2-klein-distilled' ? 1 : 1 + Math.max(0.05, Math.min(1, opts.guidanceStrength)) * 4,
    seed,
    width,
    height,
  });

  const clientId = crypto.randomUUID();

  // Todas as chamadas ao ComfyUI passam pelo backend Rust (sem CORS/WebView2).
  const promptResponse = await invoke<{ prompt_id?: string }>('comfy_queue_prompt', {
    endpoint: host,
    payload: { prompt: promptGraph, client_id: clientId },
  });
  const promptId = promptResponse.prompt_id;
  if (!promptId) throw new Error('ComfyUI não retornou um ID de tarefa válido.');

  if (opts.onProgress) opts.onProgress(35, 'Renderizando tensores com FLUX.2...');

  // Polling ativo do histórico até a imagem ser gerada
  const maxWaitMs = 120000;
  const pollInterval = 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const elapsed = (Date.now() - startTime) / 1000;
    const estimatedPercent = Math.min(92, Math.round(35 + (elapsed / 25) * 55));
    if (opts.onProgress) {
      opts.onProgress(estimatedPercent, `Inferindo ${opts.model === 'flux-2-klein-distilled' ? 'FLUX.2 Klein 4B Distilled' : 'FLUX.2 Klein 4B'} (${elapsed.toFixed(0)}s)...`);
    }

    const historyData = await invoke<Record<string, any>>('comfy_get_history', {
      endpoint: host,
      promptId,
    });
    const task = historyData[promptId];
    if (task?.outputs) {
      for (const outNode of Object.values(task.outputs) as any[]) {
        if (outNode.images?.length) {
          const imgInfo = outNode.images[0];
          opts.onProgress?.(98, 'Baixando imagem resultante...');
          const imageBytes = await invoke<number[]>('comfy_get_view_image', {
            endpoint: host,
            filename: imgInfo.filename,
            subfolder: imgInfo.subfolder || '',
            typeFolder: imgInfo.type || 'output',
          });
          const blob = new Blob([new Uint8Array(imageBytes).buffer as ArrayBuffer], { type: 'image/png' });
          const finalDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Não foi possível converter a imagem gerada.'));
            reader.readAsDataURL(blob);
          });
          opts.onProgress?.(100, 'Renderização concluída!');
          return finalDataUrl;
        }
      }
    }
  }

  throw new Error('Tempo limite excedido aguardando o ComfyUI processar a imagem.');
}