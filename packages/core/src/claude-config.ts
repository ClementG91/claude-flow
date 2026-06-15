import { promises as fs } from 'node:fs';
import { findClaudeScheduleFiles } from './claude-sync.js';

/**
 * Represents a single task entry in Claude Desktop's scheduled-tasks.json.
 */
export interface ClaudeDesktopTaskConfig {
  id: string;
  cronExpression?: string;
  fireAt?: string;
  enabled: boolean;
  filePath: string;
  model?: string;
  createdAt?: number;
  lastRunAt?: string;
  lastScheduledFor?: string;
  notifySessionId?: string;
  disableJitter?: boolean;
  userSelectedFolders?: string[];
  chromePermissionMode?: string;
  chromeAllowedDomains?: string[];
  approvedPermissions?: Array<{ toolName: string }>;
}

interface ClaudeScheduledTasksFile {
  scheduledTasks: ClaudeDesktopTaskConfig[];
}

/**
 * Fields that can be updated via the UI.
 */
export interface TaskConfigUpdate {
  model?: string;
  chromePermissionMode?: string | null;
  enabled?: boolean;
  disableJitter?: boolean;
}

/**
 * Load Claude Desktop's scheduled-tasks.json config.
 * Finds all schedule files and merges them, preferring the most recent version
 * of each task (by lastRunAt).
 * Returns the tasks map and the file path of the most recently modified file
 * (used for writing updates back).
 */
export async function loadClaudeDesktopConfig(): Promise<{
  tasks: Map<string, ClaudeDesktopTaskConfig>;
  filePath: string | null;
}> {
  const files = await findClaudeScheduleFiles();
  const allTasks = new Map<string, ClaudeDesktopTaskConfig>();
  let latestFile: string | null = null;
  let latestMtime = 0;

  for (const file of files) {
    try {
      const raw = await fs.readFile(file, 'utf-8');
      const data = JSON.parse(raw) as ClaudeScheduledTasksFile;
      const stat = await fs.stat(file);

      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs;
        latestFile = file;
      }

      for (const task of data.scheduledTasks ?? []) {
        const existing = allTasks.get(task.id);
        if (
          !existing ||
          (task.lastRunAt && (!existing.lastRunAt || task.lastRunAt > existing.lastRunAt))
        ) {
          allTasks.set(task.id, task);
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return { tasks: allTasks, filePath: latestFile };
}

/**
 * Get Claude Desktop config for a single task.
 * Matches by task ID first, then falls back to matching the taskId
 * within the filePath (since Claude Desktop IDs may differ from SKILL.md folder names).
 */
export async function getTaskConfig(
  taskId: string
): Promise<ClaudeDesktopTaskConfig | null> {
  const { tasks } = await loadClaudeDesktopConfig();

  // Direct ID match
  const direct = tasks.get(taskId);
  if (direct) return direct;

  // Fallback: check if taskId appears in any task's filePath
  // e.g. taskId="cold-email-outreach" matches filePath="...\\cold-email-outreach\\SKILL.md"
  for (const task of tasks.values()) {
    if (task.filePath) {
      const normalized = task.filePath.replace(/\\/g, '/');
      if (normalized.includes(`/${taskId}/`)) {
        return task;
      }
    }
  }

  return null;
}

/**
 * Update specific fields of a task's config in Claude Desktop's scheduled-tasks.json.
 * Reads the file, applies the updates, and writes it back.
 */
export async function updateTaskConfig(
  taskId: string,
  updates: TaskConfigUpdate
): Promise<ClaudeDesktopTaskConfig | null> {
  const { filePath } = await loadClaudeDesktopConfig();
  if (!filePath) {
    throw new Error('No scheduled-tasks.json file found');
  }

  // Read the actual file we will write back to
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw) as ClaudeScheduledTasksFile;

  // Match by ID first, then fallback to filePath containing taskId
  let taskIndex = (data.scheduledTasks ?? []).findIndex((t) => t.id === taskId);
  if (taskIndex === -1) {
    taskIndex = (data.scheduledTasks ?? []).findIndex((t) => {
      if (!t.filePath) return false;
      return t.filePath.replace(/\\/g, '/').includes(`/${taskId}/`);
    });
  }
  if (taskIndex === -1) {
    return null;
  }

  const task = data.scheduledTasks[taskIndex];

  // Apply updates
  if (updates.model !== undefined) {
    task.model = updates.model;
  }
  if (updates.chromePermissionMode !== undefined) {
    if (updates.chromePermissionMode === null) {
      delete (task as unknown as Record<string, unknown>).chromePermissionMode;
    } else {
      task.chromePermissionMode = updates.chromePermissionMode;
    }
  }
  if (updates.enabled !== undefined) {
    task.enabled = updates.enabled;
  }
  if (updates.disableJitter !== undefined) {
    task.disableJitter = updates.disableJitter;
  }

  data.scheduledTasks[taskIndex] = task;

  // Write back
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

  return task;
}
