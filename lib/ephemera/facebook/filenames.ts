import type { EphButton, FbNode } from './types';
import { isValidFbVideoId, parseFbVideoIdFromHref } from './dom-helpers';
import { isFbFullVideoDownloadUrl, normalizeFbVideoDownloadUrl } from './url-harvest';

export function fbNamePart(value: unknown, fallback?: string) {
  return (
    String(value || fallback || "unknown")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_{2,}/g, "_") || String(fallback || "unknown")
  );
}

export function getFbChannelName(rootArg: EphButton | null) {
  try {
    var root: ParentNode = rootArg || document;
    var links = root.querySelectorAll<FbNode>('h2 a, h3 a, strong a, a[role="link"]');
    for (var i = 0; i < links.length; i++) {
      var text = (links[i].innerText || links[i].textContent || "").trim();
      var href = links[i].href || "";
      if (text.length < 2 || text.length > 80) continue;
      if (
        /photo|watch|videos|reel|comment|share|reaction|privacy|ufi|hashtag/i.test(
          href,
        )
      )
        continue;
      if (/^(Like|Comment|Share|Thich|Binh luan|Chia se)$/i.test(text))
        continue;
      return fbNamePart(text, "channel");
    }
  } catch (e) {}
  return "unknown_channel";
}

export function getFbPostIdForRoot(rootArg: EphButton | null, fallback: string) {
  if (fallback) return fbNamePart(fallback, "post");
  try {
    var root: ParentNode = rootArg || document;
    var links = root.querySelectorAll<FbNode>("a[href]");
    for (var i = 0; i < links.length; i++) {
      var href = links[i].href || "";
      var id = parseFbVideoIdFromHref(href);
      if (id) return id;
      var m =
        href.match(/[?&](?:story_fbid|fbid|multi_permalinks)=([0-9]+)/) ||
        href.match(/\/posts\/([0-9]+)/) ||
        href.match(/\/permalink\/([0-9]+)/);
      if (m && m[1]) return m[1];
    }
  } catch (e) {}
  return fbNamePart(location.pathname.replace(/\//g, "_") || "post", "post");
}

export function buildFbFileBase(root: EphButton | null, postId: string, order: number, type: string) {
  var channel = getFbChannelName(root);
  var post = getFbPostIdForRoot(root, postId);
  var seq = String(order || 1).padStart(3, "0");
  return ["fb", channel, post, seq, type || "media"]
    .map(function (x) {
      return fbNamePart(x);
    })
    .join("_");
}

export function sendFbVideoDownload(url: string, idx: string, root: EphButton | null, postId: string, filename: string) {
  url = normalizeFbVideoDownloadUrl(url || "");
  var strictId = postId || idx || "";
  if (!isValidFbVideoId(strictId)) return false;
  if (!url || !isFbFullVideoDownloadUrl(url)) return false;
  chrome.runtime.sendMessage(
    {
      downloadv1: url,
      idx: strictId,
      url: location.href,
      platform: "fb",
      channel: getFbChannelName(root),
      postId: getFbPostIdForRoot(root, strictId),
      order: 1,
      mediaType: "video",
      filename: filename || buildFbFileBase(root, strictId, 1, "video"),
    },
    function () {},
  );
  return true;
}
