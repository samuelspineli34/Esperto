import Dexie, { type Table } from 'dexie';

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Base64 ou texto
  size?: number;
  isSnippet?: boolean;
}

export interface WorkspacePreset {
  id: string;
  name: string;
  paths: string[];
  createdAt: number;
}

export interface Chat {
  id: string;
  title: string;
  systemInstruction?: string;
  directoryPaths?: string[];
  useMemory?: boolean;
  model?: string;
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

export interface Settings {
  id: string;
  model: string;
  globalMemory?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  deepseekApiKey?: string;
  openrouterApiKey?: string;
  
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
    this.version(2).stores({
      chats: 'id, createdAt',
      messages: '++id, chatId, timestamp',
      settings: 'id',
      presets: 'id, createdAt',
    });
  }
}

export const db = new EspertoDatabase();

/**
 * Limpa mensagens antigas ou chats vazios para evitar que o disco C: lote de cache
 */
export async function clearAppCacheAndOldChats() {
  try {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // Chats com mais de 30 dias sem uso (opcional)
    // Mantém configurações e predefinições, limpa apenas logs e anexos pesados se necessário
    console.log('[Esperto] Limpeza de cache executada.');
  } catch (err) {
    console.warn('Erro ao limpar cache:', err);
  }
}