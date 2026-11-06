import React, { useState } from 'react';
import { X, HelpCircle, Terminal, Check, Copy, ExternalLink, Cpu, ShieldCheck } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const OllamaGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await invoke('open_url', { url });
    } catch {
      window.open(url, '_blank');
    }
  };

  const recommendedModels = [
    { name: 'qwen2.5-coder:7b', desc: 'Leve, ultra veloz e especializado em programação.' },
    { name: 'deepseek-r1:7b', desc: 'Raciocínio lógico detalhado e Chain of Thought na GPU local.' },
    { name: 'llama3.3:70b', desc: 'Nível topo de linha (exige placa de vídeo com 24GB+ de VRAM).' },
  ];

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
          <div className="p-2 rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
            <Cpu size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Como Configurar e Usar o Ollama Local</h2>
            <p className="text-xs text-emerald-300/80">Guia prático para ter IAs rodando 100% offline na sua máquina.</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs leading-relaxed text-gray-300 font-sans">
          <div className="bg-background/60 p-4 rounded-2xl border border-purple-900/30 space-y-2">
            <span className="text-xs font-bold text-purple-200 block">1. Baixar e Instalar o Ollama</span>
            <p className="text-gray-400">
              O Ollama é gratuito e roda diretamente no Windows, Linux ou Mac.
            </p>
            <button
              onClick={() => handleOpenUrl('https://ollama.com/download')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/80 text-purple-300 hover:text-white border border-purple-500/40 font-semibold transition cursor-pointer"
            >
              <span>Baixar em ollama.com</span>
              <ExternalLink size={13} />
            </button>
          </div>

          <div className="bg-background/60 p-4 rounded-2xl border border-purple-900/30 space-y-2.5">
            <span className="text-xs font-bold text-purple-200 block">2. Baixar um Modelo de Código via Terminal</span>
            <p className="text-gray-400">Abra o PowerShell ou Terminal e execute um dos comandos abaixo:</p>

            <div className="space-y-2 pt-1">
              {recommendedModels.map((item, idx) => {
                const cmd = `ollama run ${item.name}`;
                return (
                  <div key={idx} className="p-2.5 bg-black/70 rounded-xl border border-purple-900/40 flex items-center justify-between font-mono">
                    <div>
                      <span className="text-emerald-300 font-semibold block">{cmd}</span>
                      <span className="text-[10px] text-gray-500">{item.desc}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(cmd, idx)}
                      className="text-gray-400 hover:text-white p-1 rounded transition"
                      title="Copiar comando"
                    >
                      {copiedIndex === idx ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-background/60 p-4 rounded-2xl border border-purple-900/30 space-y-2">
            <span className="text-xs font-bold text-purple-200 block">3. Iniciar o Servidor no Esperto</span>
            <p className="text-gray-400">
              O Esperto tenta iniciar o Ollama automaticamente em segundo plano. Se você usa uma porta personalizada ou instalou em pasta diferente, informe o caminho nas configurações de <strong>Ollama Local</strong>.
            </p>
            <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-mono bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-900/40">
              <ShieldCheck size={16} className="shrink-0" />
              <span>Privacidade total: nenhum dado sai do seu computador durante a inferência local.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
