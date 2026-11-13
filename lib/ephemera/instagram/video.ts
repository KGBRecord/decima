import type { DlButton, IgImageCandidate, IgMediaInfoResponse, IgMediaItem, IgVideoVersion } from './types';
import { setOnClick } from './dom';
import { markDownloadButtonBusy, restoreDownloadButton, ephIsWindowsClient, ephNeedsFloatingVideoButton, isIgReelsViewer } from './buttons';
import { codetopk, getDirectIgVideoUrlNearButton, getIgCarouselIndexNearButton, getIgChannelNear, getShortcodeNear, getVisibleIgVideoNearButton, parseIgShortcodeFromHref } from './shortcode';
import { buildIgFileBase, findVideoUrlDeep } from './story-fetch';

// Tải đúng video qua API: lấy video_versions của slide video đang hiển thị (.mp4)
export function downloadIgVideoSmart(btn: DlButton): void {
  try {
    var code = getShortcodeNear(btn);
    if (!code) {
      restoreDownloadButton(btn);
      return;
    }
    try {
      var ic = btn.getElementsByClassName("eph_toolkit_icon")[0];
      if (ic) ic.classList.add("eph_toolkit_loader");
    } catch (_) {}
    var directFallbackUrl = getDirectIgVideoUrlNearButton(btn);
    var poster = "";
    var carouselIndex: number | null = null;
    try {
      var activeVideo = getVisibleIgVideoNearButton(btn);
      carouselIndex = getIgCarouselIndexNearButton(btn, activeVideo);
      poster = activeVideo ? activeVideo.getAttribute("poster") || "" : "";
    } catch (_) {}
    var pk = codetopk(code);
    if (!pk || pk === "null") {
      if (directFallbackUrl) {
        var fallbackChannel = getIgChannelNear(btn);
        var fallbackOrder = carouselIndex != null ? carouselIndex + 1 : 1;
        chrome.runtime.sendMessage(
          {
            downloadv1: directFallbackUrl,
            idx: "instagram",
            url: location.href,
            platform: "ig",
            channel: fallbackChannel,
            shortcode: code,
            order: fallbackOrder,
            mediaType: "video",
            filename: buildIgFileBase(
              fallbackChannel,
              code,
              fallbackOrder,
              "video",
            ),
          },
          function () {},
        );
        return;
      }
      console.error(
        "[Ephemera] Cannot resolve Instagram media id for shortcode:",
        code,
      );
      restoreDownloadButton(btn);
      return;
    }
    var token = document.documentElement.outerHTML.match(
      /csrf_token":".*?(?=")/g,
    );
    var csrf = token && token[0] ? token[0].split('"')[2] : "";
    fetch("https://www.instagram.com/api/v1/media/" + pk + "/info/", {
      method: "GET",
      headers: {
        "x-ig-app-id": "936619743392459",
        "x-csrftoken": csrf,
        "x-requested-with": "XMLHttpRequest",
      },
      credentials: "include",
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (json: IgMediaInfoResponse) {
        var item = json.items && json.items[0];
        if (!item) return;
        var medias =
          item.carousel_media && item.carousel_media.length
            ? item.carousel_media
            : [item];
        var vids = medias.filter(function (m: IgMediaItem) {
          return (
            (m.video_versions && m.video_versions.length) || findVideoUrlDeep(m)
          );
        });
        var chosen: IgMediaItem | null | undefined = null;
        if (medias.length === 1) chosen = medias[0];
        else if (
          carouselIndex !== null &&
          medias[carouselIndex] &&
          ((medias[carouselIndex].video_versions &&
            (medias[carouselIndex].video_versions as IgVideoVersion[]).length) ||
            findVideoUrlDeep(medias[carouselIndex]))
        ) {
          chosen = medias[carouselIndex];
        } else if (vids.length === 1) chosen = vids[0];
        else if (poster) {
          var pf = poster.split("?")[0].split("/").pop();
          chosen = medias.find(function (m: IgMediaItem) {
            if (!(
              (m.video_versions && m.video_versions.length) ||
              findVideoUrlDeep(m)
            ))
              return false;
            var cands =
              (m.image_versions2 && m.image_versions2.candidates) || [];
            return cands.some(function (c: IgImageCandidate) {
              return c.url && c.url.split("?")[0].split("/").pop() === pf;
            });
          });
        }
        if (!chosen && vids.length) chosen = vids[0];
        if (!chosen) chosen = medias[0];
        var url =
          chosen.video_versions && chosen.video_versions[0]
            ? chosen.video_versions[0].url
            : findVideoUrlDeep(chosen);
        try {
          console.log(
            "[Ephemera] IG video URL:",
            url,
            "| carousel:",
            medias.length,
            "| videos:",
            vids.length,
            "| index:",
            carouselIndex,
            "| chosen:",
            chosen && (chosen.pk || chosen.id),
          );
        } catch (e) {}
        if (url) {
          var username = (item.user && item.user.username) || "unknown_channel";
          var chosenIndex = medias.indexOf(chosen);
          var order =
            chosenIndex >= 0
              ? chosenIndex + 1
              : carouselIndex != null
                ? carouselIndex + 1
                : 1;
          chrome.runtime.sendMessage(
            {
              downloadv1: url,
              idx: "instagram",
              url: location.href,
              platform: "ig",
              channel: username,
              shortcode: code,
              order: order,
              mediaType: "video",
              filename: buildIgFileBase(username, code, order, "video"),
            },
            function () {},
          );
        } else if (directFallbackUrl) {
          var fallbackUsername =
            (item.user && item.user.username) || getIgChannelNear(btn);
          var fallbackOrder = carouselIndex != null ? carouselIndex + 1 : 1;
          chrome.runtime.sendMessage(
            {
              downloadv1: directFallbackUrl,
              idx: "instagram",
              url: location.href,
              platform: "ig",
              channel: fallbackUsername,
              shortcode: code,
              order: fallbackOrder,
              mediaType: "video",
              filename: buildIgFileBase(
                fallbackUsername,
                code,
                fallbackOrder,
                "video",
              ),
            },
            function () {},
          );
        } else restoreDownloadButton(btn);
      })
      .catch(function (e) {
        restoreDownloadButton(btn);
        console.error("[Ephemera] downloadIgVideoSmart:", e);
      });
  } catch (ex) {}
}
// Tải đúng video đang hiển thị bằng luồng bắt URL video (instagram-video.js + instagram.js)
export function clickVideoDownload(this: HTMLElement, e?: Event | null): void {
  if (e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (_) {}
  }
  markDownloadButtonBusy(this);
  if (isIgReelsViewer()) {
    // every reel in the viewer shares one page: take the code from the URL and the video from the screen now
    var current = parseIgShortcodeFromHref(location.href);
    if (current) this.setAttribute("data-ig-shortcode", current);
    var shown = pickMostVisibleVideo();
    if (shown) (this as DlButton).__ephVideoElement = shown;
  }
  downloadIgVideoSmart(this);
}

/** The video taking up most of the screen, or null when none is on screen. */
export function pickMostVisibleVideo(): HTMLVideoElement | null {
  var best: HTMLVideoElement | null = null;
  var bestPx = 80;
  var vids = document.querySelectorAll("video");
  for (var i = 0; i < vids.length; i++) {
    var r = vids[i].getBoundingClientRect();
    if (r.width < 120) continue;
    var px = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    if (px > bestPx && r.right > 0 && r.left < innerWidth) {
      bestPx = px;
      best = vids[i];
    }
  }
  return best;
}

function floatingVideoButton(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.eph_toolkit_dl_btn[data-ig-windows-floating="1"]');
}

/** Reels viewer: one floating button that follows the reel on screen and always names the reel in the URL. */
export function placeReelsViewerButton(): void {
  var btn = floatingVideoButton();
  var video = pickMostVisibleVideo();
  if (!video) {
    if (btn) btn.style.display = "none";
    return;
  }
  var rect = video.getBoundingClientRect();
  if (!btn) {
    btn = document.createElement("div");
    btn.className = "eph_toolkit_dl_btn";
    btn.setAttribute("data-ig-windows-floating", "1");
    btn.innerHTML =
      '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';
    document.body.appendChild(btn);
  }
  var code = parseIgShortcodeFromHref(location.href);
  if (code) btn.setAttribute("data-ig-shortcode", code);
  (btn as DlButton).__ephVideoElement = video;
  btn.onclick = null;
  btn.style.position = "fixed";
  btn.style.left = Math.max(8, rect.left + 12) + "px";
  btn.style.top = Math.max(8, rect.top + 12) + "px";
  btn.style.display = "flex";
  btn.style.opacity = "0.88";
  btn.style.zIndex = "2147483647";
  btn.style.pointerEvents = "auto";
  prepareWindowsIgDownloadButton(btn as DlButton, video);
}

/** Keep the reels button on the reel being scrolled to, without waiting for the 2 second scan. */
export function watchReelsViewer(): void {
  var queued = false;
  var run = function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      try {
        if (isIgReelsViewer()) placeReelsViewerButton();
      } catch (e) {}
    });
  };
  document.addEventListener("scroll", run, { capture: true, passive: true });
  window.addEventListener("resize", run, { passive: true });
}

export function prepareWindowsIgDownloadButton(btn: DlButton, video: HTMLVideoElement): void {
  try {
    if (!ephNeedsFloatingVideoButton() || !btn || btn.__ephWindowsPrepared) return;
    btn.__ephWindowsPrepared = true;
    btn.style.zIndex = "2147483647";
    btn.style.pointerEvents = "auto";
    btn.style.cursor = "pointer";
    btn.style.touchAction = "none";
    btn.addEventListener(
      "pointerdown",
      function (ev) {
        try {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
        } catch (_) {}
      },
      true,
    );
    btn.addEventListener(
      "mousedown",
      function (ev) {
        try {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
        } catch (_) {}
      },
      true,
    );
    btn.addEventListener(
      "click",
      function (ev) {
        try {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
        } catch (_) {}
        clickVideoDownload.call(btn, ev);
      },
      true,
    );
    if (video) btn.__ephVideoElement = video;
  } catch (e) {}
}

export function ensureWindowsFloatingVideoDownloadButton(video: HTMLVideoElement): boolean {
  try {
    if (!ephIsWindowsClient() || isIgReelsViewer()) return false;
    if (location.pathname.indexOf("/stories/") !== -1) return false;
    if (
      !video ||
      video.offsetParent === null ||
      video.offsetHeight < 150 ||
      video.offsetWidth < 120
    )
      return false;
    var rect = video.getBoundingClientRect();
    if (
      rect.bottom <= 0 ||
      rect.top >= innerHeight ||
      rect.right <= 0 ||
      rect.left >= innerWidth
    )
      return false;

    var shortcode =
      getShortcodeNear(video) || parseIgShortcodeFromHref(location.href);
    var btn = document.querySelector<HTMLElement>(
      '.eph_toolkit_dl_btn[data-ig-windows-floating="1"]',
    );
    if (!btn) {
      btn = document.createElement("div");
      btn.className = "eph_toolkit_dl_btn";
      btn.setAttribute("data-ig-windows-floating", "1");
      btn.innerHTML =
        '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';
      document.body.appendChild(btn);
    }
    if (shortcode) btn.setAttribute("data-ig-shortcode", shortcode);
    (btn as DlButton).__ephVideoElement = video;
    btn.onclick = null;
    btn.style.position = "fixed";
    btn.style.left = Math.max(8, rect.left + 12) + "px";
    btn.style.top = Math.max(8, rect.top + 12) + "px";
    btn.style.display = "flex";
    btn.style.opacity = "0.88";
    btn.style.zIndex = "2147483647";
    btn.style.pointerEvents = "auto";
    prepareWindowsIgDownloadButton(btn, video);
    return true;
  } catch (e) {
    return false;
  }
}

// Gắn nút tải video LÊN chính video (bài 1 video / reel / carousel có video / khi bật video)
export function addVideoDownloadButton() {
  try {
    if (location.pathname.indexOf("/stories/") !== -1) return; // story có nút riêng
    if (isIgReelsViewer()) {
      document.querySelectorAll(".eph_toolkit_dl_btn:not([data-ig-windows-floating])").forEach(function (el) {
        if (el.querySelector(".eph_toolkit_dl_pregress_loader")) el.remove();
      });
      placeReelsViewerButton();
      return;
    }
    if (!ephIsWindowsClient()) {
      var stray = floatingVideoButton();
      if (stray) stray.remove();
    }
    var vids = document.querySelectorAll("video");
    for (var i = 0; i < vids.length; i++) {
      var v = vids[i];
      if (v.offsetParent === null || v.offsetHeight < 150) continue;
      var wrap = v.parentElement || v;
      ensureWindowsFloatingVideoDownloadButton(v);
      var existingBtn =
        wrap.querySelector && wrap.querySelector<HTMLElement>(".eph_toolkit_dl_btn");
      if (existingBtn) {
        (existingBtn as DlButton).__ephVideoElement = v;
        prepareWindowsIgDownloadButton(existingBtn, v);
        var existingCode = getShortcodeNear(wrap);
        if (existingCode)
          existingBtn.setAttribute("data-ig-shortcode", existingCode);
        var existingIndex = getIgCarouselIndexNearButton(existingBtn, v);
        if (existingIndex !== null)
          existingBtn.setAttribute(
            "data-ig-carousel-index",
            String(existingIndex),
          );
        continue;
      }
      var btn = document.createElement("div") as DlButton;
      btn.className = "eph_toolkit_dl_btn";
      setOnClick(btn, clickVideoDownload);
      prepareWindowsIgDownloadButton(btn, v);
      var shortcode = getShortcodeNear(wrap);
      if (shortcode) btn.setAttribute("data-ig-shortcode", shortcode);
      btn.__ephVideoElement = v;
      var carouselIndex = getIgCarouselIndexNearButton(btn, v);
      if (carouselIndex !== null)
        btn.setAttribute("data-ig-carousel-index", String(carouselIndex));
      btn.innerHTML =
        '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';
      if (getComputedStyle(wrap).position === "static")
        wrap.style.position = "relative";
      wrap.appendChild(btn);
    }
  } catch (e) {}
}

