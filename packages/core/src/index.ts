// Types
export type {
  TaskFrontmatter,
  TaskFile,
  TaskSchedule,
  Task,
  WorkflowEdge,
  NodePosition,
  Workflow,
  ClaudeFlowConfig,
  CreateTaskInput,
  UpdateTaskInput,
  WorkflowStepStatus,
  WorkflowExecutionStatus,
  WorkflowStep,
  WorkflowExecution,
  ExecutionRecord,
  CronPreset,
} from './types.js';

export { CRON_PRESETS } from './types.js';

// Parser
export { parseSkillFile, extractSummary } from './parser.js';

// Writer
export { serializeSkillFile, createTaskFile, updateTaskFile, deleteTaskFile } from './writer.js';

// Scanner
export { scanTasks, taskExists } from './scanner.js';

// Config
export {
  getDefaultTasksDirectory,
  getConfigDirectory,
  getConfigFilePath,
  loadConfig,
  saveConfig,
  modifyConfig,
  getDefaultConfig,
} from './config.js';

// Schedule cache
export {
  loadScheduleCache,
  saveScheduleCache,
  updateScheduleCache,
  getTaskSchedule,
  type ScheduleCache,
} from './schedule-cache.js';

// History
export {
  loadHistory,
  saveHistory,
  addExecutionRecord,
  getTaskHistory,
  getRecentHistory,
  clearTaskHistory,
  type ExecutionHistory,
} from './history.js';

// Claude Desktop sync
export {
  findClaudeScheduleFiles,
  syncFromClaudeDesktop,
} from './claude-sync.js';

// Claude Desktop config (read/write scheduled-tasks.json)
export {
  loadClaudeDesktopConfig,
  getTaskConfig,
  updateTaskConfig,
  type ClaudeDesktopTaskConfig,
  type TaskConfigUpdate,
} from './claude-config.js';

// Workflow engine
export {
  resolveExecutionOrder,
  getTaskDependencies,
  getDownstreamTasks,
  isTaskReady,
  createWorkflowExecution,
  detectCycles,
  computeHierarchicalLayout,
  getTaskIdsFromEdges,
} from './workflow-engine.js';
