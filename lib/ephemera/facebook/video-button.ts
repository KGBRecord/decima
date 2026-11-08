import type { EphButton, FbNode } from './types';
import { state } from './state';
import { ensureFbAlbumButton } from './album';
import { guardDownloadButtonEvents } from './button-state';
import { clickbtn } from './click-scan';
import { getFbMediaRoot, getFbVideoIdNearElement, isValidFbVideoId, isVisibleFbVideo } from './dom-helpers';
import { isFbFullVideoDownloadUrl, isFbVideoUrlCompatibleWithId, normalizeFbVideoDownloadUrl, rememberFbVideoUrl } from './url-harvest';

export function hideFbVideoDownloadButton(btn: EphButton) {
  if (!btn || !btn.style) return;
  btn.style.visibility = "hidden";
  btn.style.pointerEvents = "none";
  btn.__ephShown = false;
}

// Chọn phần tử "host" để gắn nút chồng lên video: tổ tiên gần nhất bao trọn
// khung video. Nút là con của host nên CUỘN CÙNG LÚC với bài (position:absolute),
// không còn cảnh bài chạy trước - nút chạy theo sau như khi dùng position:fixed.

export function getFbVideoOverlayHost(video: HTMLVideoElement) {
  if (!video) return null;
  var vr = video.getBoundingClientRect();
  var cur = video.parentElement;
  var fallback = cur || video;
  for (var d = 0; cur && d < 5; d++, cur = cur.parentElement as EphButton | null) {
    try {
      var r = cur.getBoundingClientRect();
      if (
        r.width > 0 &&
        r.height > 0 &&
        r.width >= vr.width - 2 &&
        r.height >= vr.height - 2
      ) {
        return cur;
      }
    } catch (e) {}
  }
  return fallback;
}

export function ensureFbVideoButtonHost(btn: EphButton, video: HTMLVideoElement) {
  var host = getFbVideoOverlayHost(video);
  if (!host || !host.appendChild) return null;
  try {
    if (getComputedStyle(host).position === "static")
      host.style.position = "relative";
  } catch (e) {}
  if (btn.parentElement !== host) {
    host.appendChild(btn);
    btn.__ephShown = undefined; // buộc tính lại vị trí sau khi đổi host
  }
  return host;
}

// Bài video dạng /<page>/videos/pcb.<postId>/<videoId> có thêm các nút mặc định
// của Facebook ở góc dưới -> nâng icon tải lên cao hơn để không bị lẫn vào.

export function isFbPcbVideoContext(video: HTMLVideoElement) {
  try {
    if (/\/videos\/pcb\.[0-9]+\/[0-9]+/.test(location.pathname)) return true;
    var cur: EphButton | null = video;
    for (var d = 0; cur && d < 8; d++, cur = cur.parentElement as EphButton | null) {
      if (cur.querySelectorAll) {
        var links = cur.querySelectorAll<FbNode>('a[href*="/videos/pcb."]');
        for (var i = 0; i < links.length; i++) {
          var href = links[i].getAttribute("href") || links[i].href || "";
          if (/\/videos\/pcb\.[0-9]+\/[0-9]+/.test(href)) return true;
        }
      }
      if (cur.matches && cur.matches('div[role="article"], div[role="dialog"]'))
        break;
    }
  } catch (e) {}
  return false;
}

export function positionFbVideoDownloadButton(btn: EphButton, video: HTMLVideoElement) {
  if (!btn || !video || !document.contains(video)) return;
  try {
    var host = btn.parentElement;
    if (!host) return;
    var hostRect = host.getBoundingClientRect();
    var vRect = video.getBoundingClientRect();
    if (!vRect.width || !vRect.height) {
      if (btn.__ephShown !== false) hideFbVideoDownloadButton(btn);
      return;
    }
    var btnW = btn.offsetWidth || 40;
    var btnH = btn.offsetHeight || 40;
    var rightInset = 12;
    // Nâng nút khỏi đáy để không che thanh điều khiển phát của Facebook.
    var bottomInset = Math.min(
      Math.max(12, Math.round(vRect.height * 0.16)),
      90,
    );
    // Riêng bài dạng pcb: nâng cao thêm để tránh các nút mặc định của Facebook.
    if (btn.__ephPcb) bottomInset = Math.min(bottomInset + 56, 220);
    // Toạ độ của nút TÍNH THEO HOST. Vì host và video cùng nằm trong luồng và
    // cuộn cùng nhau nên giá trị này ổn định khi cuộn -> nút dính chặt, 0 độ trễ.
    var left = Math.round(vRect.right - hostRect.left - btnW - rightInset);
    var top = Math.round(vRect.bottom - hostRect.top - btnH - bottomInset);
    if (
      btn.__ephLeft !== left ||
      btn.__ephTop !== top ||
      btn.__ephShown !== true
    ) {
      btn.__ephLeft = left;
      btn.__ephTop = top;
      btn.__ephShown = true;
      btn.style.position = "absolute";
      btn.style.left = left + "px";
      btn.style.top = top + "px";
      btn.style.right = "auto";
      btn.style.bottom = "auto";
      btn.style.zIndex = "2147483647";
      btn.style.pointerEvents = "auto";
      btn.style.visibility = "visible";
    }
  } catch (e) {}
}

// Quét lại tất cả nút tải video: bỏ nút mồ côi (video đã bị gỡ khỏi DOM) và đặt
// lại vị trí. Nhờ gắn theo host nên việc cuộn KHÔNG cần JS; chỉ cần chạy lại khi
// đổi kích thước / bố cục / định kỳ.

export function repositionAllFbVideoButtons() {
  if (location.href.toString().indexOf("stories") !== -1) return;
  document
    .querySelectorAll<FbNode>(".eph_toolkit_fb_video_btn")
    .forEach(function (btn) {
      var video = btn.__ephVideoElement;
      if (!video || !document.contains(video)) {
        try {
          btn.remove();
        } catch (e) {}
        return;
      }
      ensureFbVideoButtonHost(btn, video);
      positionFbVideoDownloadButton(btn, video);
    });
}

export function scheduleFbButtonReposition() {
  if (state.ephFbRepositionScheduled) return;
  state.ephFbRepositionScheduled = true;
  requestAnimationFrame(function () {
    state.ephFbRepositionScheduled = false;
    try {
      repositionAllFbVideoButtons();
    } catch (e) {}
  });
}
// Cuộn không cần xử lý (nút đã dính theo host). Chỉ cần tính lại khi resize.

export function refreshFbVideoDownloadButton(btn: EphButton, video: HTMLVideoElement) {
  if (!btn || !video || !document.contains(video)) return false;
  // Cache id theo src: getFbVideoIdNearElement rất nặng (outerHTML slice 180KB + regex trên 10 tổ tiên)
  var idpost = "";
  var curSrc = video.currentSrc || video.src || "";
  var cachedId = btn.getAttribute && btn.getAttribute("data-video-id");
  if (
    isValidFbVideoId(cachedId as string) &&
    btn.__ephIdSrc === curSrc &&
    btn.__ephVideoElement === video
  ) {
    idpost = cachedId as string;
  } else {
    idpost = getFbVideoIdNearElement(video);
    btn.__ephIdSrc = curSrc;
  }
  if (!isValidFbVideoId(idpost)) {
    try {
      btn.remove();
    } catch (e) {}
    return false;
  }
  btn.id = idpost;
  btn.setAttribute("data-video-id", idpost);
  btn.__ephVideoElement = video;
  btn.__ephPcb = isFbPcbVideoContext(video);
  try {
    var direct = normalizeFbVideoDownloadUrl(
      video.currentSrc || video.src || "",
    );
    if (
      isFbFullVideoDownloadUrl(direct) &&
      isFbVideoUrlCompatibleWithId(direct, idpost, false)
    ) {
      rememberFbVideoUrl(direct, "video-event");
      btn.setAttribute("data-video-url", direct);
    }
  } catch (e) {}
  ensureFbVideoButtonHost(btn, video);
  positionFbVideoDownloadButton(btn, video);
  return true;
}

export function bindFbVideoButtonRefresh(videoArg: HTMLVideoElement, btn: EphButton) {
  var video = videoArg as HTMLVideoElement & EphButton;
  if (!video || !btn) return;
  video.__ephFbDownloadButton = btn;
  if (!video.__ephFbRefreshHandler) {
    video.__ephFbRefreshHandler = function () {
      // Chỉ tính lại video-id khi src thực sự thay đổi; nếu không chỉ cần đặt lại vị trí nút (rẻ hơn rất nhiều).
      var _src = video.currentSrc || video.src || "";
      if (
        video.__ephLastRefreshSrc === _src &&
        video.__ephFbDownloadButton &&
        document.contains(video.__ephFbDownloadButton)
      ) {
        positionFbVideoDownloadButton(video.__ephFbDownloadButton!, video);
        return;
      }
      video.__ephLastRefreshSrc = _src;
      refreshFbVideoDownloadButton(video.__ephFbDownloadButton!, video);
    };
    // BỎ "progress"/"timeupdate": 2 event này bắn ~4 lần/giây trên MỖI video đang phát,
    // mỗi lần lại quét outerHTML + regex nặng -> nguyên nhân chính gây giật lag Facebook.
    ["loadedmetadata", "loadeddata", "play", "playing"].forEach(
      function (eventName) {
        try {
          video.addEventListener(
            eventName,
            video.__ephFbRefreshHandler!,
            true,
          );
        } catch (e) {}
      },
    );
    // Đổi kích thước video (vào/ra rạp chiếu, xoay ngang...) -> đặt lại ngay.
    try {
      if (typeof ResizeObserver !== "undefined") {
        video.__ephFbResizeObs = new ResizeObserver(function () {
          positionFbVideoDownloadButton(video.__ephFbDownloadButton!, video);
        });
        video.__ephFbResizeObs.observe(video);
      }
    } catch (e) {}
  }
  refreshFbVideoDownloadButton(btn, video);
}

export function placeFbDownloadButtonOnVideo(videoArg: HTMLVideoElement) {
  var video = videoArg as HTMLVideoElement & EphButton;
  if (!video || !isVisibleFbVideo(video)) return false;
  var wrap = video.parentElement || video;
  if (!wrap || !wrap.querySelector) return false;
  var existing =
    video.__ephFbDownloadButton &&
    document.contains(video.__ephFbDownloadButton)
      ? video.__ephFbDownloadButton
      : wrap.querySelector<FbNode>(".eph_toolkit_fb_video_btn");
  // Tránh quét id lặp lại mỗi 1.5s cho video đã gắn nút và src không đổi (giảm reflow + regex)
  var idpost = "";
  var curSrc = video.currentSrc || video.src || "";
  if (existing && existing.getAttribute) {
    var exId = existing.getAttribute("data-video-id") as string;
    if (isValidFbVideoId(exId) && existing.__ephIdSrc === curSrc)
      idpost = exId;
  }
  if (!isValidFbVideoId(idpost)) {
    idpost = getFbVideoIdNearElement(video);
    if (existing) existing.__ephIdSrc = curSrc;
  }
  if (!isValidFbVideoId(idpost)) {
    if (existing) {
      try {
        existing.remove();
      } catch (e) {}
    }
    return false;
  }
  if (existing) {
    existing.id = idpost;
    existing.setAttribute("data-video-id", idpost);
    existing.__ephVideoElement = video;
    guardDownloadButtonEvents(existing);
    bindFbVideoButtonRefresh(video, existing);
    ensureFbVideoButtonHost(existing, video);
    positionFbVideoDownloadButton(existing, video);
    ensureFbAlbumButton(getFbMediaRoot(video) as EphButton);
    return true;
  }
  var btn = document.createElement("div");
  btn.id = idpost || "";
  btn.onclick = clickbtn as unknown as (ev: MouseEvent) => void;
  btn.className = "eph_toolkit_dl_btn eph_toolkit_fb_video_btn";
  btn.setAttribute("data-video-id", idpost || "");
  btn.innerHTML =
    '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';
  (btn as EphButton).__ephVideoElement = video;
  guardDownloadButtonEvents(btn);
  // Gắn nút VÀO trong khung bài (host) thay vì body -> nút cuộn cùng bài, và tự
  // biến mất khi Facebook gỡ bài khỏi DOM (không còn nút mồ côi trôi nổi).
  var host = getFbVideoOverlayHost(video) || document.body;
  try {
    if (getComputedStyle(host).position === "static")
      host.style.position = "relative";
  } catch (e) {}
  host.appendChild(btn);
  bindFbVideoButtonRefresh(video, btn);
  positionFbVideoDownloadButton(btn as EphButton, video);
  ensureFbAlbumButton(getFbMediaRoot(video) as EphButton);
  return true;
}

export function addButtonsToVisibleFbVideos() {
  if (location.href.toString().indexOf("stories") !== -1) return 0;
  var count = 0;
  document.querySelectorAll<HTMLVideoElement>("video").forEach(function (video) {
    if (placeFbDownloadButtonOnVideo(video)) count++;
  });
  return count;
}
