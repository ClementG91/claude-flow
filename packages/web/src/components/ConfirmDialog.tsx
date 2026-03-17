import { AlertTriangle } from 'lucide-react';
import { useWorkflowStore } from '../stores/workflow';

export function ConfirmDialog() {
  const { confirmDialog, closeConfirmDialog } = useWorkflowStore();

  if (!confirmDialog.open) return null;

  const handleConfirm = () => {
    confirmDialog.onConfirm?.();
    closeConfirmDialog();
  };

  const isDanger = confirmDialog.variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeConfirmDialog}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-4 text-center">
          <div
            className={`rounded-full p-3 ${
              isDanger ? 'bg-red-500/10' : 'bg-claude-600/10'
            }`}
          >
            <AlertTriangle
              className={`h-6 w-6 ${isDanger ? 'text-red-400' : 'text-claude-500'}`}
            />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">
            {confirmDialog.title}
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {confirmDialog.message}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-6 py-4">
          <button
            onClick={closeConfirmDialog}
            className="rounded-lg px-4 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`rounded-lg px-4 py-2 text-xs font-medium text-white transition ${
              isDanger
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-claude-600 hover:bg-claude-500'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
