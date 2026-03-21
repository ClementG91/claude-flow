import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  type Connection,
  type Node,
  type Edge,
  type EdgeChange,
  type EdgeMouseHandler,
  MarkerType,
} from '@xyflow/react';
import { Map as MapIcon, EyeOff, FolderOpen } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { TaskNode, type TaskNodeData } from './TaskNode';
import { trpc } from '../lib/trpc';
import { useWorkflowStore } from '../stores/workflow';

/** Workflow group label node rendered as a header */
function WorkflowLabelNode({ data }: { data: { label: string; taskCount: number } }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-900/80 px-4 py-2 shadow-lg">
      <div className="h-2 w-2 rounded-full bg-claude-500" />
      <span className="text-sm font-semibold text-zinc-200">{data.label}</span>
      <span className="text-[10px] text-zinc-500">{data.taskCount} tasks</span>
    </div>
  );
}

const nodeTypes = {
  task: TaskNode,
  workflowLabel: WorkflowLabelNode,
};

/** Edge condition type matching the backend schema */
type EdgeCondition = 'always' | 'on-success' | 'on-failure';

/** Color map for edge conditions */
const EDGE_COLORS: Record<EdgeCondition, string> = {
  'always': '#71717a',     // zinc-500
  'on-success': '#22c55e', // green-500
  'on-failure': '#ef4444', // red-500
};

const EDGE_LABELS: Record<EdgeCondition, string> = {
  'always': '',
  'on-success': 'success',
  'on-failure': 'failure',
};

/**
 * Auto-layout tasks in a grid when no saved positions exist.
 */
function autoLayout(taskIds: string[]): Record<string, { x: number; y: number }> {
  const cols = 3;
  const spacingX = 320;
  const spacingY = 200;

  const positions: Record<string, { x: number; y: number }> = {};
  taskIds.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[id] = { x: col * spacingX + 50, y: row * spacingY + 50 };
  });
  return positions;
}

/**
 * Style an edge based on its condition.
 */
function getEdgeStyle(condition?: EdgeCondition) {
  const c = condition ?? 'always';
  return {
    stroke: EDGE_COLORS[c],
    strokeWidth: 2,
  };
}

/**
 * Edge context menu component for condition selection.
 */
function EdgeContextMenu({
  x,
  y,
  edgeId,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  edgeId: string;
  onSelect: (edgeId: string, action: EdgeCondition | 'delete') => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const items: { label: string; value: EdgeCondition | 'delete'; color?: string }[] = [
    { label: 'Always', value: 'always' },
    { label: 'On Success', value: 'on-success', color: '#22c55e' },
    { label: 'On Failure', value: 'on-failure', color: '#ef4444' },
    { label: 'Delete connection', value: 'delete', color: '#ef4444' },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <div key={item.value}>
          {i === 3 && <div className="my-1 border-t border-zinc-800" />}
          <button
            onClick={() => {
              onSelect(edgeId, item.value);
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            {item.color && item.value !== 'delete' && (
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            )}
            {!item.color && item.value !== 'delete' && (
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-500" />
            )}
            {item.value === 'delete' && (
              <span className="text-red-400">&#x2715;</span>
            )}
            <span className={item.value === 'delete' ? 'text-red-400' : ''}>
              {item.label}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

export function Canvas() {
  const { data: tasks } = trpc.tasks.list.useQuery();
  const { data: workflows } = trpc.workflows.list.useQuery();
  const { data: scheduleData } = trpc.schedule.getAll.useQuery();
  const { selectTask, activeWorkflowId, minimapVisible, toggleMinimap } = useWorkflowStore();

  const utils = trpc.useUtils();
  const updateLayoutMutation = trpc.workflows.updateLayout.useMutation({
    onSuccess: () => {
      utils.workflows.list.invalidate();
    },
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Debounce timer ref for position saves
  const savePositionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edge context menu state
  const [edgeMenu, setEdgeMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);

  // Ref to track current edges for saving (avoids stale closures)
  const edgesRef = useRef<Edge[]>([]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Ref to track current nodes for saving
  const nodesRef = useRef<Node[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // ----- Helper: save edges to backend -----
  const saveEdges = useCallback(
    (edgesToSave: Edge[]) => {
      if (!activeWorkflowId) return;
      const workflowEdges = edgesToSave.map((e) => ({
        id: e.id,
        sourceTaskId: e.source,
        targetTaskId: e.target,
        condition: (e.data?.condition as EdgeCondition) ?? 'always',
        label: e.label as string | undefined,
      }));
      updateLayoutMutation.mutate({ id: activeWorkflowId, edges: workflowEdges });
    },
    [activeWorkflowId, updateLayoutMutation],
  );

  // ----- Helper: save node positions to backend (debounced) -----
  const savePositions = useCallback(
    (currentNodes: Node[]) => {
      if (!activeWorkflowId) return;
      if (savePositionTimer.current) clearTimeout(savePositionTimer.current);

      savePositionTimer.current = setTimeout(() => {
        const positions: Record<string, { x: number; y: number }> = {};
        currentNodes.forEach((n) => {
          positions[n.id] = { x: n.position.x, y: n.position.y };
        });
        updateLayoutMutation.mutate({ id: activeWorkflowId, nodePositions: positions });
      }, 500);
    },
    [activeWorkflowId, updateLayoutMutation],
  );

  // Auto-layout mutation for workflows with edges but no nodePositions
  const autoLayoutMutation = trpc.workflows.autoLayout.useMutation({
    onSuccess: () => {
      utils.workflows.list.invalidate();
    },
  });
  const autoLayoutTriggered = useRef<Set<string>>(new Set());

  // Convert tasks to nodes
  useEffect(() => {
    if (!tasks) return;

    const activeWorkflow = activeWorkflowId
      ? workflows?.find((w) => w.id === activeWorkflowId)
      : workflows?.[0];
    const savedPositions = activeWorkflow?.nodePositions ?? {};
    const edges = activeWorkflow?.edges ?? [];

    // Collect all task IDs referenced by this workflow (nodePositions + edges)
    let workflowTaskIds: Set<string> | null = null;
    if (activeWorkflowId && activeWorkflow) {
      workflowTaskIds = new Set([
        ...Object.keys(savedPositions),
        ...edges.flatMap((e) => [e.sourceTaskId, e.targetTaskId]),
      ]);
    }

    // If workflow has edges but missing nodePositions, trigger auto-layout
    if (
      activeWorkflowId &&
      edges.length > 0 &&
      Object.keys(savedPositions).length < (workflowTaskIds?.size ?? 0) &&
      !autoLayoutTriggered.current.has(activeWorkflowId)
    ) {
      autoLayoutTriggered.current.add(activeWorkflowId);
      autoLayoutMutation.mutate({ id: activeWorkflowId });
    }

    // Filter tasks: show workflow tasks (from both positions and edges) or all
    const visibleTasks = workflowTaskIds
      ? tasks.filter((t) => workflowTaskIds!.has(t.taskId))
      : tasks;

    let newNodes: Node[];

    if (!activeWorkflowId && workflows && workflows.length > 0) {
      // "All Tasks" view: group tasks by workflow visually
      const cols = 3;
      const spacingX = 320;
      const spacingY = 200;
      const groupGap = 60; // gap between workflow groups
      const labelHeight = 50;
      const allNodes: Node[] = [];

      // Build a map: taskId -> workflow name
      const taskToWorkflow = new Map<string, string>();
      for (const wf of workflows) {
        const wfTaskIds = new Set([
          ...Object.keys(wf.nodePositions ?? {}),
          ...(wf.edges ?? []).flatMap((e) => [e.sourceTaskId, e.targetTaskId]),
        ]);
        for (const id of wfTaskIds) {
          taskToWorkflow.set(id, wf.name);
        }
      }

      // Group tasks by workflow, preserving workflow order
      const groups: Array<{ name: string; tasks: typeof visibleTasks }> = [];
      const seen = new Set<string>();
      for (const wf of workflows) {
        const wfTaskIds = new Set([
          ...Object.keys(wf.nodePositions ?? {}),
          ...(wf.edges ?? []).flatMap((e) => [e.sourceTaskId, e.targetTaskId]),
        ]);
        const groupTasks = visibleTasks.filter((t) => wfTaskIds.has(t.taskId));
        if (groupTasks.length > 0) {
          groups.push({ name: wf.name, tasks: groupTasks });
          groupTasks.forEach((t) => seen.add(t.taskId));
        }
      }
      // Unassigned tasks
      const unassigned = visibleTasks.filter((t) => !seen.has(t.taskId));
      if (unassigned.length > 0) {
        groups.push({ name: 'Unassigned', tasks: unassigned });
      }

      let currentY = 50;
      for (const group of groups) {
        // Add label node
        allNodes.push({
          id: `label-${group.name}`,
          type: 'workflowLabel',
          position: { x: 50, y: currentY },
          data: { label: group.name, taskCount: group.tasks.length },
          draggable: false,
          selectable: false,
        });
        currentY += labelHeight;

        // Add task nodes in grid
        group.tasks.forEach((task, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const schedule = scheduleData?.schedules?.[task.taskId];
          allNodes.push({
            id: task.taskId,
            type: 'task' as const,
            position: { x: col * spacingX + 50, y: currentY + row * spacingY },
            data: {
              taskId: task.taskId,
              description: task.frontmatter.description,
              contentPreview: task.content.slice(0, 100),
              cronExpression: schedule?.cronExpression,
              schedule: schedule?.schedule,
              enabled: schedule?.enabled,
              readonly: task.readonly,
              nextRunAt: schedule?.nextRunAt,
              lastRunAt: schedule?.lastRunAt,
            } satisfies TaskNodeData,
          });
        });
        const rows = Math.ceil(group.tasks.length / cols);
        currentY += rows * spacingY + groupGap;
      }

      newNodes = allNodes;
    } else {
      // Specific workflow view
      const fallbackPositions = autoLayout(visibleTasks.map((t) => t.taskId));

      newNodes = visibleTasks.map((task) => {
        const schedule = scheduleData?.schedules?.[task.taskId];

        return {
          id: task.taskId,
          type: 'task' as const,
          position: savedPositions[task.taskId] ?? fallbackPositions[task.taskId] ?? { x: 0, y: 0 },
          data: {
            taskId: task.taskId,
            description: task.frontmatter.description,
            contentPreview: task.content.slice(0, 100),
            cronExpression: schedule?.cronExpression,
            schedule: schedule?.schedule,
            enabled: schedule?.enabled,
            readonly: task.readonly,
            nextRunAt: schedule?.nextRunAt,
            lastRunAt: schedule?.lastRunAt,
          } satisfies TaskNodeData,
        };
      });
    }

    setNodes(newNodes);

    // Only show edges when a specific workflow is selected (not "All Tasks")
    if (activeWorkflowId && activeWorkflow?.edges) {
      const newEdges: Edge[] = activeWorkflow.edges.map((e) => ({
        id: e.id,
        source: e.sourceTaskId,
        target: e.targetTaskId,
        type: 'smoothstep',
        label: EDGE_LABELS[e.condition ?? 'always'] || undefined,
        animated: true,
        style: getEdgeStyle(e.condition),
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f0760c', width: 18, height: 18 },
        data: { condition: e.condition ?? 'always' },
      }));
      setEdges(newEdges);
    } else {
      setEdges([]);
    }
  }, [tasks, workflows, scheduleData, activeWorkflowId, setNodes, setEdges]);

  // ----- onNodeDragStop: persist positions -----
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, allNodes: Node[]) => {
      savePositions(allNodes);
    },
    [savePositions],
  );

  // ----- onConnect: add edge and persist -----
  const onConnect = useCallback(
    (connection: Connection) => {
      const condition: EdgeCondition = 'always';
      const newEdge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}`,
        animated: true,
        style: getEdgeStyle(condition),
        data: { condition },
      };
      setEdges((eds: Edge[]) => {
        const updated = addEdge(newEdge, eds);
        // Save after state update via setTimeout so edgesRef is current
        setTimeout(() => saveEdges(updated), 0);
        return updated;
      });
    },
    [setEdges, saveEdges],
  );

  // ----- onEdgesChange: detect deletions and persist -----
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      const hasRemoval = changes.some((c) => c.type === 'remove');
      if (hasRemoval && activeWorkflowId) {
        // After React Flow processes the removal, save the remaining edges
        setTimeout(() => {
          saveEdges(edgesRef.current);
        }, 0);
      }
    },
    [onEdgesChange, activeWorkflowId, saveEdges],
  );

  // ----- Edge right-click context menu -----
  const onEdgeContextMenu: EdgeMouseHandler = useCallback(
    (event, edge) => {
      event.preventDefault();
      setEdgeMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
    },
    [],
  );

  const handleEdgeMenuSelect = useCallback(
    (edgeId: string, action: EdgeCondition | 'delete') => {
      if (action === 'delete') {
        setEdges((eds) => {
          const updated = eds.filter((e) => e.id !== edgeId);
          setTimeout(() => saveEdges(updated), 0);
          return updated;
        });
      } else {
        setEdges((eds) => {
          const updated = eds.map((e) =>
            e.id === edgeId
              ? {
                  ...e,
                  style: getEdgeStyle(action),
                  label: EDGE_LABELS[action] || undefined,
                  data: { ...e.data, condition: action },
                }
              : e,
          );
          setTimeout(() => saveEdges(updated), 0);
          return updated;
        });
      }
    },
    [setEdges, saveEdges],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectTask(node.id);
    },
    [selectTask],
  );

  // Close edge menu on pane click
  const onPaneClick = useCallback(() => {
    setEdgeMenu(null);
  }, []);

  // Empty state when no tasks exist
  if (tasks && tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <FolderOpen className="h-12 w-12 text-zinc-700" />
          <div>
            <p className="text-lg font-medium text-zinc-400">No tasks detected</p>
            <p className="mt-2 max-w-sm text-sm text-zinc-500 leading-relaxed">
              Create scheduled tasks in Claude Desktop, then click the refresh button to sync them here.
              You can also update the tasks directory in Settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#f0760c', width: 18, height: 18 },
          style: { stroke: '#f0760c', strokeWidth: 2 },
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="bg-zinc-950"
        deleteKeyCode="Delete"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#27272a" />
        <Controls className="!bg-zinc-900 !border-zinc-700" />
        {minimapVisible && (
          <MiniMap
            nodeColor={() => '#f0760c'}
            maskColor="rgba(0,0,0,0.7)"
            className="!bg-zinc-900"
          />
        )}
        {/* Minimap toggle button */}
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={toggleMinimap}
            className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-zinc-400 shadow-lg transition hover:bg-zinc-800 hover:text-zinc-200"
            title={minimapVisible ? 'Hide minimap' : 'Show minimap'}
          >
            {minimapVisible ? <EyeOff className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
          </button>
        </div>
      </ReactFlow>

      {/* Edge context menu */}
      {edgeMenu && (
        <EdgeContextMenu
          x={edgeMenu.x}
          y={edgeMenu.y}
          edgeId={edgeMenu.edgeId}
          onSelect={handleEdgeMenuSelect}
          onClose={() => setEdgeMenu(null)}
        />
      )}
    </>
  );
}
