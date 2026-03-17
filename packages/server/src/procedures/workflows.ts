import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import { loadConfig, modifyConfig } from '@claude-flow/core';
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
