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
  let data: Record<string, unknown> = {};
  let content: string;

  try {
    const parsed = matter(raw);
    data = parsed.data as Record<string, unknown>;
    content = parsed.content;
  } catch {
    // If gray-matter fails (e.g. YAML with unquoted colons), fallback to manual parse
    content = raw;
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (fmMatch) {
      content = fmMatch[2];
      for (const line of fmMatch[1].split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          const value = line.slice(colonIdx + 1).trim();
          data[key] = value;
        }
      }
    }
  }

  // If description was parsed as non-string (YAML treats "text: more text" as object),
  // fallback to manual extraction from raw frontmatter
  let description = typeof data.description === 'string' ? data.description : '';
  if (!description) {
    const descMatch = raw.match(/^description:\s*(.+)$/m);
    if (descMatch) description = descMatch[1].trim();
  }

  const frontmatter: TaskFrontmatter = {
    name: typeof data.name === 'string' ? data.name : taskId,
    description,
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
