import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './router.js';
import { loadConfig, syncFromClaudeDesktop, loadScheduleCache, updateScheduleCache, saveScheduleCache, scanTasks, getTaskIdsFromEdges } from '@claude-flow/core';
import { watchTasksDirectory } from './watcher.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

export { appRouter, type AppRouter } from './router.js';

/**
 * Resolve the web UI dist directory.
 * Looks for the built web package relative to this file.
 */
function resolveWebDist(): string | null {
  // When running from monorepo
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(__dirname, '../../web/dist'),
    path.resolve(__dirname, '../../../packages/web/dist'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Create and configure the Fastify server.
 */
export async function createServer(port?: number) {
  const config = await loadConfig();
  const serverPort = port ?? config.port;

  const server = Fastify({
    logger: true,
  });

  // CORS for local web UI
  await server.register(cors, {
    origin: true,
  });

  // tRPC handler using fetch adapter
  server.all('/trpc/*', async (req, reply) => {
    const url = new URL(req.url, `http://${req.hostname}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }
    const request = new Request(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const response = await fetchRequestHandler({
      endpoint: '/trpc',
      req: request,
      router: appRouter,
      createContext: () => ({}),
    });

    reply.status(response.status);
    response.headers.forEach((value, key) => {
      reply.header(key, value);
    });
    const body = await response.text();
    reply.send(body);
  });

  // Health check endpoint
  server.get('/health', async () => ({
    status: 'ok',
    tasksDir: config.tasksDirectory,
    version: '0.1.0',
  }));

  // Serve web UI static files
  const webDist = resolveWebDist();
  if (webDist) {
    await server.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
    });

    // SPA fallback: serve index.html for client-side routes (non-API, non-asset)
    server.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith('/assets/') || req.url.startsWith('/trpc/') || req.url === '/health') {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });

    server.log.info({ webDist }, 'Serving web UI from static files');
  } else {
    server.log.warn('Web UI dist not found — run "pnpm --filter @claude-flow/web build" first');
  }

  // File watcher for real-time updates
  const watcher = watchTasksDirectory(config.tasksDirectory, (event, filePath) => {
    server.log.info({ event, path: filePath }, 'Task file changed');
  });

  // Cleanup on shutdown
  server.addHook('onClose', async () => {
    await watcher.close();
  });

  // Auto-sync schedule data from Claude Desktop on startup
  try {
    const mcpData = await syncFromClaudeDesktop();
    if (mcpData.length > 0) {
      const existing = await loadScheduleCache();
      const updated = updateScheduleCache(existing, mcpData);
      await saveScheduleCache(updated);
      server.log.info({ count: mcpData.length }, 'Synced schedule data from Claude Desktop');
    }
  } catch (err) {
    server.log.warn({ err }, 'Could not sync schedule data from Claude Desktop');
  }

  // Detect unassigned tasks
  try {
    const tasks = await scanTasks(config.tasksDirectory);
    const assigned = new Set<string>();
    for (const wf of config.workflows) {
      for (const id of Object.keys(wf.nodePositions ?? {})) assigned.add(id);
      for (const id of getTaskIdsFromEdges(wf.edges ?? [])) assigned.add(id);
    }
    const unassigned = tasks.filter((t) => !assigned.has(t.taskId));
    if (unassigned.length > 0) {
      server.log.warn(
        { count: unassigned.length, tasks: unassigned.map((t) => t.taskId) },
        'Unassigned tasks detected — use the UI to organize them into workflows'
      );
    }
  } catch {
    // Non-critical
  }

  return { server, port: serverPort };
}

/**
 * Start the server.
 */
export async function startServer(port?: number) {
  const { server, port: serverPort } = await createServer(port);

  try {
    await server.listen({ port: serverPort, host: '0.0.0.0' });
    return server;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EADDRINUSE') {
      server.log.error(
        `Port ${serverPort} is already in use. Is another instance of claude-flow running?\n` +
        `  → Kill it with: npx kill-port ${serverPort}\n` +
        `  → Or change the port in ~/.claude-flow/config.json`
      );
    } else {
      server.log.error(err);
    }
    process.exit(1);
  }
}

// Auto-start when running directly (tsx watch / node)
const isDirectRun =
  process.argv[1]?.replace(/\\/g, '/').includes('server/src/index') ||
  process.argv[1]?.replace(/\\/g, '/').includes('server/dist/index');

if (isDirectRun) {
  startServer();
}
