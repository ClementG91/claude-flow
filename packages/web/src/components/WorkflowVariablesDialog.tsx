import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Eye, EyeOff, Save, Variable } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useWorkflowStore } from '../stores/workflow';

interface VariableRow {
  key: string;
  value: string;
  visible: boolean;
}

export function WorkflowVariablesDialog() {
  const { activeWorkflowId, variablesDialogOpen, toggleVariablesDialog } = useWorkflowStore();
  const { data: workflows } = trpc.workflows.list.useQuery();
  const utils = trpc.useUtils();

  const activeWorkflow = workflows?.find((w) => w.id === activeWorkflowId);
  const [rows, setRows] = useState<VariableRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const updateMutation = trpc.workflows.updateVariables.useMutation({
    onSuccess: () => {
      utils.workflows.list.invalidate();
      setHasChanges(false);
    },
  });

  // Initialize rows from workflow variables
  useEffect(() => {
    if (!activeWorkflow) return;
    const vars = activeWorkflow.variables ?? {};
    const initialRows = Object.entries(vars).map(([key, value]) => ({
      key,
      value,
      visible: false,
    }));
    setRows(initialRows);
    setHasChanges(false);
  }, [activeWorkflow?.id, activeWorkflow?.variables]);

  if (!variablesDialogOpen || !activeWorkflowId || !activeWorkflow) return null;

  const addRow = () => {
    setRows([...rows, { key: '', value: '', visible: true }]);
    setHasChanges(true);
  };

  const updateRow = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: val };
    setRows(updated);
    setHasChanges(true);
  };

  const toggleVisibility = (index: number) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], visible: !updated[index].visible };
    setRows(updated);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleSave = () => {
    // Convert rows to Record, filtering empty keys
    const variables: Record<string, string> = {};
    const seenKeys = new Set<string>();

    for (const row of rows) {
      const key = row.key.trim();
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);
      variables[key] = row.value;
    }

    updateMutation.mutate({ id: activeWorkflowId, variables });
  };

  const duplicateKeys = rows
    .map((r) => r.key.trim())
    .filter((k, i, arr) => k && arr.indexOf(k) !== i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={toggleVariablesDialog}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Variable className="h-5 w-5 text-claude-500" />
            <h2 className="text-sm font-semibold text-zinc-200">
              Variables — {activeWorkflow.name}
            </h2>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
              {rows.length} var{rows.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={toggleVariablesDialog}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        <div className="border-b border-zinc-800 px-6 py-3">
          <p className="text-xs text-zinc-500">
            Define key-value variables for this workflow. Use <code className="rounded bg-zinc-800 px-1 py-0.5 text-claude-500">{'{{KEY}}'}</code> syntax in task prompts to reference them.
          </p>
        </div>

        {/* Variable rows */}
        <div className="max-h-80 overflow-y-auto px-6 py-4">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Variable className="h-8 w-8 text-zinc-700" />
              <p className="text-sm text-zinc-500">No variables defined</p>
              <p className="text-xs text-zinc-600">Add variables to use across tasks in this workflow</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Header labels */}
              <div className="grid grid-cols-[1fr_1fr_72px] gap-2 px-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Key</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Value</span>
                <span />
              </div>

              {rows.map((row, index) => {
                const isDuplicate = duplicateKeys.includes(row.key.trim());
                return (
                  <div key={index} className="grid grid-cols-[1fr_1fr_72px] gap-2">
                    <input
                      type="text"
                      value={row.key}
                      onChange={(e) => updateRow(index, 'key', e.target.value.replace(/[^A-Za-z0-9_]/g, ''))}
                      placeholder="VARIABLE_NAME"
                      className={`rounded-lg border bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 outline-none transition focus:border-claude-600 ${
                        isDuplicate ? 'border-red-500/50' : 'border-zinc-800'
                      }`}
                    />
                    <div className="relative">
                      <input
                        type={row.visible ? 'text' : 'password'}
                        value={row.value}
                        onChange={(e) => updateRow(index, 'value', e.target.value)}
                        placeholder="value"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 pr-8 font-mono text-xs text-zinc-200 outline-none transition focus:border-claude-600"
                      />
                      <button
                        onClick={() => toggleVisibility(index)}
                        className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
                        title={row.visible ? 'Hide value' : 'Show value'}
                      >
                        {row.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <button
                      onClick={() => removeRow(index)}
                      className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-500 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                      title="Remove variable"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Variable
          </button>

          <div className="flex items-center gap-2">
            {duplicateKeys.length > 0 && (
              <span className="text-[10px] text-red-400">
                Duplicate keys will be merged
              </span>
            )}
            <button
              onClick={toggleVariablesDialog}
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
              {updateMutation.isPending ? 'Saving...' : 'Save Variables'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
