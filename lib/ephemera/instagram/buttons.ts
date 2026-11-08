import type { DlButton } from './types';
import { setOnClick } from './dom';
import { codetopk, getIgCarouselIndexNearButton, getIgChannelNear, getShortcodeNear } from './shortcode';
import { buildIgFileBase, downloadimg, getstorybyusername } from './story-fetch';
import { downloadIgVideoSmart } from './video';
import { state } from './state';
import { ICON_LOADING } from '@/lib/ephemera/icon-urls';

export function getDownloadButtonIcon(btn: DlButton | null | undefined): HTMLElement | null | undefined {
  try {
    return btn && (btn.getElementsByClassName("eph_toolkit_icon")[0] as HTMLElement | undefined);
  } catch (e) {
    return null;
  }
}

export function markDownloadButtonBusy(btn: DlButton): void {
  var icon = getDownloadButtonIcon(btn);
  if (!icon) return;
  if (!icon.hasAttribute("data-eph-original-bg")) {
    icon.setAttribute(
      "data-eph-original-bg",
      icon.style.backgroundImage || "",
    );
  }
  icon.classList.add("eph_toolkit_loader");
  try {
    clearTimeout(btn.__ephRestoreTimer);
    btn.__ephRestoreTimer = setTimeout(function () {
      restoreDownloadButton(btn);
    }, 8000);
  } catch (e) {}
}

export function restoreDownloadButton(btn: DlButton): void {
  var icon = getDownloadButtonIcon(btn);
  if (!icon) return;
  icon.classList.remove("eph_toolkit_loader");
  if (icon.hasAttribute("data-eph-original-bg")) {
    icon.style.backgroundImage = icon.getAttribute("data-eph-original-bg") as string;
    icon.removeAttribute("data-eph-original-bg");
  } else {
    icon.style.backgroundImage = "";
  }
  try {
    clearTimeout(btn.__ephRestoreTimer);
  } catch (e) {}
}

// Tìm nút tải có media/khung chứa hiển thị nhiều nhất trong viewport (dùng cho nút Download trên toolbar).
export function ephFindMostVisibleIgDownloadButton(): DlButton | null {
  var best = null,
    bestArea = 0;
  var vh = window.innerHeight || document.documentElement.clientHeight;
  var vw = window.innerWidth || document.documentElement.clientWidth;
  document.querySelectorAll<HTMLElement>(".eph_toolkit_dl_btn").forEach(function (btn) {
    var anchor: Element =
      (btn as DlButton).__ephVideoElement && document.contains((btn as DlButton).__ephVideoElement as Node)
        ? ((btn as DlButton).__ephVideoElement as HTMLVideoElement)
        : btn.parentElement || btn;
    var r: DOMRect;
    try {
      r = anchor.getBoundingClientRect();
    } catch (e) {
      return;
    }
    var w = Math.min(r.right, vw) - Math.max(r.left, 0);
    var h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (w <= 0 || h <= 0) return;
    var area = w * h;
    if (area > bestArea) {
      bestArea = area;
      best = btn;
    }
  });
  return best;
}

// Track hovered elements to determine which element is being interacted with

// Story download button click handler
export function ephIsWindowsClient(): boolean {
  try {
    var uaPlatform =
      navigator.userAgentData && navigator.userAgentData.platform;
    return /win/i.test(
      [uaPlatform, navigator.platform, navigator.userAgent].join(" "),
    );
  } catch (e) {
    return false;
  }
}

export function clickbuttondow1(this: HTMLElement, e?: Event | null): void {
  if (e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (_) {}
  }
  // Khóa chống kích hoạt lặp: mỗi lần ấn chỉ tải 1 lần (story hiện tại đang xem)
  if (window.__ephStoryDlBusy) return;
  window.__ephStoryDlBusy = true;
  setTimeout(function () {
    window.__ephStoryDlBusy = false;
  }, 2000);
  state.elemntdata = this;
  // Chạy đúng luồng toolbar đang hoạt động trên mọi nền tảng (Windows & macOS):
  // nhờ background tiêm instagram-video.js (MAIN) + instagram.js
  // (instagram.js đã tự xử lý Windows qua ephDownloadWindowsStory)
  try {
    chrome.runtime.sendMessage({ runStoryDownload: true });
  } catch (e) {
    // fallback: đường API cũ
    const usernameMatch = location.pathname.match(/\/stories\/.*?(?=\/)/g);
    if (usernameMatch && usernameMatch.length > 0) {
      getstorybyusername(usernameMatch[0].split("/")[2]);
    }
  }
}
// Add download buttons to stories
export function addbutndow(): void {
  if (location.pathname.indexOf("/stories/") === -1) return;
  // Find the main section element
  const section = Array.from(document.querySelectorAll("section")).find(
    (t) => !t.closest("[hidden]"),
  );
  if (!section) return;

  // Find story container
  let storyContainer = Array.from(section.querySelectorAll("div")).find(
    (tx) => {
      let n = tx.clientHeight || tx.offsetHeight;
      if (n > 0 && n < 6) {
        return tx.parentElement;
      }
    },
  );

  if (!storyContainer || !storyContainer.children) return;

  // Count stories
  const storyCount = storyContainer.children.length;
  if (storyCount === 0) return;

  // Find the current story index
  let currentStoryIndex = 0;
  const allDivs = storyContainer.children;

  for (let i = 0; i < allDivs.length; i++) {
    const currentDiv = allDivs[i];
    if (currentDiv.tagName === "DIV") {
      const nestedDivs = currentDiv.getElementsByTagName("div");
      if (nestedDivs.length > 0) {
        currentStoryIndex = i;
        break;
      }
    }
  }

  state.countclick = currentStoryIndex;

  // Find the container to add the download button
  const container = allDivs[currentStoryIndex].parentElement!.parentElement!;

  // Add download button if not already present
  if (!container.getAttribute("toolin")) {
    // Add download button
    const downloadBtn = document.createElement("div");
    setOnClick(downloadBtn, clickbuttondow1);
    downloadBtn.className = "eph_toolkit_dl_btn";
    downloadBtn.innerHTML =
      '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';
    container.appendChild(downloadBtn);

    // Mark as processed
    container.setAttribute("toolin", "1");
  } else {
    Array.from(container.querySelectorAll<HTMLElement>(".eph_dowall")).forEach(
      function (btn) {
        btn.remove();
      },
    );
  }
}

// Lấy media đang hiển thị trong bài: ảnh trả URL .jpg thật từ DOM, video báo type để đi đường API lấy .mp4
export function getCurrentPostMedia(btn: DlButton) {
  try {
    var root =
      btn.closest("article") ||
      btn.closest('div[role="dialog"]') ||
      btn.closest('div[role="button"]') ||
      document.body;
    // 1) Có video đang hiển thị? (src là blob -> phải dùng API để lấy .mp4)
    var vids = root.querySelectorAll("video");
    for (var i = 0; i < vids.length; i++) {
      if (vids[i].offsetParent !== null && vids[i].offsetHeight > 100) {
        return { type: "video" };
      }
    }
    // 2) Ảnh nội dung lớn nhất, gần tâm ngang nhất = slide đang xem
    var rect = root.getBoundingClientRect();
    var centerX = rect.left + rect.width / 2;
    var imgs = root.querySelectorAll("img");
    var best = null,
      bestDist = Infinity;
    for (var k = 0; k < imgs.length; k++) {
      var im = imgs[k];
      if (im.offsetParent === null) continue;
      if (im.offsetWidth < 200 || im.offsetHeight < 200) continue;
      var src = im.currentSrc || im.src || "";
      if (!/fbcdn\.net|cdninstagram\.com/.test(src) && !(im.srcset || ""))
        continue;
      var rr = im.getBoundingClientRect();
      var d = Math.abs(rr.left + rr.width / 2 - centerX);
      if (d < bestDist) {
        bestDist = d;
        best = im;
      }
    }
    if (best) {
      var url = "";
      if (best.srcset) {
        var parts = best.srcset.split(",").map(function (x) {
          return x.trim();
        });
        url = parts[parts.length - 1].split(" ")[0];
      }
      if (!url) url = best.currentSrc || best.src;
      if (url) return { type: "image", url: url };
    }
  } catch (e) {}
  return null;
}

// Post download button click handler
export function clickbuttondow(this: HTMLElement, e?: Event | null): void {
  if (e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (_) {}
  }
  state.elemntdata = this;
  markDownloadButtonBusy(this);
  requestAnimationFrame(() => {
    (state.elemntdata!.getElementsByClassName(
      "eph_toolkit_icon",
    )[0] as HTMLElement).style.backgroundImage =
      ICON_LOADING;
  });
  setTimeout(() => {
    let carouselIndex = null;

    // Check if this is part of a carousel and get the index
    if (
      this.className == "eph_toolkit_dl_btn" &&
      !this.getAttribute("data-ig-grid")
    ) {
      // ƯU TIÊN: tải thẳng media đang hiển thị (ảnh -> URL .jpg trực tiếp; video -> đi tiếp đường API .mp4)
      var _cur = getCurrentPostMedia(this);
      if (_cur && _cur.type === "image" && _cur.url) {
        var imageCode = getShortcodeNear(this) || "post";
        var imageChannel = getIgChannelNear(this);
        var imageIndex = getIgCarouselIndexNearButton(this);
        var imageOrder = imageIndex !== null ? imageIndex + 1 : 1;
        chrome.runtime.sendMessage(
          {
            downloadv1: _cur.url,
            idx: "instagram",
            url: location.href,
            platform: "ig",
            channel: imageChannel,
            shortcode: imageCode,
            order: imageOrder,
            mediaType: "image",
            filename: buildIgFileBase(
              imageChannel,
              imageCode,
              imageOrder,
              "image",
            ),
          },
          function () {},
        );
        return;
      }
      if (_cur && _cur.type === "video") {
        // tải đúng video đang hiển thị (kể cả 1 slide video trong carousel)
        try {
          downloadIgVideoSmart(this);
          return;
        } catch (e) {}
      }
      try {
        // Find carousel indicator
        let mxdoc;
        try {
          mxdoc = this.closest('div[role*="button"]')!
            .getElementsByClassName(" _acvz _acnc _acng")[0]
            .getElementsByTagName("div");
        } catch (ex) {
          mxdoc = this.closest('article[role*="presentation"]')!
            .getElementsByClassName(" _acvz _acnc _acng")[0]
            .getElementsByTagName("div");
        }

        // Find current carousel index
        for (let i = 0; i < mxdoc.length; i++) {
          if (mxdoc[i].classList.length == 2) {
            carouselIndex = i;
            break;
          }
        }
      } catch (ex) {
        // Not a carousel or error finding index
      }
    }

    // Get post ID and download media
    let postId = this.id;
    if (!postId) {
      // Try to extract from closest link (post / reel / tv)
      const linkElement = this.closest(
        'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
      );
      if (linkElement) {
        const match = (linkElement as HTMLAnchorElement).href.match(
          /\/(?:p|reel|reels|tv)\/([^\/?#]+)/,
        );
        if (match && match[1]) {
          postId = match[1];
        }
      }
    }
    if (!postId) {
      const locMatch = location.pathname.match(
        /\/(?:p|reel|reels|tv)\/([^\/?#]+)/,
      );
      if (locMatch && locMatch[1]) {
        postId = locMatch[1];
      }
    }

    if (postId) {
      const mediaId = codetopk(postId);
      if (mediaId) {
        downloadimg(mediaId, carouselIndex);
      }
    }
  }, 10);
}

