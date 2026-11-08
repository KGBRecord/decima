// Shared typings for the on-demand Ephemera scripts (injected via chrome.scripting.executeScript).

export interface IgImageCandidate {
  url?: string;
  width?: number;
  height?: number;
}

export interface IgStoryItem {
  id?: string | number;
  pk?: string | number;
  video_versions?: { url: string }[];
  image_versions2?: { candidates?: IgImageCandidate[] };
}

export interface IgReel {
  items?: IgStoryItem[];
  user?: { username?: string };
}

export interface IgReelsMediaResponse {
  reels?: Record<string, IgReel | undefined>;
  reels_media?: IgReel[];
}

export interface IgProfileInfoResponse {
  data?: { user?: { id?: string } };
}

export interface IgUserStoryResponse {
  reel?: IgReel;
}

export type NavigatorWithUAData = Navigator & {
  userAgentData?: { platform?: string };
};

export interface LegacyStoryPayload {
  downloadv1: string | null | undefined;
  idx: string;
  url: string;
  platform: "ig";
  channel: string;
  postId: "story";
  order: number;
  mediaType: string;
  filename: string;
}
