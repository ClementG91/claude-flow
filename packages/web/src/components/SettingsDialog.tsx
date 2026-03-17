import { useState, useEffect } from 'react';
import { X, Save, Settings, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '../lib/trpc';
import { useWorkflowStore } from '../stores/workflow';

export function SettingsDialog() {
  const { settingsDialogOpen, toggleSettingsDialog } = useWorkflowStore();
  const { data: settings, isLoading } = trpc.settings.get.useQuery(undefined, {
    enabled: settingsDialogOpen,
  });
  const utils = trpc.useUtils();

  const [tasksDirectory, setTasksDirectory] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      utils.tasks.list.invalidate();
      setHasChanges(false);
      toast.success('Settings saved');
    },
    onError: (err) => {
      toast.error(`Failed to save settings: ${err.message}`);
    },
  });

  useEffect(() => {
    if (settings) {
      setTasksDirectory(settings.tasksDirectory);
      setHasChanges(false);
    }
  }, [settings]);

  if (!settingsDialogOpen) return null;

  const handleSave = () => {
    updateMutation.mutate({ tasksDirectory: tasksDirectory.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={toggleSettingsDialog}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-claude-500" />
            <h2 className="text-sm font-semibold text-zinc-200">Settings</h2>
          </div>
          <button
            onClick={toggleSettingsDialog}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-claude-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="flex flex-col gap-5 px-6 py-5">
              {/* Tasks directory */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Tasks Directory
                </label>
                <input
                  type="text"
                  value={tasksDirectory}
                  onChange={(e) => {
                    setTasksDirectory(e.target.value);
                    setHasChanges(true);
                  }}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 outline-none transition focus:border-claude-600 focus:ring-1 focus:ring-claude-600"
                  placeholder="~/.claude/scheduled-tasks"
                />
                <p className="mt-1.5 text-[10px] text-zinc-600">
                  Directory where Claude scheduled task SKILL.md files are stored
                </p>
              </div>

              {/* Server port (read-only info) */}
              <div>
                <label className="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Server Port
                </label>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-400">
                  {settings?.port ?? '3710'}
                </div>
                <p className="mt-1.5 text-[10px] text-zinc-600">
                  Server port (requires restart to change)
                </p>
              </div>

              {/* Current detected paths */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-2">
                  Auto-detected Paths
                </p>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] text-zinc-500 shrink-0">Default tasks dir:</span>
                    <span className="font-mono text-[10px] text-zinc-400 truncate">
                      {settings?.defaultTasksDirectory ?? '~/.claude/scheduled-tasks'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] text-zinc-500 shrink-0">Config file:</span>
                    <span className="font-mono text-[10px] text-zinc-400 truncate">
                      {settings?.configFilePath ?? '~/.claude-flow/config.json'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-6 py-4">
              <button
                onClick={toggleSettingsDialog}
                className="rounded-lg px-4 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || updateMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-claude-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-claude-500 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
