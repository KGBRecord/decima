import type { IgImageCandidate, IgMediaInfoResponse, IgMediaItem, IgStoryResponse, IgVideoVersion, MediaInfo } from './types';
import { state } from './state';

/**
 * Send download request to background script
 * @param {object} data - Media data
 * @param {number} rande - Index for carousel media
 * @param {string} user - Username for filename
 * @param {object} datajson - Full media JSON data
 */
export function downloadsend(data: MediaInfo[] | null | undefined, rande: number | null | undefined, user: string, datajson: IgMediaInfoResponse | null | undefined): void {
  try {
    console.log(
      "[Ephemera] media URLs:",
      JSON.stringify(
        (data || []).map(function (d) {
          return d.urls;
        }),
      ),
      "| index:",
      rande,
    );
  } catch (e) {}
  var postCode = getIgPostCodeFromJson(datajson);
  var namedData = (data || []).map(function (item, index) {
    var firstUrl = (item && item.urls && item.urls[0]) || "";
    var type = firstUrl.indexOf(".mp4") !== -1 ? "video" : "image";
    return Object.assign({}, item, {
      filename: buildIgFileBase(user, postCode, index + 1, type),
    });
  });

  if (rande != null) {
    let datx = namedData[rande];
    chrome.runtime.sendMessage(
      {
        downloadv1: datx.urls[0],
        idx: user + "_" + datx.pk,
        url: location.href,
        platform: "ig",
        channel: user,
        shortcode: postCode,
        order: rande + 1,
        mediaType: datx.urls[0].indexOf(".mp4") !== -1 ? "video" : "image",
        filename: datx.filename,
      },
      (response) => {
        console.log("Download initiated");
      },
    );
  } else {
    chrome.runtime.sendMessage(
      {
        download: namedData,
        rande,
        user: [
          "ig",
          igNamePart(user, "unknown_channel"),
          igNamePart(postCode, "post"),
          "album",
        ].join("_"),
        albumName: [
          "ig",
          igNamePart(user, "unknown_channel"),
          igNamePart(postCode, "post"),
          "album",
        ].join("_"),
        datajson: datajson,
      },
      (response) => {
        console.log("Download initiated");
      },
    );
  }
}

/**
 * Fetch and process story media for a user
 * @param {string} username - Instagram username
 */
export function getstorybyusername(username: string): void {
  let userId = null;

  // Check if we already have the user ID cached
  for (let i in state.rangeid) {
    if (state.rangeid[i].pkid == username) {
      userId = state.rangeid[i].userid;
      break;
    }
  }

  if (userId) {
    getstorybyid(userId);
    return;
  }

  // Get CSRF token for API requests
  const token = document.documentElement.outerHTML.match(
    /csrf_token":".*?(?=")/g,
  );
  const csrfToken = token && token[0] ? token[0].split('"')[2] : "";

  // Fetch user profile to get user ID
  fetch(
    "https://i.instagram.com/api/v1/users/web_profile_info/?username=" +
      username,
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
        getstorybyid(userId);
      }
    })
    .catch((err) => {
      console.error("Error fetching user ID:", err);
    });
}

/**
 * Get highest resolution image URL from image_versions2.candidates array
 * @param {Array} candidates - Array of image candidates with different resolutions
 * @returns {string} - URL of highest resolution image
 */
export function getBestImageUrl(candidates: IgImageCandidate[] | null | undefined): string | null {
  if (!candidates || !candidates.length) {
    return null;
  }

  // Sort candidates by resolution (width * height), highest first
  const sortedCandidates = [...candidates].sort((a, b) => {
    const resA = a.width * a.height;
    const resB = b.width * b.height;
    return resB - resA; // Descending order
  });

  // Return the URL of the highest resolution image
  return sortedCandidates[0].url;
}

export function igNamePart(value: unknown, fallback?: string): string {
  return (
    String(value || fallback || "unknown")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_{2,}/g, "_") || String(fallback || "unknown")
  );
}

export function getIgPostCodeFromJson(datajson: IgMediaInfoResponse | null | undefined): string | number | undefined {
  try {
    var item = datajson && datajson.items && datajson.items[0];
    return (item && (item.code || item.id || item.pk)) as string | number | undefined;
  } catch (e) {}
  return "post";
}

export function buildIgFileBase(username: unknown, postCode: unknown, order: number | undefined, type?: string): string {
  return [
    "ig",
    igNamePart(username, "unknown_channel"),
    igNamePart(postCode, "post"),
    String(order || 1).padStart(3, "0"),
    type || "media",
  ].join("_");
}

// Tìm URL video sâu trong object media (phòng khi IG đổi cấu trúc video_versions)
export function findVideoUrlDeep(obj: unknown): string | null {
  var found: string | null = null;
  var seen: object[] = [];
  function walk(o: unknown): void {
    if (found || !o || typeof o !== "object") return;
    if (seen.indexOf(o) !== -1) return;
    seen.push(o);
    const rec = o as Record<string, unknown>;
    const vv = rec.video_versions as IgVideoVersion[] | undefined;
    if (Array.isArray(vv) && vv[0] && vv[0].url) {
      found = vv[0].url;
      return;
    }
    for (var k in rec) {
      var v = rec[k];
      if (typeof v === "string") {
        var _mm = v.match(/https?:\/\/[^\s"\'<>\\]+?\.mp4[^\s"\'<>\\]*/i);
        if (_mm) {
          found = _mm[0];
          return;
        }
      } else if (v && typeof v === "object") {
        walk(v);
        if (found) return;
      }
    }
  }
  try {
    walk(obj);
  } catch (e) {}
  return found;
}
/**
 * Fetch story media by user ID
 * @param {string} id - User ID
 */
export function getstorybyid(id: string): void {
  // Get CSRF token for API requests
  const token = document.documentElement.outerHTML.match(
    /csrf_token":".*?(?=")/g,
  );
  const csrfToken = token && token[0] ? token[0].split('"')[2] : "";

  fetch("https://i.instagram.com/api/v1/feed/user/" + id + "/story/", {
    method: "GET",
    headers: {
      "x-instagram-ajax": "1016349901",
      "x-asbd-id": "129477",
      "x-ig-app-id": "936619743392459",
      "x-requested-with": "XMLHttpRequest",
      "x-csrftoken": csrfToken,
    },
    credentials: "include",
  })
    .then((response) => response.json())
    .then((json: IgStoryResponse) => {
      if (json.reel && json.reel.items && json.reel.items.length > 0) {
        const mediaUrls: string[] = [];

        (json.reel.items as IgMediaItem[]).forEach((item) => {
          let mediaUrl: string | null = null;

          if (item.video_versions && item.video_versions.length > 0) {
            mediaUrl = item.video_versions[0].url;
          } else if (
            item.image_versions2 &&
            item.image_versions2.candidates.length > 0
          ) {
            mediaUrl = getBestImageUrl(item.image_versions2.candidates);
          }

          if (mediaUrl) {
            mediaUrls.push(mediaUrl);
          }
        });

        // Find story username or use a default
        let storyUsername = "";
        try {
          storyUsername = (json.reel.user as { username?: string }).username || id;
        } catch (e) {
          storyUsername = id;
        }

        // Get the story index from state.countclick or default to 0
        let storyIndex = typeof state.countclick !== "undefined" ? state.countclick : 0;
        if (storyIndex >= mediaUrls.length) {
          storyIndex = 0;
        }

        // Send download message to background script
        if (mediaUrls.length > 0) {
          chrome.runtime.sendMessage(
            {
              downloadv1: mediaUrls[storyIndex],
              idx: storyUsername,
              url: location.href,
              platform: "ig",
              channel: storyUsername,
              postId: "story",
              order: storyIndex + 1,
              mediaType:
                mediaUrls[storyIndex].indexOf(".mp4") !== -1
                  ? "video"
                  : "image",
              filename: buildIgFileBase(
                storyUsername,
                "story",
                storyIndex + 1,
                mediaUrls[storyIndex].indexOf(".mp4") !== -1
                  ? "video"
                  : "image",
              ),
            },
            (response) => {
              console.log("Story download initiated");
            },
          );
        }
      }
    })
    .catch((err) => {
      console.error("Error fetching stories:", err);
    });
}

/**
 * Download media for a post by media ID
 * @param {string} pk - Media ID
 * @param {number} range - Index for carousel media
 */
export function downloadimg(pk: string, range: number | null | undefined): void {
  if (state.mediaCache[pk]) {
    downloadsend(
      state.mediaCache[pk].results,
      range,
      state.mediaCache[pk].user,
      state.mediaCache[pk].json,
    );
    return;
  }

  // Get CSRF token for API requests
  const token = document.documentElement.outerHTML.match(
    /csrf_token":".*?(?=")/g,
  );
  const csrfToken = token && token[0] ? token[0].split('"')[2] : "";

  fetch("https://www.instagram.com/api/v1/media/" + pk + "/info/", {
    method: "GET",
    headers: {
      "x-instagram-ajax": "1016349901",
      "x-asbd-id": "129477",
      "x-ig-app-id": "936619743392459",
      "x-requested-with": "XMLHttpRequest",
      "x-csrftoken": csrfToken,
    },
    credentials: "include",
  })
    .then((response) => response.json())
    .then((json: IgMediaInfoResponse) => {
      const results: MediaInfo[] = [];
      let username = "";

      // Helper function to extract media info
      function extractMedia(media: IgMediaItem): MediaInfo {
        const mediaInfo: MediaInfo = {
          pk: media.pk,
          code: media.code,
          urls: [],
        };

        // Add video URL if available (deep-search neu IG doi cau truc)
        var _vurl =
          media.video_versions && media.video_versions.length > 0
            ? media.video_versions[0].url
            : findVideoUrlDeep(media);
        if (_vurl) {
          mediaInfo.urls.push(_vurl as string);
        }

        // Add image URL if available
        if (
          media.image_versions2 &&
          media.image_versions2.candidates.length > 0
        ) {
          mediaInfo.urls.push(
            getBestImageUrl(media.image_versions2.candidates) as string,
          );
        }

        return mediaInfo;
      }

      // Process each item in the response
      if (json.items && json.items.length > 0) {
        (json.items as IgMediaItem[]).forEach((item) => {
          try {
            username = (item.user as { username: string }).username;
          } catch (e) {
            // Username not available
          }

          // Process carousel media if available
          if (item.carousel_media && item.carousel_media.length > 0) {
            item.carousel_media.forEach((media: IgMediaItem) => {
              const mediaData = extractMedia(media);
              results.push(mediaData);
            });
          } else {
            // Process single media
            const mediaData = extractMedia(item);
            results.push(mediaData);
          }
        });
      }

      // Cache the results
      state.mediaCache[pk] = {
        results: results,
        user: username,
        json: json,
      };

      // Send the results for download
      downloadsend(results, range, username, json);
    })
    .catch((err) => {
      console.error("Error fetching media info:", err);
    });
}

