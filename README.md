# Claude Flow

Visual workflow manager for [Claude Desktop](https://claude.ai/download) scheduled tasks — n8n-style task orchestration with a drag-and-drop canvas.

Claude Flow gives you a unified dashboard to manage, connect, and monitor all your Claude Desktop scheduled tasks. Build multi-step automation pipelines by wiring tasks together on a visual canvas, configure permissions and models per task, and track execution history in real time.

## Features

- **Visual Canvas** — Drag-and-drop workflow editor powered by React Flow. Arrange tasks as nodes, connect them with edges, and build automation pipelines visually.
- **Auto-Layout** — Workflows with edges automatically generate node positions using topological sort and hierarchical layout. No manual placement needed.
- **Auto-Detect & Organize** — New tasks from Claude Desktop are detected automatically. Unassigned tasks are grouped by naming convention and surfaced with an "Auto-organize" button to create workflows in one click.
- **Grouped All Tasks View** — The "All Tasks" canvas groups tasks visually by workflow with labeled section headers, giving you a bird's-eye view of your entire automation system.
- **Conditional Edges** — Connect tasks with "always", "on success", or "on failure" conditions. Right-click any edge to change its type or delete it.
- **Collapsible Sidebar** — Toggle the sidebar to maximize canvas space. Sidebar shows task counts per workflow and search across all tasks.
- **Task Editor** — Four-tab editor (Content, Schedule, History, Config) with real-time save, Ctrl+S shortcut, and inline cron builder with 12 presets.
- **Claude Desktop Config** — Control permission mode (ask / auto-accept / plan / skip all), model selection, jitter toggle, and view approved MCP tools — all from the UI.
- **Multi-Directory Discovery** — Automatically discovers tasks from `~/.claude/scheduled-tasks/` and any additional directories referenced in Claude Desktop's config.
- **Workflow Environment Variables** — Define key-value variables per workflow, synced to `.env` files on disk (`~/.claude-flow/envs/{workflowId}.env`). Tasks reference the `.env` file so you can update config from the UI without editing SKILL.md files.
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
| `workflows`      | list, getById, create, update, updateLayout, updateVariables, duplicate, delete, autoLayout, suggestFromTasks |
| `schedule`       | getAll, getByTaskId, updateLocal, syncFromClaudeDesktop, syncFromMcp |
| `settings`       | get, update                                           |
| `claudeDesktop`  | getTaskConfig, updateTaskConfig, listAvailableModels  |

## How It Works

1. **Task Discovery** — On startup, the server scans your `tasksDirectory` for folders containing `SKILL.md` files. It also reads Claude Desktop's `scheduled-tasks.json` to discover tasks in other directories. Unassigned tasks are detected and logged.

2. **Schedule Sync** — Cron expressions and run metadata are imported from Claude Desktop's config and cached locally for fast access. Human-readable schedule descriptions are generated automatically (e.g., "Weekdays at 09:00", "1st of each month at 09:00").

3. **Auto-Layout & Grouping** — When you open a workflow that has edges but no node positions, Claude Flow auto-generates a hierarchical left-to-right layout using topological sort. The "All Tasks" view groups tasks by workflow with labeled headers.

4. **Auto-Detect Workflows** — The `suggestFromTasks` endpoint identifies tasks not in any workflow and groups them by naming prefix (e.g., `veille-*`, `bilan-*`). The UI surfaces an "Auto-organize" button to create suggested workflows with one click.

5. **Visual Editing** — The React Flow canvas lets you position tasks as nodes and draw connections (edges) between them. Positions and edges are persisted to `config.json` with an atomic write lock to prevent corruption.

6. **Config Control** — The Config tab reads and writes directly to Claude Desktop's `scheduled-tasks.json`, letting you change permission modes, models, and jitter settings without opening Claude Desktop.

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

- [x] Auto-layout workflows from edges (topological sort)
- [x] Auto-detect unassigned tasks and suggest workflows
- [x] Grouped "All Tasks" view with workflow headers
- [x] Collapsible sidebar
- [ ] Smart cron suggestions when connecting tasks
- [ ] Task templates and marketplace
- [ ] Integration with Claude Desktop execution logs
- [ ] Workflow execution engine (run tasks in sequence)

## License

[MIT](LICENSE)
