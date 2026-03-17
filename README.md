# Claude Flow

Visual workflow manager for [Claude Desktop](https://claude.ai/download) scheduled tasks — n8n-style task orchestration with a drag-and-drop canvas.

Claude Flow gives you a unified dashboard to manage, connect, and monitor all your Claude Desktop scheduled tasks. Build multi-step automation pipelines by wiring tasks together on a visual canvas, configure permissions and models per task, and track execution history in real time.

## Features

- **Visual Canvas** — Drag-and-drop workflow editor powered by React Flow. Arrange tasks as nodes, connect them with edges, and build automation pipelines visually.
- **Conditional Edges** — Connect tasks with "always", "on success", or "on failure" conditions. Right-click any edge to change its type or delete it.
- **Task Editor** — Four-tab editor (Content, Schedule, History, Config) with real-time save, Ctrl+S shortcut, and inline cron builder with 12 presets.
- **Claude Desktop Config** — Control permission mode (ask / auto-accept / plan / skip all), model selection, jitter toggle, and view approved MCP tools — all from the UI.
- **Multi-Directory Discovery** — Automatically discovers tasks from `~/.claude/scheduled-tasks/` and any additional directories referenced in Claude Desktop's config.
- **Execution History** — Timeline view of past runs with status (success / failed / running), trigger source, and duration.
- **Workflow Variables** — Define key-value variables per workflow (like `.env` files) for shared configuration across tasks.
- **List View** — Switch between canvas and list view depending on your preference.
- **Minimap** — Toggle a minimap overlay for navigating large workflows.
- **Dark Theme** — Zinc-based dark UI with Claude orange (#f0760c) accents.

## Architecture

```
claude-flow/
├── packages/
│   ├── core/        # Shared logic: parser, scanner, config, schedule, history
│   ├── server/      # Fastify + tRPC API server (port 3710)
│   └── web/         # React 19 + Vite 6 + React Flow 12 frontend
├── apps/
│   └── cli/         # CLI entry point (start/dev commands)
├── package.json     # pnpm workspace root
└── pnpm-workspace.yaml
```

### Tech Stack

| Layer    | Technology                                    |
| -------- | --------------------------------------------- |
| Frontend | React 19, Vite 6, @xyflow/react 12, Zustand 5 |
| Styling  | Tailwind CSS 3 (dark theme)                   |
| API      | Fastify, tRPC 11 (type-safe RPC)              |
| State    | Zustand 5 + TanStack Query (via tRPC)         |
| Monorepo | pnpm workspaces                               |
| Language | TypeScript throughout                         |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [Claude Desktop](https://claude.ai/download) with at least one scheduled task

### Install

```bash
git clone https://github.com/your-username/claude-flow.git
cd claude-flow
pnpm install
```

### Build

```bash
pnpm build
```

This builds all packages in dependency order: `core` → `server` → `web`.

### Run

```bash
pnpm dev
```

Opens the server at [http://localhost:3710](http://localhost:3710). The web UI is served as static files from the same port.

### Configuration

Claude Flow stores its config at `~/.claude-flow/config.json`:

```json
{
  "tasksDirectory": "~/.claude/scheduled-tasks",
  "port": 3710,
  "workflows": []
}
```

- **tasksDirectory** — Primary directory where Claude Desktop stores scheduled task SKILL.md files.
- **port** — Server port (default 3710).
- **workflows** — Saved workflow definitions (node positions, edges, variables).

Additional task directories are auto-discovered from Claude Desktop's `scheduled-tasks.json`.

## API

The server exposes a tRPC API at `/trpc/*` with the following routers:

| Router           | Endpoints                                             |
| ---------------- | ----------------------------------------------------- |
| `tasks`          | list, getById, create, update, delete, checkId        |
| `workflows`      | list, getById, create, update, updateLayout, updateVariables, duplicate, delete |
| `schedule`       | getAll, getByTaskId, updateLocal, syncFromClaudeDesktop |
| `history`        | recent, byTask, record, clearTaskHistory              |
| `settings`       | get, update                                           |
| `claudeDesktop`  | getTaskConfig, updateTaskConfig, listAvailableModels  |

## How It Works

1. **Task Discovery** — On startup, the server scans your `tasksDirectory` for folders containing `SKILL.md` files. It also reads Claude Desktop's `scheduled-tasks.json` to discover tasks in other directories.

2. **Schedule Sync** — Cron expressions and run metadata are imported from Claude Desktop's config and cached locally for fast access.

3. **Visual Editing** — The React Flow canvas lets you position tasks as nodes and draw connections (edges) between them. Positions and edges are persisted to `config.json` with an atomic write lock to prevent corruption.

4. **Config Control** — The Config tab reads and writes directly to Claude Desktop's `scheduled-tasks.json`, letting you change permission modes, models, and jitter settings without opening Claude Desktop.

## Development

```bash
# Run server in watch mode
pnpm dev

# Build all packages
pnpm build

# Run core tests
pnpm test

# Lint
pnpm lint
```

### Package Scripts

| Package  | `dev`                    | `build`        |
| -------- | ------------------------ | -------------- |
| core     | —                        | tsup           |
| server   | tsx watch src/index.ts   | tsup           |
| web      | vite                     | vite build     |

## Roadmap

- [ ] Task chaining via `claude -p` CLI (trigger downstream tasks on completion)
- [ ] Smart cron suggestions when connecting tasks
- [ ] Workflow execution engine with status tracking
- [ ] Webhook triggers
- [ ] Task templates and marketplace

## License

[MIT](LICENSE)
