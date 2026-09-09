import React, { useState } from 'react';
import { X, AlertOctagon, Copy, Check, Terminal } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#140b0f] border border-red-900/50 rounded-3xl w-full max-w-xl p-6 relative shadow-2xl shadow-red-950/60 flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-surfaceHover transition cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-red-950/40">
          <div className="p-2.5 rounded-xl bg-red-950/80 text-red-400 border border-red-800/50 shadow-inner">
            <AlertOctagon size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">{errorInfo.title}</h2>
            <span className="text-[11px] text-red-400/80 font-mono">Contexto: {errorInfo.context}</span>
          </div>
        </div>

        <div className="space-y-3.5 my-2">
          <p className="text-xs text-gray-200 leading-relaxed font-sans bg-red-950/20 p-3 rounded-xl border border-red-900/30">
            {errorInfo.message}
          </p>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5 font-mono">
                <Terminal size={12} className="text-red-400" />
                <span>Log de Diagnóstico Técnico:</span>
              </span>
            </div>

            <pre className="p-3 bg-black/80 text-red-300/90 text-[11px] font-mono rounded-xl border border-red-950/60 max-h-48 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
              {errorInfo.technicalDetails || 'Sem detalhes adicionais.'}
            </pre>
          </div>
        </div>

        <div className="pt-4 mt-3 border-t border-red-950/40 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white px-4 py-2 rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>

          <button
            onClick={handleCopy}
            className="bg-linear-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 text-white font-semibold px-4 py-2 rounded-xl transition text-xs shadow-lg shadow-red-950/50 flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
            <span>{copied ? 'Log Copiado para o Ctrl+V!' : 'Copiar Log Completo'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};