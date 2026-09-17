import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Eye,
  User,
  FileText,
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
  FolderOpen,
  FileCode,
} from 'lucide-react';
import { Attachment } from '../lib/db';
import { invoke } from '@tauri-apps/api/core';

interface Props {
  role: 'user' | 'model';
  content: string;
  attachments?: Attachment[];
  baseDirectories?: string[];
  onEdit?: (newContent: string) => void;
  onRetry?: () => void;
  onOpenArtifact?: (code: string, language: string) => void;
  onFileWritten?: (savedPath: string) => void;
  onRequestSelectFolder?: () => Promise<string | null>;
}

/**
 * Limpa cercas de markdown (```lang) e remove ou converte títulos markdown (#)
 * no topo do arquivo que fariam a linguagem quebrar (ex: TS, JS, Rust, JSON).
 */
function cleanCodeForWriting(filePath: string, rawCode: string): string {
  let cleaned = rawCode.trim();

  // 1. Remove cercas de markdown acidentalmente colocadas dentro da tag
  cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\r?\n/, '');
  cleaned = cleaned.replace(/\r?\n```\s*$/, '');

  // 2. Normaliza linhas e trata cabeçalhos '#'
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
      lowerPath.endsWith('.dockerfile') ||
      lowerPath.endsWith('dockerfile') ||
      lowerPath.endsWith('.toml');

    // Se o modelo começou com título markdown (# Título ou # Arquivo: nome)
    if (!isHashCommentLang && (firstLine.startsWith('#') || firstLine.startsWith('###') || firstLine.startsWith('##'))) {
      if (lowerPath.endsWith('.json')) {
        // JSON não aceita comentários, remove a linha
        lines.shift();
      } else if (lowerPath.endsWith('.html') || lowerPath.endsWith('.xml') || lowerPath.endsWith('.svg')) {
        lines[0] = `<!-- ${firstLine.replace(/^#+\s*/, '')} -->`;
      } else {
        // TypeScript, JavaScript, Rust, CSS, C++, Go: converte # para //
        lines[0] = `// ${firstLine.replace(/^#+\s*/, '')}`;
      }
      cleaned = lines.join('\n');
    }
  }

  return cleaned.trim();
}

/**
 * Tenta adivinhar o caminho do arquivo a partir de comentários na primeira linha do código
 */
function detectFileNameFromCode(code: string, language: string): string {
  const lines = code.trim().split(/\r?\n/);
  if (lines.length > 0) {
    const first = lines[0].trim();
    const match = first.match(
      /^(?:\/\/|\/\*|#|<!--)\s*(?:(?:file|filepath|arquivo|path):\s*)?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9_-]+)/i,
    );
    if (match && match[1]) {
      return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }

  const extMap: Record<string, string> = {
    typescript: 'ts',
    tsx: 'tsx',
    javascript: 'js',
    jsx: 'jsx',
    rust: 'rs',
    python: 'py',
    html: 'html',
    css: 'css',
    json: 'json',
    sql: 'sql',
    markdown: 'md',
    shell: 'sh',
    bash: 'sh',
    powershell: 'ps1',
  };
  const ext = extMap[language.toLowerCase()] || 'txt';
  return `arquivo-gerado.${ext}`;
}

export const AgentFileActionCard: React.FC<{
  filePath: string;
  content: string;
  baseDirectories?: string[];
  onFileWritten?: (savedPath: string) => void;
  onRequestSelectFolder?: () => Promise<string | null>;
}> = ({ filePath: initialFilePath, content, baseDirectories = [], onFileWritten, onRequestSelectFolder }) => {
  const [currentFilePath, setCurrentFilePath] = useState(initialFilePath);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [status, setStatus] = useState<'idle' | 'writing' | 'success' | 'error'>('idle');
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

  const handleApplyToDisk = async () => {
    setStatus('writing');
    setErrorMsg('');

    try {
      let finalPath = resolveAbsolutePath(currentFilePath);

      // Se não há workspace selecionado e é caminho relativo, pede pasta
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
      setTimeout(() => setStatus('idle'), 4000);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err?.toString() || 'Erro ao gravar arquivo no disco.');
    }
  };

  return (
    <div className="my-3 rounded-2xl border border-emerald-500/40 bg-[#0d1612] overflow-hidden shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-950/40 border-b border-emerald-900/30">
        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-[200px]">
          <div className="p-1.5 rounded-lg bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 shrink-0">
            <Save size={14} />
          </div>

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
                  className="bg-background border border-emerald-500 rounded px-2 py-0.5 text-xs text-white font-mono w-full"
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
                  className="text-xs font-bold text-emerald-200 block font-mono truncate cursor-pointer hover:underline"
                  title={currentFilePath}
                  onClick={() => setIsEditingPath(true)}
                >
                  {currentFilePath}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingPath(true)}
                  className="text-emerald-400/60 hover:text-emerald-300 transition opacity-0 group-hover/path:opacity-100"
                  title="Alterar destino do arquivo"
                >
                  <Pencil size={11} />
                </button>
              </div>
            )}
            <span className="text-[10px] text-emerald-400/80 block truncate">
              {baseDirectories.length > 0 ? `Salvar em: ${baseDirectories[0]}` : 'Caminho do projeto'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className="text-[11px] text-emerald-400 hover:text-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-900/30 transition flex items-center gap-1 cursor-pointer font-mono"
          >
            {showCode ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span>{showCode ? 'Ocultar' : 'Ver Código'}</span>
          </button>

          <button
            type="button"
            onClick={handleApplyToDisk}
            disabled={status === 'writing'}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-md cursor-pointer ${
              status === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
            }`}
          >
            {status === 'writing' ? (
              <span>Gravando...</span>
            ) : status === 'success' ? (
              <>
                <CheckCircle2 size={13} />
                <span>Gravado no Disco!</span>
              </>
            ) : (
              <>
                <Save size={13} />
                <span>Gravar no Disco</span>
              </>
            )}
          </button>
        </div>
      </div>

      {status === 'error' && (
        <div className="p-2.5 bg-red-950/60 text-red-300 text-xs font-mono border-b border-red-900/40 whitespace-pre-wrap">
          ⚠️ {errorMsg}
        </div>
      )}

      {showCode && (
        <div className="max-h-72 overflow-y-auto">
          <SyntaxHighlighter
            PreTag="div"
            language="typescript"
            style={vscDarkPlus as any}
            customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.80rem' }}
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
}> = ({ command, baseDirectories = [] }) => {
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Remove cercas ```bash ou comentários Markdown
  const cleanCmd = command
    .replace(/^```[a-zA-Z0-9_-]*\r?\n/, '')
    .replace(/\r?\n```\s*$/, '')
    .trim();

  const handleRun = async () => {
    setRunning(true);
    try {
      const cwd = baseDirectories.length > 0 ? baseDirectories[0] : null;
      const res = await invoke<string>('execute_terminal_command', {
        command: cleanCmd,
        cwd,
      });
      setOutput(res || 'Comando executado com sucesso (sem saída no console).');
    } catch (err: any) {
      setOutput(`Erro ao executar: ${err?.toString()}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="my-3 rounded-2xl border border-purple-500/40 bg-[#120e1a] overflow-hidden shadow-xl">
      <div className="flex items-center justify-between p-3 bg-purple-950/40 border-b border-purple-900/30">
        <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
          <div className="p-1.5 rounded-lg bg-purple-900/50 text-purple-300 border border-purple-500/30 shrink-0">
            <Terminal size={14} />
          </div>
          <div className="overflow-hidden">
            <span className="text-xs font-bold text-purple-200 block font-mono truncate" title={cleanCmd}>
              {cleanCmd}
            </span>
            <span className="text-[10px] text-purple-400/80">Comando Terminal (PowerShell / Shell)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-md"
        >
          <Terminal size={13} />
          <span>{running ? 'Executando...' : 'Executar Comando'}</span>
        </button>
      </div>

      {output && (
        <pre className="p-3 bg-black/80 text-purple-200 text-xs font-mono max-h-48 overflow-auto whitespace-pre-wrap select-text">
          {output}
        </pre>
      )}
    </div>
  );
};

export const CodeBlock: React.FC<{
  language: string;
  codeString: string;
  baseDirectories?: string[];
  onOpenArtifact?: (code: string, lang: string) => void;
  onFileWritten?: (savedPath: string) => void;
  onRequestSelectFolder?: () => Promise<string | null>;
}> = ({ language, codeString, baseDirectories = [], onOpenArtifact, onFileWritten, onRequestSelectFolder }) => {
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'writing' | 'success' | 'error'>('idle');
  const [savePath, setSavePath] = useState(() => detectFileNameFromCode(codeString, language));
  const isPreviewable = ['html', 'svg', 'xml', 'jsx', 'tsx'].includes(language);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickSaveToDisk = async () => {
    setSaveStatus('writing');
    try {
      let finalPath = savePath.trim().replace(/^['"]|['"]$/g, '');
      if (!finalPath.includes(':') && !finalPath.startsWith('/') && baseDirectories.length > 0) {
        const base = baseDirectories[0].replace(/[\\/]$/, '');
        const cleanRelative = finalPath.replace(/^[\\/]/, '').replace(/\//g, '\\');
        finalPath = `${base}\\${cleanRelative}`;
      } else if (!finalPath.includes(':') && !finalPath.startsWith('/') && onRequestSelectFolder) {
        const picked = await onRequestSelectFolder();
        if (!picked) {
          setSaveStatus('idle');
          return;
        }
        finalPath = `${picked.replace(/[\\/]$/, '')}\\${finalPath.replace(/^[\\/]/, '').replace(/\//g, '\\')}`;
      }

      const cleanedContent = cleanCodeForWriting(finalPath, codeString);

      await invoke('write_file', {
        path: finalPath,
        content: cleanedContent,
      });

      setSaveStatus('success');
      if (onFileWritten) onFileWritten(finalPath);
      setTimeout(() => {
        setSaveStatus('idle');
        setIsSaving(false);
      }, 2500);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  return (
    <div className="relative my-3 rounded-2xl overflow-hidden border border-purple-900/40 bg-[#0d1117] shadow-lg">
      <div className="flex items-center justify-between px-4 py-1.5 bg-surface border-b border-purple-950/40 select-none flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileCode size={13} className="text-purple-400" />
          <span className="text-[11px] font-mono font-bold text-purple-300 uppercase tracking-wider">
            {language || 'código'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {isPreviewable && onOpenArtifact && (
            <button
              type="button"
              onClick={() => onOpenArtifact(codeString, language)}
              className="bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-300 text-[11px] font-semibold px-2 py-0.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
              title="Abrir prévia interativa"
            >
              <Play size={11} />
              <span>Preview</span>
            </button>
          )}

          {/* Botão para Gravar Direto no Disco qualquer bloco de código */}
          <button
            type="button"
            onClick={() => setIsSaving(!isSaving)}
            className="bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-500/40 text-emerald-300 hover:text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
            title="Gravar este código diretamente no disco"
          >
            <Save size={11} />
            <span>Gravar no Disco</span>
          </button>

          <button
            type="button"
            onClick={handleCopyCode}
            className="text-gray-400 hover:text-purple-300 text-[11px] font-mono flex items-center gap-1 transition cursor-pointer p-1 rounded hover:bg-surfaceHover"
            title="Copiar código"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      {isSaving && (
        <div className="bg-emerald-950/40 border-b border-emerald-900/40 p-2.5 flex items-center gap-2 text-xs">
          <span className="text-emerald-300 font-mono text-[11px] shrink-0">Caminho:</span>
          <input
            type="text"
            value={savePath}
            onChange={(e) => setSavePath(e.target.value)}
            placeholder="ex: src/components/NovoComponente.tsx"
            className="flex-1 bg-background border border-emerald-500/50 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none"
          />
          <button
            type="button"
            onClick={handleQuickSaveToDisk}
            disabled={saveStatus === 'writing'}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1 rounded-lg text-xs transition flex items-center gap-1 cursor-pointer"
          >
            {saveStatus === 'writing' ? (
              <span>Salvando...</span>
            ) : saveStatus === 'success' ? (
              <>
                <CheckCircle2 size={12} />
                <span>Salvo!</span>
              </>
            ) : (
              <>
                <Save size={12} />
                <span>Salvar Agora</span>
              </>
            )}
          </button>
        </div>
      )}

      <SyntaxHighlighter
        PreTag="div"
        language={language}
        style={vscDarkPlus as any}
        customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.82rem' }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
};

export const ChatMessage: React.FC<Props> = ({
  role,
  content,
  attachments,
  baseDirectories = [],
  onEdit,
  onRetry,
  onOpenArtifact,
  onFileWritten,
  onRequestSelectFolder,
}) => {
  const isBot = role === 'model';
  const isError = isBot && (content.startsWith('⚠️') || content.includes('Erro:'));
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

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
    // Regex flexível: aceita path, file, filepath, com ou sem aspas
    const writeRegex =
      /<esperto_write(?:\s+(?:path|file|filepath)=["']?([^"'>\s]+)["']?)?>([\s\S]*?)<\/esperto_write>/gi;
    const cmdRegex = /<esperto_cmd>([\s\S]*?)<\/esperto_cmd>/gi;

    let lastIndex = 0;
    const combinedMatches: { index: number; length: number; node: React.ReactNode; filePath?: string; fileContent?: string }[] = [];

    let match: RegExpExecArray | null;
    while ((match = writeRegex.exec(rawText)) !== null) {
      const detectedPath = match[1] || 'arquivo-gerado.ts';
      const fileCode = match[2];
      combinedMatches.push({
        index: match.index,
        length: match[0].length,
        filePath: detectedPath,
        fileContent: fileCode,
        node: (
          <AgentFileActionCard
            key={`write-${match.index}`}
            filePath={detectedPath}
            content={fileCode}
            baseDirectories={baseDirectories}
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
          />
        ),
      });
    }

    combinedMatches.sort((a, b) => a.index - b.index);

    // Se houver mais de 1 arquivo gerado, adiciona opção no topo para gravar todos em 1 clique
    const filesToBatchSave = combinedMatches.filter((m) => m.filePath && m.fileContent);
    if (filesToBatchSave.length > 1) {
      parts.push(
        <div key="batch-actions" className="mb-3 p-2.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-200">
              {filesToBatchSave.length} arquivos gerados nesta resposta
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              for (const f of filesToBatchSave) {
                if (!f.filePath || !f.fileContent) continue;
                let target = f.filePath.trim();
                if (!target.includes(':') && !target.startsWith('/') && baseDirectories.length > 0) {
                  const base = baseDirectories[0].replace(/[\\/]$/, '');
                  target = `${base}\\${target.replace(/^[\\/]/, '').replace(/\//g, '\\')}`;
                }
                await invoke('write_file', {
                  path: target,
                  content: cleanCodeForWriting(target, f.fileContent),
                });
                if (onFileWritten) onFileWritten(target);
              }
              alert(`Todos os ${filesToBatchSave.length} arquivos foram gravados no disco com sucesso!`);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
          >
            <Save size={12} />
            <span>Gravar Todos no Disco</span>
          </button>
        </div>,
      );
    }

    const renderMarkdownBlock = (textSegment: string, keyPrefix: string) => (
      <ReactMarkdown
        key={keyPrefix}
        components={{
          code(props) {
            const { children, className, node, ...rest } = props as any;
            const matchLang = /language-(\w+)/.exec(className || '');
            const lang = matchLang ? matchLang[1].toLowerCase() : '';
            const codeString = String(children).replace(/\n$/, '');

            return matchLang ? (
              <CodeBlock
                language={lang}
                codeString={codeString}
                baseDirectories={baseDirectories}
                onOpenArtifact={onOpenArtifact}
                onFileWritten={onFileWritten}
                onRequestSelectFolder={onRequestSelectFolder}
              />
            ) : (
              <code {...rest} className="bg-surface px-1.5 py-0.5 rounded text-purple-300 font-mono text-xs border border-purple-900/40">
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
      className={`flex gap-4 p-5 group ${
        isError ? 'bg-red-950/20 border-y border-red-900/30' : isBot ? 'bg-surface/60 border-y border-purple-950/20' : 'bg-transparent'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
          isError
            ? 'bg-red-950 text-red-400 border border-red-800/50'
            : isBot
            ? 'bg-gradient-to-br from-purple-700 via-indigo-800 to-black text-purple-200 border border-purple-500/30'
            : 'bg-gray-800 text-gray-300 border border-gray-700'
        }`}
      >
        {isError ? <AlertTriangle size={18} /> : isBot ? <Eye size={18} className="animate-pulse text-purple-300" /> : <User size={18} />}
      </div>

      <div className="flex-1 overflow-hidden select-text leading-relaxed text-sm text-gray-200">
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((att, idx) => {
              const isImg = att.mimeType.startsWith('image/');
              return isImg ? (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-purple-800/40 max-w-xs shadow-md">
                  <img src={`data:${att.mimeType};base64,${att.data}`} alt={att.name} className="max-h-48 object-cover rounded-lg" />
                </div>
              ) : (
                <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/50 border border-purple-800/40 text-xs text-purple-200">
                  <FileText size={14} className="text-purple-400" />
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
              className="w-full bg-background border border-purple-500/50 rounded-xl p-3 text-sm text-white focus:outline-none resize-none font-mono"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                Salvar e Reenviar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditContent(content);
                  setIsEditing(false);
                }}
                className="bg-surface hover:bg-surfaceHover text-gray-400 text-xs font-medium px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className={isError ? 'text-red-300 font-medium' : ''}>{parseAgentActions(content)}</div>
        )}

        {!isEditing && (
          <div className="flex items-center gap-3 mt-2.5 select-none">
            {!isError && (
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-gray-500 hover:text-purple-300 transition text-xs flex items-center gap-1 cursor-pointer"
                title="Copiar mensagem inteira"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span className="text-[11px]">{copied ? 'Copiado' : 'Copiar conversa'}</span>
              </button>
            )}

            {!isBot && onEdit && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-gray-500 hover:text-purple-300 transition text-xs flex items-center gap-1 cursor-pointer"
                title="Editar mensagem"
              >
                <Pencil size={13} />
                <span className="text-[11px]">Editar</span>
              </button>
            )}

            {isBot && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className={`transition text-xs flex items-center gap-1 cursor-pointer ${
                  isError ? 'text-red-400 hover:text-red-300 font-semibold' : 'text-gray-500 hover:text-purple-300'
                }`}
                title="Tentar novamente"
              >
                <RotateCcw size={13} />
                <span className="text-[11px]">{isError ? 'Tentar Novamente' : 'Regenerar'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};