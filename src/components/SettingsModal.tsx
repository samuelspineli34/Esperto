import React, { useState, useEffect } from 'react';
import { X, Eye, BookOpen, Key, Sparkles, Trash2, Globe, Sliders, Image, BrainCircuit } from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import { Settings } from '../lib/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings: initialSettings, onSave }) => {
  const [form, setForm] = useState<Settings>(initialSettings);

  useEffect(() => {
    setForm(initialSettings);
  }, [initialSettings, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-surface border border-purple-900/40 rounded-3xl w-full max-w-4xl p-6 relative shadow-2xl shadow-purple-950/80 max-h-[92vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-surfaceHover transition cursor-pointer"
        >
          <X size={20} />
        </button>
        
        <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-purple-950/40">
          <div className="p-2 rounded-xl bg-purple-900/40 text-purple-300 border border-purple-500/30 shadow-inner">
            <Eye size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">Configurações & Parâmetros dos Modelos</h2>
            <p className="text-xs text-purple-300/60">Controles de raciocínio, temperatura, busca e memória.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-1 pr-1">
          
          {/* COLUNA ESQUERDA: Modelos e Parâmetros */}
          <div className="space-y-4 flex flex-col">
            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-2 flex items-center gap-1.5">
                <Sparkles size={13} className="text-purple-400" />
                <span>Modelo Ativo</span>
              </label>
              <ModelSelector
                selectedModel={form.model || 'gemini-3.7-flash'}
                onSelect={(id) => setForm((prev) => ({ ...prev, model: id }))}
              />
            </div>

            {/* Parâmetros Avançados */}
            <div className="p-3.5 bg-background/50 border border-purple-900/30 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-purple-200 block flex items-center gap-1.5">
                <Sliders size={13} className="text-purple-400" />
                <span>Parâmetros de Inferência</span>
              </span>

              {/* Temperature */}
              <div>
                <div className="flex justify-between text-[11px] text-purple-300 mb-1">
                  <span>Temperature (Criatividade):</span>
                  <span className="font-mono">{form.temperature ?? 0.7}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={form.temperature ?? 0.7}
                  onChange={(e) => setForm((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              {/* Thinking Level / Raciocínio */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[11px] font-medium text-purple-300 mb-1 flex items-center gap-1">
                    <BrainCircuit size={11} />
                    <span>Thinking Level</span>
                  </label>
                  <select
                    value={form.thinkingLevel || 'off'}
                    onChange={(e) => setForm((prev) => ({ ...prev, thinkingLevel: e.target.value as any }))}
                    className="w-full bg-surface border border-purple-900/40 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="off">Off (Rápido)</option>
                    <option value="low">Low (1k tokens)</option>
                    <option value="medium">Medium (2k tokens)</option>
                    <option value="high">High (8k tokens)</option>
                  </select>
                </div>

                {/* Resolução de Mídia */}
                <div>
                  <label className="text-[11px] font-medium text-purple-300 mb-1 flex items-center gap-1">
                    <Image size={11} />
                    <span>Media Resolution</span>
                  </label>
                  <select
                    value={form.mediaResolution || 'default'}
                    onChange={(e) => setForm((prev) => ({ ...prev, mediaResolution: e.target.value as any }))}
                    className="w-full bg-surface border border-purple-900/40 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="default">Default</option>
                    <option value="low">Low (Poucos tokens)</option>
                    <option value="high">High (Detalhado)</option>
                  </select>
                </div>
              </div>

              {/* Google Search Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, googleSearch: !prev.googleSearch }))}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
                    form.googleSearch
                      ? 'bg-purple-950/80 text-purple-300 border-purple-500/50'
                      : 'bg-surface text-gray-500 border-purple-900/30 hover:text-gray-300'
                  }`}
                >
                  <Globe size={13} />
                  <span>{form.googleSearch ? 'Busca Web Google: ATIVA' : 'Busca Web Google: DESATIVADA'}</span>
                </button>
              </div>
            </div>

            {/* Chaves de API */}
            <div className="pt-2 border-t border-purple-950/40 space-y-2">
              <div className="flex items-center gap-1.5">
                <Key size={13} className="text-purple-400" />
                <label className="block text-xs font-semibold text-purple-200">Chaves de API</label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-blue-300 mb-0.5">Gemini API Key</label>
                  <input
                    type="password"
                    value={form.geminiApiKey || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, geminiApiKey: e.target.value }))}
                    placeholder="AIzaSy..."
                    className="w-full bg-background border border-blue-900/30 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-amber-300 mb-0.5">Claude API Key</label>
                  <input
                    type="password"
                    value={form.anthropicApiKey || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, anthropicApiKey: e.target.value }))}
                    placeholder="sk-ant-..."
                    className="w-full bg-background border border-amber-900/30 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: Grimório Global */}
          <div className="flex flex-col bg-background/50 border border-purple-900/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <BookOpen size={15} className="text-purple-400" />
                <label className="block text-xs font-bold text-purple-200">Grimório Global (Memória Permanente)</label>
              </div>
              {form.globalMemory && (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, globalMemory: '' }))}
                  className="text-gray-500 hover:text-red-400 transition p-1 cursor-pointer"
                  title="Limpar memória"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <textarea
              value={form.globalMemory || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, globalMemory: e.target.value }))}
              placeholder="Fatos e preferências permanentes lembrados por todos os modelos..."
              className="flex-1 w-full min-h-[260px] bg-background border border-purple-900/40 rounded-xl p-3 text-xs text-purple-100 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none font-mono leading-relaxed"
            />
          </div>

        </div>

        <div className="pt-4 mt-4 border-t border-purple-950/40 flex justify-center">
          <button
            onClick={() => {
              onSave(form);
              onClose();
            }}
            className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold px-8 py-2 rounded-xl transition text-xs shadow-md shadow-purple-950/50 cursor-pointer"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};