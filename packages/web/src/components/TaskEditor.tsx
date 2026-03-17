import { useState, useEffect } from 'react';
import { X, Save, Trash2, FileText, Check, Power, Clock, History, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '../lib/trpc';
import { useWorkflowStore } from '../stores/workflow';
import { CronEditor } from './CronEditor';
import { TaskConfigPanel } from './TaskConfigPanel';

export function TaskEditor() {
  const { selectedTaskId, closeEditor, editorTab, setEditorTab, openConfirmDialog } = useWorkflowStore();
  const utils = trpc.useUtils();

  const { data: task, isLoading } = trpc.tasks.getById.useQuery(
    { taskId: selectedTaskId! },
    { enabled: !!selectedTaskId }
  );
  const { data: schedule } = trpc.schedule.getByTaskId.useQuery(
    { taskId: selectedTaskId! },
    { enabled: !!selectedTaskId }
  );
  const { data: taskHistory } = trpc.history.byTask.useQuery(
    { taskId: selectedTaskId!, limit: 20 },
    { enabled: !!selectedTaskId && editorTab === 'history' }
  );

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [cronExpression, setCronExpression] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.tasks.getById.invalidate({ taskId: selectedTaskId! });
      setSaveStatus('saved');
      setHasChanges(false);
      toast.success('Task saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
  });

  const updateScheduleMutation = trpc.schedule.updateLocal.useMutation({
    onSuccess: () => {
      utils.schedule.getAll.invalidate();
      utils.schedule.getByTaskId.invalidate({ taskId: selectedTaskId! });
    },
  });

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      closeEditor();
      toast.success('Task deleted');
    },
  });

  useEffect(() => {
    if (task) {
      setDescription(task.frontmatter.description);
      setContent(task.content);
      setHasChanges(false);
      setSaveStatus('idle');
    }
  }, [task]);

  useEffect(() => {
    if (schedule) {
      setCronExpression(schedule.cronExpression ?? '');
      setIsEnabled(schedule.enabled ?? false);
    }
  }, [schedule]);

  // Ctrl+S save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && hasChanges) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, selectedTaskId, description, content]);

  const handleSave = () => {
    if (!selectedTaskId || !hasChanges) return;
    setSaveStatus('saving');
    updateMutation.mutate({ taskId: selectedTaskId, description, content });
  };

  const handleDelete = () => {
    if (!selectedTaskId) return;
    openConfirmDialog({
      title: 'Delete Task',
      message: `Delete task "${selectedTaskId}"? This will remove the SKILL.md file permanently.`,
      variant: 'danger',
      onConfirm: () => deleteMutation.mutate({ taskId: selectedTaskId }),
    });
  };

  const handleScheduleUpdate = (field: string, value: any) => {
    if (!selectedTaskId) return;
    updateScheduleMutation.mutate({
      taskId: selectedTaskId,
      ...(field === 'cronExpression' && { cronExpression: value }),
      ...(field === 'enabled' && { enabled: value }),
    });
  };

  if (!selectedTaskId) return null;

  const tabs = [
    { id: 'content' as const, label: 'Content', icon: FileText },
    { id: 'schedule' as const, label: 'Schedule', icon: Clock },
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'config' as const, label: 'Config', icon: Settings },
  ];

  return (
    <aside className="flex w-[480px] flex-col border-l border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-claude-500" />
          <h2 className="truncate text-sm font-semibold">{selectedTaskId}</h2>
          {/* Enabled badge */}
          <span className={`shrink-0 h-2 w-2 rounded-full ${schedule?.enabled ? 'bg-green-500' : 'bg-zinc-600'}`} />
          {hasChanges && saveStatus === 'idle' && (
            <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">Unsaved</span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] text-green-400"><Check className="h-3 w-3" />Saved</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleSave} disabled={!hasChanges || saveStatus === 'saving'} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-green-400 disabled:opacity-30" title="Save (Ctrl+S)"><Save className={`h-4 w-4 ${saveStatus === 'saving' ? 'animate-pulse' : ''}`} /></button>
          <button onClick={handleDelete} disabled={deleteMutation.isPending} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-red-400 disabled:opacity-30" title="Delete"><Trash2 className="h-4 w-4" /></button>
          <button onClick={closeEditor} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200" title="Close (Esc)"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setEditorTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
              editorTab === tab.id
                ? 'border-b-2 border-claude-500 text-claude-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-claude-500 border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* CONTENT TAB */}
          {editorTab === 'content' && (
            <div className="flex flex-1 flex-col gap-4 p-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">Description</label>
                <input type="text" value={description} onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-claude-600 focus:ring-1 focus:ring-claude-600" />
              </div>
              <div className="flex flex-1 flex-col">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Task Prompt (SKILL.md)</label>
                  <span className="text-[10px] text-zinc-600">{content.length} chars</span>
                </div>
                <textarea value={content} onChange={(e) => { setContent(e.target.value); setHasChanges(true); }} className="flex-1 min-h-[300px] resize-none rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-300 outline-none focus:border-claude-600 focus:ring-1 focus:ring-claude-600" spellCheck={false} />
              </div>
            </div>
          )}

          {/* SCHEDULE TAB */}
          {editorTab === 'schedule' && (
            <div className="flex flex-col gap-5 p-4">
              {/* Enable/Disable toggle */}
              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Power className={`h-5 w-5 ${isEnabled ? 'text-green-500' : 'text-zinc-500'}`} />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{isEnabled ? 'Enabled' : 'Disabled'}</p>
                    <p className="text-xs text-zinc-500">{isEnabled ? 'Task runs automatically' : 'Task will not run automatically'}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setIsEnabled(!isEnabled); handleScheduleUpdate('enabled', !isEnabled); }}
                  className={`relative h-6 w-11 rounded-full transition ${isEnabled ? 'bg-green-600' : 'bg-zinc-700'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${isEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Cron editor */}
              <CronEditor
                value={cronExpression}
                onChange={(v) => { setCronExpression(v); handleScheduleUpdate('cronExpression', v); }}
              />

              {/* Schedule info */}
              {schedule && (
                <div className="space-y-3">
                  {schedule.schedule && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                      <p className="text-xs text-zinc-500">Human-readable schedule</p>
                      <p className="mt-1 text-sm text-zinc-200">{schedule.schedule}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                      <p className="text-[10px] uppercase text-zinc-600">Last Run</p>
                      <p className="mt-1 text-xs text-zinc-300">
                        {schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString() : 'Never'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                      <p className="text-[10px] uppercase text-zinc-600">Next Run</p>
                      <p className="mt-1 text-xs text-zinc-300">
                        {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : 'Not scheduled'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {editorTab === 'history' && (
            <div className="p-4">
              {!taskHistory || taskHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                  <History className="h-8 w-8 text-zinc-700 mb-2" />
                  <p className="text-sm">No execution history</p>
                  <p className="text-xs text-zinc-600 mt-1">History will appear after the task runs</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {taskHistory.map((record) => (
                    <div key={record.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 px-3 py-2">
                      <span className={`h-2 w-2 rounded-full ${record.status === 'success' ? 'bg-green-500' : record.status === 'failed' ? 'bg-red-500' : 'bg-blue-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-300">{new Date(record.startedAt).toLocaleString()}</p>
                        {record.error && <p className="text-[10px] text-red-400 truncate mt-0.5">{record.error}</p>}
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        {record.durationMs ? `${(record.durationMs / 1000).toFixed(1)}s` : '\u2014'}
                      </span>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">{record.trigger}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CONFIG TAB */}
          {editorTab === 'config' && selectedTaskId && (
            <TaskConfigPanel taskId={selectedTaskId} />
          )}
        </div>
      )}
    </aside>
  );
}
