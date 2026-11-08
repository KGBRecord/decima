import { chunk, sleep } from './format';
import { runItem } from './storage';
import {
  PORT_NAME, type ContentToUi, type RunState, type Settings, type UiToContent, type DiscordContext,
} from './types';

const CHUNK = 3 * 1024 * 1024; // multiple of 3 -> clean base64 boundaries

async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export interface RunControl { stopped: boolean; paused: boolean }

function sendBatch(
  tabId: number, ctx: DiscordContext, files: File[], caption: string | undefined, onStage: (s: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const batchId = crypto.randomUUID();
    const port = chrome.tabs.connect(tabId, { name: PORT_NAME });
    let settled = false;
    const finish = (err?: string) => {
      if (settled) return; settled = true;
      try { port.disconnect(); } catch { /* noop */ }
      err ? reject(new Error(err)) : resolve();
    };
    port.onMessage.addListener((m: ContentToUi) => {
      if (m.batchId !== batchId) return;
      if (m.t === 'stage') onStage(m.stage);
      else if (m.t === 'done') finish();
      else if (m.t === 'error') finish(m.error);
    });
    port.onDisconnect.addListener(() => finish('Connection to Discord tab lost (reload the tab?)'));

    (async () => {
      const post = (m: UiToContent) => port.postMessage(m);
      post({ t: 'begin', batchId, channelId: ctx.channelId, caption, files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })) });
      for (let i = 0; i < files.length; i++) {
        for (let off = 0; off < files[i].size || off === 0; off += CHUNK) {
          post({ t: 'chunk', batchId, fileIndex: i, data: await toBase64(files[i].slice(off, off + CHUNK)) });
          if (files[i].size === 0) break;
        }
      }
      post({ t: 'commit', batchId });
    })().catch((e) => finish(String(e?.message ?? e)));
  });
}

export async function runUpload(opts: {
  tabId: number;
  ctx: DiscordContext;
  files: File[];
  settings: Settings;
  control: RunControl;
  getCtx: () => Promise<DiscordContext | null>;
  log: (line: string, level?: 'info' | 'ok' | 'err') => void;
  onBatch: (index: number, status: 'sending' | 'done' | 'failed') => void;
}): Promise<RunState> {
  const { tabId, ctx, files, settings, control, log } = opts;
  const batches = chunk(files, Math.min(10, Math.max(1, settings.perMessage)));
  const target = `${ctx.guildName} › ${ctx.channelName}`;
  let state: RunState = {
    status: 'running', totalBatches: batches.length, doneBatches: 0,
    totalFiles: files.length, sentFiles: 0, target, updatedAt: Date.now(),
  };
  const push = (patch: Partial<RunState>) => { state = { ...state, ...patch, updatedAt: Date.now() }; return runItem.setValue(state); };
  await push({});
  log(`Target: ${target} — ${files.length} files in ${batches.length} message(s)`);

  for (let i = 0; i < batches.length; i++) {
    while (control.paused && !control.stopped) { await push({ status: 'paused' }); await sleep(300); }
    if (control.stopped) { await push({ status: 'stopped', message: 'Stopped by user' }); log('Stopped.', 'err'); return state; }
    await push({ status: 'running' });

    const live = await opts.getCtx();
    if (!live || live.channelId !== ctx.channelId) {
      await push({ status: 'error', message: 'Channel changed — aborted' });
      log('Active channel changed — aborted for safety.', 'err');
      return state;
    }

    const caption = settings.captionMode === 'all' || (settings.captionMode === 'first' && i === 0)
      ? settings.caption.trim() || undefined : undefined;
    opts.onBatch(i, 'sending');
    log(`Message ${i + 1}/${batches.length}: ${batches[i].length} file(s)…`);
    try {
      await sendBatch(tabId, ctx, batches[i], caption, () => { /* stages available for future UI */ });
    } catch (e: any) {
      opts.onBatch(i, 'failed');
      await push({ status: 'error', message: e.message });
      log(`✗ ${e.message}`, 'err');
      return state;
    }
    opts.onBatch(i, 'done');
    await push({ doneBatches: i + 1, sentFiles: state.sentFiles + batches[i].length });
    log(`✓ Message ${i + 1} sent`, 'ok');
    if (i < batches.length - 1) await sleep(settings.delaySec * 1000);
  }
  await push({ status: 'done', message: 'All files sent' });
  log('Done.', 'ok');
  return state;
}
