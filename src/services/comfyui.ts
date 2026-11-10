import { invoke } from '@tauri-apps/api/core';

export interface ComfyServerStatus {
  isOnline: boolean;
  devices: string[];
  version: string;
}

export interface ImageEditOptions {
  host?: string;
  prompt: string;
  negativePrompt?: string;
  referenceImageBase64?: string;
  denoiseStrength: number; // 0.05 a 1.0 (intensidade da alteração)
  steps?: number;
  cfgScale?: number;
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
    const res: any = await invoke('check_comfyui_status', { host });
    return {
      isOnline: Boolean(res.is_online),
      devices: res.devices || [],
      version: res.version || 'v0.2.x',
    };
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
  prompt: string;
  negativePrompt?: string;
  denoise: number;
  steps: number;
  cfg: number;
  seed: number;
  width: number;
  height: number;
}) {
  const isImg2Img = Boolean(opts.uploadedImageName);

  if (isImg2Img) {
    // Pipeline FLUX.2 Klein Image-to-Image
    return {
      "3": {
        "inputs": {
          "seed": opts.seed,
          "steps": opts.steps,
          "cfg": opts.cfg,
          "sampler_name": "euler",
          "scheduler": "simple",
          "denoise": opts.denoise,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["12", 0]
        },
        "class_type": "KSampler"
      },
      "4": {
        "inputs": {
          "ckpt_name": "flux2-klein-4b.safetensors"
        },
        "class_type": "CheckpointLoaderSimple"
      },
      "6": {
        "inputs": {
          "text": opts.prompt,
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
          "text": opts.negativePrompt || "low quality, blurry, artifact, distorted",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "8": {
        "inputs": {
          "samples": ["3", 0],
          "vae": ["4", 2]
        },
        "class_type": "VAEDecode"
      },
      "9": {
        "inputs": {
          "filename_prefix": "Esperto_FLUX_Klein",
          "images": ["8", 0]
        },
        "class_type": "SaveImage"
      },
      "10": {
        "inputs": {
          "image": opts.uploadedImageName
        },
        "class_type": "LoadImage"
      },
      "12": {
        "inputs": {
          "pixels": ["10", 0],
          "vae": ["4", 2]
        },
        "class_type": "VAEEncode"
      }
    };
  }

  // Pipeline FLUX.2 Klein Text-to-Image
  return {
    "3": {
      "inputs": {
        "seed": opts.seed,
        "steps": opts.steps,
        "cfg": opts.cfg,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      },
      "class_type": "KSampler"
    },
    "4": {
      "inputs": {
        "ckpt_name": "flux2-klein-4b.safetensors"
      },
      "class_type": "CheckpointLoaderSimple"
    },
    "5": {
      "inputs": {
        "width": opts.width,
        "height": opts.height,
        "batch_size": 1
      },
      "class_type": "EmptyLatentImage"
    },
    "6": {
      "inputs": {
        "text": opts.prompt,
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode"
    },
    "7": {
      "inputs": {
        "text": opts.negativePrompt || "blurry, low quality, bad anatomy",
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode"
    },
    "8": {
      "inputs": {
        "samples": ["3", 0],
        "vae": ["4", 2]
      },
      "class_type": "VAEDecode"
    },
    "9": {
      "inputs": {
        "filename_prefix": "Esperto_FLUX_Klein",
        "images": ["8", 0]
      },
      "class_type": "SaveImage"
    }
  };
}

/**
 * Orquestra a execução completa:
 * 1. Faz upload da imagem de referência no ComfyUI (se fornecida).
 * 2. Envia o prompt/grafo via REST para a fila do ComfyUI.
 * 3. Monitora o progresso de amostragem.
 * 4. Baixa e retorna a imagem resultante em Base64.
 */
export async function executeComfyWorkflow(opts: ImageEditOptions): Promise<string> {
  const host = (opts.host || DEFAULT_COMFY_HOST).replace(/\/+$/, '');
  const steps = opts.steps || 20;
  const cfg = opts.cfgScale || 3.5;
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
    prompt: opts.prompt,
    negativePrompt: opts.negativePrompt,
    denoise: Math.max(0.05, Math.min(1.0, opts.denoiseStrength)),
    steps,
    cfg,
    seed,
    width,
    height,
  });

  const clientId = crypto.randomUUID();

  // Envia a requisição de prompt
  const res = await fetch(`${host}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: promptGraph, client_id: clientId }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao disparar pipeline no ComfyUI: ${errText}`);
  }

  const promptResponse = await res.json();
  const promptId = promptResponse.prompt_id;
  if (!promptId) {
    throw new Error('ComfyUI não retornou um ID de tarefa válido.');
  }

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
      opts.onProgress(estimatedPercent, `Inferindo FLUX.2 Klein (${elapsed.toFixed(0)}s)...`);
    }

    try {
      const historyRes = await fetch(`${host}/history/${promptId}`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        const task = historyData[promptId];
        if (task && task.outputs) {
          // Localiza o nó SaveImage (ID 9 no nosso grafo)
          for (const nodeId of Object.keys(task.outputs)) {
            const outNode = task.outputs[nodeId];
            if (outNode.images && outNode.images.length > 0) {
              const imgInfo = outNode.images[0];
              if (opts.onProgress) opts.onProgress(98, 'Baixando imagem resultante...');

              const finalB64 = await invoke<string>('comfyui_get_output_image', {
                host,
                filename: imgInfo.filename,
                subfolder: imgInfo.subfolder || '',
                folderType: imgInfo.type || 'output',
              });

              if (opts.onProgress) opts.onProgress(100, 'Renderização concluída!');
              return finalB64;
            }
          }
        }
      }
    } catch (_) {}
  }

  throw new Error('Tempo limite excedido aguardando o ComfyUI processar a imagem.');
}