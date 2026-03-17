import { watch } from 'chokidar';
import type { FSWatcher } from 'chokidar';

export type FileChangeCallback = (event: 'add' | 'change' | 'unlink', path: string) => void;

/**
 * Watch the scheduled-tasks directory for changes.
 * Used to push real-time updates to the web UI.
 */
export function watchTasksDirectory(
  tasksDirectory: string,
  onChange: FileChangeCallback
): FSWatcher {
  const watcher = watch(`${tasksDirectory}/*/SKILL.md`, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher.on('add', (path) => onChange('add', path));
  watcher.on('change', (path) => onChange('change', path));
  watcher.on('unlink', (path) => onChange('unlink', path));

  return watcher;
}
