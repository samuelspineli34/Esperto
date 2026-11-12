import { invoke } from '@tauri-apps/api/core';

export interface SystemHardwareInfo {
  os_name: string;
  os_version: string;
  total_ram_mb: number;
  available_ram_mb: number;
  cpu_cores: number;
  cpu_brand: string;
  gpu_name: string;
  gpu_vram_mb: number;
  has_nvidia_gpu: boolean;
  has_amd_gpu: boolean;
  has_apple_silicon: boolean;
}

export type HardwareTier = 'entry' | 'balanced' | 'enthusiast' | 'workstation';

export interface ModelRecommendation {
  id: string;
  name: string;
  category: 'code' | 'vision' | 'image-gen';
  badge: string;
  description: string;
  vramRequiredGb: number;
  isRecommended: boolean;
  reason: string;
}

export interface HardwareAuditResult {
  specs: SystemHardwareInfo;
  tier: HardwareTier;
  tierLabel: string;
  recommendations: ModelRecommendation[];
}

export async function detectHardware(): Promise<HardwareAuditResult> {
  const specs: SystemHardwareInfo = await invoke<SystemHardwareInfo>('get_system_specs').catch((error) => {
    console.warn('Hardware detection failed:', error);
    return {
      os_name: 'unknown',
      os_version: 'Não detectado',
      total_ram_mb: 0,
      available_ram_mb: 0,
      cpu_cores: 0,
      cpu_brand: 'Não detectado',
      gpu_name: 'GPU não detectada',
      gpu_vram_mb: 0,
      has_nvidia_gpu: false,
      has_amd_gpu: false,
      has_apple_silicon: false,
    };
  });

  const vramGb = specs.gpu_vram_mb / 1024;
  let tier: HardwareTier = 'entry';
  let tierLabel = vramGb > 0 ? 'Entrada (até 6 GB de VRAM)' : 'Hardware não identificado';

  if (vramGb >= 20) {
    tier = 'workstation';
    tierLabel = 'Workstation / Datacenter (24GB+ VRAM)';
  } else if (vramGb >= 11) {
    tier = 'enthusiast';
    tierLabel = 'Alto Desempenho (12GB - 16GB VRAM)';
  } else if (vramGb >= 7.5) {
    tier = 'balanced';
    tierLabel = 'Equilibrado (8GB VRAM — Ideal RTX 2060S / 3060 / 4060)';
  }

  const recommendations: ModelRecommendation[] = [
    {
      id: 'flux-2-klein-4b-base',
      name: 'FLUX.2 Klein 4B Base (ComfyUI FP8)',
      category: 'image-gen',
      badge: 'Edição e geração',
      description: 'Variante base para maior flexibilidade e qualidade, com workflow oficial do ComfyUI.',
      vramRequiredGb: 9.2,
      isRecommended: vramGb >= 9.2,
      reason: vramGb >= 9.2
        ? 'A VRAM detectada atende à referência de 9,2 GB; mantenha margem para o restante do sistema.'
        : 'Referência de aproximadamente 9,2 GB de VRAM. Pode exigir offload em GPUs menores.',
    },
    {
      id: 'flux-2-klein-4b-distilled',
      name: 'FLUX.2 Klein 4B Distilled (ComfyUI FP8)',
      category: 'image-gen',
      badge: 'Rápido · 4 etapas',
      description: 'Variante destilada para geração e edição mais rápidas com o workflow oficial.',
      vramRequiredGb: 8.4,
      isRecommended: vramGb >= 8.4,
      reason: vramGb >= 8.4
        ? 'É a variante mais indicada para hardware com VRAM limitada, mas mantenha margem de memória.'
        : 'Referência de aproximadamente 8,4 GB de VRAM; pode precisar de offload ou redução de resolução.',
    },
    {
      id: 'qwen2.5-coder:7b',
      name: 'Qwen2.5-Coder 7B (Ollama Q4)',
      category: 'code',
      badge: 'Programação',
      description: 'Modelo compacto para tarefas de programação, revisão e explicação de código.',
      vramRequiredGb: 5.5,
      isRecommended: vramGb >= 6.0,
      reason: 'Boa opção compacta para programação; desempenho depende da quantização e memória disponível.',
    },
    {
      id: 'qwen3-vl:4b',
      name: 'Qwen3-VL 4B (Multimodal com Visão)',
      category: 'vision',
      badge: 'Visão e screenshots',
      description: 'Modelo multimodal para analisar imagens, interfaces e capturas de tela.',
      vramRequiredGb: 4.8,
      isRecommended: specs.total_ram_mb >= 8192,
      reason: 'Modelo multimodal compacto; confirme suporte de visão na versão instalada.',
    },
  ];

  return {
    specs,
    tier,
    tierLabel,
    recommendations,
  };
}