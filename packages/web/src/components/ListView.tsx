import { Clock, FileText, ChevronRight, Trash2, Power } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '../lib/trpc';
import { useWorkflowStore } from '../stores/workflow';

export function ListView() {
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery();
  const { data: scheduleData } = trpc.schedule.getAll.useQuery();
  const { openEditor, selectedTaskId, openConfirmDialog } = useWorkflowStore();
  const utils = trpc.useUtils();

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      toast.success('Task deleted');
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-claude-500 border-t-transparent" />
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
        <FileText className="h-12 w-12 text-zinc-700" />
        <p className="text-sm">No scheduled tasks found</p>
        <p className="text-xs text-zinc-600">
          Create your first task with the "New Task" button
        </p>
      </div>
    );
  }

  const schedules = scheduleData?.schedules ?? {};

  // Sort tasks by cron time
  const sortedTasks = [...tasks].sort((a, b) => {
    const cronA = schedules[a.taskId]?.cronExpression ?? '';
    const cronB = schedules[b.taskId]?.cronExpression ?? '';
    // Extract hour and minute for sorting
    const timeA = parseCronTime(cronA);
    const timeB = parseCronTime(cronB);
    return timeA - timeB;
  });

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        {/* Table Header */}
        <div className="mb-2 grid grid-cols-[200px_1fr_180px_80px_50px] gap-4 px-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
          <span>Task ID</span>
          <span>Description</span>
          <span>Schedule</span>
          <span>Status</span>
          <span></span>
        </div>

        {/* Task rows */}
        <div className="flex flex-col gap-1">
          {sortedTasks.map((task) => {
            const sched = schedules[task.taskId];
            const isEnabled = sched?.enabled ?? false;

            return (
              <button
                key={task.taskId}
                onClick={() => openEditor(task.taskId)}
                className={`group grid grid-cols-[200px_1fr_180px_80px_50px] items-center gap-4 rounded-lg border px-4 py-3 text-left transition ${
                  selectedTaskId === task.taskId
                    ? 'border-claude-500/50 bg-claude-600/10'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900'
                }`}
              >
                {/* Task ID */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="shrink-0 rounded-md bg-claude-600/20 p-1.5">
                    <FileText className="h-3.5 w-3.5 text-claude-500" />
                  </div>
                  <span className="truncate text-sm font-medium text-zinc-200">
                    {task.taskId}
                  </span>
                </div>

                {/* Description */}
                <p className="truncate text-sm text-zinc-400">
                  {task.frontmatter.description || '—'}
                </p>

                {/* Schedule */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className="h-3 w-3 shrink-0 text-zinc-500" />
                  <span className="truncate text-xs text-zinc-400">
                    {sched?.schedule ?? sched?.cronExpression ?? 'Manuel'}
                  </span>
                </div>

                {/* Status */}
                <div className="flex items-center gap-1.5">
                  <Power className={`h-3 w-3 ${isEnabled ? 'text-green-500' : 'text-zinc-600'}`} />
                  <span className={`text-xs ${isEnabled ? 'text-green-400' : 'text-zinc-600'}`}>
                    {isEnabled ? 'Actif' : 'Inactif'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      openConfirmDialog({
                        title: 'Delete Task',
                        message: `Are you sure you want to delete "${task.taskId}"? This action cannot be undone.`,
                        variant: 'danger',
                        onConfirm: () => deleteMutation.mutate({ taskId: task.taskId }),
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        openConfirmDialog({
                          title: 'Delete Task',
                          message: `Are you sure you want to delete "${task.taskId}"? This action cannot be undone.`,
                          variant: 'danger',
                          onConfirm: () => deleteMutation.mutate({ taskId: task.taskId }),
                        });
                      }
                    }}
                    className="rounded p-1.5 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-600 transition group-hover:text-zinc-400" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer stats */}
        <div className="mt-4 flex items-center justify-between px-4 text-xs text-zinc-600">
          <span>{tasks.length} tâche{tasks.length !== 1 ? 's' : ''}</span>
          <span>Cliquer pour éditer</span>
        </div>
      </div>
    </div>
  );
}

/** Extract a sortable time value from a cron expression (minutes since midnight) */
function parseCronTime(cron: string): number {
  if (!cron) return 9999;
  const parts = cron.split(' ');
  if (parts.length < 2) return 9999;
  const minute = parseInt(parts[0], 10) || 0;
  const hour = parseInt(parts[1], 10) || 0;
  return hour * 60 + minute;
}
