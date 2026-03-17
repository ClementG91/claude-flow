import type { Workflow, WorkflowEdge, WorkflowExecution, WorkflowStepStatus } from './types.js';

/**
 * Resolve execution order for a workflow using topological sort.
 * Returns task IDs in order they should execute.
 */
export function resolveExecutionOrder(
  edges: WorkflowEdge[],
  allTaskIds: string[]
): string[] {
  // Build adjacency list
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of allTaskIds) {
    graph.set(id, []);
    inDegree.set(id, 0);
  }

  for (const edge of edges) {
    graph.get(edge.sourceTaskId)?.push(edge.targetTaskId);
    inDegree.set(edge.targetTaskId, (inDegree.get(edge.targetTaskId) ?? 0) + 1);
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);

    for (const neighbor of graph.get(node) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  // If order doesn't include all nodes, there's a cycle
  if (order.length !== allTaskIds.length) {
    // Return what we can, skipping cycle nodes
    const remaining = allTaskIds.filter((id) => !order.includes(id));
    return [...order, ...remaining];
  }

  return order;
}

/**
 * Get direct dependencies for a task within a workflow.
 */
export function getTaskDependencies(
  edges: WorkflowEdge[],
  taskId: string
): string[] {
  return edges
    .filter((e) => e.targetTaskId === taskId)
    .map((e) => e.sourceTaskId);
}

/**
 * Get tasks that should run after a given task completes.
 */
export function getDownstreamTasks(
  edges: WorkflowEdge[],
  taskId: string
): Array<{ taskId: string; condition: string }> {
  return edges
    .filter((e) => e.sourceTaskId === taskId)
    .map((e) => ({
      taskId: e.targetTaskId,
      condition: e.condition ?? 'always',
    }));
}

/**
 * Check if a task is ready to run based on its dependencies.
 */
export function isTaskReady(
  edges: WorkflowEdge[],
  taskId: string,
  completedSteps: Map<string, WorkflowStepStatus>
): boolean {
  const deps = getTaskDependencies(edges, taskId);

  if (deps.length === 0) return true;

  return deps.every((depId) => {
    const status = completedSteps.get(depId);
    if (!status) return false;

    const edge = edges.find((e) => e.sourceTaskId === depId && e.targetTaskId === taskId);
    const condition = edge?.condition ?? 'always';

    switch (condition) {
      case 'on-success':
        return status === 'success';
      case 'on-failure':
        return status === 'failed';
      case 'always':
      default:
        return status === 'success' || status === 'failed';
    }
  });
}

/**
 * Create a new workflow execution instance.
 */
export function createWorkflowExecution(workflow: Workflow): WorkflowExecution {
  return {
    id: crypto.randomUUID(),
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: 'pending',
    steps: Object.keys(workflow.nodePositions).map((taskId) => ({
      taskId,
      status: 'pending' as WorkflowStepStatus,
    })),
    startedAt: new Date().toISOString(),
  };
}

/**
 * Detect cycles in the workflow graph.
 */
export function detectCycles(edges: WorkflowEdge[]): string[][] {
  const taskIds = new Set<string>();
  edges.forEach((e) => {
    taskIds.add(e.sourceTaskId);
    taskIds.add(e.targetTaskId);
  });

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    inStack.add(node);
    path.push(node);

    const neighbors = edges
      .filter((e) => e.sourceTaskId === node)
      .map((e) => e.targetTaskId);

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (inStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        cycles.push(path.slice(cycleStart));
      }
    }

    inStack.delete(node);
  }

  for (const id of taskIds) {
    if (!visited.has(id)) {
      dfs(id, []);
    }
  }

  return cycles;
}
