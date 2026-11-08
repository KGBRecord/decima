import type { DlButton } from './types';
import { setOnClick } from './dom';
import { clickbuttondow, ephIsWindowsClient } from './buttons';
import { findIgShortcodeInRoot, parseIgShortcodeFromHref } from './shortcode';

export function isIgProfileGridPage() {
  return /instagram\.com\/(?!p\/|reel\/|reels\/|tv\/|stories\/|explore\/)[^\/]+\/?$/.test(
    location.href,
  );
}

export function isLikelyIgPostImage(img: HTMLImageElement): boolean {
  if (!img || img.tagName !== "IMG") return false;
  if (location.pathname.indexOf("/stories/") !== -1) return false;
  if (img.offsetParent === null) return false;
  var imgRect = img.getBoundingClientRect();
  if (
    imgRect.bottom <= 0 ||
    imgRect.top >= innerHeight ||
    imgRect.right <= 0 ||
    imgRect.left >= innerWidth
  )
    return false;
  var w = imgRect.width || img.offsetWidth || img.width || 0;
  var h = imgRect.height || img.offsetHeight || img.height || 0;
  if (w < 180 || h < 180) return false;
  var src =
    img.currentSrc ||
    img.src ||
    img.getAttribute("src") ||
    img.getAttribute("srcset") ||
    "";
  if (src && !/cdninstagram\.com|fbcdn\.net/.test(src)) return false;
  var hasDialog = !!img.closest('div[role="dialog"]');
  if (isIgProfileGridPage() && !hasDialog) return false;
  return !!(
    hasDialog ||
    img.closest("article") ||
    img.closest(
      'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
    )
  );
}

export function isLikelyIgCarouselRoot(root: Element | null | undefined): boolean {
  try {
    if (!root || !root.querySelector) return false;
    if (root.querySelector("video")) return true;
    if (root.querySelector<HTMLElement>('a[href*="img_index="]')) return true;
    var controls = root.querySelectorAll<HTMLElement>("[aria-label]");
    for (var i = 0; i < controls.length; i++) {
      var label = (controls[i].getAttribute("aria-label") || "").toLowerCase();
      if (
        /next|previous|go to slide|slide|tiếp|trước|ảnh tiếp|ảnh trước/.test(
          label,
        )
      )
        return true;
    }
  } catch (e) {}
  return false;
}

export function getIgImageButtonHost(img: HTMLImageElement) {
  try {
    var root =
      img.closest('div[role="dialog"]') ||
      img.closest("article") ||
      document.body;
    var host = img.closest('div[role*="presentation"], div[role*="button"]');
    if (!host) {
      host = img.parentElement;
      if (host && host.tagName === "PICTURE") host = host.parentElement;
    }
    var imgRect = img.getBoundingClientRect();
    var cur = host;
    while (
      cur &&
      cur.parentElement &&
      cur.parentElement !== root &&
      cur.parentElement !== document.body
    ) {
      var rect = cur.getBoundingClientRect();
      if (
        rect.width >= imgRect.width * 0.95 &&
        rect.height >= imgRect.height * 0.95
      ) {
        host = cur;
        cur = cur.parentElement;
        continue;
      }
      break;
    }
    return host || img.parentElement;
  } catch (e) {
    return img && img.parentElement;
  }
}

export function hasIgDownloadButtonForShortcode(root: ParentNode | null | undefined, shortcode: string): boolean {
  try {
    var buttons = (root || document).querySelectorAll<HTMLElement>(
      ".eph_toolkit_dl_btn[data-ig-shortcode]",
    );
    for (var i = 0; i < buttons.length; i++) {
      if (
        buttons[i].getAttribute("data-ig-shortcode") === shortcode &&
        !buttons[i].getAttribute("data-ig-grid")
      )
        return true;
    }
  } catch (e) {}
  return false;
}

export function ensureIgSingleImageDownloadButton(img: HTMLImageElement): boolean {
  try {
    if (!isLikelyIgPostImage(img)) return false;
    var root =
      img.closest('div[role="dialog"]') ||
      img.closest("article") ||
      img.closest(
        'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
      );
    if (isLikelyIgCarouselRoot(root)) return false;
    var link = img.closest(
      'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
    );
    var postId =
      findIgShortcodeInRoot(root) ||
      parseIgShortcodeFromHref(
        link && ((link as HTMLAnchorElement).href || link.getAttribute("href")),
      ) ||
      parseIgShortcodeFromHref(location.href);
    if (!postId) return false;
    if (hasIgDownloadButtonForShortcode(root || document, postId)) return true;

    var host = getIgImageButtonHost(img);
    if (!host) return false;
    if (
      host.querySelector &&
      host.querySelector<HTMLElement>('.eph_toolkit_dl_btn[data-ig-single-image="1"]')
    )
      return true;

    var downloadBtn = document.createElement("div");
    downloadBtn.id = postId;
    setOnClick(downloadBtn, clickbuttondow);
    downloadBtn.onmousedown = function (ev) {
      try {
        ev.preventDefault();
        ev.stopPropagation();
      } catch (_) {}
    };
    downloadBtn.className = "eph_toolkit_dl_btn";
    downloadBtn.setAttribute("data-ig-shortcode", postId);
    downloadBtn.setAttribute("data-ig-single-image", "1");
    downloadBtn.innerHTML =
      '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';
    if (getComputedStyle(host).position === "static")
      (host as HTMLElement).style.position = "relative";
    host.appendChild(downloadBtn);
    host.setAttribute("toolin", "1");
    return true;
  } catch (e) {
    return false;
  }
}

export function getIgGridButtonHost(linkElement: HTMLElement) {
  try {
    if (!linkElement) return null;
    if (location.pathname.indexOf("/explore") === 0) return linkElement;
    var media = linkElement.querySelector<HTMLElement>("img, video");
    var mediaRect = media
      ? media.getBoundingClientRect()
      : linkElement.getBoundingClientRect();
    var host = linkElement;
    var cur = linkElement;
    while (cur && cur.parentElement && cur.parentElement !== document.body) {
      var rect = cur.getBoundingClientRect();
      if (!rect.width || !rect.height) break;
      var closeToMedia =
        !mediaRect.width ||
        (rect.width <= mediaRect.width * 1.45 &&
          rect.height <= mediaRect.height * 1.45 &&
          rect.width >= mediaRect.width * 0.8 &&
          rect.height >= mediaRect.height * 0.8);
      if (!closeToMedia) break;
      host = cur;
      cur = cur.parentElement;
    }
    return host;
  } catch (e) {
    return linkElement;
  }
}

export function isVisibleIgExploreLink(linkElement: HTMLElement): boolean {
  try {
    if (!linkElement || linkElement.offsetParent === null) return false;
    if (
      linkElement.closest(
        'nav, header, div[role="dialog"], div[aria-modal="true"]',
      )
    )
      return false;
    var code = parseIgShortcodeFromHref(
      (linkElement as HTMLAnchorElement).href || linkElement.getAttribute("href"),
    );
    if (!code) return false;
    var rect = linkElement.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80) return false;
    if (rect.top < 70 && rect.left < 220) return false;
    if (
      rect.bottom <= 0 ||
      rect.top >= innerHeight + 400 ||
      rect.right <= 0 ||
      rect.left >= innerWidth
    )
      return false;
    var media = linkElement.querySelector<HTMLElement>("img, video");
    if (!media) return false;
    var mediaRect = media.getBoundingClientRect();
    if (mediaRect.width < 80 || mediaRect.height < 80) return false;
    return true;
  } catch (e) {
    return false;
  }
}

export function placeIgGridDownloadButton(linkElement: HTMLElement, postId: string): boolean {
  try {
    if (!linkElement || !postId) return false;
    var host = getIgGridButtonHost(linkElement);
    if (!host) return false;
    var existing = host.querySelector<HTMLElement>(
      '.eph_toolkit_dl_btn[data-ig-grid="1"]',
    );
    if (existing) {
      existing.id = postId;
      existing.setAttribute("data-ig-shortcode", postId);
      return true;
    }
    const downloadBtn = document.createElement("div");
    downloadBtn.id = postId;
    setOnClick(downloadBtn, clickbuttondow);
    downloadBtn.onmousedown = function (ev) {
      try {
        ev.preventDefault();
        ev.stopPropagation();
      } catch (_) {}
    };
    downloadBtn.className = "eph_toolkit_dl_btn";
    downloadBtn.setAttribute("data-ig-grid", "1");
    downloadBtn.setAttribute("data-ig-shortcode", postId);
    downloadBtn.style.position = "absolute";
    downloadBtn.style.top = "10px";
    downloadBtn.style.left = "10px";
    downloadBtn.style.zIndex = "20";
    downloadBtn.innerHTML =
      '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';
    if (getComputedStyle(host).position === "static")
      host.style.position = "relative";
    host.appendChild(downloadBtn);
    host.setAttribute("toolin", "1");
    return true;
  } catch (e) {
    return false;
  }
}

export function addExploreDownloadButtons() {
  try {
    if (location.pathname.indexOf("/explore") !== 0) return;
    var links = document.querySelectorAll<HTMLElement>(
      'main a[href*="/p/"], main a[href*="/reel/"], main a[href*="/reels/"], main a[href*="/tv/"]',
    );
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (!isVisibleIgExploreLink(link)) continue;
      var postId = parseIgShortcodeFromHref(
        (link as HTMLAnchorElement).href || link.getAttribute("href"),
      );
      placeIgGridDownloadButton(link, postId);
    }
  } catch (e) {}
}

export function isIgLogoZoneDownloadButton(btn: HTMLElement): boolean {
  try {
    if (!btn || !document.contains(btn)) return false;
    if (btn.closest('article, div[role="dialog"], div[aria-modal="true"]'))
      return false;

    var mediaLink = btn.closest(
      'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
    );
    if (mediaLink && isVisibleIgExploreLink(mediaLink as HTMLElement)) return false;

    var rect = btn.getBoundingClientRect();
    var nearDesktopLogo = rect.top < 150 && rect.left < 290;
    var nearMobileLogo = innerWidth < 760 && rect.top < 95 && rect.left < 190;
    if (!nearDesktopLogo && !nearMobileLogo) return false;

    if (btn.closest('nav, header, [role="navigation"]')) return true;
    if (!mediaLink && !btn.querySelector<HTMLElement>("img, video")) return true;
    return false;
  } catch (e) {
    return false;
  }
}

export function isIgButtonAttachedToMedia(btn: HTMLElement): boolean {
  try {
    if (!btn || !document.contains(btn)) return false;
    if (location.pathname.indexOf("/stories/") !== -1) return true;
    if ((btn as DlButton).__ephVideoElement && document.contains((btn as DlButton).__ephVideoElement as Node))
      return true;
    if (
      btn.getAttribute("data-ig-windows-floating") === "1" &&
      ephIsWindowsClient()
    )
      return true;
    if (isIgLogoZoneDownloadButton(btn)) return false;
    var hasMediaId =
      btn.getAttribute("data-ig-shortcode") ||
      btn.getAttribute("data-ig-grid") ||
      btn.getAttribute("data-ig-single-image");
    if (
      !hasMediaId &&
      !btn.closest("article") &&
      !btn.closest('div[role="dialog"]') &&
      !btn.closest(
        'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
      )
    )
      return false;
    var parent = btn.parentElement;
    if (!parent) return false;
    if (location.pathname.indexOf("/explore") === 0) {
      var gridLink =
        btn.closest(
          'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
        ) ||
        (parent.matches &&
        parent.matches(
          'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
        )
          ? parent
          : null) ||
        (parent.querySelector &&
          parent.querySelector<HTMLElement>(
            'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
          ));
      var btnRect = btn.getBoundingClientRect();
      if (
        btnRect.top < 120 &&
        btnRect.left < 260 &&
        !(
          btn.closest("article") ||
          btn.closest('div[role="dialog"]') ||
          btn.closest('div[aria-modal="true"]')
        )
      )
        return false;
      if (gridLink) return isVisibleIgExploreLink(gridLink as HTMLElement);
      if (
        btn.closest("article") ||
        btn.closest('div[role="dialog"]') ||
        btn.closest('div[aria-modal="true"]')
      )
        return true;
      return false;
    }
    if (
      parent.matches &&
      parent.matches(
        'article, div[role="dialog"], a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
      )
    )
      return true;
    if (
      parent.querySelector &&
      parent.querySelector<HTMLElement>(
        'img, video, a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
      )
    )
      return true;
    if (btn.closest("article") || btn.closest('div[role="dialog"]'))
      return true;
  } catch (e) {}
  return false;
}

export function cleanupIgDownloadButtons() {
  try {
    if (location.hostname.indexOf("instagram.com") === -1) return;
    document.querySelectorAll<HTMLElement>(".eph_toolkit_dl_btn").forEach(function (btn) {
      if (!isIgButtonAttachedToMedia(btn)) btn.remove();
    });
  } catch (e) {}
}

export function addSingleImageDownloadButtons() {
  try {
    if (location.pathname.indexOf("/stories/") !== -1) return;
    if (location.pathname.indexOf("/explore") === 0) return;
    var imgs = document.querySelectorAll<HTMLElement>(
      'article img, div[role="dialog"] img, a[href*="/p/"] img',
    );
    for (var i = 0; i < imgs.length; i++) {
      ensureIgSingleImageDownloadButton(imgs[i] as HTMLImageElement);
    }
  } catch (e) {}
}

// Add download buttons to posts
// Add download buttons to posts
export function callpush(element: Element): void {
  const firstLinkElement =
    element &&
    element.closest &&
    element.closest(
      'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
    );
  const firstPostId = firstLinkElement
    ? parseIgShortcodeFromHref(
        (firstLinkElement as HTMLAnchorElement).href || firstLinkElement.getAttribute("href"),
      )
    : "";
  if (
    firstPostId &&
    (location.pathname.indexOf("/explore") === 0 ||
      (isIgProfileGridPage() && !element.closest("article")))
  ) {
    placeIgGridDownloadButton(firstLinkElement as HTMLElement, firstPostId);
    return;
  }

  if (
    element &&
    element.tagName === "IMG" &&
    ensureIgSingleImageDownloadButton(element as HTMLImageElement)
  )
    return;

  // Skip if element is too small
  if (
    element.tagName === "IMG" &&
    ((element as HTMLImageElement).width < 300 || (element as HTMLImageElement).height < 300)
  ) {
    // Still check if it's within a post link
    const linkElement = element.closest(
      'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
    );
    const postId = linkElement
      ? parseIgShortcodeFromHref(
          (linkElement as HTMLAnchorElement).href || linkElement.getAttribute("href"),
        )
      : "";
    if (postId) {
      // Add download button if not already added
      placeIgGridDownloadButton(linkElement as HTMLElement, postId);
    }
    return;
  }

  // Check for posts on profile pages
  const isProfilePage =
    /instagram\.com\/(?!p\/|stories\/|explore\/)[^\/]+\/?$/.test(location.href);

  if (isProfilePage) {
    // On profile pages, posts are typically in a grid layout
    const postContainer =
      element.closest("article") ||
      element.closest('div[role="button"]') ||
      element.closest(
        'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
      );

    if (postContainer) {
      // Find the post link to extract shortcode
      const postLink =
        postContainer.querySelector<HTMLElement>(
          'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
        ) || (postContainer.tagName === "A" ? postContainer : null);

      if (postLink && (postLink as HTMLAnchorElement).href) {
        const match = (postLink as HTMLAnchorElement).href.match(/\/(?:p|reel|reels|tv)\/([^\/]+)/);
        if (match && match[1]) {
          const postId = match[1];

          // Check if button already exists
          if (!postContainer.getAttribute("toolin")) {
            // Create button container if needed
            let buttonContainer = postContainer;

            // For grid items, position the button at the right spot
            if (
              postContainer.tagName === "A" ||
              postContainer.tagName === "DIV"
            ) {
              buttonContainer = postContainer;
            }

            // Add download button
            const downloadBtn = document.createElement("div");
            downloadBtn.id = postId;
            setOnClick(downloadBtn, clickbuttondow);
            downloadBtn.className = "eph_toolkit_dl_btn";
            downloadBtn.setAttribute("data-ig-grid", "1");
            downloadBtn.innerHTML =
              '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';

            // Position the button
            downloadBtn.style.position = "absolute";
            downloadBtn.style.top = "10px";

            downloadBtn.style.zIndex = "10";

            // Make sure container has relative positioning for absolute positioning to work
            if (getComputedStyle(buttonContainer).position === "static") {
              buttonContainer.style.position = "relative";
            }

            buttonContainer.appendChild(downloadBtn);
            buttonContainer.setAttribute("toolin", "1");
          }
        }
      }
    }
  } else {
    // For non-profile pages, use the default logic
    // Find post ID
    let postId = "";
    const pathMatch = location.pathname.match(
      /\/(?:p|reel|reels|tv)\/.*?(?=\/)|explore/g,
    );

    if (!pathMatch) {
      // Regular feed post
      const article = element.closest("article");
      if (article) {
        const links = article.querySelectorAll<HTMLElement>('a[href^="/p/"]');
        if (links.length > 0) {
          postId = (links[0] as HTMLAnchorElement).href.split("/")[4];
        }
      }
    } else if (pathMatch[0] === "explore") {
      // Explore page
      const linkElement = element.closest(
        'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
      );
      if (linkElement) {
        postId = parseIgShortcodeFromHref(
          (linkElement as HTMLAnchorElement).href || linkElement.getAttribute("href"),
        );

        // Add download button
        placeIgGridDownloadButton(linkElement as HTMLElement, postId);
      }
      return;
    } else {
      // Single post page
      postId = pathMatch[0].split("/")[2];
    }

    // Find the container to add the download button
    try {
      const container =
        element.closest('div[role*="presentation"]') ||
        element.closest('div[role*="button"]');

      if (container) {
        (container as HTMLElement).dataset.ig_toolkit_marked = "1";

        // Add buttons if not already added
        const parentContainer = container.parentElement!.parentElement!;
        if (postId && !parentContainer.getAttribute("toolin")) {
          // Add download button
          const downloadBtn = document.createElement("div");
          downloadBtn.id = postId;
          setOnClick(downloadBtn, clickbuttondow);
          downloadBtn.className = "eph_toolkit_dl_btn";
          downloadBtn.innerHTML =
            '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';
          parentContainer.appendChild(downloadBtn);

          // Add download all button for carousel
          const downloadAllBtn = document.createElement("div");
          downloadAllBtn.id = postId;
          setOnClick(downloadAllBtn, clickbuttondow);
          downloadAllBtn.className = "eph_dowall";
          downloadAllBtn.innerHTML =
            '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';
          parentContainer.appendChild(downloadAllBtn);

          // Mark as processed
          parentContainer.setAttribute("toolin", "1");
        }
      }
    } catch (ex) {
      // Try alternative approach for other layouts
      const linkElement = element.closest(
        'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]',
      );
      if (linkElement) {
        const postId = parseIgShortcodeFromHref(
          (linkElement as HTMLAnchorElement).href || linkElement.getAttribute("href"),
        );

        placeIgGridDownloadButton(linkElement as HTMLElement, postId);
      }
    }
  }
}
// Initial scan for posts
export function addbutton() {
  const mediaSelectors = [
    "article img:not([data-ig_toolkit_marked])",
    "article video:not([data-ig_toolkit_marked])",
    'div[role*="button"] video:not([data-ig_toolkit_marked])',
    'div[role*="button"] img:not([data-ig_toolkit_marked])',
    // Bỏ selector 'img' trần: nó quét TẤT CẢ ảnh (kể cả avatar, icon...) mỗi lần chạy -> lag.
    // Ảnh trong grid/profile được phủ bởi các selector dưới đây:
    'a[href*="/p/"] img:not([data-ig_toolkit_marked])',
    'a[href*="/reel/"] img:not([data-ig_toolkit_marked])',
  ];

  document
    .querySelectorAll<HTMLElement>(mediaSelectors.join(","))
    .forEach(function (element) {
      callpush(element);
    });
  try {
    addExploreDownloadButtons();
  } catch (e) {}
  try {
    addSingleImageDownloadButtons();
  } catch (e) {}
  try {
    cleanupIgDownloadButtons();
  } catch (e) {}
}

