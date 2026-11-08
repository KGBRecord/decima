import type { ProfileProgress } from '@/lib/ephemera/profile-protocol';
import { state } from './state';

/**
 * The "download all posts" run has three stages, drawn as one bar in the side panel:
 *   0-40%   reading the profile (user id, post pages, filters, video links)
 *   40-98%  fetching every file into the zip (progress comes from the service worker)
 *   100%    zip handed to Chrome downloads
 */
const API_SHARE = 0.4;
const FILES_FROM = 40;
const FILES_SPAN = 58;

function send(msg: ProfileProgress): void {
  try {
    void chrome.runtime.sendMessage(msg).catch(() => {});
  } catch {
    /* extension context gone (reloaded): nothing to report to */
  }
}

/** Progress of the reading stage; `pct` is the old 0..90 scale used by the fetch code. */
export function reportProgress(pct: number, text: string): void {
  send({ type: 'EPH_PROFILE_PROGRESS', phase: 'working', percent: Math.round(pct * API_SHARE), text });
}

/** Progress of the zip stage, straight from the service worker's counters. */
export function reportFiles(current: number, total: number): void {
  const frac = total > 0 ? Math.min(current / total, 1) : 0;
  send({ type: 'EPH_PROFILE_PROGRESS', phase: 'working', percent: Math.round(FILES_FROM + frac * FILES_SPAN), text: `Saving files ${current} of ${total}` });
}

export function reportDone(): void {
  state.isProcessingProfile = false;
  send({ type: 'EPH_PROFILE_PROGRESS', phase: 'done', percent: 100, text: 'Done. The zip is in your downloads.' });
}

export function reportError(message: string): void {
  state.isProcessingProfile = false;
  send({ type: 'EPH_PROFILE_PROGRESS', phase: 'error', percent: 0, text: message });
}
