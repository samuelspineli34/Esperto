import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { db, Chat, Message, Settings, Attachment, WorkspacePreset, ChatRunSettings } from './lib/db';
import { streamAIResponse } from './services/ai';
import { AVAILABLE_MODELS, getModelInfo, registerLocalOllamaModels, registerCustomProviderModels, loadDynamicCloudModels, subscribeModelChanges } from './lib/models';
import { getInstalledOllamaModels, ensureOllamaRunning } from './services/ollama';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { SettingsModal } from './components/SettingsModal';
import RunSettingsDrawer from './components/RunSettingsDrawer';
import { UpdateModal } from './components/UpdateModal';
import { HelpModal } from './components/HelpModal';
import { ErrorModal, AppErrorInfo } from './components/ErrorModal';
import { ArtifactPreview } from './components/ArtifactPreview';
import { WelcomePanel } from './components/WelcomePanel';
import { CommandPalette, type PaletteCommand, type PaletteSearchResult } from './components/CommandPalette';
import { checkForUpdates, ReleaseInfo } from './services/updater';
import {
  Send,
  Sliders,
  Brain,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Square,
  Timer,
  Folder,
  FolderCheck,
  FolderSync,
  Plus,
  Trash2,
  BookmarkPlus,
  FolderSearch,
  ChevronDown,
  Terminal,
  Layers,
  PanelLeftClose,
  PanelLeft,
  Settings2,
  Command as CommandIcon,
  Search,
  RefreshCw,
  Cpu,
  Code2,
  Bug,
  FileSearch,
  Gauge,
  FolderPlus,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const AGENT_SYSTEM_PROMPT = `Você é o ESPERTO, um Engenheiro de Software Autônomo e Agente de Código de Alta Performance.
Você tem acesso direto ao sistema de arquivos do projeto do usuário através da IDE.

REGRAS RÍGIDAS DE GRAVAÇÃO EM DISCO:
1. Para criar ou alterar arquivos, use SEMPRE a tag:
<esperto_write path="caminho/relativo/do/arquivo.ext">
conteúdo completo do arquivo
</esperto_write>

2. PROIBIÇÃO ABSOLUTA DE RETICÊNCIAS OU CÓDIGO PARCIAL:
NUNCA use "...", "// resto do código", "/* código anterior continua igual */" ou omissões dentro de <esperto_write>.
Você é OBRIGADO a fornecer o código 100% COMPLETO, desde a primeira linha de imports até a última linha. Se você omitir linhas ou usar "...", o arquivo em disco será destruído e corrompido.

3. NUNCA coloque blocos de markdown (\`\`\`) DENTRO da tag <esperto_write>.
4. NUNCA inicie o código com '#' como comentário se a linguagem for TypeScript, JavaScript, Rust, C, C++, CSS ou JSON.
5. Para comandos de terminal, use:
<esperto_cmd>comando aqui</esperto_cmd>

6. Se o código for longo, NÃO OMITA LINHAS. Se o limite de tokens for atingido, pare a resposta e aguarde o usuário pedir para continuar, mas NUNCA gere código corrompido ou com reticências.`;

const defaultSettings: Settings = {
  id: 'default',
  model: 'gemini-3.7-flash',
  globalMemory: '',
  geminiApiKey: '',
  temperature: 0.7,
  thinkingLevel: 'off',
  mediaResolution: 'default',
  googleSearch: false,
  requireActionConfirmation: true,
  ollamaHost: 'http://127.0.0.1:11434',
  ollamaContextLength: 4096,
  searxngHost: 'http://127.0.0.1:8080',
};

interface LoadedFile {
  path: string;
  content: string;
}

function generateContextualTitle(userPrompt: string): string {
  const clean = userPrompt.trim().toLowerCase();

  if (clean.includes('arquivo') && (clean.includes('pasta') || clean.includes('tem nela') || clean.includes('workspace'))) {
    return 'Inspeção de Workspace';
  }
  if (clean.includes('jogo') || clean.includes('game')) {
    return 'Desenvolvimento de Jogo';
  }
  if (clean.includes('refator') || clean.includes('melhorar')) {
    return 'Refatoração de Código';
  }
  if (clean.includes('teste') || clean.includes('test')) {
    return 'Testes Automatizados';
  }
  if (clean.includes('erro') || clean.includes('bug') || clean.includes('corrija') || clean.includes('fix')) {
    return 'Correção de Erros';
  }
  if (clean.includes('terminal') || clean.includes('comando') || clean.includes('build')) {
    return 'Terminal & Scripts';
  }

  const words = userPrompt
    .replace(/[^\w\s\u00C0-\u00FF]/gi, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 4);

  if (words.length > 0) {
    const capitalized = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return capitalized.slice(0, 26);
  }

  return 'Nova Sessão';
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => !localStorage.getItem('esperto-local-ai-setup-seen'));
  const [isRunSettingsOpen, setIsRunSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [paletteModels, setPaletteModels] = useState([...AVAILABLE_MODELS]);

  const [activeError, setActiveError] = useState<AppErrorInfo | null>(null);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);

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

  const isUserScrolledUp = useRef(false);

  const currentChat = useMemo(() => chats.find((c) => c.id === activeChatId), [chats, activeChatId]);
  const activeModelId = useMemo(
    () => currentChat?.model || settings.model || 'gemini-3.7-flash',
    [currentChat?.model, settings.model]
  );
  const isChatModelOverridden = useMemo(() => Boolean(currentChat?.model), [currentChat?.model]);

  const modelInfo = useMemo(
    () => getModelInfo(activeModelId, settings.customProviders),
    [activeModelId, settings.customProviders]
  );

  const currentRunSettings: ChatRunSettings = useMemo(() => {
    return (
      currentChat?.runSettings || {
        temperature: settings.temperature ?? 0.7,
        topP: settings.topP ?? 0.9,
        thinkingLevel: settings.thinkingLevel || 'off',
        googleSearch: settings.googleSearch ?? false,
        contextLength: settings.ollamaContextLength || 4096,
        mediaResolution: settings.mediaResolution || 'default',
      }
    );
  }, [currentChat?.runSettings, settings]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setIsRunSettingsOpen((prev) => !prev);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        createNewChat();
      } else if (isCmdOrCtrl && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      } else if (e.key === 'Escape') {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
        } else if (isLoading) {
          handleStopGeneration();
        } else {
          setIsSettingsOpen(false);
          setIsRunSettingsOpen(false);
          setIsHelpOpen(false);
          setIsUpdateOpen(false);
          setActiveArtifact(null);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isLoading, isCommandPaletteOpen]);

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

  const totalEstimatedTokens = useMemo(() => {
    let charCount = (settings.globalMemory || '').length + (systemInstruction || '').length;
    messages.forEach((m) => {
      charCount += m.content.length;
      if (m.attachments) m.attachments.forEach((a) => (charCount += a.data.length * 0.1));
    });
    charCount += inputMessage.length;
    return Math.ceil(charCount / 3.8);
  }, [messages, inputMessage, systemInstruction, settings.globalMemory]);

  useEffect(() => subscribeModelChanges(() => setPaletteModels([...AVAILABLE_MODELS])), []);

  useEffect(() => {
    const initLocalModels = async () => {
      await ensureOllamaRunning(settings.ollamaHost, settings.ollamaCustomPath);
      const res = await getInstalledOllamaModels(settings.ollamaHost, settings.ollamaCustomPath);
      if (res.models && res.models.length > 0) {
        registerLocalOllamaModels(res.models);
      }
    };
    initLocalModels();
  }, [settings.ollamaHost, settings.ollamaCustomPath]);

  useEffect(() => {
    const loadInitialData = async () => {
      const savedSettings = await db.settings.get('default');
      if (savedSettings) {
        setSettings(savedSettings);
        registerCustomProviderModels(savedSettings.customProviders || []);
        
        // Chamada explícita e segura
        try {
            await loadDynamicCloudModels(savedSettings);
        } catch (e) {
            console.error("Falha ao carregar modelos dinâmicos da nuvem", e);
        }
      } else {
        await db.settings.put(defaultSettings);
      }

      const allPresets = await db.presets.orderBy('createdAt').reverse().toArray();
      setPresets(allPresets);

      const allChats = await db.chats.orderBy('createdAt').reverse().toArray();
      setChats(allChats);

      if (allChats.length > 0) setActiveChatId(allChats[0].id);
      else createNewChat();
    };
    loadInitialData();
  }, []);

  const syncDirectories = useCallback(
    async (paths: string[]) => {
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
        console.warn('Auto-sync:', err);
      } finally {
        setLoadingDirectories(false);
      }
    },
    [activeChatId]
  );

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      setDirectoryPaths([]);
      setAllLoadedFiles([]);
      return;
    }

    const loadChatData = async () => {
      const active = await db.chats.get(activeChatId);
      if (active) {
        setSystemInstruction(active.systemInstruction || '');
        setUseMemory(active.useMemory !== false);
        const paths = active.directoryPaths || [];
        setDirectoryPaths(paths);
        if (paths.length > 0) syncDirectories(paths);
        else setAllLoadedFiles([]);
      }

      const chatMessages = await db.messages.where('chatId').equals(activeChatId).sortBy('timestamp');
      setMessages(chatMessages);
    };

    loadChatData();
  }, [activeChatId, syncDirectories]);

  const handleScrollContainer = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 120;
  };

  useEffect(() => {
    if (!isUserScrolledUp.current) {
      chatContainerRef.current?.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: isLoading ? 'auto' : 'smooth',
      });
    }
  }, [messages, isLoading]);

  const handleBrowseFolder = async (): Promise<string | null> => {
    try {
      const selected = await invoke<string | null>('select_folder');
      if (selected) {
        const updated = Array.from(new Set([...directoryPaths, selected.trim()]));
        setDirectoryPaths(updated);
        syncDirectories(updated);
        return selected.trim();
      }
      return null;
    } catch (err: any) {
      setActiveError({
        title: 'Falha ao Selecionar Pasta',
        context: 'Seletor Nativo',
        message: 'Não foi possível abrir o explorador de pastas.',
        technicalDetails: err?.toString() || 'Erro no select_folder',
      });
      return null;
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

      if (
        lowerPath.endsWith('package.json') ||
        lowerPath.endsWith('cargo.toml') ||
        lowerPath.endsWith('readme.md')
      ) {
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

    const maxBudget = (currentRunSettings.contextLength || 8192) > 8192 ? 55000 : 25000;
    let accumulatedChars = manifest.length;
    let includedCount = 0;
    let filesContent = '';

    for (const f of scoredFiles) {
      if (f.score <= 0 && includedCount >= 5) break;

      let contentToInclude = f.content;
      const lines = contentToInclude.split('\n');
      if (lines.length > 300) {
        contentToInclude = lines.slice(0, 300).join('\n') + `\n\n... [Total: ${lines.length} linhas]`;
      }

      if (accumulatedChars + contentToInclude.length > maxBudget) break;

      filesContent += `=== ARQUIVO: ${f.path} ===\n${contentToInclude}\n\n`;
      accumulatedChars += contentToInclude.length;
      includedCount++;
    }

    return `${manifest}=== CONTEÚDO DOS ARQUIVOS SELECIONADOS (${includedCount} arquivos) ===\n\n${filesContent}`;
  };

  const createNewChat = () => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: 'Nova Sessão',
      systemInstruction: '',
      directoryPaths: directoryPaths.length > 0 ? [...directoryPaths] : [],
      useMemory: true,
      createdAt: Date.now(),
    };
    db.chats.add(newChat);
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setMessages([]);
    isUserScrolledUp.current = false;
  };

  const handleUpdateRunSettings = async (newRunSettings: ChatRunSettings) => {
    if (!activeChatId) return;
    await db.chats.update(activeChatId, { runSettings: newRunSettings });
    setChats((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, runSettings: newRunSettings } : c))
    );
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
          name: `snippet-${tokenCost}t.txt`,
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

    isUserScrolledUp.current = false;

    let currentFiles = allLoadedFiles;
    if (directoryPaths.length > 0) {
      try {
        currentFiles = await invoke<LoadedFile[]>('read_multiple_directories', {
          dirPaths: directoryPaths,
        });
        setAllLoadedFiles(currentFiles);
      } catch (e) {
        console.warn('Auto-sync:', e);
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
        const smartTitle = generateContextualTitle(currentInput);
        await db.chats.update(activeChatId, { title: smartTitle });
        setChats((prev) =>
          prev.map((c) => (c.id === activeChatId ? { ...c, title: smartTitle } : c))
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
    const combinedSystemPrompt = `${AGENT_SYSTEM_PROMPT}\n\n${systemInstruction || ''}`;

    const mergedSettings: Settings = {
      ...settings,
      temperature: currentRunSettings.temperature ?? settings.temperature,
      topP: currentRunSettings.topP ?? settings.topP,
      thinkingLevel: currentRunSettings.thinkingLevel || settings.thinkingLevel,
      googleSearch: currentRunSettings.googleSearch ?? settings.googleSearch,
      ollamaContextLength: currentRunSettings.contextLength || settings.ollamaContextLength,
      mediaResolution: currentRunSettings.mediaResolution || settings.mediaResolution,
    };

    try {
      const generator = streamAIResponse({
        model: activeModelId,
        settings: mergedSettings,
        systemInstruction: combinedSystemPrompt,
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
        const errorMessage = `Erro: ${err.message || 'Falha ao processar solicitação.'}`;
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

        setActiveError({
          title: 'Erro na Inferência',
          context: activeModelId,
          message: err.message || 'Falha de comunicação com o motor de IA.',
          technicalDetails: err.stack || err.toString(),
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
    registerCustomProviderModels(newSettings.customProviders || []);
    await db.settings.put(newSettings);
  };

  const handleCheckUpdate = async (openModal = true) => {
    if (openModal) setIsUpdateOpen(true);
    setIsCheckingUpdate(true);
    const release = await checkForUpdates();
    setLatestRelease(release);
    setIsCheckingUpdate(false);
  };

  const handlePaletteModelSelect = async (modelId: string) => {
    if (activeChatId) {
      await db.chats.update(activeChatId, { model: modelId });
      setChats((previous) => previous.map((chat) => chat.id === activeChatId ? { ...chat, model: modelId } : chat));
    } else {
      await handleSaveSettings({ ...settings, model: modelId });
    }
  };

  const handlePaletteSearchConversations = useCallback(async (query: string): Promise<PaletteSearchResult[]> => {
    const term = query.trim().toLowerCase();
    if (term.length < 3) return [];
    const matchingMessages = await db.messages
      .toCollection()
      .reverse()
      .filter((message) => message.content.toLowerCase().includes(term))
      .limit(40)
      .toArray();
    const seen = new Set<string>();
    const results: PaletteSearchResult[] = [];
    for (const message of matchingMessages) {
      if (seen.has(message.chatId)) continue;
      const chat = chats.find((item) => item.id === message.chatId);
      if (!chat) continue;
      seen.add(message.chatId);
      const excerpt = message.content.replace(/\s+/g, ' ').trim();
      results.push({
        id: chat.id,
        title: chat.title,
        description: `${message.role === 'user' ? 'You' : 'Esperto'}: ${excerpt.slice(0, 110)}${excerpt.length > 110 ? '…' : ''}`,
        onSelect: () => setActiveChatId(chat.id),
      });
      if (results.length >= 8) break;
    }
    return results;
  }, [chats]);

  const paletteCommands: PaletteCommand[] = [
    {
      id: 'new-chat', title: 'Create new session', description: 'Start a clean conversation.', group: 'Navigation',
      keywords: ['new', 'chat', 'conversation', 'session'], icon: <MessageSquare size={15} />, shortcut: 'Ctrl N',
      onSelect: createNewChat,
    },
    {
      id: 'open-settings', title: 'Open settings', description: 'Configure providers, models, local AI, and preferences.', group: 'Navigation',
      keywords: ['preferences', 'configuration'], icon: <Sliders size={15} />, shortcut: 'Ctrl ,',
      onSelect: () => setIsSettingsOpen(true),
    },
    {
      id: 'toggle-sidebar', title: 'Toggle sidebar', description: 'Show or hide the conversation sidebar.', group: 'Navigation',
      keywords: ['panel', 'history'], icon: <PanelLeft size={15} />, shortcut: 'Ctrl B',
      onSelect: () => setIsSidebarOpen((value) => !value),
    },
    {
      id: 'run-settings', title: 'Open run settings', description: 'Adjust parameters for the current conversation.', group: 'Navigation',
      keywords: ['temperature', 'context', 'generation'], icon: <Settings2 size={15} />, shortcut: 'Ctrl I',
      onSelect: () => setIsRunSettingsOpen(true),
    },
    {
      id: 'workspace-panel', title: 'Manage workspace', description: 'Open linked folders and saved workspace presets.', group: 'Workspace',
      keywords: ['project', 'folder', 'repository'], icon: <Folder size={15} />,
      onSelect: () => setShowDirectoryDrawer(true),
    },
    {
      id: 'workspace-add', title: 'Add project folder', description: 'Choose a folder to make its files available to the agent.', group: 'Workspace',
      keywords: ['open folder', 'link project'], icon: <FolderPlus size={15} />,
      onSelect: async () => { setShowDirectoryDrawer(true); await handleBrowseFolder(); },
    },
    {
      id: 'workspace-save-preset', title: 'Save current workspace as preset', description: 'Store the linked folders for reuse in other sessions.', group: 'Workspace',
      keywords: ['bookmark', 'preset'], icon: <BookmarkPlus size={15} />, disabled: directoryPaths.length === 0,
      onSelect: () => { setShowDirectoryDrawer(true); setIsCreatingPreset(true); },
    },
    {
      id: 'agent-explain', title: 'Agent: Explain this project', description: 'Inspect the workspace and summarize its architecture.', group: 'Agent commands',
      keywords: ['architecture', 'understand', 'explain'], icon: <FileSearch size={15} />, disabled: isLoading,
      onSelect: () => handleSendMessage('Inspect the linked workspace. Explain its architecture, main entry points, important modules, dependencies, and how the application runs. Do not modify files.', messages),
    },
    {
      id: 'agent-review', title: 'Agent: Review code quality', description: 'Find concrete bugs, security risks, and maintainability issues.', group: 'Agent commands',
      keywords: ['review', 'security', 'quality'], icon: <Bug size={15} />, disabled: isLoading,
      onSelect: () => handleSendMessage('Perform a focused code review of the linked workspace. Prioritize concrete bugs, security risks, data-loss risks, performance problems, and maintainability issues. Report findings by severity with file paths and line references. Do not modify files.', messages),
    },
    {
      id: 'agent-performance', title: 'Agent: Investigate performance', description: 'Identify bottlenecks and propose measurable improvements.', group: 'Agent commands',
      keywords: ['optimize', 'slow', 'performance'], icon: <Gauge size={15} />, disabled: isLoading,
      onSelect: () => handleSendMessage('Analyze the linked project for performance bottlenecks. Trace the most important issues to specific files and code paths, explain their impact, and propose prioritized improvements. Do not modify files.', messages),
    },
    {
      id: 'agent-tests', title: 'Agent: Plan automated tests', description: 'Identify critical behavior and propose a test strategy.', group: 'Agent commands',
      keywords: ['testing', 'unit tests', 'integration'], icon: <Zap size={15} />, disabled: isLoading,
      onSelect: () => handleSendMessage('Inspect the linked project and propose a practical automated testing strategy. Identify existing test infrastructure, critical modules, missing coverage, and the first tests worth implementing. Do not modify files.', messages),
    },
    {
      id: 'check-updates', title: 'Check for Esperto updates', description: 'Look for a newer application release.', group: 'Application',
      keywords: ['version', 'update'], icon: <RefreshCw size={15} />,
      onSelect: () => handleCheckUpdate(true),
    },
    ...chats.slice(0, 8).map((chat): PaletteCommand => ({
      id: `chat-${chat.id}`, title: chat.title, description: 'Open recent conversation', group: 'Recent conversations',
      keywords: ['history', 'session', 'chat'], icon: <MessageSquare size={15} />,
      onSelect: () => setActiveChatId(chat.id),
    })),
    ...paletteModels.map((model): PaletteCommand => ({
      id: `model-${model.id}`, title: `Use model: ${model.name}`,
      description: `${model.isLocal ? 'Local model' : model.provider} · ${model.id}`,
      group: 'Switch model', keywords: ['model', 'provider', model.provider, model.id],
      icon: model.isLocal ? <Cpu size={15} /> : <Code2 size={15} />,
      onSelect: () => handlePaletteModelSelect(model.id),
    })),
    ...presets.map((preset): PaletteCommand => ({
      id: `preset-${preset.id}`, title: `Open workspace: ${preset.name}`,
      description: `${preset.paths.length} linked folder(s)`, group: 'Workspace presets',
      keywords: ['workspace', 'project', 'preset'], icon: <Folder size={15} />,
      onSelect: () => { handleApplyPreset(preset); setShowDirectoryDrawer(true); },
    })),
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090b10]">
      {/* Sidebar Colapsável */}
      {isSidebarOpen && (
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={setActiveChatId}
          onNewChat={createNewChat}
          onDuplicateChat={async (id) => {
            const s = await db.chats.get(id);
            if (!s) return;
            const nId = crypto.randomUUID();
            const nChat: Chat = {
              ...s,
              id: nId,
              title: `${s.title} (fork)`,
              createdAt: Date.now(),
            };
            await db.chats.add(nChat);
            setChats((prev) => [nChat, ...prev]);
            setActiveChatId(nId);
          }}
          onRenameChat={async (id, title) => {
            await db.chats.update(id, { title });
            setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
          }}
          onDeleteChat={async (id, e) => {
            e.stopPropagation();
            await db.chats.delete(id);
            await db.messages.where('chatId').equals(id).delete();
            const updated = chats.filter((c) => c.id !== id);
            setChats(updated);
            if (activeChatId === id) {
              if (updated.length > 0) setActiveChatId(updated[0].id);
              else createNewChat();
            }
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHelp={() => setIsHelpOpen(true)}
          onCheckUpdate={() => handleCheckUpdate(true)}
        />
      )}

      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#090b10]">
        <header
          data-tauri-drag-region
          className="h-13 border-b border-[#161a25] flex items-center justify-between px-3.5 bg-[#0a0d13] select-none"
        >
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? 'Ocultar Painel Lateral (Ctrl+B)' : 'Mostrar Painel Lateral (Ctrl+B)'}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#151923] transition cursor-pointer"
            >
              {isSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="h-8 px-2.5 rounded bg-[#131722] hover:bg-[#1a202f] border border-[#232a3d] text-xs font-mono flex items-center gap-2 transition text-zinc-200 cursor-pointer"
            >
              <div
                className={`w-2 h-2 rounded-full ${modelInfo.isLocal ? 'bg-emerald-400' : 'bg-indigo-400'
                  }`}
              />
              <span className="font-medium truncate max-w-40">{modelInfo.name}</span>
              <span className="text-[10px] text-zinc-500 uppercase">
                {isChatModelOverridden ? 'chat' : 'global'}
              </span>
              <ChevronDown size={11} className="text-zinc-500" />
            </button>

            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              title="Open Command Palette (Ctrl + Shift + P)"
              className="flex h-8 items-center gap-1.5 rounded border border-[#1d2332] bg-[#10131b] px-2 text-[10px] text-zinc-400 transition hover:border-indigo-500/40 hover:text-zinc-200"
            >
              <CommandIcon size={13} />
              <span className="hidden xl:inline">COMMANDS</span>
              <kbd className="hidden 2xl:inline rounded border border-[#30394a] px-1 py-0.5 text-[9px]">Ctrl Shift P</kbd>
            </button>

            <div
              title={`Contexto: ${totalEstimatedTokens.toLocaleString()} de ${(modelInfo.contextLimit / 1000).toFixed(0)}k`}
              className="hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded bg-[#10131b] border border-[#1d2332] text-[11px] font-mono text-zinc-400"
            >
              <span className="text-zinc-500">CTX</span>
              <span className="text-zinc-200">
                {totalEstimatedTokens > 1000 ? `${(totalEstimatedTokens / 1000).toFixed(1)}k` : totalEstimatedTokens}
              </span>
              <span className="text-zinc-600">/</span>
              <span className="font-bold text-emerald-400">
                {currentRunSettings.contextLength ? `${currentRunSettings.contextLength / 1024}k` : '8k'}
              </span>
            </div>

            {isLoading && (
              <div className="flex items-center gap-1.5 h-8 px-2.5 rounded bg-[#121824] border border-indigo-900/40 text-[11px] font-mono text-indigo-300 animate-pulse">
                <Timer size={11} />
                <span>{elapsedTime.toFixed(1)}s</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleMemory}
              title={useMemory ? 'Memória Global Ativa' : 'Memória Desativada'}
              className={`h-8 px-2.5 rounded text-xs font-mono transition flex items-center gap-1.5 border cursor-pointer ${useMemory
                  ? 'bg-[#141a27] text-zinc-200 border-[#26334f]'
                  : 'bg-[#0d1017] text-zinc-500 border-[#1a202c] hover:text-zinc-400'
                }`}
            >
              <Brain size={12} className={useMemory ? 'text-indigo-400' : ''} />
              <span>{useMemory ? 'MEM_ON' : 'MEM_OFF'}</span>
            </button>

            <button
              onClick={() => setShowDirectoryDrawer(!showDirectoryDrawer)}
              className={`h-8 px-2.5 rounded text-xs font-mono transition flex items-center gap-1.5 border cursor-pointer ${directoryPaths.length > 0
                  ? 'bg-[#111e19] text-emerald-300 border-[#1f3d30]'
                  : 'bg-[#0d1017] text-zinc-500 border-[#1a202c] hover:text-zinc-300'
                }`}
              title="Vincular Workspace de Código"
            >
              {directoryPaths.length > 0 ? (
                <FolderCheck size={12} className="text-emerald-400" />
              ) : (
                <Folder size={12} />
              )}
              <span>
                {directoryPaths.length > 0
                  ? `${directoryPaths.length} PASTAS (${allLoadedFiles.length})`
                  : 'WORKSPACE'}
              </span>
            </button>

            <button
              onClick={() => setIsRunSettingsOpen(!isRunSettingsOpen)}
              title="Abrir Gaveta de Configurações da Sessão (Ctrl+I)"
              className={`h-8 px-2.5 rounded text-xs font-mono transition flex items-center gap-1.5 border cursor-pointer ${isRunSettingsOpen
                  ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/50'
                  : 'bg-[#0d1017] text-zinc-400 border-[#1a202c] hover:text-white'
                }`}
            >
              <Settings2 size={13} className={isRunSettingsOpen ? 'text-indigo-400' : ''} />
              <span>RUN SETTINGS</span>
            </button>
          </div>
        </header>

        {showDirectoryDrawer && (
          <div className="p-4 bg-[#0d1018] border-b border-[#1a2130] transition space-y-3 font-sans">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Layers size={13} className="text-indigo-400" />
                <span>Workspaces do Desenvolvedor</span>
              </span>

              <button
                onClick={() => setIsCreatingPreset(!isCreatingPreset)}
                disabled={directoryPaths.length === 0}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40 flex items-center gap-1 font-mono transition cursor-pointer"
              >
                <BookmarkPlus size={12} />
                <span>Salvar preset</span>
              </button>
            </div>

            {isCreatingPreset && (
              <div className="flex gap-2 p-2 bg-[#080a0f] border border-[#212a3d] rounded-lg">
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Nome do Workspace (ex: API Backend, Frontend Vite)"
                  className="flex-1 bg-[#10141d] border border-[#202738] rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                />
                <button
                  onClick={handleSaveAsPreset}
                  disabled={!newPresetName.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1 rounded transition cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            )}

            {presets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset)}
                    className="px-2.5 py-1 rounded bg-[#131722] hover:bg-[#1a202f] border border-[#202738] text-xs font-mono text-zinc-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{preset.name}</span>
                    <span className="text-[10px] text-zinc-500">({preset.paths.length})</span>
                    <button
                      onClick={(e) => handleDeletePreset(preset.id, e)}
                      className="text-zinc-600 hover:text-rose-400 transition"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {directoryPaths.length > 0 && (
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {directoryPaths.map((path, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-[#080a0f] border border-[#1b2230] px-2.5 py-1 rounded text-xs text-zinc-300 font-mono"
                  >
                    <span className="truncate flex-1 mr-2">{path}</span>
                    <button
                      onClick={() => handleRemoveDirectory(path)}
                      className="text-zinc-600 hover:text-rose-400 transition p-0.5"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleBrowseFolder}
                className="bg-[#141824] hover:bg-[#1c2233] border border-[#263047] text-zinc-300 text-xs px-3 py-1.5 rounded transition flex items-center gap-1.5 cursor-pointer font-mono"
              >
                <FolderSearch size={13} className="text-zinc-400" />
                <span>Explorar Pasta</span>
              </button>

              <input
                type="text"
                value={newDirPath}
                onChange={(e) => setNewDirPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDirectory()}
                placeholder="Caminho absoluto da pasta do projeto..."
                className="flex-1 bg-[#080a0f] border border-[#1e2535] rounded px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
              />
              <button
                onClick={handleAddDirectory}
                disabled={!newDirPath.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded transition cursor-pointer"
              >
                <Plus size={13} />
              </button>
              <button
                onClick={() => syncDirectories(directoryPaths)}
                disabled={loadingDirectories || directoryPaths.length === 0}
                className="bg-[#141824] hover:bg-[#1c2233] text-zinc-300 border border-[#263047] text-xs px-3 py-1.5 rounded transition cursor-pointer"
              >
                <FolderSync size={13} className={loadingDirectories ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          <div
            ref={chatContainerRef}
            onScroll={handleScrollContainer}
            className="flex-1 overflow-y-auto"
          >
            {messages.length === 0 ? (
              <WelcomePanel
                modelName={modelInfo.name}
                isLocalModel={Boolean(modelInfo.isLocal)}
                hasWorkspace={directoryPaths.length > 0}
                onPrompt={(prompt) => handleSendMessage(prompt, messages)}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            ) : (
              messages.map((msg, index) => (
                <ChatMessage
                  key={index}
                  role={msg.role}
                  content={msg.content}
                  attachments={msg.attachments}
                  baseDirectories={directoryPaths}
                  requireConfirmation={settings.requireActionConfirmation !== false}
                  onEdit={msg.role === 'user' ? (newText) => handleEditMessage(index, newText) : undefined}
                  onRetry={msg.role === 'model' && index === messages.length - 1 ? handleRetryLastMessage : undefined}
                  onOpenArtifact={(code, lang) => setActiveArtifact({ code, language: lang })}
                  onFileWritten={() => syncDirectories(directoryPaths)}
                  onRequestSelectFolder={handleBrowseFolder}
                />
              ))
            )}

            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="px-6 py-4 border-b border-[#131722] bg-[#090c12]">
                <div className="max-w-4xl mx-auto flex gap-3.5 items-center">
                  <span className="font-mono text-[11px] font-semibold tracking-wider text-indigo-400 uppercase w-16 shrink-0">
                    Esperto
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                    <span>inferindo tokens...</span>
                    <span className="text-zinc-600">({elapsedTime.toFixed(1)}s)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* GAVETA LATERAL DIREITA DE PARÂMETROS */}
          <RunSettingsDrawer
            isOpen={isRunSettingsOpen}
            onClose={() => setIsRunSettingsOpen(false)}
            modelId={activeModelId}
            runSettings={currentRunSettings}
            systemInstruction={systemInstruction}
            onUpdateRunSettings={handleUpdateRunSettings}
            onUpdateSystemInstruction={handleUpdateSystemInstruction}
            onResetToDefaults={() => {
              handleUpdateRunSettings({
                temperature: 0.7,
                topP: 0.9,
                thinkingLevel: 'off',
                googleSearch: false,
                contextLength: 4096,
                mediaResolution: 'default',
              });
            }}
          />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-[#0a0d14] border-t border-[#161a25]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="max-w-4xl mx-auto flex flex-col gap-1.5"
          >
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-1.5 bg-[#0f131c] rounded border border-[#202738]">
                {attachments.map((att, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1.5 bg-[#07090e] border border-[#212839] px-2 py-0.5 rounded text-xs text-zinc-300 font-mono"
                  >
                    {att.mimeType.startsWith('image/') ? (
                      <ImageIcon size={11} className="text-zinc-400" />
                    ) : (
                      <FileText size={11} className="text-zinc-400" />
                    )}
                    <span className="truncate max-w-36 text-[11px]">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="hover:text-rose-400 transition ml-0.5"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[#0e121a] border border-[#202738] focus-within:border-indigo-500/50 rounded-lg p-2.5 transition shadow-xs flex flex-col gap-1.5">
              <input type="file" ref={fileInputRef} onChange={handleFileInput} multiple className="hidden" />

              <textarea
                ref={textareaRef}
                rows={3}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Instrua o agente ou consulte os arquivos... (Enter para enviar, Shift+Enter para nova linha)"
                className="w-full bg-transparent px-1 pt-0.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none resize-y min-h-14 max-h-72 leading-relaxed font-mono"
              />

              <div className="flex items-center justify-between pt-1 border-t border-[#191f2c] select-none text-zinc-500 text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Anexar arquivo"
                    className="p-1 hover:bg-[#181d2a] text-zinc-400 hover:text-zinc-200 rounded transition"
                  >
                    <Paperclip size={14} />
                  </button>
                  <span>↵ enviar</span>
                  <span>⇧↵ nova linha</span>
                </div>

                <div className="flex items-center gap-2">
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40 px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer text-xs font-mono font-medium"
                    >
                      <Square size={10} fill="currentColor" />
                      <span>parar</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!inputMessage.trim() && attachments.length === 0}
                      className="bg-zinc-200 hover:bg-white text-zinc-900 font-semibold px-3 py-1 rounded transition flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:hover:bg-zinc-200 text-xs font-mono"
                      title="Enviar (Enter)"
                    >
                      <span>enviar</span>
                      <Send size={11} className="ml-1" />
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
        onClose={() => { localStorage.setItem('esperto-local-ai-setup-seen', '1'); setIsSettingsOpen(false); }}
        settings={settings}
        onSave={handleSaveSettings}
        onErrorTrigger={(err) => setActiveError(err)}
      />

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <UpdateModal
        isOpen={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
        checking={isCheckingUpdate}
        release={latestRelease}
        onCheckAgain={() => handleCheckUpdate(true)}
        onErrorTrigger={(err) => setActiveError(err)}
      />

      <ArtifactPreview
        isOpen={activeArtifact !== null}
        onClose={() => setActiveArtifact(null)}
        code={activeArtifact?.code || ''}
        language={activeArtifact?.language || ''}
      />

      <ErrorModal isOpen={activeError !== null} onClose={() => setActiveError(null)} errorInfo={activeError} />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        commands={paletteCommands}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSearchConversations={handlePaletteSearchConversations}
      />
    </div>
  );
}