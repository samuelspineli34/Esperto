
import Dexie, { type Table } from 'dexie';

export interface Attachment {
  name: string;
  mimeType: string;
  data: string;
  size?: number;
  isSnippet?: boolean;
}

export interface WorkspacePreset {
  id: string;
  name: string;
  paths: string[];
  createdAt: number;
}

export interface ChatRunSettings {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  googleSearch?: boolean;
  contextLength?: number;
  mediaResolution?: 'default' | 'low' | 'medium' | 'high';
  stopSequences?: string[];
}

export interface Chat {
  id: string;
  title: string;
  systemInstruction?: string;
  directoryPaths?: string[];
  ignoredPaths?: string[];
  useMemory?: boolean;
  model?: string;
  runSettings?: ChatRunSettings;
  createdAt: number;
}

export interface Message {
  id?: number;
  chatId: string;
  role: 'user' | 'model';
  content: string;
  attachments?: Attachment[];
  timestamp: number;
}

export interface CustomProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  protocol: 'openai-compatible';
  models: string[];
  enabled?: boolean;
}

export interface Settings {
  id: string;
  model: string;
  globalMemory?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  deepseekApiKey?: string;
  openrouterApiKey?: string;
  huggingfaceApiKey?: string;
  customProviders?: CustomProviderConfig[];

  // Ollama & GPU
  ollamaCustomPath?: string;
  ollamaHost?: string;
  ollamaContextLength?: number;
  searxngHost?: string;

  // Segurança do Agente
  requireActionConfirmation?: boolean;

  // Parâmetros Globais Padrão
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  thinkingBudget?: number;
  mediaResolution?: 'default' | 'low' | 'medium' | 'high';
  googleSearch?: boolean;
}

export class EspertoDatabase extends Dexie {
  chats!: Table<Chat, string>;
  messages!: Table<Message, number>;
  settings!: Table<Settings, string>;
  presets!: Table<WorkspacePreset, string>;

  constructor() {
    super('EspertoDB');
    this.version(3).stores({
      chats: 'id, createdAt',
      messages: '++id, chatId, timestamp',
      settings: 'id',
      presets: 'id, createdAt',
    });
  }
}

export const db = new EspertoDatabase();
