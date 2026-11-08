import type {
  IgImageCandidate,
  IgProfileInfoResponse,
  IgReel,
  IgReelsMediaResponse,
  IgStoryItem,
  IgUserStoryResponse,
  LegacyStoryPayload,
  NavigatorWithUAData,
} from "../lib/ephemera/standalone/types";

export default defineUnlistedScript(() => {
function ephIsWindowsClient() {
  try {
    var uaPlatform =
      (navigator as NavigatorWithUAData).userAgentData &&
      (navigator as NavigatorWithUAData).userAgentData?.platform;
    return /win/i.test(
      [uaPlatform, navigator.platform, navigator.userAgent].join(" "),
    );
  } catch (e) {
    return false;
  }
}

function ephIgNamePart(value?: unknown, fallback?: unknown) {
  return (
    String(value || fallback || "unknown")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_{2,}/g, "_") || String(fallback || "unknown")
  );
}

function ephBestImageUrl(candidates?: IgImageCandidate[] | null) {
  if (!candidates || !candidates.length) return "";
  return (
    candidates.slice().sort(function (a: IgImageCandidate, b: IgImageCandidate) {
      return (
        (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0)
      );
    })[0].url || ""
  );
}

function ephCurrentStoryId() {
  var match = location.pathname.match(/\/stories\/[^\/?#]+\/([^\/?#]+)/);
  return match && match[1] ? match[1] : "";
}

function ephCurrentStoryUsername() {
  var match = location.pathname.match(/\/stories\/([^\/?#]+)/);
  return match && match[1] ? decodeURIComponent(match[1]) : "";
}

function ephCurrentHighlightId() {
  var match = location.pathname.match(/\/stories\/highlights\/([^\/?#]+)/);
  return match && match[1] ? decodeURIComponent(match[1]) : "";
}

function ephStoryFilename(username?: unknown, order?: number, type?: string) {
  return [
    "ig",
    ephIgNamePart(username, "unknown_channel"),
    "story",
    String(order || 1).padStart(3, "0"),
    type || "media",
  ].join("_");
}

function ephNormalizeIgMediaUrl(url?: unknown): string {
  return String(url || "")
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/\\\//g, "/")
    .trim();
}

function ephNormalizeIgVideoDownloadUrl(urlInput?: unknown): string {
  var url = ephNormalizeIgMediaUrl(urlInput);
  if (!url) return "";
  try {
    var parsed = new URL(url);
    ["bytestart", "byteend", "range"].forEach(function (key) {
      parsed.searchParams.delete(key);
    });
    return parsed.toString();
  } catch (e) {
    return url
      .replace(/([?&])(?:bytestart|byteend|range)=[^&]+/gi, "$1")
      .replace(/[?&]+$/, "");
  }
}

function ephIsBadIgVideoPart(urlInput?: unknown): boolean {
  var url = ephNormalizeIgMediaUrl(urlInput);
  try {
    var parsed = new URL(url);
    var path = decodeURIComponent(parsed.pathname || "");
    var tag = parsed.searchParams.get("tag") || "";
    // efg là base64 chứa metadata luồng; luồng tiếng (audio-only) có chữ "audio" trong đó
    var efg = parsed.searchParams.get("efg") || "";
    if (efg) {
      try {
        var decoded = atob(efg.replace(/-/g, "+").replace(/_/g, "/"));
        if (/audio/i.test(decoded)) return true;
      } catch (e) {}
    }
    return /dashinit|init\.mp4|(?:^|[_\/.-])audio(?:[_\/.-]|$)|audio_dashinit|_audio_/i.test(
      path + " " + tag,
    );
  } catch (e) {
    return /dashinit|init\.mp4|(?:^|[_\/.-])audio(?:[_\/.-]|$)|audio_dashinit|_audio_/i.test(
      url,
    );
  }
}

function ephIsDirectIgVideoUrl(urlInput?: unknown): boolean {
  var url = ephNormalizeIgVideoDownloadUrl(urlInput);
  return (
    !!url &&
    !/^blob:/i.test(url) &&
    !ephIsBadIgVideoPart(url) &&
    (/\.(?:mp4|m4v)(?:[?#]|$)/i.test(url) ||
      /video\.[^\/]+fbcdn\.net/i.test(url))
  );
}

function ephVisibleRect(el: HTMLElement | null) {
  if (!el || el.offsetParent === null) return null;
  var rect = el.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 80) return null;
  if (
    rect.bottom <= 0 ||
    rect.top >= innerHeight ||
    rect.right <= 0 ||
    rect.left >= innerWidth
  )
    return null;
  return rect;
}

function ephVisibleArea(el: HTMLElement | null) {
  var rect = ephVisibleRect(el);
  if (!rect) return 0;
  return rect.width * rect.height;
}

function ephBestVisibleImageUrl() {
  var best: HTMLImageElement | null = null;
  var bestArea = 0;
  var images = document.querySelectorAll<HTMLImageElement>("img");
  for (var i = 0; i < images.length; i++) {
    var image = images[i];
    var area = ephVisibleArea(image);
    if (area < bestArea || area < 30000) continue;
    var src = image.currentSrc || image.src || "";
    var srcset = image.srcset || "";
    if (!/cdninstagram\.com|fbcdn\.net/i.test(src + " " + srcset)) continue;
    best = image;
    bestArea = area;
  }
  if (!best) return "";
  if (best.srcset) {
    var parts = best.srcset
      .split(",")
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);
    if (parts.length)
      return ephNormalizeIgMediaUrl(parts[parts.length - 1].split(/\s+/)[0]);
  }
  return ephNormalizeIgMediaUrl(best.currentSrc || best.src || "");
}

function ephBestVisibleVideoUrl() {
  var videos = document.querySelectorAll<HTMLVideoElement>("video");
  var bestVideo: HTMLVideoElement | null = null;
  var bestArea = 0;
  for (var i = 0; i < videos.length; i++) {
    var area = ephVisibleArea(videos[i]);
    if (area > bestArea) {
      bestVideo = videos[i];
      bestArea = area;
    }
  }
  if (bestVideo) {
    var candidates: (string | null | undefined)[] = [
      bestVideo.currentSrc,
      bestVideo.src,
      bestVideo.getAttribute("src"),
    ];
    var sources = bestVideo.querySelectorAll
      ? bestVideo.querySelectorAll<HTMLSourceElement>("source[src]")
      : ([] as HTMLSourceElement[]);
    for (var s = 0; s < sources.length; s++)
      candidates.push(sources[s].src || sources[s].getAttribute("src"));
    for (var c = 0; c < candidates.length; c++) {
      var candidate = ephNormalizeIgVideoDownloadUrl(candidates[c]);
      if (ephIsDirectIgVideoUrl(candidate)) return candidate;
    }
  }
  try {
    var entries = performance.getEntriesByType("resource") || [];
    for (var p = entries.length - 1; p >= 0; p--) {
      var url = ephNormalizeIgVideoDownloadUrl(
        entries[p] && entries[p].name,
      );
      if (ephIsDirectIgVideoUrl(url)) return url;
    }
  } catch (e) {}
  return "";
}

function ephSendStoryDownload(
  mediaUrlInput?: unknown,
  usernameInput?: string,
  order?: number,
  mediaTypeInput?: string,
) {
  var mediaUrl = ephNormalizeIgMediaUrl(mediaUrlInput);
  if (!mediaUrl || /^blob:/i.test(mediaUrl)) return false;
  var username = usernameInput || ephCurrentStoryUsername() || "instagram_story";
  var mediaType =
    mediaTypeInput || (ephIsDirectIgVideoUrl(mediaUrl) ? "video" : "image");
  if (mediaType === "video")
    mediaUrl = ephNormalizeIgVideoDownloadUrl(mediaUrl);
  chrome.runtime.sendMessage(
    {
      downloadv1: mediaUrl,
      idx: username,
      url: location.href,
      platform: "ig",
      channel: username,
      postId: "story",
      order: order || 1,
      mediaType: mediaType,
      filename: ephStoryFilename(username, order || 1, mediaType),
    },
    function () {},
  );
  return true;
}

function ephTryVisibleStoryDownload() {
  var username = ephCurrentStoryUsername();
  if (username === "highlights") username = "highlight";
  var videoUrl = ephBestVisibleVideoUrl();
  if (videoUrl && ephSendStoryDownload(videoUrl, username, 1, "video"))
    return true;
  var imageUrl = ephBestVisibleImageUrl();
  if (imageUrl && ephSendStoryDownload(imageUrl, username, 1, "image"))
    return true;
  return false;
}

function ephPickStoryMediaItem(items?: IgStoryItem[] | null): IgStoryItem | null {
  if (!items || !items.length) return null;
  var storyId = ephCurrentStoryId();
  if (storyId) {
    for (var i = 0; i < items.length; i++) {
      var id = String(items[i].id || items[i].pk || "");
      if (id === storyId || id.indexOf(storyId + "_") === 0) return items[i];
    }
  }
  var visibleImage = ephBestVisibleImageUrl();
  if (visibleImage) {
    var visibleName = visibleImage.split("?")[0].split("/").pop();
    for (var m = 0; m < items.length; m++) {
      var candidates =
        (items[m].image_versions2 && items[m].image_versions2?.candidates) || [];
      for (var c = 0; c < candidates.length; c++) {
        var candidateName = String(candidates[c].url || "")
          .split("?")[0]
          .split("/")
          .pop();
        if (candidateName && candidateName === visibleName) return items[m];
      }
    }
  }
  return items[0];
}

function ephDownloadStoryItem(item: IgStoryItem | null, username?: string, order?: number) {
  if (!item) return false;
  var mediaUrl = "";
  var mediaType = "image";
  if (item.video_versions && item.video_versions.length > 0) {
    mediaUrl = item.video_versions[0].url;
    mediaType = "video";
  } else if (item.image_versions2 && item.image_versions2.candidates) {
    mediaUrl = ephBestImageUrl(item.image_versions2.candidates);
  }
  return ephSendStoryDownload(mediaUrl, username, order || 1, mediaType);
}

function ephDownloadWindowsHighlight(highlightId?: string, csrfToken?: string) {
  if (!highlightId) return false;
  var params = new URLSearchParams({ reel_ids: "highlight:" + highlightId });
  fetch(
    "https://i.instagram.com/api/v1/feed/reels_media/?" + params.toString(),
    {
      method: "GET",
      headers: {
        "x-instagram-ajax": "1016349901",
        "x-asbd-id": "129477",
        "x-ig-app-id": "936619743392459",
        "x-requested-with": "XMLHttpRequest",
        "x-csrftoken": csrfToken || "",
      },
      credentials: "include",
    },
  )
    .then(function (response: Response): Promise<IgReelsMediaResponse> {
      return response.json();
    })
    .then(function (json) {
      var reel: IgReel | undefined =
        json &&
        json.reels &&
        (json.reels["highlight:" + highlightId] || json.reels[highlightId]);
      if (!reel && json && json.reels_media && json.reels_media[0])
        reel = json.reels_media[0];
      var items = reel && reel.items ? reel.items : [];
      if (!items.length) throw new Error("No highlight items found");
      var item = ephPickStoryMediaItem(items);
      var order = Math.max(1, items.indexOf(item as IgStoryItem) + 1);
      var username =
        (reel?.user && reel.user.username) || "highlight_" + highlightId;
      if (!ephDownloadStoryItem(item, username, order))
        throw new Error("No highlight media url");
    })
    .catch(function (error) {
      console.error("[Ephemera] Windows highlight download failed:", error);
      if (!ephTryVisibleStoryDownload())
        chrome.runtime.sendMessage(null, { noStories: true });
    });
  return true;
}

function ephHasVisibleStoryVideo() {
  var videos = document.querySelectorAll("video");
  for (var i = 0; i < videos.length; i++) {
    if (ephVisibleArea(videos[i]) > 0) return true;
  }
  return false;
}

function ephDownloadWindowsStory() {
  var username = ephCurrentStoryUsername();
  if (!username) return false;

  var token = document.documentElement.outerHTML.match(
    /csrf_token":".*?(?=")/g,
  );
  var csrfToken = token && token[0] ? token[0].split('"')[2] : "";
  var highlightId = ephCurrentHighlightId();
  if (highlightId && ephDownloadWindowsHighlight(highlightId, csrfToken))
    return true;

  // 1) Video story: ưu tiên URL từ react props (instagram-video.js đặt vào ephVideoUrl).
  //    Đây là mp4 progressive gộp CẢ HÌNH + TIẾNG. Quét performance entries dễ vớ
  //    phải segment DASH audio-only -> file tải về chỉ có tiếng không có hình.
  var ssUrl = "";
  try {
    ssUrl = document.head.getAttribute("ephVideoUrl") || "";
  } catch (e) {}
  try {
    document.head.removeAttribute("ephVideoUrl");
  } catch (e) {}
  if (ssUrl && ssUrl !== "null") {
    var normalizedSs = ephNormalizeIgVideoDownloadUrl(ssUrl);
    if (
      ephIsDirectIgVideoUrl(normalizedSs) &&
      ephSendStoryDownload(normalizedSs, username, 1, "video")
    )
      return true;
  }

  // 2) Story ảnh (không có video hiển thị): tải thẳng ảnh đang xem từ DOM
  if (!ephHasVisibleStoryVideo()) {
    var imageUrl = ephBestVisibleImageUrl();
    if (imageUrl && ephSendStoryDownload(imageUrl, username, 1, "image"))
      return true;
  }

  if (username === "highlights") return false;

  // 3) Đường API: video_versions[0].url cũng là mp4 đầy đủ hình + tiếng
  fetch(
    "https://i.instagram.com/api/v1/users/web_profile_info/?username=" +
      encodeURIComponent(username),
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
    .then(function (response: Response): Promise<IgProfileInfoResponse> {
      return response.json();
    })
    .then(function (profileJson) {
      var userId =
        profileJson &&
        profileJson.data &&
        profileJson.data.user &&
        profileJson.data.user.id;
      if (!userId) throw new Error("Cannot find Instagram user id");

      return fetch(
        "https://i.instagram.com/api/v1/feed/user/" + userId + "/story/",
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
      );
    })
    .then(function (response: Response): Promise<IgUserStoryResponse> {
      return response.json();
    })
    .then(function (storyJson) {
      var items =
        storyJson && storyJson.reel && storyJson.reel.items
          ? storyJson.reel.items
          : [];
      if (!items.length) throw new Error("No stories found");

      var item = ephPickStoryMediaItem(items);
      var order = Math.max(1, items.indexOf(item as IgStoryItem) + 1);

      if (!ephDownloadStoryItem(item, username, order))
        throw new Error("No story media url");
    })
    .catch(function (error) {
      console.error("[Ephemera] Windows story download failed:", error);
      if (!ephTryVisibleStoryDownload())
        chrome.runtime.sendMessage(null, { noStories: true });
    });
  return true;
}

// Username for the legacy (non-Windows) path. Old code used a[1].innerText, which is the
// "Home" nav link -> files were named media_unknown_HomeHome_001_video.mp4.
function ephLegacyStoryUsername() {
  var name = ephCurrentStoryUsername();
  if (name === "highlights") {
    // highlights URL has no username: take it from the story header link (/<user>/)
    var links = document.querySelectorAll('header a[href^="/"], a[href^="/"][role="link"]');
    for (var i = 0; i < links.length; i++) {
      var m = (links[i].getAttribute("href") || "").match(/^\/([\w.]+)\/?$/);
      if (m && !/^(explore|reels|direct|stories|accounts)$/.test(m[1])) {
        name = m[1];
        break;
      }
    }
    if (name === "highlights") name = "highlight";
  }
  return name || "instagram_story";
}

function ephLegacyPayload(
  url: string | null | undefined,
  username: string,
  mediaType: string,
): LegacyStoryPayload {
  return {
    downloadv1: url,
    idx: username,
    url: location.href,
    platform: "ig",
    channel: username,
    postId: "story",
    order: 1,
    mediaType: mediaType,
    filename: ephStoryFilename(username, 1, mediaType),
  };
}

if (!(
  ephIsWindowsClient() &&
  location.pathname.includes("stories") &&
  ephDownloadWindowsStory()
)) {
  let storyImg: HTMLImageElement | null = null;
  var pauseBtn =
    document.querySelector("svg[aria-label='Pause']") ||
    document.querySelector("svg[width='16']") ||
    (top as Window).location.toString().indexOf("stories") != -1;
  if (pauseBtn) {
    var haveImgStory = false;
    var imgs = document.querySelectorAll<HTMLImageElement>("img");
    for (let img of imgs) {
      if (
        img.nextSibling &&
        getComputedStyle(img.nextSibling as Element).overflow === "hidden"
      ) {
        storyImg = img;
        haveImgStory = true;
        break;
      }
    }

    var videos = document.querySelectorAll<HTMLVideoElement>("video");
    var video: HTMLVideoElement | null = null;
    for (let i = 0; i < videos.length; i++) {
      if (videos[i].offsetHeight !== 0) video = videos[i];
    }
    var haveVideoStory = video != null;
    if (haveImgStory || haveVideoStory) {
      if (haveVideoStory) {
        let username = ephLegacyStoryUsername();
        let videoURL: string | null | undefined = document.head.getAttribute("ephVideoUrl");
        if (videoURL == "null") {
          videoURL = (video?.children[0] as HTMLSourceElement | undefined)?.src;
        }
        if ((videoURL == null || videoURL == "null") && haveImgStory) {
          savePhotoStory();
        } else {
          chrome.runtime.sendMessage(
            ephLegacyPayload(videoURL, username, "video"),
            () => {
              console.log("dow:");
            },
          );
        }
        document.head.removeAttribute("ephVideoUrl");
      } else {
        savePhotoStory();
      }
    }
  } else {
    chrome.runtime.sendMessage(null, { noStories: true });
  }
  function savePhotoStory() {
    let storyUrl = (storyImg as HTMLImageElement).srcset.split(",")[0].split(" ")[0];
    let username = ephLegacyStoryUsername();
    if (storyUrl.length == 0) {
      chrome.runtime.sendMessage(null, { noStories: true });
    } else {
      chrome.runtime.sendMessage(
        ephLegacyPayload(storyUrl, username, "image"),
        (response) => {
          console.log("dow:");
        },
      );
    }
  }
}

});
