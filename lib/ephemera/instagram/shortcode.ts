import type { DlButton } from './types';
import { igNamePart } from './story-fetch';
import { state } from './state';

/**
 * Extract post ID from shortcode
 * @param {string} code - Instagram post shortcode
 * @returns {string} - Post ID (pk)
 */
export function codetopk(code: string): string | null {
  if (state.postIdCache[code]) {
    return state.postIdCache[code];
  }

  try {
    const paths = ["p", "reel", "reels", "tv"];
    for (var p = 0; p < paths.length; p++) {
      const xmlHttp = new XMLHttpRequest();
      xmlHttp.open(
        "GET",
        "https://www.instagram.com/" + paths[p] + "/" + code + "/",
        false,
      ); // Synchronous for simplicity
      xmlHttp.send(null);
      const match =
        xmlHttp.responseText.match(/media\?id=.*?(?=")/g) ||
        xmlHttp.responseText.match(/"media_id":"?(\d+)/) ||
        xmlHttp.responseText.match(/"pk":"?(\d+)/);
      if (match && match.length > 0) {
        const pk =
          match[0].indexOf("=") !== -1 ? match[0].split("=")[1] : match[1];
        if (pk) {
          state.postIdCache[code] = pk;
          return pk;
        }
      }
    }
  } catch (error) {
    console.error("Error converting code to pk:", error);
  }
  return null;
}

export function parseIgShortcodeFromHref(href: string | null | undefined): string {
  if (!href) return "";
  try {
    var u = new URL(href, location.origin);
    var m = u.pathname.match(/^\/(?:p|reel|reels|tv)\/([^\/?#]+)/);
    if (m && m[1] && m[1] !== "audio") return m[1];
  } catch (e) {}
  var raw = String(href);
  var rm =
    raw.match(/instagram\.com\/(?:p|reel|reels|tv)\/([^\/?#]+)/) ||
    raw.match(/^\/(?:p|reel|reels|tv)\/([^\/?#]+)/);
  return rm && rm[1] && rm[1] !== "audio" ? rm[1] : "";
}

export function findIgShortcodeInRoot(root: ParentNode | null | undefined): string {
  if (!root || !root.querySelectorAll) return "";
  var links = root.querySelectorAll<HTMLElement>(
    'a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]',
  );
  for (var i = 0; i < links.length; i++) {
    var code = parseIgShortcodeFromHref(
      (links[i] as HTMLAnchorElement).href || links[i].getAttribute("href"),
    );
    if (code) return code;
  }
  return "";
}

export function getIgChannelNear(btn: DlButton | null | undefined): string {
  try {
    var root =
      (btn &&
        btn.closest &&
        (btn.closest("article") || btn.closest('div[role="dialog"]'))) ||
      document;
    var links = root.querySelectorAll<HTMLElement>(
      'header a[href^="/"], a[role="link"][href^="/"]',
    );
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href") || "";
      var text = (links[i].innerText || links[i].textContent || "").trim();
      if (!text || text.length > 60) continue;
      if (/^\/(?:p|reel|reels|tv|stories|explore)\//.test(href)) continue;
      return igNamePart(text, "unknown_channel");
    }
  } catch (e) {}
  return "unknown_channel";
}

export function getVisibleIgVideoNearButton(btn: DlButton | null | undefined): HTMLVideoElement | null {
  try {
    if (btn && btn.__ephVideoElement) return btn.__ephVideoElement;
    var root =
      (btn &&
        btn.closest &&
        (btn.closest("article") || btn.closest('div[role="dialog"]'))) ||
      document;
    var best = null;
    var bestArea = 0;
    var videos = root.querySelectorAll("video");
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (
        v.offsetParent === null ||
        v.offsetHeight < 120 ||
        v.offsetWidth < 120
      )
        continue;
      var rect = v.getBoundingClientRect();
      if (
        rect.bottom <= 0 ||
        rect.top >= innerHeight ||
        rect.right <= 0 ||
        rect.left >= innerWidth
      )
        continue;
      var area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        best = v;
      }
    }
    return best;
  } catch (e) {
    return null;
  }
}

export function parseIgCarouselIndexValue(value: unknown): number | null {
  if (value == null) return null;
  var s = String(value);
  var m =
    s.match(/[?&]img_index=(\d+)/) ||
    s.match(
      /(?:img_index|data-img-index|carousel[-_ ]?index|slide)["'=: ]+(\d+)/i,
    ) ||
    s.match(/(?:slide|ảnh|photo|video)\s+(\d+)\s+(?:of|\/|trên)/i);
  if (!m || !m[1]) return null;
  var n = parseInt(m[1], 10);
  return isNaN(n) || n <= 0 ? null : n - 1;
}

export function getIgCarouselIndexNearButton(btn: DlButton | null | undefined, activeVideo?: Element | null): number | null {
  try {
    var attrSource = activeVideo || (btn && btn.__ephVideoElement) || btn;
    var cur = attrSource;
    for (var depth = 0; cur && depth < 10; depth++, cur = cur.parentElement) {
      if (!cur.getAttribute) continue;
      var attrs = [
        cur.getAttribute("img_index"),
        cur.getAttribute("data-img-index"),
        cur.getAttribute("data-carousel-index"),
        cur.getAttribute("data-index"),
        cur.getAttribute("aria-label"),
        cur.getAttribute("href"),
      ];
      for (var a = 0; a < attrs.length; a++) {
        var parsed = parseIgCarouselIndexValue(attrs[a]);
        if (parsed !== null) return parsed;
      }
      var link =
        cur.querySelector && cur.querySelector<HTMLElement>('a[href*="img_index="]');
      parsed = link
        ? parseIgCarouselIndexValue((link as HTMLAnchorElement).href || link.getAttribute("href"))
        : null;
      if (parsed !== null) return parsed;
    }

    var locParsed = parseIgCarouselIndexValue(location.href);
    if (locParsed !== null) return locParsed;

    var root =
      (btn &&
        btn.closest &&
        (btn.closest('div[role="dialog"]') || btn.closest("article"))) ||
      document;
    var slideButtons = root.querySelectorAll<HTMLElement>(
      '[aria-label*="slide" i], [aria-label*="ảnh" i], [aria-label*="photo" i]',
    );
    for (var i = 0; i < slideButtons.length; i++) {
      var b = slideButtons[i];
      var selected =
        b.getAttribute("aria-selected") === "true" ||
        b.getAttribute("aria-current") === "true";
      if (!selected) continue;
      var fromLabel = parseIgCarouselIndexValue(
        b.getAttribute("aria-label") || b.textContent || "",
      );
      if (fromLabel !== null) return fromLabel;
      return i;
    }

    var oldDots =
      root.getElementsByClassName &&
      root.getElementsByClassName(" _acvz _acnc _acng")[0];
    var dotDivs = oldDots ? oldDots.getElementsByTagName("div") : [];
    for (var d = 0; d < dotDivs.length; d++) {
      if (dotDivs[d].classList.length === 2) return d;
    }

    if (btn && btn.getAttribute) {
      var stored = btn.getAttribute("data-ig-carousel-index");
      if (stored !== null && stored !== "") {
        var storedIndex = parseInt(stored, 10);
        if (!isNaN(storedIndex)) return storedIndex;
      }
    }
  } catch (e) {}
  return null;
}

// Lấy shortcode bài gần nút
export function getShortcodeNear(btn: DlButton | null | undefined): string {
  try {
    if (btn && btn.getAttribute) {
      var stored = btn.getAttribute("data-ig-shortcode");
      if (stored) return stored;
    }
    var dialog = btn && btn.closest && btn.closest('div[role="dialog"]');
    var article = btn && btn.closest && btn.closest("article");
    var root = dialog || article || document;
    var code = findIgShortcodeInRoot(root);
    if (code) return code;
    if (article && dialog) {
      code = findIgShortcodeInRoot(article);
      if (code) return code;
    }
  } catch (e) {}
  return parseIgShortcodeFromHref(location.href);
}

export function isIgDirectVideoUrl(url: unknown): boolean {
  if (!url || /^blob:/i.test(url as string)) return false;
  const normalized = String(url)
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&");
  return (
    /\.(?:mp4|m4v)(?:[?#]|$)/i.test(normalized) || /video\.[^\/]+fbcdn\.net/i.test(normalized)
  );
}

export function normalizeIgVideoUrl(url: string): string {
  if (!url) return "";
  return String(url)
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/\\\//g, "/");
}

export function getDirectIgVideoUrlFromElement(video: HTMLVideoElement): string {
  try {
    var candidates: Array<string | null> = [video.currentSrc, video.src, video.getAttribute("src")];
    var sources = video.querySelectorAll
      ? video.querySelectorAll<HTMLElement>("source[src]")
      : [];
    for (var s = 0; s < sources.length; s++)
      candidates.push((sources[s] as HTMLSourceElement).src || sources[s].getAttribute("src"));
    for (var i = 0; i < candidates.length; i++) {
      var url = normalizeIgVideoUrl(candidates[i] as string);
      if (isIgDirectVideoUrl(url)) return url;
    }
  } catch (e) {}
  return "";
}

export function harvestIgVideoUrlsFromPerformance(): string[] {
  var urls: string[] = [];
  try {
    (performance.getEntriesByType("resource") || []).forEach(function (entry: PerformanceEntry) {
      var url = normalizeIgVideoUrl(entry && (entry.name as string));
      if (isIgDirectVideoUrl(url) && urls.indexOf(url) === -1) urls.push(url);
    });
  } catch (e) {}
  return urls;
}

export function getDirectIgVideoUrlNearButton(btn: DlButton): string {
  try {
    var activeVideo = getVisibleIgVideoNearButton(btn);
    var direct = activeVideo ? getDirectIgVideoUrlFromElement(activeVideo) : "";
    if (direct) return direct;

    var visibleVideos = Array.from(document.querySelectorAll("video")).filter(
      function (video) {
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
          rect.top < innerHeight &&
          rect.right > 0 &&
          rect.left < innerWidth
        );
      },
    );
    var resourceUrls = harvestIgVideoUrlsFromPerformance();
    if (
      resourceUrls.length &&
      (location.pathname.indexOf("/reel/") !== -1 ||
        location.pathname.indexOf("/reels/") !== -1 ||
        visibleVideos.length <= 1)
    ) {
      return resourceUrls[resourceUrls.length - 1];
    }
  } catch (e) {}
  return "";
}

