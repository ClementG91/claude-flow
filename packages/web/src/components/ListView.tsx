import { Clock, FileText, ChevronRight, Power, GitBranch } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useWorkflowStore } from '../stores/workflow';

export function ListView() {
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery();
  const { data: workflows } = trpc.workflows.list.useQuery();
  const { data: scheduleData } = trpc.schedule.getAll.useQuery();
  const { openEditor, selectedTaskId } = useWorkflowStore();

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
          Create scheduled tasks in Claude Desktop, then sync here
        </p>
      </div>
    );
  }

  const schedules = scheduleData?.schedules ?? {};

  // Group tasks by workflow
  const groups: Array<{ name: string; tasks: typeof tasks }> = [];
  const seen = new Set<string>();

  if (workflows) {
    for (const wf of workflows) {
      const wfTaskIds = new Set([
        ...Object.keys(wf.nodePositions ?? {}),
        ...(wf.edges ?? []).flatMap((e) => [e.sourceTaskId, e.targetTaskId]),
      ]);
      const groupTasks = tasks
        .filter((t) => wfTaskIds.has(t.taskId))
        .sort((a, b) => parseCronTime(schedules[a.taskId]?.cronExpression ?? '') - parseCronTime(schedules[b.taskId]?.cronExpression ?? ''));
      if (groupTasks.length > 0) {
        groups.push({ name: wf.name, tasks: groupTasks });
        groupTasks.forEach((t) => seen.add(t.taskId));
      }
    }
  }
  const unassigned = tasks.filter((t) => !seen.has(t.taskId));
  if (unassigned.length > 0) {
    groups.push({ name: 'Unassigned', tasks: unassigned });
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.name}>
            {/* Group header */}
            <div className="mb-3 flex items-center gap-2 px-1">
              <GitBranch className="h-3.5 w-3.5 text-claude-500" />
              <span className="text-sm font-semibold text-zinc-300">{group.name}</span>
              <span className="text-[10px] text-zinc-600">{group.tasks.length} tasks</span>
              <div className="flex-1 border-t border-zinc-800/50" />
            </div>

            {/* Table Header */}
            <div className="mb-1 grid grid-cols-[200px_1fr_180px_80px_30px] gap-4 px-4 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              <span>Task ID</span>
              <span>Description</span>
              <span>Schedule</span>
              <span>Status</span>
              <span></span>
            </div>

            {/* Task rows */}
            <div className="flex flex-col gap-1">
              {group.tasks.map((task) => {
                const sched = schedules[task.taskId];
                const isEnabled = sched?.enabled ?? false;

                return (
                  <button
                    key={task.taskId}
                    onClick={() => openEditor(task.taskId)}
                    className={`group grid grid-cols-[200px_1fr_180px_80px_30px] items-center gap-4 rounded-lg border px-4 py-3 text-left transition ${
                      selectedTaskId === task.taskId
                        ? 'border-claude-500/50 bg-claude-600/10'
                        : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="shrink-0 rounded-md bg-claude-600/20 p-1.5">
                        <FileText className="h-3.5 w-3.5 text-claude-500" />
                      </div>
                      <span className="truncate text-sm font-medium text-zinc-200">
                        {task.taskId}
                      </span>
                    </div>

                    <p className="truncate text-sm text-zinc-400">
                      {task.frontmatter.description || '—'}
                    </p>

                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className="h-3 w-3 shrink-0 text-zinc-500" />
                      <span className="truncate text-xs text-zinc-400">
                        {sched?.schedule ?? sched?.cronExpression ?? 'Manual'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Power className={`h-3 w-3 ${isEnabled ? 'text-green-500' : 'text-zinc-600'}`} />
                      <span className={`text-xs ${isEnabled ? 'text-green-400' : 'text-zinc-600'}`}>
                        {isEnabled ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex items-center justify-end">
                      <ChevronRight className="h-4 w-4 text-zinc-600 transition group-hover:text-zinc-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer stats */}
        <div className="flex items-center justify-between px-4 text-xs text-zinc-600">
          <span>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
          <span>Click to edit</span>
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
