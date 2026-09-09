import React, { useState, useMemo, useEffect } from 'react';
import { AVAILABLE_MODELS, AIModel, subscribeModelChanges, registerLocalOllamaModels } from '../lib/models';
import { getInstalledOllamaModels } from '../services/ollama';
import { Search, Check, DollarSign, Gift, Cpu, RefreshCw } from 'lucide-react';

interface Props {
  selectedModel: string;
  onSelect: (modelId: string) => void;
}

const providerColors: Record<string, { badge: string; border: string }> = {
  ollama: { badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50', border: 'hover:border-emerald-500/50' },
  openrouter: { badge: 'bg-violet-950/70 text-violet-300 border-violet-800/40', border: 'hover:border-violet-500/40' },
  gemini: { badge: 'bg-blue-950/70 text-blue-300 border-blue-800/40', border: 'hover:border-blue-500/40' },
  anthropic: { badge: 'bg-amber-950/70 text-amber-300 border-amber-800/40', border: 'hover:border-amber-500/40' },
  openai: { badge: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/40', border: 'hover:border-emerald-500/40' },
  deepseek: { badge: 'bg-cyan-950/70 text-cyan-300 border-cyan-800/40', border: 'hover:border-cyan-500/40' },
};

export const ModelSelector: React.FC<Props> = ({ selectedModel, onSelect }) => {
  const [query, setQuery] = useState('');
  const [modelsList, setModelsList] = useState<AIModel[]>(AVAILABLE_MODELS);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Inscreve para atualizar a lista automaticamente quando os modelos do Ollama forem detectados
    const unsubscribe = subscribeModelChanges(() => {
      setModelsList([...AVAILABLE_MODELS]);
    });
    return unsubscribe;
  }, []);

  const handleRefreshOllama = async () => {
    setIsRefreshing(true);
    try {
      const tags = await getInstalledOllamaModels();
      registerLocalOllamaModels(tags);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredModels = useMemo(() => {
    return modelsList.filter(
      (m) =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.id.toLowerCase().includes(query.toLowerCase()) ||
        m.provider.toLowerCase().includes(query.toLowerCase()) ||
        (m.isLocal && 'local ollama gpu'.includes(query.toLowerCase())) ||
        (m.pricing === 'free_tier' && 'gratis free'.includes(query.toLowerCase())) ||
        (m.pricing === 'paid_only' && 'pago paid'.includes(query.toLowerCase()))
    );
  }, [query, modelsList]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-3 text-purple-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar modelo (ex: local, dolphin, qwen, flash)..."
            className="w-full bg-background border border-purple-900/40 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        <button
          type="button"
          onClick={handleRefreshOllama}
          title="Recarregar modelos locais do Ollama"
          disabled={isRefreshing}
          className="px-3 py-2 bg-surface hover:bg-surfaceHover border border-purple-900/40 hover:border-emerald-500/50 rounded-xl text-xs font-semibold text-emerald-400 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Ollama</span>
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        {filteredModels.length === 0 ? (
          <div className="text-center py-5 text-xs text-gray-500 space-y-1">
            <p>Nenhum modelo encontrado.</p>
            <p className="text-[11px] text-purple-400">Verifique se o Ollama está rodando para ver seus modelos locais.</p>
          </div>
        ) : (
          filteredModels.map((m: AIModel) => {
            const isSelected = selectedModel === m.id;
            const style = providerColors[m.provider] || providerColors.gemini;
            const isFree = m.pricing === 'free_tier';

            return (
              <div
                key={m.id}
                onClick={() => onSelect(m.id)}
                className={`p-2.5 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-purple-950/70 border-purple-500/60 text-white shadow-md'
                    : `bg-surface/50 border-purple-900/20 text-gray-300 ${style.border} hover:bg-surface`
                }`}
              >
                <div className="flex-1 pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {m.isLocal && <Cpu size={13} className="text-emerald-400 animate-pulse" />}
                    <span className="font-semibold text-xs text-purple-100">{m.name}</span>
                    
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md border ${style.badge}`}>
                      {m.isLocal ? 'LOCAL (GPU)' : m.provider}
                    </span>

                    {isFree ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 flex items-center gap-0.5">
                        <Gift size={9} />
                        <span>{m.isLocal ? 'OFFLINE' : 'GRÁTIS'}</span>
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/40 flex items-center gap-0.5">
                        <DollarSign size={9} />
                        <span>PAGO</span>
                      </span>
                    )}

                    <span className="text-[9px] font-mono text-gray-500 bg-background px-1 py-0.5 rounded border border-purple-900/20">
                      {m.contextLimit >= 1000000 ? '1.0M' : `${m.contextLimit / 1000}k`} ctx
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400 truncate">{m.description}</p>
                  {m.priceNote && (
                    <p className="text-[10px] text-purple-300/60 font-mono mt-0.5">{m.priceNote}</p>
                  )}
                </div>

                {isSelected && <Check size={16} className="text-purple-400 shrink-0" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};