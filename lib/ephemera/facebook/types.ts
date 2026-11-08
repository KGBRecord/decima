export interface FbStoryItem {
  VIDEOID: string;
  id: string;
}

export interface RecentVideoUrl {
  url: string;
  time: number;
  source: string;
  [k: string]: unknown;
}

export interface ProgressiveUrl {
  progressive_url?: string;
  metadata?: { quality?: string };
}

export interface FbStoryAttachment {
  media?: {
    __isMedia?: string;
    __typename?: string;
    progressive_urls?: ProgressiveUrl[];
    videoDeliveryResponseFragment?: {
      videoDeliveryResponseResult?: { progressive_urls?: ProgressiveUrl[] };
    };
  };
}

export interface FbStoryEdge {
  node?: { id?: string; attachments?: FbStoryAttachment[] };
}

export interface FbStoriesResponse {
  data?: {
    nodes?: Array<{ unified_stories?: { edges?: FbStoryEdge[] } }>;
  };
}

/** Download button element with the extension's expando properties. */
export interface EphButton extends HTMLElement {
  __ephRestoreTimer?: ReturnType<typeof setTimeout>;
  __ephGuarded?: boolean;
  __ephVideoElement?: HTMLVideoElement;
  __ephAlbumRoot?: EphButton;
  __ephAlbumButton?: EphButton | null;
  __ephFbDownloadButton?: EphButton;
  __ephFbRefreshHandler?: EventListener;
  __ephFbResizeObs?: ResizeObserver;
  __ephFbVideoResourceObserverInstalled?: boolean;
  __ephIdSrc?: string;
  __ephLastRefreshSrc?: string;
  __ephLeft?: number;
  __ephTop?: number;
  __ephPcb?: boolean;
  __ephShown?: boolean;
}

/** Expando props can sit on any element (video, album root, ...). */
export type EphEl = EphButton;


/** Element (anchor/img/video/div/...) with the properties this script reads off query results. */
export type FbNode = EphButton &
  HTMLVideoElement &
  HTMLImageElement &
  HTMLAnchorElement &
  HTMLDivElement;

/** Media entry collected for album downloads. */
export interface FbMediaItem {
  type: string;
  url: string;
  id: string;
  pending?: boolean;
  el?: FbNode;
}

/** Loosely-typed node while walking an arbitrary GraphQL response tree. */
export interface FbWalkNode {
  id?: string;
  attachments?: FbStoryAttachment[];
}
