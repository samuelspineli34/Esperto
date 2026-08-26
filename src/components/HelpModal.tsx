import React, { useState } from 'react';
import { X, HelpCircle, ExternalLink, Key, Zap, Folder, Keyboard, BookOpen } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'keys' | 'openrouter' | 'folders' | 'shortcuts'>('keys');

  if (!isOpen) return null;

  const handleOpenUrl = async (url: string) => {
    try {
      await invoke('open_url', { url });
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-surface border border-purple-900/40 rounded-3xl w-full max-w-2xl p-6 relative shadow-2xl shadow-purple-950/80 max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-surfaceHover transition cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-purple-950/40">
          <div className="p-2 rounded-xl bg-purple-900/40 text-purple-300 border border-purple-500/30">
            <HelpCircle size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Central de Ajuda & Guias</h2>
            <p className="text-xs text-purple-300/60">Links de provedores, como usar o OpenRouter e dicas de atalhos.</p>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="flex gap-2 mb-4 border-b border-purple-950/30 pb-2">
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'keys' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Key size={13} />
            <span>Onde Pegar Chaves</span>
          </button>

          <button
            onClick={() => setActiveTab('openrouter')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'openrouter' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Zap size={13} />
            <span>Guia OpenRouter</span>
          </button>

          <button
            onClick={() => setActiveTab('folders')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'folders' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Folder size={13} />
            <span>Pastas de Código</span>
          </button>

          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'shortcuts' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Keyboard size={13} />
            <span>Atalhos</span>
          </button>
        </div>

        {/* Conteúdo da Aba */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 text-xs leading-relaxed text-gray-300 font-sans">
          {activeTab === 'keys' && (
            <div className="space-y-2.5">
              <p className="text-gray-400">Clique nos links abaixo para criar suas chaves de API oficiais:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                <div
                  onClick={() => handleOpenUrl('https://aistudio.google.com/')}
                  className="p-3 bg-background border border-blue-900/40 rounded-xl flex items-center justify-between hover:border-blue-500 cursor-pointer transition"
                >
                  <div>
                    <span className="font-bold text-blue-300 block">Google AI Studio</span>
                    <span className="text-[11px] text-emerald-400">Gratuito (Gemini 3.7 / 3.6 Flash)</span>
                  </div>
                  <ExternalLink size={14} className="text-blue-400" />
                </div>

                <div
                  onClick={() => handleOpenUrl('https://openrouter.ai/keys')}
                  className="p-3 bg-background border border-violet-900/40 rounded-xl flex items-center justify-between hover:border-violet-500 cursor-pointer transition"
                >
                  <div>
                    <span className="font-bold text-violet-300 block">OpenRouter</span>
                    <span className="text-[11px] text-purple-300">Hub para +200 modelos (Com opções grátis)</span>
                  </div>
                  <ExternalLink size={14} className="text-violet-400" />
                </div>

                <div
                  onClick={() => handleOpenUrl('https://platform.deepseek.com/api_keys')}
                  className="p-3 bg-background border border-cyan-900/40 rounded-xl flex items-center justify-between hover:border-cyan-500 cursor-pointer transition"
                >
                  <div>
                    <span className="font-bold text-cyan-300 block">DeepSeek Platform</span>
                    <span className="text-[11px] text-cyan-400">Raciocínio R1 ultra econômico</span>
                  </div>
                  <ExternalLink size={14} className="text-cyan-400" />
                </div>

                <div
                  onClick={() => handleOpenUrl('https://console.anthropic.com/settings/keys')}
                  className="p-3 bg-background border border-amber-900/40 rounded-xl flex items-center justify-between hover:border-amber-500 cursor-pointer transition"
                >
                  <div>
                    <span className="font-bold text-amber-300 block">Anthropic Console</span>
                    <span className="text-[11px] text-amber-400">Claude 3.7 e 3.5 Sonnet direto</span>
                  </div>
                  <ExternalLink size={14} className="text-amber-400" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'openrouter' && (
            <div className="space-y-2.5 bg-background/50 p-3.5 rounded-2xl border border-purple-900/30">
              <h3 className="font-bold text-purple-200">Como funciona o OpenRouter?</h3>
              <p>O OpenRouter é um agregador universal. Você cria 1 conta e usa uma única chave para acessar Claude, GPT-4o, DeepSeek, Llama e Mistral.</p>
              <ul className="list-disc list-inside space-y-1 text-purple-300/80">
                <li><strong>Modelos Grátis:</strong> Modelos com a tag <code>:free</code> no final são 100% gratuitos sem precisar colocar saldo.</li>
                <li><strong>Saldo Unificado:</strong> Recarregando $5 dólares no OpenRouter, você pode usar Claude 3.7 Sonnet e GPT-4o sem precisar cadastrar cartão em cada empresa.</li>
              </ul>
            </div>
          )}

          {activeTab === 'folders' && (
            <div className="space-y-2.5 bg-background/50 p-3.5 rounded-2xl border border-purple-900/30">
              <h3 className="font-bold text-purple-200">Como usar Pastas de Código como Base?</h3>
              <p>Você pode colar o caminho de qualquer pasta local (ex: <code>C:\Projetos\meu-app</code> ou <code>/home/samuel/app</code>).</p>
              <ul className="list-disc list-inside space-y-1 text-purple-300/80">
                <li>O Esperto ignora automaticamente pastas pesadas como <code>node_modules</code>, <code>.git</code> e arquivos <code>.lock</code>.</li>
                <li>O app seleciona por relevância os arquivos essenciais para a sua pergunta, garantindo que o limite de tokens da API nunca seja ultrapassado.</li>
              </ul>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-2">
              <div className="flex justify-between p-2 rounded-lg bg-background border border-purple-900/30 font-mono">
                <span className="text-purple-300">Enter</span>
                <span className="text-gray-400">Enviar mensagem</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-background border border-purple-900/30 font-mono">
                <span className="text-purple-300">Ctrl + Enter / Shift + Enter</span>
                <span className="text-gray-400">Pular linha na caixa de texto</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-background border border-purple-900/30 font-mono">
                <span className="text-purple-300">Ctrl + V</span>
                <span className="text-gray-400">Colar imagens diretamente do clipboard</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};