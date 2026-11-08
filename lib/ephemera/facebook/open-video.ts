import type { EphButton, FbNode } from './types';
import { closeFbMediaDialog, getActiveFbMediaDialog, getPrimaryFbDialogMedia } from './album';
import { getFbMediaRoot, getFbVideoIdNearElement, getPrimaryVisibleFbVideo, isFbElementVisible, isValidFbVideoId, parseFbVideoIdFromHref, ephSleep } from './dom-helpers';
import { getDirectFbVideoUrlFromElement, harvestFbVideoUrlsFromPerformance, isFbFullVideoDownloadUrl, resolveFbButtonVideo, waitForFbVideoUrl } from './url-harvest';

export function getFbVideoOpenElement(btn: EphButton, expectedId: string) {
  var video = resolveFbButtonVideo(btn) || (btn && btn.__ephVideoElement);
  var root = getFbMediaRoot(video || btn);
  var selectors = 'a[href*="/reel/"], a[href*="/watch"], a[href*="/videos/"]';
  var links =
    root && root.querySelectorAll
      ? Array.from(root.querySelectorAll<FbNode>(selectors))
      : [];
  if (expectedId) {
    for (var i = 0; i < links.length; i++) {
      if (
        parseFbVideoIdFromHref(links[i].href) === expectedId &&
        isFbElementVisible(links[i], 20, 20)
      ) {
        return links[i];
      }
    }
  }
  if (video) {
    var cur: EphButton | null = video;
    for (var depth = 0; cur && depth < 8; depth++, cur = cur.parentElement as EphButton | null) {
      if (
        cur.classList &&
        (cur.classList.contains("eph_toolkit_dl_btn") ||
          cur.classList.contains("eph_dowall"))
      )
        continue;
      if (
        cur.matches &&
        cur.matches(selectors) &&
        isFbElementVisible(cur, 20, 20)
      )
        return cur;
      if (
        cur.matches &&
        cur.matches('a[href], div[role="button"], [tabindex="0"]') &&
        isFbElementVisible(cur, 80, 80)
      )
        return cur;
      var innerLinks = cur.querySelectorAll
        ? Array.from(cur.querySelectorAll<FbNode>(selectors))
        : [];
      for (var j = 0; j < innerLinks.length; j++) {
        if (isFbElementVisible(innerLinks[j], 20, 20)) return innerLinks[j];
      }
    }
    return video;
  }
  if (expectedId) return null;
  return (
    links.find(function (link) {
      return isFbElementVisible(link, 20, 20);
    }) || null
  );
}

export async function getFbVideoUrlByOpening(btn: EphButton, expectedId: string) {
  if (!isValidFbVideoId(expectedId)) return null;
  var opener = getFbVideoOpenElement(btn, expectedId);
  var buttonVideo = resolveFbButtonVideo(btn);
  if (!opener && !buttonVideo) return null;
  var dialogBefore = getActiveFbMediaDialog();
  var hrefBefore = location.href;
  var startPerf = performance.now ? performance.now() : null;
  try {
    if (buttonVideo) clickFbVideoCenter(buttonVideo);
    else opener!.click();
  } catch (e) {
    try {
      if (opener) opener.click();
    } catch (_) {
      return null;
    }
  }
  for (var i = 0; i < 45; i++) {
    await ephSleep(120);
    var perfUrl = harvestFbVideoUrlsFromPerformance(startPerf, expectedId);
    if (perfUrl) {
      var perfDialog = getActiveFbMediaDialog();
      if (perfDialog && perfDialog !== dialogBefore)
        closeFbMediaDialog(perfDialog);
      return perfUrl;
    }
    var dialog = getActiveFbMediaDialog();
    if (dialog) {
      var item = getPrimaryFbDialogMedia(dialog);
      if (item && item.type === "video" && item.url) {
        if (expectedId && item.id && item.id !== expectedId) continue;
        if (dialog !== dialogBefore) closeFbMediaDialog(dialog);
        return item.url;
      }
    }
    var visibleVideo = getPrimaryVisibleFbVideo();
    if (visibleVideo) {
      var id = getFbVideoIdNearElement(visibleVideo) || expectedId || "";
      if (expectedId && id && id !== expectedId) continue;
      var url =
        getDirectFbVideoUrlFromElement(visibleVideo, id) ||
        harvestFbVideoUrlsFromPerformance(startPerf, id) ||
        "";
      if (
        url &&
        isFbFullVideoDownloadUrl(url) &&
        (location.href !== hrefBefore ||
          visibleVideo !== btn.__ephVideoElement)
      ) {
        return url;
      }
    }
  }
  if (opener && opener !== buttonVideo) {
    try {
      opener.click();
    } catch (e) {}
    var secondStartPerf = performance.now ? performance.now() : startPerf;
    var secondUrl = await waitForFbVideoUrl(
      btn,
      expectedId,
      secondStartPerf,
      3200,
    );
    if (secondUrl) return secondUrl;
  }
  var waitedUrl = await waitForFbVideoUrl(btn, expectedId, startPerf, 3200);
  if (waitedUrl) {
    var waitedDialog = getActiveFbMediaDialog();
    if (waitedDialog && waitedDialog !== dialogBefore)
      closeFbMediaDialog(waitedDialog);
    return waitedUrl;
  }
  var finalDialog = getActiveFbMediaDialog();
  if (finalDialog && finalDialog !== dialogBefore)
    closeFbMediaDialog(finalDialog);
  return null;
}

export function clickFbVideoCenter(video: HTMLVideoElement) {
  if (!video || !video.getBoundingClientRect) return false;
  try {
    var rect = video.getBoundingClientRect();
    var x = Math.max(1, Math.min(innerWidth - 2, rect.left + rect.width / 2));
    var y = Math.max(1, Math.min(innerHeight - 2, rect.top + rect.height / 2));
    var target = document.elementFromPoint(x, y) || video;
    var opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1,
    };
    ["pointerdown", "mousedown", "mouseup", "click"].forEach(function (type) {
      try {
        target.dispatchEvent(new MouseEvent(type, opts));
      } catch (e) {}
    });
    return true;
  } catch (e) {
    try {
      video.click();
      return true;
    } catch (_) {}
  }
  return false;
}
