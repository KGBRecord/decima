import type { LooseJson, ProfilePost } from './types';
import { codetopk } from './shortcode';
import { getBestImageUrl } from './story-fetch';
import { getProfileUsername } from './profile-api';

export function fetchFallbackPosts(username: string, csrfToken: string): Promise<ProfilePost[]> {
  return new Promise((resolve, reject) => {
    // First try to load profile page to extract some initial posts
    fetch(`https://www.instagram.com/${username}/`, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml",
        "User-Agent": navigator.userAgent,
      },
    })
      .then((response) => response.text())
      .then((html) => {
        const posts: LooseJson[] = [];

        // Look for post shortcodes in the HTML
        const shortcodes = Array.from(
          new Set(html.match(/\/p\/([^\/]+)\//g) || []),
        ).map((path) => path.split("/p/")[1].replace("/", ""));

        if (shortcodes.length === 0) {
          return resolve([]);
        }

        // Process each post in sequence to avoid rate limiting
        const processNextPost = (index: LooseJson) => {
          if (index >= shortcodes.length) {
            return resolve(posts);
          }

          const shortcode = shortcodes[index];

          // Convert shortcode to media ID
          const mediaId = codetopk(shortcode);
          if (!mediaId) {
            return processNextPost(index + 1);
          }

          // Fetch post details
          fetch(`https://www.instagram.com/api/v1/media/${mediaId}/info/`, {
            method: "GET",
            headers: {
              "x-instagram-ajax": "1016349901",
              "x-asbd-id": "129477",
              "x-ig-app-id": "936619743392459",
              "x-requested-with": "XMLHttpRequest",
              "x-csrftoken": csrfToken,
            },
          })
            .then((response) => response.json())
            .then((json: LooseJson) => {
              if (json.items && json.items.length > 0) {
                const item = json.items[0];

                // Helper function to process a media item
                const processMediaItem = (media: LooseJson) => {
                  return {
                    id: media.pk || media.id,
                    shortcode: media.code,
                    display_url: getBestImageUrl(
                      media.image_versions2.candidates,
                    ),
                    is_video: !!media.video_versions,
                    video_url: media.video_versions
                      ? media.video_versions[0].url
                      : null,
                  };
                };

                if (item.carousel_media) {
                  // Process carousel post
                  const post = {
                    id: item.pk || item.id,
                    shortcode: item.code,
                    is_carousel: true,
                    carousel_items: item.carousel_media.map(processMediaItem),
                  };
                  posts.push(post);
                } else {
                  // Process single media post
                  posts.push(processMediaItem(item));
                }
              }

              // Process next post after a small delay
              setTimeout(() => processNextPost(index + 1), 300);
            })
            .catch((error) => {
              console.error(`Error fetching post ${shortcode}:`, error);
              processNextPost(index + 1);
            });
        };

        // Start processing posts
        processNextPost(0);
      })
      .catch((error) => {
        console.error("Error in fallback post fetch:", error);
        resolve([]); // Return empty array on failure
      });
  });
}

/**
 * Alternative approach to extract posts from page HTML/JSON
 */
export function extractPostsFromPage() {
  // Try to find shared data script
  const scripts = document.querySelectorAll<HTMLElement>('script[type="text/javascript"]');
  for (const script of scripts) {
    if (script.textContent.includes("window._sharedData = ")) {
      try {
        const match = script.textContent.match(/window\._sharedData = (.+);/);
        if (match && match[1]) {
          const data = JSON.parse(match[1]);

          // Look for profile data
          if (
            data.entry_data &&
            data.entry_data.ProfilePage &&
            data.entry_data.ProfilePage[0]
          ) {
            const userData = data.entry_data.ProfilePage[0].graphql.user;
            const username = userData.username;

            if (
              userData.edge_owner_to_timeline_media &&
              userData.edge_owner_to_timeline_media.edges
            ) {
              const posts = userData.edge_owner_to_timeline_media.edges.map(
                (edge: LooseJson) => {
                  const node = edge.node;
                  const post = {
                    id: node.id,
                    shortcode: node.shortcode,
                    display_url: node.display_url,
                    is_video: node.is_video,
                    video_url: node.video_url,
                    is_carousel: false,
                    carousel_items: [],
                  };

                  // Process carousel posts
                  if (
                    node.edge_sidecar_to_children &&
                    node.edge_sidecar_to_children.edges
                  ) {
                    post.is_carousel = true;
                    post.carousel_items =
                      node.edge_sidecar_to_children.edges.map((e: LooseJson) => ({
                        id: e.node.id,
                        display_url: e.node.display_url,
                        is_video: e.node.is_video,
                        video_url: e.node.video_url,
                      }));
                  }

                  return post;
                },
              );

              return { username, posts };
            }
          }
        }
      } catch (e) {
        console.error("Error extracting posts from sharedData:", e);
      }
    }
  }

  // Try other scripts that might contain media data
  for (const script of scripts) {
    if (script.textContent.includes('{"require":')) {
      try {
        // Instagram sometimes embeds JSON data directly in script tags
        const jsonMatches = script.textContent.match(/\{\"require\":.+\}/g);
        if (jsonMatches && jsonMatches.length > 0) {
          for (const jsonText of jsonMatches) {
            try {
              const data = JSON.parse(jsonText);

              // Look for user and media data in various places
              if (data.require && Array.isArray(data.require)) {
                for (const item of data.require) {
                  if (
                    Array.isArray(item) &&
                    item.length > 2 &&
                    item[0] === "ProfilePageContainer"
                  ) {
                    // Found profile data
                    if (item[1] && item[1].user) {
                      const userData = item[1].user;
                      const username = userData.username;

                      if (
                        userData.edge_owner_to_timeline_media &&
                        userData.edge_owner_to_timeline_media.edges
                      ) {
                        const posts =
                          userData.edge_owner_to_timeline_media.edges.map(
                            (edge: LooseJson) => {
                              const node = edge.node;
                              return {
                                id: node.id,
                                shortcode: node.shortcode,
                                display_url: node.display_url,
                                is_video: node.is_video,
                                video_url: node.video_url,
                                is_carousel: !!node.edge_sidecar_to_children,
                                carousel_items: node.edge_sidecar_to_children
                                  ? node.edge_sidecar_to_children.edges.map(
                                      (e: LooseJson) => ({
                                        id: e.node.id,
                                        display_url: e.node.display_url,
                                        is_video: e.node.is_video,
                                        video_url: e.node.video_url,
                                      }),
                                    )
                                  : [],
                              };
                            },
                          );

                        return { username, posts };
                      }
                    }
                  }
                }
              }
            } catch (e) {
              // Continue to next JSON match
            }
          }
        }
      } catch (e) {
        // Continue to next script
      }
    }
  }

  // If all else fails, try to at least extract post shortcodes from page HTML
  try {
    const html = document.documentElement.outerHTML;
    const shortcodePattern = /\"shortcode\":\"([^\"]+)\"/g;
    const shortcodes = [];
    let match;

    while ((match = shortcodePattern.exec(html)) !== null) {
      shortcodes.push(match[1]);
    }

    if (shortcodes.length > 0) {
      const username = getProfileUsername();
      if (username) {
        console.log(
          `Extracted ${shortcodes.length} post shortcodes from page HTML`,
        );
        return {
          username,
          shortcodes,
          // Return empty posts array as these need to be fetched individually
          posts: [],
        };
      }
    }
  } catch (e) {
    console.error("Error extracting shortcodes from HTML:", e);
  }

  return null;
}

export function fetchPostByShortcode(shortcode: string, csrfToken: string) {
  return new Promise<{ post: LooseJson; username: string }>((resolve, reject) => {
    // First convert shortcode to media ID
    const mediaId = codetopk(shortcode);
    if (!mediaId) {
      return reject(new Error("Failed to convert shortcode to media ID"));
    }

    // Then fetch media info
    fetch(`https://www.instagram.com/api/v1/media/${mediaId}/info/`, {
      method: "GET",
      headers: {
        "x-instagram-ajax": "1016349901",
        "x-asbd-id": "129477",
        "x-ig-app-id": "936619743392459",
        "x-requested-with": "XMLHttpRequest",
        "x-csrftoken": csrfToken,
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Network error: ${response.status}`);
        }
        return response.json();
      })
      .then((json: LooseJson) => {
        if (!json.items || json.items.length === 0) {
          throw new Error("No items in response");
        }

        const item = json.items[0];
        const username = item.user ? item.user.username : "";

        // Helper function to process media
        const processMedia = (media: LooseJson) => {
          return {
            id: media.pk || media.id,
            display_url: media.image_versions2
              ? getBestImageUrl(media.image_versions2.candidates)
              : "",
            is_video: !!media.video_versions,
            video_url: media.video_versions
              ? media.video_versions[0].url
              : null,
          };
        };

        // Create a post object
        const post: LooseJson = {
          id: item.pk || item.id,
          shortcode: item.code,
          is_carousel: !!item.carousel_media,
          carousel_items: [],
        };

        // Handle carousel media
        if (item.carousel_media) {
          post.carousel_items = item.carousel_media.map(processMedia);
        } else {
          // Single media - add properties directly to post
          const mediaData = processMedia(item);
          post.display_url = mediaData.display_url;
          post.is_video = mediaData.is_video;
          post.video_url = mediaData.video_url;
        }

        resolve({ post, username });
      })
      .catch(reject);
  });
}

export function processShortcodes(shortcodes: string[], csrfToken: string) {
  return new Promise<{ posts: LooseJson[]; username: string }>((resolve, reject) => {
    const posts: LooseJson[] = [];
    let username = "";

    // Process shortcodes sequentially to avoid rate limiting
    const processNext = (index: LooseJson) => {
      if (index >= shortcodes.length) {
        return resolve({ posts, username });
      }

      fetchPostByShortcode(shortcodes[index], csrfToken)
        .then((result) => {
          posts.push(result.post);
          username = result.username || username;

          // Process next shortcode after a delay
          setTimeout(() => processNext(index + 1), 500);
        })
        .catch((error) => {
          console.error(`Error fetching post ${shortcodes[index]}:`, error);
          // Continue with next shortcode even if one fails
          setTimeout(() => processNext(index + 1), 500);
        });
    };

    // Start processing
    processNext(0);
  });
}

