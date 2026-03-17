import matter from 'gray-matter';
import type { TaskFile, TaskFrontmatter } from './types.js';

/**
 * Parse a SKILL.md file content into a structured TaskFile.
 * @param raw - The raw file content (string)
 * @param filePath - Absolute path to the file
 * @param taskId - The task ID (directory name)
 * @returns Parsed TaskFile
 * @throws Error if frontmatter is invalid
 */
export function parseSkillFile(raw: string, filePath: string, taskId: string): TaskFile {
  const { data, content } = matter(raw);

  const frontmatter: TaskFrontmatter = {
    name: typeof data.name === 'string' ? data.name : taskId,
    description: typeof data.description === 'string' ? data.description : '',
  };

  return {
    taskId,
    frontmatter,
    content: content.trim(),
    filePath,
  };
}

/**
 * Extract a summary (first N characters) from task content.
 * Useful for previews in the UI.
 */
export function extractSummary(content: string, maxLength: number = 200): string {
  const cleaned = content.replace(/^#+\s+.*/gm, '').replace(/\n{2,}/g, '\n').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).trim() + '...';
}
