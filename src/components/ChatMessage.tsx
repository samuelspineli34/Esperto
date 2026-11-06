import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  FileCode,
  Copy,
  Check,
  Pencil,
  RotateCcw,
  AlertTriangle,
  Play,
  Save,
  Terminal,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import { Attachment } from '../lib/db';
import { invoke } from '@tauri-apps/api/core';

export interface ChatMessageProps {
  role: 'user' | 'model';
  content: string;
  attachments?: Attachment[];
  baseDirectories?: string[];
  requireConfirmation?: boolean;
  onEdit?: (newContent: string) => void;
  onRetry?: () => void;
  onOpenArtifact?: (code: string, language: string) => void;
  onFileWritten?: (savedPath: string) => void;
  onRequestSelectFolder?: () => Promise<string | null>;
}

function cleanCodeForWriting(filePath: string, rawCode: string): string {
  let cleaned = rawCode.trim();

  // Limpa tags e markdown aninhados
  cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\r?\n/, '');
  cleaned = cleaned.replace(/\r?\n```\s*$/, '');
  cleaned = cleaned.replace(/<\/?esperto_write[^>]*>/gi, '');

  const lines = cleaned.split(/\r?\n/);
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    const lowerPath = filePath.toLowerCase();
    const isHashCommentLang =
      lowerPath.endsWith('.py') ||
      lowerPath.endsWith('.sh') ||
      lowerPath.endsWith('.bash') ||
      lowerPath.endsWith('.yaml') ||
      lowerPath.endsWith('.yml') ||
      lowerPath.endsWith('dockerfile') ||
      lowerPath.endsWith('.toml');

    if (!isHashCommentLang && (firstLine.startsWith('#') || firstLine.startsWith('###') || firstLine.startsWith('##'))) {
      if (lowerPath.endsWith('.json')) {
        lines.shift();
      } else if (lowerPath.endsWith('.html') || lowerPath.endsWith('.xml') || lowerPath.endsWith('.svg')) {
        lines[0] = `<!-- ${firstLine.replace(/^#+\s*/, '')} -->`;
      } else {
        lines[0] = `// ${firstLine.replace(/^#+\s*/, '')}`;
      }
      cleaned = lines.join('\n');
    }
  }

  return cleaned.trim();
}

export const AgentFileActionCard: React.FC<{
  filePath: string;
  content: string;
  baseDirectories?: string[];
  requireConfirmation?: boolean;
  isIncomplete?: boolean;
  onFileWritten?: (savedPath: string) => void;
  onRequestSelectFolder?: () => Promise<string | null>;
}> = ({
  filePath: initialFilePath,
  content,
  baseDirectories = [],
  requireConfirmation = true,
  isIncomplete = false,
  onFileWritten,
  onRequestSelectFolder,
}) => {
  const [currentFilePath, setCurrentFilePath] = useState(initialFilePath);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [status, setStatus] = useState<'idle' | 'confirming' | 'writing' | 'success' | 'error'>('idle');
  const [showCode, setShowCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const cleanedContent = cleanCodeForWriting(currentFilePath, content);

  const resolveAbsolutePath = (pathInput: string): string => {
    let p = pathInput.trim().replace(/^['"]|['"]$/g, '');
    if (!p.includes(':') && !p.startsWith('/') && baseDirectories.length > 0) {
      const base = baseDirectories[0].replace(/[\\/]$/, '');
      const cleanRelative = p.replace(/^[\\/]/, '').replace(/\//g, '\\');
      return `${base}\\${cleanRelative}`;
    }
    return p;
  };

  const executeWrite = async () => {
    setStatus('writing');
    setErrorMsg('');

    try {
      let finalPath = resolveAbsolutePath(currentFilePath);

      if (!finalPath.includes(':') && !finalPath.startsWith('/') && onRequestSelectFolder) {
        const picked = await onRequestSelectFolder();
        if (!picked) {
          setStatus('idle');
          return;
        }
        finalPath = `${picked.replace(/[\\/]$/, '')}\\${finalPath.replace(/^[\\/]/, '').replace(/\//g, '\\')}`;
      }

      await invoke('write_file', {
        path: finalPath,
        content: cleanedContent,
      });

      setStatus('success');
      if (onFileWritten) onFileWritten(finalPath);
      setTimeout(() => setStatus('idle'), 3500);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err?.toString() || 'Erro ao gravar arquivo no disco.');
    }
  };

  return (
    <div className="my-2.5 rounded-lg border border-[#21293a] bg-[#0c0f16] overflow-hidden shadow-xs font-sans">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#121622] border-b border-[#1c2230]">
        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-[200px]">
          <FileCode size={14} className="text-emerald-400 shrink-0" />

          <div className="overflow-hidden flex-1">
            {isEditingPath ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={currentFilePath}
                  onChange={(e) => setCurrentFilePath(e.target.value)}
                  onBlur={() => setIsEditingPath(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingPath(false)}
                  autoFocus
                  className="bg-[#090b10] border border-emerald-500/60 rounded px-2 py-0.5 text-xs text-white font-mono w-full"
                />
                <button
                  type="button"
                  onClick={() => setIsEditingPath(false)}
                  className="text-emerald-400 text-xs px-1 font-semibold"
                >
                  OK
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group/path">
                <span
                  className="text-xs font-medium text-zinc-200 block font-mono truncate cursor-pointer hover:underline"
                  title={currentFilePath}
                  onClick={() => setIsEditingPath(true)}
                >
                  {currentFilePath}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingPath(true)}
                  className="text-zinc-500 hover:text-zinc-300 transition opacity-0 group-hover/path:opacity-100"
                  title="Alterar destino"
                >
                  <Pencil size={10} />
                </button>
              </div>
            )}
            <span className="text-[10px] text-zinc-500 block truncate font-mono">
              {baseDirectories.length > 0 ? baseDirectories[0] : 'Workspace'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded transition flex items-center gap-1 font-mono hover:bg-[#181d2a]"
          >
            {showCode ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>{showCode ? 'Ocultar' : 'Inspecionar'}</span>
          </button>

          {status === 'confirming' ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={executeWrite}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-2.5 py-1 rounded transition flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Check size={12} />
                <span>Confirmar Gravação</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="bg-[#181d2a] hover:bg-[#202738] text-zinc-400 text-xs px-2 py-1 rounded transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => (requireConfirmation ? setStatus('confirming') : executeWrite())}
              disabled={status === 'writing' || isIncomplete}
              className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 cursor-pointer border ${
                status === 'success'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                  : isIncomplete
                  ? 'bg-[#181d2a] opacity-40 cursor-not-allowed border-zinc-800 text-zinc-500'
                  : 'bg-[#181d2a] hover:bg-[#222838] text-zinc-200 border-[#2b354c]'
              }`}
            >
              {status === 'writing' ? (
                <span>Gravando...</span>
              ) : status === 'success' ? (
                <>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span>Aplicado em Disco</span>
                </>
              ) : (
                <>
                  <Save size={12} className="text-zinc-400" />
                  <span>Gravar Arquivo</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {isIncomplete && (
        <div className="px-3 py-1.5 bg-amber-950/30 text-amber-300 text-[11px] font-mono border-b border-amber-900/30 flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-amber-400 shrink-0" />
          <span>Aviso: Geração cortada no meio. Peça para a IA continuar o arquivo antes de gravar.</span>
        </div>
      )}

      {status === 'error' && (
        <div className="p-2.5 bg-rose-950/40 text-rose-300 text-xs font-mono border-b border-rose-900/30 flex items-start gap-2 max-h-32 overflow-y-auto break-all whitespace-pre-wrap">
          <AlertTriangle size={13} className="text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {showCode && (
        <div className="max-h-72 overflow-y-auto bg-[#07090e]">
          <SyntaxHighlighter
            PreTag="div"
            language="typescript"
            style={vscDarkPlus as any}
            customStyle={{ margin: 0, padding: '0.85rem', background: 'transparent', fontSize: '0.78rem' }}
          >
            {cleanedContent}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
};

export const AgentCommandActionCard: React.FC<{
  command: string;
  baseDirectories?: string[];
  requireConfirmation?: boolean;
}> = ({ command, baseDirectories = [], requireConfirmation = true }) => {
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const cleanCmd = command
    .replace(/^```[a-zA-Z0-9_-]*\r?\n/, '')
    .replace(/\r?\n```\s*$/, '')
    .trim();

  const handleRun = async () => {
    setRunning(true);
    setConfirming(false);
    try {
      const cwd = baseDirectories.length > 0 ? baseDirectories[0] : null;
      const res: any = await invoke('execute_terminal_command', {
        command: cleanCmd,
        cwd,
      });
      setOutput(res.output || `Processo finalizado com status ${res.exit_code}.`);
    } catch (err: any) {
      setOutput(`Erro de execução: ${err?.toString()}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="my-2.5 rounded-lg border border-[#232a3a] bg-[#0c0f16] overflow-hidden shadow-xs font-sans">
      <div className="flex items-center justify-between px-3 py-2 bg-[#121622] border-b border-[#1c2230]">
        <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
          <Terminal size={13} className="text-indigo-400 shrink-0" />
          <div className="overflow-hidden">
            <span className="text-xs font-mono font-medium text-zinc-200 block truncate" title={cleanCmd}>
              {cleanCmd}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Shell de Execução</span>
          </div>
        </div>

        {confirming ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleRun}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-2.5 py-1 rounded transition flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Check size={12} />
              <span>Executar</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="bg-[#181d2a] hover:bg-[#202738] text-zinc-400 text-xs px-2 py-1 rounded transition cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => (requireConfirmation ? setConfirming(true) : handleRun())}
            disabled={running}
            className="bg-[#181d2a] hover:bg-[#222838] border border-[#2b354c] text-zinc-200 text-xs font-medium px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {requireConfirmation ? <ShieldAlert size={12} className="text-amber-400" /> : <Terminal size={12} />}
            <span>{running ? 'Executando...' : 'Rodar Comando'}</span>
          </button>
        )}
      </div>

      {output && (
        <pre className="p-3 bg-[#06080d] text-zinc-300 text-xs font-mono max-h-48 overflow-auto whitespace-pre-wrap select-text border-t border-[#191f2d]">
          {output}
        </pre>
      )}
    </div>
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  attachments,
  baseDirectories = [],
  requireConfirmation = true,
  onEdit,
  onRetry,
  onOpenArtifact,
  onFileWritten,
  onRequestSelectFolder,
}) => {
  const isBot = role === 'model';
  const isError = isBot && content.includes('Erro:');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const [isBatchWriting, setIsBatchWriting] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchStatusText, setBatchStatusText] = useState('');

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() && editContent.trim() !== content) {
      onEdit(editContent.trim());
    }
    setIsEditing(false);
  };

  const parseAgentActions = (rawText: string) => {
    const parts: React.ReactNode[] = [];
    // REGEX INTELIGENTE: tolera tags cortadas sem fechamento no final
    const writeRegex =
      /<esperto_write(?:\s+(?:path|file|filepath)=["']?([^"'>\s]+)["']?)?>([\s\S]*?)(?:<\/esperto_write>|$)/gi;
    const cmdRegex = /<esperto_cmd>([\s\S]*?)(?:<\/esperto_cmd>|$)/gi;

    let lastIndex = 0;
    const fileMatches: { path: string; code: string; isIncomplete: boolean }[] = [];
    const combinedMatches: { index: number; length: number; node: React.ReactNode }[] = [];

    let match: RegExpExecArray | null;
    while ((match = writeRegex.exec(rawText)) !== null) {
      const detectedPath = match[1] || 'arquivo-gerado.ts';
      const fileCode = match[2];
      const hasClosing = match[0].includes('</esperto_write>');
      const isIncomplete = !hasClosing;

      fileMatches.push({ path: detectedPath, code: fileCode, isIncomplete });

      combinedMatches.push({
        index: match.index,
        length: match[0].length,
        node: (
          <AgentFileActionCard
            key={`write-${match.index}`}
            filePath={detectedPath}
            content={fileCode}
            baseDirectories={baseDirectories}
            requireConfirmation={requireConfirmation}
            isIncomplete={isIncomplete}
            onFileWritten={onFileWritten}
            onRequestSelectFolder={onRequestSelectFolder}
          />
        ),
      });
    }

    while ((match = cmdRegex.exec(rawText)) !== null) {
      combinedMatches.push({
        index: match.index,
        length: match[0].length,
        node: (
          <AgentCommandActionCard
            key={`cmd-${match.index}`}
            command={match[1]}
            baseDirectories={baseDirectories}
            requireConfirmation={requireConfirmation}
          />
        ),
      });
    }

    combinedMatches.sort((a, b) => a.index - b.index);

    if (fileMatches.length > 1) {
      parts.push(
        <div key="batch-panel" className="my-3 p-3 bg-[#0d141e] border border-[#1e2a3c] rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-indigo-400" />
              <span className="text-xs font-semibold text-zinc-100 font-mono">
                {fileMatches.length} arquivos prontos para modificação
              </span>
            </div>

            <button
              type="button"
              disabled={isBatchWriting}
              onClick={async () => {
                setIsBatchWriting(true);
                setBatchProgress(0);
                for (let i = 0; i < fileMatches.length; i++) {
                  const f = fileMatches[i];
                  setBatchStatusText(`Gravando ${i + 1}/${fileMatches.length}: ${f.path}`);
                  let target = f.path.trim().replace(/^['"]|['"]$/g, '');
                  if (!target.includes(':') && !target.startsWith('/') && baseDirectories.length > 0) {
                    const base = baseDirectories[0].replace(/[\\/]$/, '');
                    target = `${base}\\${target.replace(/^[\\/]/, '').replace(/\//g, '\\')}`;
                  }
                  await invoke('write_file', {
                    path: target,
                    content: cleanCodeForWriting(target, f.code),
                  });
                  if (onFileWritten) onFileWritten(target);
                  setBatchProgress(Math.round(((i + 1) / fileMatches.length) * 100));
                }
                setBatchStatusText(`Todos os ${fileMatches.length} arquivos foram gravados com sucesso!`);
                setTimeout(() => setIsBatchWriting(false), 3000);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3 py-1 rounded transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save size={12} />
              <span>{isBatchWriting ? 'Gravando Lote...' : 'Gravar Todos em Disco'}</span>
            </button>
          </div>

          {isBatchWriting && (
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-zinc-400">
                <span>{batchStatusText}</span>
                <span>{batchProgress}%</span>
              </div>
              <div className="w-full bg-[#080a0f] h-2 rounded-full overflow-hidden border border-[#1e2637]">
                <div
                  className="bg-emerald-500 h-full transition-all duration-200"
                  style={{ width: `${batchProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    const renderMarkdownBlock = (textSegment: string, keyPrefix: string) => (
      <ReactMarkdown
        key={keyPrefix}
        components={{
          code(props) {
            const { children, className, ...rest } = props as any;
            const matchLang = /language-(\w+)/.exec(className || '');
            const lang = matchLang ? matchLang[1].toLowerCase() : '';
            const codeString = String(children).replace(/\n$/, '');

            return matchLang ? (
              <div className="relative my-2 rounded-lg overflow-hidden border border-[#21293a] bg-[#080a0f]">
                <div className="flex items-center justify-between px-3 py-1 bg-[#121622] border-b border-[#1c2230] text-[11px] font-mono text-zinc-400">
                  <span>{lang || 'code'}</span>
                  {onOpenArtifact && ['html', 'svg', 'tsx', 'jsx'].includes(lang) && (
                    <button
                      onClick={() => onOpenArtifact(codeString, lang)}
                      className="hover:text-white flex items-center gap-1"
                    >
                      <Play size={10} />
                      <span>Preview</span>
                    </button>
                  )}
                </div>
                <SyntaxHighlighter
                  PreTag="div"
                  language={lang}
                  style={vscDarkPlus as any}
                  customStyle={{ margin: 0, padding: '0.85rem', background: 'transparent', fontSize: '0.78rem' }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code {...rest} className="bg-[#161a25] px-1 py-0.5 rounded text-zinc-200 font-mono text-xs border border-[#242b3d]">
                {children}
              </code>
            );
          },
        }}
      >
        {textSegment}
      </ReactMarkdown>
    );

    combinedMatches.forEach((m) => {
      if (m.index > lastIndex) {
        parts.push(renderMarkdownBlock(rawText.slice(lastIndex, m.index), `text-${lastIndex}`));
      }
      parts.push(m.node);
      lastIndex = m.index + m.length;
    });

    if (lastIndex < rawText.length) {
      parts.push(renderMarkdownBlock(rawText.slice(lastIndex), `text-${lastIndex}`));
    }

    return parts.length > 0 ? parts : renderMarkdownBlock(rawText, 'full-text');
  };

  return (
    <div
      className={`px-6 py-4.5 group border-b border-[#131722] ${
        isError ? 'bg-rose-950/20' : isBot ? 'bg-[#0a0d14]' : 'bg-[#090b10]'
      }`}
    >
      <div className="max-w-4xl mx-auto flex gap-3.5">
        <div className="w-16 shrink-0 pt-0.5 select-none">
          <span
            className={`font-mono text-[11px] font-semibold tracking-wider block uppercase ${
              isBot ? 'text-indigo-400' : 'text-zinc-500'
            }`}
          >
            {isBot ? 'Esperto' : 'Você'}
          </span>
        </div>

        <div className="flex-1 overflow-hidden select-text leading-relaxed text-[13px] text-zinc-200">
          {attachments && attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((att, idx) => {
                const isImg = att.mimeType.startsWith('image/');
                return isImg ? (
                  <div key={idx} className="relative rounded-lg overflow-hidden border border-[#242b3d] max-w-xs shadow-xs">
                    <img src={`data:${att.mimeType};base64,${att.data}`} alt={att.name} className="max-h-48 object-cover" />
                  </div>
                ) : (
                  <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#131722] border border-[#22293b] text-xs text-zinc-300 font-mono">
                    <FileCode size={13} className="text-zinc-400" />
                    <span className="truncate max-w-45">{att.name}</span>
                  </div>
                );
              })}
            </div>
          )}

          {isEditing ? (
            <div className="space-y-2 mt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                className="w-full bg-[#07090e] border border-indigo-500/50 rounded-lg p-2.5 text-xs text-white focus:outline-none resize-none font-mono"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1 rounded transition cursor-pointer"
                >
                  Salvar e Reenviar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditContent(content);
                    setIsEditing(false);
                  }}
                  className="bg-[#161a25] text-zinc-400 text-xs px-2.5 py-1 rounded transition cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className={isError ? 'text-rose-300 font-medium break-all whitespace-pre-wrap' : ''}>
              {parseAgentActions(content)}
            </div>
          )}

          {!isEditing && (
            <div className="flex items-center gap-3 mt-2 select-none opacity-0 group-hover:opacity-100 transition">
              {!isError && (
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="text-zinc-500 hover:text-zinc-300 transition text-[11px] flex items-center gap-1 cursor-pointer font-mono"
                >
                  {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{copied ? 'copiado' : 'copiar'}</span>
                </button>
              )}

              {!isBot && onEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-zinc-500 hover:text-zinc-300 transition text-[11px] flex items-center gap-1 cursor-pointer font-mono"
                >
                  <Pencil size={11} />
                  <span>editar</span>
                </button>
              )}

              {isBot && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-zinc-500 hover:text-zinc-300 transition text-[11px] flex items-center gap-1 cursor-pointer font-mono"
                >
                  <RotateCcw size={11} />
                  <span>regenerar</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;