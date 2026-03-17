import matter from 'gray-matter';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CreateTaskInput, UpdateTaskInput, TaskFrontmatter } from './types.js';

/**
 * Serialize a TaskFrontmatter + content back to SKILL.md format.
 */
export function serializeSkillFile(frontmatter: TaskFrontmatter, content: string): string {
  return matter.stringify(content, frontmatter);
}

/**
 * Create a new task directory and SKILL.md file.
 * @param basePath - Base scheduled-tasks directory
 * @param input - Task creation input
 * @throws Error if task already exists
 */
export async function createTaskFile(basePath: string, input: CreateTaskInput): Promise<string> {
  const taskDir = path.join(basePath, input.taskId);
  const filePath = path.join(taskDir, 'SKILL.md');

  // Check if already exists
  try {
    await fs.access(filePath);
    throw new Error(`Task "${input.taskId}" already exists at ${filePath}`);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }

  // Create directory and file
  await fs.mkdir(taskDir, { recursive: true });

  const frontmatter: TaskFrontmatter = {
    name: input.taskId,
    description: input.description,
  };

  const fileContent = serializeSkillFile(frontmatter, input.content);
  await fs.writeFile(filePath, fileContent, 'utf-8');

  return filePath;
}

/**
 * Update an existing task's SKILL.md file.
 * @param basePath - Base scheduled-tasks directory
 * @param input - Task update input (partial)
 * @throws Error if task does not exist
 */
export async function updateTaskFile(basePath: string, input: UpdateTaskInput): Promise<string> {
  const filePath = path.join(basePath, input.taskId, 'SKILL.md');

  // Read existing file
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = matter(raw);

  // Build updated frontmatter without mutating parsed.data
  const description = input.description !== undefined ? input.description : (parsed.data.description || '');
  const content = input.content !== undefined ? input.content : parsed.content;

  const frontmatter: TaskFrontmatter = {
    name: parsed.data.name || input.taskId,
    description,
  };

  const fileContent = serializeSkillFile(frontmatter, content);
  await fs.writeFile(filePath, fileContent, 'utf-8');

  return filePath;
}

/**
 * Delete a task directory and its SKILL.md file.
 * @param basePath - Base scheduled-tasks directory
 * @param taskId - Task ID to delete
 */
export async function deleteTaskFile(basePath: string, taskId: string): Promise<void> {
  const taskDir = path.join(basePath, taskId);
  await fs.rm(taskDir, { recursive: true, force: true });
}
