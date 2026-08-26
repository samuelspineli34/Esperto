import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, Chat, Message, Settings, Attachment, WorkspacePreset } from './lib/db';
import { streamAIResponse } from './services/ai';
import { getModelInfo } from './lib/models';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { SettingsModal } from './components/SettingsModal';
import { UpdateModal } from './components/UpdateModal';
import { HelpModal } from './components/HelpModal';
import { ArtifactPreview } from './components/ArtifactPreview';
import { checkForUpdates, ReleaseInfo } from './services/updater';
import { Send, Sliders, Eye, Brain, Copy, Paperclip, X, FileText, Image as ImageIcon, Activity, Square, Timer, Folder, FolderCheck, FolderSync, Plus, Trash2, Download as ExportIcon, Bookmark, BookmarkPlus, DollarSign, Gift } from 'lucide-react';
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);

  // Múltiplos Diretórios e Predefinições
  const [presets, setPresets] = useState<WorkspacePreset[]>([]);
  const [directoryPaths, setDirectoryPaths] = useState<string[]>([]);
  const [newDirPath, setNewDirPath] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const [allLoadedFiles, setAllLoadedFiles] = useState<LoadedFile[]>([]);
  const [showDirectoryDrawer, setShowDirectoryDrawer] = useState(false);
  const [loadingDirectories, setLoadingDirectories] = useState(false);

  const [activeArtifact, setActiveArtifact] = useState<{ code: string; language: string } | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const modelInfo = useMemo(() => getModelInfo(settings.model || 'gemini-3.7-flash'), [settings.model]);

  // Cronômetro em tempo real
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
      if (m.attachments) m.attachments.forEach((a) => (charCount += a.data.length * 0.1));
    });
    charCount += inputMessage.length;
    return Math.ceil(charCount / 3.8);
  }, [messages, inputMessage, systemInstruction, settings.globalMemory]);

  const tokenUsagePercent = useMemo(() => {
    return Math.min(100, Math.round((totalEstimatedTokens / modelInfo.contextLimit) * 1000) / 10);
  }, [totalEstimatedTokens, modelInfo.contextLimit]);

  // Cálculo de Custo Médio Estimado em Dólar para Modelos Pagos
  const estimatedCostUSD = useMemo(() => {
    if (modelInfo.pricing === 'free_tier') return 0;

    let userChars = (settings.globalMemory || '').length + (systemInstruction || '').length;
    let modelChars = 0;

    messages.forEach((m) => {
      if (m.role === 'user') {
        userChars += m.content.length;
        if (m.attachments) m.attachments.forEach((a) => (userChars += a.data.length * 0.1));
      } else {
        modelChars += m.content.length;
      }
    });

    userChars += inputMessage.length;

    const inputTokens = Math.ceil(userChars / 3.8);
    const outputTokens = Math.ceil(modelChars / 3.8);

    const inPrice = modelInfo.inputPrice || 2.50;
    const outPrice = modelInfo.outputPrice || 10.00;

    return (inputTokens / 1000000) * inPrice + (outputTokens / 1000000) * outPrice;
  }, [messages, inputMessage, systemInstruction, settings.globalMemory, modelInfo]);

  useEffect(() => {
    const loadInitialData = async () => {
      const savedSettings = await db.settings.get('default');
      if (savedSettings) setSettings(savedSettings);
      else await db.settings.put(defaultSettings);

      const allPresets = await db.presets.orderBy('createdAt').reverse().toArray();
      setPresets(allPresets);

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

  const handleSaveAsPreset = async () => {
    if (!newPresetName.trim() || directoryPaths.length === 0) return;
    const newPreset: WorkspacePreset = {
      id: crypto.randomUUID(),
      name: newPresetName.trim(),
      paths: [...directoryPaths],
      createdAt: Date.now(),
    };
    await db.presets.add(newPreset);
    setPresets((prev) => [newPreset, ...prev]);
    setNewPresetName('');
    setIsCreatingPreset(false);
  };

  const handleApplyPreset = (preset: WorkspacePreset) => {
    setDirectoryPaths(preset.paths);
    syncDirectories(preset.paths);
  };

  const handleDeletePreset = async (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.presets.delete(presetId);
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
  };

  const buildSmartDirectoryContext = (query: string, files: LoadedFile[]): string => {
    if (files.length === 0) return '';

    let manifest = `=== ESTRUTURA DO PROJETO (${files.length} arquivos) ===\n`;
    files.forEach((f) => {
      manifest += `• ${f.path}\n`;
    });
    manifest += '\n';

    const terms = query
      .toLowerCase()
      .split(/[\s,.;:!?()]+/)
      .filter((t) => t.length > 2);

    const scoredFiles = files.map((f) => {
      let score = 0;
      const lowerPath = f.path.toLowerCase();
      const lowerContent = f.content.toLowerCase();

      if (lowerPath.endsWith('package.json') || lowerPath.endsWith('cargo.toml') || lowerPath.endsWith('readme.md')) {
        score += 3;
      }

      terms.forEach((term) => {
        if (lowerPath.includes(term)) score += 20;
        const occurrences = (lowerContent.match(new RegExp(term, 'g')) || []).length;
        score += Math.min(occurrences * 2, 16);
      });

      return { ...f, score };
    });

    scoredFiles.sort((a, b) => b.score - a.score);

    const MAX_CHARS_BUDGET = 180000;
    let accumulatedChars = manifest.length;
    let includedCount = 0;
    let filesContent = '';

    for (const f of scoredFiles) {
      if (f.score <= 0 && includedCount >= 5) break;

      let contentToInclude = f.content;
      const lines = contentToInclude.split('\n');
      if (lines.length > 250) {
        contentToInclude = lines.slice(0, 250).join('\n') + `\n\n... [Truncado: total ${lines.length} linhas]`;
      }

      if (accumulatedChars + contentToInclude.length > MAX_CHARS_BUDGET) break;

      filesContent += `=== ARQUIVO: ${f.path} ===\n${contentToInclude}\n\n`;
      accumulatedChars += contentToInclude.length;
      includedCount++;
    }

    return `${manifest}=== CONTEÚDO DOS ARQUIVOS SELECIONADOS (${includedCount} arquivos) ===\n\n${filesContent}`;
  };

  const createNewChat = async () => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: 'Nova Consulta',
      systemInstruction: '',
      directoryPaths: directoryPaths.length > 0 ? [...directoryPaths] : [],
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
        directoryContext: smartContext,
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

  const handleExportMarkdown = () => {
    if (messages.length === 0) return;
    let md = `# Conversa: ${chats.find((c) => c.id === activeChatId)?.title || 'Esperto'}\n\n`;
    md += `*Exportado em: ${new Date().toLocaleString('pt-BR')} via Esperto Desktop*\n\n---\n\n`;

    messages.forEach((m) => {
      const author = m.role === 'user' ? '👤 Usuário' : '🧠 Esperto';
      md += `### ${author}\n\n${m.content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversa-${activeChatId || 'esperto'}.md`;
    a.click();
    URL.revokeObjectURL(url);
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
        onOpenHelp={() => setIsHelpOpen(true)}
        onCheckUpdate={() => handleCheckUpdate(true)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header
          data-tauri-drag-region
          className="h-14 border-b border-purple-950/30 flex items-center justify-between px-6 bg-background backdrop-blur-sm select-none"
        >
          <div className="flex items-center gap-3">
            <Eye size={18} className="text-purple-400 animate-pulse" />
            <span className="font-bold text-xs tracking-widest bg-linear-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent uppercase">
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

            {/* Indicador de Custo Médio Estimado em Dólar */}
            {modelInfo.pricing === 'paid_only' ? (
              <div
                title={`Custo estimado da conversa atual (${modelInfo.name}): ~$${modelInfo.inputPrice}/1M entrada, ~$${modelInfo.outputPrice}/1M saída`}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface border border-amber-900/40 text-[10px] font-mono text-amber-300 shadow-sm"
              >
                <DollarSign size={11} className="text-amber-400" />
                <span>Custo est.:</span>
                <span className="font-bold text-amber-200">
                  {estimatedCostUSD < 0.0001 ? '<$0.0001' : `$${estimatedCostUSD.toFixed(4)}`}
                </span>
              </div>
            ) : (
              <div
                title="Este modelo está operando em Cota Gratuita (Custo zero)."
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface border border-emerald-900/30 text-[10px] font-mono text-emerald-300 shadow-sm"
              >
                <Gift size={11} className="text-emerald-400" />
                <span>Custo: $0.00 (Grátis)</span>
              </div>
            )}

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

            {/* Botão de Pastas Base */}
            <button
              onClick={() => setShowDirectoryDrawer(!showDirectoryDrawer)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border cursor-pointer ${
                directoryPaths.length > 0
                  ? 'bg-purple-950/80 text-purple-300 border-purple-500/50 shadow-sm'
                  : 'text-gray-400 hover:text-white bg-surface border-purple-950/30'
              }`}
              title="Vincular pastas locais ou projetos salvos"
            >
              {directoryPaths.length > 0 ? <FolderCheck size={14} className="text-purple-400" /> : <Folder size={14} />}
              <span>{directoryPaths.length > 0 ? `${directoryPaths.length} Pastas (${allLoadedFiles.length} arqs)` : 'Pastas Base'}</span>
            </button>

            {messages.length > 0 && (
              <button
                onClick={handleExportMarkdown}
                title="Exportar conversa em Markdown (.md)"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:text-purple-200 bg-surface border border-purple-950/30 hover:bg-surfaceHover transition cursor-pointer"
              >
                <ExportIcon size={13} />
                <span>Exportar</span>
              </button>
            )}
          </div>
        </header>

        {/* Gaveta de Gerenciamento de Pastas e Predefinições */}
        {showDirectoryDrawer && (
          <div className="p-4 bg-surface border-b border-purple-950/40 transition space-y-4 shadow-xl">
            {/* Seção de Predefinições Salvas (Workspaces) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                  <Bookmark size={14} className="text-purple-400" />
                  <span>Projetos Salvos (Workspaces com 1 Clique)</span>
                </span>

                <button
                  onClick={() => setIsCreatingPreset(!isCreatingPreset)}
                  disabled={directoryPaths.length === 0}
                  className="text-[11px] text-purple-300 hover:text-purple-200 disabled:opacity-40 flex items-center gap-1 transition cursor-pointer"
                >
                  <BookmarkPlus size={13} />
                  <span>Salvar pastas atuais como projeto</span>
                </button>
              </div>

              {/* Formulário para salvar novo projeto */}
              {isCreatingPreset && (
                <div className="flex gap-2 p-2.5 mb-2.5 bg-background border border-purple-500/40 rounded-xl animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Nome do projeto (ex: Meu App Fullstack, Backend API)"
                    className="flex-1 bg-surface border border-purple-900/40 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={handleSaveAsPreset}
                    disabled={!newPresetName.trim()}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1 rounded-lg transition cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              )}

              {/* Chips de Projetos Salvos */}
              {presets.length === 0 ? (
                <p className="text-[11px] text-gray-500">Nenhum projeto salvo ainda. Adicione pastas abaixo e clique em salvar para criar seu primeiro projeto.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => {
                    const isFullyLoaded = preset.paths.every((p) => directoryPaths.includes(p)) && preset.paths.length === directoryPaths.length;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleApplyPreset(preset)}
                        className={`group px-3 py-1.5 rounded-xl border text-xs font-medium transition flex items-center gap-2 cursor-pointer ${
                          isFullyLoaded
                            ? 'bg-purple-950/90 text-purple-200 border-purple-500 shadow-sm'
                            : 'bg-background hover:bg-surfaceHover text-gray-300 border-purple-900/40'
                        }`}
                      >
                        <span className="font-semibold">{preset.name}</span>
                        <span className="text-[10px] text-purple-400 font-mono">({preset.paths.length} pastas)</span>
                        <button
                          onClick={(e) => handleDeletePreset(preset.id, e)}
                          className="text-gray-500 hover:text-red-400 transition p-0.5 opacity-0 group-hover:opacity-100"
                          title="Excluir predefinição"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Lista de Pastas Ativas deste Chat */}
            <div className="pt-2 border-t border-purple-950/30 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-purple-200">
                  Pastas Vinculadas a este Chat:
                </label>
                <span className="text-[11px] text-purple-300 font-mono">
                  {allLoadedFiles.length} arquivos indexados
                </span>
              </div>

              {directoryPaths.length > 0 && (
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {directoryPaths.map((path, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-background border border-purple-900/30 px-3 py-1 rounded-xl text-xs text-purple-200 font-mono">
                      <span className="truncate flex-1 mr-2">{path}</span>
                      <button
                        onClick={() => handleRemoveDirectory(path)}
                        className="text-gray-500 hover:text-red-400 transition p-1"
                        title="Remover pasta"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newDirPath}
                  onChange={(e) => setNewDirPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDirectory()}
                  placeholder="Cole o caminho de uma pasta (ex: C:\MeuApp ou /home/samuel/projeto)"
                  className="flex-1 bg-background border border-purple-900/40 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
                <button
                  onClick={handleAddDirectory}
                  disabled={!newDirPath.trim()}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Adicionar</span>
                </button>
                <button
                  onClick={() => syncDirectories(directoryPaths)}
                  disabled={loadingDirectories || directoryPaths.length === 0}
                  className="bg-surface hover:bg-surfaceHover text-purple-300 border border-purple-900/40 text-xs font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderSync size={14} className={loadingDirectories ? 'animate-spin' : ''} />
                  <span>Recarregar</span>
                </button>
              </div>
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
            <div className="h-full flex flex-col items-center justify-center p-6 text-purple-300/60 select-none max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-purple-950/30 border border-purple-500/20 flex items-center justify-center mb-4 shadow-xl shadow-purple-950/30">
                <Eye size={36} className="text-purple-400 animate-pulse" />
              </div>
              <h2 className="text-base font-bold text-white mb-1">Como o Esperto pode te ajudar hoje?</h2>
              <p className="text-xs text-gray-500 mb-6 text-center">Selecione uma ação rápida ou envie uma mensagem com imagens, pastas ou arquivos.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => handleSendMessage('Analise a arquitetura dos arquivos de código carregados e sugira melhorias.')}
                  className="p-3 bg-surface/50 hover:bg-surface border border-purple-900/30 hover:border-purple-500/50 rounded-xl text-left transition cursor-pointer group"
                >
                  <span className="text-xs font-semibold text-purple-200 group-hover:text-white block">🔍 Analisar Arquitetura</span>
                  <span className="text-[11px] text-gray-500">Avalia a estrutura dos arquivos das pastas vinculadas.</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage('Crie um componente de Dashboard moderno em HTML e Tailwind CSS com gráficos.')}
                  className="p-3 bg-surface/50 hover:bg-surface border border-purple-900/30 hover:border-purple-500/50 rounded-xl text-left transition cursor-pointer group"
                >
                  <span className="text-xs font-semibold text-purple-200 group-hover:text-white block">🎨 Criar Componente com Preview</span>
                  <span className="text-[11px] text-gray-500">Gera código com visualização interativa instantânea.</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage('Como posso otimizar a performance de memória e execução da minha aplicação?')}
                  className="p-3 bg-surface/50 hover:bg-surface border border-purple-900/30 hover:border-purple-500/50 rounded-xl text-left transition cursor-pointer group"
                >
                  <span className="text-xs font-semibold text-purple-200 group-hover:text-white block">⚡ Otimizar Performance</span>
                  <span className="text-[11px] text-gray-500">Dicas avançadas de consumo de RAM e CPU.</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage('Explique o funcionamento detalhado dos algoritmos deste projeto.')}
                  className="p-3 bg-surface/50 hover:bg-surface border border-purple-900/30 hover:border-purple-500/50 rounded-xl text-left transition cursor-pointer group"
                >
                  <span className="text-xs font-semibold text-purple-200 group-hover:text-white block">🧠 Explicar Código Complexo</span>
                  <span className="text-[11px] text-gray-500">Detalhamento passo a passo de fluxos lógicos.</span>
                </button>
              </div>
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
                onOpenArtifact={(code, lang) => setActiveArtifact({ code, language: lang })}
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
                    <span className="truncate max-w-37.5 font-mono text-[11px]">{att.name}</span>
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
                className="w-full bg-transparent px-1 pt-1 text-sm text-white placeholder-gray-500 focus:outline-none resize-y min-h-17.5 max-h-96 leading-relaxed font-sans"
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
                      className="bg-linear-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-40 text-white p-2 rounded-xl transition flex items-center justify-center shadow-md shadow-purple-950/50 cursor-pointer"
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

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      <UpdateModal
        isOpen={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
        checking={isCheckingUpdate}
        release={latestRelease}
        onCheckAgain={() => handleCheckUpdate(true)}
      />

      <ArtifactPreview
        isOpen={activeArtifact !== null}
        onClose={() => setActiveArtifact(null)}
        code={activeArtifact?.code || ''}
        language={activeArtifact?.language || ''}
      />
    </div>
  );
}