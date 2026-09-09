import React, { useState, useEffect } from 'react';
import { X, Eye, BookOpen, Key, Sparkles, Trash2, Globe, Sliders, Image, BrainCircuit, Cpu, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import { Settings } from '../lib/db';
import { getInstalledOllamaModels } from '../services/ollama';
import { registerLocalOllamaModels } from '../lib/models';
import { AppErrorInfo } from './ErrorModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onErrorTrigger: (error: AppErrorInfo) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings: initialSettings, onSave, onErrorTrigger }) => {
  const [form, setForm] = useState<Settings>(initialSettings);
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [ollamaCount, setOllamaCount] = useState(0);
  const [checkingOllama, setCheckingOllama] = useState(false);

  useEffect(() => {
    setForm(initialSettings);
  }, [initialSettings, isOpen]);

  useEffect(() => {
    if (isOpen) {
      checkOllama(false);
    }
  }, [isOpen]);

  const checkOllama = async (showModalOnError = true) => {
    setCheckingOllama(true);
    const result = await getInstalledOllamaModels();
    
    if (result.error) {
      setOllamaOnline(false);
      setOllamaCount(0);
      if (showModalOnError) {
        onErrorTrigger({
          title: 'Falha ao Conectar com o Ollama',
          context: 'Sincronização de Modelos Locais (Porta 11434)',
          message: 'O Esperto não conseguiu falar com o motor do Ollama. Verifique se o servidor local está ativo no Windows.',
          technicalDetails: result.error,
        });
      }
    } else {
      setOllamaOnline(true);
      setOllamaCount(result.models.length);
      registerLocalOllamaModels(result.models);
    }
    setCheckingOllama(false);
  };

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
            <p className="text-xs text-purple-300/60">Controles de raciocínio, temperatura, Ollama local e chaves de API.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-1 pr-1">
          <div className="space-y-4 flex flex-col">
            <div>
              <label className="text-xs font-semibold text-purple-200 mb-2 flex items-center gap-1.5">
                <Sparkles size={13} className="text-purple-400" />
                <span>Modelo Ativo</span>
              </label>
              <ModelSelector
                selectedModel={form.model || 'gemini-3.7-flash'}
                onSelect={(id) => setForm((prev) => ({ ...prev, model: id }))}
              />
            </div>

            <div className="p-3.5 bg-emerald-950/20 border border-emerald-900/40 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Cpu size={14} className="text-emerald-400" />
                  <span>Ollama Local (Sua GPU)</span>
                </span>

                <button
                  type="button"
                  onClick={() => checkOllama(true)}
                  disabled={checkingOllama}
                  className="text-[11px] text-emerald-300 hover:text-emerald-200 flex items-center gap-1 bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-800/40 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={11} className={checkingOllama ? 'animate-spin' : ''} />
                  <span>Sincronizar</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs bg-background/60 p-2.5 rounded-xl border border-emerald-950/40">
                <div className="flex items-center gap-2">
                  {ollamaOnline ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : (
                    <AlertCircle size={14} className="text-amber-400" />
                  )}
                  <span className="font-mono text-[11px] text-gray-300">
                    {ollamaOnline ? `Online (${ollamaCount} modelos locais prontos)` : 'Offline (Clique em Sincronizar para ver o log)'}
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">127.0.0.1:11434</span>
              </div>
            </div>

            <div className="p-3.5 bg-background/50 border border-purple-900/30 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                <Sliders size={13} className="text-purple-400" />
                <span>Parâmetros de Inferência</span>
              </span>

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
                    <option value="low">Low (Econômico)</option>
                    <option value="high">High (Detalhado)</option>
                  </select>
                </div>
              </div>

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

            <div className="pt-2 border-t border-purple-950/40 space-y-2">
              <div className="flex items-center gap-1.5">
                <Key size={13} className="text-purple-400" />
                <label className="text-xs font-semibold text-purple-200">Chaves de API (Modelos em Nuvem)</label>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 bg-violet-950/30 border border-violet-800/40 rounded-xl">
                  <label className="block text-[11px] font-bold text-violet-300 mb-1">
                    OpenRouter API Key (Hub Universal)
                  </label>
                  <input
                    type="password"
                    value={form.openrouterApiKey || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, openrouterApiKey: e.target.value }))}
                    placeholder="sk-or-v1-..."
                    className="w-full bg-background border border-violet-900/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-emerald-300 mb-0.5">OpenAI API Key</label>
                    <input
                      type="password"
                      value={form.openaiApiKey || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, openaiApiKey: e.target.value }))}
                      placeholder="sk-proj-..."
                      className="w-full bg-background border border-emerald-900/30 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-cyan-300 mb-0.5">DeepSeek API Key</label>
                    <input
                      type="password"
                      value={form.deepseekApiKey || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, deepseekApiKey: e.target.value }))}
                      placeholder="sk-..."
                      className="w-full bg-background border border-cyan-900/30 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-background/50 border border-purple-900/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <BookOpen size={15} className="text-purple-400" />
                <label className="text-xs font-bold text-purple-200">Memória Permanente do Usuário</label>
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
              className="flex-1 w-full min-h-65 bg-background border border-purple-900/40 rounded-xl p-3 text-xs text-purple-100 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none font-mono leading-relaxed"
            />
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-purple-950/40 flex justify-center">
          <button
            onClick={() => {
              onSave(form);
              onClose();
            }}
            className="bg-linear-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold px-8 py-2 rounded-xl transition text-xs shadow-md shadow-purple-950/50 cursor-pointer"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};