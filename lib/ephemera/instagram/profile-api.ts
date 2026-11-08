import type { LooseJson, ProfileFilters, ProfilePost } from './types';
import { findVideoUrlDeep, getBestImageUrl } from './story-fetch';
import { showProfileDownloadCaution, showProfileDownloadError, showProgressBar } from './profile-ui';
import { state } from './state';

export function fetchProfilePostsWithEarlyStopping(
  userId: LooseJson,
  username: LooseJson,
  csrfToken: LooseJson,
  maxPostsNeeded: LooseJson,
  buttonElement: HTMLElement | null = null,
  after: string | null = null,
  allPosts: LooseJson[] = [],
) {
  return new Promise<LooseJson[]>((resolve, reject) => {
    // Updated progress if button element exists
    if (buttonElement && allPosts.length > 0) {
      // Calculate progress percentage (20-60%)
      const baseProgress = 20;
      const progressRange = 40;
      const progressPercentage =
        baseProgress +
        Math.min(allPosts.length / maxPostsNeeded, 1) * progressRange;

      showProgressBar(
        buttonElement,
        progressPercentage,
        `Fetched ${allPosts.length}/${maxPostsNeeded} posts...`,
      );
    }

    // If we already have enough posts, stop fetching
    if (allPosts.length >= maxPostsNeeded) {
      console.log(
        `Early stopping: Already fetched ${allPosts.length} posts, needed ${maxPostsNeeded}`,
      );
      resolve(allPosts.slice(0, maxPostsNeeded));
      return;
    }

    // API logic
    let variablesObj;

    if (after) {
      // For pagination requests
      variablesObj = {
        data: {
          count: 12,
          include_reel_media_seen_timestamp: true,
          include_relationship_info: true,
          latest_besties_reel_media: true,
          latest_reel_media: true,
        },
        username: username,
        __relay_internal__pv__PolarisIsLoggedInrelayprovider: true,
        __relay_internal__pv__PolarisShareSheetV3relayprovider: false,
        first: 12,
        last: null,
        after: after,
        before: null,
      };
    } else {
      // For initial request
      variablesObj = {
        data: {
          count: 12,
          include_reel_media_seen_timestamp: true,
          include_relationship_info: true,
          latest_besties_reel_media: true,
          latest_reel_media: true,
        },
        username: username,
        __relay_internal__pv__PolarisIsLoggedInrelayprovider: true,
        __relay_internal__pv__PolarisShareSheetV3relayprovider: false,
      };
    }

    // Log the request for debugging
    console.log(
      `Fetching profile posts for ${username}${after ? ` with cursor: ${after}` : ""}`,
    );

    // Determine which endpoint to use based on whether we're paginating
    const endpoint = "https://www.instagram.com/graphql/query";

    // Prepare the request
    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        "x-instagram-ajax": "1016349901",
        "x-asbd-id": "129477",
        "x-ig-app-id": "936619743392459",
        "x-requested-with": "XMLHttpRequest",
        "x-csrftoken": csrfToken,
        "content-type": "application/x-www-form-urlencoded",
      },
      credentials: "include",
      body: new URLSearchParams({
        fb_dtsg: state.tokendsg,
        variables: JSON.stringify(variablesObj),
        doc_id: 9750506811647048,
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "PolarisProfilePostsQuery",
        server_timestamps: true,
      } as unknown as Record<string, string>).toString(),
    };

    fetch(endpoint, requestOptions)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status}`);
        }
        return response.json();
      })
      .then((json) => {
        console.log("Response received:", json);

        // Extract posts from the response
        let posts: LooseJson[] = [];
        let hasNextPage = false;
        let endCursor: string | null = null;

        try {
          // Find the media data in different possible locations
          let mediaData = null;

          if (
            json.data &&
            json.data.user &&
            json.data.user.edge_owner_to_timeline_media
          ) {
            // GraphQL query hash response format
            mediaData = json.data.user.edge_owner_to_timeline_media;
            hasNextPage = mediaData.page_info.has_next_page;
            endCursor = mediaData.page_info.end_cursor;
          } else if (
            json.data &&
            json.data.xdt_api__v1__feed__user_timeline_graphql_connection
          ) {
            // Standard API response format
            mediaData =
              json.data.xdt_api__v1__feed__user_timeline_graphql_connection;
            hasNextPage = mediaData.page_info.has_next_page;
            endCursor = mediaData.page_info.end_cursor;
          }

          if (mediaData && mediaData.edges) {
            // Process each post
            mediaData.edges.forEach((edge: LooseJson) => {
              // Handle different node structures
              const node = edge.node.media || edge.node;

              // Process post to extract likes and comments
              posts.push(node);
            });
          }

          console.log(`Extracted ${posts.length} posts from response`);

          // Combine with previous posts
          const combinedPosts = [...allPosts, ...posts];
          console.log(`Total posts collected: ${combinedPosts.length}`);

          // Check if we have enough posts now
          if (combinedPosts.length >= maxPostsNeeded) {
            console.log(
              `We have ${combinedPosts.length} posts, which is enough (needed ${maxPostsNeeded})`,
            );
            // Return only the number of posts we need
            resolve(combinedPosts.slice(0, maxPostsNeeded));
            return;
          }

          // If there are more pages and we need more posts, fetch the next page
          if (hasNextPage && endCursor) {
            console.log(
              `Found more posts. Cursor: ${endCursor}. Fetching next page...`,
            );

            // Wait a bit to avoid rate limiting
            setTimeout(() => {
              fetchProfilePostsWithEarlyStopping(
                userId,
                username,
                csrfToken,
                maxPostsNeeded,
                buttonElement,
                endCursor,
                combinedPosts,
              )
                .then(resolve)
                .catch(reject);
            }, 1000);
          } else {
            console.log(
              `Finished fetching posts. Total: ${combinedPosts.length}`,
            );
            resolve(combinedPosts);
          }
        } catch (e) {
          console.error("Error processing profile posts data:", e);

          // If we have some posts, return them instead of failing
          if (allPosts.length > 0) {
            resolve(allPosts);
          } else {
            reject(e);
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching profile posts:", error);

        // If we already have some posts, return those instead of failing
        if (allPosts.length > 0) {
          console.log(
            `Returning ${allPosts.length} posts that were already fetched`,
          );
          resolve(allPosts);
        } else {
          reject(error);
        }
      });
  });
}

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

export function getUserPostCount(username: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // Get CSRF token
    const token = document.documentElement.outerHTML.match(
      /csrf_token":".*?(?=")/g,
    );
    const csrfToken = token && token[0] ? token[0].split('"')[2] : "";

    // Fetch user profile to get post count
    fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        method: "GET",
        headers: {
          "x-instagram-ajax": "1016349901",
          "x-asbd-id": "129477",
          "x-ig-app-id": "936619743392459",
          "x-requested-with": "XMLHttpRequest",
          "x-csrftoken": csrfToken,
        },
        credentials: "include",
      },
    )
      .then((response) => response.json())
      .then((json) => {
        if (
          json.data &&
          json.data.user &&
          json.data.user.edge_owner_to_timeline_media &&
          json.data.user.edge_owner_to_timeline_media.count !== undefined
        ) {
          const postCount = json.data.user.edge_owner_to_timeline_media.count;
          resolve(postCount);
        } else {
          console.log("Could not find post count in API response", json);
          reject(new Error("Could not find post count"));
        }
      })
      .catch((error) => {
        console.error("Error fetching post count:", error);
        reject(error);
      });
  });
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
 * Get user ID from username
 */
export function getUserId(username: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if we already have the user ID cached
    for (let i in state.rangeid) {
      if (state.rangeid[i].pkid === username) {
        resolve(state.rangeid[i].userid);
        return;
      }
    }

    // Get CSRF token
    const token = document.documentElement.outerHTML.match(
      /csrf_token":".*?(?=")/g,
    );
    const csrfToken = token && token[0] ? token[0].split('"')[2] : "";

    // Fetch user profile to get ID
    fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        method: "GET",
        headers: {
          "x-instagram-ajax": "1016349901",
          "x-asbd-id": "129477",
          "x-ig-app-id": "936619743392459",
          "x-requested-with": "XMLHttpRequest",
          "x-csrftoken": csrfToken,
        },
        credentials: "include",
      },
    )
      .then((response) => response.json())
      .then((json) => {
        if (json.data && json.data.user && json.data.user.id) {
          const userId = json.data.user.id;
          state.rangeid.push({ pkid: username, userid: userId });
          resolve(userId);
        } else {
          reject(new Error("Could not find user ID"));
        }
      })
      .catch(reject);
  });
}

export function fetchProfilePosts(
  userId: LooseJson,
  username: LooseJson,
  csrfToken: LooseJson,
  after: string | null = null,
  allPosts: LooseJson[] = [],
) {
  state.usernamex = username;
  return new Promise<LooseJson[]>((resolve, reject) => {
    // Build request parameters based on whether this is initial load or pagination
    let variablesObj;

    if (after) {
      // For pagination requests
      variablesObj = {
        data: {
          count: 12,
          include_reel_media_seen_timestamp: true,
          include_relationship_info: true,
          latest_besties_reel_media: true,
          latest_reel_media: true,
        },
        username: username,
        __relay_internal__pv__PolarisIsLoggedInrelayprovider: true,
        __relay_internal__pv__PolarisShareSheetV3relayprovider: false,
        first: 12,
        last: null,
        after: after,
        before: null,
      };
    } else {
      // For initial request
      variablesObj = {
        data: {
          count: 12,
          include_reel_media_seen_timestamp: true,
          include_relationship_info: true,
          latest_besties_reel_media: true,
          latest_reel_media: true,
        },
        username: username,
        __relay_internal__pv__PolarisIsLoggedInrelayprovider: true,
        __relay_internal__pv__PolarisShareSheetV3relayprovider: false,
      };
    }

    // Log the request for debugging
    console.log(
      `Fetching profile posts for ${username}${after ? ` with cursor: ${after}` : ""}`,
    );
    console.log("Variables:", JSON.stringify(variablesObj));

    // Determine which endpoint to use based on whether we're paginating
    const endpoint = "https://www.instagram.com/graphql/query";
    // Prepare the request
    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        "x-instagram-ajax": "1016349901",
        "x-asbd-id": "129477",
        "x-ig-app-id": "936619743392459",
        "x-requested-with": "XMLHttpRequest",
        "x-csrftoken": csrfToken,
        "content-type": "application/x-www-form-urlencoded",
      },
      credentials: "include",
    };

    if (after) {
      // For pagination, use URL parameters instead of form data
      requestOptions.body = new URLSearchParams({
        fb_dtsg: state.tokendsg,
        variables: JSON.stringify(variablesObj),
        doc_id: 9750506811647048,
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "PolarisProfilePostsQuery",
        server_timestamps: true,
      } as unknown as Record<string, string>).toString();

      fetch(endpoint, requestOptions).then(processResponse).catch(handleError);
    } else {
      // For initial request, use form data
      requestOptions.body = new URLSearchParams({
        fb_dtsg: state.tokendsg,
        variables: JSON.stringify(variablesObj),
        doc_id: 9750506811647048,
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "PolarisProfilePostsQuery",
        server_timestamps: true,
      } as unknown as Record<string, string>).toString();

      fetch(endpoint, requestOptions).then(processResponse).catch(handleError);
    }

    function processResponse(response: LooseJson) {
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
      }
      return response.json().then(processData);
    }

    function processData(json: LooseJson) {
      console.log("Response received:", json);

      // Extract posts from the response
      let posts: LooseJson[] = [];
      let hasNextPage = false;
      let endCursor: string | null = null;

      try {
        // Find the media data in different possible locations
        let mediaData = null;

        if (
          json.data &&
          json.data.user &&
          json.data.user.edge_owner_to_timeline_media
        ) {
          // GraphQL query hash response format
          mediaData = json.data.user.edge_owner_to_timeline_media;
          hasNextPage = mediaData.page_info.has_next_page;
          endCursor = mediaData.page_info.end_cursor;
        } else if (
          json.data &&
          json.data.xdt_api__v1__feed__user_timeline_graphql_connection
        ) {
          // Standard API response format
          mediaData =
            json.data.xdt_api__v1__feed__user_timeline_graphql_connection;
          hasNextPage = mediaData.page_info.has_next_page;
          endCursor = mediaData.page_info.end_cursor;
        }

        if (mediaData && mediaData.edges) {
          // Process each post
          mediaData.edges.forEach((edge: LooseJson) => {
            // Handle different node structures
            const node = edge.node.media || edge.node;

            // Log the raw node for debugging
            console.log("Processing post node:", node);

            // Extract media ID
            const mediaId = node.pk || node.id;

            // Try to find display URL in different possible locations
            let displayUrl = node.display_url;
            if (!displayUrl && node.thumbnail_src) {
              displayUrl = node.thumbnail_src;
            }
            if (
              !displayUrl &&
              node.image_versions2 &&
              node.image_versions2.candidates &&
              node.image_versions2.candidates.length > 0
            ) {
              displayUrl = getBestImageUrl(node.image_versions2.candidates);
            }

            // Try to find video URL in different possible locations
            let videoUrl = node.video_url;
            if (
              !videoUrl &&
              node.video_versions &&
              node.video_versions.length > 0
            ) {
              videoUrl = node.video_versions[0].url;
            }

            // Create post object with all available data
            const post = {
              id: node.id,
              shortcode: node.shortcode || node.code,
              display_url: displayUrl,
              is_video: node.is_video || !!videoUrl,
              video_url: videoUrl,
              media_id: mediaId,
              is_carousel: false,
              carousel_items: [],
            };

            // Handle carousel posts (multi-photo/video posts)
            if (
              node.edge_sidecar_to_children &&
              node.edge_sidecar_to_children.edges
            ) {
              post.is_carousel = true;
              post.carousel_items = node.edge_sidecar_to_children.edges.map(
                (e: LooseJson) => {
                  const carouselNode = e.node;

                  // Try to find display URL for carousel item
                  let itemDisplayUrl = carouselNode.display_url;
                  if (!itemDisplayUrl && carouselNode.thumbnail_src) {
                    itemDisplayUrl = carouselNode.thumbnail_src;
                  }
                  if (
                    !itemDisplayUrl &&
                    carouselNode.image_versions2 &&
                    carouselNode.image_versions2.candidates &&
                    carouselNode.image_versions2.candidates.length > 0
                  ) {
                    itemDisplayUrl = getBestImageUrl(
                      carouselNode.image_versions2.candidates,
                    );
                  }

                  // Try to find video URL for carousel item
                  let itemVideoUrl = carouselNode.video_url;
                  if (
                    !itemVideoUrl &&
                    carouselNode.video_versions &&
                    carouselNode.video_versions.length > 0
                  ) {
                    itemVideoUrl = carouselNode.video_versions[0].url;
                  }

                  return {
                    id: carouselNode.id,
                    display_url: itemDisplayUrl,
                    is_video: carouselNode.is_video || !!itemVideoUrl,
                    video_url: itemVideoUrl,
                    media_id: carouselNode.pk || carouselNode.id,
                  };
                },
              );
            } else if (node.carousel_media && node.carousel_media.length > 0) {
              // Alternative carousel format
              post.is_carousel = true;
              post.carousel_items = node.carousel_media.map((item: LooseJson) => {
                // Try to find display URL for carousel item
                let itemDisplayUrl = null;
                if (
                  item.image_versions2 &&
                  item.image_versions2.candidates &&
                  item.image_versions2.candidates.length > 0
                ) {
                  itemDisplayUrl = getBestImageUrl(
                    item.image_versions2.candidates,
                  );
                }

                // Try to find video URL for carousel item
                let itemVideoUrl = null;
                if (item.video_versions && item.video_versions.length > 0) {
                  itemVideoUrl = item.video_versions[0].url;
                }

                return {
                  id: item.pk || item.id,
                  display_url: itemDisplayUrl,
                  is_video: !!item.video_versions || !!itemVideoUrl,
                  video_url: itemVideoUrl,
                  media_id: item.pk || item.id,
                };
              });
            }

            posts.push(post);
          });
        }

        console.log(`Extracted ${posts.length} posts from response`);

        // Summary of media types for debugging
        const videoCount = posts.filter((p) => p.is_video).length;
        const carouselCount = posts.filter((p) => p.is_carousel).length;
        console.log(
          `Media types: ${videoCount} videos, ${carouselCount} carousels, ${posts.length - videoCount - carouselCount} photos`,
        );

        // Check for posts without display_url
        const missingDisplayUrl = posts.filter((p) => !p.display_url).length;
        if (missingDisplayUrl > 0) {
          console.warn(
            `Warning: ${missingDisplayUrl} posts are missing display_url`,
          );
        }

        // Check for video posts without video_url
        const missingVideoUrl = posts.filter(
          (p) => p.is_video && !p.video_url,
        ).length;
        if (missingVideoUrl > 0) {
          console.warn(
            `Warning: ${missingVideoUrl} video posts are missing video_url`,
          );
        }

        // Combine with previous posts
        const combinedPosts = [...allPosts, ...posts];

        // If there are more pages and we haven't hit the limit, fetch the next page
        if (hasNextPage && endCursor && combinedPosts.length < 1000) {
          console.log(
            `Found more posts. Cursor: ${endCursor}. Fetching next page...`,
          );

          // Wait a bit to avoid rate limiting
          setTimeout(() => {
            fetchProfilePosts(
              userId,
              username,
              csrfToken,
              endCursor,
              combinedPosts,
            )
              .then(resolve)
              .catch(reject);
          }, 1000);
        } else {
          console.log(
            `Finished fetching posts. Total: ${combinedPosts.length}`,
          );
          resolve(combinedPosts);
        }
      } catch (e) {
        console.error("Error processing profile posts data:", e);
        reject(e);
      }
    }

    function handleError(error: LooseJson) {
      console.error("Error fetching profile posts:", error);

      // If we already have some posts, return those instead of failing
      if (allPosts.length > 0) {
        console.log(
          `Returning ${allPosts.length} posts that were already fetched`,
        );
        resolve(allPosts);
      } else {
        reject(error);
      }
    }
  });
}
export function fetchProfilePostsViaAPI(this: HTMLElement | undefined): Promise<LooseJson[]> | undefined {
  // Get username from URL
  const username = getProfileUsername();
  if (!username) {
    showProfileDownloadError(this, "Couldn't identify username");
    state.isProcessingProfile = false;
    return Promise.reject("Couldn't identify username");
  }

  // Update button text and show initial progress
  const buttonElement = document.querySelector<HTMLElement>(
    ".eph_toolkit_profile_download_btn",
  );
  if (buttonElement) {
    showProgressBar(buttonElement, 0, "Preparing download...");
  }

  // Get filters from session storage
  const filtersJson =
    localStorage.getItem("eph_toolkit_filters") ||
    sessionStorage.getItem("eph_toolkit_filters");
  let filters: ProfileFilters = {};

  if (filtersJson) {
    try {
      filters = JSON.parse(filtersJson);
      console.log("Applied filters:", filters);
    } catch (e) {
      console.error("Error parsing filters:", e);
    }
  }

  // If no filters set, create default
  if (!filters.postsRange) {
    filters.postsRange = { from: 1, to: 20 };
  }

  // Store the post count we need to fetch
  const postsNeeded = filters.postsRange.to - filters.postsRange.from + 1;
  console.log(`Posts needed: ${postsNeeded}`);

  return new Promise<LooseJson[]>((resolve, reject) => {
    // First get user ID
    getUserId(username)
      .then((userId) => {
        if (!userId) throw new Error("Could not get user ID");

        if (buttonElement) {
          showProgressBar(buttonElement, 10, "Fetching posts...");
        }

        const token = document.documentElement.outerHTML.match(
          /csrf_token":".*?(?=")/g,
        );
        const csrfToken = token && token[0] ? token[0].split('"')[2] : "";

        // Fetch posts using GraphQL API with early stopping
        return fetchProfilePostsWithEarlyStopping(
          userId,
          username,
          csrfToken,
          filters.postsRange.to,
          buttonElement,
        );
      })
      .then((posts) => {
        if (!posts || posts.length === 0) {
          throw new Error("No posts found");
        }

        console.log(`Successfully fetched ${posts.length} posts via API`);

        if (buttonElement) {
          showProgressBar(
            buttonElement,
            60,
            `Processing ${posts.length} posts...`,
          );
        }

        // Process each post to ensure like_count and comment_count are extracted
        const processedPosts = posts.map(function (post: LooseJson, index: LooseJson) {
          var processed = processPostData(post);
          processed.wall_order = index + 1;
          return processed;
        });

        // Apply filters
        let filteredPosts = processedPosts;

        if (buttonElement) {
          showProgressBar(buttonElement, 70, "Applying filters...");
        }

        // Apply filters
        if (filters) {
          filteredPosts = applyFilters(processedPosts, filters);
          console.log(
            `After filtering: ${filteredPosts.length} posts selected for download`,
          );
        }

        // Store filtered posts in cache
        state.profilePostsCache[username] = filteredPosts;

        if (buttonElement) {
          showProgressBar(buttonElement, 80, "Preparing download...");
        }

        // Process download
        if (buttonElement) {
          processProfileDownload(buttonElement, username, filteredPosts);
        }

        // Clear the filters from storage
        localStorage.removeItem("eph_toolkit_filters");
        sessionStorage.removeItem("eph_toolkit_filters");

        resolve(filteredPosts);
      })
      .catch((error) => {
        console.error("Error in profile download:", error);
        if (buttonElement) {
          showProfileDownloadError(buttonElement, error.message);
        }
        reject(error);
      });
  });
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
export function processProfileDownload(buttonElement: HTMLElement, username: string, posts: ProfilePost[]): void {
  if (posts.length === 0) {
    showProfileDownloadError(buttonElement, "No posts found");
    return;
  }

  if (!(posts as ProfilePost).__videoFilled) {
    (posts as ProfilePost).__videoFilled = true;
    showProgressBar(buttonElement, 80, "Đang lấy link video...");
    fillMissingVideoUrls(posts).then(function () {
      processProfileDownload(buttonElement, username, posts);
    });
    return;
  }

  // Update progress bar for preparing download
  showProgressBar(
    buttonElement,
    85,
    `Preparing to download ${posts.length} posts...`,
  );

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

  // Update progress bar to downloading state
  showProgressBar(buttonElement, 90, `Starting download...`);

  // Send to background script for downloading
  chrome.runtime.sendMessage(
    {
      profileDownload: true,
      username: username,
      posts: mediaData,
    },
    (response) => {
      // Update button status based on response
      if (response && response.success) {
        showProgressBar(buttonElement, 100, `Download Complete!`);

        // Reset after 5 seconds
        setTimeout(() => {
          buttonElement.innerHTML = `
                    <span class="eph_toolkit_icon"></span>
                    <span class="eph_toolkit_text">Download All</span>
                `;
          state.isProcessingProfile = false;
        }, 5000);
      } else {
        showProfileDownloadCaution(buttonElement, "Waiting for background!!");
      }
    },
  );
}

