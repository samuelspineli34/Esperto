import React, { useState } from 'react';
import { X, Play, Code, Maximize2, Minimize2, Copy, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  language: string;
}

export const ArtifactPreview: React.FC<Props> = ({ isOpen, onClose, code, language }) => {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Gera o HTML com Tailwind CSS injetado para visualização rica
  const srcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        </style>
      </head>
      <body class="bg-slate-900 text-slate-100 p-4">
        ${code}
      </body>
    </html>
  `;

  return (
    <div
      className={`fixed top-0 right-0 h-screen bg-surface border-l border-purple-950/40 z-40 flex flex-col shadow-2xl transition-all duration-300 ${
        isExpanded ? 'w-full md:w-3/4' : 'w-full md:w-1/2'
      }`}
    >
      {/* Barra de Ferramentas do Artifact */}
      <div className="h-14 border-b border-purple-950/30 px-4 flex items-center justify-between bg-background select-none">
        <div className="flex items-center gap-2">
          <div className="flex bg-surface rounded-xl p-1 border border-purple-900/30">
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'preview' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Play size={12} />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'code' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Code size={12} />
              <span>Código</span>
            </button>
          </div>
          <span className="text-[11px] font-mono text-purple-300/60 uppercase">{language}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            title="Copiar código"
            className="p-2 text-gray-400 hover:text-purple-300 rounded-lg hover:bg-surfaceHover transition cursor-pointer"
          >
            {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Diminuir' : 'Expandir'}
            className="p-2 text-gray-400 hover:text-purple-300 rounded-lg hover:bg-surfaceHover transition cursor-pointer"
          >
            {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            onClick={onClose}
            title="Fechar Preview"
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-surfaceHover transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Conteúdo: Sandbox ou Código */}
      <div className="flex-1 bg-background overflow-hidden relative">
        {viewMode === 'preview' ? (
          <iframe
            title="Artifact Preview Sandbox"
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-modals"
            className="w-full h-full border-0 bg-slate-950"
          />
        ) : (
          <pre className="p-4 text-xs font-mono text-purple-200 overflow-auto h-full whitespace-pre-wrap select-text">
            {code}
          </pre>
        )}
      </div>
    </div>
  );
};