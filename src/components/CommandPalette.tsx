import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, CornerDownLeft, Search, X } from 'lucide-react';

export interface PaletteCommand {
  id: string;
  title: string;
  description?: string;
  group: string;
  keywords?: string[];
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
}

export interface PaletteSearchResult {
  id: string;
  title: string;
  description: string;
  onSelect: () => void | Promise<void>;
}

interface Props {
  isOpen: boolean;
  commands: PaletteCommand[];
  onClose: () => void;
  onSearchConversations: (query: string) => Promise<PaletteSearchResult[]>;
}

export const CommandPalette: React.FC<Props> = ({
  isOpen,
  commands,
  onClose,
  onSearchConversations,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [messageResults, setMessageResults] = useState<PaletteSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedIndex(0);
    setMessageResults([]);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    const term = query.trim();
    if (!isOpen || term.length < 3) {
      requestRef.current += 1;
      setMessageResults([]);
      setIsSearching(false);
      return;
    }

    const requestId = ++requestRef.current;
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await onSearchConversations(term);
        if (requestRef.current === requestId) setMessageResults(results);
      } catch (error) {
        console.warn('Command palette conversation search failed:', error);
        if (requestRef.current === requestId) setMessageResults([]);
      } finally {
        if (requestRef.current === requestId) setIsSearching(false);
      }
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [query, isOpen, onSearchConversations]);

  const filteredCommands = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands.slice(0, 14);
    return commands
      .filter((command) =>
        [command.title, command.description || '', command.group, ...(command.keywords || [])]
          .join(' ')
          .toLowerCase()
          .includes(term)
      )
      .slice(0, 12);
  }, [commands, query]);

  const results: PaletteCommand[] = useMemo(() => {
    const conversationCommands: PaletteCommand[] = messageResults.map((result) => ({
      id: `message-${result.id}`,
      title: result.title,
      description: result.description,
      group: 'Matching conversations',
      icon: <Search size={15} />,
      onSelect: result.onSelect,
    }));
    return [...filteredCommands, ...conversationCommands].slice(0, 16);
  }, [filteredCommands, messageResults]);

  useEffect(() => setSelectedIndex(0), [query, results.length]);

  if (!isOpen) return null;

  const selectCurrent = () => {
    const selected = results[selectedIndex];
    if (!selected || selected.disabled) return;
    void selected.onSelect();
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) => Math.min(current + 1, Math.max(0, results.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(0, current - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectCurrent();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/65 px-4 pt-[12vh] backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#30394d] bg-[#0d111b] shadow-2xl shadow-black/60"
      >
        <div className="flex items-center gap-3 border-b border-[#242c3c] px-4">
          <Search size={18} className="shrink-0 text-indigo-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, models, sessions, and messages..."
            className="h-14 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            autoComplete="off"
            spellCheck={false}
          />
          {isSearching && <span className="text-[10px] text-zinc-500">Searching</span>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
          >
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[min(62vh,520px)] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-zinc-300">No matching commands or conversations</p>
              <p className="mt-1 text-xs text-zinc-500">Try another search term.</p>
            </div>
          ) : (
            results.map((command, index) => {
              const showGroup = command.group !== lastGroup;
              lastGroup = command.group;
              return (
                <React.Fragment key={command.id}>
                  {showGroup && (
                    <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                      {command.group}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={command.disabled}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => {
                      if (command.disabled) return;
                      void command.onSelect();
                      onClose();
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      selectedIndex === index
                        ? 'bg-indigo-500/15 text-white ring-1 ring-inset ring-indigo-400/25'
                        : 'text-zinc-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/[0.035] text-zinc-400">
                      {command.icon || <Search size={15} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{command.title}</span>
                      {command.description && (
                        <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{command.description}</span>
                      )}
                    </span>
                    {command.shortcut && (
                      <kbd className="rounded border border-[#30394a] bg-[#111722] px-1.5 py-1 text-[10px] text-zinc-500">
                        {command.shortcut}
                      </kbd>
                    )}
                    {selectedIndex === index && <CornerDownLeft size={13} className="text-indigo-300" />}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>

        <footer className="flex items-center gap-4 border-t border-[#242c3c] px-4 py-2.5 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1"><kbd className="rounded border border-[#30394a] px-1">↑</kbd><kbd className="rounded border border-[#30394a] px-1">↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><CornerDownLeft size={11} /> Run</span>
          <span className="ml-auto flex items-center gap-1"><ArrowUp size={10} /> <kbd className="rounded border border-[#30394a] px-1">Esc</kbd> Close</span>
        </footer>
      </section>
    </div>
  );
};
