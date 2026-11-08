import type { EphButton, FbNode } from './types';
import { state } from './state';
import { hasFbAlbumSignal } from './album';
import { canUseLoadedFbVideoResource, decodeFbVideoUrl, getFbMediaRoot, getFbVideoIdNearElement, getPrimaryVisibleFbVideo, getVisibleFbVideoCountInRoot, isExactFbVideoPage, isUsefulFbMediaUrl, isValidFbVideoId, isVisibleFbVideo, ephSleep } from './dom-helpers';

export function findFbVideoUrlById(videoId: string, scopeElement: Element | null) {
  try {
    var html = document.documentElement.innerHTML;
    var fields = [
      "browser_native_hd_url",
      "playable_url_quality_hd",
      "browser_native_sd_url",
      "playable_url",
    ];
    function grab(scope: string) {
      // LƯU Ý: URL mp4 của Facebook KHÔNG chứa graph video_id và xpv_asset_id
      // cũng KHÁC video_id, nên KHÔNG thể đòi "id nằm trong url". Việc gắn đúng
      // video dựa vào VỊ TRÍ GẦN NHAU trong JSON: node video có "id":"<videoId>"
      // và các trường *_url của nó nằm cạnh nhau. Vì vậy ta lấy url điểm cao nhất
      // (đã ưu tiên HD progressive) trong cửa sổ quanh video_id.
      var extracted = extractFbVideoUrlsFromText(scope, videoId);
      if (extracted.length) return extracted[0];
      for (var f = 0; f < fields.length; f++) {
        var m = scope.match(new RegExp('"' + fields[f] + '":"([^"]+)"'));
        if (m && m[1].indexOf(".mp4") !== -1) {
          var u = normalizeFbVideoDownloadUrl(decodeFbVideoUrl(m[1]) || "");
          if (isFbFullVideoDownloadUrl(u)) return u;
        }
      }
      return null;
    }
    // Quét quanh TỪNG vị trí xuất hiện của video_id trong HTML. Cửa sổ ôm sát node
    // video để hạn chế "lấn" sang url của video khác trong cùng bài (vd pcb.*).
    if (videoId) {
      var needle = '"' + videoId + '"';
      var from = 0,
        idx,
        tries = 0,
        windowFallback = null;
      while ((idx = html.indexOf(needle, from)) !== -1 && tries < 12) {
        tries++;
        from = idx + needle.length;
        // Trong JSON của Facebook, các trường *_url của 1 video nằm NGAY SAU
        // "id":"<videoId>". Ưu tiên cửa sổ phía sau để bắt đúng video này,
        // tránh lấn sang url của video kế tiếp trong cùng bài (pcb.*).
        var afterUrl = grab(html.substring(idx, idx + 26000));
        if (afterUrl && isFbFullVideoDownloadUrl(afterUrl)) return afterUrl;
        var symUrl =
          afterUrl ||
          grab(html.substring(Math.max(0, idx - 15000), idx + 30000));
        if (symUrl) {
          if (isFbFullVideoDownloadUrl(symUrl)) return symUrl;
          if (!windowFallback) windowFallback = symUrl;
        }
      }
      if (windowFallback) return windowFallback;
    }
    // Tìm trong phạm vi DOM của chính video được bấm
    if (scopeElement && scopeElement.outerHTML) {
      var scoped = grab(scopeElement.outerHTML);
      if (scoped) return scoped;
    }
    // Trang chỉ có đúng 1 video hiển thị -> lấy url tốt nhất toàn trang
    var visibleVideos = Array.from(document.querySelectorAll<HTMLVideoElement>("video")).filter(
      isVisibleFbVideo,
    );
    if (!videoId && visibleVideos.length === 1) return grab(html);
    return null;
  } catch (ex) {
    return null;
  }
}

export function getFastFbVideoUrl(btn: EphButton, videoId: string) {
  if (!isValidFbVideoId(videoId)) return "";
  try {
    var cachedBtnUrl =
      btn && btn.getAttribute && btn.getAttribute("data-video-url");
    if (
      cachedBtnUrl &&
      isFbFullVideoDownloadUrl(cachedBtnUrl) &&
      isFbVideoUrlCompatibleWithId(cachedBtnUrl, videoId, false)
    ) {
      return normalizeFbVideoDownloadUrl(cachedBtnUrl);
    }
  } catch (e) {}
  try {
    var video =
      resolveFbButtonVideo(btn) || (btn && btn.__ephVideoElement) || null;
    if (video) {
      var direct = getDirectFbVideoUrlFromElement(
        video,
        videoId || getFbVideoIdNearElement(video),
      );
      if (direct) return direct;
    }
  } catch (e) {}
  // Trang video/reel/watch độc lập (URL khớp đúng id): ưu tiên đúng file mp4 mà
  // trình duyệt ĐÃ tải về (Performance API). Đây là nguồn chính xác nhất cho reel
  // dạng https://www.facebook.com/reel/<id>, tránh việc dò nhầm trong HTML.
  if (isExactFbVideoPage(videoId)) {
    var liveUrl =
      harvestFbVideoUrlsFromPerformance(null, videoId) ||
      getKnownRecentFbVideoUrl(videoId);
    if (liveUrl) return rememberFbVideoUrl(liveUrl, "performance-exact");
  }
  var htmlUrl = findFbVideoUrlById(videoId, btn);
  if (htmlUrl) return rememberFbVideoUrl(htmlUrl, "html");
  if (canUseLoadedFbVideoResource(videoId, btn)) {
    return (
      harvestFbVideoUrlsFromPerformance(null, videoId) ||
      getKnownRecentFbVideoUrl(videoId)
    );
  }
  return "";
}

export function normalizeFbVideoDownloadUrl(url: string) {
  url = decodeFbVideoUrl(url || "") || "";
  if (!url) return "";
  try {
    var u = new URL(url);
    ["bytestart", "byteend", "range"].forEach(function (key) {
      u.searchParams.delete(key);
    });
    return u.toString();
  } catch (e) {
    return url
      .replace(/([?&])(?:bytestart|byteend|range)=[^&]+/g, "$1")
      .replace(/[?&]+$/, "");
  }
}

export function isLikelyFbVideoUrl(url: string) {
  url = decodeFbVideoUrl(url || "") || "";
  if (!isUsefulFbMediaUrl(url)) return false;
  if (/\.(?:jpg|jpeg|png|webp|gif)(?:[?#]|$)/i.test(url)) return false;
  try {
    var parsed = new URL(url);
    var path = decodeURIComponent(parsed.pathname || "");
    var tag = parsed.searchParams.get("tag") || "";
    if (
      /dashinit|init\.mp4|(?:^|[_\/.-])audio(?:[_\/.-]|$)|audio_dashinit|_audio_/i.test(
        path,
      )
    )
      return false;
    if (/(?:^|[_-])audio(?:[_-]|$)|audio_dash/i.test(tag)) return false;
  } catch (e) {}
  return (
    /\.mp4(?:[?#]|$)/i.test(url) ||
    /\/v\/t\d+\//i.test(url) ||
    /video\.[^\/]+fbcdn\.net/i.test(url) ||
    /(?:bytestart|byteend|range)=/i.test(url)
  );
}

export function isFbFullVideoDownloadUrl(url: string) {
  url = normalizeFbVideoDownloadUrl(url || "");
  if (!isLikelyFbVideoUrl(url)) return false;
  try {
    var parsed = new URL(url);
    var path = decodeURIComponent(parsed.pathname || "");
    var query = decodeURIComponent(parsed.search || "");
    if (!/\.mp4$/i.test(path)) return false;
    if (
      /dashinit|init\.mp4|(?:^|[_\/.-])audio(?:[_\/.-]|$)|audio_dashinit|_audio_/i.test(
        path,
      )
    )
      return false;
    if (/\/o1\/v\/t2\/f2\/m\d+\//i.test(path)) return true;
    if (
      /video\.[^\/]+fbcdn\.net/i.test(parsed.hostname) &&
      /\/m\d+\//i.test(path)
    )
      return true;
    return /xpv_progressive|progressive|dash_h264|h264-basic/i.test(query);
  } catch (e) {
    return /\.mp4(?:[?#]|$)/i.test(url) && !/dashinit|audio/i.test(url);
  }
}

export function getFbVideoAssetIdFromUrl(url: string) {
  url = normalizeFbVideoDownloadUrl(url || "");
  if (!url) return "";
  try {
    var parsed = new URL(url);
    var efg = parsed.searchParams.get("efg") || "";
    if (efg) {
      var decoded = decodeURIComponent(efg);
      var jsonText = "";
      try {
        jsonText = atob(decoded);
      } catch (e) {
        try {
          jsonText = decodeURIComponent(escape(window.atob(decoded)));
        } catch (_) {}
      }
      if (jsonText) {
        var data = JSON.parse(jsonText);
        if (data && data.xpv_asset_id) return String(data.xpv_asset_id);
      }
    }
  } catch (e) {}
  return "";
}

export function isFbVideoUrlCompatibleWithId(url: string, expectedId: string, requireMatch: boolean) {
  if (!isValidFbVideoId(expectedId)) return !requireMatch;
  var assetId = getFbVideoAssetIdFromUrl(url);
  if (assetId && assetId === String(expectedId)) return true;
  if (String(url || "").indexOf(String(expectedId)) !== -1) return true;
  if (assetId) return !requireMatch;
  return !requireMatch;
}

export function scoreFbVideoDownloadUrl(url: string, expectedId: string, baseScore: number) {
  url = normalizeFbVideoDownloadUrl(url || "");
  if (!isLikelyFbVideoUrl(url)) return -Infinity;
  var score = baseScore || 0;
  try {
    var parsed = new URL(url);
    var path = decodeURIComponent(parsed.pathname || "");
    var tag = parsed.searchParams.get("tag") || "";
    var assetId = getFbVideoAssetIdFromUrl(url);
    if (!isFbFullVideoDownloadUrl(url)) score -= 200000;
    if (
      /^\/o1\/v\/t2\/f2\//i.test(path) ||
      /video\.[^\/]+fbcdn\.net/i.test(parsed.hostname + path)
    )
      score += 80000;
    if (/m\d+\/[^\/]+\.mp4$/i.test(path)) score += 20000;
    if (/dash_h264|h264|xpv_progressive|progressive/i.test(tag + " " + url))
      score += 10000;
    if (/quality_hd|browser_native_hd|hd_src/i.test(url)) score += 5000;
    if (/(?:bytestart|byteend|range)=/i.test(url)) score -= 60000;
    if (expectedId && assetId === String(expectedId)) score += 500000;
    if (expectedId && url.indexOf(expectedId) !== -1) score += 100000;
  } catch (e) {}
  return score;
}

export function rememberFbVideoUrl(url: string, source: string, observedAtMs?: number) {
  url = normalizeFbVideoDownloadUrl(url || "");
  if (!isLikelyFbVideoUrl(url)) return "";
  var seenAt = observedAtMs || Date.now();
  for (var i = state.ephFbRecentVideoUrls.length - 1; i >= 0; i--) {
    if (state.ephFbRecentVideoUrls[i].url === url) {
      state.ephFbRecentVideoUrls[i].time = Math.max(
        state.ephFbRecentVideoUrls[i].time || 0,
        seenAt,
      );
      state.ephFbRecentVideoUrls[i].source =
        source || state.ephFbRecentVideoUrls[i].source;
      return url;
    }
  }
  state.ephFbRecentVideoUrls.push({
    url: url,
    time: seenAt,
    source: source || "unknown",
  });
  if (state.ephFbRecentVideoUrls.length > 80)
    state.ephFbRecentVideoUrls.splice(0, state.ephFbRecentVideoUrls.length - 80);
  return url;
}

export function extractFbVideoUrlsFromText(text: string, expectedId: string) {
  var urls: Array<{ url: string; score: number }> = [];
  var seen: Record<string, boolean> = {};
  if (!text) return [] as string[];
  function add(raw: string | null | undefined, bonus?: number) {
    var url = normalizeFbVideoDownloadUrl(raw || "");
    if (!isFbFullVideoDownloadUrl(url) || seen[url]) return;
    seen[url] = true;
    urls.push({ url: url, score: bonus || 0 });
  }
  try {
    var fields = [
      "browser_native_hd_url",
      "playable_url_quality_hd",
      "hd_src",
      "browser_native_sd_url",
      "playable_url",
      "sd_src",
    ];
    fields.forEach(function (field, index) {
      var re = new RegExp(
        "(?:" +
          field +
          ')(?:\\\\?":\\\\?"|":"|&quot;:&quot;)(.*?)(?:\\\\?",|",|&quot;,|\\\\?")',
        "g",
      );
      var m;
      while ((m = re.exec(text)) !== null) {
        add(m[1], 1000 - index * 20);
      }
    });
    var urlRe = /https?(?:(?:\\\/\\\/)|:\/\/)[^"'<>\s]+/g;
    var match;
    while ((match = urlRe.exec(text)) !== null) {
      add(match[0], 100);
    }
    urls.forEach(function (item) {
      item.score = scoreFbVideoDownloadUrl(item.url, expectedId, item.score);
    });
    urls = urls.filter(function (item) {
      return item.score > -Infinity;
    });
    urls.sort(function (a, b) {
      return b.score - a.score;
    });
    return urls.map(function (item) {
      return item.url;
    });
  } catch (e) {
    return [];
  }
}

export function harvestFbVideoUrlsFromPerformance(startPerf: number | null, expectedId: string) {
  var bestItem = null as { url: string; score: number } | null;
  try {
    var entries = performance.getEntriesByType
      ? performance.getEntriesByType("resource")
      : [];
    var nowPerf = performance.now ? performance.now() : 0;
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (startPerf != null && entry.startTime < startPerf - 100) continue;
      if (
        startPerf == null &&
        !expectedId &&
        nowPerf &&
        nowPerf - entry.startTime > 45000
      )
        continue;
      var url = decodeFbVideoUrl(entry.name || "") || "";
      if (!isFbFullVideoDownloadUrl(url)) continue;
      var hadRange = /(?:[?&](?:bytestart|byteend|range)=)/i.test(url);
      var seenAt =
        (performance.timeOrigin ||
          Date.now() - (performance.now ? performance.now() : 0)) +
        (entry.startTime || 0);
      var normalized = rememberFbVideoUrl(url, "performance", seenAt);
      if (!normalized) continue;
      var score = scoreFbVideoDownloadUrl(
        normalized,
        expectedId,
        entry.startTime || 0,
      );
      if (score === -Infinity) continue;
      if (!hadRange) score += 50000;
      if (!bestItem || score > bestItem.score) {
        bestItem = { url: normalized, score: score };
      }
    }
  } catch (e) {}
  return bestItem ? bestItem.url : "";
}

export function getKnownRecentFbVideoUrl(expectedId: string) {
  var best = "";
  var bestScore = -Infinity;
  var now = Date.now();
  for (var i = 0; i < state.ephFbRecentVideoUrls.length; i++) {
    var item = state.ephFbRecentVideoUrls[i];
    if (!item || !item.url || now - item.time > 120000) continue;
    if (!isFbFullVideoDownloadUrl(item.url)) continue;
    if (!isFbVideoUrlCompatibleWithId(item.url, expectedId, false)) continue;
    var score = item.time;
    if (expectedId && getFbVideoAssetIdFromUrl(item.url) === String(expectedId))
      score += 500000000;
    if (expectedId && item.url.indexOf(expectedId) !== -1) score += 100000000;
    if (score > bestScore) {
      bestScore = score;
      best = item.url;
    }
  }
  return best;
}

export function installFbVideoResourceObserver() {
  try {
    if ((window as unknown as { __ephFbVideoResourceObserverInstalled?: boolean }).__ephFbVideoResourceObserverInstalled) return;
    (window as unknown as { __ephFbVideoResourceObserverInstalled?: boolean }).__ephFbVideoResourceObserverInstalled = true;
    if (!("PerformanceObserver" in window)) return;
    var observer = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (entry) {
        try {
          var url = entry && entry.name;
          if (isFbFullVideoDownloadUrl(url)) {
            var seenAt =
              (performance.timeOrigin ||
                Date.now() - (performance.now ? performance.now() : 0)) +
              (entry.startTime || 0);
            rememberFbVideoUrl(url, "resource-observer", seenAt);
          }
        } catch (e) {}
      });
    });
    observer.observe({ type: "resource", buffered: true });
  } catch (e) {}
}

export function resolveFbButtonVideo(btn: EphButton) {
  try {
    var v = btn && btn.__ephVideoElement;
    if (v && document.contains(v) && isVisibleFbVideo(v)) return v;
    var root = btn && getFbMediaRoot(btn);
    var best = null;
    var bestScore = -Infinity;
    var btnRect =
      btn && btn.getBoundingClientRect ? btn.getBoundingClientRect() : null;
    (root || document).querySelectorAll<HTMLVideoElement>("video").forEach(function (video) {
      if (!isVisibleFbVideo(video)) return;
      var rect = video.getBoundingClientRect();
      var score = rect.width * rect.height;
      if (btnRect) {
        score -=
          Math.abs(
            rect.left + rect.width / 2 - (btnRect.left + btnRect.width / 2),
          ) * 100;
        score -=
          Math.abs(
            rect.top + rect.height / 2 - (btnRect.top + btnRect.height / 2),
          ) * 20;
      }
      if (score > bestScore) {
        bestScore = score;
        best = video;
      }
    });
    if (best) {
      if (btn) btn.__ephVideoElement = best;
      return best;
    }
  } catch (e) {}
  return getPrimaryVisibleFbVideo();
}

export function getDirectFbVideoUrlFromElement(video: HTMLVideoElement, videoId: string) {
  if (!video) return "";
  var nearId = getFbVideoIdNearElement(video);
  if (videoId && nearId && nearId !== videoId) return "";
  var direct = rememberFbVideoUrl(
    video.currentSrc || video.src || "",
    "video-element",
  );
  if (direct && isFbVideoUrlCompatibleWithId(direct, videoId || nearId, false))
    return direct;
  try {
    var sources = video.querySelectorAll
      ? video.querySelectorAll<FbNode>("source[src]")
      : [];
    for (var i = 0; i < sources.length; i++) {
      direct = rememberFbVideoUrl(
        sources[i].src || sources[i].getAttribute("src") || "",
        "source",
      );
      if (
        direct &&
        isFbVideoUrlCompatibleWithId(direct, videoId || nearId, false)
      )
        return direct;
    }
  } catch (e) {}
  direct = findFbVideoUrlById(videoId || nearId, video) || "";
  if (direct && isFbVideoUrlCompatibleWithId(direct, videoId || nearId, false))
    return rememberFbVideoUrl(direct, "html");
  return "";
}

export function shouldForceFbOpenForVideoButton(btn: EphButton) {
  try {
    var video = resolveFbButtonVideo(btn);
    var root = getFbMediaRoot(video || btn);
    var mediaCount =
      root && root.querySelectorAll
        ? root.querySelectorAll<FbNode>("img,video").length
        : 0;
    return (
      mediaCount > 1 ||
      hasFbAlbumSignal(root) ||
      getVisibleFbVideoCountInRoot(root) > 1
    );
  } catch (e) {
    return false;
  }
}

export async function waitForFbVideoUrl(btn: EphButton, expectedId: string, startPerf: number | null, timeoutMs: number) {
  if (!isValidFbVideoId(expectedId)) return "";
  var started = Date.now();
  while (Date.now() - started < (timeoutMs || 1800)) {
    var video = resolveFbButtonVideo(btn);
    if (video) {
      try {
        if (video.paused) video.play().catch(function () {});
      } catch (e) {}
      var direct = getDirectFbVideoUrlFromElement(video, expectedId);
      if (direct) return direct;
    }
    var perf = harvestFbVideoUrlsFromPerformance(startPerf, expectedId);
    if (perf) return perf;
    await ephSleep(160);
  }
  var finalPerf = harvestFbVideoUrlsFromPerformance(startPerf, expectedId);
  if (finalPerf) return finalPerf;
  if (canUseLoadedFbVideoResource(expectedId, btn)) {
    return (
      harvestFbVideoUrlsFromPerformance(null, expectedId) ||
      getKnownRecentFbVideoUrl(expectedId)
    );
  }
  return "";
}

export async function waitForFbVideoUrlWithoutPlayback(btn: EphButton, expectedId: string, timeoutMs: number) {
  if (!isValidFbVideoId(expectedId)) return "";
  var started = Date.now();
  while (Date.now() - started < (timeoutMs || 700)) {
    var direct = getFastFbVideoUrl(btn, expectedId);
    if (direct) return direct;
    var perf = harvestFbVideoUrlsFromPerformance(null, expectedId);
    if (perf) return perf;
    var recent = getKnownRecentFbVideoUrl(expectedId);
    if (recent) return recent;
    await ephSleep(120);
  }
  return "";
}
