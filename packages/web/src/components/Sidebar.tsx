import { Search, Clock, Plus, Minus, Lock, FolderOpen, Settings } from 'lucide-react';
import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { useWorkflowStore } from '../stores/workflow';

export function Sidebar() {
  const [search, setSearch] = useState('');
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery();
  const { data: workflows } = trpc.workflows.list.useQuery();
  const { selectedTaskId, openEditor, activeWorkflowId } = useWorkflowStore();

  const utils = trpc.useUtils();
  const updateLayoutMutation = trpc.workflows.updateLayout.useMutation({
    onSuccess: () => {
      utils.workflows.list.invalidate();
    },
  });

  const activeWorkflow = activeWorkflowId
    ? workflows?.find((w) => w.id === activeWorkflowId)
    : null;

  // Filter tasks by active workflow first, then by search
  // Include tasks from both nodePositions AND edges
  const workflowTaskIds = activeWorkflow
    ? new Set([
        ...Object.keys(activeWorkflow.nodePositions ?? {}),
        ...(activeWorkflow.edges ?? []).flatMap((e) => [e.sourceTaskId, e.targetTaskId]),
      ])
    : null;
  const workflowTasks = workflowTaskIds
    ? tasks?.filter((t) => workflowTaskIds.has(t.taskId))
    : tasks;

  const filteredTasks = workflowTasks?.filter(
    (t) =>
      t.taskId.toLowerCase().includes(search.toLowerCase()) ||
      t.frontmatter.description.toLowerCase().includes(search.toLowerCase())
  );

  const totalCount = workflowTasks?.length ?? 0;
  const filteredCount = filteredTasks?.length ?? 0;
  const isFiltered = search.length > 0 && filteredCount !== totalCount;

  /** Check if a task is already in the active workflow */
  const isInWorkflow = (taskId: string): boolean => {
    if (!activeWorkflow) return false;
    return taskId in (activeWorkflow.nodePositions ?? {});
  };

  /** Add a task to the active workflow */
  const addToWorkflow = (taskId: string) => {
    if (!activeWorkflowId || !activeWorkflow) return;

    // Calculate a default position: offset from existing nodes
    const existingPositions = activeWorkflow.nodePositions ?? {};
    const count = Object.keys(existingPositions).length;
    const cols = 3;
    const col = count % cols;
    const row = Math.floor(count / cols);
    const defaultPos = { x: col * 320 + 50, y: row * 200 + 50 };

    const newPositions = {
      ...existingPositions,
      [taskId]: defaultPos,
    };

    updateLayoutMutation.mutate({ id: activeWorkflowId, nodePositions: newPositions });
  };

  /** Remove a task from the active workflow */
  const removeFromWorkflow = (taskId: string) => {
    if (!activeWorkflowId || !activeWorkflow) return;

    const existingPositions = { ...(activeWorkflow.nodePositions ?? {}) };
    delete existingPositions[taskId];

    // Also remove edges connected to this task
    const remainingEdges = (activeWorkflow.edges ?? []).filter(
      (e) => e.sourceTaskId !== taskId && e.targetTaskId !== taskId,
    );

    updateLayoutMutation.mutate({
      id: activeWorkflowId,
      nodePositions: existingPositions,
      edges: remainingEdges,
    });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950">
      <div className="border-b border-zinc-800 p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-claude-600 focus:ring-1 focus:ring-claude-600"
          />
          {search.length > 0 && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-xs text-zinc-500 hover:text-zinc-300"
            >
              &#x2715;
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Tasks
        </span>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          {isFiltered ? `${filteredCount} / ${totalCount}` : totalCount}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-claude-500 border-t-transparent" />
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <FolderOpen className="h-8 w-8 text-zinc-600" />
            <div>
              <p className="text-sm font-medium text-zinc-400">No tasks detected</p>
              <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
                Create scheduled tasks in Claude Desktop, or update the tasks directory in
                <button
                  onClick={() => {
                    const { toggleSettingsDialog } = useWorkflowStore.getState();
                    toggleSettingsDialog();
                  }}
                  className="mx-1 inline-flex items-center gap-0.5 text-claude-500 hover:text-claude-400"
                >
                  <Settings className="h-3 w-3" />
                  Settings
                </button>
                to point to your SKILL.md files.
              </p>
            </div>
          </div>
        ) : filteredTasks?.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <p className="text-sm text-zinc-500">No tasks match &quot;{search}&quot;</p>
            <button
              onClick={() => setSearch('')}
              className="text-xs text-claude-500 hover:text-claude-400"
            >
              Clear search
            </button>
          </div>
        ) : (
          <ul className="py-1">
            {filteredTasks?.map((task) => {
              const inWorkflow = isInWorkflow(task.taskId);

              return (
                <li key={task.taskId}>
                  <div
                    className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-zinc-900 ${
                      selectedTaskId === task.taskId
                        ? 'bg-zinc-900 border-l-2 border-claude-500'
                        : 'border-l-2 border-transparent'
                    }`}
                  >
                    <button
                      onClick={() => openEditor(task.taskId)}
                      className="flex flex-1 items-start gap-3 min-w-0"
                    >
                      <div className="mt-0.5 shrink-0">
                        <Clock className={`h-4 w-4 ${
                          selectedTaskId === task.taskId ? 'text-claude-500' : 'text-zinc-500'
                        }`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-200">
                          {task.taskId}
                          {task.readonly && <span title="Read-only (protected folder)"><Lock className="h-3 w-3 shrink-0 text-zinc-500" /></span>}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {task.frontmatter.description}
                        </p>
                      </div>
                    </button>

                    {/* Add/remove from workflow button */}
                    {activeWorkflowId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (inWorkflow) {
                            removeFromWorkflow(task.taskId);
                          } else {
                            addToWorkflow(task.taskId);
                          }
                        }}
                        disabled={updateLayoutMutation.isPending}
                        className={`mt-0.5 shrink-0 rounded p-1 transition ${
                          inWorkflow
                            ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                            : 'text-claude-500 hover:bg-claude-500/10 hover:text-claude-400'
                        } disabled:opacity-50`}
                        title={inWorkflow ? 'Remove from workflow' : 'Add to workflow'}
                      >
                        {inWorkflow ? (
                          <Minus className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
