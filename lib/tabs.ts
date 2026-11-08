import type { DiscordContext } from './types';

export async function activeDiscordTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const t = tabs[0];
  return t?.url && /^https:\/\/([a-z]+\.)?discord\.com\//.test(t.url) ? t : null;
}

export async function fetchContext(tabId: number): Promise<DiscordContext | null> {
  try {
    return (await chrome.tabs.sendMessage(tabId, { type: 'GET_CONTEXT' })) ?? null;
  } catch {
    return null; // content script not injected yet (tab opened before install)
  }
}

export function useTabHooks(cb: () => void): () => void {
  chrome.tabs.onActivated.addListener(cb);
  chrome.tabs.onUpdated.addListener(cb);
  chrome.windows.onFocusChanged.addListener(cb);
  const msg = (m: any) => { if (m?.type === 'CONTEXT_CHANGED') cb(); };
  chrome.runtime.onMessage.addListener(msg);
  return () => {
    chrome.tabs.onActivated.removeListener(cb);
    chrome.tabs.onUpdated.removeListener(cb);
    chrome.windows.onFocusChanged.removeListener(cb);
    chrome.runtime.onMessage.removeListener(msg);
  };
}
