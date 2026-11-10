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
  let specs: SystemHardwareInfo;
  try {
    specs = await invoke<SystemHardwareInfo>('get_system_specs');
  } catch (e) {
    console.warn('Fallback hardware detection:', e);
    specs = {
      os_name: 'windows',
      os_version: '10/11',
      total_ram_mb: 16384,
      available_ram_mb: 8192,
      cpu_cores: 8,
      cpu_brand: 'CPU x86_64',
      gpu_name: 'NVIDIA GeForce RTX 2060 Super',
      gpu_vram_mb: 8192,
      has_nvidia_gpu: true,
      has_amd_gpu: false,
      has_apple_silicon: false,
    };
  }

  const vramGb = specs.gpu_vram_mb / 1024;
  let tier: HardwareTier = 'entry';
  let tierLabel = 'Básico (Até 6GB VRAM)';

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
    // Image Generation & Editing
    {
      id: 'flux-2-klein-4b',
      name: 'FLUX.2 Klein 4B (ComfyUI / GGUF Q4_K_M)',
      category: 'image-gen',
      badge: 'FLUX.2 Image-to-Image',
      description: 'Arquitetura Klein ultrarrápida com fidelidade fotográfica superior e controle de edição de alta precisão.',
      vramRequiredGb: 6.5,
      isRecommended: vramGb >= 7.5,
      reason: vramGb >= 7.5
        ? 'Perfeito para sua GPU de 8GB: cabe 100% na VRAM com cache otimizado sem descarregar para RAM.'
        : 'Requer pelo menos 6.5GB de VRAM livre para geração em velocidade máxima.',
    },
    {
      id: 'sdxl-turbo',
      name: 'SDXL Turbo (1-4 Steps)',
      category: 'image-gen',
      badge: 'Velocidade Extrema',
      description: 'Geração instantânea em até 4 passos. Ótimo para rascunhos rápidos.',
      vramRequiredGb: 5.0,
      isRecommended: vramGb < 7.5,
      reason: 'Ideal para máquinas de menor consumo de VRAM ou para iterações em menos de 1 segundo.',
    },

    // Coding & Autonomous Agent
    {
      id: 'qwen2.5-coder:7b',
      name: 'Qwen2.5-Coder 7B (Ollama Q4)',
      category: 'code',
      badge: 'Líder em Programação',
      description: 'Especialista em TypeScript, Rust, Python e edição autônoma de arquivos inteiros.',
      vramRequiredGb: 5.5,
      isRecommended: vramGb >= 6.0,
      reason: 'Modelo padrão ouro para agentes autônomos locais em GPUs de 8GB.',
    },
    {
      id: 'qwen3-vl:4b',
      name: 'Qwen3-VL 4B (Multimodal com Visão)',
      category: 'vision',
      badge: 'Visão & Screenshots',
      description: 'Analisa diagramas de arquitetura, capturas de tela da aplicação e lê UI direto do buffer.',
      vramRequiredGb: 4.8,
      isRecommended: true,
      reason: 'Compacto e multimodal; permite alternar texto e imagem sem exceder o orçamento térmico.',
    },
  ];

  return {
    specs,
    tier,
    tierLabel,
    recommendations,
  };
}