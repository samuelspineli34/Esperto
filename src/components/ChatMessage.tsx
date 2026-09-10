import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Eye, User, FileText, Copy, Check, Pencil, RotateCcw, AlertTriangle, Play, Save, Terminal, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
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
}

const AgentFileActionCard: React.FC<{
  filePath: string;
  content: string;
  baseDirectories?: string[];
  onFileWritten?: (savedPath: string) => void;
}> = ({ filePath, content, baseDirectories = [], onFileWritten }) => {
  const [status, setStatus] = useState<'idle' | 'writing' | 'success' | 'error'>('idle');
  const [showCode, setShowCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleApplyToDisk = async () => {
    setStatus('writing');
    try {
      let finalPath = filePath.trim();

      // Resolve caminho absoluto com base na primeira pasta do workspace aberta
      if (!finalPath.includes(':') && !finalPath.startsWith('/') && baseDirectories.length > 0) {
        const base = baseDirectories[0].replace(/[\\/]$/, '');
        // Garante barras invertidas corretas no Windows
        const cleanRelative = finalPath.replace(/^[\\/]/, '').replace(/\//g, '\\');
        finalPath = `${base}\\${cleanRelative}`;
      }

      await invoke('write_file', {
        path: finalPath,
        content: content.trim(),
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
      <div className="flex items-center justify-between p-3 bg-emerald-950/40 border-b border-emerald-900/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-900/50 text-emerald-300 border border-emerald-500/30">
            <Save size={14} />
          </div>
          <div className="overflow-hidden">
            <span className="text-xs font-bold text-emerald-200 block font-mono truncate max-w-md" title={filePath}>{filePath}</span>
            <span className="text-[10px] text-emerald-400/80">Ação do Agente • Pronto para gravar no disco</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCode(!showCode)}
            className="text-[11px] text-emerald-400 hover:text-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-900/30 transition flex items-center gap-1 cursor-pointer font-mono"
          >
            {showCode ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span>{showCode ? 'Ocultar' : 'Ver Código'}</span>
          </button>

          <button
            onClick={handleApplyToDisk}
            disabled={status === 'writing'}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-md cursor-pointer ${
              status === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
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
                <span>Aplicar no Disco</span>
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
            {content}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
};

const AgentCommandActionCard: React.FC<{
  command: string;
  baseDirectories?: string[];
}> = ({ command, baseDirectories = [] }) => {
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      const cwd = baseDirectories.length > 0 ? baseDirectories[0] : null;
      
      // Limpa comentários `#` espalhados pelo modelo no comando do Windows CMD
      let cleanCmd = command
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .join(' && ');

      // Substitui múltiplos `#` inline
      cleanCmd = cleanCmd.replace(/#.*?(?=[a-zA-Z])/g, '&& ');

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
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1.5 rounded-lg bg-purple-900/50 text-purple-300 border border-purple-500/30 shrink-0">
            <Terminal size={14} />
          </div>
          <div className="overflow-hidden">
            <span className="text-xs font-bold text-purple-200 block font-mono truncate" title={command}>{command}</span>
            <span className="text-[10px] text-purple-400/80">Comando sugerido pelo Agente para o Windows CMD</span>
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
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

const CodeBlock: React.FC<{ language: string; codeString: string; onOpenArtifact?: (code: string, lang: string) => void }> = ({
  language,
  codeString,
  onOpenArtifact,
}) => {
  const [copied, setCopied] = useState(false);
  const isPreviewable = ['html', 'svg', 'xml', 'jsx', 'tsx'].includes(language);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-2xl overflow-hidden border border-purple-900/40 bg-[#0d1117] shadow-lg">
      <div className="flex items-center justify-between px-4 py-1.5 bg-surface border-b border-purple-950/40 select-none">
        <span className="text-[11px] font-mono font-bold text-purple-300 uppercase tracking-wider">
          {language || 'código'}
        </span>

        <div className="flex items-center gap-2">
          {isPreviewable && onOpenArtifact && (
            <button
              onClick={() => onOpenArtifact(codeString, language)}
              className="bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-300 text-[11px] font-semibold px-2 py-0.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
              title="Abrir prévia interativa"
            >
              <Play size={11} />
              <span>Preview</span>
            </button>
          )}

          <button
            onClick={handleCopyCode}
            className="text-gray-400 hover:text-purple-300 text-[11px] font-mono flex items-center gap-1 transition cursor-pointer p-1 rounded hover:bg-surfaceHover"
            title="Copiar apenas este código"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copied ? 'Copiado!' : 'Copiar código'}</span>
          </button>
        </div>
      </div>

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
    const writeRegex = /<esperto_write\s+path=["']([^"']+)["']>([\s\S]*?)<\/esperto_write>/g;
    const cmdRegex = /<esperto_cmd>([\s\S]*?)<\/esperto_cmd>/g;

    let lastIndex = 0;
    const combinedMatches: { index: number; length: number; node: React.ReactNode }[] = [];

    let match: RegExpExecArray | null;
    while ((match = writeRegex.exec(rawText)) !== null) {
      combinedMatches.push({
        index: match.index,
        length: match[0].length,
        node: (
          <AgentFileActionCard
            key={`write-${match.index}`}
            filePath={match[1]}
            content={match[2]}
            baseDirectories={baseDirectories}
            onFileWritten={onFileWritten}
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

    combinedMatches.forEach((m) => {
      if (m.index > lastIndex) {
        parts.push(
          <ReactMarkdown
            key={`text-${lastIndex}`}
            components={{
              code(props) {
                const { children, className, node, ref, ...rest } = props as any;
                const matchLang = /language-(\w+)/.exec(className || '');
                const lang = matchLang ? matchLang[1].toLowerCase() : '';
                const codeString = String(children).replace(/\n$/, '');

                return matchLang ? (
                  <CodeBlock language={lang} codeString={codeString} onOpenArtifact={onOpenArtifact} />
                ) : (
                  <code {...rest} className="bg-surface px-1.5 py-0.5 rounded text-purple-300 font-mono text-xs border border-purple-900/40">
                    {children}
                  </code>
                );
              },
            }}
          >
            {rawText.slice(lastIndex, m.index)}
          </ReactMarkdown>
        );
      }
      parts.push(m.node);
      lastIndex = m.index + m.length;
    });

    if (lastIndex < rawText.length) {
      parts.push(
        <ReactMarkdown
          key={`text-${lastIndex}`}
          components={{
            code(props) {
              const { children, className, node, ref, ...rest } = props as any;
              const matchLang = /language-(\w+)/.exec(className || '');
              const lang = matchLang ? matchLang[1].toLowerCase() : '';
              const codeString = String(children).replace(/\n$/, '');

              return matchLang ? (
                <CodeBlock language={lang} codeString={codeString} onOpenArtifact={onOpenArtifact} />
              ) : (
                <code {...rest} className="bg-surface px-1.5 py-0.5 rounded text-purple-300 font-mono text-xs border border-purple-900/40">
                  {children}
                </code>
              );
            },
          }}
        >
          {rawText.slice(lastIndex)}
        </ReactMarkdown>
      );
    }

    return parts.length > 0 ? parts : <ReactMarkdown>{rawText}</ReactMarkdown>;
  };

  return (
    <div className={`flex gap-4 p-5 group ${isError ? 'bg-red-950/20 border-y border-red-900/30' : isBot ? 'bg-surface/60 border-y border-purple-950/20' : 'bg-transparent'}`}>
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
                onClick={handleSaveEdit}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                Salvar e Reenviar
              </button>
              <button
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
          <div className={isError ? 'text-red-300 font-medium' : ''}>
            {parseAgentActions(content)}
          </div>
        )}

        {!isEditing && (
          <div className="flex items-center gap-3 mt-2.5 select-none">
            {!isError && (
              <button
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