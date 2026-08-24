import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Eye, User, FileText, Image as ImageIcon } from 'lucide-react';
import { Attachment } from '../lib/db';

interface Props {
  role: 'user' | 'model';
  content: string;
  attachments?: Attachment[];
}

export const ChatMessage: React.FC<Props> = ({ role, content, attachments }) => {
  const isBot = role === 'model';

  return (
    <div className={`flex gap-4 p-5 ${isBot ? 'bg-surface/60 border-y border-purple-950/20' : 'bg-transparent'}`}>
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
          isBot
            ? 'bg-gradient-to-br from-purple-700 via-indigo-800 to-black text-purple-200 border border-purple-500/30'
            : 'bg-gray-800 text-gray-300 border border-gray-700'
        }`}
      >
        {isBot ? <Eye size={18} className="animate-pulse text-purple-300" /> : <User size={18} />}
      </div>
      <div className="flex-1 overflow-hidden select-text leading-relaxed text-sm text-gray-200">
        
        {/* Renderiza Anexos do Usuário */}
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
                  <span className="truncate max-w-[150px]">{att.name}</span>
                </div>
              );
            })}
          </div>
        )}

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
    </div>
  );
};