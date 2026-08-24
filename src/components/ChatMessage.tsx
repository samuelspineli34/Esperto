import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Eye, User, FileText, Copy, Check, Pencil, RotateCcw, AlertTriangle } from 'lucide-react';
import { Attachment } from '../lib/db';

interface Props {
  role: 'user' | 'model';
  content: string;
  attachments?: Attachment[];
  onEdit?: (newContent: string) => void;
  onRetry?: () => void;
}

export const ChatMessage: React.FC<Props> = ({ role, content, attachments, onEdit, onRetry }) => {
  const isBot = role === 'model';
  const isError = isBot && (content.startsWith('⚠️') || content.includes('Erro:'));
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const handleCopy = () => {
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
        {/* Renderiza Anexos */}
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
                  <span className="truncate max-w-[180px]">{att.name}</span>
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
            <ReactMarkdown
              components={{
                code(props) {
                  const { children, className, node, ref, ...rest } = props as any;
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <SyntaxHighlighter
                      PreTag="div"
                      language={match[1]}
                      style={vscDarkPlus as any}
                      className="rounded-xl my-2 border border-purple-900/30"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code {...rest} className="bg-surface px-1.5 py-0.5 rounded text-purple-300 font-mono text-xs border border-purple-900/40">
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}

        {/* Barra de Ações Rápidas da Mensagem */}
        {!isEditing && (
          <div className="flex items-center gap-3 mt-2.5 select-none">
            {!isError && (
              <button
                onClick={handleCopy}
                className="text-gray-500 hover:text-purple-300 transition text-xs flex items-center gap-1 cursor-pointer"
                title="Copiar mensagem"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span className="text-[11px]">{copied ? 'Copiado' : 'Copiar'}</span>
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