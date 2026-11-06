import React from 'react';
import {
  X,
  Lock,
  RotateCcw,
  Sliders,
  Globe,
  BrainCircuit,
  Image,
  Maximize2,
} from 'lucide-react';
import { ChatRunSettings } from '../lib/db';
import { getModelInfo, getModelCapabilities } from '../lib/models';

export interface RunSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  modelId: string;
  runSettings: ChatRunSettings;
  systemInstruction: string;
  onUpdateRunSettings: (newSettings: ChatRunSettings) => void;
  onUpdateSystemInstruction: (instruction: string) => void;
  onResetToDefaults: () => void;
}

export const RunSettingsDrawer: React.FC<RunSettingsDrawerProps> = ({
  isOpen,
  onClose,
  modelId,
  runSettings,
  systemInstruction,
  onUpdateRunSettings,
  onUpdateSystemInstruction,
  onResetToDefaults,
}) => {
  if (!isOpen) return null;

  const model = getModelInfo(modelId);
  const caps = getModelCapabilities(modelId);

  const updateSetting = <K extends keyof ChatRunSettings>(key: K, value: ChatRunSettings[K]) => {
    onUpdateRunSettings({
      ...runSettings,
      [key]: value,
    });
  };

  return (
    <aside className="w-80 bg-[#0c0f16] border-l border-[#191e2b] flex flex-col h-screen select-none font-sans z-30 shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Cabeçalho */}
      <div className="h-13 px-4 border-b border-[#191e2b] flex items-center justify-between bg-[#0a0d13]">
        <div className="flex items-center gap-2">
          <Sliders size={14} className="text-zinc-400" />
          <span className="font-mono text-xs font-semibold text-zinc-200 uppercase tracking-wider">
            Run Settings
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onResetToDefaults}
            title="Redefinir aos padrões do modelo"
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-[#161a25] rounded transition cursor-pointer"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-[#161a25] rounded transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Card do Modelo Ativo */}
        <div className="p-3 bg-[#111520] border border-[#202738] rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-zinc-500 uppercase font-semibold">
              Modelo em Execução
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#181f2f] text-indigo-300 border border-[#26324a]">
              {model.isLocal ? 'GPU LOCAL' : model.provider.toUpperCase()}
            </span>
          </div>

          <span className="font-semibold text-zinc-100 block font-mono truncate" title={model.name}>
            {model.name}
          </span>
          <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">{model.description}</p>
        </div>

        {/* System Instructions / Persona da Sessão */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono text-zinc-400 font-semibold uppercase tracking-wider block">
            System Instructions
          </label>
          <textarea
            rows={3}
            value={systemInstruction}
            onChange={(e) => onUpdateSystemInstruction(e.target.value)}
            placeholder="Instruções de tom e comportamento específicas desta conversa..."
            className="w-full bg-[#080a0f] border border-[#1e2535] rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/50 font-mono resize-none"
          />
        </div>

        {/* Nível de Raciocínio (Thinking Level) */}
        <div className="space-y-1.5 pt-2 border-t border-[#191e2b]">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <BrainCircuit size={13} className="text-indigo-400" />
              <span>Thinking Level</span>
            </label>
            {!caps.supportsThinking && (
              <span
                title={caps.thinkingLockReason}
                className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-[#141923] px-1.5 py-0.5 rounded border border-[#22293b]"
              >
                <Lock size={10} />
                <span>Bloqueado</span>
              </span>
            )}
          </div>

          {caps.supportsThinking ? (
            <select
              value={runSettings.thinkingLevel || 'off'}
              onChange={(e) => updateSetting('thinkingLevel', e.target.value as any)}
              className="w-full bg-[#080a0f] border border-[#1e2535] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
            >
              <option value="off">Off (Geração Direta)</option>
              <option value="low">Low (1.024 tokens)</option>
              <option value="medium">Medium (2.048 tokens)</option>
              <option value="high">High (8.192 tokens)</option>
            </select>
          ) : (
            <div className="p-2 rounded bg-[#080a0f]/60 border border-[#1a202c] text-[11px] text-zinc-500 font-mono flex items-center gap-2">
              <Lock size={12} className="text-zinc-600 shrink-0" />
              <span>{caps.thinkingLockReason}</span>
            </div>
          )}
        </div>

        {/* Ferramentas: Busca no Google (Grounding) */}
        <div className="space-y-1.5 pt-2 border-t border-[#191e2b]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Globe size={13} className="text-indigo-400" />
              <span>Google Search Grounding</span>
            </span>
            {!caps.supportsSearch && (
              <span
                title={caps.searchLockReason}
                className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-[#141923] px-1.5 py-0.5 rounded border border-[#22293b]"
              >
                <Lock size={10} />
                <span>Bloqueado</span>
              </span>
            )}
          </div>

          {caps.supportsSearch ? (
            <div className="flex items-center justify-between p-2.5 bg-[#080a0f] border border-[#1e2535] rounded-lg">
              <span className="text-zinc-300">Pesquisa Web em Tempo Real</span>
              <input
                type="checkbox"
                checked={Boolean(runSettings.googleSearch)}
                onChange={(e) => updateSetting('googleSearch', e.target.checked)}
                className="accent-indigo-500 w-4 h-4 cursor-pointer"
              />
            </div>
          ) : (
            <div className="p-2 rounded bg-[#080a0f]/60 border border-[#1a202c] text-[11px] text-zinc-500 font-mono flex items-center gap-2">
              <Lock size={12} className="text-zinc-600 shrink-0" />
              <span>{caps.searchLockReason}</span>
            </div>
          )}
        </div>

        {/* Amostragem: Temperatura */}
        <div className="space-y-1.5 pt-2 border-t border-[#191e2b]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span>Temperatura</span>
            </span>
            {!caps.supportsTemperature ? (
              <span
                title={caps.temperatureLockReason}
                className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-[#141923] px-1.5 py-0.5 rounded border border-[#22293b]"
              >
                <Lock size={10} />
                <span>Fixa</span>
              </span>
            ) : (
              <span className="font-mono text-zinc-300">{runSettings.temperature ?? 0.7}</span>
            )}
          </div>

          {caps.supportsTemperature ? (
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={runSettings.temperature ?? 0.7}
              onChange={(e) => updateSetting('temperature', parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          ) : (
            <div className="p-2 rounded bg-[#080a0f]/60 border border-[#1a202c] text-[11px] text-zinc-500 font-mono flex items-center gap-2">
              <Lock size={12} className="text-zinc-600 shrink-0" />
              <span>{caps.temperatureLockReason}</span>
            </div>
          )}
        </div>

        {/* Amostragem: Top-P */}
        {caps.supportsTemperature && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Top-P (Nucleus Sampling)</span>
              <span className="text-zinc-300">{runSettings.topP ?? 0.9}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={runSettings.topP ?? 0.9}
              onChange={(e) => updateSetting('topP', parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>
        )}

        {/* Janela de Contexto da GPU */}
        <div className="space-y-1.5 pt-2 border-t border-[#191e2b]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Maximize2 size={13} className="text-emerald-400" />
              <span>Janela de Contexto (VRAM)</span>
            </span>
            {!caps.supportsContextAdjustment && (
              <span
                title={caps.contextLockReason}
                className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-[#141923] px-1.5 py-0.5 rounded border border-[#22293b]"
              >
                <Lock size={10} />
                <span>Fixa</span>
              </span>
            )}
          </div>

          {caps.supportsContextAdjustment ? (
            <div className="space-y-1.5">
              <div className="grid grid-cols-4 gap-1 font-mono text-[11px]">
                {[4096, 8192, 16384, 32768].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => updateSetting('contextLength', val)}
                    className={`py-1 rounded border transition cursor-pointer text-center ${
                      (runSettings.contextLength || 8192) === val
                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/60 font-bold'
                        : 'bg-[#080a0f] text-zinc-400 border-[#1e2535] hover:text-white'
                    }`}
                  >
                    {val / 1024}k
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">
                Recomendado para sua GPU de 12GB com modelo 14B: <strong>8k tokens</strong> (100% dentro da VRAM).
              </p>
            </div>
          ) : (
            <div className="p-2 rounded bg-[#080a0f]/60 border border-[#1a202c] text-[11px] text-zinc-500 font-mono flex items-center gap-2">
              <Lock size={12} className="text-zinc-600 shrink-0" />
              <span>{caps.contextLockReason}</span>
            </div>
          )}
        </div>

        {/* Resolução de Mídia */}
        <div className="space-y-1.5 pt-2 border-t border-[#191e2b]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Image size={13} className="text-indigo-400" />
              <span>Media Resolution</span>
            </span>
            {!caps.supportsMediaResolution && (
              <span
                title={caps.mediaLockReason}
                className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-[#141923] px-1.5 py-0.5 rounded border border-[#22293b]"
              >
                <Lock size={10} />
                <span>Bloqueado</span>
              </span>
            )}
          </div>

          {caps.supportsMediaResolution ? (
            <select
              value={runSettings.mediaResolution || 'default'}
              onChange={(e) => updateSetting('mediaResolution', e.target.value as any)}
              className="w-full bg-[#080a0f] border border-[#1e2535] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
            >
              <option value="default">Default</option>
              <option value="low">Low (Econômico)</option>
              <option value="medium">Medium</option>
              <option value="high">High (Detalhado)</option>
            </select>
          ) : (
            <div className="p-2 rounded bg-[#080a0f]/60 border border-[#1a202c] text-[11px] text-zinc-500 font-mono flex items-center gap-2">
              <Lock size={12} className="text-zinc-600 shrink-0" />
              <span>{caps.mediaLockReason}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default RunSettingsDrawer;