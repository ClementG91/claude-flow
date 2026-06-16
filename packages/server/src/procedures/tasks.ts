import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../trpc.js';
import {
  scanTasks,
  parseSkillFile,
  createTaskFile,
  updateTaskFile,
  deleteTaskFile,
  loadConfig,
  loadClaudeDesktopConfig,
} from '@claude-flow/core';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Wrap fs operations and throw a user-friendly error on EPERM/EACCES */
function handleProtectedFolderError(err: unknown, taskId: string): never {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === 'EPERM' || code === 'EACCES') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Cannot modify "${taskId}": this task is in a Windows-protected folder. It is read-only in claude-flow.`,
    });
  }
  throw err;
}

/**
 * Discover additional task directories from Claude Desktop's scheduled-tasks.json.
 * Returns unique parent directories that differ from the main tasksDirectory.
 */
async function discoverExtraTaskDirs(mainDir: string): Promise<string[]> {
  try {
    const { tasks } = await loadClaudeDesktopConfig();
    const dirs = new Set<string>();
    for (const task of tasks.values()) {
      if (task.filePath) {
        const normalized = task.filePath.replace(/\\/g, '/');
        const match = normalized.match(/^(.+)\/[^/]+\/SKILL\.md$/i);
        if (match) {
          const dir = match[1].replace(/\//g, path.sep);
          const mainNorm = mainDir.replace(/\\/g, '/').replace(/\/+$/, '');
          const dirNorm = match[1].replace(/\/+$/, '');
          if (dirNorm.toLowerCase() !== mainNorm.toLowerCase()) {
            dirs.add(dir);
          }
        }
      }
    }
    return [...dirs];
  } catch {
    return [];
  }
}

/**
 * Resolve the actual base directory where a task lives.
 * Checks the main tasksDirectory first, then extra discovered directories.
 */
async function resolveTaskBaseDir(taskId: string): Promise<string> {
  const config = await loadConfig();

  // Check main directory first
  const mainPath = path.join(config.tasksDirectory, taskId, 'SKILL.md');
  try {
    await fs.access(mainPath);
    return config.tasksDirectory;
  } catch {
    // Not in main dir
  }

  // Check extra directories
  const extraDirs = await discoverExtraTaskDirs(config.tasksDirectory);
  for (const dir of extraDirs) {
    const extraPath = path.join(dir, taskId, 'SKILL.md');
    try {
      await fs.access(extraPath);
      return dir;
    } catch {
      // Not in this dir either
    }
  }

  throw new Error(`Task "${taskId}" not found in any known directory`);
}

export const tasksRouter = router({
  /**
   * List all tasks from the filesystem.
   * Scans the configured tasksDirectory plus any extra directories found in
   * Claude Desktop's scheduled-tasks.json.
   */
  list: publicProcedure.query(async () => {
    const config = await loadConfig();
    const tasks = await scanTasks(config.tasksDirectory);
    const seenIds = new Set(tasks.map((t) => t.taskId));

    // Also scan directories referenced in Claude Desktop config
    const extraDirs = await discoverExtraTaskDirs(config.tasksDirectory);
    for (const dir of extraDirs) {
      const extra = await scanTasks(dir);
      for (const task of extra) {
        if (!seenIds.has(task.taskId)) {
          tasks.push(task);
          seenIds.add(task.taskId);
        }
      }
    }

    return tasks.sort((a, b) => a.taskId.localeCompare(b.taskId));
  }),

  /**
   * Get a single task by ID.
   */
  getById: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      const config = await loadConfig();
      const baseDir = await resolveTaskBaseDir(input.taskId);
      const filePath = path.join(baseDir, input.taskId, 'SKILL.md');
      const raw = await fs.readFile(filePath, 'utf-8');
      const task = parseSkillFile(raw, filePath, input.taskId);
      return task;
    }),

  /**
   * Create a new task.
   */
  create: publicProcedure
    .input(
      z.object({
        taskId: z.string().regex(/^[a-z0-9-]+$/, 'Task ID must be kebab-case'),
        description: z.string().min(1),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const config = await loadConfig();
      const filePath = await createTaskFile(config.tasksDirectory, input);
      return { taskId: input.taskId, filePath };
    }),

  /**
   * Update an existing task.
   */
  update: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        description: z.string().optional(),
        content: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const baseDir = await resolveTaskBaseDir(input.taskId);
        const filePath = await updateTaskFile(baseDir, input);
        return { taskId: input.taskId, filePath };
      } catch (err) {
        handleProtectedFolderError(err, input.taskId);
      }
    }),

  /**
   * Delete a task.
   */
  delete: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const baseDir = await resolveTaskBaseDir(input.taskId);
        await deleteTaskFile(baseDir, input.taskId);
        return { taskId: input.taskId, deleted: true };
      } catch (err) {
        handleProtectedFolderError(err, input.taskId);
      }
    }),

  /**
   * Check if a task ID is available.
   */
  checkId: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      try {
        await resolveTaskBaseDir(input.taskId);
        return { taskId: input.taskId, available: false };
      } catch {
        return { taskId: input.taskId, available: true };
      }
    }),
});
