import type { Settings } from '@/lib/types';
import { Field, inputCls } from './ui';

export function SettingsForm({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const num = (v: string, min: number, max: number, d: number) => Math.min(max, Math.max(min, Number(v) || d));
  return (
    <div className="space-y-3">
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
