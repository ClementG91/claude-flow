import { AlertTriangle, Variable } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useWorkflowStore } from '../stores/workflow';

export function WorkflowToolbar() {
  const { activeWorkflowId, toggleVariablesDialog } = useWorkflowStore();
  const { data: workflows } = trpc.workflows.list.useQuery();

  const activeWorkflow = workflows?.find((w) => w.id === activeWorkflowId);

  if (!activeWorkflow) return null;

  const taskCount = new Set([
    ...Object.keys(activeWorkflow.nodePositions ?? {}),
    ...(activeWorkflow.edges ?? []).flatMap((e: { sourceTaskId: string; targetTaskId: string }) => [e.sourceTaskId, e.targetTaskId]),
  ]).size;
  const edgeCount = activeWorkflow.edges.length;
  const varCount = Object.keys(activeWorkflow.variables ?? {}).length;

  return (
    <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-900/50 px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-300">{activeWorkflow.name}</span>
        <span className="text-[10px] text-zinc-500">
          {taskCount} task{taskCount !== 1 ? 's' : ''} · {edgeCount} connection
          {edgeCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {edgeCount === 0 && taskCount > 1 && (
          <div className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            No connections — connect tasks to create workflow chain
          </div>
        )}

        {/* Variables button */}
        <button
          onClick={toggleVariablesDialog}
          className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
          title="Workflow variables"
        >
          <Variable className="h-3 w-3" />
          Env
          {varCount > 0 && (
            <span className="rounded-full bg-claude-600/20 px-1.5 py-0.5 text-[10px] text-claude-500">
              {varCount}
            </span>
          )}
        </button>

      </div>
    </div>
  );
}
