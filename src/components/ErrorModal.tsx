import React, { useState } from 'react';
import { X, AlertTriangle, Copy, Check, Terminal } from 'lucide-react';
import { CURRENT_VERSION } from '../services/updater';

export interface AppErrorInfo {
  title: string;
  message: string;
  context: string;
  technicalDetails?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  errorInfo: AppErrorInfo | null;
}

export const ErrorModal: React.FC<Props> = ({ isOpen, onClose, errorInfo }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !errorInfo) return null;

  const generateFullLog = () => {
    return `========================================
ESPERTO ERROR REPORT
========================================
Data/Hora: ${new Date().toLocaleString('pt-BR')}
Versão do App: ${CURRENT_VERSION}
Contexto: ${errorInfo.context}
Título: ${errorInfo.title}
Mensagem: ${errorInfo.message}

--- DETALHES TÉCNICOS ---
${errorInfo.technicalDetails || 'Nenhum stack trace adicional disponível.'}
========================================`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateFullLog());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      {/* Container principal com restrição máxima de altura e largura */}
      <div className="bg-[#0c0f16] border border-[#21293a] rounded-xl w-full max-w-2xl p-5 relative shadow-2xl flex flex-col font-sans max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded hover:bg-[#181d2a] transition cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#1c2232]">
          <div className="p-2 rounded-lg bg-rose-950/40 text-rose-400 border border-rose-900/50">
            <AlertTriangle size={18} />
          </div>
          <div className="overflow-hidden pr-6">
            <h2 className="text-sm font-bold text-zinc-100 tracking-wide font-mono uppercase truncate">
              {errorInfo.title}
            </h2>
            <span className="text-[11px] text-rose-400/80 font-mono truncate block">
              Contexto: {errorInfo.context}
            </span>
          </div>
        </div>

        {/* Área de rolagem para erros imensos */}
        <div className="space-y-3 overflow-y-auto pr-1">
          {/* Quebra forçada de texto (break-all) para JSONs contínuos da API */}
          <div className="bg-[#0f121a] p-3 rounded-lg border border-[#1e2535] max-h-48 overflow-y-auto">
            <p className="text-xs text-zinc-300 leading-relaxed font-mono break-all whitespace-pre-wrap">
              {errorInfo.message}
            </p>
          </div>

          {errorInfo.technicalDetails && (
            <div>
              <div className="flex items-center justify-between mb-1.5 mt-2">
                <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <Terminal size={12} className="text-rose-400" />
                  <span>Log de Diagnóstico Técnico</span>
                </span>
              </div>

              {/* Log técnico isolado com limite de altura */}
              <pre className="p-3 bg-[#06080b] text-rose-300/80 text-[10px] font-mono rounded-lg border border-[#1a202c] max-h-48 overflow-y-auto whitespace-pre-wrap break-all select-text leading-relaxed">
                {errorInfo.technicalDetails}
              </pre>
            </div>
          )}
        </div>

        <div className="pt-4 mt-4 border-t border-[#1c2232] flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded transition hover:bg-[#181d2a] cursor-pointer"
          >
            Fechar
          </button>

          <button
            onClick={handleCopy}
            className="bg-[#181d2a] hover:bg-[#202738] border border-[#2b354c] text-zinc-200 font-medium px-4 py-1.5 rounded-lg transition text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? 'Copiado para o Ctrl+V!' : 'Copiar Log Completo'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;