/** Messages between the side panel and the Instagram content script for "download all posts". */

export interface ProfileFilterInput {
  postsRange: { from: number; to: number };
  likes: { min: number | null; max: number | null };
  comments: { min: number | null; max: number | null };
  /** yyyy-mm-dd */
  date: { from: string | null; to: string | null };
  sorting: { mostLikes: number | null; mostComments: number | null };
}

/** What to put in the zip. Posts are the default; highlights and the profile picture are opt-in. */
export interface ProfileInclude {
  posts: boolean;
  highlights: boolean;
  avatar: boolean;
  /** which highlights; null means all of them. Only read when `highlights` is true. */
  highlightIds: string[] | null;
}

/** One highlight as the picker shows it. */
export interface HighlightSummary {
  id: string;
  title: string;
  /** small cover image, or null when Instagram gave none */
  cover: string | null;
}

/** Panel -> page. */
export type ProfileRequest =
  | { type: 'EPH_PROFILE_INFO' }
  | { type: 'EPH_PROFILE_START'; filters: ProfileFilterInput; include: ProfileInclude };

/** Page -> panel, answer to EPH_PROFILE_INFO. `totalPosts` is null when Instagram would not tell. */
export interface ProfileInfo {
  ok: boolean;
  username?: string;
  totalPosts?: number | null;
  /** the profile's highlights, newest first; null when Instagram would not say */
  highlights?: HighlightSummary[] | null;
  error?: string;
}

/** Page -> panel, answer to EPH_PROFILE_START. */
export interface ProfileStartResult {
  ok: boolean;
  error?: string;
}

/** Page -> panel, broadcast while a run is going. `percent` is 0..100. */
export interface ProfileProgress {
  type: 'EPH_PROFILE_PROGRESS';
  phase: 'working' | 'done' | 'error';
  percent: number;
  text: string;
}

const RESERVED = new Set([
  'p', 'reel', 'reels', 'stories', 'explore', 'direct', 'accounts', 'tv', 'about', 'web', 'developer', 'legal', 'privacy', 'press', 'api', 'challenge', 'emails', 'oauth', 'session', 'nametag', 'directory', 'lite', 'ar', 'locations',
]);

/** Username when `url` is an Instagram profile page (not a post, reel, story or explore page). */
export function instagramProfileName(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/([A-Za-z0-9._]+)\/?$/);
  if (!m || !m[1] || RESERVED.has(m[1].toLowerCase())) return null;
  return m[1];
}
