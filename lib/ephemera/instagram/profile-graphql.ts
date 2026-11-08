import type { LooseJson } from './types';
import type { AvatarPayload, HighlightItem, HighlightPayload } from '@/lib/ephemera/types';
import { getIGDtsg } from './dtsg';
import { getBestImageUrl } from './story-fetch';

/**
 * Instagram web talks to its own GraphQL endpoint with persisted queries. The ids below are the
 * ones the site itself sends when it opens a profile and scrolls it. Instagram rotates them from
 * time to time; when it does, requests come back with `errors` and `explainGraphqlFailure` says so.
 */
const ENDPOINT = 'https://www.instagram.com/api/graphql';
const FIRST_PAGE = { name: 'PolarisProfilePostsQuery', doc: '40380470024877440' };
const NEXT_PAGE = { name: 'PolarisProfilePostsTabContentQuery_connection', doc: '29507206148877307' };
const PROFILE = { name: 'PolarisProfilePageContentQuery', doc: '40158838120366999' };
const HIGHLIGHTS_TRAY = { name: 'PolarisProfileStoryHighlightsTrayContentQuery', doc: '26970053832668570' };
const HIGHLIGHT_ITEMS = { name: 'PolarisStoriesV3HighlightsPageQuery', doc: '29299425373007309' };

const POSTS_FLAGS = {
  __relay_internal__pv__PolarisMultiCaptionCarouselEnabledrelayprovider: true,
  __relay_internal__pv__PolarisShortDramaEnabledrelayprovider: true,
  __relay_internal__pv__PolarisSEOIsCrawlerrelayprovider: false,
  __relay_internal__pv__PolarisThreadsStyleCommentsEnabledrelayprovider: false,
  __relay_internal__pv__PolarisReelsRecoDebugOverlayEnabledrelayprovider: false,
};

const PROFILE_FLAGS = {
  __relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider: true,
  __relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider: false,
  __relay_internal__pv__PolarisProfileInformTreatmentBannerEnabledrelayprovider: false,
  __relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider: false,
  __relay_internal__pv__PolarisProfileRingsGradientEnabledrelayprovider: true,
  __relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider: true,
  __relay_internal__pv__PolarisShortDramaEnabledrelayprovider: true,
};

const FEED_KEY = 'xdt_api__v1__feed__user_timeline_graphql_connection';

export interface PostsPage {
  posts: LooseJson[];
  hasNext: boolean;
  cursor: string | null;
}

function csrfToken(): string {
  const m = document.documentElement.outerHTML.match(/csrf_token":".*?(?=")/g);
  return m && m[0] ? (m[0].split('"')[2] ?? '') : '';
}

async function gql(query: { name: string; doc: string }, variables: object): Promise<LooseJson> {
  const body = new URLSearchParams({
    fb_dtsg: getIGDtsg(),
    fb_api_caller_class: 'RelayModern',
    fb_api_req_friendly_name: query.name,
    server_timestamps: 'true',
    variables: JSON.stringify(variables),
    doc_id: query.doc,
  });
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-csrftoken': csrfToken(),
      'x-ig-app-id': '936619743392459',
      'x-asbd-id': '129477',
      'x-fb-friendly-name': query.name,
    },
    body: body.toString(),
  });
  if (res.status === 401 || res.status === 403) throw new Error('Instagram says you are not logged in. Log in and try again.');
  if (res.status === 429) throw new Error('Instagram is rate limiting this account. Wait a few minutes and try again.');
  if (!res.ok) throw new Error(`Instagram answered ${res.status}.`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Instagram did not return data. Make sure you are logged in, then reload the tab.');
  }
}

function explainGraphqlFailure(json: LooseJson): Error {
  const first = Array.isArray(json?.errors) ? json.errors[0] : null;
  const msg = String(first?.message ?? '');
  if (/field_exception|not.?found/i.test(msg)) return new Error('That profile could not be read. It may be private, removed, or the name is wrong.');
  return new Error('Instagram changed its profile API and Ephemera cannot read this page yet. Please update the extension.');
}

function pageFrom(json: LooseJson): PostsPage {
  const conn = json?.data?.[FEED_KEY];
  if (!conn) throw explainGraphqlFailure(json);
  const edges: LooseJson[] = Array.isArray(conn.edges) ? conn.edges : [];
  return {
    posts: edges.map((e) => e?.node?.media ?? e?.node).filter(Boolean),
    hasNext: !!conn.page_info?.has_next_page,
    cursor: conn.page_info?.end_cursor ?? null,
  };
}

const baseData = {
  count: 12,
  include_reel_media_seen_timestamp: true,
  include_relationship_info: true,
  latest_besties_reel_media: true,
  latest_reel_media: true,
};

/** One page of 12 posts, newest first. Pass the cursor from the previous page to continue. */
export async function fetchPostsPage(username: string, after: string | null = null): Promise<PostsPage> {
  if (!after) return pageFrom(await gql(FIRST_PAGE, { data: baseData, username, ...POSTS_FLAGS }));
  return pageFrom(
    await gql(NEXT_PAGE, { after, before: null, data: baseData, first: 12, last: null, include_multi_captions: true, username, ...POSTS_FLAGS }),
  );
}

export interface ProfileSummary {
  userId: string | null;
  /** null when Instagram would not say */
  totalPosts: number | null;
  /** number of highlight reels; null when unknown */
  highlightCount: number | null;
  /** full-size profile picture, when Instagram exposes one */
  avatarUrl: string | null;
  /** first page, so the caller does not have to ask twice */
  firstPage: PostsPage;
}

export async function fetchProfileSummary(username: string): Promise<ProfileSummary> {
  const firstPage = await fetchPostsPage(username);
  const first = firstPage.posts[0];
  const userId: string | null = first?.user?.pk ?? first?.owner?.id ?? null;
  let totalPosts: number | null = firstPage.posts.length === 0 ? 0 : null;
  let avatarUrl: string | null = null;
  let highlightCount: number | null = null;
  if (userId) {
    try {
      const json = await gql(PROFILE, { enable_integrity_filters: true, id: userId, ...PROFILE_FLAGS });
      const u = json?.data?.user;
      if (typeof u?.media_count === 'number') totalPosts = u.media_count;
      avatarUrl = u?.hd_profile_pic_url_info?.url ?? u?.profile_pic_url ?? null;
    } catch {
      /* the count and the picture are nice to have; posts do not need them */
    }
    try {
      highlightCount = (await fetchHighlightTray(userId)).length;
    } catch {
      /* same */
    }
  }
  return { userId, totalPosts, highlightCount, avatarUrl, firstPage };
}

/** The profile's highlight reels, newest first, without their items. */
export async function fetchHighlightTray(userId: string): Promise<{ id: string; title: string }[]> {
  const json = await gql(HIGHLIGHTS_TRAY, { user_id: userId });
  const edges: LooseJson[] = json?.data?.highlights?.edges;
  if (!Array.isArray(edges)) throw explainGraphqlFailure(json);
  return edges
    .map((e) => ({ id: String(e?.node?.id ?? ''), title: String(e?.node?.title ?? '') }))
    .filter((h) => h.id !== '');
}

function itemToFile(item: LooseJson): HighlightItem | null {
  const video: string | undefined = item?.video_versions?.[0]?.url;
  const image: string | null = getBestImageUrl(item?.image_versions2?.candidates);
  const url = video || image;
  if (!url) return null;
  return {
    id: String(item.pk ?? item.id ?? ''),
    type: video ? 'video' : 'image',
    url,
    taken_at: typeof item.taken_at === 'number' ? item.taken_at : undefined,
  };
}

/** Every item of one highlight. One reel per request, which is how the site opens it. */
export async function fetchHighlight(reel: { id: string; title: string }): Promise<HighlightPayload> {
  const json = await gql(HIGHLIGHT_ITEMS, {
    initial_reel_id: reel.id,
    reel_ids: [reel.id],
    first: 3,
    last: 2,
    __relay_internal__pv__PolarisCommunityNoteStoriesLabelEnabledrelayprovider: true,
  });
  const edges: LooseJson[] | undefined = json?.data?.xdt_api__v1__feed__reels_media__connection?.edges;
  if (!Array.isArray(edges)) throw explainGraphqlFailure(json);
  const node = edges.find((e) => e?.node?.id === reel.id)?.node ?? edges[0]?.node;
  const items: HighlightItem[] = (Array.isArray(node?.items) ? node.items : [])
    .map(itemToFile)
    .filter((i: HighlightItem | null): i is HighlightItem => i !== null);
  return { id: reel.id, title: reel.title, items };
}

export function avatarPayload(url: string | null): AvatarPayload | null {
  return url ? { url } : null;
}
