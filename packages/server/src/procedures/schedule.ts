import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import {
  loadScheduleCache,
  saveScheduleCache,
  updateScheduleCache,
  getTaskSchedule,
  syncFromClaudeDesktop,
} from '@claude-flow/core';

export const scheduleRouter = router({
  /**
   * Get all schedule metadata from cache.
   */
  getAll: publicProcedure.query(async () => {
    const cache = await loadScheduleCache();
    return {
      lastSyncedAt: cache.lastSyncedAt,
      schedules: cache.schedules,
    };
  }),

  /**
   * Get schedule metadata for a single task.
   */
  getByTaskId: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      const cache = await loadScheduleCache();
      return getTaskSchedule(cache, input.taskId) ?? null;
    }),

  /**
   * Sync schedule data from Claude Desktop's local files.
   * Scans AppData for scheduled-tasks.json files and populates cache.
   */
  syncFromClaudeDesktop: publicProcedure.mutation(async () => {
    const mcpData = await syncFromClaudeDesktop();
    const existing = await loadScheduleCache();
    const updated = updateScheduleCache(existing, mcpData);
    await saveScheduleCache(updated);
    return {
      synced: mcpData.length,
      lastSyncedAt: updated.lastSyncedAt,
      tasks: mcpData.map((t) => ({
        taskId: t.taskId,
        cronExpression: t.cronExpression,
        enabled: t.enabled,
        schedule: t.schedule,
      })),
    };
  }),

  /**
   * Update schedule cache with MCP data (called from UI sync button).
   * The data should come from the Claude MCP list_scheduled_tasks call.
   */
  syncFromMcp: publicProcedure
    .input(
      z.array(
        z.object({
          taskId: z.string(),
          schedule: z.string().optional(),
          cronExpression: z.string().optional(),
          fireAt: z.string().optional(),
          enabled: z.boolean(),
          nextRunAt: z.string().optional(),
          lastRunAt: z.string().optional(),
          jitterSeconds: z.number().optional(),
        })
      )
    )
    .mutation(async ({ input }) => {
      const existing = await loadScheduleCache();
      const updated = updateScheduleCache(existing, input);
      await saveScheduleCache(updated);
      return { synced: input.length, lastSyncedAt: updated.lastSyncedAt };
    }),

  /**
   * Update a single task's cached schedule (local only, not MCP).
   */
  updateLocal: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        schedule: z.string().optional(),
        cronExpression: z.string().optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const cache = await loadScheduleCache();
      const existing = cache.schedules[input.taskId] ?? { enabled: false };

      cache.schedules[input.taskId] = {
        ...existing,
        ...(input.schedule !== undefined && { schedule: input.schedule }),
        ...(input.cronExpression !== undefined && { cronExpression: input.cronExpression }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
      };

      await saveScheduleCache(cache);
      return cache.schedules[input.taskId];
    }),
});
