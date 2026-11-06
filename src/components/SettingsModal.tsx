import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Cpu,
  Key,
  BookOpen,
  Server,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  Globe,
  BrainCircuit,
  Image,
  ShieldCheck,
  Download,
  FolderDown,
  Sparkles,
} from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import { Settings, CustomProviderConfig, db } from '../lib/db';
import {
  getInstalledOllamaModels,
  startOllama,
  checkOllamaRunning,
  pullOllamaModel,
  selectGgufFile,
  importGgufToOllama,
} from '../services/ollama';
import { registerLocalOllamaModels, registerCustomProviderModels } from '../lib/models';
import { inspectProvider } from '../services/providerManager';
import { OllamaGuideModal } from './OllamaGuideModal';
import { AppErrorInfo } from './ErrorModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onErrorTrigger: (error: AppErrorInfo) => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  settings: initialSettings,
  onSave,
  onErrorTrigger,
}) => {
  const [form, setForm] = useState<Settings>(initialSettings);
  const [activeTab, setActiveTab] = useState<'models' | 'ollama' | 'params' | 'keys' | 'memory'>('models');
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [startingOllama, setStartingOllama] = useState(false);
  const [isOllamaGuideOpen, setIsOllamaGuideOpen] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<Record<string, { ok: boolean; latency: number; error?: string }>>({});

  // Hub Local Sem Censura
  const [pullModelTag, setPullModelTag] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullStatus, setPullStatus] = useState('');
  const [ggufModelName, setGgufModelName] = useState('');
  const [selectedGgufPath, setSelectedGgufPath] = useState('');
  const [isImportingGguf, setIsImportingGguf] = useState(false);

  useEffect(() => {
    setForm(initialSettings);
  }, [initialSettings, isOpen]);

  useEffect(() => {
    if (isOpen) {
      checkOllamaStatusQuick();
    }
  }, [isOpen]);

  const checkOllamaStatusQuick = async () => {
    setCheckingOllama(true);
    const online = await checkOllamaRunning(form.ollamaHost);
    setOllamaOnline(online);
    if (online) {
      const res = await getInstalledOllamaModels(form.ollamaHost, form.ollamaCustomPath);
      if (res.models.length > 0) {
        registerLocalOllamaModels(res.models);
      }
    }
    setCheckingOllama(false);
  };

  const handleStartOllama = async () => {
    setStartingOllama(true);
    try {
      await startOllama(form.ollamaCustomPath, form.ollamaHost);
      await checkOllamaStatusQuick();
    } catch (err: any) {
      onErrorTrigger({
        title: 'Falha ao Iniciar o Ollama',
        context: 'Processo do Sistema Operacional',
        message: err?.toString() || 'Não foi possível disparar o executável do Ollama.',
      });
    } finally {
      setStartingOllama(false);
    }
  };

  const handlePullModel = async (tagToPull?: string) => {
    const targetTag = tagToPull || pullModelTag;
    if (!targetTag.trim()) return;

    setIsPulling(true);
    setPullProgress(0);
    setPullStatus('Iniciando conexão com o Ollama...');

    try {
      await pullOllamaModel(
        targetTag,
        form.ollamaHost,
        form.ollamaCustomPath,
        (percent, status) => {
          setPullProgress(percent);
          setPullStatus(status);
        }
      );
      setPullStatus('Modelo pronto no PC!');
      setPullModelTag('');
      await checkOllamaStatusQuick();
      setTimeout(() => {
        setIsPulling(false);
        setPullStatus('');
      }, 2500);
    } catch (err: any) {
      setIsPulling(false);
      onErrorTrigger({
        title: 'Falha ao Baixar Modelo',
        context: `Tag: ${targetTag}`,
        message: err?.message || err?.toString() || 'Erro durante o download.',
      });
    }
  };

  const handleSelectGguf = async () => {
    try {
      const path = await selectGgufFile();
      if (path) {
        setSelectedGgufPath(path);
        const fileName = path.split(/[/\\]/).pop()?.replace('.gguf', '') || 'modelo-local';
        setGgufModelName(fileName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
      }
    } catch (err: any) {
      onErrorTrigger({
        title: 'Erro ao Selecionar Arquivo',
        context: 'Seletor Nativo GGUF',
        message: err?.toString() || 'Não foi possível selecionar o arquivo.',
      });
    }
  };

  const handleImportGguf = async () => {
    if (!selectedGgufPath || !ggufModelName.trim()) return;
    setIsImportingGguf(true);
    try {
      await importGgufToOllama(ggufModelName.trim(), selectedGgufPath);
      setSelectedGgufPath('');
      setGgufModelName('');
      await checkOllamaStatusQuick();
      alert(`Modelo '${ggufModelName}' importado com sucesso! Já está disponível na lista.`);
    } catch (err: any) {
      onErrorTrigger({
        title: 'Falha ao Importar GGUF',
        context: selectedGgufPath,
        message: err?.toString() || 'Não foi possível registrar o modelo no Ollama.',
      });
    } finally {
      setIsImportingGguf(false);
    }
  };

  const addCustomProvider = () => {
    const newProv: CustomProviderConfig = {
      id: crypto.randomUUID(),
      name: 'Novo Servidor',
      baseUrl: 'http://localhost:1234/v1',
      apiKey: '',
      protocol: 'openai-compatible',
      models: [],
      enabled: true,
    };
    setForm((prev) => ({
      ...prev,
      customProviders: [...(prev.customProviders || []), newProv],
    }));
  };

  const updateCustomProvider = (id: string, patch: Partial<CustomProviderConfig>) => {
    setForm((prev) => ({
      ...prev,
      customProviders: (prev.customProviders || []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const removeCustomProvider = (id: string) => {
    setForm((prev) => ({
      ...prev,
      customProviders: (prev.customProviders || []).filter((p) => p.id !== id),
    }));
  };

  const handleTestProvider = async (provider: CustomProviderConfig) => {
    setTestingProviderId(provider.id);
    const result = await inspectProvider(provider);
    setProviderStatuses((prev) => ({
      ...prev,
      [provider.id]: { ok: result.ok, latency: result.latencyMs, error: result.error },
    }));

    if (result.ok && result.models.length > 0) {
      updateCustomProvider(provider.id, { models: result.models });
    }
    setTestingProviderId(null);
  };

  const handleSaveAndClose = () => {
    registerCustomProviderModels(form.customProviders || []);
    onSave(form);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-surface border border-purple-900/40 rounded-3xl w-full max-w-4xl p-6 relative shadow-2xl shadow-purple-950/80 max-h-[92vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-surfaceHover transition cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-purple-950/40">
          <div className="p-2 rounded-xl bg-purple-900/40 text-purple-300 border border-purple-500/30">
            <Sliders size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">Configurações do Esperto</h2>
            <p className="text-xs text-purple-300/60">Controle de modelos locais, sem censura, servidores e privacidade.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4 border-b border-purple-950/30 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('models')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'models' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Server size={13} />
            <span>Modelos & Provedores</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ollama')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ollama' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Cpu size={13} className="text-emerald-400" />
            <span>Ollama & Hub Local</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'params' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sliders size={13} />
            <span>Parâmetros</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('keys')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'keys' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Key size={13} />
            <span>Chaves de Nuvem</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('memory')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'memory' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50' : 'text-gray-400 hover:text-white'
            }`}
          >
            <BookOpen size={13} />
            <span>Memória & Armazenamento</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {activeTab === 'models' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-purple-200 mb-1.5 block">
                  Modelo Padrão Ativo (aplicado a novas conversas):
                </label>
                <ModelSelector
                  selectedModel={form.model || 'gemini-3.7-flash'}
                  onSelect={(id) => setForm((prev) => ({ ...prev, model: id }))}
                  customHost={form.ollamaHost}
                  customPath={form.ollamaCustomPath}
                />
              </div>

              <div className="pt-3 border-t border-purple-950/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Server size={14} className="text-purple-400" />
                      <span>Servidores OpenAI-Compatible (LM Studio / vLLM / llama.cpp)</span>
                    </span>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Conecte instâncias locais em qualquer porta com zero censura.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addCustomProvider}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Adicionar Servidor</span>
                  </button>
                </div>

                {(!form.customProviders || form.customProviders.length === 0) ? (
                  <p className="text-xs text-gray-500 bg-background/50 p-3 rounded-xl border border-purple-900/20">
                    Nenhum servidor customizado adicionado.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {form.customProviders.map((prov) => {
                      const status = providerStatuses[prov.id];
                      return (
                        <div key={prov.id} className="p-3.5 bg-background/70 border border-purple-900/30 rounded-2xl space-y-2.5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={prov.name}
                              onChange={(e) => updateCustomProvider(prov.id, { name: e.target.value })}
                              placeholder="Nome do Servidor (ex: LM Studio)"
                              className="bg-surface border border-purple-900/40 rounded-xl px-2.5 py-1.5 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={prov.baseUrl}
                              onChange={(e) => updateCustomProvider(prov.id, { baseUrl: e.target.value })}
                              placeholder="URL Base (ex: http://localhost:1234/v1)"
                              className="bg-surface border border-purple-900/40 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                            />
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={prov.apiKey || ''}
                              onChange={(e) => updateCustomProvider(prov.id, { apiKey: e.target.value })}
                              placeholder="API Key (opcional se for local)"
                              className="flex-1 bg-surface border border-purple-900/40 rounded-xl px-2.5 py-1.5 text-xs text-white"
                            />

                            <button
                              type="button"
                              onClick={() => handleTestProvider(prov)}
                              disabled={testingProviderId === prov.id}
                              className="bg-surface hover:bg-surfaceHover text-purple-300 border border-purple-900/40 text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw size={12} className={testingProviderId === prov.id ? 'animate-spin' : ''} />
                              <span>Testar & Sincronizar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => removeCustomProvider(prov.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 transition rounded-lg"
                              title="Remover servidor"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {status && (
                            <div className={`p-2 rounded-xl text-[11px] font-mono flex items-center justify-between ${
                              status.ok ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/40' : 'bg-red-950/40 text-red-300 border border-red-900/40'
                            }`}>
                              <span>{status.ok ? `Conectado com sucesso (${status.latency}ms)` : `Erro: ${status.error}`}</span>
                              <span>{prov.models.length} modelos encontrados</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'ollama' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300">Motor Ollama Local (GPU)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOllamaGuideOpen(true)}
                      className="text-xs text-purple-300 hover:text-white flex items-center gap-1 p-1"
                    >
                      <HelpCircle size={14} />
                      <span>Guia e Dicas</span>
                    </button>

                    <button
                      type="button"
                      onClick={checkOllamaStatusQuick}
                      disabled={checkingOllama}
                      className="bg-emerald-950/80 text-emerald-300 hover:text-white border border-emerald-800/40 text-xs px-2.5 py-1 rounded-xl transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={checkingOllama ? 'animate-spin' : ''} />
                      <span>Verificar Status</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-background/60 p-3 rounded-xl border border-emerald-950/40 text-xs">
                  <div className="flex items-center gap-2">
                    {ollamaOnline ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} className="text-amber-400" />}
                    <span className="font-semibold text-gray-200">
                      {ollamaOnline ? 'Servidor Ollama Online e Ativo' : 'Servidor Offline'}
                    </span>
                  </div>

                  {!ollamaOnline && (
                    <button
                      type="button"
                      onClick={handleStartOllama}
                      disabled={startingOllama}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1 rounded-lg text-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Play size={12} fill="currentColor" />
                      <span>{startingOllama ? 'Iniciando...' : 'Iniciar Serviço'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* BAIXAR DIRETO DO HUGGING FACE OU OLLAMA */}
              <div className="p-4 bg-background/50 border border-purple-900/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                    <Download size={14} className="text-purple-400" />
                    <span>Baixar Modelo Sem Censura (Hugging Face / Ollama)</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">Suporta hf.co/...</span>
                </div>

                <p className="text-[11px] text-gray-400">
                  Cole o identificador ou URL do Hugging Face (ex: <code>hf.co/OBLITERATUS/DeepSeek-V4.1-Flash-1017-obliterated</code>) ou tag do Ollama:
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pullModelTag}
                    onChange={(e) => setPullModelTag(e.target.value)}
                    placeholder="ex: hf.co/OBLITERATUS/DeepSeek-V4.1-Flash-1017-obliterated"
                    className="flex-1 bg-surface border border-purple-900/40 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => handlePullModel()}
                    disabled={isPulling || !pullModelTag.trim()}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Download size={14} />
                    <span>{isPulling ? 'Baixando...' : 'Baixar Agora'}</span>
                  </button>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] text-gray-400 font-bold block mb-1.5 uppercase tracking-wider">
                    Instalar Modelos Sem Censura / Livres com 1 Clique:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isPulling}
                      onClick={() => handlePullModel('dolphin-mistral:latest')}
                      className="px-2.5 py-1 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-800/40 text-purple-200 text-xs rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles size={11} className="text-purple-400" />
                      <span>Dolphin Mistral (Zero Censura)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isPulling}
                      onClick={() => handlePullModel('qwen2.5-coder:7b')}
                      className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/40 text-emerald-200 text-xs rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Cpu size={11} className="text-emerald-400" />
                      <span>Qwen 2.5 Coder 7B (Especialista Código)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isPulling}
                      onClick={() => handlePullModel('deepseek-r1:7b')}
                      className="px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/40 text-cyan-200 text-xs rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <BrainCircuit size={11} className="text-cyan-400" />
                      <span>DeepSeek R1 7B (Raciocínio Local)</span>
                    </button>
                  </div>
                </div>

                {isPulling && (
                  <div className="p-3 bg-black/60 rounded-xl border border-purple-900/40 space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between text-purple-300 text-[11px]">
                      <span>{pullStatus}</span>
                      <span>{pullProgress}%</span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-2 overflow-hidden border border-purple-900/30">
                      <div
                        className="bg-linear-to-r from-purple-500 to-emerald-400 h-full transition-all duration-300"
                        style={{ width: `${pullProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* IMPORTAR ARQUIVO .GGUF JÁ BAIXADO NO COMPUTADOR */}
              <div className="p-4 bg-background/50 border border-purple-900/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <FolderDown size={14} className="text-emerald-400" />
                    <span>Importar Arquivo .GGUF do Computador</span>
                  </span>
                  <span className="text-[10px] text-gray-400">Para modelos que você já baixou</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectGguf}
                    className="bg-surface hover:bg-surfaceHover border border-emerald-900/40 text-emerald-200 text-xs px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <FolderDown size={14} />
                    <span>Procurar arquivo .GGUF</span>
                  </button>

                  <input
                    type="text"
                    value={selectedGgufPath}
                    readOnly
                    placeholder="Nenhum arquivo .gguf selecionado..."
                    className="flex-1 bg-surface border border-emerald-900/30 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono truncate"
                  />
                </div>

                {selectedGgufPath && (
                  <div className="flex gap-2 pt-1 items-center">
                    <span className="text-xs text-gray-300 font-mono shrink-0">Nome do Modelo:</span>
                    <input
                      type="text"
                      value={ggufModelName}
                      onChange={(e) => setGgufModelName(e.target.value)}
                      placeholder="meu-modelo-sem-censura"
                      className="flex-1 bg-surface border border-emerald-500/40 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleImportGguf}
                      disabled={isImportingGguf || !ggufModelName.trim()}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      {isImportingGguf ? 'Criando no Ollama...' : 'Concluir Importação'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'params' && (
            <div className="space-y-4">
              <div className="p-4 bg-background/50 border border-purple-900/30 rounded-2xl space-y-3">
                <div className="flex justify-between text-xs text-purple-300">
                  <span className="font-semibold">Temperatura (Criatividade vs Precisão):</span>
                  <span className="font-mono">{form.temperature ?? 0.7}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={form.temperature ?? 0.7}
                  onChange={(e) => setForm((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full accent-purple-500 cursor-pointer"
                />

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-medium text-purple-300 mb-1 flex items-center gap-1">
                      <BrainCircuit size={13} />
                      <span>Nível de Pensamento (Thinking)</span>
                    </label>
                    <select
                      value={form.thinkingLevel || 'off'}
                      onChange={(e) => setForm((prev) => ({ ...prev, thinkingLevel: e.target.value as any }))}
                      className="w-full bg-surface border border-purple-900/40 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="off">Desativado (Rápido)</option>
                      <option value="low">Baixo (1k tokens)</option>
                      <option value="medium">Médio (2k tokens)</option>
                      <option value="high">Alto (8k tokens)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-purple-300 mb-1 flex items-center gap-1">
                      <Image size={13} />
                      <span>Resolução de Mídia (Imagens)</span>
                    </label>
                    <select
                      value={form.mediaResolution || 'default'}
                      onChange={(e) => setForm((prev) => ({ ...prev, mediaResolution: e.target.value as any }))}
                      className="w-full bg-surface border border-purple-900/40 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="default">Padrão</option>
                      <option value="low">Econômico (Baixo Consumo)</option>
                      <option value="high">Alto Detalhe</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between bg-surface/40 p-3 rounded-xl border border-purple-950/30">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-purple-400" />
                    <div>
                      <span className="text-xs font-semibold text-white block">Confirmar Ações do Agente</span>
                      <span className="text-[10px] text-gray-400">Pede confirmação antes de gravar no disco ou rodar shell.</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.requireActionConfirmation !== false}
                    onChange={(e) => setForm((prev) => ({ ...prev, requireActionConfirmation: e.target.checked }))}
                    className="accent-purple-500 w-4 h-4 cursor-pointer"
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, googleSearch: !prev.googleSearch }))}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
                      form.googleSearch
                        ? 'bg-purple-950/80 text-purple-300 border-purple-500/50'
                        : 'bg-surface text-gray-500 border-purple-900/30 hover:text-gray-300'
                    }`}
                  >
                    <Globe size={13} />
                    <span>{form.googleSearch ? 'Busca Web Google: ATIVA' : 'Busca Web Google: DESATIVADA'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'keys' && (
            <div className="space-y-3">
              <div className="p-3 bg-violet-950/30 border border-violet-800/40 rounded-2xl">
                <label className="block text-xs font-bold text-violet-300 mb-1">
                  OpenRouter API Key (Hub Universal para centenas de modelos)
                </label>
                <input
                  type="password"
                  value={form.openrouterApiKey || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, openrouterApiKey: e.target.value }))}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-background border border-violet-900/50 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-background/50 border border-purple-900/30 rounded-2xl">
                  <label className="block text-xs font-bold text-blue-300 mb-1">Google Gemini API Key</label>
                  <input
                    type="password"
                    value={form.geminiApiKey || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, geminiApiKey: e.target.value }))}
                    placeholder="AIzaSy..."
                    className="w-full bg-surface border border-blue-900/40 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="p-3 bg-background/50 border border-purple-900/30 rounded-2xl">
                  <label className="block text-xs font-bold text-amber-300 mb-1">Anthropic Claude API Key</label>
                  <input
                    type="password"
                    value={form.anthropicApiKey || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, anthropicApiKey: e.target.value }))}
                    placeholder="sk-ant-..."
                    className="w-full bg-surface border border-amber-900/40 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="p-3 bg-background/50 border border-purple-900/30 rounded-2xl">
                  <label className="block text-xs font-bold text-emerald-300 mb-1">OpenAI API Key</label>
                  <input
                    type="password"
                    value={form.openaiApiKey || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, openaiApiKey: e.target.value }))}
                    placeholder="sk-proj-..."
                    className="w-full bg-surface border border-emerald-900/40 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="p-3 bg-background/50 border border-purple-900/30 rounded-2xl">
                  <label className="block text-xs font-bold text-cyan-300 mb-1">DeepSeek API Key</label>
                  <input
                    type="password"
                    value={form.deepseekApiKey || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, deepseekApiKey: e.target.value }))}
                    placeholder="sk-..."
                    className="w-full bg-surface border border-cyan-900/40 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="space-y-4">
              <div className="p-4 bg-background/50 border border-purple-900/30 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                    <BookOpen size={14} className="text-purple-400" />
                    <span>Memória Permanente do Desenvolvedor</span>
                  </span>
                  {form.globalMemory && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, globalMemory: '' }))}
                      className="text-gray-500 hover:text-red-400 p-1 transition"
                      title="Limpar memória"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <textarea
                  value={form.globalMemory || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, globalMemory: e.target.value }))}
                  placeholder="Instruções permanentes, stacks favoritas (ex: Rust, React, TypeScript), padrões arquiteturais..."
                  rows={6}
                  className="w-full bg-surface border border-purple-900/40 rounded-xl p-3 text-xs text-purple-100 placeholder-gray-600 focus:outline-none resize-none font-mono"
                />
              </div>

              <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-red-300 block">Limpeza Geral de Cache</span>
                  <span className="text-[11px] text-gray-400">Apaga todo o histórico de conversas e anexos salvos no IndexedDB.</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('Deseja limpar todos os chats antigos e histórico para liberar espaço no disco?')) {
                      await db.messages.clear();
                      await db.chats.clear();
                      alert('Cache limpo com sucesso!');
                      window.location.reload();
                    }
                  }}
                  className="bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/50 text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  Limpar Histórico
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 mt-3 border-t border-purple-950/40 flex items-center justify-between">
          <span className="text-[11px] text-gray-500 font-mono">Esperto IDE Desktop • 2026</span>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="bg-linear-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold px-7 py-2 rounded-xl transition text-xs shadow-md shadow-purple-950/50 cursor-pointer"
          >
            Salvar Alterações
          </button>
        </div>
      </div>

      <OllamaGuideModal isOpen={isOllamaGuideOpen} onClose={() => setIsOllamaGuideOpen(false)} />
    </div>
  );
};

export default SettingsModal;