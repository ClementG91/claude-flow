import { create } from 'zustand';

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  variant: 'danger' | 'warning';
  onConfirm: (() => void) | null;
}

interface WorkflowState {
  selectedTaskId: string | null;
  editorOpen: boolean;
  viewMode: 'canvas' | 'list';
  createDialogOpen: boolean;
  /** Currently active workflow ID (null = show all tasks) */
  activeWorkflowId: string | null;
  /** Active tab in task editor */
  editorTab: 'content' | 'schedule' | 'history' | 'config';
  /** Whether timeline panel is expanded */
  timelineExpanded: boolean;
  /** Whether minimap is visible */
  minimapVisible: boolean;
  /** Whether variables dialog is open */
  variablesDialogOpen: boolean;
  /** Confirm dialog state */
  confirmDialog: ConfirmDialogState;
  /** Whether settings dialog is open */
  settingsDialogOpen: boolean;

  selectTask: (taskId: string | null) => void;
  openEditor: (taskId: string) => void;
  closeEditor: () => void;
  setViewMode: (mode: 'canvas' | 'list') => void;
  toggleCreateDialog: () => void;
  setActiveWorkflow: (id: string | null) => void;
  setEditorTab: (tab: 'content' | 'schedule' | 'history' | 'config') => void;
  toggleTimeline: () => void;
  toggleMinimap: () => void;
  toggleVariablesDialog: () => void;
  openConfirmDialog: (opts: { title: string; message: string; variant?: 'danger' | 'warning'; onConfirm: () => void }) => void;
  closeConfirmDialog: () => void;
  toggleSettingsDialog: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  selectedTaskId: null,
  editorOpen: false,
  viewMode: 'canvas',
  createDialogOpen: false,
  activeWorkflowId: null,
  editorTab: 'content',
  timelineExpanded: false,
  minimapVisible: true,
  variablesDialogOpen: false,
  confirmDialog: { open: false, title: '', message: '', variant: 'danger', onConfirm: null },
  settingsDialogOpen: false,

  selectTask: (taskId) => set({ selectedTaskId: taskId }),
  openEditor: (taskId) => set({ selectedTaskId: taskId, editorOpen: true, editorTab: 'content' }),
  closeEditor: () => set({ editorOpen: false }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleCreateDialog: () => set((s) => ({ createDialogOpen: !s.createDialogOpen })),
  setActiveWorkflow: (id) => set({ activeWorkflowId: id }),
  setEditorTab: (tab) => set({ editorTab: tab }),
  toggleTimeline: () => set((s) => ({ timelineExpanded: !s.timelineExpanded })),
  toggleMinimap: () => set((s) => ({ minimapVisible: !s.minimapVisible })),
  toggleVariablesDialog: () => set((s) => ({ variablesDialogOpen: !s.variablesDialogOpen })),
  openConfirmDialog: (opts) =>
    set({
      confirmDialog: {
        open: true,
        title: opts.title,
        message: opts.message,
        variant: opts.variant ?? 'danger',
        onConfirm: opts.onConfirm,
      },
    }),
  closeConfirmDialog: () =>
    set({
      confirmDialog: { open: false, title: '', message: '', variant: 'danger', onConfirm: null },
    }),
  toggleSettingsDialog: () => set((s) => ({ settingsDialogOpen: !s.settingsDialogOpen })),
}));
