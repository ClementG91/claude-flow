import { useState } from 'react';
import { GitBranch, Plus, Trash2, Copy, Edit2, Check, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '../lib/trpc';
import { useWorkflowStore } from '../stores/workflow';

export function WorkflowPanel() {
  const { data: workflows, isLoading } = trpc.workflows.list.useQuery();
  const utils = trpc.useUtils();
  const { activeWorkflowId, setActiveWorkflow, openConfirmDialog } = useWorkflowStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const createMutation = trpc.workflows.create.useMutation({
    onSuccess: (wf) => {
      utils.workflows.list.invalidate();
      setActiveWorkflow(wf.id);
      setIsCreating(false);
      setNewName('');
    },
  });

  const deleteMutation = trpc.workflows.delete.useMutation({
    onSuccess: () => {
      utils.workflows.list.invalidate();
      setActiveWorkflow(null);
      toast.success('Workflow deleted');
    },
  });

  const updateMutation = trpc.workflows.update.useMutation({
    onSuccess: () => {
      utils.workflows.list.invalidate();
      setEditingId(null);
    },
  });

  const duplicateMutation = trpc.workflows.duplicate.useMutation({
    onSuccess: () => utils.workflows.list.invalidate(),
  });

  const { data: suggestions } = trpc.workflows.suggestFromTasks.useQuery();
  const [isOrganizing, setIsOrganizing] = useState(false);

  const autoOrganize = async () => {
    if (!suggestions?.suggestions.length) return;
    setIsOrganizing(true);
    try {
      for (const s of suggestions.suggestions) {
        await createMutation.mutateAsync({ name: s.name, description: s.description });
      }
      toast.success(`Created ${suggestions.suggestions.length} workflow(s)`);
    } finally {
      setIsOrganizing(false);
    }
  };

  return (
    <div className="border-b border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-claude-500" />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Workflows
          </span>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-claude-500"
          title="Create workflow"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="flex items-center gap-1 px-3 pb-2">
          <input
            autoFocus
            type="text"
            placeholder="Workflow name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                createMutation.mutate({ name: newName.trim() });
              }
              if (e.key === 'Escape') setIsCreating(false);
            }}
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-claude-600"
          />
          <button
            onClick={() => newName.trim() && createMutation.mutate({ name: newName.trim() })}
            className="rounded p-1 text-green-500 hover:bg-zinc-800"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setIsCreating(false)}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Unassigned tasks banner */}
      {(suggestions?.unassigned.length ?? 0) > 0 && (
        <div className="mx-3 mb-2 flex items-center justify-between rounded-lg bg-amber-500/10 px-2.5 py-1.5">
          <span className="text-[10px] text-amber-400">
            {suggestions!.unassigned.length} unassigned task{suggestions!.unassigned.length !== 1 ? 's' : ''}
          </span>
          {(suggestions?.suggestions.length ?? 0) > 0 && (
            <button
              onClick={autoOrganize}
              disabled={isOrganizing}
              className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-50"
            >
              <Zap className="h-2.5 w-2.5" />
              {isOrganizing ? 'Creating...' : 'Auto-organize'}
            </button>
          )}
        </div>
      )}

      {/* Workflow list */}
      <div className="max-h-32 overflow-y-auto">
        {/* "All tasks" default option */}
        <button
          onClick={() => setActiveWorkflow(null)}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-zinc-900 ${
            activeWorkflowId === null ? 'bg-zinc-900 text-claude-500' : 'text-zinc-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${activeWorkflowId === null ? 'bg-claude-500' : 'bg-zinc-600'}`}
          />
          All Tasks
        </button>

        {workflows?.map((wf) => (
          <div
            key={wf.id}
            className={`group flex items-center gap-1 px-3 py-1.5 transition hover:bg-zinc-900 ${
              activeWorkflowId === wf.id ? 'bg-zinc-900' : ''
            }`}
          >
            {editingId === wf.id ? (
              <div className="flex flex-1 items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      updateMutation.mutate({ id: wf.id, name: editName });
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs text-zinc-200 outline-none"
                />
                <button
                  onClick={() => updateMutation.mutate({ id: wf.id, name: editName })}
                  className="text-green-500"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button onClick={() => setEditingId(null)} className="text-zinc-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setActiveWorkflow(wf.id)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${activeWorkflowId === wf.id ? 'bg-claude-500' : 'bg-zinc-600'}`}
                  />
                  <span
                    className={`truncate text-xs ${activeWorkflowId === wf.id ? 'text-claude-500' : 'text-zinc-400'}`}
                  >
                    {wf.name}
                  </span>
                  <span className="text-[10px] text-zinc-600">{new Set([...Object.keys(wf.nodePositions ?? {}), ...(wf.edges ?? []).flatMap((e: { sourceTaskId: string; targetTaskId: string }) => [e.sourceTaskId, e.targetTaskId])]).size} tasks</span>
                </button>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setEditingId(wf.id);
                      setEditName(wf.name);
                    }}
                    className="rounded p-0.5 text-zinc-500 hover:text-zinc-300"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => duplicateMutation.mutate({ id: wf.id })}
                    className="rounded p-0.5 text-zinc-500 hover:text-zinc-300"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() =>
                      openConfirmDialog({
                        title: 'Delete Workflow',
                        message: `Are you sure you want to delete "${wf.name}"? This action cannot be undone.`,
                        variant: 'danger',
                        onConfirm: () => deleteMutation.mutate({ id: wf.id }),
                      })
                    }
                    className="rounded p-0.5 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
