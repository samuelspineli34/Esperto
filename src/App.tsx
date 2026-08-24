import React, { useState, useEffect, useRef } from 'react';
import { db, Chat, Message, Settings } from './lib/db';
import { streamAIResponse } from './services/ai';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { SettingsModal } from './components/SettingsModal';
import { Send, Sliders, Eye, Brain, Copy } from 'lucide-react';
import { UpdateModal } from './components/UpdateModal';
import { checkForUpdates, ReleaseInfo } from './services/updater';

const defaultSettings: Settings = {
  id: 'default',
  model: 'gemini-3.7-flash',
  globalMemory: '',
  geminiApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  deepseekApiKey: '',
};

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [useMemory, setUseMemory] = useState(true);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);

  const handleCheckUpdate = async (openModal = true) => {
    if (openModal) setIsUpdateOpen(true);
    setIsCheckingUpdate(true);
    const release = await checkForUpdates();
    setLatestRelease(release);
    setIsCheckingUpdate(false);
  };

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      const savedSettings = await db.settings.get('default');
      if (savedSettings) {
        setSettings(savedSettings);
      } else {
        await db.settings.put(defaultSettings);
      }

      const allChats = await db.chats.orderBy('createdAt').reverse().toArray();
      setChats(allChats);

      if (allChats.length > 0) {
        setActiveChatId(allChats[0].id);
      } else {
        createNewChat();
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!activeChatId) return;

    const loadChatData = async () => {
      const activeChat = await db.chats.get(activeChatId);
      if (activeChat) {
        setSystemInstruction(activeChat.systemInstruction || '');
        setUseMemory(activeChat.useMemory !== false);
      }

      const chatMessages = await db.messages
        .where('chatId')
        .equals(activeChatId)
        .sortBy('timestamp');
      setMessages(chatMessages);
    };

    loadChatData();
  }, [activeChatId]);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isLoading]);

  const createNewChat = async () => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: 'Nova Consulta',
      systemInstruction: '',
      useMemory: true,
      createdAt: Date.now(),
    };
    await db.chats.add(newChat);
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  const handleDuplicateChat = async (sourceChatId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const sourceChat = await db.chats.get(sourceChatId);
    if (!sourceChat) return;

    const newChatId = crypto.randomUUID();
    const newChat: Chat = {
      id: newChatId,
      title: `${sourceChat.title} (Ramo)`,
      systemInstruction: sourceChat.systemInstruction || '',
      useMemory: sourceChat.useMemory !== false,
      createdAt: Date.now(),
    };

    await db.chats.add(newChat);

    const sourceMessages = await db.messages
      .where('chatId')
      .equals(sourceChatId)
      .sortBy('timestamp');

    for (const msg of sourceMessages) {
      await db.messages.add({
        chatId: newChatId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      });
    }

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChatId);
  };

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.chats.delete(id);
    await db.messages.where('chatId').equals(id).delete();
    const updatedChats = chats.filter((c) => c.id !== id);
    setChats(updatedChats);
    if (activeChatId === id && updatedChats.length > 0) {
      setActiveChatId(updatedChats[0].id);
    }
  };

  const handleUpdateSystemInstruction = async (val: string) => {
    setSystemInstruction(val);
    if (activeChatId) {
      await db.chats.update(activeChatId, { systemInstruction: val });
    }
  };

  const toggleMemory = async () => {
    const newValue = !useMemory;
    setUseMemory(newValue);
    if (activeChatId) {
      await db.chats.update(activeChatId, { useMemory: newValue });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading || !activeChatId) return;

    const currentInput = inputMessage;
    setInputMessage('');

    const userMsg: Message = {
      chatId: activeChatId,
      role: 'user',
      content: currentInput,
      timestamp: Date.now(),
    };
    await db.messages.add(userMsg);
    setMessages((prev) => [...prev, userMsg]);

    if (messages.length === 0) {
      const newTitle = currentInput.slice(0, 26) + (currentInput.length > 26 ? '...' : '');
      await db.chats.update(activeChatId, { title: newTitle });
      setChats((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, title: newTitle } : c))
      );
    }

    setIsLoading(true);

    try {
      let responseText = '';
      const generator = streamAIResponse({
        model: settings.model || 'gemini-3.7-flash',
        settings,
        systemInstruction,
        globalMemory: settings.globalMemory,
        history: messages,
        newMessage: currentInput,
        useMemory,
      });

      setMessages((prev) => [
        ...prev,
        { chatId: activeChatId, role: 'model', content: '', timestamp: Date.now() },
      ]);

      for await (const chunk of generator) {
        responseText += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: responseText,
          };
          return updated;
        });
      }

      await db.messages.add({
        chatId: activeChatId,
        role: 'model',
        content: responseText,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao consultar o Oráculo. Verifique sua chave de API nas configurações.');
      setIsSettingsOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    await db.settings.put(newSettings);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={createNewChat}
        onDuplicateChat={handleDuplicateChat}
        onDeleteChat={deleteChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCheckUpdate={() => handleCheckUpdate(true)}
      />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header data-tauri-drag-region className="h-14 border-b border-purple-950/30 flex items-center justify-between px-6 bg-[#090c10] backdrop-blur-sm select-none">
          <div className="flex items-center gap-2.5">
            <Eye size={18} className="text-purple-400 animate-pulse" />
            <span className="font-bold text-xs tracking-widest bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent uppercase">
              ESPERTO
            </span>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-[10px] font-semibold bg-purple-950/80 hover:bg-purple-900/80 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-800/40 transition"
            >
              {settings.model || 'gemini-3.7-flash'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMemory}
              title={useMemory ? 'Memória de todo o chat ATIVA' : 'Memória do chat DESATIVADA'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border ${useMemory
                ? 'bg-purple-950/60 text-purple-300 border-purple-500/40'
                : 'bg-surface text-gray-500 border-gray-800 hover:text-gray-300'
                }`}
            >
              <Brain size={14} className={useMemory ? 'text-purple-400' : ''} />
              <span>{useMemory ? 'Memória: ON' : 'Memória: OFF'}</span>
            </button>

            {activeChatId && (
              <button
                onClick={() => handleDuplicateChat(activeChatId)}
                title="Ramificar / Duplicar esta conversa"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:text-purple-200 bg-surface border border-purple-950/30 hover:bg-surfaceHover transition"
              >
                <Copy size={13} />
                <span>Duplicar</span>
              </button>
            )}

            <button
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border ${showSystemPrompt || systemInstruction
                ? 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                : 'text-gray-400 hover:text-white bg-surface border-purple-950/30'
                }`}
            >
              <Sliders size={14} />
              <span>{systemInstruction ? 'Instruções Ativas' : 'Instruções'}</span>
            </button>
          </div>
        </header>

        {showSystemPrompt && (
          <div className="p-4 bg-surface border-b border-purple-950/40 transition">
            <label className="block text-xs font-medium text-purple-300 mb-1">
              Instruções Ocultas deste Chat (Persona / System Prompt):
            </label>
            <textarea
              rows={2}
              value={systemInstruction}
              onChange={(e) => handleUpdateSystemInstruction(e.target.value)}
              placeholder="Ex: Aja como um arquiteto especialista em Rust e TypeScript. Seja conciso e direto."
              className="w-full bg-background border border-purple-900/40 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>
        )}

        <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-purple-300/40 select-none">
              <div className="w-16 h-16 rounded-2xl bg-purple-950/30 border border-purple-500/20 flex items-center justify-center mb-4 shadow-xl shadow-purple-950/30">
                <Eye size={36} className="text-purple-400 animate-pulse" />
              </div>
              <p className="text-sm font-medium">Consulte qualquer conhecimento pelo Esperto.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <ChatMessage key={index} role={msg.role} content={msg.content} />
            ))
          )}
        </div>

        <div className="p-4 bg-surface/40 border-t border-purple-950/30">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Pergunte ao Esperto..."
              disabled={isLoading}
              className="flex-1 bg-surface border border-purple-900/40 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none transition disabled:opacity-50 shadow-inner"
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-40 text-white p-3 rounded-xl transition flex items-center justify-center shrink-0 shadow-lg shadow-purple-950/50"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <UpdateModal
        isOpen={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
        checking={isCheckingUpdate}
        release={latestRelease}
        onCheckAgain={() => handleCheckUpdate(true)}
      />
    </div>
  );
}