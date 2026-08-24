import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, Chat, Message, Settings, Attachment } from './lib/db';
import { streamAIResponse } from './services/ai';
import { getModelInfo } from './lib/models';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { SettingsModal } from './components/SettingsModal';
import { UpdateModal } from './components/UpdateModal';
import { checkForUpdates, ReleaseInfo } from './services/updater';
import { Send, Sliders, Eye, Brain, Copy, Paperclip, X, FileText, Image as ImageIcon, Activity, Square, Timer, Folder, FolderCheck, FolderSync, Plus, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

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

interface LoadedFile {
  path: string;
  content: string;
}

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

  // Múltiplos Diretórios
  const [directoryPaths, setDirectoryPaths] = useState<string[]>([]);
  const [newDirPath, setNewDirPath] = useState('');
  const [allLoadedFiles, setAllLoadedFiles] = useState<LoadedFile[]>([]);
  const [showDirectoryDrawer, setShowDirectoryDrawer] = useState(false);
  const [loadingDirectories, setLoadingDirectories] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const modelInfo = useMemo(() => getModelInfo(settings.model || 'gemini-3.7-flash'), [settings.model]);

  // Cronômetro
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

  // Contagem de tokens
  const totalEstimatedTokens = useMemo(() => {
    let charCount = (settings.globalMemory || '').length + (systemInstruction || '').length;
    messages.forEach((m) => {
      charCount += m.content.length;
      if (m.attachments) m.attachments.forEach((a) => (charCount += a.data.length * 0.1));
    });
    charCount += inputMessage.length;
    return Math.ceil(charCount / 3.8);
  }, [messages, inputMessage, systemInstruction, settings.globalMemory]);

  const tokenUsagePercent = useMemo(() => {
    return Math.min(100, Math.round((totalEstimatedTokens / modelInfo.contextLimit) * 1000) / 10);
  }, [totalEstimatedTokens, modelInfo.contextLimit]);

  useEffect(() => {
    const loadInitialData = async () => {
      const savedSettings = await db.settings.get('default');
      if (savedSettings) setSettings(savedSettings);
      else await db.settings.put(defaultSettings);

      const allChats = await db.chats.orderBy('createdAt').reverse().toArray();
      setChats(allChats);

      if (allChats.length > 0) setActiveChatId(allChats[0].id);
      else createNewChat();
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      setDirectoryPaths([]);
      setAllLoadedFiles([]);
      return;
    }

    const loadChatData = async () => {
      const activeChat = await db.chats.get(activeChatId);
      if (activeChat) {
        setSystemInstruction(activeChat.systemInstruction || '');
        setUseMemory(activeChat.useMemory !== false);
        const paths = activeChat.directoryPaths || [];
        setDirectoryPaths(paths);
        if (paths.length > 0) syncDirectories(paths);
        else setAllLoadedFiles([]);
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

  // Sincroniza todas as pastas configuradas
  const syncDirectories = async (paths: string[]) => {
    const validPaths = paths.filter((p) => p.trim().length > 0);
    if (validPaths.length === 0) {
      setAllLoadedFiles([]);
      return;
    }

    setLoadingDirectories(true);
    try {
      const files = await invoke<LoadedFile[]>('read_multiple_directories', {
        dirPaths: validPaths,
      });
      setAllLoadedFiles(files);
      if (activeChatId) {
        await db.chats.update(activeChatId, { directoryPaths: validPaths });
      }
    } catch (err: any) {
      console.warn('Erro ao ler pastas:', err);
    } finally {
      setLoadingDirectories(false);
    }
  };

  const handleAddDirectory = () => {
    if (!newDirPath.trim()) return;
    const updated = Array.from(new Set([...directoryPaths, newDirPath.trim()]));
    setDirectoryPaths(updated);
    setNewDirPath('');
    syncDirectories(updated);
  };

  const handleRemoveDirectory = (pathToRemove: string) => {
    const updated = directoryPaths.filter((p) => p !== pathToRemove);
    setDirectoryPaths(updated);
    syncDirectories(updated);
  };

  // Monta o contexto inteligente limitando a um orçamento seguro de 150k tokens
  const buildSmartDirectoryContext = (query: string, files: LoadedFile[]): string => {
    if (files.length === 0) return '';

    // 1. Árvore estrutural completa de todos os arquivos
    let manifest = `=== ESTRUTURA DO PROJETO (${files.length} arquivos) ===\n`;
    files.forEach((f) => {
      manifest += `• ${f.path}\n`;
    });
    manifest += '\n';

    // 2. Pontuação dos arquivos por relevância com a pergunta do usuário
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const scoredFiles = files.map((f) => {
      let score = 0;
      const lowerPath = f.path.toLowerCase();
      const lowerContent = f.content.toLowerCase();

      // Arquivos de entrada e configuração sempre têm prioridade base
      if (lowerPath.includes('package.json') || lowerPath.includes('cargo.toml') || lowerPath.includes('readme.md')) {
        score += 5;
      }

      terms.forEach((term) => {
        if (lowerPath.includes(term)) score += 15;
        const matches = (lowerContent.match(new RegExp(term, 'g')) || []).length;
        score += Math.min(matches, 10);
      });

      return { ...f, score };
    });

    // Ordena os mais relevantes primeiro
    scoredFiles.sort((a, b) => b.score - a.score);

    // 3. Empacota os arquivos até atingir no máximo ~500.000 caracteres (~130k tokens de segurança)
    const MAX_CHARS_BUDGET = 500000;
    let accumulatedChars = manifest.length;
    let includedCount = 0;
    let filesContent = '';

    for (const f of scoredFiles) {
      if (accumulatedChars + f.content.length > MAX_CHARS_BUDGET) break;
      filesContent += `=== ARQUIVO: ${f.path} ===\n${f.content}\n\n`;
      accumulatedChars += f.content.length;
      includedCount++;
    }

    return `${manifest}=== CONTEÚDO DOS ARQUIVOS RELEVANTES (${includedCount} de ${files.length} incluídos para respeitar o limite de cota) ===\n\n${filesContent}`;
  };

  const createNewChat = async () => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: 'Nova Consulta',
      systemInstruction: '',
      directoryPaths: [],
      useMemory: true,
      createdAt: Date.now(),
    };
    await db.chats.add(newChat);
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setMessages([]);
    setDirectoryPaths([]);
    setAllLoadedFiles([]);
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
      directoryPaths: sourceChat.directoryPaths || [],
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
      if (updatedChats.length > 0) setActiveChatId(updatedChats[0].id);
      else createNewChat();
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
    for (let i = 0; i < files.length; i++) addFile(files[i]);
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
    const textToSend = customMessageText !== undefined ? customMessageText : inputMessage;
    if ((!textToSend.trim() && attachments.length === 0) || isLoading || !activeChatId) return;

    // AUTO-SYNC: Lê todas as pastas e seleciona o contexto ideal antes de enviar
    let currentFiles = allLoadedFiles;
    if (directoryPaths.length > 0) {
      try {
        currentFiles = await invoke<LoadedFile[]>('read_multiple_directories', {
          dirPaths: directoryPaths,
        });
        setAllLoadedFiles(currentFiles);
      } catch (e) {
        console.warn('Erro ao auto-sincronizar:', e);
      }
    }

    const smartContext = buildSmartDirectoryContext(textToSend, currentFiles);

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
        directoryContext: smartContext, // <--- Contexto inteligente respeitando o limite
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
        const errorMessage = `Erro: ${err.message || 'Falha na resposta do Esperto.'}`;
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

            {/* Contador de Contexto */}
            <div
              title={`Contexto: ${totalEstimatedTokens.toLocaleString()} de ${(modelInfo.contextLimit / 1000).toFixed(0)}k tokens`}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface border border-purple-900/30 text-[10px] font-mono text-purple-300"
            >
              <Activity size={11} className={tokenUsagePercent > 80 ? 'text-red-400' : 'text-purple-400'} />
              <span>{totalEstimatedTokens > 1000 ? `${(totalEstimatedTokens / 1000).toFixed(1)}k` : totalEstimatedTokens}</span>
              <span className="text-gray-500">/</span>
              <span className="text-gray-400">{modelInfo.contextLimit >= 1000000 ? '1.0M' : `${modelInfo.contextLimit / 1000}k`}</span>
              <span className="font-bold ml-0.5">({tokenUsagePercent}%)</span>
            </div>

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

            {/* Botão de Múltiplos Diretórios */}
            <button
              onClick={() => setShowDirectoryDrawer(!showDirectoryDrawer)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border cursor-pointer ${
                directoryPaths.length > 0
                  ? 'bg-purple-950/80 text-purple-300 border-purple-500/50 shadow-sm'
                  : 'text-gray-400 hover:text-white bg-surface border-purple-950/30'
              }`}
              title="Vincular pastas locais como base de conhecimento"
            >
              {directoryPaths.length > 0 ? <FolderCheck size={14} className="text-purple-400" /> : <Folder size={14} />}
              <span>{directoryPaths.length > 0 ? `${directoryPaths.length} Pastas (${allLoadedFiles.length} arqs)` : 'Pastas Base'}</span>
            </button>
          </div>
        </header>

        {/* Gaveta de Gerenciamento de Múltiplos Diretórios */}
        {showDirectoryDrawer && (
          <div className="p-4 bg-surface border-b border-purple-950/40 transition space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-purple-200">
                Pastas Locais Vinculadas a este Chat:
              </label>
              <span className="text-[11px] text-purple-300 font-mono">
                {allLoadedFiles.length} arquivos indexados
              </span>
            </div>

            {/* Lista de Pastas Adicionadas */}
            {directoryPaths.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {directoryPaths.map((path, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-background border border-purple-900/30 px-3 py-1.5 rounded-xl text-xs text-purple-200 font-mono">
                    <span className="truncate flex-1 mr-2">{path}</span>
                    <button
                      onClick={() => handleRemoveDirectory(path)}
                      className="text-gray-500 hover:text-red-400 transition p-1"
                      title="Remover pasta"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Adicionar Nova Pasta */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newDirPath}
                onChange={(e) => setNewDirPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDirectory()}
                placeholder="Cole o caminho de uma pasta (ex: C:\MeuProjeto ou /home/samuel/app)"
                className="flex-1 bg-background border border-purple-900/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
              <button
                onClick={handleAddDirectory}
                disabled={!newDirPath.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>Adicionar</span>
              </button>
              <button
                onClick={() => syncDirectories(directoryPaths)}
                disabled={loadingDirectories || directoryPaths.length === 0}
                className="bg-surface hover:bg-surfaceHover text-purple-300 border border-purple-900/40 text-xs font-semibold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <FolderSync size={14} className={loadingDirectories ? 'animate-spin' : ''} />
                <span>Recarregar</span>
              </button>
            </div>
          </div>
        )}

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
              <p className="text-xs text-gray-500 mt-1">Vincule pastas de código, cole imagens ou envie arquivos para análise multimodal.</p>
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

          {isLoading && messages[messages.length - 1]?.content === '' && (
            <div className="flex items-center gap-3 p-5 text-purple-300 bg-surface/30 border-y border-purple-950/20">
              <div className="w-8 h-8 rounded-xl bg-purple-950 border border-purple-500/30 flex items-center justify-center animate-pulse">
                <Eye size={18} className="text-purple-400" />
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="animate-pulse">Consultando Esperto...</span>
                <span className="text-purple-400 font-bold">({elapsedTime.toFixed(1)}s)</span>
              </div>
            </div>
          )}
        </div>

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

            <div className="bg-surface border border-purple-900/40 focus-within:border-purple-500 rounded-2xl p-3 transition shadow-inner flex flex-col gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInput}
                multiple
                className="hidden"
              />

              <textarea
                ref={textareaRef}
                rows={3}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Pergunte ao Esperto... (Enter para enviar, Ctrl+Enter para nova linha)"
                className="w-full bg-transparent px-1 pt-1 text-sm text-white placeholder-gray-500 focus:outline-none resize-y min-h-[70px] max-h-96 leading-relaxed font-sans"
              />

              <div className="flex items-center justify-between pt-1 border-t border-purple-950/20 select-none">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Anexar imagens ou documentos (ou cole com Ctrl+V)"
                    className="p-1.5 hover:bg-surfaceHover text-purple-400 hover:text-purple-300 rounded-lg transition flex items-center justify-center cursor-pointer"
                  >
                    <Paperclip size={18} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
                      title="Parar resposta"
                    >
                      <Square size={13} fill="currentColor" />
                      <span>Parar</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!inputMessage.trim() && attachments.length === 0}
                      className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-40 text-white p-2 rounded-xl transition flex items-center justify-center shadow-md shadow-purple-950/50 cursor-pointer"
                      title="Enviar mensagem (Enter)"
                    >
                      <Send size={15} />
                    </button>
                  )}
                </div>
              </div>
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