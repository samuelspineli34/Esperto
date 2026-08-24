import React, { useState, useEffect } from 'react';
import { X, Eye, BookOpen, Key, Sparkles, Trash2 } from 'lucide-react';
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
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-surfaceHover transition"
        >
          <X size={20} />
        </button>
        
        {/* Cabeçalho do Modal */}
        <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-purple-950/40">
          <div className="p-2 rounded-xl bg-purple-900/40 text-purple-300 border border-purple-500/30 shadow-inner">
            <Eye size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">Configurações do Oráculo</h2>
            <p className="text-xs text-purple-300/60">Gerencie modelos, chaves de acesso e a memória permanente.</p>
          </div>
        </div>

        {/* Conteúdo em 2 Colunas no Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-1 pr-1">
          
          {/* COLUNA ESQUERDA: Modelos e Chaves */}
          <div className="space-y-4 flex flex-col">
            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-2 flex items-center gap-1.5">
                <Sparkles size={13} className="text-purple-400" />
                <span>Modelo Ativo (Ordem Alfabética)</span>
              </label>
              <ModelSelector
                selectedModel={form.model || 'gemini-3.7-flash'}
                onSelect={(id) => setForm((prev) => ({ ...prev, model: id }))}
              />
            </div>

            {/* Chaves de API */}
            <div className="pt-3 border-t border-purple-950/40 space-y-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Key size={13} className="text-purple-400" />
                <label className="block text-xs font-semibold text-purple-200">
                  Chaves de API (Armazenadas Localmente)
                </label>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-medium text-blue-300 mb-1">Google Gemini API Key</label>
                  <input
                    type="password"
                    value={form.geminiApiKey || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, geminiApiKey: e.target.value }))}
                    placeholder="AIzaSy..."
                    className="w-full bg-background border border-blue-900/30 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-amber-300 mb-1">Anthropic Claude API Key</label>
                  <input
                    type="password"
                    value={form.anthropicApiKey || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, anthropicApiKey: e.target.value }))}
                    placeholder="sk-ant-api..."
                    className="w-full bg-background border border-amber-900/30 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-emerald-300 mb-1">OpenAI (ChatGPT)</label>
                    <input
                      type="password"
                      value={form.openaiApiKey || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, openaiApiKey: e.target.value }))}
                      placeholder="sk-proj-..."
                      className="w-full bg-background border border-emerald-900/30 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-cyan-300 mb-1">DeepSeek API Key</label>
                    <input
                      type="password"
                      value={form.deepseekApiKey || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, deepseekApiKey: e.target.value }))}
                      placeholder="sk-..."
                      className="w-full bg-background border border-cyan-900/30 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: Grimório Global (Memória Permanente Expandida) */}
          <div className="flex flex-col bg-background/50 border border-purple-900/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <BookOpen size={15} className="text-purple-400" />
                <label className="block text-xs font-bold text-purple-200">
                  Grimório Global (Memória Permanente)
                </label>
              </div>
              {form.globalMemory && (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, globalMemory: '' }))}
                  className="text-gray-500 hover:text-red-400 transition p-1"
                  title="Limpar memória"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
              Tudo o que estiver escrito aqui será lembrado por <strong>qualquer IA</strong> em todas as conversas. Use para definir quem você é, sua stack preferida, regras de escrita ou contexto de projetos.
            </p>

            <textarea
              value={form.globalMemory || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, globalMemory: e.target.value }))}
              placeholder={`Exemplo de conteúdo para colocar aqui:\n\n• Meu nome é Samuel.\n• Stack favorita: TypeScript, React, Tailwind CSS e Rust (Tauri).\n• Prefiro respostas diretas ao ponto, com exemplos de código sem comentários óbvios.\n• Projeto principal atual: Esperto (Desktop AI Assistant).`}
              className="flex-1 w-full min-h-[220px] bg-background border border-purple-900/40 rounded-xl p-3 text-xs text-purple-100 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none font-mono leading-relaxed shadow-inner"
            />

            <div className="flex justify-between items-center mt-2 text-[10px] text-gray-500 font-mono">
              <span>Injetado automaticamente no prompt de sistema</span>
              <span>{(form.globalMemory || '').length} caracteres</span>
            </div>
          </div>

        </div>

        {/* Botão de Salvar no Rodapé */}
        <div className="pt-4 mt-4 border-t border-purple-950/40 flex justify-center">
          <button
            onClick={() => {
              onSave(form);
              onClose();
            }}
            className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold px-8 py-2 rounded-xl transition text-xs shadow-md shadow-purple-950/50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};