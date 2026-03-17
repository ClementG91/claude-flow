import { useState } from 'react';
import { Clock, ChevronDown } from 'lucide-react';

const CRON_PRESETS = [
  { label: 'Manual only', description: 'No automatic schedule', expression: '' },
  { label: 'Every hour', description: 'Runs at the top of every hour', expression: '0 * * * *' },
  { label: 'Every day at 9am', description: 'Runs daily at 9:00 AM', expression: '0 9 * * *' },
  { label: 'Every day at 8pm', description: 'Runs daily at 8:00 PM', expression: '0 20 * * *' },
  { label: 'Twice daily (9am & 6pm)', description: 'Runs at 9:00 AM and 6:00 PM', expression: '0 9,18 * * *' },
  { label: 'Weekdays at 9am', description: 'Monday to Friday at 9:00 AM', expression: '0 9 * * 1-5' },
  { label: 'Weekdays at 6pm', description: 'Monday to Friday at 6:00 PM', expression: '0 18 * * 1-5' },
  { label: 'Every Monday at 9am', description: 'Every Monday at 9:00 AM', expression: '0 9 * * 1' },
  { label: 'Every Friday at 6pm', description: 'Every Friday at 6:00 PM', expression: '0 18 * * 5' },
  { label: 'First of month at 10am', description: '1st of every month at 10:00 AM', expression: '0 10 1 * *' },
  { label: 'Every 15 minutes', description: 'Runs every 15 minutes', expression: '*/15 * * * *' },
  { label: 'Every 30 minutes', description: 'Runs every 30 minutes', expression: '*/30 * * * *' },
];

interface CronEditorProps {
  value: string;
  onChange: (expression: string) => void;
  disabled?: boolean;
}

export function CronEditor({ value, onChange, disabled }: CronEditorProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  const matchedPreset = CRON_PRESETS.find((p) => p.expression === value);
  const displayLabel = matchedPreset?.label ?? (value ? 'Custom' : 'Manual only');

  return (
    <div className="relative">
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
        Schedule
      </label>

      {/* Preset selector */}
      <button
        onClick={() => !disabled && setShowPresets(!showPresets)}
        disabled={disabled}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-700 disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-claude-500" />
          <span>{displayLabel}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition ${showPresets ? 'rotate-180' : ''}`} />
      </button>

      {/* Preset dropdown */}
      {showPresets && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
          {CRON_PRESETS.map((preset) => (
            <button
              key={preset.expression || '__manual__'}
              onClick={() => {
                onChange(preset.expression);
                setShowPresets(false);
                setIsCustom(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-zinc-800 ${
                value === preset.expression ? 'text-claude-500' : 'text-zinc-300'
              }`}
            >
              <div>
                <p className="font-medium">{preset.label}</p>
                <p className="text-xs text-zinc-500">{preset.description}</p>
              </div>
              {value === preset.expression && (
                <span className="text-claude-500 text-sm">&#10003;</span>
              )}
            </button>
          ))}
          <div className="mt-1 border-t border-zinc-800 pt-1">
            <button
              onClick={() => {
                setIsCustom(true);
                setShowPresets(false);
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Custom expression...
            </button>
          </div>
        </div>
      )}

      {/* Custom cron input */}
      {(isCustom || (!matchedPreset && value)) && (
        <div className="mt-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="*/5 * * * *"
            disabled={disabled}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-200 outline-none focus:border-claude-600"
          />
          <p className="mt-1 text-[10px] text-zinc-600">
            Format: minute hour day-of-month month day-of-week (local time)
          </p>
        </div>
      )}
    </div>
  );
}
