import { describe, it, expect } from 'vitest';
import { parseSkillFile, extractSummary } from '../src/parser.js';

describe('parseSkillFile', () => {
  it('should parse a valid SKILL.md with frontmatter', () => {
    const raw = `---
name: daily-planning
description: Daily morning planning task
---

## Steps

1. Fetch current state
2. Generate planning
3. Post results`;

    const result = parseSkillFile(raw, '/path/to/SKILL.md', 'daily-planning');

    expect(result.taskId).toBe('daily-planning');
    expect(result.frontmatter.name).toBe('daily-planning');
    expect(result.frontmatter.description).toBe('Daily morning planning task');
    expect(result.content).toContain('## Steps');
    expect(result.content).toContain('1. Fetch current state');
    expect(result.filePath).toBe('/path/to/SKILL.md');
  });

  it('should handle missing name in frontmatter by using taskId', () => {
    const raw = `---
description: Some task
---

Content here.`;

    const result = parseSkillFile(raw, '/path/SKILL.md', 'my-task');
    expect(result.frontmatter.name).toBe('my-task');
  });

  it('should handle missing description in frontmatter', () => {
    const raw = `---
name: test-task
---

Content here.`;

    const result = parseSkillFile(raw, '/path/SKILL.md', 'test-task');
    expect(result.frontmatter.description).toBe('');
  });

  it('should handle empty frontmatter', () => {
    const raw = `---
---

Just content.`;

    const result = parseSkillFile(raw, '/path/SKILL.md', 'fallback-id');
    expect(result.frontmatter.name).toBe('fallback-id');
    expect(result.frontmatter.description).toBe('');
    expect(result.content).toBe('Just content.');
  });

  it('should handle content without frontmatter', () => {
    const raw = `# No frontmatter here

Just plain markdown.`;

    const result = parseSkillFile(raw, '/path/SKILL.md', 'no-front');
    expect(result.frontmatter.name).toBe('no-front');
    expect(result.content).toContain('# No frontmatter here');
  });

  it('should trim content whitespace', () => {
    const raw = `---
name: test
description: test
---

  Content with whitespace

`;

    const result = parseSkillFile(raw, '/path/SKILL.md', 'test');
    expect(result.content).toBe('Content with whitespace');
  });

  it('should handle complex markdown content with code blocks', () => {
    const raw = `---
name: complex-task
description: A task with code blocks
---

## API Call

\`\`\`bash
curl -s "https://example.com/api?key=test"
\`\`\`

## Steps
1. Do this
2. Do that`;

    const result = parseSkillFile(raw, '/path/SKILL.md', 'complex-task');
    expect(result.content).toContain('```bash');
    expect(result.content).toContain('curl -s');
  });
});

describe('extractSummary', () => {
  it('should return full content if shorter than maxLength', () => {
    expect(extractSummary('Short content', 200)).toBe('Short content');
  });

  it('should truncate long content with ellipsis', () => {
    const longContent = 'A'.repeat(300);
    const summary = extractSummary(longContent, 100);
    expect(summary.length).toBeLessThanOrEqual(103); // 100 + "..."
    expect(summary.endsWith('...')).toBe(true);
  });

  it('should strip heading markers', () => {
    const content = `## My Heading\nSome content\n### Sub heading\nMore content`;
    const summary = extractSummary(content);
    expect(summary).not.toContain('##');
    expect(summary).toContain('Some content');
  });
});
