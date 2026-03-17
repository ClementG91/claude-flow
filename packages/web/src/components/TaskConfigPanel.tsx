import { useState, useEffect } from 'react';
import { Shield, Cpu, FolderOpen, Wrench, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '../lib/trpc';

interface TaskConfigPanelProps {
  taskId: string;
}

const PERMISSION_MODES = [
  { value: '', label: 'Ask for permissions' },
  { value: 'auto_accept', label: 'Auto-accept changes' },
  { value: 'plan_mode', label: 'Plan mode' },
  { value: 'skip_all_permission_checks', label: 'Skip all permissions' },
] as const;

export function TaskConfigPanel({ taskId }: TaskConfigPanelProps) {
  const utils = trpc.useUtils();

  const { data: config, isLoading } = trpc.claudeDesktop.getTaskConfig.useQuery(
    { taskId },
    { enabled: !!taskId }
  );

  const { data: models } = trpc.claudeDesktop.listAvailableModels.useQuery();

  const updateMutation = trpc.claudeDesktop.updateTaskConfig.useMutation({
    onSuccess: () => {
      utils.claudeDesktop.getTaskConfig.invalidate({ taskId });
      toast.success('Config updated');
    },
    onError: (err) => {
      toast.error(`Failed to update config: ${err.message}`);
    },
  });

  const [model, setModel] = useState('');
  const [permissionMode, setPermissionMode] = useState('');
  const [disableJitter, setDisableJitter] = useState(false);

  useEffect(() => {
    if (config) {
      setModel(config.model ?? '');
      setPermissionMode(config.chromePermissionMode ?? '');
      setDisableJitter(config.disableJitter);
    }
  }, [config]);

  const handleModelChange = (value: string) => {
    setModel(value);
    updateMutation.mutate({ taskId, model: value });
  };

  const handlePermissionModeChange = (value: string) => {
    setPermissionMode(value);
    updateMutation.mutate({
      taskId,
      chromePermissionMode: value === '' ? null : value,
    });
  };

  const handleJitterToggle = () => {
    const newValue = !disableJitter;
    setDisableJitter(newValue);
    updateMutation.mutate({ taskId, disableJitter: newValue });
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-claude-500 border-t-transparent" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
        <Shield className="h-8 w-8 text-zinc-700 mb-2" />
        <p className="text-sm">No Claude Desktop config found</p>
        <p className="text-xs text-zinc-600 mt-1">
          Sync from Claude Desktop to load task config
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Permission Mode */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-claude-500" />
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Permission Mode
          </label>
        </div>
        <select
          value={permissionMode}
          onChange={(e) => handlePermissionModeChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-claude-600 focus:ring-1 focus:ring-claude-600"
        >
          {PERMISSION_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </div>

      {/* Model Selector */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="h-4 w-4 text-claude-500" />
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Model
          </label>
        </div>
        <select
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-claude-600 focus:ring-1 focus:ring-claude-600"
        >
          <option value="">Default</option>
          {(models ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Jitter Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <Zap className={`h-5 w-5 ${disableJitter ? 'text-amber-500' : 'text-zinc-500'}`} />
          <div>
            <p className="text-sm font-medium text-zinc-200">
              {disableJitter ? 'Jitter disabled' : 'Jitter enabled'}
            </p>
            <p className="text-xs text-zinc-500">
              {disableJitter
                ? 'Task runs at exact scheduled time'
                : 'Small random delay added to schedule'}
            </p>
          </div>
        </div>
        <button
          onClick={handleJitterToggle}
          className={`relative h-6 w-11 rounded-full transition ${
            disableJitter ? 'bg-amber-600' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
              disableJitter ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {/* Working Folders (read-only) */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen className="h-4 w-4 text-claude-500" />
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Working Folders
          </label>
        </div>
        {config.userSelectedFolders.length === 0 ? (
          <p className="text-xs text-zinc-600">No folders configured</p>
        ) : (
          <ul className="space-y-1">
            {config.userSelectedFolders.map((folder, i) => (
              <li
                key={i}
                className="truncate rounded bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-zinc-300"
                title={folder}
              >
                {folder}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Approved MCP Tools (read-only) */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="h-4 w-4 text-claude-500" />
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Approved MCP Tools
          </label>
          {config.approvedPermissions.length > 0 && (
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {config.approvedPermissions.length}
            </span>
          )}
        </div>
        {config.approvedPermissions.length === 0 ? (
          <p className="text-xs text-zinc-600">No approved tools</p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {config.approvedPermissions.map((tool, i) => (
              <li
                key={i}
                className="truncate rounded bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-zinc-300"
                title={tool}
              >
                {tool}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
