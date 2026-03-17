import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scanTasks, taskExists } from '../src/scanner.js';
import { createTaskFile } from '../src/writer.js';

describe('scanTasks', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-flow-scan-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should return empty array for empty directory', async () => {
    const tasks = await scanTasks(tmpDir);
    expect(tasks).toEqual([]);
  });

  it('should return empty array for nonexistent directory', async () => {
    const tasks = await scanTasks('/nonexistent/path');
    expect(tasks).toEqual([]);
  });

  it('should find all SKILL.md files', async () => {
    await createTaskFile(tmpDir, { taskId: 'task-a', description: 'Task A', content: 'A' });
    await createTaskFile(tmpDir, { taskId: 'task-b', description: 'Task B', content: 'B' });
    await createTaskFile(tmpDir, { taskId: 'task-c', description: 'Task C', content: 'C' });

    const tasks = await scanTasks(tmpDir);
    expect(tasks).toHaveLength(3);
    expect(tasks.map(t => t.taskId)).toEqual(['task-a', 'task-b', 'task-c']);
  });

  it('should skip directories without SKILL.md', async () => {
    await createTaskFile(tmpDir, { taskId: 'valid', description: 'Valid', content: 'OK' });
    await fs.mkdir(path.join(tmpDir, 'empty-dir'));

    const tasks = await scanTasks(tmpDir);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskId).toBe('valid');
  });

  it('should sort tasks alphabetically', async () => {
    await createTaskFile(tmpDir, { taskId: 'zebra', description: 'Z', content: 'Z' });
    await createTaskFile(tmpDir, { taskId: 'alpha', description: 'A', content: 'A' });
    await createTaskFile(tmpDir, { taskId: 'middle', description: 'M', content: 'M' });

    const tasks = await scanTasks(tmpDir);
    expect(tasks.map(t => t.taskId)).toEqual(['alpha', 'middle', 'zebra']);
  });
});

describe('taskExists', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-flow-exist-'));
    await createTaskFile(tmpDir, { taskId: 'existing', description: 'Exists', content: 'Yes' });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should return true for existing task', async () => {
    expect(await taskExists(tmpDir, 'existing')).toBe(true);
  });

  it('should return false for nonexistent task', async () => {
    expect(await taskExists(tmpDir, 'nonexistent')).toBe(false);
  });
});
