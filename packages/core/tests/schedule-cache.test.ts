import { describe, it, expect } from 'vitest';
import { updateScheduleCache, getTaskSchedule, type ScheduleCache } from '../src/schedule-cache.js';
import type { TaskSchedule } from '../src/types.js';

function createEmptyCache(): ScheduleCache {
  return { lastSyncedAt: '', schedules: {} };
}

describe('updateScheduleCache', () => {
  it('should add new task schedules to an empty cache', () => {
    const cache = createEmptyCache();
    const mcpData = [
      {
        taskId: 'daily-bilan',
        schedule: 'Every day at 9am',
        cronExpression: '0 9 * * *',
        enabled: true,
        nextRunAt: '2026-03-18T09:00:00Z',
        lastRunAt: '2026-03-17T09:00:00Z',
      },
    ];

    const updated = updateScheduleCache(cache, mcpData);

    expect(updated.schedules['daily-bilan']).toBeDefined();
    expect(updated.schedules['daily-bilan'].cronExpression).toBe('0 9 * * *');
    expect(updated.schedules['daily-bilan'].enabled).toBe(true);
    expect(updated.lastSyncedAt).toBeTruthy();
  });

  it('should merge new data with existing cache entries', () => {
    const cache: ScheduleCache = {
      lastSyncedAt: '2026-03-16T00:00:00Z',
      schedules: {
        'existing-task': {
          schedule: 'Every hour',
          cronExpression: '0 * * * *',
          enabled: true,
        },
      },
    };

    const mcpData = [
      {
        taskId: 'new-task',
        schedule: 'Every day at 8pm',
        cronExpression: '0 20 * * *',
        enabled: false,
      },
    ];

    const updated = updateScheduleCache(cache, mcpData);

    expect(Object.keys(updated.schedules)).toHaveLength(2);
    expect(updated.schedules['existing-task'].cronExpression).toBe('0 * * * *');
    expect(updated.schedules['new-task'].cronExpression).toBe('0 20 * * *');
  });

  it('should overwrite existing entries with fresh MCP data', () => {
    const cache: ScheduleCache = {
      lastSyncedAt: '2026-03-16T00:00:00Z',
      schedules: {
        'my-task': {
          cronExpression: '0 9 * * *',
          enabled: true,
        },
      },
    };

    const mcpData = [
      {
        taskId: 'my-task',
        cronExpression: '0 20 * * *',
        enabled: false,
        lastRunAt: '2026-03-17T09:00:00Z',
      },
    ];

    const updated = updateScheduleCache(cache, mcpData);

    expect(updated.schedules['my-task'].cronExpression).toBe('0 20 * * *');
    expect(updated.schedules['my-task'].enabled).toBe(false);
    expect(updated.schedules['my-task'].lastRunAt).toBe('2026-03-17T09:00:00Z');
  });

  it('should set lastSyncedAt to current ISO timestamp', () => {
    const before = new Date().toISOString();
    const updated = updateScheduleCache(createEmptyCache(), []);
    const after = new Date().toISOString();

    expect(updated.lastSyncedAt >= before).toBe(true);
    expect(updated.lastSyncedAt <= after).toBe(true);
  });

  it('should handle multiple tasks in a single sync', () => {
    const mcpData = [
      { taskId: 'task-a', cronExpression: '0 9 * * *', enabled: true },
      { taskId: 'task-b', cronExpression: '0 18 * * *', enabled: false },
      { taskId: 'task-c', cronExpression: '*/30 * * * *', enabled: true },
    ];

    const updated = updateScheduleCache(createEmptyCache(), mcpData);

    expect(Object.keys(updated.schedules)).toHaveLength(3);
    expect(updated.schedules['task-a'].enabled).toBe(true);
    expect(updated.schedules['task-b'].enabled).toBe(false);
    expect(updated.schedules['task-c'].cronExpression).toBe('*/30 * * * *');
  });
});

describe('getTaskSchedule', () => {
  const cache: ScheduleCache = {
    lastSyncedAt: '2026-03-17T00:00:00Z',
    schedules: {
      'daily-bilan': {
        schedule: 'Every day at 9am',
        cronExpression: '0 9 * * *',
        enabled: true,
        nextRunAt: '2026-03-18T09:00:00Z',
      },
    },
  };

  it('should return schedule for existing task', () => {
    const schedule = getTaskSchedule(cache, 'daily-bilan');
    expect(schedule).toBeDefined();
    expect(schedule!.cronExpression).toBe('0 9 * * *');
    expect(schedule!.enabled).toBe(true);
  });

  it('should return undefined for non-existent task', () => {
    const schedule = getTaskSchedule(cache, 'non-existent');
    expect(schedule).toBeUndefined();
  });

  it('should return undefined from empty cache', () => {
    const schedule = getTaskSchedule(createEmptyCache(), 'any-task');
    expect(schedule).toBeUndefined();
  });
});
