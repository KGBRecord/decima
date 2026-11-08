import JSZip from 'jszip';
import type { DownloadItem, IgPost, EphemeraMessage } from './types';
import { animateIconArrowDown, animateIconFailed } from './icons';
import { ephSendTabMessage } from './messaging';
import {
  ephBuildMediaFilename,
  ephExtFromUrl,
  ephIsVideoMessage,
  ephNormalizeDownloadUrl,
  ephNormalizeVideoDownloadUrl,
  ephSafeFilenamePart,
} from './filename';
import { ephDownloadMediaMessage } from './download';
import { handleProfileDownload } from './profile';

// Hosts handled by the Ephemera module.
const supportedSites = [
  { host: "instagram.com", name: "instagram" },
  { host: "facebook.com", name: "facebook" },
  { host: "web.whatsapp.com", name: "whatsapp" },
];

// Run the Ephemera action for a tab (triggered from the Decima popup / side panel).
function ephemeraRun(tab: chrome.tabs.Tab | undefined): void {
  if (!tab || tab.url === undefined) {
    if (tab && tab.id) animateIconFailed(tab.id);
    return;
  }
  animateIconArrowDown(tab.id);
  ephSendTabMessage(tab.id, { clickaction: true });

  let script = "";
  for (let i = 0; i < supportedSites.length; i++) {
    const site = supportedSites[i] as (typeof supportedSites)[number];
    if (tab.url.indexOf(site.host) !== -1) {
      script = site.name;
      break;
    }
  }
  if (script == "") return;
  if (script == "instagram") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id as number },
      world: chrome.scripting.ExecutionWorld.MAIN,
      files: ["/ephemera-instagram-video.js"],
    });
  }
  chrome.scripting.executeScript({
    target: { tabId: tab.id as number },
    files: ["/ephemera-" + script + ".js"],
  });
}

/** Handles the `download` message (zip for many items, direct downloads otherwise). */
async function handleDownloadMessage(
  message: EphemeraMessage,
  sender: chrome.runtime.MessageSender,
  dow: DownloadItem[],
): Promise<void> {
  const username = message.user ? message.user : "";

  if (dow.length > 1) {
    const zip = new JSZip();
    let nextIndex = 0;
    let doneCount = 0;
    const maxParallel = Math.min(6, dow.length);
    const fetchZipItem = async (): Promise<void> => {
      while (nextIndex < dow.length) {
        const ix = nextIndex++;
        const item = dow[ix] as DownloadItem;
        try {
          const response = await fetch(item.urls[0] as string, {
            mode: "cors",
            method: "GET",
            cache: "force-cache",
          });
          const content = await response.blob();
          const _firstUrl = item.urls[0] || "";
          const _isVid =
            item.urls.length === 2 ||
            /\.(?:mp4|m4v)(?:[?#]|$)/i.test(_firstUrl) ||
            /video\.[^\/]+fbcdn\.net/i.test(_firstUrl);
          const _ext = _isVid ? "mp4" : ephExtFromUrl(item.urls[0], "jpg");
          const _fileBase = item.filename || username + "_" + item.pk;
          zip.file(ephSafeFilenamePart(_fileBase) + "." + _ext, content, {
            binary: true,
          });
        } catch (e) {
          console.error(
            "[Ephemera] tai item that bai trong zip:",
            item && item.urls && item.urls[0],
            e,
          );
        } finally {
          doneCount++;
          if (sender.tab && sender.tab.id)
            ephSendTabMessage(sender.tab.id, { countdow: doneCount });
        }
      }
    };
    await Promise.all(Array.from({ length: maxParallel }, fetchZipItem));
    const content = await zip.generateAsync({
      type: "blob",
      compression: "STORE",
    });
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      chrome.downloads.download(
        {
          url: base64Data,
          filename:
            ephSafeFilenamePart(message.albumName || username || "album") +
            ".zip",
        },
        function () {
          if (sender.tab && sender.tab.id)
            ephSendTabMessage(sender.tab.id, { countdow: "ok" });
        },
      );
    };
    reader.readAsDataURL(new Blob([content], { type: content.type }));
    return;
  } else {
    for (const i in dow) {
      const dowrow1 = dow[Number(i)] as DownloadItem;
      if (dowrow1.urls.length == 2) {
        if (
          dowrow1.urls.length !== 2 &&
          !/\.(?:mp4|m4v)(?:[?#]|$)/i.test(dowrow1.urls[0] as string) &&
          !/video\.[^\/]+fbcdn\.net/i.test(dowrow1.urls[0] as string)
        ) {
          await ephDownloadMediaMessage(
            {
              downloadv1: dowrow1.urls[0],
              platform: /^ig_/i.test(username) ? "ig" : message.platform,
              url: message.url,
            },
            ephSafeFilenamePart(
              dowrow1.filename || username + "_" + dowrow1.pk,
            ) + ".jpg",
          );
        } else {
          await ephDownloadMediaMessage(
            {
              downloadv1: dowrow1.urls[0],
              platform: /^ig_/i.test(username) ? "ig" : message.platform,
              url: message.url,
              mediaType: "video",
            },
            ephSafeFilenamePart(
              dowrow1.filename || username + "_" + dowrow1.pk,
            ) + ".mp4",
          );
        }
      } else {
        for (const ix in dowrow1.urls) {
          const urlAtIx = dowrow1.urls[Number(ix)] as string;
          if (
            !/\.(?:mp4|m4v)(?:[?#]|$)/i.test(urlAtIx) &&
            !/video\.[^\/]+fbcdn\.net/i.test(urlAtIx)
          ) {
            await ephDownloadMediaMessage(
              {
                downloadv1: urlAtIx,
                platform: /^ig_/i.test(username) ? "ig" : message.platform,
                url: message.url,
              },
              ephSafeFilenamePart(
                dowrow1.filename ||
                  username + "_" + dowrow1.pk + "_" + (parseInt(ix, 10) + 1),
              ) + ".jpg",
            );
          } else {
            await ephDownloadMediaMessage(
              {
                downloadv1: urlAtIx,
                platform: /^ig_/i.test(username) ? "ig" : message.platform,
                url: message.url,
                mediaType: "video",
              },
              ephSafeFilenamePart(
                dowrow1.filename ||
                  username + "_" + dowrow1.pk + "_" + (parseInt(ix, 10) + 1),
              ) + ".mp4",
            );
          }
        }
      }
    }
  }

  if (sender.tab && sender.tab.id)
    ephSendTabMessage(sender.tab.id, { countdow: "ok" });
}

async function handleMessage(
  message: EphemeraMessage,
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  // Ignore Decima's own typed messages (CONTEXT_CHANGED, OPEN_SIDEPANEL, ...)
  if (message && (message.ephemeraRun || message.type)) return;
  if (message.runStoryDownload) {
    if (sender.tab && sender.tab.id) {
      const _tid = sender.tab.id;
      chrome.scripting
        .executeScript({
          target: { tabId: _tid },
          world: chrome.scripting.ExecutionWorld.MAIN,
          files: ["/ephemera-instagram-video.js"],
        })
        .then(function () {
          return chrome.scripting.executeScript({
            target: { tabId: _tid },
            files: ["/ephemera-instagram.js"],
          });
        })
        .catch(function (e) {
          console.error("runStoryDownload:", e);
        });
    }
    return;
  }
  if (message.profileDownload) {
    // `sender.tab` is assumed present (a throw here is caught by the caller, as before).
    handleProfileDownload(message.username, message.posts as IgPost[], sender.tab!.id, message.highlights ?? [], message.avatar ?? null);
    return;
  }
  if (message.downloadv1) {
    const normalizedDownloadUrl = ephIsVideoMessage(message)
      ? ephNormalizeVideoDownloadUrl(message.downloadv1)
      : ephNormalizeDownloadUrl(message.downloadv1);
    const fileExtension =
      message.mediaType === "video"
        ? "mp4"
        : ephExtFromUrl(normalizedDownloadUrl, "jpg");
    message.downloadv1 = normalizedDownloadUrl;

    await ephDownloadMediaMessage(
      message,
      ephBuildMediaFilename(message, fileExtension),
    );
    if (sender.tab && sender.tab.id)
      ephSendTabMessage(sender.tab.id, { countdow: "ok" });
  }
  if (message.download) {
    const dow = message.download;
    await handleDownloadMessage(message, sender, dow);
  }

  if (message.noStories === true) {
    animateIconFailed(sender.tab!.id);
    return;
  }

  animateIconArrowDown(sender.tab!.id);
}

/** Registers the Ephemera download pipeline in the extension service worker. */
export function setupEphemera(): void {
  chrome.runtime.onMessage.addListener(function (message: EphemeraMessage) {
    if (message && message.ephemeraRun && message.tabId) {
      chrome.tabs.get(message.tabId).then(ephemeraRun).catch(function () {});
    }
  });

  chrome.runtime.onMessage.addListener(function (
    message: EphemeraMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    handleMessage(message, sender).catch(function (e) {
      console.error("[Ephemera] message handler:", e);
    });
  });
}
