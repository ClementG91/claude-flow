import { ReactFlowProvider } from '@xyflow/react';
import { Toaster } from 'sonner';
import { Header } from './components/Header';
import { Canvas } from './components/Canvas';
import { ListView } from './components/ListView';
import { Sidebar } from './components/Sidebar';
import { TaskEditor } from './components/TaskEditor';
import { WorkflowPanel } from './components/WorkflowPanel';
import { WorkflowToolbar } from './components/WorkflowToolbar';
import { WorkflowVariablesDialog } from './components/WorkflowVariablesDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { useWorkflowStore } from './stores/workflow';

export default function App() {
  const editorOpen = useWorkflowStore((s) => s.editorOpen);
  const viewMode = useWorkflowStore((s) => s.viewMode);
  const activeWorkflowId = useWorkflowStore((s) => s.activeWorkflowId);
  const sidebarCollapsed = useWorkflowStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useWorkflowStore((s) => s.toggleSidebar);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar: workflow panel + task list */}
          <div className={`flex flex-col border-r border-zinc-800 transition-all duration-300 ${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-72'}`}>
            <WorkflowPanel />
            <Sidebar />
          </div>
          {/* Sidebar toggle button */}
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-4 shrink-0 bg-zinc-900 border-r border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="text-xs">{sidebarCollapsed ? '›' : '‹'}</span>
          </button>

          {/* Main content */}
          <div className="flex flex-1 flex-col">
            {activeWorkflowId && <WorkflowToolbar />}
            <main className="flex-1 relative overflow-hidden">
              {viewMode === 'canvas' ? <Canvas /> : <ListView />}
            </main>
          </div>

          {/* Right editor panel */}
          {editorOpen && <TaskEditor />}
        </div>
        <WorkflowVariablesDialog />
        <ConfirmDialog />
        <SettingsDialog />
<Toaster theme="dark" richColors />
      </div>
    </ReactFlowProvider>
  );
}
