import React, { useState, useEffect, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
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
  HardDrive,
  Maximize2,
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
  deleteOllamaModel,
  formatBytes,
  OllamaModelTag,
  diagnoseLocalAI, installOllama, searchHuggingFaceGGUF, listHuggingFaceGGUFFiles, downloadHuggingFaceGGUF,
  HuggingFaceModel, HuggingFaceFile, LocalAIDiagnostics,
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
  const [activeTab, setActiveTab] = useState<'models' | 'ollama' | 'params' | 'keys' | 'memory'>(() => localStorage.getItem('esperto-local-ai-setup-seen') ? 'models' : 'ollama');
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [startingOllama, setStartingOllama] = useState(false);
  const [isOllamaGuideOpen, setIsOllamaGuideOpen] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<Record<string, { ok: boolean; latency: number; error?: string }>>({});

  const [localModelsList, setLocalModelsList] = useState<OllamaModelTag[]>([]);
  const [pullModelTag, setPullModelTag] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullStatus, setPullStatus] = useState('');
  const [ggufModelName, setGgufModelName] = useState('');
  const [selectedGgufPath, setSelectedGgufPath] = useState('');
  const [isImportingGguf, setIsImportingGguf] = useState(false);
  const [appCacheSize, setAppCacheSize] = useState<string>('Calculando...');
  const [diagnostics, setDiagnostics] = useState<LocalAIDiagnostics | null>(null);
  const [installingOllama, setInstallingOllama] = useState(false);
  const [hfQuery, setHfQuery] = useState('Qwen 3B instruct');
  const [hfModels, setHfModels] = useState<HuggingFaceModel[]>([]);
  const [hfRepo, setHfRepo] = useState('');
  const [hfFiles, setHfFiles] = useState<HuggingFaceFile[]>([]);
  const [hfSelectedFile, setHfSelectedFile] = useState('');
  const [hfBusy, setHfBusy] = useState(false);
  const [hfProgress, setHfProgress] = useState(0);

  useEffect(() => {
    setForm(initialSettings);
  }, [initialSettings, isOpen]);

  useEffect(() => {
    if (isOpen) {
      checkOllamaStatusQuick();
      calculateAppStorage();
    }
  }, [isOpen]);

  const calculateAppStorage = async () => {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        setAppCacheSize(formatBytes(estimate.usage || 0));
      } else {
        setAppCacheSize('Disponível');
      }
    } catch {
      setAppCacheSize('Desconhecido');
    }
  };

  const totalOllamaStorageBytes = useMemo(() => {
    return localModelsList.reduce((acc, m) => acc + (m.size || 0), 0);
  }, [localModelsList]);

  const checkOllamaStatusQuick = async () => {
    setCheckingOllama(true);
    try { setDiagnostics(await diagnoseLocalAI()); } catch { setDiagnostics(null); }
    const online = await checkOllamaRunning(form.ollamaHost);
    setOllamaOnline(online);
    if (online) {
      const res = await getInstalledOllamaModels(form.ollamaHost, form.ollamaCustomPath);
      setLocalModelsList(res.models || []);
      if (res.models.length > 0) {
        registerLocalOllamaModels(res.models);
      }
    } else {
      setLocalModelsList([]);
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

  const handleInstallOllama = async () => {
    setInstallingOllama(true);
    try {
      await installOllama();
      await new Promise((resolve) => setTimeout(resolve, 1800));
      await startOllama(form.ollamaCustomPath, form.ollamaHost);
      await checkOllamaStatusQuick();
    } catch (err: any) {
      onErrorTrigger({ title: 'Não foi possível instalar o Ollama', context: 'Instalação local', message: err?.message || String(err) });
    } finally { setInstallingOllama(false); }
  };

  const handleSearchHF = async () => {
    setHfBusy(true); setHfModels([]); setHfFiles([]); setHfRepo('');
    try { setHfModels(await searchHuggingFaceGGUF(hfQuery)); }
    catch (err: any) { onErrorTrigger({ title: 'Busca no Hugging Face falhou', context: hfQuery, message: err?.message || String(err) }); }
    finally { setHfBusy(false); }
  };

  const handleSelectHFRepo = async (repo: string) => {
    setHfRepo(repo); setHfFiles([]); setHfSelectedFile(''); setHfBusy(true);
    try { setHfFiles(await listHuggingFaceGGUFFiles(repo)); }
    catch (err: any) { onErrorTrigger({ title: 'Não foi possível listar os arquivos GGUF', context: repo, message: err?.message || String(err) }); }
    finally { setHfBusy(false); }
  };

  const handleDownloadHF = async () => {
    if (!hfRepo || !hfSelectedFile) return;
    setHfBusy(true); setHfProgress(0);
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listen<{ downloaded: number; total: number }>('hf-download-progress', (event) => {
        const { downloaded, total } = event.payload;
        if (total > 0) setHfProgress(Math.min(100, Math.round(downloaded / total * 100)));
      });
      const path = await downloadHuggingFaceGGUF(hfRepo, hfSelectedFile);
      const base = hfRepo.split('/').pop() || 'hf-model';
      const fileBase = hfSelectedFile.split('/').pop()?.replace(/\.gguf$/i, '') || base;
      const modelName = `${base}-${fileBase}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64);
      await importGgufToOllama(modelName, path);
      await checkOllamaStatusQuick();
      alert(`Modelo ${modelName} baixado do Hugging Face e importado no Ollama.`);
    } catch (err: any) {
      onErrorTrigger({ title: 'Download/importação do Hugging Face falhou', context: `${hfRepo}/${hfSelectedFile}`, message: err?.message || String(err) });
    } finally { unlisten?.(); setHfBusy(false); }
  };

  const handlePullModel = async (tagToPull?: string) => {
    const rawTag = tagToPull || pullModelTag;
    if (!rawTag.trim()) return;

    let cleanTag = rawTag.trim();
    if (cleanTag.startsWith('https://huggingface.co/')) {
      cleanTag = cleanTag.replace('https://huggingface.co/', 'hf.co/');
    } else if (cleanTag.includes('/') && !cleanTag.startsWith('hf.co/')) {
      cleanTag = `hf.co/${cleanTag}`;
    }

    setIsPulling(true);
    setPullProgress(0);
    setPullStatus('Conectando ao repositório...');

    try {
      await pullOllamaModel(
        cleanTag,
        form.ollamaHost,
        form.ollamaCustomPath,
        (percent, status) => {
          setPullProgress(percent);
          setPullStatus(status);
        }
      );
      setPullStatus('Modelo pronto na GPU!');
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
        context: cleanTag,
        message: err?.message || err?.toString() || 'Erro durante o download.',
      });
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`Deseja realmente excluir o modelo '${modelName}' e liberar o espaço no disco?`)) {
      return;
    }

    try {
      await deleteOllamaModel(modelName, form.ollamaHost);
      await checkOllamaStatusQuick();
    } catch (err: any) {
      onErrorTrigger({
        title: 'Falha ao Excluir Modelo',
        context: modelName,
        message: err?.message || err?.toString() || 'Erro ao remover modelo do disco.',
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
      alert(`Modelo '${ggufModelName}' importado com sucesso! Já está disponível.`);
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
      <div className="bg-[#0e121a] border border-[#202738] rounded-2xl w-full max-w-4xl p-6 relative shadow-2xl max-h-[92vh] flex flex-col font-sans">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-[#181d2a] transition cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#1c2232]">
          <div className="p-2 rounded-lg bg-[#151924] text-zinc-300 border border-[#242b3d]">
            <Sliders size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 tracking-wide font-mono uppercase">
              Configurações do Ambiente
            </h2>
            <p className="text-xs text-zinc-500">Janela de contexto, GPU local e workspaces de código.</p>
          </div>
        </div>

        <div className="flex gap-1.5 mb-4 border-b border-[#1c2232] pb-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('models')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeTab === 'models' ? 'bg-[#181e2b] text-zinc-100 border border-[#2c364d]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Modelos & Servidores
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ollama')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ollama' ? 'bg-[#121f19] text-emerald-300 border border-[#1f3a2f]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Cpu size={13} className="text-emerald-400" />
            <span>Ollama & GPU</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeTab === 'params' ? 'bg-[#181e2b] text-zinc-100 border border-[#2c364d]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Parâmetros
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('keys')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeTab === 'keys' ? 'bg-[#181e2b] text-zinc-100 border border-[#2c364d]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Chaves de Nuvem
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('memory')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeTab === 'memory' ? 'bg-[#181e2b] text-zinc-100 border border-[#2c364d]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Memória & Cache
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {activeTab === 'models' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 mb-1.5 block font-mono">
                  Modelo Ativo Padrão:
                </label>
                <ModelSelector
                  selectedModel={form.model || 'gemini-3.7-flash'}
                  onSelect={(id) => setForm((prev) => ({ ...prev, model: id }))}
                  customHost={form.ollamaHost}
                  customPath={form.ollamaCustomPath}
                />
              </div>

              <div className="pt-3 border-t border-[#1c2232] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block font-mono">
                      Servidores OpenAI-Compatible (LM Studio / vLLM)
                    </span>
                    <p className="text-[11px] text-zinc-500">Conecte servidores locais em qualquer porta.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addCustomProvider}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Adicionar Servidor</span>
                  </button>
                </div>

                {(!form.customProviders || form.customProviders.length === 0) ? (
                  <p className="text-xs text-zinc-500 bg-[#080a0f] p-3 rounded-lg border border-[#1a202c]">
                    Nenhum servidor customizado registrado.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {form.customProviders.map((prov) => {
                      const status = providerStatuses[prov.id];
                      return (
                        <div key={prov.id} className="p-3 bg-[#0a0d13] border border-[#1e2535] rounded-xl space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={prov.name}
                              onChange={(e) => updateCustomProvider(prov.id, { name: e.target.value })}
                              placeholder="Nome do Servidor"
                              className="bg-[#121620] border border-[#21293a] rounded px-2.5 py-1 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={prov.baseUrl}
                              onChange={(e) => updateCustomProvider(prov.id, { baseUrl: e.target.value })}
                              placeholder="http://localhost:1234/v1"
                              className="bg-[#121620] border border-[#21293a] rounded px-2.5 py-1 text-xs text-white font-mono"
                            />
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={prov.apiKey || ''}
                              onChange={(e) => updateCustomProvider(prov.id, { apiKey: e.target.value })}
                              placeholder="API Key (opcional)"
                              className="flex-1 bg-[#121620] border border-[#21293a] rounded px-2.5 py-1 text-xs text-white"
                            />

                            <button
                              type="button"
                              onClick={() => handleTestProvider(prov)}
                              disabled={testingProviderId === prov.id}
                              className="bg-[#161a25] hover:bg-[#202738] text-zinc-300 border border-[#263045] text-xs px-3 py-1 rounded transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw size={12} className={testingProviderId === prov.id ? 'animate-spin' : ''} />
                              <span>Testar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => removeCustomProvider(prov.id)}
                              className="p-1.5 text-zinc-600 hover:text-rose-400 transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {status && (
                            <div className={`p-2 rounded text-[11px] font-mono flex items-center justify-between ${
                              status.ok ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-900/40' : 'bg-rose-950/30 text-rose-300 border border-rose-900/40'
                            }`}>
                              <span>{status.ok ? `Online (${status.latency}ms)` : `Erro: ${status.error}`}</span>
                              <span>{prov.models.length} modelos listados</span>
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
              <div className="p-3.5 bg-[#0a0d13] border border-[#263044] rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-zinc-100">Assistente de instalação local</div>
                  <p className="text-[11px] text-zinc-400 mt-1">Instala o Ollama pelo gerenciador oficial do Windows, inicia o serviço e verifica a GPU. Não exige comandos manuais.</p>
                </div>
                <button type="button" onClick={handleInstallOllama} disabled={installingOllama || ollamaOnline} className="shrink-0 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] disabled:opacity-40">{installingOllama ? 'Instalando...' : ollamaOnline ? 'Ollama ativo' : 'Instalar Ollama'}</button>
              </div>
              {diagnostics && <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded bg-[#111722] p-2 text-zinc-300">Ollama: <b className={diagnostics.ollamaInstalled ? 'text-emerald-400' : 'text-amber-400'}>{diagnostics.ollamaInstalled ? 'instalado' : 'não encontrado'}</b></div>
                <div className="rounded bg-[#111722] p-2 text-zinc-300">Serviço: <b className={diagnostics.ollamaOnline ? 'text-emerald-400' : 'text-amber-400'}>{diagnostics.ollamaOnline ? 'online' : 'offline'}</b></div>
                <div className="rounded bg-[#111722] p-2 text-zinc-300 col-span-2">GPU: <b>{diagnostics.gpu || 'nvidia-smi não encontrado / GPU NVIDIA indisponível'}</b></div>
              </div>}
              <button type="button" onClick={checkOllamaStatusQuick} className="text-[10px] text-indigo-300 hover:text-indigo-200">Atualizar diagnóstico</button>
            </div>

            <div className="p-3.5 bg-[#0a0d13] border border-[#3a2d1c] rounded-xl space-y-3">
              <div><div className="text-xs font-bold text-zinc-100">Buscar e instalar GGUF pelo Hugging Face</div><p className="text-[11px] text-zinc-400 mt-1">Pesquise repositórios públicos, escolha um arquivo GGUF, baixe direto para o computador e importe no Ollama. Este fluxo importa GGUF de arquivo único; modelos privados/gated, shards divididos e projetores multimodais separados exigem configuração adicional. Para visão, prefira o botão de instalação do Qwen3-VL na seção de modelos recomendados.</p></div>
              <div className="flex gap-2"><input value={hfQuery} onChange={e => setHfQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void handleSearchHF(); }} placeholder="Ex.: Qwen 2.5 Coder 7B GGUF" className="flex-1 min-w-0 bg-[#121622] border border-[#293044] rounded-lg px-3 py-2 text-xs text-white"/><button type="button" onClick={handleSearchHF} disabled={hfBusy || hfQuery.trim().length < 2} className="px-3 rounded-lg bg-indigo-700 text-white text-xs disabled:opacity-40">Buscar</button></div>
              {hfModels.length > 0 && <div className="max-h-36 overflow-y-auto space-y-1">{hfModels.map(m => <button type="button" key={m.id} onClick={() => void handleSelectHFRepo(m.id)} className={`w-full text-left p-2 rounded border text-[11px] ${hfRepo === m.id ? 'border-indigo-500 bg-indigo-950/30 text-white' : 'border-[#252d40] bg-[#111722] text-zinc-300'}`}><span className="block truncate">{m.id}</span><span className="text-[10px] text-zinc-500">{m.downloads.toLocaleString()} downloads · {m.likes} likes</span></button>)}</div>}
              {hfRepo && <div className="space-y-2"><div className="text-[10px] text-zinc-400">Arquivos GGUF de <b className="text-zinc-200">{hfRepo}</b></div><select value={hfSelectedFile} onChange={e => setHfSelectedFile(e.target.value)} className="w-full bg-[#121622] border border-[#293044] rounded-lg px-3 py-2 text-xs text-white"><option value="">Selecione um arquivo GGUF...</option>{hfFiles.map(f => <option key={f.path} value={f.path}>{f.path} · {formatBytes(f.size)}</option>)}</select><button type="button" onClick={handleDownloadHF} disabled={hfBusy || !hfSelectedFile || !ollamaOnline} className="w-full py-2 rounded-lg bg-emerald-700 text-white text-xs disabled:opacity-40">{hfBusy ? `Baixando/importando ${hfProgress}%` : 'Baixar e importar no Ollama'}</button>{hfBusy && <div className="h-1.5 rounded bg-[#1a2030] overflow-hidden"><div className="h-full bg-emerald-400" style={{width:`${hfProgress}%`}}/></div>}</div>}
            </div>

            <div className="p-3.5 bg-[#0a0f16] border border-[#1b2f26] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Maximize2 size={15} className="text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-200 font-mono">
                      Janela de Contexto Base (Tokens)
                    </span>
                  </div>
                  <span className="text-xs font-mono text-emerald-300 font-bold">
                    {form.ollamaContextLength || 4096} tokens
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Controla a memória de contexto. Para a RTX 2060 Super de 8 GB, comece em 4k; 8k pode exigir offload parcial para a RAM dependendo do modelo.
                </p>

                <div className="flex gap-2 pt-1 font-mono text-xs">
                  {[4096, 8192, 16384].map((tokens) => (
                    <button
                      key={tokens}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, ollamaContextLength: tokens }))}
                      className={`flex-1 py-1 rounded transition border cursor-pointer text-center ${
                        (form.ollamaContextLength || 4096) === tokens
                          ? 'bg-emerald-900/60 text-emerald-200 border-emerald-500/60 font-bold'
                          : 'bg-[#10161f] text-zinc-400 border-[#1f2838] hover:text-white'
                      }`}
                    >
                      {tokens >= 1000 ? `${tokens / 1024}k` : tokens}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-[#0a0d13] border border-[#1c2232] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu size={16} className="text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-zinc-200 block font-mono">Motor Local</span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {ollamaOnline ? 'Online (Pronto)' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  {!ollamaOnline ? (
                    <button
                      type="button"
                      onClick={handleStartOllama}
                      disabled={startingOllama}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1 rounded text-xs transition cursor-pointer"
                    >
                      {startingOllama ? 'Iniciando...' : 'Iniciar'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={checkOllamaStatusQuick}
                      disabled={checkingOllama}
                      className="bg-[#161a25] text-zinc-300 border border-[#242b3d] text-xs px-2.5 py-1 rounded transition"
                    >
                      <RefreshCw size={11} className={checkingOllama ? 'animate-spin' : ''} />
                    </button>
                  )}
                </div>

                <div className="p-3 bg-[#0a0d13] border border-[#1c2232] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive size={16} className="text-indigo-400" />
                    <div>
                      <span className="text-xs font-bold text-zinc-200 block font-mono">Espaço Ocupado</span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {localModelsList.length} modelos • {formatBytes(totalOllamaStorageBytes)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-[#0a0d13] border border-[#1c2232] rounded-xl space-y-2.5">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-sky-400" />
                  <span className="text-xs font-bold text-zinc-200 font-mono">Pesquisa na Web para modelos locais</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  SearXNG é opcional. Se não houver uma instância configurada/ativa, o Esperto tenta usar DuckDuckGo automaticamente como alternativa, sem Docker Desktop. As consultas de busca saem para a internet; o modelo e o histórico permanecem locais.
                </p>
                <label className="block text-[11px] text-zinc-400 font-mono">URL do SearXNG</label>
                <input
                  type="url"
                  value={form.searxngHost || 'http://127.0.0.1:8080'}
                  onChange={(e) => setForm((prev) => ({ ...prev, searxngHost: e.target.value }))}
                  placeholder="http://127.0.0.1:8080"
                  className="w-full bg-[#121622] border border-[#21293a] rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                />
                <p className="text-[10px] text-zinc-500">
                  O serviço precisa aceitar respostas JSON em /search?format=json. Consulte infra/searxng e o README para instalação.
                </p>
              </div>

              <div className="p-3.5 bg-[#0a0d13] border border-[#1c2232] rounded-xl space-y-2.5">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 font-mono">
                  <Download size={13} className="text-emerald-400" />
                  <span>Perfis recomendados para RTX 2060 Super 8 GB</span>
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="p-2.5 bg-[#101722] border border-[#1f3440] rounded-lg space-y-2">
                    <div className="text-xs text-zinc-100 font-semibold">Qwen3-VL 4B</div>
                    <p className="text-[10px] text-zinc-400">Modelo principal multimodal: texto, imagens e análise de screenshots.</p>
                    <button type="button" onClick={() => handlePullModel('qwen3-vl:4b')} disabled={isPulling} className="w-full bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] py-1.5 rounded disabled:opacity-40">Baixar qwen3-vl:4b</button>
                  </div>
                  <div className="p-2.5 bg-[#101722] border border-[#28314a] rounded-lg space-y-2">
                    <div className="text-xs text-zinc-100 font-semibold">Qwen2.5-Coder 7B</div>
                    <p className="text-[10px] text-zinc-400">Especialista textual em programação; não recebe imagens.</p>
                    <button type="button" onClick={() => handlePullModel('qwen2.5-coder:7b')} disabled={isPulling} className="w-full bg-indigo-700 hover:bg-indigo-600 text-white text-[11px] py-1.5 rounded disabled:opacity-40">Baixar qwen2.5-coder:7b</button>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500">Use apenas um modelo por vez. Os pesos Q4 do Qwen3-VL 4B ocupam cerca de 3,3 GB, além do projetor visual, cache e contexto.</p>
              </div>

              <div className="p-3.5 bg-[#0a0d13] border border-[#1c2232] rounded-xl space-y-2.5">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 font-mono">
                  <Download size={13} className="text-indigo-400" />
                  <span>Baixar Modelo do Hugging Face ou Ollama</span>
                </span>
                <p className="text-[11px] text-zinc-400">
                  Cole o identificador de um modelo do Ollama (ex.: <code>qwen3-vl:4b</code>) ou o repositório GGUF compatível do Hugging Face:
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pullModelTag}
                    onChange={(e) => setPullModelTag(e.target.value)}
                    placeholder="Cole autor/modelo..."
                    className="flex-1 bg-[#121622] border border-[#21293a] rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handlePullModel()}
                    disabled={isPulling || !pullModelTag.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-40"
                  >
                    <span>{isPulling ? 'Baixando...' : 'Baixar'}</span>
                  </button>
                </div>

                {isPulling && (
                  <div className="p-2.5 bg-[#06080d] rounded-lg border border-[#1b2232] space-y-1 font-mono text-xs">
                    <div className="flex justify-between text-zinc-400 text-[11px]">
                      <span>{pullStatus}</span>
                      <span>{pullProgress}%</span>
                    </div>
                    <div className="w-full bg-[#131722] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full transition-all duration-200" style={{ width: `${pullProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-[#0a0d13] border border-[#1c2232] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200 font-mono">Modelos Instalados</span>
                  <span className="text-[11px] font-mono text-zinc-400">{formatBytes(totalOllamaStorageBytes)} total</span>
                </div>

                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {localModelsList.map((m) => (
                    <div key={m.name} className="flex items-center justify-between p-2 bg-[#121622] border border-[#1d2332] rounded-lg text-xs font-mono">
                      <span className="text-zinc-300 truncate max-w-sm">{m.name}</span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] text-zinc-400">{formatBytes(m.size)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteModel(m.name)}
                          className="text-zinc-600 hover:text-rose-400 p-0.5 transition"
                          title="Excluir do disco"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'params' && (
            <div className="p-3.5 bg-[#0a0d13] border border-[#1c2232] rounded-xl space-y-3 font-sans">
              <div className="flex justify-between text-xs text-zinc-300 font-mono">
                <span>Temperatura:</span>
                <span>{form.temperature ?? 0.7}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={form.temperature ?? 0.7}
                onChange={(e) => setForm((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                className="w-full accent-indigo-500"
              />

              <div className="pt-2 flex items-center justify-between bg-[#121622] p-2.5 rounded-lg border border-[#1d2332]">
                <div>
                  <span className="text-xs font-medium text-zinc-200 block">Exigir Confirmação Antes de Gravar Arquivos</span>
                  <span className="text-[10px] text-zinc-500">Mostra a revisão antes de aplicar alterações no disco.</span>
                </div>
                <input
                  type="checkbox"
                  checked={form.requireActionConfirmation !== false}
                  onChange={(e) => setForm((prev) => ({ ...prev, requireActionConfirmation: e.target.checked }))}
                  className="accent-indigo-500 w-4 h-4 cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeTab === 'keys' && (
            <div className="space-y-3 font-mono">
              <div className="p-3 bg-[#0a0d13] border border-[#1c2232] rounded-xl">
                <label className="block text-xs font-semibold text-zinc-300 mb-1">OpenRouter Key (Opcional)</label>
                <input
                  type="password"
                  value={form.openrouterApiKey || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, openrouterApiKey: e.target.value }))}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-[#121622] border border-[#21293a] rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                />
              </div>

              {/* CAMPO DE HUGGING FACE TOKEN ADICIONADO */}
              <div className="p-3 bg-[#0a0d14] border border-amber-950/40 rounded-xl">
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Hugging Face Token</label>
                <input
                  type="password"
                  value={form.huggingfaceApiKey || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, huggingfaceApiKey: e.target.value }))}
                  placeholder="hf_..."
                  className="w-full bg-[#121622] border border-amber-900/40 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-[#0a0d13] border border-[#1c2232] rounded-xl">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Gemini API Key</label>
                  <input
                    type="password"
                    value={form.geminiApiKey || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, geminiApiKey: e.target.value }))}
                    placeholder="AIzaSy..."
                    className="w-full bg-[#121622] border border-[#21293a] rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-[#0a0d13] border border-[#1c2232] rounded-xl">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">DeepSeek Cloud Key</label>
                  <input
                    type="password"
                    value={form.deepseekApiKey || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, deepseekApiKey: e.target.value }))}
                    placeholder="sk-..."
                    className="w-full bg-[#121622] border border-[#21293a] rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-[#0a0d13] border border-[#1c2232] rounded-xl space-y-2">
                <span className="text-xs font-bold text-zinc-300 block font-mono">Memória Permanente</span>
                <textarea
                  value={form.globalMemory || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, globalMemory: e.target.value }))}
                  placeholder="Instruções permanentes de arquitetura para todas as IAs..."
                  rows={5}
                  className="w-full bg-[#121622] border border-[#21293a] rounded p-2 text-xs text-white font-mono focus:outline-none resize-none"
                />
              </div>

              <div className="p-3 bg-[#0a0d13] border border-[#1c2232] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-300 block">Banco de Dados Interno</span>
                  <span className="text-[11px] font-mono text-zinc-500">Uso atual: {appCacheSize}</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('Limpar conversas antigas do disco?')) {
                      await db.messages.clear();
                      await db.chats.clear();
                      alert('Cache limpo!');
                      window.location.reload();
                    }
                  }}
                  className="bg-[#181d2a] hover:bg-rose-950/60 text-zinc-300 hover:text-rose-300 text-xs px-3 py-1 rounded transition"
                >
                  Limpar Histórico
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 mt-3 border-t border-[#1c2232] flex items-center justify-between">
          <span className="text-[11px] text-zinc-600 font-mono">Esperto IDE • 2026</span>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="bg-zinc-200 hover:bg-white text-zinc-900 font-semibold px-6 py-1.5 rounded-lg transition text-xs font-mono cursor-pointer"
          >
            Salvar Preferências
          </button>
        </div>
      </div>

      <OllamaGuideModal isOpen={isOllamaGuideOpen} onClose={() => setIsOllamaGuideOpen(false)} />
    </div>
  );
};

export default SettingsModal;