import Dexie, { type Table } from 'dexie';

export interface Chat {
  id: string;
  title: string;
  systemInstruction?: string;
  useMemory?: boolean;
  model?: string;
  createdAt: number;
}

export interface Message {
  id?: number;
  chatId: string;
  role: 'user' | 'model';
  content: string;
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