import { useMemo, useRef, useState, type DragEvent } from 'react';
import { FileUp, Pause, Play, Send, Square, Trash2, X, File as FileIcon } from 'lucide-react';
import clsx from 'clsx';
import { chunk, formatBytes } from '@/lib/format';
import { runUpload, type RunControl } from '@/lib/uploader';
import { runItem } from '@/lib/storage';
import { IDLE_RUN, type Settings } from '@/lib/types';
import { useDiscord, useRun } from '@/lib/hooks';
import { Badge, Button, Card, Progress } from './ui';
import { ContextCard } from './ContextCard';

interface Entry { id: string; file: File; oversize: boolean }
type BatchStatus = 'pending' | 'sending' | 'done' | 'failed';
interface LogLine { t: number; text: string; level: 'info' | 'ok' | 'err' }

export function UploadPanel({ settings }: { settings: Settings }) {
  const info = useDiscord();
  const run = useRun();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [drag, setDrag] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [batchStatus, setBatchStatus] = useState<Record<number, BatchStatus>>({});
  const control = useRef<RunControl>({ stopped: false, paused: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = run.status === 'running' || run.status === 'paused';

  const limitBytes = settings.maxFileMB * 1048576;
  const addFiles = (list: FileList | File[]) => {
    const add = [...list].map((file) => ({ id: crypto.randomUUID(), file, oversize: file.size > limitBytes }));
    setEntries((e) => [...e, ...add]);
  };
  const effective = useMemo(
    () => entries.map((e) => ({ ...e, oversize: e.file.size > limitBytes })),
    [entries, limitBytes],
  );
  const sendable = effective.filter((e) => !(settings.skipOversize && e.oversize));
  const skipped = effective.length - sendable.length;
  const totalBytes = sendable.reduce((a, e) => a + e.file.size, 0);
  const batchCount = Math.ceil(sendable.length / settings.perMessage);
  const batches = useMemo(() => chunk(sendable, settings.perMessage), [sendable, settings.perMessage]);
  const canStart = !busy && !!info.ctx?.canSend && !!info.tabId && sendable.length > 0;

  const log = (text: string, level: LogLine['level'] = 'info') => setLogs((l) => [...l, { t: Date.now(), text, level }]);

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); };

  const start = async () => {
    if (!info.tabId || !info.ctx) return;
    control.current = { stopped: false, paused: false };
    setBatchStatus({}); setLogs([]);
    const files = sendable.map((e) => e.file);
    await runUpload({
      tabId: info.tabId, ctx: info.ctx, files, settings, control: control.current, log,
      getCtx: async () => (await import('@/lib/tabs')).fetchContext(info.tabId!),
      onBatch: (i, s) => setBatchStatus((b) => ({ ...b, [i]: s === 'sending' ? 'sending' : s })),
    });
  };
  const pauseResume = () => { control.current.paused = !control.current.paused; };
  const stop = () => { control.current.stopped = true; control.current.paused = false; };
  const reset = async () => { setEntries([]); setLogs([]); setBatchStatus({}); await runItem.setValue(IDLE_RUN); };

  const progress = run.totalFiles ? run.sentFiles / run.totalFiles : 0;

  return (
    <div className="space-y-3">
      <ContextCard info={info} />

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className={clsx('flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-6 text-center transition',
          drag ? 'border-blurple bg-blurple/10' : 'border-ink-600 bg-ink-800 hover:border-blurple/60', busy && 'pointer-events-none opacity-50')}>
        <FileUp className="h-6 w-6 text-blurple" />
        <div className="font-semibold text-white">Drop files here or click to choose</div>
        <div className="text-[11px] text-zinc-400">Any number of files — sent {settings.perMessage} per message</div>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {entries.length > 0 && (
        <Card className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="muted">{sendable.length} to send</Badge>
            <Badge tone="muted">{formatBytes(totalBytes)}</Badge>
            <Badge tone="muted">{batchCount} message{batchCount === 1 ? '' : 's'}</Badge>
            {skipped > 0 && <Badge tone="warn">{skipped} oversize {settings.skipOversize ? 'skipped' : 'will fail'}</Badge>}
            <button disabled={busy} onClick={reset} className="ml-auto flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white disabled:opacity-40"><Trash2 className="h-3 w-3" />Clear</button>
          </div>
          <div className="max-h-56 space-y-2 overflow-auto pr-1">
            {batches.map((b, bi) => (
              <div key={bi} className="rounded-md bg-ink-900/60 p-1.5">
                <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Message {bi + 1}</span>
                  <span className={clsx(batchStatus[bi] === 'done' && 'text-ok', batchStatus[bi] === 'failed' && 'text-bad', batchStatus[bi] === 'sending' && 'text-warn')}>{batchStatus[bi] ?? 'pending'}</span>
                </div>
                {b.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 py-0.5">
                    <FileIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <span className="truncate text-white" title={e.file.name}>{e.file.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-zinc-400">{formatBytes(e.file.size)}</span>
                    {!busy && <button onClick={() => setEntries((x) => x.filter((y) => y.id !== e.id))} className="text-zinc-500 hover:text-bad"><X className="h-3.5 w-3.5" /></button>}
                  </div>
                ))}
              </div>
            ))}
            {settings.skipOversize && effective.filter((e) => e.oversize).map((e) => (
              <div key={e.id} className="flex items-center gap-2 px-1.5 py-0.5 text-warn/80">
                <FileIcon className="h-3.5 w-3.5" /><span className="truncate line-through">{e.file.name}</span>
                <span className="ml-auto text-[11px]">{formatBytes(e.file.size)} &gt; {settings.maxFileMB}MB</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Progress</span>
          <Badge tone={run.status === 'done' ? 'ok' : run.status === 'error' ? 'bad' : run.status === 'running' ? 'warn' : 'muted'}>{run.status}</Badge>
        </div>
        <Progress value={progress} />
        <div className="text-[11px] text-zinc-400">{run.sentFiles}/{run.totalFiles} files · {run.doneBatches}/{run.totalBatches} messages{run.message ? ` · ${run.message}` : ''}</div>
        <div className="flex gap-2">
          {!busy ? (
            <Button className="flex-1" variant="primary" disabled={!canStart} onClick={start}><Send className="h-4 w-4" />Send {sendable.length || ''} file{sendable.length === 1 ? '' : 's'}</Button>
          ) : (
            <>
              <Button className="flex-1" variant="ghost" onClick={pauseResume}>{run.status === 'paused' ? <><Play className="h-4 w-4" />Resume</> : <><Pause className="h-4 w-4" />Pause</>}</Button>
              <Button className="flex-1" variant="danger" onClick={stop}><Square className="h-4 w-4" />Stop</Button>
            </>
          )}
        </div>
        {!canStart && !busy && entries.length > 0 && !info.ctx?.canSend && <div className="text-[11px] text-warn">Open a channel with a message box to enable sending.</div>}
      </Card>

      {logs.length > 0 && (
        <Card>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Log</div>
          <div className="max-h-40 space-y-0.5 overflow-auto font-mono text-[11px]">
            {logs.map((l, i) => (
              <div key={i} className={clsx(l.level === 'ok' && 'text-ok', l.level === 'err' && 'text-bad', l.level === 'info' && 'text-zinc-300')}>
                <span className="text-zinc-600">{new Date(l.t).toLocaleTimeString()} </span>{l.text}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
