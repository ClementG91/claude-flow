/**
 * Represents the frontmatter metadata from a SKILL.md file.
 */
export interface TaskFrontmatter {
  /** Kebab-case task identifier (matches directory name) */
  name: string;
  /** Human-readable one-line description */
  description: string;
}

/**
 * Represents a parsed SKILL.md file from the filesystem.
 */
export interface TaskFile {
  /** Unique task ID (directory name / frontmatter name) */
  taskId: string;
  /** Frontmatter metadata */
  frontmatter: TaskFrontmatter;
  /** Raw markdown content (without frontmatter) */
  content: string;
  /** Full absolute path to the SKILL.md file */
  filePath: string;
}

/**
 * Scheduling metadata from Claude's MCP API.
 * This data is NOT stored in the SKILL.md file.
 */
export interface TaskSchedule {
  /** Human-readable schedule description (e.g., "Every day at 9:00 AM") */
  schedule?: string;
  /** 5-field cron expression in local timezone */
  cronExpression?: string;
  /** ISO 8601 timestamp for one-time tasks */
  fireAt?: string;
  /** Whether automatic runs are enabled */
  enabled: boolean;
  /** ISO timestamp of next scheduled run */
  nextRunAt?: string;
  /** ISO timestamp of last run */
  lastRunAt?: string;
  /** Deterministic jitter in seconds */
  jitterSeconds?: number;
}

/**
 * Complete task combining file data and schedule metadata.
 */
export interface Task extends TaskFile {
  /** Schedule metadata (from MCP API, may be undefined if not available) */
  schedule?: TaskSchedule;
}

/**
 * A connection between two tasks in a workflow.
 */
export interface WorkflowEdge {
  /** Unique edge identifier */
  id: string;
  /** Source task ID */
  sourceTaskId: string;
  /** Target task ID */
  targetTaskId: string;
  /** Edge label/condition */
  label?: string;
  /** Execution condition: when should the target run? */
  condition?: 'always' | 'on-success' | 'on-failure';
}

/**
 * Position of a task node on the visual canvas.
 */
export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Workflow metadata stored locally by claude-flow.
 */
export interface Workflow {
  /** Unique workflow identifier */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** Task node positions on canvas */
  nodePositions: Record<string, NodePosition>;
  /** Connections between tasks */
  edges: WorkflowEdge[];
  /** Key-value variables available to tasks in this workflow (like .env) */
  variables?: Record<string, string>;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * claude-flow local configuration.
 */
export interface ClaudeFlowConfig {
  /** Base path to Claude scheduled tasks directory */
  tasksDirectory: string;
  /** Server port */
  port: number;
  /** Saved workflows */
  workflows: Workflow[];
}

/**
 * Input for creating a new task file.
 */
export interface CreateTaskInput {
  taskId: string;
  description: string;
  content: string;
}

/**
 * Input for updating an existing task file.
 */
export interface UpdateTaskInput {
  taskId: string;
  description?: string;
  content?: string;
}

// === Workflow execution & history types ===

/**
 * Status of a workflow step execution.
 */
export type WorkflowStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

/**
 * Status of an entire workflow execution.
 */
export type WorkflowExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * A single step in a workflow execution.
 */
export interface WorkflowStep {
  taskId: string;
  status: WorkflowStepStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

/**
 * A complete workflow execution run.
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowExecutionStatus;
  steps: WorkflowStep[];
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

/**
 * A record of a single task execution (for history tracking).
 */
export interface ExecutionRecord {
  /** Unique execution ID */
  id: string;
  /** Task that was executed */
  taskId: string;
  /** Execution status */
  status: 'success' | 'failed' | 'running';
  /** When execution started */
  startedAt: string;
  /** When execution completed */
  completedAt?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Error message if failed */
  error?: string;
  /** Which workflow triggered this (if any) */
  workflowId?: string;
  /** Trigger type */
  trigger: 'scheduled' | 'manual' | 'workflow' | 'unknown';
}

/**
 * Cron preset for the visual cron editor.
 */
export interface CronPreset {
  label: string;
  description: string;
  expression: string;
}

/**
 * Predefined cron presets for easy scheduling.
 */
export const CRON_PRESETS: CronPreset[] = [
  { label: 'Every hour', description: 'Runs at the top of every hour', expression: '0 * * * *' },
  { label: 'Every day at 9am', description: 'Runs daily at 9:00 AM', expression: '0 9 * * *' },
  { label: 'Every day at 8pm', description: 'Runs daily at 8:00 PM', expression: '0 20 * * *' },
  { label: 'Weekdays at 9am', description: 'Monday to Friday at 9:00 AM', expression: '0 9 * * 1-5' },
  { label: 'Weekdays at 6pm', description: 'Monday to Friday at 6:00 PM', expression: '0 18 * * 1-5' },
  { label: 'Every Monday at 9am', description: 'Every Monday at 9:00 AM', expression: '0 9 * * 1' },
  { label: 'Every Friday at 6pm', description: 'Every Friday at 6:00 PM', expression: '0 18 * * 5' },
  { label: 'First of month at 10am', description: '1st of every month at 10:00 AM', expression: '0 10 1 * *' },
  { label: 'Every 15 minutes', description: 'Runs every 15 minutes', expression: '*/15 * * * *' },
  { label: 'Every 30 minutes', description: 'Runs every 30 minutes', expression: '*/30 * * * *' },
  { label: 'Twice daily (9am & 6pm)', description: 'Runs at 9:00 AM and 6:00 PM', expression: '0 9,18 * * *' },
  { label: 'Manual only', description: 'No automatic schedule', expression: '' },
];
