import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Settings as SettingsIcon,
  Trash2,
  Copy,
  Terminal,
  RefreshCw,
  Pencil,
  Check,
  X,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Chat } from '../lib/db';
import { CURRENT_VERSION } from '../services/updater';

interface Props {
  chats: Chat[];
  activeChatId: string | null;
  activeView: 'chat' | 'image-studio';
  onSelectChat: (id: string) => void;
  onSelectView: (view: 'chat' | 'image-studio') => void;
  onNewChat: () => void;
  onDuplicateChat: (id: string, e: React.MouseEvent) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onCheckUpdate: () => void;
}

export const Sidebar: React.FC<Props> = ({
  chats,
  activeChatId,
  activeView,
  onSelectChat,
  onSelectView,
  onNewChat,
  onDuplicateChat,
  onRenameChat,
  onDeleteChat,
  onOpenSettings,
  onOpenHelp,
  onCheckUpdate,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleStartRename = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditingTitle(chat.title);
  };

  const handleSaveRename = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (editingTitle.trim()) {
      onRenameChat(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <aside className="w-64 bg-[#0c0f16] flex flex-col h-screen border-r border-[#191e2b] select-none">
      <div className="h-13 px-3.5 border-b border-[#191e2b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#171c28] border border-[#262e42] flex items-center justify-center text-zinc-300">
            <Terminal size={13} strokeWidth={2.5} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-xs tracking-wider text-zinc-100 font-mono">
              ESPERTO
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">IDE</span>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onOpenHelp}
            title="Atalhos e Guias"
            className="text-zinc-500 hover:text-zinc-200 transition p-1.5 rounded-md hover:bg-[#161a25] cursor-pointer"
          >
            <HelpCircle size={14} />
          </button>
          <button
            onClick={onCheckUpdate}
            title="Checar Versão"
            className="text-zinc-500 hover:text-zinc-200 transition p-1.5 rounded-md hover:bg-[#161a25] cursor-pointer"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Botões de Ação Rápida: Nova Sessão & Image Studio */}
      <div className="p-2.5 space-y-1.5">
        <button
          onClick={() => {
            onSelectView('chat');
            onNewChat();
          }}
          className={`w-full flex items-center justify-between border font-medium py-1.5 px-3 rounded-lg transition text-xs shadow-sm cursor-pointer group ${
            activeView === 'chat'
              ? 'bg-[#151923] hover:bg-[#1b202e] text-zinc-200 border-[#232a3d]'
              : 'bg-[#0f121a] hover:bg-[#141824] text-zinc-400 border-transparent'
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus size={14} className="text-zinc-400 group-hover:text-zinc-200" />
            <span>Nova Sessão</span>
          </div>
          <kbd className="text-[10px] font-mono text-zinc-500 bg-[#0e1118] px-1.5 py-0.5 rounded border border-[#202738]">
            ⌘N
          </kbd>
        </button>

        <button
          onClick={() => onSelectView('image-studio')}
          className={`w-full flex items-center justify-between border font-medium py-1.5 px-3 rounded-lg transition text-xs shadow-sm cursor-pointer ${
            activeView === 'image-studio'
              ? 'bg-purple-950/70 border-purple-500/60 text-purple-200'
              : 'bg-[#11131c] hover:bg-[#161924] text-zinc-400 hover:text-purple-300 border-[#222538]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} className={activeView === 'image-studio' ? 'text-purple-400' : 'text-zinc-500'} />
            <span className="font-mono">Image Studio</span>
          </div>
          <span className="text-[9px] font-mono uppercase bg-purple-900/40 text-purple-300 px-1 rounded border border-purple-800/40">
            FLUX.2
          </span>
        </button>
      </div>

      <div className="px-3 py-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
        <span>Histórico de Sessões</span>
        <span>{chats.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => {
              onSelectView('chat');
              onSelectChat(chat.id);
            }}
            className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition text-xs group cursor-pointer ${
              activeChatId === chat.id && activeView === 'chat'
                ? 'bg-[#181d2a] text-zinc-100 border border-[#283248] shadow-xs'
                : 'text-zinc-400 hover:bg-[#121620] hover:text-zinc-200 border border-transparent'
            }`}
          >
            {editingId === chat.id ? (
              <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(chat.id)}
                  autoFocus
                  className="w-full bg-[#0a0d13] border border-indigo-500/60 rounded px-2 py-0.5 text-xs text-white focus:outline-none font-sans"
                />
                <button
                  onClick={(e) => handleSaveRename(chat.id, e)}
                  className="text-emerald-400 hover:text-emerald-300 p-0.5 cursor-pointer"
                >
                  <Check size={13} />
                </button>
                <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-red-400 p-0.5 cursor-pointer">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare
                    size={13}
                    className={activeChatId === chat.id && activeView === 'chat' ? 'text-indigo-400 shrink-0' : 'text-zinc-500 shrink-0'}
                  />
                  <span className="truncate">{chat.title}</span>
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    title="Renomear"
                    onClick={(e) => handleStartRename(chat, e)}
                    className="p-1 text-zinc-500 hover:text-zinc-200 transition cursor-pointer"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    title="Duplicar Sessão"
                    onClick={(e) => onDuplicateChat(chat.id, e)}
                    className="p-1 text-zinc-500 hover:text-zinc-200 transition cursor-pointer"
                  >
                    <Copy size={11} />
                  </button>
                  <button
                    title="Remover"
                    onClick={(e) => onDeleteChat(chat.id, e)}
                    className="p-1 text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-[#191e2b] space-y-1 bg-[#0b0e14]">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between text-zinc-400 hover:text-zinc-200 p-2 rounded-lg hover:bg-[#151923] transition text-xs cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <SettingsIcon size={14} className="text-zinc-400" />
            <span className="font-medium">Configurações</span>
          </div>
          <ChevronRight size={13} className="text-zinc-600" />
        </button>

        <div className="px-2 pt-1 pb-0.5 flex items-center justify-between text-[10px] text-zinc-500 font-mono select-none">
          <span>build {CURRENT_VERSION}</span>
          <a
            href="https://www.linkedin.com/in/samuelspineli"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 hover:text-zinc-200 hover:underline transition inline-flex items-center gap-0.5"
          >
            <span>LinkedIn</span>
            <ExternalLink size={9} />
          </a>
        </div>
      </div>
    </aside>
  );
};