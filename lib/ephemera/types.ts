/** Shared types for the Ephemera module. */

/** One entry of a `download` message: a media item with one or two URLs (2 = video). */
export interface DownloadItem {
  urls: string[];
  filename?: string;
  pk?: string | number;
}

/** Messages posted by the story-* content scripts (all fields optional; shape is loose by design). */
export interface EphemeraMessage {
  ephemeraRun?: boolean;
  tabId?: number;
  /** Decima's own typed messages carry a `type` discriminator. */
  type?: string;
  runStoryDownload?: boolean;
  profileDownload?: boolean;
  username?: string;
  posts?: IgPost[];
  openfacebook?: boolean;
  downloadv1?: string;
  download?: DownloadItem[];
  noStories?: boolean;
  user?: string;
  albumName?: string;
  filename?: string;
  platform?: string;
  source?: string;
  channel?: string;
  postId?: string | number;
  shortcode?: string;
  idx?: string | number;
  order?: string | number | null;
  mediaType?: string;
  url?: string;
}

/** Messages sent to a tab's content script. */
export interface TabMessage {
  clickaction?: boolean;
  downloadProgress?: { total: number; current: number };
  downloadComplete?: boolean;
  downloadError?: string;
  /** Progress counter, or "ok" when finished. */
  countdow?: number | string;
}

export interface DownloadResult {
  ok: boolean;
  error?: string;
}

export interface IgCaption {
  text?: string;
  pk?: string | number;
  created_at?: string | number;
}

export interface IgCandidate {
  url?: string;
  width?: number;
}

/** Loosely-shaped media entry (various Instagram/Facebook payload variants). */
export interface IgMediaLike {
  id?: string | number;
  pk?: string | number;
  type?: string;
  url?: string;
  src?: string;
  display_url?: string;
  image?: string;
  link?: string;
  media_order?: number;
}

export interface IgSidecarNode {
  id?: string | number;
  video_url?: string | null;
  display_url?: string | null;
  thumbnail_src?: string | null;
}

/** Instagram post object as sent by the content script; only fields read here are listed. */
export interface IgPost {
  id?: string | number;
  shortcode?: string;
  code?: string;
  wall_order?: number | string;
  profile_order?: number | string;
  taken_at?: string | number;
  created_at?: string | number;
  caption?: string | IgCaption | null;
  caption_json?: IgCaption | null;
  media?: IgMediaLike[];
  edge_sidecar_to_children?: { edges?: { node?: IgSidecarNode }[] };
  video_url?: string;
  video?: { url?: string };
  display_url?: string;
  image_url?: string;
  thumbnail_url?: string;
  picture?: string;
  image_versions2?: { candidates?: IgCandidate[] };
  video_versions?: { url?: string }[];
  resources?: (IgMediaLike | string)[];
  medias?: (IgMediaLike | string)[];
  items?: (IgMediaLike | string)[];
  urls?: (IgMediaLike | string)[];
}

export interface NormalizedMedia {
  id: string | number;
  type: string;
  url: string;
  ext: string;
  media_order?: number;
}
