import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createTaskFile, updateTaskFile, deleteTaskFile, serializeSkillFile } from '../src/writer.js';
import { parseSkillFile } from '../src/parser.js';

describe('serializeSkillFile', () => {
  it('should serialize frontmatter and content', () => {
    const result = serializeSkillFile(
      { name: 'test-task', description: 'A test task' },
      'Task content here.'
    );

    expect(result).toContain('name: test-task');
    expect(result).toContain('description: A test task');
    expect(result).toContain('Task content here.');
  });

  it('should produce parseable output (round-trip)', () => {
    const frontmatter = { name: 'round-trip', description: 'Round trip test' };
    const content = '## Steps\n\n1. First\n2. Second';

    const serialized = serializeSkillFile(frontmatter, content);
    const parsed = parseSkillFile(serialized, '/test/SKILL.md', 'round-trip');

    expect(parsed.frontmatter.name).toBe('round-trip');
    expect(parsed.frontmatter.description).toBe('Round trip test');
    expect(parsed.content).toContain('## Steps');
  });
});

describe('createTaskFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-flow-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should create a new task directory and SKILL.md', async () => {
    const filePath = await createTaskFile(tmpDir, {
      taskId: 'new-task',
      description: 'A new task',
      content: '## Instructions\n\nDo something.',
    });

    expect(filePath).toContain('new-task');
    expect(filePath).toContain('SKILL.md');

    const raw = await fs.readFile(filePath, 'utf-8');
    expect(raw).toContain('name: new-task');
    expect(raw).toContain('description: A new task');
    expect(raw).toContain('## Instructions');
  });

  it('should throw if task already exists', async () => {
    await createTaskFile(tmpDir, {
      taskId: 'existing-task',
      description: 'First',
      content: 'First content',
    });

    await expect(
      createTaskFile(tmpDir, {
        taskId: 'existing-task',
        description: 'Second',
        content: 'Second content',
      })
    ).rejects.toThrow('already exists');
  });
});

describe('updateTaskFile', () => {
  it('should update description only', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-flow-test-'));
    try {
      await createTaskFile(tmpDir, {
        taskId: 'update-me',
        description: 'Original description',
        content: 'Original content',
      });

      await updateTaskFile(tmpDir, {
        taskId: 'update-me',
        description: 'Updated description',
      });

      const raw = await fs.readFile(path.join(tmpDir, 'update-me', 'SKILL.md'), 'utf-8');
      expect(raw).toContain('Updated description');
      expect(raw).toContain('Original content');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('should update content only', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-flow-test-'));
    try {
      await createTaskFile(tmpDir, {
        taskId: 'update-me',
        description: 'Original description',
        content: 'Original content',
      });

      await updateTaskFile(tmpDir, {
        taskId: 'update-me',
        content: 'New content here',
      });

      const raw = await fs.readFile(path.join(tmpDir, 'update-me', 'SKILL.md'), 'utf-8');
      expect(raw).toContain('Original description');
      expect(raw).toContain('New content here');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('should update both description and content', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-flow-test-'));
    try {
      await createTaskFile(tmpDir, {
        taskId: 'update-me',
        description: 'Original description',
        content: 'Original content',
      });

      await updateTaskFile(tmpDir, {
        taskId: 'update-me',
        description: 'New desc',
        content: 'New content',
      });

      const raw = await fs.readFile(path.join(tmpDir, 'update-me', 'SKILL.md'), 'utf-8');
      expect(raw).toContain('New desc');
      expect(raw).toContain('New content');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('deleteTaskFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-flow-test-'));
    await createTaskFile(tmpDir, {
      taskId: 'delete-me',
      description: 'To be deleted',
      content: 'Bye',
    });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should delete the task directory', async () => {
    await deleteTaskFile(tmpDir, 'delete-me');

    const exists = await fs.access(path.join(tmpDir, 'delete-me')).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it('should not throw if task does not exist', async () => {
    await expect(deleteTaskFile(tmpDir, 'nonexistent')).resolves.not.toThrow();
  });
});
