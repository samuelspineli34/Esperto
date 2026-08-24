import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Bot, User } from 'lucide-react';

interface Props {
  role: 'user' | 'model';
  content: string;
}

export const ChatMessage: React.FC<Props> = ({ role, content }) => {
  const isBot = role === 'model';

  return (
    <div className={`flex gap-4 p-5 ${isBot ? 'bg-surface/50' : 'bg-transparent'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isBot ? 'bg-indigo-600' : 'bg-gray-700'}`}>
        {isBot ? <Bot size={18} /> : <User size={18} />}
      </div>
      <div className="flex-1 overflow-hidden select-text leading-relaxed text-sm text-gray-200">
        <ReactMarkdown
          components={{
            code({ className, children }) {
              const match = /language-(\w+)/.exec(className || '');
              return match ? (
                <SyntaxHighlighter
                  style={vscDarkPlus as any}
                  language={match[1]}
                  PreTag="div"
                  className="rounded-md my-2"
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className="bg-surface px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs">
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