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
} from '@xyflow/react';
import { Map as MapIcon, EyeOff } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { TaskNode, type TaskNodeData } from './TaskNode';
import { trpc } from '../lib/trpc';
import { useWorkflowStore } from '../stores/workflow';

const nodeTypes = {
  task: TaskNode,
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

  // Convert tasks to nodes
  useEffect(() => {
    if (!tasks) return;

    const activeWorkflow = activeWorkflowId
      ? workflows?.find((w) => w.id === activeWorkflowId)
      : workflows?.[0];
    const savedPositions = activeWorkflow?.nodePositions ?? {};

    // Filter tasks by active workflow if one is selected
    const visibleTasks = activeWorkflowId && activeWorkflow
      ? tasks.filter((t) => t.taskId in savedPositions)
      : tasks;

    const fallbackPositions = autoLayout(visibleTasks.map((t) => t.taskId));

    const newNodes: Node[] = visibleTasks.map((task) => {
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
          nextRunAt: schedule?.nextRunAt,
          lastRunAt: schedule?.lastRunAt,
        } satisfies TaskNodeData,
      };
    });

    setNodes(newNodes);

    if (activeWorkflow?.edges) {
      const newEdges: Edge[] = activeWorkflow.edges.map((e) => ({
        id: e.id,
        source: e.sourceTaskId,
        target: e.targetTaskId,
        label: EDGE_LABELS[e.condition ?? 'always'] || undefined,
        animated: true,
        style: getEdgeStyle(e.condition),
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
