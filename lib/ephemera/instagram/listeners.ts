import type { ListenerRequest } from './types';
import { restoreDownloadButton, ephFindMostVisibleIgDownloadButton } from './buttons';
import { addVideoDownloadButton } from './video';
import { addSingleImageDownloadButtons, addbutton } from './grid';
import { checkForProfilePage, handleDownloadProgress } from './profile-ui';
import { state } from './state';
import { ICON_DOWNLOAD, ICON_DOWNLOAD_ALL } from '@/lib/ephemera/icon-urls';

export function registerListeners(): void {
// Listen for messages from window
window.addEventListener(
  "message",
  (event) => {
    if (event.data == "nullvideo") {
      // Trên trang story, instagram.js đã tự xử lý tải ảnh story;
      // click lại nút ở đây sẽ gây vòng lặp tải vô hạn -> bỏ qua.
      if (location.pathname.indexOf("/stories/") !== -1) return;
      try {
        var _b = null;
        if (
          state.elementping &&
          state.elementping.parentElement &&
          state.elementping.parentElement.parentElement
        ) {
          _b =
            state.elementping.parentElement.parentElement.getElementsByClassName(
              "eph_toolkit_dl_btn",
            )[0] || null;
        }
        if (!_b) _b = ephFindMostVisibleIgDownloadButton();
        if (_b) (_b as HTMLElement).click();
      } catch (e) {}
    }
  },
  false,
);

// Message listener for communication with background script
chrome.runtime.onMessage.addListener((request: ListenerRequest, _sender, sendResponse) => {
  if (request.downloadProgress) {
    handleDownloadProgress(request.downloadProgress);
    sendResponse({ status: "Progress update received" });
    return true;
  }
  // Handle download confirmation
  if (request.countdow) {
    if (request.countdow == "ok") {
      // Download successful, update UI accordingly
      if (state.elemntdata!.className == "eph_toolkit_dl_btn") {
        (state.elemntdata!.getElementsByClassName(
          "eph_toolkit_icon",
        )[0] as HTMLElement).style.backgroundImage =
          ICON_DOWNLOAD;
      } else {
        (state.elemntdata!.getElementsByClassName(
          "eph_toolkit_icon",
        )[0] as HTMLElement).style.backgroundImage =
          ICON_DOWNLOAD_ALL;
      }
      restoreDownloadButton(state.elemntdata!);
    }
  }

  // Handle click action from popup or other parts of the extension
  if (request.clickaction) {
    // Profile page download action
    if (request.profileAction) {
      const profileBtn = document.querySelector<HTMLElement>(
        ".eph_toolkit_profile_download_btn",
      );
      if (profileBtn) {
        profileBtn.click();
        sendResponse({ status: "Profile download initiated" });
        return true;
      }

      // If button not found yet, try to add it first
      checkForProfilePage();
      setTimeout(() => {
        const profileBtn = document.querySelector<HTMLElement>(
          ".eph_toolkit_profile_download_btn",
        );
        if (profileBtn) {
          profileBtn.click();
          sendResponse({
            status: "Profile download initiated after button creation",
          });
        } else {
          sendResponse({ status: "Profile button not found" });
        }
      }, 500);
      return true;
    }

    // Regular post or story download action
    if (!location.pathname.includes("stories")) {
      try {
        // LỖI CŨ: state.elementping không bao giờ được gán -> luôn ném lỗi, nút Download
        // trên toolbar không hoạt động dù nút gắn trong trang vẫn tải được.
        var targetBtn = null;
        try {
          if (
            state.elementping &&
            state.elementping.parentElement &&
            state.elementping.parentElement.parentElement
          ) {
            targetBtn =
              state.elementping.parentElement.parentElement.getElementsByClassName(
                "eph_toolkit_dl_btn",
              )[0] || null;
          }
        } catch (e) {
          targetBtn = null;
        }
        // Chọn nút của bài viết đang hiển thị nhiều nhất trong khung nhìn.
        if (!targetBtn) targetBtn = ephFindMostVisibleIgDownloadButton();
        if (!targetBtn) {
          try {
            addbutton();
          } catch (e) {}
          try {
            addVideoDownloadButton();
          } catch (e) {}
          try {
            addSingleImageDownloadButtons();
          } catch (e) {}
          targetBtn =
            ephFindMostVisibleIgDownloadButton() ||
            document.querySelector<HTMLElement>(".eph_toolkit_dl_btn");
        }
        if (targetBtn) {
          (targetBtn as HTMLElement).click();
          sendResponse({ status: "Download initiated" });
        } else {
          sendResponse({ status: "No download button found" });
        }
      } catch (error) {
        console.error("Error triggering download click:", error);
        sendResponse({ status: "Error", error: (error as Error).message });
      }
    }
  }

  // Return true to indicate async response
  return true;
});
}
