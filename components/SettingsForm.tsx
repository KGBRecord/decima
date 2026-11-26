import type { Settings } from '@/lib/types';
import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme';
import { Field, inputCls } from './ui';

const THEMES: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: 'system', label: 'System', icon: Monitor }, { id: 'light', label: 'Light', icon: Sun }, { id: 'dark', label: 'Dark', icon: Moon },
];

function ThemePicker() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  useEffect(() => {
    const sync = () => setPref(getThemePref());
    window.addEventListener('decima-theme', sync);
    return () => window.removeEventListener('decima-theme', sync);
  }, []);
  return (
    <Field label="Theme" hint="System follows your browser or OS setting">
      <div role="group" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-md bg-ink-900 p-1">
        {THEMES.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-pressed={pref === id} onClick={() => { setPref(id); setThemePref(id); }}
            className={clsx('flex cursor-pointer items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium transition',
              pref === id ? 'bg-acc text-on-acc' : 'text-zinc-300 hover:text-fg')}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function SettingsForm({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const num = (v: string, min: number, max: number, d: number) => Math.min(max, Math.max(min, Number(v) || d));
  return (
    <div className="space-y-3">
      <ThemePicker />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Files per message" hint="Discord max: 10">
          <input type="number" min={1} max={10} className={inputCls} value={settings.perMessage}
            onChange={(e) => update({ perMessage: num(e.target.value, 1, 10, 10) })} />
        </Field>
        <Field label="Delay (sec)" hint="Pause between messages">
          <input type="number" min={1} max={120} className={inputCls} value={settings.delaySec}
            onChange={(e) => update({ delaySec: num(e.target.value, 1, 120, 3) })} />
        </Field>
      </div>
      <Field label="Max file size (MB)" hint="Free = 10 MB, Nitro Basic = 50, Nitro = 500">
        <select className={inputCls} value={settings.maxFileMB} onChange={(e) => update({ maxFileMB: Number(e.target.value) })}>
          <option value={10}>10 MB (Free)</option><option value={50}>50 MB (Nitro Basic)</option><option value={500}>500 MB (Nitro)</option>
        </select>
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={settings.skipOversize} onChange={(e) => update({ skipOversize: e.target.checked })} />
        <span>Skip files over the size limit</span>
      </label>
      <Field label="Caption">
        <textarea rows={2} className={inputCls} placeholder="Optional message text sent with files" value={settings.caption}
          onChange={(e) => update({ caption: e.target.value })} />
      </Field>
      <Field label="Attach caption to">
        <select className={inputCls} value={settings.captionMode} onChange={(e) => update({ captionMode: e.target.value as Settings['captionMode'] })}>
          <option value="first">First message only</option><option value="all">Every message</option><option value="none">None</option>
        </select>
      </Field>
    </div>
  );
}
