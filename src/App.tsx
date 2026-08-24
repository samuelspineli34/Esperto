import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, Chat, Message, Settings, Attachment } from './lib/db';
import { streamAIResponse } from './services/ai';
import { getModelInfo } from './lib/models';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { SettingsModal } from './components/SettingsModal';
import { UpdateModal } from './components/UpdateModal';
import { checkForUpdates, ReleaseInfo } from './services/updater';
import { Send, Sliders, Eye, Brain, Copy, Paperclip, X, FileText, Image as ImageIcon, Activity } from 'lucide-react';

const defaultSettings: Settings = {
  id: 'default',
  model: 'gemini-3.7-flash',
  globalMemory: '',
  geminiApiKey: '',
  mediaResolution: 'default',
  googleSearch: false,
};

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [systemInstruction, setSystemInstruction] = useState('');
  const [useMemory, setUseMemory] = useState(true);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calcula contagem de tokens aproximada e porcentagem do limite do modelo
  const modelInfo = useMemo(() => getModelInfo(settings.model || 'gemini-3.7-flash'), [settings.model]);

  const totalEstimatedTokens = useMemo(() => {
    let charCount = (settings.globalMemory || '').length + (systemInstruction || '').length;
    messages.forEach((m) => {
      charCount += m.content.length;
      if (m.attachments) {
        m.attachments.forEach((a) => (charCount += a.data.length * 0.1));
      }
    });
    charCount += inputMessage.length;
    return Math.ceil(charCount / 3.8); // Média de ~3.8 caracteres por token
  }, [messages, inputMessage, systemInstruction, settings.globalMemory]);

  const tokenUsagePercent = useMemo(() => {
    return Math.min(100, Math.round((totalEstimatedTokens / modelInfo.contextLimit) * 1000) / 10);
  }, [totalEstimatedTokens, modelInfo.contextLimit]);

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
        attachments: msg.attachments,
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

  // Suporte a colar arquivos e imagens com Ctrl + V
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          addFile(file);
        }
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      addFile(files[i]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setAttachments((prev) => [
        ...prev,
        {
          name: file.name,
          mimeType: file.type || 'text/plain',
          data: base64,
          size: file.size,
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && attachments.length === 0) || isLoading || !activeChatId) return;

    const currentInput = inputMessage;
    const currentAttachments = [...attachments];
    setInputMessage('');
    setAttachments([]);

    const userMsg: Message = {
      chatId: activeChatId,
      role: 'user',
      content: currentInput,
      attachments: currentAttachments,
      timestamp: Date.now(),
    };
    await db.messages.add(userMsg);
    setMessages((prev) => [...prev, userMsg]);

    if (messages.length === 0) {
      const newTitle = currentInput.slice(0, 26) || currentAttachments[0]?.name || 'Consulta';
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
        attachments: currentAttachments,
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
      alert(err.message || 'Erro na resposta do Oráculo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    await db.settings.put(newSettings);
  };

  const handleCheckUpdate = async (openModal = true) => {
    if (openModal) setIsUpdateOpen(true);
    setIsCheckingUpdate(true);
    const release = await checkForUpdates();
    setLatestRelease(release);
    setIsCheckingUpdate(false);
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
        {/* Top Header com Indicador de Tokens e Contexto */}
        <header
          data-tauri-drag-region
          className="h-14 border-b border-purple-950/30 flex items-center justify-between px-6 bg-[#090c10] backdrop-blur-sm select-none"
        >
          <div className="flex items-center gap-3">
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

            {/* Medidor de Tokens do Contexto */}
            <div
              title={`Uso do contexto: ${totalEstimatedTokens.toLocaleString()} de ${(modelInfo.contextLimit / 1000).toFixed(0)}k tokens`}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface border border-purple-900/30 text-[10px] font-mono text-purple-300"
            >
              <Activity size={11} className={tokenUsagePercent > 80 ? 'text-red-400' : 'text-purple-400'} />
              <span>{totalEstimatedTokens > 1000 ? `${(totalEstimatedTokens / 1000).toFixed(1)}k` : totalEstimatedTokens}</span>
              <span className="text-gray-500">/</span>
              <span className="text-gray-400">{modelInfo.contextLimit >= 1000000 ? '1.0M' : `${modelInfo.contextLimit / 1000}k`}</span>
              <span className={`font-bold ml-0.5 ${tokenUsagePercent > 80 ? 'text-red-400' : 'text-purple-400/80'}`}>
                ({tokenUsagePercent}%)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMemory}
              title={useMemory ? 'Memória de todo o chat ATIVA' : 'Memória do chat DESATIVADA'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                useMemory
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
                title="Ramificar esta conversa"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:text-purple-200 bg-surface border border-purple-950/30 hover:bg-surfaceHover transition"
              >
                <Copy size={13} />
                <span>Duplicar</span>
              </button>
            )}

            <button
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                showSystemPrompt || systemInstruction
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
              placeholder="Ex: Aja como um arquiteto especialista em Rust e TypeScript..."
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
              <p className="text-sm font-medium">Consulte qualquer inteligência pelo Esperto.</p>
              <p className="text-xs text-gray-500 mt-1">Cole imagens ou anexe arquivos para análise multimodal.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <ChatMessage key={index} role={msg.role} content={msg.content} attachments={msg.attachments} />
            ))
          )}
        </div>

        {/* Área de Input com Suporte a Anexos e Ctrl+V */}
        <div className="p-4 bg-surface/40 border-t border-purple-950/30">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex flex-col gap-2">
            
            {/* Lista de Prévia de Anexos */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-surface/80 rounded-xl border border-purple-900/40">
                {attachments.map((att, index) => (
                  <div key={index} className="flex items-center gap-1.5 bg-background border border-purple-800/40 px-2.5 py-1 rounded-lg text-xs text-purple-200">
                    {att.mimeType.startsWith('image/') ? <ImageIcon size={13} className="text-purple-400" /> : <FileText size={13} className="text-purple-400" />}
                    <span className="truncate max-w-[120px]">{att.name}</span>
                    <button type="button" onClick={() => removeAttachment(index)} className="hover:text-red-400 transition p-0.5">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInput}
                multiple
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Anexar imagens ou documentos (ou cole com Ctrl+V)"
                className="p-3 bg-surface border border-purple-900/40 hover:border-purple-500 text-purple-300 rounded-xl transition flex items-center justify-center shrink-0"
              >
                <Paperclip size={18} />
              </button>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onPaste={handlePaste}
                placeholder="Pergunte ao Oráculo... (Cole prints ou arraste arquivos)"
                disabled={isLoading}
                className="flex-1 bg-surface border border-purple-900/40 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none transition disabled:opacity-50 shadow-inner"
              />

              <button
                type="submit"
                disabled={isLoading || (!inputMessage.trim() && attachments.length === 0)}
                className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-40 text-white p-3 rounded-xl transition flex items-center justify-center shrink-0 shadow-lg shadow-purple-950/50"
              >
                <Send size={18} />
              </button>
            </div>
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