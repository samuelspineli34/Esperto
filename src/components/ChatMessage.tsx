import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Eye, User } from 'lucide-react';

interface Props {
  role: 'user' | 'model';
  content: string;
}

export const ChatMessage: React.FC<Props> = ({ role, content }) => {
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