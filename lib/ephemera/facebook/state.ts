import type { FbStoryItem, RecentVideoUrl } from './types';

/** Shared mutable state of the Facebook content script (formerly main() closure globals). */
export interface FbState {
  command: boolean;
  dataelement: HTMLElement | null;
  Arrarystory: FbStoryItem[];
  stop: () => void;
  ephFbRepositionScheduled: boolean;
  ephFbRecentVideoUrls: RecentVideoUrl[];
  ephFbScanTimer: ReturnType<typeof setTimeout> | null;
}

export const state: FbState = {
  command: false,
  dataelement: null,
  Arrarystory: [],
  stop: () => {},
  ephFbRepositionScheduled: false,
  ephFbRecentVideoUrls: [],
  ephFbScanTimer: null,
};
