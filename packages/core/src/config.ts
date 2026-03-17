import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ClaudeFlowConfig } from './types.js';

const CONFIG_DIR = '.claude-flow';
const CONFIG_FILE = 'config.json';

/**
 * Simple async mutex to prevent concurrent writes to config.json.
 */
let writeLock: Promise<void> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeLock.then(() => fn(), () => fn());
  // Update the lock chain — swallow errors so the chain never rejects
  writeLock = next.then(() => {}, () => {});
  return next;
}

/**
 * Get the default Claude scheduled-tasks directory path.
 * Handles Windows, macOS, and Linux.
 */
export function getDefaultTasksDirectory(): string {
  const home = os.homedir();
  return path.join(home, '.claude', 'scheduled-tasks');
}

/**
 * Get the claude-flow config directory path.
 */
export function getConfigDirectory(): string {
  const home = os.homedir();
  return path.join(home, CONFIG_DIR);
}

/**
 * Get the full config file path.
 */
export function getConfigFilePath(): string {
  return path.join(getConfigDirectory(), CONFIG_FILE);
}

/**
 * Load the claude-flow configuration.
 * Creates a default config if none exists.
 */
export async function loadConfig(): Promise<ClaudeFlowConfig> {
  const configPath = getConfigFilePath();

  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(raw) as ClaudeFlowConfig;
  } catch {
    // Return default config
    return getDefaultConfig();
  }
}

/**
 * Save the claude-flow configuration.
 * Uses a write lock to prevent concurrent writes from corrupting the file.
 */
export async function saveConfig(config: ClaudeFlowConfig): Promise<void> {
  return withWriteLock(async () => {
    const configDir = getConfigDirectory();
    await fs.mkdir(configDir, { recursive: true });

    const configPath = getConfigFilePath();
    const tmp = configPath + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(config, null, 2), 'utf-8');
    await fs.rename(tmp, configPath);
  });
}

/**
 * Atomically read-modify-write the config.
 * The entire cycle (load → mutate → save) runs under a single lock,
 * preventing concurrent mutations from overwriting each other.
 */
export async function modifyConfig(
  fn: (config: ClaudeFlowConfig) => void | Promise<void>
): Promise<ClaudeFlowConfig> {
  return withWriteLock(async () => {
    const configPath = getConfigFilePath();
    let config: ClaudeFlowConfig;
    try {
      const raw = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(raw) as ClaudeFlowConfig;
    } catch {
      config = getDefaultConfig();
    }

    await fn(config);

    const configDir = getConfigDirectory();
    await fs.mkdir(configDir, { recursive: true });
    const tmp = configPath + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(config, null, 2), 'utf-8');
    await fs.rename(tmp, configPath);

    return config;
  });
}

/**
 * Get the default configuration.
 */
export function getDefaultConfig(): ClaudeFlowConfig {
  return {
    tasksDirectory: getDefaultTasksDirectory(),
    port: 3710,
    workflows: [],
  };
}
