import { PORT_NAME, type ContentToUi, type DiscordContext, type UiToContent } from '@/lib/types';
import { sleep } from '@/lib/format';

const q = <T extends Element = Element>(s: string) => document.querySelector<T>(s);

function getEditor(): HTMLElement | null {
  return q<HTMLElement>('div[role="textbox"][data-slate-editor="true"]') ?? q<HTMLElement>('div[role="textbox"][contenteditable="true"]');
}
const attachmentArea = () => q('[class*="channelAttachmentArea"]') ?? q('ul[class*="attachmentArea"]');

const clean = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim();

/** Discord's tab title is "(n) Discord | #channel | Server" (DM: "Discord | @user"). */
function parseTitle(): { channel: string; guild: string } {
  const parts = document.title
    .replace(/^\(\d+\)\s*/, '')
    .replace(/^[•●]\s*/, '')
    .split('|')
    .map(clean)
    .filter((p) => p && p.toLowerCase() !== 'discord');
  return { channel: parts[0] ?? '', guild: parts[1] ?? '' };
}

function channelNameFromDom(channelId: string): string {
  // sidebar entry: <a data-list-item-id="channels___<id>" aria-label="general (text channel)">
  const link = q<HTMLElement>(`a[data-list-item-id="channels___${channelId}"]`);
  const aria = clean(link?.getAttribute('aria-label')).replace(/\s*\((text|voice|announcement|forum|stage|thread)[^)]*\).*$/i, '');
  if (aria) return aria;
  const hdr = clean(q('section[aria-label] h1, [class*="titleWrapper"] h1, [class*="title"] h1')?.textContent);
  return hdr;
}

function guildNameFromDom(): string {
  const nav = clean(q('nav[aria-label$="(server)"], nav[aria-label*="server" i]')?.getAttribute('aria-label')).replace(/\s*\(server\)\s*$/i, '');
  if (nav && !/servers? sidebar/i.test(nav)) return nav;
  return clean(q('[class*="sidebar"] header h2, [class*="sidebar"] [class*="headerContent"] h2')?.textContent);
}

function getContext(): DiscordContext | null {
  const m = location.pathname.match(/^\/channels\/(@me|\d+)\/(\d+)/);
  if (!m) return null;
  const [, guildId, channelId] = m;
  const isDM = guildId === '@me';
  const t = parseTitle();
  const channelName = (channelNameFromDom(channelId) || t.channel || `Channel ${channelId}`).replace(/^[#@]\s*/, '');
  const guildName = isDM ? 'Direct Messages' : guildNameFromDom() || t.guild || `Server ${guildId}`;
  return { guildId, channelId, guildName, channelName, isDM, canSend: !!getEditor() };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function typeCaption(editor: HTMLElement, text: string) {
  editor.focus();
  document.execCommand('insertText', false, text);
  await sleep(150);
}

async function pasteFiles(editor: HTMLElement, files: File[]): Promise<boolean> {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  editor.focus();
  editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    const a = attachmentArea();
    if (a && a.children.length >= files.length) return true;
  }
  return false;
}

function pressEnter(editor: HTMLElement) {
  editor.focus();
  const o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  editor.dispatchEvent(new KeyboardEvent('keydown', o));
  editor.dispatchEvent(new KeyboardEvent('keypress', o));
  editor.dispatchEvent(new KeyboardEvent('keyup', o));
}

async function waitSubmitted(): Promise<boolean> {
  for (let i = 0; i < 480; i++) {
    await sleep(500);
    const a = attachmentArea();
    if (!a || a.children.length === 0) return true;
  }
  return false;
}

export default defineContentScript({
  matches: ['https://discord.com/*', 'https://*.discord.com/*'],
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((msg, _s, reply) => {
      if (msg?.type === 'GET_CONTEXT') { reply(getContext()); return false; }
    });

    // notify UI when the active channel/title changes (SPA navigation)
    let last = '';
    setInterval(() => {
      const c = getContext();
      const key = c ? `${c.channelId}|${c.channelName}|${c.guildName}|${c.canSend}` : '';
      if (key !== last) { last = key; chrome.runtime.sendMessage({ type: 'CONTEXT_CHANGED' }).catch(() => {}); }
    }, 800);

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== PORT_NAME) return;
      let meta: Extract<UiToContent, { t: 'begin' }> | null = null;
      let parts: Uint8Array[][] = [];
      const reply = (m: ContentToUi) => { try { port.postMessage(m); } catch { /* closed */ } };

      port.onMessage.addListener(async (m: UiToContent) => {
        try {
          if (m.t === 'begin') {
            meta = m; parts = m.files.map(() => []);
            reply({ t: 'stage', batchId: m.batchId, stage: 'received' });
          } else if (m.t === 'chunk' && meta) {
            parts[m.fileIndex].push(b64ToBytes(m.data));
          } else if (m.t === 'commit' && meta) {
            const cur = getContext();
            if (!cur || cur.channelId !== meta.channelId) throw new Error('Active channel differs from target');
            const editor = getEditor();
            if (!editor) throw new Error('Message box not found (no permission to send here?)');
            const files = meta.files.map((f, i) => new File(parts[i] as BlobPart[], f.name, { type: f.type || 'application/octet-stream' }));
            if (!(await pasteFiles(editor, files))) throw new Error('Discord did not accept the attachments (size/limit?)');
            reply({ t: 'stage', batchId: meta.batchId, stage: 'pasted' });
            if (meta.caption) await typeCaption(editor, meta.caption);
            await sleep(400);
            pressEnter(editor);
            if (!(await waitSubmitted())) throw new Error('Timed out waiting for upload to submit');
            reply({ t: 'stage', batchId: meta.batchId, stage: 'submitted' });
            reply({ t: 'done', batchId: meta.batchId });
            meta = null; parts = [];
          }
        } catch (e: any) {
          reply({ t: 'error', batchId: meta?.batchId ?? '', error: String(e?.message ?? e) });
        }
      });
    });
  },
});
