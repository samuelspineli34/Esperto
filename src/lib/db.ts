import Dexie, { type Table } from 'dexie';

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Base64 ou texto
  size?: number;
  isSnippet?: boolean;
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
  
  // Parâmetros de IA Avançados:
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  thinkingBudget?: number;
  mediaResolution?: 'default' | 'low' | 'medium' | 'high';
  googleSearch?: boolean;
}

class EspertoDatabase extends Dexie {
  chats!: Table<Chat>;
  messages!: Table<Message>;
  settings!: Table<Settings>;

  constructor() {
    super('EspertoDB');
    this.version(1).stores({
      chats: 'id, createdAt',
      messages: '++id, chatId, timestamp',
      settings: 'id'
    });
  }
}

export const db = new EspertoDatabase();