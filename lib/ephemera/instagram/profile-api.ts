import type { LooseJson, ProfileFilters, ProfilePost } from './types';
import { findVideoUrlDeep, getBestImageUrl } from './story-fetch';
import type { AvatarPayload, HighlightPayload } from '@/lib/ephemera/types';
import type { ProfileInclude } from '@/lib/ephemera/profile-protocol';
import { avatarPayload, fetchHighlight, fetchHighlightTray, fetchPostsPage, fetchProfileSummary } from './profile-graphql';
import { reportError, reportProgress } from './profile-report';
import { state } from './state';

export function processPostData(post: ProfilePost): ProfilePost {
  // Create a copy to avoid modifying the original
  const processed = { ...post };

  // Extract like count from various possible locations
  processed.like_count =
    post.like_count ||
    (post.edge_media_preview_like && post.edge_media_preview_like.count) ||
    (post.edge_liked_by && post.edge_liked_by.count) ||
    0;

  // Extract comment count from various possible locations
  processed.comment_count =
    post.comment_count ||
    (post.edge_media_to_comment && post.edge_media_to_comment.count) ||
    (post.edge_media_to_parent_comment &&
      post.edge_media_to_parent_comment.count) ||
    0;

  // Handle date info
  if (!post.taken_at && post.taken_at_timestamp) {
    processed.taken_at = post.taken_at_timestamp;
  }

  return processed;
}
export function applyFilters(posts: ProfilePost[], filters: ProfileFilters): ProfilePost[] {
  console.log("Applying filters:", filters);
  console.log("Initial posts count:", posts.length);

  let filteredPosts = [...posts];

  // Apply posts range filter
  if (filters.postsRange) {
    const fromIndex = Math.max(0, (filters.postsRange.from || 1) - 1);
    const toIndex = Math.min(
      posts.length - 1,
      (filters.postsRange.to || posts.length) - 1,
    );

    filteredPosts = filteredPosts.slice(fromIndex, toIndex + 1);
    console.log(
      `After range filter (${fromIndex + 1} to ${toIndex + 1}):`,
      filteredPosts.length,
    );
  }

  // Apply likes filter
  if (
    filters.likes &&
    (filters.likes.min !== null || filters.likes.max !== null)
  ) {
    const minLikes =
      filters.likes.min !== null ? parseInt(filters.likes.min) : 0;
    const maxLikes =
      filters.likes.max !== null ? parseInt(filters.likes.max) : Infinity;

    filteredPosts = filteredPosts.filter((post) => {
      const likeCount = post.like_count || 0;
      return likeCount >= minLikes && likeCount <= maxLikes;
    });

    console.log(
      `After likes filter (${minLikes}-${maxLikes}):`,
      filteredPosts.length,
    );
  }

  // Apply comments filter
  if (
    filters.comments &&
    (filters.comments.min !== null || filters.comments.max !== null)
  ) {
    const minComments =
      filters.comments.min !== null ? parseInt(filters.comments.min) : 0;
    const maxComments =
      filters.comments.max !== null ? parseInt(filters.comments.max) : Infinity;

    filteredPosts = filteredPosts.filter((post) => {
      const commentCount = post.comment_count || 0;
      return commentCount >= minComments && commentCount <= maxComments;
    });

    console.log(
      `After comments filter (${minComments}-${maxComments}):`,
      filteredPosts.length,
    );
  }

  // Apply date filter
  if (filters.date && (filters.date.from || filters.date.to)) {
    filteredPosts = filteredPosts.filter((post) => {
      if (!post.taken_at) return true; // Skip if no date

      const postTimestamp = post.taken_at * 1000; // Convert to milliseconds
      const postDate = new Date(postTimestamp);

      if (filters.date.from) {
        const fromDate = new Date(filters.date.from);
        if (postDate < fromDate) return false;
      }

      if (filters.date.to) {
        const toDate = new Date(filters.date.to);
        // Add one day to include the end date fully
        toDate.setDate(toDate.getDate() + 1);
        if (postDate > toDate) return false;
      }

      return true;
    });

    console.log(`After date filter:`, filteredPosts.length);
  }

  // Apply sorting and top posts filters
  if (filters.sorting) {
    // Sort by most likes if requested
    if (filters.sorting.mostLikes !== null) {
      // Sort posts by like count (descending)
      filteredPosts.sort((a, b) => {
        const likesA = a.like_count || 0;
        const likesB = b.like_count || 0;
        return likesB - likesA; // Descending order
      });

      // Take only the top N posts with most likes
      filteredPosts = filteredPosts.slice(0, filters.sorting.mostLikes);
      console.log(
        `After most likes filter (top ${filters.sorting.mostLikes}):`,
        filteredPosts.length,
      );
    }

    // Sort by most comments if requested
    if (filters.sorting.mostComments !== null) {
      // If we already filtered by likes, we need to respect that
      if (filters.sorting.mostLikes !== null) {
        console.log("Keeping likes sorting and adding comments filter");
        // Keep current filtering (by likes) but ensure we have enough posts
        const topLikesPosts = [...filteredPosts];

        // Get original posts filtered by everything except likes sorting
        let tempPosts = [...posts];

        // Apply range filter
        if (filters.postsRange) {
          const fromIndex = Math.max(0, (filters.postsRange.from || 1) - 1);
          const toIndex = Math.min(
            posts.length - 1,
            (filters.postsRange.to || posts.length) - 1,
          );
          tempPosts = tempPosts.slice(fromIndex, toIndex + 1);
        }

        // Apply likes min/max filter (not sorting)
        if (
          filters.likes &&
          (filters.likes.min !== null || filters.likes.max !== null)
        ) {
          const minLikes =
            filters.likes.min !== null ? parseInt(filters.likes.min) : 0;
          const maxLikes =
            filters.likes.max !== null ? parseInt(filters.likes.max) : Infinity;

          tempPosts = tempPosts.filter((post) => {
            const likeCount = post.like_count || 0;
            return likeCount >= minLikes && likeCount <= maxLikes;
          });
        }

        // Apply comments filter
        if (
          filters.comments &&
          (filters.comments.min !== null || filters.comments.max !== null)
        ) {
          const minComments =
            filters.comments.min !== null ? parseInt(filters.comments.min) : 0;
          const maxComments =
            filters.comments.max !== null
              ? parseInt(filters.comments.max)
              : Infinity;

          tempPosts = tempPosts.filter((post) => {
            const commentCount = post.comment_count || 0;
            return commentCount >= minComments && commentCount <= maxComments;
          });
        }

        // Apply date filter
        if (filters.date && (filters.date.from || filters.date.to)) {
          tempPosts = tempPosts.filter((post) => {
            if (!post.taken_at) return true;

            const postTimestamp = post.taken_at * 1000;
            const postDate = new Date(postTimestamp);

            if (filters.date.from) {
              const fromDate = new Date(filters.date.from);
              if (postDate < fromDate) return false;
            }

            if (filters.date.to) {
              const toDate = new Date(filters.date.to);
              toDate.setDate(toDate.getDate() + 1);
              if (postDate > toDate) return false;
            }

            return true;
          });
        }

        // Now sort tempPosts by comments
        tempPosts.sort((a, b) => {
          const commentsA = a.comment_count || 0;
          const commentsB = b.comment_count || 0;
          return commentsB - commentsA;
        });

        // Take top N by comments
        const topCommentsPosts = tempPosts.slice(
          0,
          filters.sorting.mostComments,
        );

        // Merge the two sets (prioritizing posts that are in both sets)
        const postIds = new Set();
        const mergedPosts = [];

        // First add posts that are in both sets (high likes and high comments)
        for (const likePost of topLikesPosts) {
          if (
            topCommentsPosts.some(
              (commentPost) => commentPost.id === likePost.id,
            )
          ) {
            mergedPosts.push(likePost);
            postIds.add(likePost.id);
          }
        }

        // Then add remaining posts from likes set
        for (const likePost of topLikesPosts) {
          if (!postIds.has(likePost.id)) {
            mergedPosts.push(likePost);
            postIds.add(likePost.id);
          }
        }

        // Then add remaining posts from comments set
        for (const commentPost of topCommentsPosts) {
          if (!postIds.has(commentPost.id)) {
            mergedPosts.push(commentPost);
            postIds.add(commentPost.id);
          }
        }

        // Limit to the max of the two limits to keep result set reasonable
        const limit = Math.max(
          filters.sorting.mostLikes,
          filters.sorting.mostComments,
        );
        filteredPosts = mergedPosts.slice(0, limit);

        console.log(
          `After merging top likes and top comments:`,
          filteredPosts.length,
        );
      } else {
        // Just sort by comments
        filteredPosts.sort((a, b) => {
          const commentsA = a.comment_count || 0;
          const commentsB = b.comment_count || 0;
          return commentsB - commentsA; // Descending order
        });

        // Take only the top N posts with most comments
        filteredPosts = filteredPosts.slice(0, filters.sorting.mostComments);
        console.log(
          `After most comments filter (top ${filters.sorting.mostComments}):`,
          filteredPosts.length,
        );
      }
    }
  }

  return filteredPosts;
}

export function getProfileUsername(): string | null {
  const match = location.pathname.match(/^\/@?([^\/]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // Fallback: try to get from page title or other elements
  const title = document.title.match(/@?([^•]+)/);
  if (title && title[1]) {
    return title[1].trim();
  }

  return null;
}

/**
 * Read the profile's posts, apply the filters, then hand the result to the downloader.
 * Progress goes to the side panel through profile-report.
 */
export async function fetchProfilePostsViaAPI(filtersIn: ProfileFilters, include: ProfileInclude): Promise<void> {
  const username = getProfileUsername();
  if (!username) {
    reportError("Could not tell which profile this is");
    throw new Error("Couldn't identify username");
  }
  if (!include.posts && !include.highlights && !include.avatar) {
    reportError("Tick at least one thing to download.");
    throw new Error("Nothing selected");
  }

  const filters: ProfileFilters = filtersIn && typeof filtersIn === "object" ? { ...filtersIn } : {};
  if (!filters.postsRange) filters.postsRange = { from: 1, to: 20 };

  try {
    reportProgress(0, "Preparing");

    let filteredPosts: LooseJson[] = [];
    if (include.posts) {
      const posts = await collectPosts(username, filters.postsRange.to);
      if (posts.length === 0 && !include.highlights && !include.avatar) {
        throw new Error("No posts found. The account may be private or empty.");
      }
      reportProgress(60, `Processing ${posts.length} posts`);
      const processedPosts = posts.map(function (post: LooseJson, index: number) {
        const processed = processPostData(post);
        processed.wall_order = index + 1;
        return processed;
      });
      reportProgress(65, "Applying filters");
      filteredPosts = applyFilters(processedPosts, filters);
      state.profilePostsCache[username] = filteredPosts;
      if (filteredPosts.length === 0 && !include.highlights && !include.avatar) {
        throw new Error("No posts matched those filters");
      }
    }

    let highlights: HighlightPayload[] = [];
    let avatarUrl: string | null = null;
    if (include.highlights || include.avatar) {
      reportProgress(68, "Reading the profile");
      const summary = await fetchProfileSummary(username);
      if (include.avatar) {
        avatarUrl = summary.avatarUrl;
        if (!avatarUrl) throw new Error("Instagram did not give out this profile picture.");
      }
      if (include.highlights && summary.userId) {
        highlights = await collectHighlights(summary.userId, include.highlightIds);
      }
    }

    if (filteredPosts.length === 0 && highlights.every((h) => h.items.length === 0) && !avatarUrl) {
      throw new Error("There was nothing to download. This profile has no highlights.");
    }

    processProfileDownload(username, filteredPosts, highlights, avatarPayload(avatarUrl));
  } catch (error: unknown) {
    console.error("Error in profile download:", error);
    reportError(error instanceof Error && error.message ? error.message : "Something went wrong while reading the profile");
    throw error;
  }
}

/** The chosen highlights (all when `only` is null) with their items, one request per reel. A reel that fails is skipped, not fatal. */
async function collectHighlights(userId: string, only: string[] | null): Promise<HighlightPayload[]> {
  const all = await fetchHighlightTray(userId);
  const tray = only ? all.filter((h) => only.includes(h.id)) : all;
  if (only && tray.length === 0) throw new Error("None of the highlights you picked exist any more. Reload the profile and pick again.");
  const out: HighlightPayload[] = [];
  for (const [i, reel] of tray.entries()) {
    reportProgress(68 + (i / Math.max(tray.length, 1)) * 12, `Reading highlight ${i + 1} of ${tray.length}`);
    try {
      out.push(await fetchHighlight(reel));
    } catch (e) {
      console.error("[Ephemera] highlight skipped:", reel.id, e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return out;
}

/** Read pages of 12 until `wanted` posts are in hand or the profile runs out. */
async function collectPosts(username: string, wanted: number): Promise<LooseJson[]> {
  const all: LooseJson[] = [];
  let cursor: string | null = null;
  reportProgress(10, "Reading posts");
  for (;;) {
    const page = await fetchPostsPage(username, cursor);
    all.push(...page.posts);
    reportProgress(20 + Math.min(all.length / wanted, 1) * 40, `Read ${Math.min(all.length, wanted)} of ${wanted} posts`);
    if (all.length >= wanted || !page.hasNext || !page.cursor) break;
    cursor = page.cursor;
    await new Promise((r) => setTimeout(r, 600)); // be polite to Instagram
  }
  return all.slice(0, wanted);
}

/**
 * Process downloading profile posts
 */
export function fetchMediaInfo(pk: string) {
  return fetch("https://i.instagram.com/api/v1/media/" + pk + "/info/", {
    headers: { "x-ig-app-id": "936619743392459" },
    credentials: "include",
  })
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      return j.items && j.items[0] ? j.items[0] : null;
    })
    .catch(function () {
      return null;
    });
}
// Lấy URL video thật cho các post/carousel-item video còn thiếu (tránh tải nhầm thumbnail)
export async function fillMissingVideoUrls(posts: ProfilePost[]) {
  for (var i = 0; i < posts.length; i++) {
    var post = posts[i];
    try {
      if (
        post.is_carousel &&
        post.carousel_items &&
        post.carousel_items.some(function (it: LooseJson) {
          return it.is_video && !it.video_url;
        }) &&
        (post.id || post.pk)
      ) {
        var info = await fetchMediaInfo(post.id || post.pk);
        if (info && info.carousel_media) {
          post.carousel_items.forEach(function (it: LooseJson, idx: LooseJson) {
            var cm = info.carousel_media[idx];
            if (it.is_video && !it.video_url && cm) {
              var vu =
                cm.video_versions && cm.video_versions[0]
                  ? cm.video_versions[0].url
                  : findVideoUrlDeep(cm);
              if (vu) it.video_url = vu;
            }
          });
        }
      } else if (post.is_video && !post.video_url && (post.id || post.pk)) {
        var info2 = await fetchMediaInfo(post.id || post.pk);
        if (info2) {
          var vu2 =
            info2.video_versions && info2.video_versions[0]
              ? info2.video_versions[0].url
              : findVideoUrlDeep(info2);
          if (vu2) post.video_url = vu2;
        }
      }
    } catch (e) {}
  }
}
export function processProfileDownload(
  username: string,
  posts: ProfilePost[],
  highlights: HighlightPayload[],
  avatar: AvatarPayload | null,
): void {
  if (posts.length > 0 && !(posts as ProfilePost).__videoFilled) {
    (posts as ProfilePost).__videoFilled = true;
    reportProgress(80, "Looking up video links");
    fillMissingVideoUrls(posts).then(function () {
      processProfileDownload(username, posts, highlights, avatar);
    });
    return;
  }

  reportProgress(85, "Preparing the download");

  // Prepare media data for download
  const mediaData = posts.map((post) => {
    let mediaUrls = [];
    let caption = {};
    if (post.caption) {
      caption = post.caption;
    }
    // Handle carousels
    if (
      post.is_carousel &&
      post.carousel_items &&
      post.carousel_items.length > 0
    ) {
      post.carousel_items.forEach((item: LooseJson, index: LooseJson) => {
        mediaUrls.push({
          url:
            item.is_video && item.video_url ? item.video_url : item.display_url,
          type: item.is_video ? "video" : "photo",
          id: item.id,
          media_order: index + 1,
        });
      });
    } else if (post.carousel_media && post.carousel_media.length > 0) {
      // Alternative carousel format
      post.carousel_media.forEach((item: LooseJson, index: LooseJson) => {
        let mediaUrl = null;
        let mediaType = "photo";

        if (item.video_versions && item.video_versions.length > 0) {
          mediaUrl = item.video_versions[0].url;
          mediaType = "video";
        } else if (
          item.image_versions2 &&
          item.image_versions2.candidates &&
          item.image_versions2.candidates.length > 0
        ) {
          mediaUrl = getBestImageUrl(item.image_versions2.candidates);
        }

        if (mediaUrl) {
          mediaUrls.push({
            url: mediaUrl,
            type: mediaType,
            id: item.pk || item.id,
            media_order: index + 1,
          });
        }
      });
    } else {
      // Handle single posts: ưu tiên video nếu là post video
      var _mu = null,
        _mt = "photo";
      if (post.is_video && post.video_url) {
        _mu = post.video_url;
        _mt = "video";
      } else if (post.video_versions && post.video_versions.length > 0) {
        _mu = post.video_versions[0].url;
        _mt = "video";
      } else {
        try {
          _mu = getBestImageUrl(post.image_versions2.candidates);
        } catch (ex) {
          _mu = post.display_url;
        }
        if (post.is_video) _mt = "video";
      }
      if (_mu) {
        mediaUrls.push({
          url: _mu,
          type: _mt,
          id: post.pk || post.id,
          media_order: 1,
        });
      }
    }

    return {
      id: post.id,
      shortcode: post.shortcode || post.code,
      wall_order: post.wall_order,
      media: mediaUrls,
      like_count: post.like_count,
      comment_count: post.comment_count,
      caption: caption,
    };
  });

  reportProgress(90, "Starting download");

  // The service worker answers through tab messages (downloadProgress / downloadComplete /
  // downloadError), which listeners.ts forwards to the side panel.
  void chrome.runtime
    .sendMessage({ profileDownload: true, username: username, posts: mediaData, highlights, avatar })
    .catch(() => reportError("The download did not start. Reload the Instagram tab and try again."));
}
