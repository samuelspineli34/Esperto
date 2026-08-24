import React from 'react';
import { Plus, MessageSquare, Settings as SettingsIcon, Trash2, Copy, Eye } from 'lucide-react';
import { Chat } from '../lib/db';

interface Props {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDuplicateChat: (id: string, e: React.MouseEvent) => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<Props> = ({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDuplicateChat,
  onDeleteChat,
  onOpenSettings,
}) => {
  return (
    <aside className="w-64 bg-surface flex flex-col h-screen border-r border-purple-950/30 select-none">
      {/* Topo com Logo Místico */}
      <div className="p-3 border-b border-purple-950/30 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-purple-900/50 border border-purple-500/40 flex items-center justify-center text-purple-300">
          <Eye size={16} />
        </div>
        <span className="font-bold text-sm tracking-wider bg-gradient-to-r from-purple-300 to-indigo-200 bg-clip-text text-transparent">
          ESPERTO
        </span>
      </div>

      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-medium py-2.5 px-4 rounded-xl transition shadow-md shadow-purple-950/50 text-sm"
        >
          <Plus size={18} />
          <span>Novo Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`flex items-center justify-between p-2.5 rounded-xl transition text-sm group ${activeChatId === chat.id
                ? 'bg-surfaceHover text-purple-200 border border-purple-500/20'
                : 'text-gray-400 hover:bg-surfaceHover/50 hover:text-gray-200'
              }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <MessageSquare size={16} className={activeChatId === chat.id ? 'text-purple-400' : ''} />
              <span className="truncate">{chat.title}</span>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                title="Duplicar / Ramificar este chat"
                onClick={(e) => onDuplicateChat(chat.id, e)}
                className="p-1 hover:text-purple-300 transition"
              >
                <Copy size={13} />
              </button>
              <button
                title="Excluir chat"
                onClick={(e) => onDeleteChat(chat.id, e)}
                className="p-1 hover:text-red-400 transition"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-purple-950/30 space-y-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 text-gray-400 hover:text-purple-200 p-2 rounded-xl hover:bg-surfaceHover transition text-sm"
        >
          <SettingsIcon size={17} />
          <span>Configurações</span>
        </button>

        {/* Créditos*/}
        <div className="px-2 pt-1 flex items-center justify-between text-[10px] text-gray-500 font-mono select-none">
          <span>Esperto v1.0.0 • 2026</span>
          <a
            href="https://www.linkedin.com/in/samuel-spineli/"
            target="_blank"
            rel="noreferrer"
            className="text-purple-400/80 hover:text-purple-300 hover:underline transition flex items-center gap-0.5"
          >
            <span>LinkedIn</span>
            <span>↗</span>
          </a>
        </div>
      </div>
    </aside>
  );
};