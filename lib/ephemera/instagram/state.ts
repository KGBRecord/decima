import type { DlButton, MediaCacheEntry, ProfilePost, RangeIdEntry } from './types';

/** Shared mutable module state (was top-level `var`s in the original main()). */
export interface InstagramState {
  elemntdata: DlButton | undefined;
  rangeid: RangeIdEntry[];
  mediaCache: Record<string, MediaCacheEntry>;
  postIdCache: Record<string, string>;
  elementping: DlButton | undefined;
  profilePostsCache: Record<string, ProfilePost[]>;
  isProcessingProfile: boolean;
  tokendsg: string;
  countclick: number;
  isProcessing: boolean;
  processingTimeout: ReturnType<typeof setTimeout> | null;
  mediaElementsToProcess: Set<Element>;
  usernamex: string;
}

export const state: InstagramState = {
  elemntdata: undefined,
  rangeid: [],
  mediaCache: {},
  postIdCache: {},
  elementping: undefined,
  profilePostsCache: {},
  isProcessingProfile: false,
  tokendsg: '',
  countclick: 0,
  isProcessing: false,
  processingTimeout: null,
  mediaElementsToProcess: new Set<Element>(),
  usernamex: '',
};
