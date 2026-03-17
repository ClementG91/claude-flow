import { useState, useEffect, useRef } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useWorkflowStore } from '../stores/workflow';

export function CreateTaskDialog() {
  const { createDialogOpen, toggleCreateDialog } = useWorkflowStore();
  const utils = trpc.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);

  const [taskId, setTaskId] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      toggleCreateDialog();
      resetForm();
    },
    onError: (err) => {
      setError(err.message || 'Failed to create task');
    },
  });

  const resetForm = () => {
    setTaskId('');
    setDescription('');
    setContent('');
    setError(null);
  };

  // Focus input on open
  useEffect(() => {
    if (createDialogOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      resetForm();
    }
  }, [createDialogOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && createDialogOpen) {
        toggleCreateDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createDialogOpen, toggleCreateDialog]);

  if (!createDialogOpen) return null;

  const isValid = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(taskId) && taskId.length >= 3 && description.length > 0 && content.length > 0;

  const handleCreate = () => {
    if (!isValid) return;
    setError(null);
    createMutation.mutate({ taskId, description, content });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) toggleCreateDialog();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-base font-semibold">Create New Task</h2>
          <button
            onClick={toggleCreateDialog}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Task ID
            </label>
            <input
              ref={inputRef}
              type="text"
              placeholder="my-new-task"
              value={taskId}
              onChange={(e) => {
                setTaskId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                setError(null);
              }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-claude-600 focus:ring-1 focus:ring-claude-600"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Kebab-case, min 3 chars (e.g., daily-report, fetch-data)
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Description
            </label>
            <input
              type="text"
              placeholder="Short description of what this task does"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-claude-600 focus:ring-1 focus:ring-claude-600"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Task Prompt
            </label>
            <textarea
              placeholder="Write the instructions Claude should execute..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs text-zinc-300 placeholder-zinc-600 outline-none focus:border-claude-600 focus:ring-1 focus:ring-claude-600"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-4">
          <p className="text-[11px] text-zinc-600">
            Creates SKILL.md in ~/.claude/scheduled-tasks/
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleCreateDialog}
              className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!isValid || createMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-claude-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-claude-700 active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              <Plus className="h-4 w-4" />
              {createMutation.isPending ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
