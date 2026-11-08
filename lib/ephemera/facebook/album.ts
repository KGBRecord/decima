import type { EphButton, FbNode, FbMediaItem } from './types';
import { state } from './state';
import { guardDownloadButtonEvents, markDownloadButtonBusy, restoreDownloadButton } from './button-state';
import { decodeFbVideoUrl, getBestImageUrl, getFbMediaRoot, getFbVideoIdNearElement, isFbElementVisible, isUsefulFbMediaUrl, ephSleep } from './dom-helpers';
import { buildFbFileBase, fbNamePart, getFbChannelName, getFbPostIdForRoot } from './filenames';
import { findFbVideoUrlById, getDirectFbVideoUrlFromElement, getKnownRecentFbVideoUrl, harvestFbVideoUrlsFromPerformance } from './url-harvest';

export function collectFbAlbumMedia(root: EphButton): FbMediaItem[] {
  if (
    !root ||
    !root.querySelectorAll ||
    location.href.toString().indexOf("stories") !== -1
  )
    return [];
  var items: FbMediaItem[] = [];
  var seen: Record<string, boolean> = {};
  function add(type: string, url: string, id: string | number) {
    url = decodeFbVideoUrl(url || "") || "";
    if (!isUsefulFbMediaUrl(url) || seen[url]) return;
    seen[url] = true;
    items.push({
      type: type,
      url: url,
      id: String(id || type + "_" + (items.length + 1)).replace(
        /[^\w.-]/g,
        "_",
      ),
    });
  }
  root
    .querySelectorAll<FbNode>(
      'a[href*="/photo"], a[href*="fbid="], a[href*="set="], a[href*="/media/set/"]',
    )
    .forEach(function (link) {
      var img = link.querySelector<FbNode>("img");
      if (!img || !isFbElementVisible(img, 120, 120)) return;
      var url = getBestImageUrl(img);
      if (!isUsefulFbMediaUrl(url)) return;
      add("image", url, "image_" + (items.length + 1));
    });
  root.querySelectorAll<HTMLVideoElement>("video").forEach(function (video) {
    if (!isFbElementVisible(video, 120, 120)) return;
    var id = getFbVideoIdNearElement(video);
    var url =
      getDirectFbVideoUrlFromElement(video, id) ||
      findFbVideoUrlById(id, video) ||
      harvestFbVideoUrlsFromPerformance(null, id) ||
      getKnownRecentFbVideoUrl(id) ||
      "";
    if (url) add("video", url, id || "video_" + (items.length + 1));
  });
  return items;
}

export function getFbAlbumEntry(root: EphButton) {
  if (!root || !root.querySelectorAll) return null;
  var candidates: Array<{ el: FbNode; area: number; photo: boolean }> = [];
  root
    .querySelectorAll<FbNode>(
      'a[href*="/photo"], a[href*="fbid="], a[href*="set="], a[href*="/media/set/"], a[href*="/videos/"], a[href*="/watch"], a[href*="/reel/"]',
    )
    .forEach(function (el) {
      var media = el.querySelector<FbNode>("img,video") || el;
      if (!isFbElementVisible(media, 100, 100)) return;
      var rect = media.getBoundingClientRect();
      var href = el.getAttribute("href") || el.href || "";
      var isPhoto = /\/photo|fbid=|set=|\/media\/set\//.test(href);
      candidates.push({
        el: el,
        area: rect.width * rect.height,
        photo: isPhoto,
      });
    });
  root.querySelectorAll<FbNode>("img,video").forEach(function (el) {
    if (!isFbElementVisible(el, 140, 140)) return;
    var rect = el.getBoundingClientRect();
    candidates.push({
      el: el,
      area: rect.width * rect.height,
      photo: el.tagName === "IMG",
    });
  });
  // Ưu tiên mở bằng ẢNH: trình xem ảnh của Facebook cho phép lướt qua TẤT CẢ
  // media của bài (cả ảnh lẫn video), nhờ vậy gom được đủ cả video + ảnh.
  candidates.sort(function (a, b) {
    if (!!a.photo !== !!b.photo) return a.photo ? -1 : 1;
    return b.area - a.area;
  });
  return candidates.length ? candidates[0].el : null;
}

// Đếm số mục media (ảnh + video) trong bài, KHÔNG phụ thuộc việc đã lấy được URL
// hay chưa. Dùng để nhận diện bài hỗn hợp (vd 1 video + 1 ảnh) -> vẫn hiện nút
// "tải album" dù URL video (blob) chưa giải được tại thời điểm quét.

export function getFbAlbumMediaElementCount(root: EphButton) {
  if (!root || !root.querySelectorAll)
    return { total: 0, images: 0, videos: 0 };
  var images = 0,
    videos = 0,
    seen: FbNode[] = [];
  function uniqPush(el: FbNode) {
    if (seen.indexOf(el) === -1) {
      seen.push(el);
      return true;
    }
    return false;
  }
  root
    .querySelectorAll<FbNode>(
      'a[href*="/photo"], a[href*="fbid="], a[href*="set="], a[href*="/media/set/"]',
    )
    .forEach(function (link) {
      var img = link.querySelector<FbNode>("img");
      if (img && isFbElementVisible(img, 120, 120) && uniqPush(img)) images++;
    });
  root.querySelectorAll<HTMLVideoElement>("video").forEach(function (video) {
    if (isFbElementVisible(video, 120, 120)) videos++;
  });
  return { total: images + videos, images: images, videos: videos };
}

export function hasFbAlbumSignal(root: EphButton | null) {
  if (!root) return false;
  var media = collectFbAlbumMedia(root);
  if (media.length > 1) return true;
  // Bài hỗn hợp video + ảnh: URL video có thể là blob nên chưa giải được ngay,
  // nhưng vẫn cần hiện nút album để tải kèm cả video lẫn ảnh.
  var count = getFbAlbumMediaElementCount(root);
  if (count.total > 1 && (count.videos >= 1 || count.images >= 2)) return true;
  try {
    var text = (root.innerText || "").replace(/\s+/g, " ");
    if (/\+\s*\d+/.test(text) && getFbAlbumEntry(root)) return true;
  } catch (e) {}
  return false;
}

export function getActiveFbMediaDialog() {
  var best: FbNode | null = null;
  var bestArea = 0;
  document
    .querySelectorAll<FbNode>('div[role="dialog"], div[aria-modal="true"]')
    .forEach(function (dialog) {
      if (!dialog.querySelector || !dialog.querySelector<FbNode>("img,video")) return;
      if (!isFbElementVisible(dialog, 200, 200)) return;
      var rect = dialog.getBoundingClientRect();
      var area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        best = dialog;
      }
    });
  return best;
}

export function getPrimaryFbDialogMedia(dialog: EphButton): FbMediaItem | null {
  if (!dialog || !dialog.querySelectorAll) return null;
  var best: FbNode | null = null;
  var bestArea = 0;
  dialog.querySelectorAll<FbNode>("video,img").forEach(function (el) {
    if (!isFbElementVisible(el, 160, 160)) return;
    var rect = el.getBoundingClientRect();
    var centerPenalty =
      Math.abs(rect.left + rect.width / 2 - innerWidth / 2) * 40;
    var area = rect.width * rect.height - centerPenalty;
    if (area > bestArea) {
      bestArea = area;
      best = el;
    }
  });
  if (!best) return null;
  if ((best as FbNode).tagName === "VIDEO") {
    var id = getFbVideoIdNearElement(best);
    var vurl =
      getDirectFbVideoUrlFromElement(best, id) ||
      findFbVideoUrlById(id, best) ||
      harvestFbVideoUrlsFromPerformance(null, id) ||
      getKnownRecentFbVideoUrl(id) ||
      "";
    return vurl
      ? { type: "video", url: vurl, id: id || "video" }
      : { type: "video", url: "", id: id || "video", pending: true, el: best };
  }
  var iurl = getBestImageUrl(best);
  return iurl ? { type: "image", url: iurl, id: "image" } : null;
}

export function getFbDialogSignature(dialog: EphButton) {
  var item = getPrimaryFbDialogMedia(dialog);
  if (item && item.url) return item.url;
  try {
    return (
      location.href + "|" + ((dialog && dialog.innerText) || "").slice(0, 160)
    );
  } catch (e) {}
  return String(Date.now());
}

export function findFbViewerButton(dialog: EphButton, pattern: RegExp, preferRight: boolean) {
  if (!dialog || !dialog.querySelectorAll) return null;
  var candidates: Array<{ el: FbNode; score: number }> = [];
  dialog
    .querySelectorAll<FbNode>(
      'button, a[role="button"], div[role="button"], [aria-label]',
    )
    .forEach(function (el) {
      if (!isFbElementVisible(el, 18, 18)) return;
      if (
        el.classList &&
        (el.classList.contains("eph_toolkit_dl_btn") ||
          el.classList.contains("eph_dowall"))
      )
        return;
      var label = (
        (el.getAttribute && el.getAttribute("aria-label")) ||
        el.innerText ||
        el.title ||
        ""
      ).trim();
      var rect = el.getBoundingClientRect();
      if (pattern.test(label)) {
        candidates.push({
          el: el,
          score: preferRight ? rect.left : innerWidth - rect.left,
        });
      }
    });
  candidates.sort(function (a, b) {
    return b.score - a.score;
  });
  return candidates.length ? candidates[0].el : null;
}

export function findFbViewerNextButton(dialog: EphButton) {
  var next = findFbViewerButton(dialog, /(next|tiếp|sau|kế tiếp)/i, true);
  if (next) return next;
  var fallback: Array<{ el: FbNode; left: number }> = [];
  dialog
    .querySelectorAll<FbNode>('div[role="button"], button, a[role="button"]')
    .forEach(function (el) {
      if (!isFbElementVisible(el, 28, 28)) return;
      var rect = el.getBoundingClientRect();
      if (
        rect.left > innerWidth * 0.62 &&
        rect.top > innerHeight * 0.18 &&
        rect.bottom < innerHeight * 0.88 &&
        rect.width <= 90 &&
        rect.height <= 90
      ) {
        fallback.push({ el: el, left: rect.left });
      }
    });
  fallback.sort(function (a, b) {
    return b.left - a.left;
  });
  return fallback.length ? fallback[0].el : null;
}

export async function waitForFbDialogChange(dialog: EphButton, oldSignature: string) {
  for (var i = 0; i < 15; i++) {
    await ephSleep(80);
    if (getFbDialogSignature(dialog) !== oldSignature) return true;
  }
  return false;
}

export function closeFbMediaDialog(dialog: EphButton) {
  var close = findFbViewerButton(dialog, /(close|đóng|thoát)/i, false);
  if (close) {
    try {
      close.click();
      return;
    } catch (e) {}
  }
  try {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true,
      }),
    );
  } catch (e) {}
}

export async function collectFbAlbumMediaFromViewer(root: EphButton) {
  var entry = getFbAlbumEntry(root);
  var fallback = collectFbAlbumMedia(root);
  if (!entry) return fallback;
  var dialogBefore = getActiveFbMediaDialog();
  try {
    entry.click();
  } catch (e) {
    return fallback;
  }
  var dialog: FbNode | null = null;
  for (var waitOpen = 0; waitOpen < 10; waitOpen++) {
    await ephSleep(80);
    dialog = getActiveFbMediaDialog();
    if (dialog) break;
  }
  if (!dialog) return fallback;
  var openedDialog = dialog !== dialogBefore;
  var items: FbMediaItem[] = [];
  var seen: Record<string, boolean> = {};
  function add(item: FbMediaItem | null) {
    if (!item || !item.url || !isUsefulFbMediaUrl(item.url) || seen[item.url])
      return false;
    seen[item.url] = true;
    items.push({
      type: item.type,
      url: item.url,
      id: String(item.id || item.type || "media").replace(/[^\w.-]/g, "_"),
    });
    return true;
  }
  for (var index = 0; index < 80; index++) {
    await ephSleep(120);
    var current = getPrimaryFbDialogMedia(dialog);
    // Slide là video nhưng chưa lấy được URL (src blob đang tải): kích cho video
    // phát và thử lại vài nhịp để bắt đúng link tải, tránh bỏ sót video.
    if (current && current.type === "video" && !current.url) {
      try {
        if (current.el && current.el.paused)
          current.el.play().catch(function () {});
      } catch (e) {}
      for (var r = 0; r < 8 && (!current || !current.url); r++) {
        await ephSleep(160);
        current = getPrimaryFbDialogMedia(dialog);
        if (current && current.type === "video" && !current.url) {
          try {
            if (current.el && current.el.paused)
              current.el.play().catch(function () {});
          } catch (e) {}
        }
      }
    }
    add(current);
    var next = findFbViewerNextButton(dialog);
    if (!next) break;
    var beforeSig = getFbDialogSignature(dialog);
    try {
      next.click();
    } catch (e) {
      break;
    }
    var changed = await waitForFbDialogChange(dialog, beforeSig);
    if (!changed) break;
    var afterSig = getFbDialogSignature(dialog);
    if (seen[afterSig]) {
      add(getPrimaryFbDialogMedia(dialog));
      break;
    }
  }
  if (openedDialog) closeFbMediaDialog(dialog);
  return items.length ? items : fallback;
}

export async function clickFbAlbumDownload(this: EphButton, e: Event) {
  if (e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (_) {}
  }
  state.dataelement = this;
  markDownloadButtonBusy(this);
  var root = (this.__ephAlbumRoot || getFbMediaRoot(this)) as EphButton;
  try {
    var media = await collectFbAlbumMediaFromViewer(root);
    if (media.length < 2) {
      restoreDownloadButton(this);
      return;
    }
    var stamp = Date.now();
    var postId = getFbPostIdForRoot(root, "");
    var albumName = ["fb", getFbChannelName(root), postId, "album"]
      .map(function (x) {
        return fbNamePart(x);
      })
      .join("_");
    var downloads = media.map(function (item, index) {
      var order = index + 1;
      return {
        pk: String(order).padStart(3, "0") + "_" + item.id,
        filename: buildFbFileBase(root, postId, order, item.type),
        urls: item.type === "video" ? [item.url, item.url] : [item.url],
      };
    });
    chrome.runtime.sendMessage(
      { download: downloads, user: albumName, albumName: albumName },
      function () {},
    );
  } catch (ex) {
    restoreDownloadButton(this);
    try {
      console.error("[Ephemera] FB album download failed:", ex);
    } catch (e) {}
  }
}

export function getFbAlbumPostRoot(root: EphButton): EphButton | null {
  if (!root || !root.querySelector) return null;
  var entry = getFbAlbumEntry(root);
  if (!entry) {
    return root.matches &&
      (root.matches('div[role="article"]') ||
        root.matches('div[role="dialog"], div[aria-modal="true"]'))
      ? root
      : null;
  }
  var article = entry.closest && entry.closest<EphButton>('div[role="article"]');
  if (article) return article;
  var dialog =
    entry.closest &&
    entry.closest<EphButton>('div[role="dialog"], div[aria-modal="true"]');
  if (dialog) return dialog;
  var mediaRoot = getFbMediaRoot(entry);
  if (mediaRoot && typeof mediaRoot.querySelector === "function") return mediaRoot;
  return root;
}

export function getFbAlbumButtonHost(root: EphButton): EphButton {
  var entry = getFbAlbumEntry(root);
  if (!entry) return root;
  var host: EphButton = entry;
  for (
    var depth = 0;
    host && host.parentElement && host.parentElement !== root && depth < 5;
    depth++
  ) {
    var parent = host.parentElement as EphButton;
    try {
      if (parent.querySelectorAll<FbNode>("img,video").length < 2) break;
      host = parent;
    } catch (e) {
      break;
    }
  }
  return host || root;
}

export function positionFbAlbumButton(btn: EphButton) {
  if (!btn) return;
  btn.style.position = "absolute";
  btn.style.left = "12px";
  btn.style.top = "12px";
  btn.style.right = "auto";
  btn.style.bottom = "auto";
  btn.style.marginTop = "0";
  btn.style.zIndex = "999999";
  btn.style.pointerEvents = "auto";
  btn.style.visibility = "visible";
}

export function cleanupFbAlbumButtons(activeRoots: HTMLElement[]) {
  var roots = activeRoots || [];
  if (!roots.length) return;
  document
    .querySelectorAll<FbNode>(".eph_toolkit_fb_album_btn")
    .forEach(function (btn) {
      var owner: EphButton | null = null;
      for (var i = 0; i < roots.length; i++) {
        if (roots[i].contains(btn)) {
          owner = roots[i];
          break;
        }
      }
      if (!owner || owner.__ephAlbumButton !== btn) {
        try {
          btn.remove();
        } catch (e) {}
      }
    });
}

export function ensureFbAlbumButton(inputRoot: EphButton) {
  var root: EphButton | null = inputRoot;
  if (
    !root ||
    !root.querySelector ||
    location.href.toString().indexOf("stories") !== -1
  )
    return false;
  root = getFbAlbumPostRoot(root);
  if (!root) return false;
  var hasAlbum = hasFbAlbumSignal(root);
  var buttons = Array.from(
    root.querySelectorAll<FbNode>(".eph_toolkit_fb_album_btn"),
  );
  var existing =
    root.__ephAlbumButton && document.contains(root.__ephAlbumButton)
      ? root.__ephAlbumButton
      : buttons[0];
  if (!hasAlbum) {
    buttons.forEach(function (btn) {
      try {
        btn.remove();
      } catch (e) {}
    });
    root.__ephAlbumButton = null;
    return false;
  }
  buttons.forEach(function (btn) {
    if (btn !== existing) {
      try {
        btn.remove();
      } catch (e) {}
    }
  });
  var host = getFbAlbumButtonHost(root);
  if (!host || !host.appendChild) host = root;
  if (getComputedStyle(host).position === "static")
    host.style.position = "relative";
  if (existing) {
    existing.__ephAlbumRoot = root;
    root.__ephAlbumButton = existing;
    guardDownloadButtonEvents(existing);
    if (existing.parentElement !== host) host.appendChild(existing);
    positionFbAlbumButton(existing);
    return true;
  }
  var btn = document.createElement("div");
  btn.className = "eph_dowall eph_toolkit_fb_album_btn";
  btn.title = "Download album";
  btn.innerHTML =
    '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';
  btn.onclick = clickFbAlbumDownload as unknown as (ev: MouseEvent) => void;
  (btn as EphButton).__ephAlbumRoot = root;
  root.__ephAlbumButton = btn;
  guardDownloadButtonEvents(btn);
  host.appendChild(btn);
  positionFbAlbumButton(btn);
  return true;
}

export function addFacebookAlbumButtons() {
  if (location.href.toString().indexOf("stories") !== -1) return 0;
  var count = 0;
  var activeRoots: EphButton[] = [];
  var seenRoots: EphButton[] = [];
  function addRoot(root: EphButton) {
    var canonical = getFbAlbumPostRoot(root);
    if (!canonical || !canonical.querySelector) return;
    for (var i = 0; i < seenRoots.length; i++) {
      if (seenRoots[i] === canonical) return;
    }
    seenRoots.push(canonical);
    if (ensureFbAlbumButton(canonical)) {
      activeRoots.push(canonical);
      count++;
    }
  }
  document
    .querySelectorAll<FbNode>(
      'div[role="article"], div[role="dialog"], div[aria-modal="true"]',
    )
    .forEach(addRoot);
  document.querySelectorAll<FbNode>("img, video").forEach(function (media) {
    if (!isFbElementVisible(media, 120, 120)) return;
    var root = getFbMediaRoot(media);
    if (root && hasFbAlbumSignal(root)) addRoot(root);
  });
  cleanupFbAlbumButtons(activeRoots);
  return count;
}
