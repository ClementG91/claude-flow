import { describe, it, expect } from 'vitest';
import {
  resolveExecutionOrder,
  getTaskDependencies,
  getDownstreamTasks,
  isTaskReady,
  createWorkflowExecution,
  detectCycles,
} from '../src/workflow-engine.js';
import type { WorkflowEdge, Workflow, WorkflowStepStatus } from '../src/types.js';

function makeEdge(source: string, target: string, condition?: string): WorkflowEdge {
  return {
    id: `${source}->${target}`,
    sourceTaskId: source,
    targetTaskId: target,
    condition: (condition as WorkflowEdge['condition']) ?? undefined,
  };
}

describe('resolveExecutionOrder', () => {
  it('should return all tasks when no edges exist', () => {
    const order = resolveExecutionOrder([], ['a', 'b', 'c']);
    expect(order).toHaveLength(3);
    expect(order).toContain('a');
    expect(order).toContain('b');
    expect(order).toContain('c');
  });

  it('should return tasks in topological order', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];
    const order = resolveExecutionOrder(edges, ['a', 'b', 'c']);

    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });

  it('should handle diamond dependencies', () => {
    //   a
    //  / \
    // b   c
    //  \ /
    //   d
    const edges = [
      makeEdge('a', 'b'),
      makeEdge('a', 'c'),
      makeEdge('b', 'd'),
      makeEdge('c', 'd'),
    ];
    const order = resolveExecutionOrder(edges, ['a', 'b', 'c', 'd']);

    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
  });

  it('should handle cycles gracefully by including cycle nodes at the end', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'a')];
    const order = resolveExecutionOrder(edges, ['a', 'b']);
    expect(order).toHaveLength(2);
  });

  it('should handle a single task', () => {
    const order = resolveExecutionOrder([], ['only']);
    expect(order).toEqual(['only']);
  });
});

describe('getTaskDependencies', () => {
  const edges = [makeEdge('a', 'b'), makeEdge('c', 'b'), makeEdge('b', 'd')];

  it('should return upstream dependencies', () => {
    const deps = getTaskDependencies(edges, 'b');
    expect(deps).toHaveLength(2);
    expect(deps).toContain('a');
    expect(deps).toContain('c');
  });

  it('should return empty array for root tasks', () => {
    expect(getTaskDependencies(edges, 'a')).toHaveLength(0);
    expect(getTaskDependencies(edges, 'c')).toHaveLength(0);
  });

  it('should return empty array for unknown task', () => {
    expect(getTaskDependencies(edges, 'z')).toHaveLength(0);
  });
});

describe('getDownstreamTasks', () => {
  const edges = [
    makeEdge('a', 'b'),
    makeEdge('a', 'c'),
    { ...makeEdge('b', 'd'), condition: 'on-success' as const },
  ];

  it('should return downstream tasks with conditions', () => {
    const downstream = getDownstreamTasks(edges, 'a');
    expect(downstream).toHaveLength(2);
    expect(downstream.map((d) => d.taskId)).toContain('b');
    expect(downstream.map((d) => d.taskId)).toContain('c');
  });

  it('should default condition to "always"', () => {
    const downstream = getDownstreamTasks(edges, 'a');
    expect(downstream.every((d) => d.condition === 'always')).toBe(true);
  });

  it('should pass through edge conditions', () => {
    const downstream = getDownstreamTasks(edges, 'b');
    expect(downstream).toHaveLength(1);
    expect(downstream[0].condition).toBe('on-success');
  });

  it('should return empty array for leaf tasks', () => {
    expect(getDownstreamTasks(edges, 'd')).toHaveLength(0);
  });
});

describe('isTaskReady', () => {
  const edges = [
    makeEdge('a', 'c'),
    { ...makeEdge('b', 'c'), condition: 'on-success' as const },
  ];

  it('should return true for root tasks (no dependencies)', () => {
    expect(isTaskReady(edges, 'a', new Map())).toBe(true);
  });

  it('should return false if dependencies are not completed', () => {
    const completed = new Map<string, WorkflowStepStatus>();
    expect(isTaskReady(edges, 'c', completed)).toBe(false);
  });

  it('should return true when all dependencies are satisfied', () => {
    const completed = new Map<string, WorkflowStepStatus>([
      ['a', 'success'],
      ['b', 'success'],
    ]);
    expect(isTaskReady(edges, 'c', completed)).toBe(true);
  });

  it('should respect on-success condition', () => {
    const completed = new Map<string, WorkflowStepStatus>([
      ['a', 'success'],
      ['b', 'failed'],
    ]);
    // b->c has on-success condition, b failed => not ready
    expect(isTaskReady(edges, 'c', completed)).toBe(false);
  });

  it('should handle on-failure condition', () => {
    const edges2 = [{ ...makeEdge('a', 'b'), condition: 'on-failure' as const }];
    const completedSuccess = new Map<string, WorkflowStepStatus>([['a', 'success']]);
    const completedFailed = new Map<string, WorkflowStepStatus>([['a', 'failed']]);

    expect(isTaskReady(edges2, 'b', completedSuccess)).toBe(false);
    expect(isTaskReady(edges2, 'b', completedFailed)).toBe(true);
  });

  it('should handle "always" condition (runs on success or failure)', () => {
    const edges3 = [{ ...makeEdge('a', 'b'), condition: 'always' as const }];
    const completedSuccess = new Map<string, WorkflowStepStatus>([['a', 'success']]);
    const completedFailed = new Map<string, WorkflowStepStatus>([['a', 'failed']]);

    expect(isTaskReady(edges3, 'b', completedSuccess)).toBe(true);
    expect(isTaskReady(edges3, 'b', completedFailed)).toBe(true);
  });
});

describe('createWorkflowExecution', () => {
  it('should create an execution with pending steps for each task', () => {
    const workflow: Workflow = {
      id: 'wf-1',
      name: 'Test Workflow',
      nodePositions: {
        'task-a': { x: 0, y: 0 },
        'task-b': { x: 100, y: 0 },
      },
      edges: [],
      createdAt: '2026-03-17T00:00:00Z',
      updatedAt: '2026-03-17T00:00:00Z',
    };

    const execution = createWorkflowExecution(workflow);

    expect(execution.workflowId).toBe('wf-1');
    expect(execution.workflowName).toBe('Test Workflow');
    expect(execution.status).toBe('pending');
    expect(execution.steps).toHaveLength(2);
    expect(execution.steps.every((s) => s.status === 'pending')).toBe(true);
    expect(execution.id).toBeTruthy();
    expect(execution.startedAt).toBeTruthy();
  });
});

describe('detectCycles', () => {
  it('should return empty array when no cycles exist', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];
    expect(detectCycles(edges)).toHaveLength(0);
  });

  it('should detect a simple cycle', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'a')];
    const cycles = detectCycles(edges);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should detect cycles in complex graphs', () => {
    const edges = [
      makeEdge('a', 'b'),
      makeEdge('b', 'c'),
      makeEdge('c', 'a'),
    ];
    const cycles = detectCycles(edges);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should handle graph with no edges', () => {
    expect(detectCycles([])).toHaveLength(0);
  });

  it('should not detect false cycles in a DAG', () => {
    // Diamond shape (not a cycle)
    const edges = [
      makeEdge('a', 'b'),
      makeEdge('a', 'c'),
      makeEdge('b', 'd'),
      makeEdge('c', 'd'),
    ];
    expect(detectCycles(edges)).toHaveLength(0);
  });
});
