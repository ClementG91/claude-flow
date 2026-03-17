import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import {
  loadConfig,
  saveConfig,
  getDefaultTasksDirectory,
  getConfigFilePath,
} from '@claude-flow/core';

export const settingsRouter = router({
  /**
   * Get current settings / config.
   */
  get: publicProcedure.query(async () => {
    const config = await loadConfig();
    return {
      tasksDirectory: config.tasksDirectory,
      port: config.port,
      defaultTasksDirectory: getDefaultTasksDirectory(),
      configFilePath: getConfigFilePath(),
    };
  }),

  /**
   * Update settings. Only tasksDirectory is user-editable at runtime.
   */
  update: publicProcedure
    .input(
      z.object({
        tasksDirectory: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const config = await loadConfig();

      if (input.tasksDirectory) {
        config.tasksDirectory = input.tasksDirectory;
      }

      await saveConfig(config);
      return { success: true };
    }),
});
