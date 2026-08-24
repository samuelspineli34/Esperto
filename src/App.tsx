import React, { useState, useEffect, useRef } from 'react';
import { db, Chat, Message } from './lib/db';
import { streamGeminiResponse } from './services/gemini';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { SettingsModal } from './components/SettingsModal';
import { Send, Sliders, Sparkles } from 'lucide-react';

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Carregar configurações e chats iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      const savedSettings = await db.settings.get('default');
      if (savedSettings) {
        setApiKey(savedSettings.apiKey);
        setModel(savedSettings.model);
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

  // Carregar mensagens quando o chat ativo muda
  useEffect(() => {
    if (!activeChatId) return;

    const loadChatData = async () => {
      const activeChat = await db.chats.get(activeChatId);
      if (activeChat) {
        setSystemInstruction(activeChat.systemInstruction || '');
      }

      const chatMessages = await db.messages
        .where('chatId')
        .equals(activeChatId)
        .sortBy('timestamp');
      setMessages(chatMessages);
    };

    loadChatData();
  }, [activeChatId]);

  // Auto-scroll
  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isLoading]);

  const createNewChat = async () => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: 'Nova Conversa',
      systemInstruction: '',
      createdAt: Date.now(),
    };
    await db.chats.add(newChat);
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading || !activeChatId) return;

    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }

    const currentInput = inputMessage;
    setInputMessage('');

    // Salva a mensagem do usuário no DB
    const userMsg: Message = {
      chatId: activeChatId,
      role: 'user',
      content: currentInput,
      timestamp: Date.now(),
    };
    await db.messages.add(userMsg);
    setMessages((prev) => [...prev, userMsg]);

    // Atualiza o título do chat se for a primeira mensagem
    if (messages.length === 0) {
      const newTitle = currentInput.slice(0, 28) + (currentInput.length > 28 ? '...' : '');
      await db.chats.update(activeChatId, { title: newTitle });
      setChats((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, title: newTitle } : c))
      );
    }

    setIsLoading(true);

    try {
      // Adiciona mensagem temporária para o streaming do modelo
      let responseText = '';
      const generator = streamGeminiResponse({
        apiKey,
        model,
        systemInstruction,
        history: messages,
        newMessage: currentInput,
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

      // Persiste a resposta completa no DB
      await db.messages.add({
        chatId: activeChatId,
        role: 'model',
        content: responseText,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.error(err);
      alert('Erro na resposta do Gemini: ' + (err.message || 'Verifique sua API Key'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (newKey: string, newModel: string) => {
    setApiKey(newKey);
    setModel(newModel);
    await db.settings.put({ id: 'default', apiKey: newKey, model: newModel });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={createNewChat}
        onDeleteChat={deleteChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Header com Custom System Instructions */}
        <header className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-surface/40">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400" />
            <h1 className="font-semibold text-sm text-gray-200">Esperto Desktop</h1>
          </div>
          <button
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              showSystemPrompt || systemInstruction
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-gray-400 hover:text-white bg-surface'
            }`}
          >
            <Sliders size={14} />
            <span>{systemInstruction ? 'Instruções Ativas' : 'Definir Instruções'}</span>
          </button>
        </header>

        {/* Drawer para editar System Instruction */}
        {showSystemPrompt && (
          <div className="p-4 bg-surface border-b border-gray-800 transition">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Instruções Personalizadas deste Chat (Persona / System Prompt):
            </label>
            <textarea
              rows={2}
              value={systemInstruction}
              onChange={(e) => handleUpdateSystemInstruction(e.target.value)}
              placeholder="Ex: Aja como um arquiteto de software sênior. Responda com clareza e exemplos em TypeScript."
              className="w-full bg-background border border-gray-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        )}

        {/* Área de Mensagens */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <Sparkles size={48} className="text-indigo-500 mb-4 opacity-50" />
              <p className="text-sm font-medium">Como o Esperto pode te ajudar hoje?</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <ChatMessage key={index} role={msg.role} content={msg.content} />
            ))
          )}
        </div>

        {/* Input de Envio */}
        <div className="p-4 bg-surface/40 border-t border-gray-800">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Pergunte ao Esperto..."
              disabled={isLoading}
              className="flex-1 bg-surface border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl transition flex items-center justify-center shrink-0"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        model={model}
        onSave={handleSaveSettings}
      />
    </div>
  );
}