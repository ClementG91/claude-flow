import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getConfigDirectory } from './config.js';
import type { TaskSchedule } from './types.js';

const CACHE_FILE = 'schedule-cache.json';

export interface ScheduleCache {
  /** When the cache was last synced */
  lastSyncedAt: string;
  /** Schedule metadata per task ID */
  schedules: Record<string, TaskSchedule>;
}

function getCachePath(): string {
  return path.join(getConfigDirectory(), CACHE_FILE);
}

/**
 * Load the schedule cache from disk.
 */
export async function loadScheduleCache(): Promise<ScheduleCache> {
  try {
    const raw = await fs.readFile(getCachePath(), 'utf-8');
    return JSON.parse(raw) as ScheduleCache;
  } catch {
    return { lastSyncedAt: '', schedules: {} };
  }
}

/**
 * Save the schedule cache to disk.
 */
export async function saveScheduleCache(cache: ScheduleCache): Promise<void> {
  const dir = getConfigDirectory();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getCachePath(), JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Update the cache with fresh MCP data.
 * Merges new data into the existing cache — tasks not in the latest sync are preserved.
 * @param existing - Current cache state
 * @param mcpData - Array of task schedule data from MCP list_scheduled_tasks
 */
export function updateScheduleCache(
  existing: ScheduleCache,
  mcpData: Array<{ taskId: string } & TaskSchedule>
): ScheduleCache {
  // Merge with existing so local-only metadata for untouched tasks is preserved.
  const schedules: Record<string, TaskSchedule> = { ...existing.schedules };

  for (const item of mcpData) {
    schedules[item.taskId] = {
      schedule: item.schedule,
      cronExpression: item.cronExpression,
      fireAt: item.fireAt,
      enabled: item.enabled,
      nextRunAt: item.nextRunAt,
      lastRunAt: item.lastRunAt,
      jitterSeconds: item.jitterSeconds,
    };
  }

  return {
    lastSyncedAt: new Date().toISOString(),
    schedules,
  };
}

/**
 * Get schedule metadata for a specific task.
 */
export function getTaskSchedule(
  cache: ScheduleCache,
  taskId: string
): TaskSchedule | undefined {
  return cache.schedules[taskId];
}
