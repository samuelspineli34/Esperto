import React from 'react';
import { X, Sparkles, Download, CheckCircle2, RefreshCw } from 'lucide-react';
import { ReleaseInfo, CURRENT_VERSION } from '../services/updater';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  checking: boolean;
  release: ReleaseInfo | null;
  onCheckAgain: () => void;
}

export const UpdateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  checking,
  release,
  onCheckAgain,
}) => {
  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!release?.htmlUrl) return;

    try {
      // Tenta abrir via plugin nativo do Tauri
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(release.htmlUrl);
    } catch {
      // Fallback para navegador web padrão
      window.open(release.htmlUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-surface border border-purple-900/40 rounded-3xl w-full max-w-md p-6 relative shadow-2xl shadow-purple-950/80">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-surfaceHover transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-purple-900/40 text-purple-300 border border-purple-500/30">
            <RefreshCw size={18} className={checking ? 'animate-spin' : ''} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Central de Atualizações</h2>
            <p className="text-xs text-purple-300/60 font-mono">Versão instalada: {CURRENT_VERSION}</p>
          </div>
        </div>

        {checking ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <RefreshCw size={32} className="text-purple-400 animate-spin mb-3" />
            <p className="text-sm text-gray-300">Consultando o GitHub por novas versões...</p>
          </div>
        ) : release && release.hasUpdate ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-start gap-3">
              <Sparkles size={20} className="text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-purple-200">
                  Nova versão disponível: {release.tagName}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Lançada em {release.publishedAt}</p>
              </div>
            </div>

            <div className="bg-background/60 border border-purple-900/30 rounded-xl p-3 max-h-40 overflow-y-auto">
              <span className="text-[11px] font-semibold text-purple-300 block mb-1">Notas da Versão:</span>
              <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">
                {release.body}
              </p>
            </div>

            {/* Botão com clique nativo */}
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold py-2.5 rounded-xl transition text-sm shadow-lg shadow-purple-950/60 cursor-pointer"
            >
              <Download size={16} />
              <span>Baixar Atualização ({release.tagName})</span>
            </button>
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle2 size={42} className="text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-white">Você está na versão mais recente!</p>
              <p className="text-xs text-gray-400 mt-1">O Esperto está 100% atualizado ({CURRENT_VERSION}).</p>
            </div>
            <button
              onClick={onCheckAgain}
              className="mt-2 text-xs font-medium text-purple-300 hover:text-purple-200 bg-surface border border-purple-900/40 px-3 py-1.5 rounded-xl hover:bg-surfaceHover transition cursor-pointer"
            >
              Verificar Novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};