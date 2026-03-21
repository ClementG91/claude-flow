import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { TaskSchedule } from './types.js';

/**
 * Raw scheduled task entry from Claude Desktop's scheduled-tasks.json.
 */
interface ClaudeScheduledTask {
  id: string;
  cronExpression?: string;
  fireAt?: string;
  enabled: boolean;
  filePath: string;
  model?: string;
  createdAt?: number;
  lastRunAt?: string;
  disableJitter?: boolean;
  userSelectedFolders?: string[];
  chromePermissionMode?: string;
  approvedPermissions?: Array<{ toolName: string }>;
}

interface ClaudeScheduledTasksFile {
  scheduledTasks: ClaudeScheduledTask[];
}

/**
 * Find all scheduled-tasks.json files from Claude Desktop sessions.
 * Claude stores these in AppData/Roaming/Claude on Windows,
 * ~/Library/Application Support/Claude on macOS,
 * ~/.config/Claude on Linux.
 */
export async function findClaudeScheduleFiles(): Promise<string[]> {
  const home = os.homedir();
  const platform = os.platform();

  let claudeDir: string;
  if (platform === 'win32') {
    claudeDir = path.join(home, 'AppData', 'Roaming', 'Claude');
  } else if (platform === 'darwin') {
    claudeDir = path.join(home, 'Library', 'Application Support', 'Claude');
  } else {
    claudeDir = path.join(home, '.config', 'Claude');
  }

  const results: string[] = [];

  // Search in both session directories
  const sessionDirs = [
    path.join(claudeDir, 'local-agent-mode-sessions'),
    path.join(claudeDir, 'claude-code-sessions'),
  ];

  for (const sessDir of sessionDirs) {
    try {
      await searchForScheduleFiles(sessDir, results, 0);
    } catch {
      // Directory may not exist
    }
  }

  return results;
}

/**
 * Recursively search for scheduled-tasks.json files (max depth 3).
 */
async function searchForScheduleFiles(
  dir: string,
  results: string[],
  depth: number
): Promise<void> {
  if (depth > 3) return;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isFile() && entry.name === 'scheduled-tasks.json') {
        results.push(fullPath);
      } else if (entry.isDirectory()) {
        await searchForScheduleFiles(fullPath, results, depth + 1);
      }
    }
  } catch {
    // Permission denied or not found
  }
}

/**
 * Read and parse a scheduled-tasks.json file.
 */
async function readScheduleFile(filePath: string): Promise<ClaudeScheduledTask[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw) as ClaudeScheduledTasksFile;
    return data.scheduledTasks ?? [];
  } catch {
    return [];
  }
}

/**
 * Sync schedule data from Claude Desktop's local files.
 * Returns a map of taskId -> TaskSchedule with real cron, enabled, lastRunAt data.
 */
export async function syncFromClaudeDesktop(): Promise<
  Array<{ taskId: string } & TaskSchedule>
> {
  const files = await findClaudeScheduleFiles();
  const allTasks = new Map<string, ClaudeScheduledTask>();

  // Read all files, later files override earlier ones (most recent wins)
  for (const file of files) {
    const tasks = await readScheduleFile(file);
    for (const task of tasks) {
      // Use the most recently updated version
      const existing = allTasks.get(task.id);
      if (!existing || (task.lastRunAt && (!existing.lastRunAt || task.lastRunAt > existing.lastRunAt))) {
        allTasks.set(task.id, task);
      }
    }
  }

  // Convert to our TaskSchedule format
  const results: Array<{ taskId: string } & TaskSchedule> = [];

  for (const [taskId, task] of allTasks) {
    results.push({
      taskId,
      cronExpression: task.cronExpression,
      fireAt: task.fireAt,
      enabled: task.enabled ?? false,
      lastRunAt: task.lastRunAt,
      // Generate human-readable schedule from cron
      schedule: task.cronExpression
        ? describeCron(task.cronExpression)
        : undefined,
    });
  }

  return results;
}

/**
 * Generate a human-readable English description of a cron expression.
 */
function describeCron(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Every N minutes
  if (minute.startsWith('*/')) {
    return `Every ${minute.slice(2)} min`;
  }
  // Every hour
  if (hour === '*' && minute !== '*') {
    return `Every hour at :${minute.padStart(2, '0')}`;
  }

  // Format time — handle multi-hour (e.g. "10,14,18")
  const formatTime = (h: string, m: string): string => {
    if (h.includes(',')) {
      return h.split(',').map((hh) => `${hh.trim()}:${m.padStart(2, '0')}`).join(', ');
    }
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  };

  const timeStr = formatTime(hour, minute);

  if (dayOfMonth === '*' && month === '*') {
    // Daily
    if (dayOfWeek === '*') {
      return `Daily at ${timeStr}`;
    }
    // Weekdays
    if (dayOfWeek === '1-5') {
      return `Weekdays at ${timeStr}`;
    }
    // Weekend
    if (dayOfWeek === '0,6' || dayOfWeek === '6,0') {
      return `Weekends at ${timeStr}`;
    }

    // Comma-separated days (e.g. "1,4" → "Mon & Thu")
    if (dayOfWeek.includes(',')) {
      const dayNames = dayOfWeek.split(',').map((d) => {
        const n = parseInt(d.trim(), 10);
        return (!isNaN(n) && n >= 0 && n <= 6) ? daysShort[n] : d.trim();
      });
      return `${dayNames.join(' & ')} at ${timeStr}`;
    }

    // Single day
    const dayNum = parseInt(dayOfWeek, 10);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      return `Every ${daysFull[dayNum]} at ${timeStr}`;
    }
    return `${dayOfWeek} at ${timeStr}`;
  }

  if (dayOfMonth !== '*' && month === '*') {
    return `${getOrdinal(parseInt(dayOfMonth, 10))} of each month at ${timeStr}`;
  }

  return cron;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
