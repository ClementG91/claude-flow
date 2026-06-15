import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  findClaudeScheduleFiles,
  getClaudeDiscoveryDiagnostics,
} from '../src/claude-sync.js';
import { listDetectedModels } from '../src/claude-config.js';

let tempDir = '';
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;

async function writeSchedule(root: string, sessionDir: string, name: string, data: unknown) {
  const dir = path.join(root, sessionDir, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'scheduled-tasks.json'), JSON.stringify(data, null, 2), 'utf-8');
}

describe('Claude schedule discovery', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-flow-'));
    process.env.CLAUDE_CONFIG_DIR = tempDir;
    delete process.env.XDG_CONFIG_HOME;
  });

  afterEach(async () => {
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
    process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('finds scheduled tasks in known and wildcard session directories', async () => {
    await writeSchedule(tempDir, 'claude-code-sessions', 'a', { scheduledTasks: [] });
    await writeSchedule(tempDir, 'custom-runtime-sessions', 'b', { scheduledTasks: [] });

    const files = await findClaudeScheduleFiles();

    expect(files).toHaveLength(2);
    expect(files.some((f) => f.includes('claude-code-sessions'))).toBe(true);
    expect(files.some((f) => f.includes('custom-runtime-sessions'))).toBe(true);
  });

  it('returns discovery diagnostics including roots, session directories and files', async () => {
    await writeSchedule(tempDir, 'local-agent-mode-sessions', 'session-1', { scheduledTasks: [] });

    const diagnostics = await getClaudeDiscoveryDiagnostics();

    expect(diagnostics.roots).toContain(tempDir);
    expect(diagnostics.sessionDirs.some((dir) => dir.includes('local-agent-mode-sessions'))).toBe(true);
    expect(diagnostics.scheduleFiles).toHaveLength(1);
  });

  it('extracts detected model IDs from scheduled tasks', async () => {
    await writeSchedule(tempDir, 'claude-code-sessions', 'models', {
      scheduledTasks: [
        { id: 'a', enabled: true, filePath: '/tmp/a/SKILL.md', model: 'claude-sonnet-4-6' },
        { id: 'b', enabled: true, filePath: '/tmp/b/SKILL.md', model: 'claude-opus-4-6' },
        { id: 'c', enabled: true, filePath: '/tmp/c/SKILL.md', model: 'claude-sonnet-4-6' },
      ],
    });

    const models = await listDetectedModels();

    expect(models).toEqual([
      { id: 'claude-opus-4-6', label: 'Claude Opus 4 6' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4 6' },
    ]);
  });
});
