import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, Chat, Message, Settings, Attachment } from './lib/db';
import { streamAIResponse } from './services/ai';
import { getModelInfo } from './lib/models';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { SettingsModal } from './components/SettingsModal';
import { UpdateModal } from './components/UpdateModal';
import { checkForUpdates, ReleaseInfo } from './services/updater';
import { Send, Sliders, Eye, Brain, Copy, Paperclip, X, FileText, Image as ImageIcon, Activity, Square, Timer, Gift, DollarSign, AlertCircle } from 'lucide-react';

const defaultSettings: Settings = {
  id: 'default',
  model: 'gemini-3.7-flash',
  globalMemory: '',
  geminiApiKey: '',
  temperature: 0.7,
  thinkingLevel: 'off',
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
  const [elapsedTime, setElapsedTime] = useState(0);

  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const modelInfo = useMemo(() => getModelInfo(settings.model || 'gemini-3.7-flash'), [settings.model]);

  // Cronômetro em tempo real durante a resposta
  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setElapsedTime(0);
      const startTime = Date.now();
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 100) / 10);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Contagem de tokens em tempo real
  const totalEstimatedTokens = useMemo(() => {
    let charCount = (settings.globalMemory || '').length + (systemInstruction || '').length;
    messages.forEach((m) => {
      charCount += m.content.length;
      if (m.attachments) {
        m.attachments.forEach((a) => (charCount += a.data.length * 0.1));
      }
    });
    charCount += inputMessage.length;
    return Math.ceil(charCount / 3.8);
  }, [messages, inputMessage, systemInstruction, settings.globalMemory]);

  const isTokenLimitExceeded = totalEstimatedTokens >= modelInfo.contextLimit;

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
    if (!activeChatId) {
      setMessages([]);
      return;
    }

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
    setMessages([]);
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

  const handleRenameChat = async (id: string, newTitle: string) => {
    await db.chats.update(id, { title: newTitle });
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));
  };

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.chats.delete(id);
    await db.messages.where('chatId').equals(id).delete();

    const updatedChats = chats.filter((c) => c.id !== id);
    setChats(updatedChats);

    if (activeChatId === id) {
      if (updatedChats.length > 0) {
        setActiveChatId(updatedChats[0].id);
      } else {
        createNewChat();
      }
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

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) addFile(file);
          return;
        }
      }
    }

    const pastedText = e.clipboardData?.getData('text');
    if (pastedText && pastedText.length > 800) {
      e.preventDefault();
      const tokenCost = Math.ceil(pastedText.length / 3.8);
      setAttachments((prev) => [
        ...prev,
        {
          name: `Trecho colado (${tokenCost} tokens)`,
          mimeType: 'text/plain',
          data: btoa(unescape(encodeURIComponent(pastedText))),
          size: pastedText.length,
          isSnippet: true,
        },
      ]);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.shiftKey || e.metaKey) return;
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (customMessageText?: string, baseHistory?: Message[]) => {
    if (isTokenLimitExceeded) {
      alert(`Limite de tokens do modelo atingido (${totalEstimatedTokens.toLocaleString()} de ${modelInfo.contextLimit.toLocaleString()}). Limpe mensagens antigas ou selecione um modelo com contexto maior.`);
      return;
    }

    const textToSend = customMessageText !== undefined ? customMessageText : inputMessage;
    if ((!textToSend.trim() && attachments.length === 0) || isLoading || !activeChatId) return;

    const currentInput = textToSend;
    const currentAttachments = [...attachments];
    setInputMessage('');
    setAttachments([]);

    let currentMessages = baseHistory !== undefined ? baseHistory : messages;

    if (customMessageText === undefined || baseHistory !== undefined) {
      const userMsg: Message = {
        chatId: activeChatId,
        role: 'user',
        content: currentInput,
        attachments: currentAttachments,
        timestamp: Date.now(),
      };
      await db.messages.add(userMsg);
      currentMessages = [...currentMessages, userMsg];
      setMessages(currentMessages);

      if (currentMessages.length === 1) {
        const newTitle = currentInput.slice(0, 26) || currentAttachments[0]?.name || 'Consulta';
        await db.chats.update(activeChatId, { title: newTitle });
        setChats((prev) =>
          prev.map((c) => (c.id === activeChatId ? { ...c, title: newTitle } : c))
        );
      }
    }

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    setMessages((prev) => [
      ...prev,
      { chatId: activeChatId, role: 'model', content: '', timestamp: Date.now() },
    ]);

    let responseText = '';

    try {
      const generator = streamAIResponse({
        model: settings.model || 'gemini-3.7-flash',
        settings,
        systemInstruction,
        globalMemory: settings.globalMemory,
        history: currentMessages.slice(0, -1),
        newMessage: currentMessages[currentMessages.length - 1]?.content || currentInput,
        attachments: currentAttachments,
        useMemory,
        signal: abortControllerRef.current.signal,
      });

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

      if (responseText.trim()) {
        await db.messages.add({
          chatId: activeChatId,
          role: 'model',
          content: responseText,
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      if (!abortControllerRef.current?.signal.aborted) {
        const errorMessage = `Erro: ${err.message || 'Falha na resposta do Oráculo.'}`;
        
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: errorMessage,
          };
          return updated;
        });

        await db.messages.add({
          chatId: activeChatId,
          role: 'model',
          content: errorMessage,
          timestamp: Date.now(),
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleEditMessage = async (index: number, newContent: string) => {
    if (!activeChatId) return;

    const messagesToDelete = messages.slice(index);
    for (const msg of messagesToDelete) {
      if (msg.id) await db.messages.delete(msg.id);
    }

    const historyBefore = messages.slice(0, index);
    setMessages(historyBefore);
    handleSendMessage(newContent, historyBefore);
  };

  const handleRetryLastMessage = async () => {
    if (messages.length === 0 || isLoading) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'model' && lastMsg.id) {
      await db.messages.delete(lastMsg.id);
    }

    const historyWithoutLastModel = messages.filter((_, idx) => idx !== messages.length - 1);
    setMessages(historyWithoutLastModel);

    const lastUserMsg = historyWithoutLastModel[historyWithoutLastModel.length - 1];
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.content, historyWithoutLastModel.slice(0, -1));
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
        onRenameChat={handleRenameChat}
        onDeleteChat={deleteChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCheckUpdate={() => handleCheckUpdate(true)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header
          data-tauri-drag-region
          className="h-14 border-b border-purple-950/30 flex items-center justify-between px-6 bg-[#090c10] backdrop-blur-sm select-none"
        >
          <div className="flex items-center gap-3">
            <Eye size={18} className="text-purple-400 animate-pulse" />
            <span className="font-bold text-xs tracking-widest bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent uppercase">
              ESPERTO
            </span>
            
            {/* Badge do Modelo com Selo Grátis/Pago */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-[10px] font-semibold bg-purple-950/80 hover:bg-purple-900/80 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-800/40 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>{settings.model || 'gemini-3.7-flash'}</span>
              {modelInfo.pricing === 'free_tier' ? (
                <span className="bg-emerald-950 text-emerald-300 text-[9px] px-1 py-0.2 rounded font-bold border border-emerald-800/50">GRÁTIS</span>
              ) : (
                <span className="bg-amber-950 text-amber-300 text-[9px] px-1 py-0.2 rounded font-bold border border-amber-800/50">PAGO</span>
              )}
            </button>

            {/* Contador e Medidor de Contexto */}
            <div
              title={`Contexto estimado: ${totalEstimatedTokens.toLocaleString()} de ${(modelInfo.contextLimit / 1000).toFixed(0)}k tokens`}
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono ${
                isTokenLimitExceeded
                  ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse'
                  : tokenUsagePercent > 80
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                  : 'bg-surface border-purple-900/30 text-purple-300'
              }`}
            >
              <Activity size={11} className={isTokenLimitExceeded || tokenUsagePercent > 80 ? 'text-red-400' : 'text-purple-400'} />
              <span>{totalEstimatedTokens > 1000 ? `${(totalEstimatedTokens / 1000).toFixed(1)}k` : totalEstimatedTokens}</span>
              <span className="text-gray-500">/</span>
              <span className="text-gray-400">{modelInfo.contextLimit >= 1000000 ? '1.0M' : `${modelInfo.contextLimit / 1000}k`}</span>
              <span className="font-bold ml-0.5">({tokenUsagePercent}%)</span>
            </div>

            {/* Cronômetro durante streaming */}
            {isLoading && (
              <div className="flex items-center gap-1 text-[11px] font-mono text-purple-300 bg-purple-950/70 border border-purple-500/40 px-2 py-0.5 rounded-full animate-pulse">
                <Timer size={11} />
                <span>{elapsedTime.toFixed(1)}s</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMemory}
              title={useMemory ? 'Memória de todo o chat ATIVA' : 'Memória do chat DESATIVADA'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border cursor-pointer ${
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
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:text-purple-200 bg-surface border border-purple-950/30 hover:bg-surfaceHover transition cursor-pointer"
              >
                <Copy size={13} />
                <span>Duplicar</span>
              </button>
            )}

            <button
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border cursor-pointer ${
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
              className="w-full bg-background border border-purple-900/40 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 resize-none font-mono"
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
              <p className="text-xs text-gray-500 mt-1">Cole imagens, PDFs, código ou textos longos para análise multimodal.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <ChatMessage
                key={index}
                role={msg.role}
                content={msg.content}
                attachments={msg.attachments}
                onEdit={msg.role === 'user' ? (newText) => handleEditMessage(index, newText) : undefined}
                onRetry={msg.role === 'model' && index === messages.length - 1 ? handleRetryLastMessage : undefined}
              />
            ))
          )}

          {/* Indicador pulsante durante resposta com cronômetro */}
          {isLoading && messages[messages.length - 1]?.content === '' && (
            <div className="flex items-center gap-3 p-5 text-purple-300 bg-surface/30 border-y border-purple-950/20">
              <div className="w-8 h-8 rounded-xl bg-purple-950 border border-purple-500/30 flex items-center justify-center animate-pulse">
                <Eye size={18} className="text-purple-400" />
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="animate-pulse">Consultando Oráculo...</span>
                <span className="text-purple-400 font-bold">({elapsedTime.toFixed(1)}s)</span>
              </div>
            </div>
          )}
        </div>

        {/* Aviso de Limite de Tokens Ultrapassado */}
        {isTokenLimitExceeded && (
          <div className="bg-red-950/80 border-t border-red-800 px-4 py-2 flex items-center justify-between text-xs text-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-red-400" />
              <span>Limite de tokens atingido ({totalEstimatedTokens.toLocaleString()} / {modelInfo.contextLimit.toLocaleString()}).</span>
            </div>
            <span className="text-[11px] text-red-300">Troque o modelo nas configurações ou inicie um novo chat.</span>
          </div>
        )}

        {/* Caixa de Entrada */}
        <div className="p-4 bg-surface/40 border-t border-purple-950/30">
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="max-w-4xl mx-auto flex flex-col gap-2">
            
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-surface/80 rounded-xl border border-purple-900/40">
                {attachments.map((att, index) => (
                  <div key={index} className="flex items-center gap-1.5 bg-background border border-purple-800/40 px-2.5 py-1 rounded-lg text-xs text-purple-200 shadow-sm">
                    {att.mimeType.startsWith('image/') ? (
                      <ImageIcon size={13} className="text-purple-400" />
                    ) : (
                      <FileText size={13} className="text-purple-400" />
                    )}
                    <span className="truncate max-w-[150px] font-mono text-[11px]">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="hover:text-red-400 transition p-0.5 cursor-pointer ml-1"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 bg-surface border border-purple-900/40 focus-within:border-purple-500 rounded-2xl p-2 transition shadow-inner">
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
                className="p-2.5 hover:bg-surfaceHover text-purple-300 rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Paperclip size={18} />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Pergunte ao Oráculo... (Enter para enviar, Ctrl+Enter para nova linha)"
                className="flex-1 bg-transparent px-2 py-2 text-sm text-white placeholder-gray-500 focus:outline-none resize-none max-h-44 min-h-[38px] leading-relaxed"
              />

              {isLoading ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 p-2.5 rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer"
                  title="Parar resposta"
                >
                  <Square size={16} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={(!inputMessage.trim() && attachments.length === 0) || isTokenLimitExceeded}
                  className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-40 text-white p-2.5 rounded-xl transition flex items-center justify-center shrink-0 shadow-lg shadow-purple-950/50 cursor-pointer"
                  title="Enviar mensagem (Enter)"
                >
                  <Send size={16} />
                </button>
              )}
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