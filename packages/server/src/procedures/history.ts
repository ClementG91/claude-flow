import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import {
  getRecentHistory,
  getTaskHistory,
  addExecutionRecord,
  clearTaskHistory,
} from '@claude-flow/core';
import type { ExecutionRecord } from '@claude-flow/core';

export const historyRouter = router({
  /**
   * Get recent execution history across all tasks.
   */
  recent: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      return getRecentHistory(input?.limit ?? 50);
    }),

  /**
   * Get execution history for a specific task.
   */
  byTask: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      return getTaskHistory(input.taskId, input.limit);
    }),

  /**
   * Record a new execution (called when a task runs).
   */
  record: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        status: z.enum(['success', 'failed', 'running']),
        startedAt: z.string(),
        completedAt: z.string().optional(),
        durationMs: z.number().optional(),
        error: z.string().optional(),
        workflowId: z.string().optional(),
        trigger: z.enum(['scheduled', 'manual', 'workflow', 'unknown']),
      })
    )
    .mutation(async ({ input }) => {
      const record: ExecutionRecord = {
        id: crypto.randomUUID(),
        ...input,
      };
      await addExecutionRecord(record);
      return record;
    }),

  /**
   * Clear history for a specific task.
   */
  clearByTask: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input }) => {
      await clearTaskHistory(input.taskId);
      return { taskId: input.taskId, cleared: true };
    }),
});
