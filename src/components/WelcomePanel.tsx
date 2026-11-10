import React from 'react';
import {
  ArrowUpRight,
  Bug,
  Code2,
  FileSearch,
  FolderOpen,
  Lightbulb,
  Settings2,
  Terminal,
} from 'lucide-react';

interface WelcomePanelProps {
  modelName: string;
  isLocalModel: boolean;
  hasWorkspace: boolean;
  onPrompt: (prompt: string) => void;
  onOpenSettings: () => void;
}

const suggestions = [
  {
    title: 'Understand this project',
    description: 'Map the structure, identify the main modules and explain how they work together.',
    prompt: 'Inspect the linked workspace. Explain its architecture, identify the main entry points, important modules, dependencies, and how the application runs. Do not modify any files.',
    icon: FileSearch,
    accent: 'text-sky-300',
  },
  {
    title: 'Investigate a bug',
    description: 'Trace a problem to its source and propose a safe, testable correction.',
    prompt: 'Review the linked workspace for likely causes of the issue I describe next. First inspect the relevant code and explain the root cause and a minimal fix. Do not modify files until I approve the proposed change.',
    icon: Bug,
    accent: 'text-rose-300',
  },
  {
    title: 'Implement a feature',
    description: 'Plan the changes, identify affected files and implement in small steps.',
    prompt: 'Help me implement a new feature in the linked workspace. Start by asking what the feature should do if that is not specified, then inspect the relevant code, propose an implementation plan, and wait for my approval before editing files.',
    icon: Code2,
    accent: 'text-violet-300',
  },
  {
    title: 'Review code quality',
    description: 'Look for reliability, maintainability, performance and security issues.',
    prompt: 'Perform a focused code review of the linked workspace. Prioritize concrete bugs, security risks, data-loss risks, performance problems, and maintainability issues. Report findings by severity with file paths and line references. Do not modify files.',
    icon: Lightbulb,
    accent: 'text-amber-300',
  },
];

export const WelcomePanel: React.FC<WelcomePanelProps> = ({
  modelName,
  isLocalModel,
  hasWorkspace,
  onPrompt,
  onOpenSettings,
}) => {
  return (
    <div className="min-h-full w-full flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2a3449] bg-gradient-to-br from-[#1b2435] to-[#10141e] text-zinc-200 shadow-lg shadow-black/20">
            <Terminal size={22} strokeWidth={1.8} />
          </div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-indigo-300/80">
            Development workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
            What are we building today?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400">
            Ask questions, inspect your codebase, investigate issues or plan changes. Esperto can work with the files in your linked workspace.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#252d3e] bg-[#10151f] px-3 py-1.5 text-[11px] text-zinc-300">
            <span className={`h-1.5 w-1.5 rounded-full ${isLocalModel ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
            {modelName}
            <span className="text-zinc-500">{isLocalModel ? 'Local' : 'Cloud'}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#252d3e] bg-[#10151f] px-3 py-1.5 text-[11px] text-zinc-400">
            <FolderOpen size={12} />
            {hasWorkspace ? 'Workspace linked' : 'No workspace linked'}
          </span>
        </div>

        {!hasWorkspace && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-900/40 bg-amber-950/15 px-4 py-3">
            <FolderOpen size={16} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-amber-100">Link a project folder for code-aware assistance</p>
              <p className="mt-1 text-xs leading-5 text-amber-100/60">You can still ask general questions, but project inspection and file operations work best with a workspace connected.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {suggestions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => onPrompt(item.prompt)}
                className="group rounded-xl border border-[#222b3c] bg-[#0e131c] p-4 text-left transition duration-150 hover:-translate-y-0.5 hover:border-[#3a4864] hover:bg-[#131a27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.04] ${item.accent}`}>
                    <Icon size={16} />
                  </span>
                  <ArrowUpRight size={15} className="text-zinc-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-300" />
                </div>
                <h2 className="text-sm font-medium text-zinc-100">{item.title}</h2>
                <p className="mt-1.5 text-xs leading-5 text-zinc-500">{item.description}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-[#1b2230] pt-4 sm:flex-row">
          <p className="text-[11px] text-zinc-600">
            Shortcuts: <kbd className="rounded border border-[#30394b] bg-[#111722] px-1.5 py-0.5 text-zinc-400">Ctrl + N</kbd> new session <span className="mx-1">·</span> <kbd className="rounded border border-[#30394b] bg-[#111722] px-1.5 py-0.5 text-zinc-400">Ctrl + I</kbd> run settings
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2a3448] bg-[#151c29] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-indigo-500/50 hover:bg-[#1a2333] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
          >
            <Settings2 size={13} />
            Configure providers and models
          </button>
        </div>
      </div>
    </div>
  );
};
