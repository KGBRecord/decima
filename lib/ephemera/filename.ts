import type { EphemeraMessage } from './types';

export function ephSafeFilenamePart(value?: unknown, fallback?: unknown): string {
  const text = String(value || fallback || "media")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
  return text || String(fallback || "media");
}

export function ephExtFromUrl(url: unknown, fallback: string): string {
  if (fallback === "mp4") return "mp4";
  if (fallback === "jpg") {
    try {
      const raw = String(url || "");
      if (
        /\.(?:mp4|m4v)(?:[?#]|$)/i.test(raw) ||
        /video\.[^\/]+fbcdn\.net/i.test(raw)
      )
        return "mp4";
    } catch (e) {}
  }
  try {
    const clean = String(url || "")
      .split("?")[0]
      .split("#")[0];
    const ext = clean.split(".").pop() as string;
    if (/^(?:jpg|jpeg|png|webp|gif)$/i.test(ext)) return ext.toLowerCase();
    if (/^(?:mp4|m4v)$/i.test(ext)) return "mp4";
  } catch (e) {}
  return fallback || "jpg";
}

export function ephBuildMediaFilename(message: EphemeraMessage, ext: string): string {
  if (message.filename)
    return (
      ephSafeFilenamePart(message.filename).replace(
        /\.[a-z0-9]{2,5}$/i,
        "",
      ) +
      "." +
      ext
    );
  const platform = ephSafeFilenamePart(
    message.platform || message.source || "media",
  );
  const channel = ephSafeFilenamePart(
    message.channel || message.user || "unknown",
  );
  const post = ephSafeFilenamePart(
    message.postId || message.shortcode || message.idx || "post",
  );
  const order =
    message.order != null ? String(message.order).padStart(3, "0") : "001";
  const type = ephSafeFilenamePart(
    message.mediaType || (ext === "mp4" ? "video" : "image"),
  );
  return [platform, channel, post, order, type].join("_") + "." + ext;
}

export function ephNormalizeDownloadUrl(url: unknown): string {
  return String(url || "")
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/\\\//g, "/")
    .trim();
}

export function ephNormalizeVideoDownloadUrl(rawUrl: unknown): string {
  const url = ephNormalizeDownloadUrl(rawUrl);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    ["bytestart", "byteend", "range"].forEach(function (key) {
      parsed.searchParams.delete(key);
    });
    return parsed.toString();
  } catch (e) {
    return url
      .replace(/([?&])(?:bytestart|byteend|range)=[^&]+/gi, "$1")
      .replace(/[?&]+$/, "");
  }
}

export function ephIsVideoMessage(message: EphemeraMessage): boolean {
  const url = String(message.downloadv1 || "");
  return (
    message.mediaType === "video" ||
    /\.(?:mp4|m4v)(?:[?#]|$)/i.test(url) ||
    /video\.[^\/]+fbcdn\.net/i.test(url)
  );
}

interface NavigatorWithUAData extends Navigator {
  userAgentData?: { platform?: string };
}

export function ephIsWindowsRuntime(): boolean {
  try {
    const uaPlatform =
      (navigator as NavigatorWithUAData).userAgentData &&
      (navigator as NavigatorWithUAData).userAgentData!.platform;
    return /win/i.test(
      [uaPlatform, navigator.platform, navigator.userAgent].join(" "),
    );
  } catch (e) {
    return false;
  }
}

export function ephIsInstagramDownloadMessage(message: EphemeraMessage): boolean {
  const url = String(message.downloadv1 || "");
  const pageUrl = String(message.url || "");
  const platform = String(message.platform || "");
  return (
    platform === "ig" ||
    /(?:^|\/\/)(?:[^\/]+\.)?(?:instagram\.com|cdninstagram\.com)\//i.test(
      url,
    ) ||
    /instagram\.com/i.test(pageUrl)
  );
}
