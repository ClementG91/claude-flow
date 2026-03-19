import { ReactFlowProvider } from '@xyflow/react';
import { Toaster } from 'sonner';
import { Header } from './components/Header';
import { Canvas } from './components/Canvas';
import { ListView } from './components/ListView';
import { Sidebar } from './components/Sidebar';
import { TaskEditor } from './components/TaskEditor';
import { CreateTaskDialog } from './components/CreateTaskDialog';
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

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar: workflow panel + task list */}
          <div className="flex w-72 flex-col border-r border-zinc-800">
            <WorkflowPanel />
            <Sidebar />
          </div>

          {/* Main content */}
          <div className="flex flex-1 flex-col">
            {activeWorkflowId && <WorkflowToolbar />}
            <main className="flex-1 relative">
              {viewMode === 'canvas' ? <Canvas /> : <ListView />}
            </main>
          </div>

          {/* Right editor panel */}
          {editorOpen && <TaskEditor />}
        </div>
        <CreateTaskDialog />
        <WorkflowVariablesDialog />
        <ConfirmDialog />
        <SettingsDialog />
<Toaster theme="dark" richColors />
      </div>
    </ReactFlowProvider>
  );
}
