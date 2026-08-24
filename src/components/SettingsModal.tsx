import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  model: string;
  onSave: (apiKey: string, model: string) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, apiKey, model, onSave }) => {
  const [key, setKey] = useState(apiKey);
  const [selectedModel, setSelectedModel] = useState(model);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-surface border border-gray-800 rounded-2xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X size={18} />
        </button>
        <h2 className="text-lg font-semibold text-white mb-4">Configurações do Esperto</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Gemini API Key</label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Cole sua API Key aqui..."
              className="w-full bg-background border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Modelo</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-background border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Rápido e Eficiente)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Raciocínio Avançado)</option>
              <option value="gemini-3-flash">Gemini 3 Flash</option>
            </select>
          </div>

          <button
            onClick={() => {
              onSave(key, selectedModel);
              onClose();
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition text-sm mt-2"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};