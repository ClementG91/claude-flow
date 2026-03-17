import { CheckCircle2, XCircle, Clock, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useWorkflowStore } from '../stores/workflow';

function formatDuration(ms?: number): string {
  if (!ms) return '\u2014';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatTime(iso?: string): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso?: string): string {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ExecutionTimeline() {
  const expanded = useWorkflowStore((s) => s.timelineExpanded);
  const toggleTimeline = useWorkflowStore((s) => s.toggleTimeline);
  const { data: records, isLoading } = trpc.history.recent.useQuery({ limit: 30 });

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case 'running':
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-zinc-500" />;
    }
  };

  return (
    <div
      className={`border-t border-zinc-800 bg-zinc-950 transition-all ${expanded ? 'h-56' : 'h-10'}`}
    >
      {/* Header bar */}
      <button
        onClick={toggleTimeline}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          Execution History
          {records && records.length > 0 && (
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px]">
              {records.length}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5" />
        )}
      </button>

      {/* History list */}
      {expanded && (
        <div className="h-[calc(100%-40px)] overflow-y-auto px-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            </div>
          ) : !records || records.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-600">No execution history yet</p>
          ) : (
            <div className="flex flex-col gap-0.5 pb-2">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-1.5 transition hover:bg-zinc-900"
                >
                  {statusIcon(record.status)}
                  <span className="w-12 text-[11px] text-zinc-500">
                    {formatTime(record.startedAt)}
                  </span>
                  <span className="text-xs font-medium text-zinc-300">{record.taskId}</span>
                  <span className="text-[10px] text-zinc-600">
                    {formatDuration(record.durationMs)}
                  </span>
                  <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                    {record.trigger}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {formatDate(record.startedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
