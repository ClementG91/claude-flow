import { router } from './trpc.js';
import { tasksRouter } from './procedures/tasks.js';
import { workflowsRouter } from './procedures/workflows.js';
import { scheduleRouter } from './procedures/schedule.js';
import { historyRouter } from './procedures/history.js';
import { settingsRouter } from './procedures/settings.js';
import { claudeDesktopRouter } from './procedures/claude-desktop.js';

export const appRouter = router({
  tasks: tasksRouter,
  workflows: workflowsRouter,
  schedule: scheduleRouter,
  history: historyRouter,
  settings: settingsRouter,
  claudeDesktop: claudeDesktopRouter,
});

export type AppRouter = typeof appRouter;
