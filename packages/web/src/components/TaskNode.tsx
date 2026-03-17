import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Clock, Play, FileText } from 'lucide-react';
import { useWorkflowStore } from '../stores/workflow';

export interface TaskNodeData {
  taskId: string;
  description: string;
  contentPreview: string;
  cronExpression?: string;
  schedule?: string;
  enabled?: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  [key: string]: unknown;
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) {
    // Future
    const absDiff = Math.abs(diff);
    if (absDiff < 3600000) return `in ${Math.round(absDiff / 60000)}m`;
    if (absDiff < 86400000) return `in ${Math.round(absDiff / 3600000)}h`;
    return `in ${Math.round(absDiff / 86400000)}d`;
  }
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
}

export const TaskNode = memo(function TaskNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as TaskNodeData;
  const { openEditor } = useWorkflowStore();

  const isEnabled = nodeData.enabled !== false;
  const hasSchedule = !!nodeData.cronExpression;

  return (
    <div
      className={`group min-w-[220px] max-w-[280px] rounded-xl border shadow-lg transition-all ${
        selected
          ? 'border-claude-500 shadow-claude-500/20'
          : isEnabled
            ? 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
      } ${!isEnabled ? 'opacity-60' : ''}`}
      onDoubleClick={() => openEditor(nodeData.taskId)}
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl border-b border-zinc-700/50 bg-zinc-800/50 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`rounded-md p-1 ${isEnabled ? 'bg-claude-600/20' : 'bg-zinc-700/30'}`}>
            <FileText className={`h-3.5 w-3.5 ${isEnabled ? 'text-claude-500' : 'text-zinc-500'}`} />
          </div>
          <span className="truncate text-sm font-semibold text-zinc-100">
            {nodeData.taskId}
          </span>
        </div>
        {/* Enabled indicator */}
        <div className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-zinc-600'}`} title={isEnabled ? 'Enabled' : 'Disabled'} />
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-xs text-zinc-400 line-clamp-2">
          {nodeData.description}
        </p>
      </div>

      {/* Schedule info */}
      {hasSchedule && (
        <div className="border-t border-zinc-800/50 px-3 py-1.5">
          <p className="text-[10px] text-zinc-500 truncate">
            {nodeData.schedule ?? nodeData.cronExpression}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between rounded-b-xl border-t border-zinc-800 px-3 py-1.5">
        <div className="flex items-center gap-3">
          {nodeData.lastRunAt && (
            <div className="flex items-center gap-1" title={`Last run: ${nodeData.lastRunAt}`}>
              <Clock className="h-3 w-3 text-zinc-600" />
              <span className="text-[10px] text-zinc-600">{formatRelativeTime(nodeData.lastRunAt)}</span>
            </div>
          )}
          {nodeData.nextRunAt && (
            <div className="flex items-center gap-1" title={`Next run: ${nodeData.nextRunAt}`}>
              <Play className="h-3 w-3 text-green-600" />
              <span className="text-[10px] text-green-600">{formatRelativeTime(nodeData.nextRunAt)}</span>
            </div>
          )}
          {!nodeData.lastRunAt && !nodeData.nextRunAt && (
            <span className="text-[10px] text-zinc-600">{hasSchedule ? 'Scheduled' : 'Manual'}</span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            openEditor(nodeData.taskId);
          }}
          className="rounded p-1 text-zinc-500 opacity-0 transition hover:bg-zinc-700 hover:text-zinc-300 group-hover:opacity-100"
        >
          <Play className="h-3 w-3" />
        </button>
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} className="!bg-claude-500 !border-zinc-900" />
      <Handle type="source" position={Position.Right} className="!bg-claude-500 !border-zinc-900" />
    </div>
  );
});
