import type { DownloadResult, EphemeraMessage } from './types';
import {
  ephIsInstagramDownloadMessage,
  ephIsVideoMessage,
  ephIsWindowsRuntime,
  ephNormalizeDownloadUrl,
  ephNormalizeVideoDownloadUrl,
} from './filename';

export function ephDownloadDirect(url: string, filename: string): Promise<DownloadResult> {
  return new Promise(function (resolve) {
    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: false,
      },
      function (downloadId) {
        const err = chrome.runtime.lastError;
        resolve({ ok: !err && !!downloadId, error: err && err.message });
      },
    );
  });
}

export function ephBlobToDataUrl(blob: Blob): Promise<string> {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onloadend = function () {
      // readAsDataURL always yields a string
      resolve(reader.result as string);
    };
    reader.onerror = function () {
      reject(reader.error || new Error("Cannot read download data"));
    };
    reader.readAsDataURL(blob);
  });
}

export async function ephDownloadViaFetch(url: string, filename: string): Promise<DownloadResult> {
  if (/^blob:/i.test(url)) {
    throw new Error(
      "Cannot download a page blob URL from the extension background",
    );
  }
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }
  const blob = await response.blob();
  const dataUrl = await ephBlobToDataUrl(blob);
  return ephDownloadDirect(dataUrl, filename);
}

export async function ephDownloadMediaMessage(message: EphemeraMessage, filename: string): Promise<DownloadResult> {
  const isVideo = ephIsVideoMessage(message);
  const url = isVideo
    ? ephNormalizeVideoDownloadUrl(message.downloadv1)
    : ephNormalizeDownloadUrl(message.downloadv1);
  const useWindowsIgPath =
    ephIsWindowsRuntime() && ephIsInstagramDownloadMessage(message);

  if (useWindowsIgPath && isVideo) {
    return ephDownloadDirect(url, filename);
  }

  if (useWindowsIgPath) {
    try {
      const fetched = await ephDownloadViaFetch(url, filename);
      if (fetched.ok) return fetched;
      console.warn(
        "[Ephemera] Windows IG fetch download failed, falling back:",
        fetched.error,
      );
    } catch (e) {
      console.warn(
        "[Ephemera] Windows IG fetch download failed, falling back:",
        e && (e as Error).message,
      );
    }
  }

  return ephDownloadDirect(url, filename);
}
