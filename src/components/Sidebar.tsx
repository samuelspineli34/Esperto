import React from 'react';
import { Plus, MessageSquare, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import { Chat } from '../lib/db';

interface Props {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<Props> = ({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onOpenSettings,
}) => {
  return (
    <aside className="w-64 bg-surface flex flex-col h-screen border-r border-gray-800">
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition"
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
            className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition text-sm group ${
              activeChatId === chat.id ? 'bg-surfaceHover text-white' : 'text-gray-400 hover:bg-surfaceHover/50 hover:text-gray-200'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <MessageSquare size={16} />
              <span className="truncate">{chat.title}</span>
            </div>
            <button
              onClick={(e) => onDeleteChat(chat.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-gray-800">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 text-gray-400 hover:text-white p-2 rounded-lg hover:bg-surfaceHover transition text-sm"
        >
          <SettingsIcon size={18} />
          <span>Configurações</span>
        </button>
      </div>
    </aside>
  );
};