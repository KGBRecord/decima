/** Download button element; extra expando props are set by the content script. */
export interface DlButton extends HTMLElement {
  __ephRestoreTimer?: ReturnType<typeof setTimeout>;
  __ephVideoElement?: HTMLVideoElement;
  __ephWindowsPrepared?: boolean;
}

export interface RangeIdEntry { pkid: string; userid: string }

export interface IgImageCandidate { url: string; width: number; height: number }
export interface IgVideoVersion { url: string }

export interface IgMediaItem {
  pk?: string | number;
  id?: string | number;
  code?: string;
  video_versions?: IgVideoVersion[];
  image_versions2?: { candidates: IgImageCandidate[] };
  carousel_media?: IgMediaItem[];
  user?: { username?: string; id?: string };
  [key: string]: unknown;
}

export interface IgMediaInfoResponse { items?: IgMediaItem[]; [key: string]: unknown }

export interface IgStoryResponse {
  reel?: { items?: IgMediaItem[]; user?: { username?: string } };
}

export interface IgProfileInfoResponse { data?: { user?: { id?: string } } }

export interface MediaInfo {
  pk?: string | number;
  code?: string;
  urls: string[];
  filename?: string;
}

export interface MediaCacheEntry {
  results: MediaInfo[];
  user: string;
  json: IgMediaInfoResponse;
}

export interface DownloadProgress {
  [key: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON boundary: Instagram profile posts are loosely shaped
export type ProfilePost = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON boundary: filters come from the popup / storage
export type ProfileFilters = any;

export interface ListenerRequest {
  downloadProgress?: DownloadProgress;
  countdow?: string;
  clickaction?: boolean;
  downloadComplete?: boolean;
  downloadError?: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    __ephStoryDlBusy?: boolean;
  }
  interface Navigator {
    userAgentData?: { platform?: string };
  }
}

/** Click handlers in this script rely on `this` being the clicked element. */
export type ClickHandler = (this: GlobalEventHandlers, ev: MouseEvent) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON boundary: untyped Instagram payloads
export type LooseJson = any;
