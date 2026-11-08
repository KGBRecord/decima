import type { EphButton, FbNode } from './types';
import { resolveFbButtonVideo } from './url-harvest';

export function decodeFbVideoUrl(raw: string) {
  if (!raw) return null;
  try {
    return raw
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&")
      .replace(/\\u0025/g, "%")
      .replace(/\\u0026/g, "&")
      .replace(/\\u003D/gi, "=")
      .replace(/\\u003F/gi, "?")
      .replace(/\\u002F/gi, "/");
  } catch (e) {
    return raw;
  }
}

export function parseFbVideoIdFromHref(href: string) {
  if (!href) return "";
  try {
    var u = new URL(href, location.origin);
    var v = u.searchParams.get("v") || u.searchParams.get("video_id");
    if (v && isNumericString(v)) return v;
    var pcb = u.pathname.match(/\/videos\/pcb\.[0-9]+\/([0-9]+)/);
    if (pcb && pcb[1]) return pcb[1];
    var m = u.pathname.match(/\/(?:reel|videos|watch)\/([0-9]+)/);
    if (m && m[1]) return m[1];
    m = u.pathname.match(/\/[^\/]+\/videos\/[^\/]+\/([0-9]+)/);
    if (m && m[1]) return m[1];
    m = u.pathname.match(/\/[^\/]+\/videos\/([0-9]+)/);
    if (m && m[1]) return m[1];
  } catch (e) {}
  var raw = String(href);
  var match =
    raw.match(/[?&](?:v|video_id)=([0-9]+)/) ||
    raw.match(/\/videos\/pcb\.[0-9]+\/([0-9]+)/) ||
    raw.match(/\/(?:reel|videos|watch)\/([0-9]+)/) ||
    raw.match(/\/[^\/]+\/videos\/[^\/]+\/([0-9]+)/) ||
    raw.match(/\/[^\/]+\/videos\/([0-9]+)/);
  return match ? match[1] : "";
}

export function isValidFbVideoId(id: string) {
  return /^[0-9]{5,}$/.test(String(id || ""));
}

export function getFbVideoIdFromLocation() {
  return parseFbVideoIdFromHref(location.href);
}

export function parseFbVideoIdFromText(text: string) {
  text = String(text || "");
  var match =
    text.match(/\/videos\/pcb\.[0-9]+\/([0-9]+)/) ||
    text.match(/\/(?:reel|videos|watch)\/([0-9]+)/) ||
    text.match(/\/[^\/"']+\/videos\/[^\/"']+\/([0-9]+)/) ||
    text.match(/(?:video_id|videoID|videoId)["'\\:= ]+([0-9]{5,})/) ||
    text.match(
      /"id":"([0-9]{5,})"[^<]{0,800}(?:playable_url|browser_native|videoDeliveryResponse|dash_h264)/,
    );
  return match && isValidFbVideoId(match[1]) ? match[1] : "";
}

export function isExactFbVideoPage(videoId: string) {
  var locId = getFbVideoIdFromLocation();
  if (
    !isValidFbVideoId(videoId) ||
    !isValidFbVideoId(locId) ||
    locId !== String(videoId)
  )
    return false;
  return (
    location.pathname.includes("/watch") ||
    location.pathname.includes("/reel/") ||
    location.pathname.includes("/videos/")
  );
}

export function canUseLoadedFbVideoResource(videoId: string, btn: EphButton) {
  if (!isValidFbVideoId(videoId)) return false;
  if (isExactFbVideoPage(videoId)) return true;
  try {
    var videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video")).filter(
      isVisibleFbVideo,
    );
    if (videos.length !== 1) return false;
    var visibleId = getFbVideoIdNearElement(videos[0]);
    if (visibleId && visibleId === String(videoId)) return true;
    var btnVideo = resolveFbButtonVideo(btn);
    return !!(
      btnVideo &&
      btnVideo === videos[0] &&
      getFbVideoIdNearElement(btnVideo) === String(videoId)
    );
  } catch (e) {
    return false;
  }
}

export function isVisibleFbVideo(video: HTMLVideoElement) {
  if (
    !video ||
    video.offsetParent === null ||
    video.offsetHeight < 120 ||
    video.offsetWidth < 120
  )
    return false;
  var rect = video.getBoundingClientRect();
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < innerHeight &&
    rect.left < innerWidth
  );
}

// Tỷ lệ phần video thực sự nằm trong khung nhìn (0..1). Dùng để chỉ gắn/hiện
// nút tải cho video đang xem, tránh gắn cho video preview/recycled ngoài màn hình.

export function getFbVideoVisibleRatio(video: HTMLVideoElement) {
  if (!video || !video.getBoundingClientRect) return 0;
  var rect = video.getBoundingClientRect();
  var area = rect.width * rect.height;
  if (area <= 0) return 0;
  var visibleW = Math.max(
    0,
    Math.min(rect.right, innerWidth) - Math.max(rect.left, 0),
  );
  var visibleH = Math.max(
    0,
    Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
  );
  return (visibleW * visibleH) / area;
}

export function getPrimaryVisibleFbVideo(): HTMLVideoElement | null {
  var best = null as HTMLVideoElement | null;
  var bestArea = 0;
  document.querySelectorAll<HTMLVideoElement>("video").forEach(function (video) {
    if (!isVisibleFbVideo(video)) return;
    var rect = video.getBoundingClientRect();
    var area = rect.width * rect.height;
    if (area > bestArea) {
      bestArea = area;
      best = video;
    }
  });
  return best;
}

export function getFbVideoIdNearElement(el: EphButton) {
  var locId = getFbVideoIdFromLocation();
  if (
    locId &&
    (location.pathname.includes("/watch") ||
      location.pathname.includes("/reel/") ||
      location.pathname.includes("/videos/"))
  ) {
    return isValidFbVideoId(locId) ? locId : "";
  }
  var mediaRect: DOMRect | null = null;
  try {
    mediaRect =
      el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  } catch (e) {}
  var cur: EphButton | null = el;
  for (var depth = 0; cur && depth < 10; depth++, cur = cur.parentElement as EphButton | null) {
    if (cur.getAttribute) {
      var direct =
        cur.getAttribute("data-video-id") || cur.getAttribute("data-ft") || "";
      var dm = String(direct).match(
        /(?:video_id|videoID|videoId)["':=\\ ]+([0-9]{5,})/,
      );
      if (dm && isValidFbVideoId(dm[1])) return dm[1];
      var directId = parseFbVideoIdFromText(direct);
      if (directId) return directId;
      try {
        var mediaCount = cur.querySelectorAll
          ? cur.querySelectorAll<FbNode>("video,img").length
          : 0;
        if (depth <= 3 || mediaCount <= 1) {
          var html = cur.outerHTML ? cur.outerHTML.slice(0, 180000) : "";
          var htmlId = parseFbVideoIdFromText(html);
          if (htmlId) return htmlId;
        }
      } catch (e) {}
    }
    var links = cur.querySelectorAll
      ? cur.querySelectorAll<FbNode>(
          'a[href*="/reel/"], a[href*="/watch"], a[href*="/videos/"]',
        )
      : [];
    var bestLinkId = "";
    var bestLinkScore = Infinity;
    for (var i = 0; i < links.length; i++) {
      var id = parseFbVideoIdFromHref(links[i].href);
      if (!isValidFbVideoId(id)) continue;
      var score = i;
      try {
        if (mediaRect && typeof links[i].getBoundingClientRect === "function") {
          var lr = links[i].getBoundingClientRect();
          score =
            Math.abs(
              lr.left + lr.width / 2 - (mediaRect.left + mediaRect.width / 2),
            ) +
            Math.abs(
              lr.top + lr.height / 2 - (mediaRect.top + mediaRect.height / 2),
            );
        }
      } catch (e) {}
      if (score < bestLinkScore) {
        bestLinkScore = score;
        bestLinkId = id;
      }
    }
    if (bestLinkId) return bestLinkId;
  }
  return isValidFbVideoId(locId) ? locId : "";
}

// Lấy URL video Facebook (.mp4) từ dữ liệu nhúng trong trang theo video_id.
// FB nhúng các trường browser_native_hd_url / playable_url... trong JSON (dấu / được escape thành \/).

export function isFbMediaViewerVideo(video: HTMLVideoElement) {
  try {
    var dialog =
      video &&
      video.closest &&
      (video.closest('div[role="dialog"]') ||
        video.closest('div[aria-modal="true"]'));
    if (!dialog) return false;
    var rect = video.getBoundingClientRect();
    return rect.width > 300 && rect.height > 220;
  } catch (e) {
    return false;
  }
}

export function getFbMediaRoot(el: EphButton): EphButton | null {
  var cur: EphButton | null = el;
  for (var depth = 0; cur && depth < 10; depth++, cur = cur.parentElement as EphButton | null) {
    if (!cur.matches) continue;
    if (cur.matches('div[role="article"], div[role="dialog"]')) return cur;
    if (cur.querySelectorAll) {
      var mediaCount = cur.querySelectorAll<FbNode>("img, video").length;
      if (mediaCount > 1 && cur.getBoundingClientRect) {
        var rect = cur.getBoundingClientRect();
        if (rect.width > 220 && rect.height > 220) return cur;
      }
    }
  }
  return (
    (el &&
      el.closest &&
      (el.closest<EphButton>('div[role="article"]') ||
        el.closest<EphButton>('div[role="dialog"]'))) ||
    (el && (el.parentElement as EphButton | null))
  );
}

export function getBestImageUrl(img: HTMLImageElement) {
  if (!img) return "";
  var best = img.currentSrc || img.src || "";
  try {
    if (img.srcset) {
      img.srcset.split(",").forEach(function (part) {
        var bits = part.trim().split(/\s+/);
        var url = bits[0] || "";
        var size = parseInt((bits[1] || "0").replace(/[^\d]/g, ""), 10) || 0;
        var bestSize =
          parseInt(String((best.match(/(?:_|w=)(\d{3,5})/) || [0, 0])[1]), 10) || 0;
        if (url && size >= bestSize) best = url;
      });
    }
  } catch (e) {}
  return best;
}

export function isUsefulFbMediaUrl(url: string) {
  if (!url || !/^https?:\/\//.test(url)) return false;
  if (url.indexOf("data:image") === 0 || url.indexOf("blob:") === 0)
    return false;
  return /(fbcdn|scontent|fbsbx|facebook\.com)/i.test(url);
}

export function getVisibleFbVideoCountInRoot(root: EphButton | null) {
  var count = 0;
  try {
    (root || document).querySelectorAll<HTMLVideoElement>("video").forEach(function (video) {
      if (isVisibleFbVideo(video)) count++;
    });
  } catch (e) {}
  return count;
}

export function ephSleep(ms: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

export function isFbElementVisible(el: EphButton, minWidth: number, minHeight: number) {
  if (!el || !el.getBoundingClientRect) return false;
  var rect = el.getBoundingClientRect();
  return (
    rect.width >= (minWidth || 1) &&
    rect.height >= (minHeight || 1) &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < innerHeight &&
    rect.left < innerWidth
  );
}

export function isNumericString(str: string) {
  const regex = /^[0-9]+$/;
  return regex.test(str);
}
