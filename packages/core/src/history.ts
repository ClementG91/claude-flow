import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getConfigDirectory } from './config.js';
import type { ExecutionRecord } from './types.js';

const HISTORY_FILE = 'execution-history.json';
const MAX_RECORDS = 500;

export interface ExecutionHistory {
  records: ExecutionRecord[];
}

function getHistoryPath(): string {
  return path.join(getConfigDirectory(), HISTORY_FILE);
}

/**
 * Load execution history from disk.
 */
export async function loadHistory(): Promise<ExecutionHistory> {
  try {
    const raw = await fs.readFile(getHistoryPath(), 'utf-8');
    return JSON.parse(raw) as ExecutionHistory;
  } catch {
    return { records: [] };
  }
}

/**
 * Save execution history to disk.
 */
export async function saveHistory(history: ExecutionHistory): Promise<void> {
  const dir = getConfigDirectory();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getHistoryPath(), JSON.stringify(history, null, 2), 'utf-8');
}

/**
 * Add a new execution record.
 */
export async function addExecutionRecord(record: ExecutionRecord): Promise<void> {
  const history = await loadHistory();
  history.records.unshift(record);

  // Trim to max records
  if (history.records.length > MAX_RECORDS) {
    history.records = history.records.slice(0, MAX_RECORDS);
  }

  await saveHistory(history);
}

/**
 * Get execution records for a specific task.
 */
export async function getTaskHistory(
  taskId: string,
  limit: number = 20
): Promise<ExecutionRecord[]> {
  const history = await loadHistory();
  return history.records
    .filter((r) => r.taskId === taskId)
    .slice(0, limit);
}

/**
 * Get recent execution records across all tasks.
 */
export async function getRecentHistory(limit: number = 50): Promise<ExecutionRecord[]> {
  const history = await loadHistory();
  return history.records.slice(0, limit);
}

/**
 * Clear history for a specific task.
 */
export async function clearTaskHistory(taskId: string): Promise<void> {
  const history = await loadHistory();
  history.records = history.records.filter((r) => r.taskId !== taskId);
  await saveHistory(history);
}
