import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { TaskFile } from './types.js';
import { parseSkillFile } from './parser.js';

/**
 * Scan a directory for all SKILL.md task files.
 * @param basePath - Base scheduled-tasks directory (e.g., ~/.claude/scheduled-tasks/)
 * @returns Array of parsed TaskFile objects
 */
export async function scanTasks(basePath: string): Promise<TaskFile[]> {
  const tasks: TaskFile[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(basePath);
  } catch {
    return tasks;
  }

  for (const entry of entries) {
    const taskDir = path.join(basePath, entry);
    const stat = await fs.stat(taskDir).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const skillPath = path.join(taskDir, 'SKILL.md');
    try {
      const raw = await fs.readFile(skillPath, 'utf-8');
      const task = parseSkillFile(raw, skillPath, entry);
      tasks.push(task);
    } catch {
      // Skip directories without SKILL.md
      continue;
    }
  }

  return tasks.sort((a, b) => a.taskId.localeCompare(b.taskId));
}

/**
 * Check if a task exists on the filesystem.
 */
export async function taskExists(basePath: string, taskId: string): Promise<boolean> {
  const skillPath = path.join(basePath, taskId, 'SKILL.md');
  try {
    await fs.access(skillPath);
    return true;
  } catch {
    return false;
  }
}
