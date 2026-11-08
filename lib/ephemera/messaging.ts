import type { TabMessage } from './types';

/** Fire-and-forget message to a tab's content script; all errors are swallowed. */
export function ephSendTabMessage(tabId: number | undefined, message: TabMessage): void {
  try {
    if (!tabId) return;
    const result = chrome.tabs.sendMessage(tabId, message);
    if (result && typeof result.catch === "function") {
      result.catch(function () {});
    }
  } catch (e) {}
}
