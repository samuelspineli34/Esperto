import React, { useState, useMemo, useEffect } from 'react';
import { AVAILABLE_MODELS, AIModel, subscribeModelChanges, registerLocalOllamaModels } from '../lib/models';
import { getInstalledOllamaModels } from '../services/ollama';
import { Search, Check, DollarSign, Gift, Cpu, RefreshCw, Server } from 'lucide-react';

interface Props {
  selectedModel: string;
  onSelect: (modelId: string) => void;
  customHost?: string;
  customPath?: string;
}

export const ModelSelector: React.FC<Props> = ({ selectedModel, onSelect, customHost, customPath }) => {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'local' | 'custom' | 'free' | 'cloud'>('all');
  const [modelsList, setModelsList] = useState<AIModel[]>(AVAILABLE_MODELS);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeModelChanges(() => {
      setModelsList([...AVAILABLE_MODELS]);
    });
    void getInstalledOllamaModels(customHost, customPath).then((result) => {
      registerLocalOllamaModels(result.models || []);
    }).catch((error) => console.warn('Não foi possível sincronizar os modelos locais:', error));
    return unsubscribe;
  }, [customHost, customPath]);

  const handleRefreshOllama = async () => {
    setIsRefreshing(true);
    try {
      const result = await getInstalledOllamaModels(customHost, customPath);
      // Sempre sincroniza inclusive lista vazia/offline, evitando manter modelos antigos em memória.
      registerLocalOllamaModels(result.models || []);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredModels = useMemo(() => {
    return modelsList.filter((m) => {
      const matchQuery =
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.id.toLowerCase().includes(query.toLowerCase()) ||
        m.provider.toLowerCase().includes(query.toLowerCase());

      if (!matchQuery) return false;

      if (activeFilter === 'local') return m.isLocal;
      if (activeFilter === 'custom') return m.provider === 'custom';
      if (activeFilter === 'free') return m.pricing === 'free_tier';
      if (activeFilter === 'cloud') return !m.isLocal && m.provider !== 'custom';

      return true;
    });
  }, [query, modelsList, activeFilter]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-3 text-purple-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar modelo (ex: qwen, gemini, sonnet)..."
            className="w-full bg-background border border-purple-900/40 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        <button
          type="button"
          onClick={handleRefreshOllama}
          title="Sincronizar modelos locais do Ollama"
          disabled={isRefreshing}
          className="px-3 py-2 bg-surface hover:bg-surfaceHover border border-purple-900/40 hover:border-emerald-500/50 rounded-xl text-xs font-semibold text-emerald-400 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Sync Ollama</span>
        </button>
      </div>

      {/* Filtros Rápidos */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px]">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-purple-950/90 text-purple-200 border border-purple-500/50'
              : 'bg-surface/50 text-gray-400 hover:text-white'
          }`}
        >
          Todos ({modelsList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('local')}
          className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 cursor-pointer ${
            activeFilter === 'local'
              ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/50'
              : 'bg-surface/50 text-gray-400 hover:text-white'
          }`}
        >
          <Cpu size={12} className="text-emerald-400" />
          <span>Ollama ({modelsList.filter((m) => m.provider === 'ollama').length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('custom')}
          className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 cursor-pointer ${
            activeFilter === 'custom'
              ? 'bg-sky-950/90 text-sky-200 border border-sky-500/50'
              : 'bg-surface/50 text-gray-400 hover:text-white'
          }`}
        >
          <Server size={12} className="text-sky-400" />
          <span>Servidores Custom</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('free')}
          className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 cursor-pointer ${
            activeFilter === 'free'
              ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/50'
              : 'bg-surface/50 text-gray-400 hover:text-white'
          }`}
        >
          <Gift size={12} className="text-emerald-400" />
          <span>Gratuitos</span>
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        {filteredModels.length === 0 ? (
          <div className="text-center py-5 text-xs text-gray-500 space-y-1">
            <p>Nenhum modelo compatível com os filtros.</p>
          </div>
        ) : (
          filteredModels.map((m: AIModel) => {
            const isSelected = selectedModel === m.id;
            return (
              <div
                key={m.id}
                onClick={() => onSelect(m.id)}
                className={`p-2.5 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-purple-950/70 border-purple-500/60 text-white shadow-md'
                    : 'bg-surface/50 border-purple-900/20 text-gray-300 hover:bg-surface hover:border-purple-500/40'
                }`}
              >
                <div className="flex-1 pr-2 overflow-hidden">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {m.isLocal && <Cpu size={13} className="text-emerald-400 animate-pulse" />}
                    <span className="font-semibold text-xs text-purple-100 truncate">{m.name}</span>

                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-purple-950 border border-purple-800/40 text-purple-300">
                      {m.isLocal ? 'LOCAL (GPU)' : m.provider}
                    </span>

                    {m.pricing === 'free_tier' ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 flex items-center gap-0.5">
                        <Gift size={9} />
                        <span>GRÁTIS</span>
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
