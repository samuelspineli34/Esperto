import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Sliders,
  Sparkles,
  Download,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  Layers,
  ArrowRightLeft,
  X,
  UploadCloud,
  Eye,
  Server,
  Zap,
} from 'lucide-react';
import { checkComfyStatus, getComfyModelOptions, executeComfyWorkflow, DEFAULT_COMFY_HOST, ComfyServerStatus, ComfyModelOption } from '../services/comfyui';
import { detectHardware, HardwareAuditResult } from '../services/hardware';
import { AppErrorInfo } from './ErrorModal';

interface Props {
  onErrorTrigger: (error: AppErrorInfo) => void;
  onSendImageToChat?: (imageBase64: string, promptText: string) => void;
}

export const ImageStudio: React.FC<Props> = ({ onErrorTrigger, onSendImageToChat }) => {
  const [comfyHost, setComfyHost] = useState(DEFAULT_COMFY_HOST);
  const [comfyStatus, setComfyStatus] = useState<ComfyServerStatus>({ isOnline: false, devices: [], version: '' });
  const [checkingComfy, setCheckingComfy] = useState(false);
  const [modelOptions, setModelOptions] = useState<ComfyModelOption[]>([]);
  const [modelInventoryError, setModelInventoryError] = useState('');

  const [hardwareInfo, setHardwareInfo] = useState<HardwareAuditResult | null>(null);

  // Parâmetros de Geração e Edição
  const [selectedModel, setSelectedModel] = useState('');
  const [prompt, setPrompt] = useState('Edite esta imagem transformando em iluminação dramática cyberpunk com detalhes 8k');
  const [negativePrompt, setNegativePrompt] = useState('low quality, blurry, deformed, extra fingers, text, watermark');
  const [denoiseStrength, setDenoiseStrength] = useState(0.45); // 0.05 a 1.0 (intensidade de alteração)
  const [steps, setSteps] = useState(20);
  const [cfgScale, setCfgScale] = useState(3.5);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  // Estados de Renderização
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [outputImage, setOutputImage] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshStatus();
  }, []);

  const refreshStatus = async () => {
    setCheckingComfy(true);
    setModelInventoryError('');
    try {
      const [comfy, hw] = await Promise.all([
        checkComfyStatus(comfyHost),
        detectHardware(),
      ]);
      setComfyStatus(comfy);
      setHardwareInfo(hw);

      if (!comfy.isOnline) {
        setModelOptions([]);
        setSelectedModel('');
        setModelInventoryError('Inicie o ComfyUI para descobrir os modelos instalados.');
        return;
      }

      try {
        const discovered = await getComfyModelOptions(comfyHost);
        setModelOptions(discovered.options);
        setSelectedModel((current) =>
          discovered.options.some((option) => option.id === current)
            ? current
            : discovered.options[0]?.id || '',
        );
        if (discovered.options.length === 0) {
          const hasFluxParts = discovered.inventory.diffusion_models.length > 0;
          setModelInventoryError(
            hasFluxParts
              ? 'FLUX.2 detectado parcialmente. Verifique qwen_3_4b.safetensors em models/text_encoders e flux2-vae.safetensors em models/vae. O modelo principal deve ficar em models/diffusion_models.'
              : 'Nenhum modelo compatível foi encontrado. Checkpoints ficam em models/checkpoints; FLUX.2 Klein usa models/diffusion_models, models/text_encoders e models/vae. Depois, atualize a lista.',
          );
        }
      } catch (error: any) {
        setModelOptions([]);
        setSelectedModel('');
        setModelInventoryError(error?.message || 'Não foi possível consultar os modelos do ComfyUI.');
      }
    } finally {
      setCheckingComfy(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const activeModel = modelOptions.find((model) => model.id === selectedModel) || null;

  const handleGenerate = async () => {
    if (!prompt.trim() || !activeModel) return;

    setIsGenerating(true);
    setGenerationProgress(5);
    setProgressStatus('Conectando ao orquestrador de tensores...');

    try {
      const resultB64 = await executeComfyWorkflow({
        host: comfyHost,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        model: activeModel,
        referenceImageBase64: referenceImage || undefined,
        denoiseStrength,
        steps: activeModel.kind === 'flux2' ? activeModel.recommendedSteps : steps,
        cfgScale,
        onProgress: (percent, status) => {
          setGenerationProgress(percent);
          setProgressStatus(status);
        },
      });

      setOutputImage(resultB64);
      if (referenceImage) setShowComparison(true);
    } catch (err: any) {
      onErrorTrigger({
        title: 'Falha no Image Studio (ComfyUI)',
        context: `Modelo: ${activeModel.label}`, 
        message: err?.message || 'Não foi possível concluir o pipeline de geração da imagem.',
        technicalDetails: err?.toString() || 'ComfyUI endpoint error',
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
      setProgressStatus('');
    }
  };

  const handleCopyResult = () => {
    if (!outputImage) return;
    navigator.clipboard.writeText(outputImage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadResult = () => {
    if (!outputImage) return;
    const a = document.createElement('a');
    a.href = outputImage;
    a.download = `esperto-${activeModel?.kind === 'flux2' ? 'flux2-klein' : 'comfyui'}-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090b10] overflow-y-auto p-4 md:p-6 text-zinc-100 font-sans">
      {/* Cabeçalho do Image Studio */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#1c2232]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-md">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide font-mono uppercase flex items-center gap-2">
              <span>Image Studio</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/90 text-purple-300 border border-purple-700/50">
                {activeModel?.label || 'Nenhum modelo selecionado'}
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Edição Image-to-Image de alta fidelidade e geração local controlada via ComfyUI.
            </p>
          </div>
        </div>

        {/* Card de Diagnóstico do ComfyUI e GPU */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#10141f] border border-[#202738]">
            <div className={`w-2 h-2 rounded-full ${comfyStatus.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-zinc-300">
              {comfyStatus.isOnline ? 'ComfyUI Online' : 'ComfyUI Offline'}
            </span>
            <button
              onClick={refreshStatus}
              title="Testar Conexão com ComfyUI"
              className="text-zinc-400 hover:text-white transition ml-1"
            >
              <RefreshCw size={12} className={checkingComfy ? 'animate-spin' : ''} />
            </button>
          </div>

          {hardwareInfo && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10141f] border border-[#202738] text-[11px] text-zinc-400">
              <Cpu size={13} className="text-emerald-400" />
              <span className="truncate max-w-40">{hardwareInfo.specs.gpu_name}</span>
              <span className="text-emerald-400 font-bold">{(hardwareInfo.specs.gpu_vram_mb / 1024).toFixed(0)}GB</span>
            </div>
          )}
        </div>
      </div>

      {!comfyStatus.isOnline && (
        <div className="mt-4 p-3.5 bg-amber-950/25 border border-amber-800/40 rounded-xl flex items-start gap-3">
          <Server size={17} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1 text-amber-200/90 font-mono">
            <span className="font-bold text-amber-100 block">ComfyUI não detectado em {comfyHost}</span>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Inicie o ComfyUI para que o Esperto possa consultar automaticamente os modelos instalados.
            </p>
          </div>
        </div>
      )}

      {/* Grid Principal: Configurações & Visualizador */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5 flex-1">
        {/* Coluna Esquerda: Controles (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Seletor de Modelo */}
          <div className="p-3.5 bg-[#0d1018] border border-[#1e2538] rounded-xl space-y-2">
            <label className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400 block">
              Modelo de Difusão
            </label>
            {modelOptions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {modelOptions.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    aria-pressed={selectedModel === model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`p-3 rounded-lg border text-left transition min-w-0 ${
                      selectedModel === model.id
                        ? 'bg-purple-950/70 border-purple-500/70 text-white ring-1 ring-purple-500/30'
                        : 'bg-[#121622] border-[#22293b] text-zinc-400 hover:text-white hover:border-zinc-600'
                    }`}
                  >
                    <span className="block font-semibold truncate">{model.label}</span>
                    <span className="block text-[10px] text-zinc-500 mt-1 break-words">
                      {model.kind === 'flux2' ? 'FLUX.2 · diffusion model' : model.description}
                    </span>
                    <span className="block text-[10px] text-zinc-600 mt-1 truncate" title={model.name}>{model.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#30394d] bg-[#090d15] p-3 text-xs text-zinc-400">
                {modelInventoryError || 'Conecte-se ao ComfyUI e atualize a lista de modelos.'}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] text-zinc-500">{modelOptions.length} modelo(s) compatível(is) encontrado(s)</span>
              <button type="button" onClick={refreshStatus} disabled={checkingComfy} className="text-[10px] text-purple-300 hover:text-purple-200 disabled:opacity-50">
                Atualizar modelos
              </button>
            </div>
          </div>

          {/* Upload de Imagem de Referência (Image-to-Image) */}
          <div className="p-3.5 bg-[#0d1018] border border-[#1e2538] rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <ImageIcon size={14} className="text-purple-400" />
                <span>Imagem de Referência (Img2Img)</span>
              </label>
              {referenceImage && (
                <button
                  type="button"
                  onClick={() => setReferenceImage(null)}
                  className="text-[11px] font-mono text-rose-400 hover:underline flex items-center gap-1"
                >
                  <X size={12} />
                  <span>Remover</span>
                </button>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            {!referenceImage ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#263148] hover:border-purple-500/50 rounded-xl p-5 text-center cursor-pointer bg-[#07090e] transition flex flex-col items-center justify-center gap-2"
              >
                <UploadCloud size={24} className="text-zinc-500" />
                <span className="text-xs text-zinc-300 font-mono">
                  Clique ou arraste a imagem original aqui
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">PNG, JPG, WEBP suportados</span>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-[#283248] max-h-48 flex items-center justify-center bg-[#07090e]">
                <img
                  src={referenceImage}
                  alt="Imagem de referência"
                  className="max-h-48 object-contain w-full"
                />
              </div>
            )}
          </div>

          {/* Slider de Intensidade de Alteração (Denoising Strength) */}
          {referenceImage && activeModel?.kind === 'checkpoint' && (
            <div className="p-3.5 bg-[#0d1018] border border-[#1e2538] rounded-xl space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-400 font-semibold uppercase">Intensidade da Alteração (Denoise)</span>
                <span className="text-purple-300 font-bold">{(denoiseStrength * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={denoiseStrength}
                onChange={(e) => setDenoiseStrength(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>Preserva estrutura original</span>
                <span>Modificação livre</span>
              </div>
            </div>
          )}

          {/* Prompts */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400 block">
                Prompt de Edição (Instrução)
              </label>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Altere o fundo para uma sala de comando espacial, adicione reflexos de neon..."
                className="w-full bg-[#0d1018] border border-[#1e2538] rounded-xl p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/60 font-mono leading-relaxed resize-none"
              />
            </div>

            {activeModel?.kind === 'checkpoint' && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500 block">
                  Prompt Negativo
                </label>
              <input
                type="text"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Elementos indesejados..."
                  className="w-full bg-[#0d1018] border border-[#1e2538] rounded-xl px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none font-mono"
                />
              </div>
            )}
          </div>

          {/* Botão de Disparo */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || !activeModel || !comfyStatus.isOnline}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-mono font-semibold text-xs tracking-wider transition shadow-lg shadow-purple-950/60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Renderizando com {activeModel?.label || 'modelo selecionado'}...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>{referenceImage ? 'Executar Edição na Imagem' : 'Gerar Imagem do Zero'}</span>
              </>
            )}
          </button>
        </div>

        {/* Coluna Direita: Visualizador e Comparativo Before/After (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className="flex-1 bg-[#07090e] border border-[#1c2232] rounded-2xl p-4 flex flex-col items-center justify-center relative min-h-[420px] overflow-hidden">
            {isGenerating && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center z-20 space-y-3 p-6 text-center font-mono">
                <RefreshCw size={32} className="text-purple-400 animate-spin" />
                <span className="text-sm font-semibold text-purple-200">{progressStatus}</span>
                <div className="w-64 bg-[#141926] h-2 rounded-full overflow-hidden border border-[#263148]">
                  <div
                    className="bg-purple-500 h-full transition-all duration-300"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500">{generationProgress}% concluído</span>
              </div>
            )}

            {outputImage ? (
              <div className="relative w-full h-full flex items-center justify-center">
                {showComparison && referenceImage ? (
                  <div className="grid grid-cols-2 gap-2 w-full h-full">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-mono uppercase text-zinc-500 mb-1">Original</span>
                      <img src={referenceImage} alt="Original" className="max-h-[380px] object-contain rounded-lg border border-[#222a3d]" />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-mono uppercase text-purple-400 mb-1">Editada ({activeModel?.label || 'modelo'})</span>
                      <img src={outputImage} alt="Resultado" className="max-h-[380px] object-contain rounded-lg border border-purple-500/50 shadow-xl" />
                    </div>
                  </div>
                ) : (
                  <img
                    src={outputImage}
                    alt="Resultado da Geração"
                    className="max-h-[480px] object-contain rounded-xl border border-purple-900/40 shadow-2xl"
                  />
                )}
              </div>
            ) : (
              <div className="text-center space-y-2 text-zinc-500 font-mono">
                <ImageIcon size={48} className="mx-auto opacity-30" />
                <p className="text-xs">Nenhuma imagem gerada ainda nesta sessão.</p>
                <p className="text-[10px] text-zinc-600">Insira sua instrução e clique em Executar.</p>
              </div>
            )}
          </div>

          {/* Ações da Imagem Gerada */}
          {outputImage && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-[#0c0f16] border border-[#1c2232] rounded-xl font-mono text-xs">
              <div className="flex items-center gap-1.5">
                {referenceImage && (
                  <button
                    type="button"
                    onClick={() => setShowComparison(!showComparison)}
                    className="px-3 py-1.5 rounded-lg bg-[#141824] hover:bg-[#1b2233] text-zinc-300 border border-[#263047] transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRightLeft size={13} />
                    <span>{showComparison ? 'Ver Apenas Editada' : 'Comparar Lado a Lado'}</span>
                  </button>
                )}

                {onSendImageToChat && (
                  <button
                    type="button"
                    onClick={() => onSendImageToChat(outputImage, prompt)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/70 text-indigo-300 border border-indigo-700/50 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap size={13} />
                    <span>Enviar ao Chat do Agente</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyResult}
                  className="px-3 py-1.5 rounded-lg bg-[#141824] hover:bg-[#1b2233] text-zinc-300 border border-[#263047] transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copied ? 'Copiado!' : 'Copiar Base64'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadResult}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download size={13} />
                  <span>Salvar Imagem</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageStudio;