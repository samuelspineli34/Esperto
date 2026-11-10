import React, { useState, useRef } from 'react';
import { X, Sparkles, Download, CheckCircle2, RefreshCw, RotateCcw, AlertTriangle, ShieldCheck, Gauge } from 'lucide-react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { invoke } from '@tauri-apps/api/core';
import { ReleaseInfo, CURRENT_VERSION } from '../services/updater';
import { AppErrorInfo } from './ErrorModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  checking: boolean;
  release: ReleaseInfo | null;
  onCheckAgain: () => void;
  onErrorTrigger: (error: AppErrorInfo) => void;
}

export const UpdateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  checking,
  release,
  onCheckAgain,
  onErrorTrigger,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState('');
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [statusText, setStatusText] = useState('');

  if (!isOpen) return null;

  const handleInstallUpdate = async () => {
    try {
      setDownloading(true);
      setProgress(5);
      setStatusText('Iniciando conexão com o repositório seguro...');

      let updateAttemptSucceeded = false;

      // Canal 1: Plugin Updater Oficial do Tauri 2
      try {
        const update = await check();
        if (update) {
          let downloaded = 0;
          let contentLength = 0;
          let lastTime = Date.now();
          let lastBytes = 0;

          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                contentLength = event.data.contentLength || 0;
                setStatusText('Baixando pacote verificado...');
                break;
              case 'Progress':
                downloaded += event.data.chunkLength;
                if (contentLength > 0) {
                  const percent = Math.round((downloaded / contentLength) * 100);
                  setProgress(percent);

                  const now = Date.now();
                  const deltaSec = (now - lastTime) / 1000;
                  if (deltaSec > 0.5) {
                    const speed = (downloaded - lastBytes) / (1024 * 1024 * deltaSec);
                    setDownloadSpeed(`${speed.toFixed(1)} MB/s`);
                    lastTime = now;
                    lastBytes = downloaded;
                  }
                }
                break;
              case 'Finished':
                setStatusText('Validando integridade SHA256...');
                setProgress(100);
                break;
            }
          });

          setDownloadComplete(true);
          setStatusText('Atualização aplicada com sucesso! Reiniciando...');
          updateAttemptSucceeded = true;
          setTimeout(async () => {
            await relaunch();
          }, 1500);
          return;
        }
      } catch (tauriPluginErr) {
        console.warn('Canal primário de update indisponível, usando fallback de instalador direto:', tauriPluginErr);
      }

      // Canal 2: Fallback Inteligente Nativo
      if (!updateAttemptSucceeded) {
        const targetDownloadUrl = release?.downloadUrl;
        if (!targetDownloadUrl) {
          throw new Error('Nenhum instalador executável foi localizado na Release do GitHub.');
        }

        setStatusText('Baixando nova versão através do canal nativo...');
        setProgress(35);
        setDownloadSpeed('Conexão Direta');

        await invoke('download_and_run_installer', { url: targetDownloadUrl });

        setProgress(100);
        setDownloadComplete(true);
        setStatusText('Iniciando o instalador e aplicando melhorias...');
      }
    } catch (err: any) {
      setDownloading(false);
      onErrorTrigger({
        title: 'Falha na Instalação da Atualização',
        context: 'Sistema de Atualização Contínua',
        message: err?.message || 'Não foi possível baixar ou iniciar a nova versão automaticamente.',
        technicalDetails: err?.toString() || 'Erro desconhecido',
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#0e121a] border border-[#202738] rounded-2xl w-full max-w-lg p-6 relative shadow-2xl font-sans">
        {!downloading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded transition cursor-pointer"
          >
            <X size={16} />
          </button>
        )}

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-lg bg-[#141924] text-zinc-300 border border-[#22293b]">
            <RefreshCw size={16} className={checking || downloading ? 'animate-spin' : ''} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 font-mono uppercase tracking-wide">
              Atualizações do Esperto
            </h2>
            <p className="text-xs text-zinc-500 font-mono">Versão instalada: {CURRENT_VERSION}</p>
          </div>
        </div>

        {checking ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <RefreshCw size={26} className="text-indigo-400 animate-spin mb-3" />
            <p className="text-xs text-zinc-400 font-mono">Verificando novas versões e canais de distribuição...</p>
          </div>
        ) : release && release.hasUpdate ? (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[#121622] border border-[#21293a] flex items-start gap-2.5">
              <Sparkles size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100 font-mono">
                    Nova versão disponível: {release.tagName}
                  </span>
                  {release.installerSizeMb && (
                    <span className="text-[10px] font-mono text-zinc-400 bg-[#090b10] px-1.5 py-0.5 rounded border border-[#1b2230]">
                      ~{release.installerSizeMb} MB
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">Lançada em {release.publishedAt}</span>
              </div>
            </div>

            <div className="bg-[#080a0f] border border-[#1d2332] rounded-xl p-3 max-h-44 overflow-y-auto">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1 font-semibold">
                Novidades e Mudanças:
              </span>
              <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-mono">
                {release.body}
              </p>
            </div>

            {downloading && (
              <div className="space-y-1.5 py-1 font-mono">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span className="truncate max-w-[280px]">{statusText}</span>
                  <div className="flex items-center gap-2">
                    {downloadSpeed && <span className="text-emerald-400 text-[10px]">{downloadSpeed}</span>}
                    <span>{progress}%</span>
                  </div>
                </div>
                <div className="w-full bg-[#121622] rounded-full h-2 overflow-hidden border border-[#21293a]">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {!downloading ? (
              <button
                onClick={handleInstallUpdate}
                className="w-full flex items-center justify-center gap-2 bg-zinc-200 hover:bg-white text-zinc-900 font-semibold py-2.5 rounded-xl transition text-xs font-mono shadow-sm cursor-pointer"
              >
                <Download size={14} />
                <span>Instalar Atualização ({release.tagName})</span>
              </button>
            ) : downloadComplete ? (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-600/40 rounded-xl text-xs text-emerald-300 font-mono flex items-center justify-center gap-2">
                <RotateCcw size={13} className="animate-spin" />
                <span>Instalador disparado com sucesso!</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle2 size={36} className="text-emerald-400" />
            <div>
              <p className="text-xs font-semibold text-zinc-200 font-mono">Ambiente Atualizado</p>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                Você já está rodando a compilação mais estável ({CURRENT_VERSION}).
              </p>
            </div>
            <button
              onClick={onCheckAgain}
              className="mt-1 text-xs font-mono text-zinc-400 hover:text-white bg-[#141924] border border-[#22293b] px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              Verificar Novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateModal;