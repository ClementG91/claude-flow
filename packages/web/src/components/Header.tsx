import { useState } from 'react';
import { LayoutGrid, LayoutList, RefreshCw, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkflowStore } from '../stores/workflow';
import { trpc } from '../lib/trpc';

export function Header() {
  const { viewMode, setViewMode, toggleSettingsDialog } = useWorkflowStore();
  const utils = trpc.useUtils();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const syncMutation = trpc.schedule.syncFromClaudeDesktop.useMutation({
    onSuccess: (data) => {
      utils.schedule.getAll.invalidate();
      utils.schedule.getByTaskId.invalidate();
      toast.success(`Synced ${data.synced} schedule(s) from Claude Desktop`);
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      utils.tasks.list.invalidate(),
      utils.workflows.list.invalidate(),
      syncMutation.mutateAsync(),
    ]);
    // Keep the animation for at least 600ms for visual feedback
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-claude-600/20 p-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="h-5 w-5">
              <rect width="32" height="32" rx="8" fill="#18181b"/>
              <path d="M8 16h4l3-6 4 12 3-6h4" stroke="#f0760c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            Claude <span className="text-claude-500">Flow</span>
          </h1>
        </div>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          v0.1.0
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Settings button */}
        <button
          onClick={toggleSettingsDialog}
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Refresh + Sync button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:text-claude-500"
          title="Refresh tasks & sync schedules from Claude Desktop"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900">
          <button
            onClick={() => setViewMode('canvas')}
            className={`rounded-l-lg p-2 transition ${
              viewMode === 'canvas'
                ? 'bg-claude-600/20 text-claude-500'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Canvas view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-r-lg p-2 transition ${
              viewMode === 'list'
                ? 'bg-claude-600/20 text-claude-500'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="List view"
          >
            <LayoutList className="h-4 w-4" />
          </button>
        </div>

        {/* Sync indicator */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-500" title="Tasks are managed in Claude Desktop. Use the refresh button to sync.">
          Managed by Claude Desktop
        </div>
      </div>
    </header>
  );
}
