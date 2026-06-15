import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import {
  getTaskConfig,
  updateTaskConfig,
} from '@claude-flow/core';

export const claudeDesktopRouter = router({
  /**
   * Get the full Claude Desktop config for a specific task.
   * Returns model, permissions, chrome mode, folders, jitter, etc.
   */
  getTaskConfig: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      const config = await getTaskConfig(input.taskId);
      if (!config) return null;

      return {
        id: config.id,
        model: config.model ?? null,
        chromePermissionMode: config.chromePermissionMode ?? null,
        chromeAllowedDomains: config.chromeAllowedDomains ?? [],
        enabled: config.enabled,
        disableJitter: config.disableJitter ?? false,
        userSelectedFolders: config.userSelectedFolders ?? [],
        approvedPermissions: (config.approvedPermissions ?? []).map((p) => p.toolName),
        lastScheduledFor: config.lastScheduledFor ?? null,
        filePath: config.filePath,
      };
    }),

  /**
   * Update a task's Claude Desktop config fields.
   * Writes changes directly to the scheduled-tasks.json file.
   */
  updateTaskConfig: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        model: z.string().optional(),
        chromePermissionMode: z.string().nullable().optional(),
        enabled: z.boolean().optional(),
        disableJitter: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { taskId, ...updates } = input;
      const result = await updateTaskConfig(taskId, updates);
      if (!result) {
        throw new Error(`Task "${taskId}" not found in Claude Desktop config`);
      }
      return {
        id: result.id,
        model: result.model ?? null,
        chromePermissionMode: result.chromePermissionMode ?? null,
        enabled: result.enabled,
        disableJitter: result.disableJitter ?? false,
      };
    }),

  /**
   * Return a hardcoded list of available Claude models.
   */
  listAvailableModels: publicProcedure.query(() => {
    return [
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (most capable)' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (recommended)' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fastest)' },
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    ];
  }),
});
