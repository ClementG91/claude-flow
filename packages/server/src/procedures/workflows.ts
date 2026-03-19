import { z } from 'zod';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { router, publicProcedure } from '../trpc.js';
import { loadConfig, modifyConfig, getConfigDirectory } from '@claude-flow/core';
import type { Workflow } from '@claude-flow/core';

const nodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const workflowEdgeSchema = z.object({
  id: z.string(),
  sourceTaskId: z.string(),
  targetTaskId: z.string(),
  label: z.string().optional(),
  condition: z.enum(['always', 'on-success', 'on-failure']).optional(),
});

export const workflowsRouter = router({
  /**
   * List all saved workflows.
   */
  list: publicProcedure.query(async () => {
    const config = await loadConfig();
    return config.workflows;
  }),

  /**
   * Get a single workflow by ID.
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const config = await loadConfig();
      const workflow = config.workflows.find((w) => w.id === input.id);
      if (!workflow) throw new Error(`Workflow "${input.id}" not found`);
      return workflow;
    }),

  /**
   * Create a new workflow.
   */
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      let created: Workflow | undefined;
      await modifyConfig((config) => {
        const workflow: Workflow = {
          id: crypto.randomUUID(),
          name: input.name,
          description: input.description,
          nodePositions: {},
          edges: [],
          variables: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        config.workflows.push(workflow);
        created = workflow;
      });
      return created!;
    }),

  /**
   * Update workflow layout (node positions and edges).
   */
  updateLayout: publicProcedure
    .input(
      z.object({
        id: z.string(),
        nodePositions: z.record(z.string(), nodePositionSchema).optional(),
        edges: z.array(workflowEdgeSchema).optional(),
      })
    )
    .mutation(async ({ input }) => {
      let result: Workflow | undefined;
      await modifyConfig((config) => {
        const idx = config.workflows.findIndex((w) => w.id === input.id);
        if (idx === -1) throw new Error(`Workflow "${input.id}" not found`);

        if (input.nodePositions) {
          config.workflows[idx].nodePositions = input.nodePositions;
        }
        if (input.edges) {
          config.workflows[idx].edges = input.edges;
        }
        config.workflows[idx].updatedAt = new Date().toISOString();
        result = config.workflows[idx];
      });
      return result!;
    }),

  /**
   * Update workflow metadata (name, description).
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      let result: Workflow | undefined;
      await modifyConfig((config) => {
        const idx = config.workflows.findIndex((w) => w.id === input.id);
        if (idx === -1) throw new Error(`Workflow "${input.id}" not found`);

        if (input.name) config.workflows[idx].name = input.name;
        if (input.description !== undefined) config.workflows[idx].description = input.description;
        config.workflows[idx].updatedAt = new Date().toISOString();
        result = config.workflows[idx];
      });
      return result!;
    }),

  /**
   * Duplicate a workflow.
   */
  duplicate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      let created: Workflow | undefined;
      await modifyConfig((config) => {
        const source = config.workflows.find((w) => w.id === input.id);
        if (!source) throw new Error(`Workflow "${input.id}" not found`);

        const duplicate: Workflow = {
          ...JSON.parse(JSON.stringify(source)),
          id: crypto.randomUUID(),
          name: `${source.name} (copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        config.workflows.push(duplicate);
        created = duplicate;
      });
      return created!;
    }),

  /**
   * Update workflow variables (key-value pairs like .env).
   */
  updateVariables: publicProcedure
    .input(
      z.object({
        id: z.string(),
        variables: z.record(z.string(), z.string()),
      })
    )
    .mutation(async ({ input }) => {
      let result: Workflow | undefined;
      await modifyConfig((config) => {
        const idx = config.workflows.findIndex((w) => w.id === input.id);
        if (idx === -1) throw new Error(`Workflow "${input.id}" not found`);
        config.workflows[idx].variables = input.variables;
        config.workflows[idx].updatedAt = new Date().toISOString();
        result = config.workflows[idx];
      });

      // Write .env file directly in the tasks directory (accessible by Claude Desktop)
      const config = await loadConfig();
      const envPath = path.join(config.tasksDirectory, '.env');
      const envContent = Object.entries(input.variables)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      await fs.writeFile(envPath, envContent + '\n', 'utf-8');

      // Also write to ~/.claude-flow/envs/ as backup
      const envsDir = path.join(getConfigDirectory(), 'envs');
      await fs.mkdir(envsDir, { recursive: true });
      await fs.writeFile(path.join(envsDir, `${input.id}.env`), envContent + '\n', 'utf-8');

      // Inject env reference into SKILL.md files linked to this workflow
      if (result) {
        const taskRefs = new Set<string>();

        // Collect task IDs from workflow nodes and edges
        for (const [taskId] of Object.entries(result.nodePositions)) {
          taskRefs.add(taskId);
        }
        for (const edge of result.edges) {
          if (edge.sourceTaskId) taskRefs.add(edge.sourceTaskId);
          if (edge.targetTaskId) taskRefs.add(edge.targetTaskId);
        }

        const envRefLine = `> **Environment:** Lis les variables depuis \`${envPath.replace(/\\/g, '/')}\` avant de commencer.\n`;

        for (const taskId of taskRefs) {
          const skillPath = path.join(config.tasksDirectory, taskId, 'SKILL.md');
          try {
            let content = await fs.readFile(skillPath, 'utf-8');
            if (content.includes('**Environment:**')) {
              // Update existing reference
              content = content.replace(/> \*\*Environment:\*\*.*\n/, envRefLine);
            } else {
              // Insert after frontmatter (after second ---)
              const fmEnd = content.indexOf('---', content.indexOf('---') + 3);
              if (fmEnd !== -1) {
                const insertPos = content.indexOf('\n', fmEnd) + 1;
                content = content.slice(0, insertPos) + '\n' + envRefLine + content.slice(insertPos);
              }
            }
            await fs.writeFile(skillPath, content, 'utf-8');
          } catch {
            // SKILL.md not found — skip
          }
        }
      }

      return result!;
    }),

  /**
   * Delete a workflow.
   */
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await modifyConfig((config) => {
        config.workflows = config.workflows.filter((w) => w.id !== input.id);
      });
      return { id: input.id, deleted: true };
    }),
});
