import type { FbNode } from './types';
import { state } from './state';
import { restoreDownloadButton, ephFindMostVisibleFbDownloadButton } from './button-state';
import { addnew, Getvideo, extractFacebookStoryId, observeViewerDialog, parserVideoid } from './story-viewer';
import { addbtn, addbuttontostory, ephScheduleFbScan } from './click-scan';
import { scheduleFbButtonReposition } from './video-button';
import { installFbVideoResourceObserver } from './url-harvest';
import { ICON_DOWNLOAD } from '@/lib/ephemera/icon-urls';

export function installMessageListener(): void {
window.addEventListener(
  "message",
  (event) => {
    console.log(event);
    var username = "";
    if (typeof event.data === "string" && event.data.includes("https")) {
      try {
        var checkarray = true;
        var checkdow = false;
        state.Arrarystory.forEach((item) => {
          const selector = `div[data-id="${item.id}"]`;
          const el = document.querySelector<FbNode>(selector);

          if (el) {
            console.log(`✅ Tìm thấy phần tử với id = ${item.id}:`, el);
            if (checkarray == true) {
              checkarray = false;
              checkdow = true;
              Getvideo(item.VIDEOID, item.id);
            }
          } else {
            console.debug(
              `Story khong hien thi trong DOM (binh thuong): ${item.id}`,
            );
          }
        });
        if (checkdow == false) {
          addnew();
        }
      } catch (ex) {
        username = "none";
      }
    }

    if (typeof event.data === "string" && event.data.includes("CALLVIDEO")) {
      state.command = true;
      const viewer = document.getElementById("viewer_dialog");
      if (!viewer) {
        if (location.href.includes("stories")) {
          var url = location.href;
          const match = url.match(/facebook\.com\/stories\/(\d+)/);

          if (match) {
            const id = match[1];

            parserVideoid(id);
          }
        }
      } else {
        try {
          var checkarray = true;
          var checkdow = false;
          state.Arrarystory.forEach((item) => {
            const selector = `div[data-id="${item.id}"]`;
            const el = document.querySelector<FbNode>(selector);

            if (el) {
              console.log(`✅ Tìm thấy phần tử với id = ${item.id}:`, el);
              if (checkarray == true) {
                checkarray = false;
                checkdow = true;
                Getvideo(item.VIDEOID, item.id);
              }
            } else {
              console.debug(
                `Story khong hien thi trong DOM (binh thuong): ${item.id}`,
              );
            }
          });
          if (checkdow == false) {
            addnew();
          }
        } catch (ex) {
          username = "none";
        }
      }
    }
    // …
  },
  false,
);
}

export function installRuntimeListener(): void {
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action == "changeurl") {
  }

  if (request.countdow) {
    if (request.countdow == "ok") {
      try {
        (state.dataelement!.getElementsByClassName(
          "eph_toolkit_icon",
        )[0] as HTMLElement).style.backgroundImage =
          ICON_DOWNLOAD;
        restoreDownloadButton(state.dataelement);
      } catch (ex) {}
    }
  }

  if (request.clickaction) {
    try {
      if (location.pathname.includes("stories")) {
        // Story: bấm nút tải của story đang mở; nếu chưa có thì tạo rồi bấm.
        var _storyBtn = document.querySelector<FbNode>(".download-btn");
        if (!_storyBtn) {
          try {
            addbuttontostory();
          } catch (e) {}
          _storyBtn = document.querySelector<FbNode>(".download-btn");
        }
        if (_storyBtn) _storyBtn.click();
      } else {
        // Feed/reel/watch: chọn nút gắn với video ĐANG HIỂN THỊ trong khung nhìn,
        // không phải nút đầu tiên trong DOM (có thể thuộc video đã cuộn qua từ lâu).
        var _dlbtn: HTMLElement | null = ephFindMostVisibleFbDownloadButton();
        if (!_dlbtn) {
          try {
            addbtn();
          } catch (e) {}
          _dlbtn =
            ephFindMostVisibleFbDownloadButton() ||
            document.querySelector<FbNode>(".eph_toolkit_dl_btn");
        }
        if (_dlbtn) _dlbtn.click();
      }
    } catch (ex) {}
  }
});
}

export function installViewerObserver(): void {
  // Bắt đầu quan sát
  state.stop = observeViewerDialog((div) => {
    const x = state.Arrarystory;
    var fuccheck = true;
    x.forEach((item) => {
      if (item.VIDEOID == div.id) {
        fuccheck = false;
      }
    });
    if (fuccheck == true) {
      parserVideoid(div.id);
    }
  });
}

export function installHistoryInterceptor(): void {
(function interceptHistory() {
  // Lưu bản gốc
  const _push = history.pushState;
  const _replace = history.replaceState;

  function fire(url: unknown) {
    window.dispatchEvent(new CustomEvent("urlchange", { detail: { url } }));
  }

  history.pushState = function (...args) {
    _push.apply(this, args);
    fire(args[2] ?? location.href);
  };

  history.replaceState = function (...args) {
    _replace.apply(this, args);
    fire(args[2] ?? location.href);
  };

  // Khi người dùng back/forward
  window.addEventListener("popstate", () => fire(location.href));
})();

}

export function installCopyListener(): void {
document.addEventListener("copy", function (event) {
  let copiedText = document.getSelection()!.toString();
  var id = extractFacebookStoryId(copiedText);
  Getvideo(id as string);
  // Hiển thị stack trace để xem sự kiện bắt nguồn từ đâu

  // (Tùy chọn) Chặn sự kiện để kiểm tra nếu cần
  // event.preventDefault();
});
}

export function installResizeListener(): void {
  // Cuộn không cần xử lý (nút đã dính theo host). Chỉ cần tính lại khi resize.
  window.addEventListener("resize", scheduleFbButtonReposition, true);
}

export function startScanning(): void {
  addbuttontostory();

  const targetNode = document.getElementsByTagName("body")[0];

  // attributeFilter: chỉ nghe các thuộc tính liên quan video, tránh callback bắn liên tục
  // với hàng nghìn mutation aria-*/data-* của Facebook (nguyên nhân gây giật lag).
  const config = {
    attributes: true,
    subtree: true,
    attributeFilter: ["src", "style", "class"],
  };

  const callback = function (mutationsList: MutationRecord[], observer: MutationObserver) {
    for (const mutation of mutationsList) {
      if (mutation.type === "attributes" && (mutation.target as Element).tagName === "VIDEO") {
        ephScheduleFbScan();
        break;
      }
    }
  };

  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
  try {
    addbtn();
  } catch (ex) {}

  // Gắn lại nút định kỳ (dự phòng khi observer bỏ sót). Bỏ qua khi tab ẩn để không tốn CPU nền.
  setInterval(function () {
    if (document.hidden) return;
    try {
      addbuttontostory();
    } catch (e) {}
    try {
      addbtn();
    } catch (e) {}
  }, 2000);
}
