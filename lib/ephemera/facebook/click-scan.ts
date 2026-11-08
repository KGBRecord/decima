import type { FbNode, EphButton } from './types';
import { state } from './state';
import { addFacebookAlbumButtons } from './album';
import { guardDownloadButtonEvents, markDownloadButtonBusy, restoreDownloadButton } from './button-state';
import { getFbMediaRoot, getFbVideoIdNearElement, getPrimaryVisibleFbVideo, isNumericString, isValidFbVideoId } from './dom-helpers';
import { buildFbFileBase, sendFbVideoDownload } from './filenames';
import { addnew, downloadActiveFbStoryVideo, ensureFbStoryMetadataReady, parserVideoid } from './story-viewer';
import { getFastFbVideoUrl, waitForFbVideoUrlWithoutPlayback } from './url-harvest';
import { addButtonsToVisibleFbVideos, placeFbDownloadButtonOnVideo, repositionAllFbVideoButtons } from './video-button';
import { ICON_LOADING } from '@/lib/ephemera/icon-urls';

export async function clickbtn(this: EphButton, e: Event) {
  if (e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (_) {}
  }
  state.dataelement = this;
  markDownloadButtonBusy(this);
  var uid = "";
  var fbag = "";
  try {
    uid = document.cookie.match(/c_user.*?(?=;)/g)![0].split("=")[1];
    fbag = document.documentElement.innerHTML
      .match(/"async_get_token":".*?(?=")/g)![0]
      .split('"')[3];
  } catch (ex) {}

  var directIdpost = this.getAttribute("data-video-id") || this.id || "";
  if (!directIdpost && this.__ephVideoElement) {
    directIdpost = getFbVideoIdNearElement(this.__ephVideoElement);
  }
  if (
    location.href.includes("watch/?v=") ||
    location.href.includes("watch?v=")
  ) {
    try {
      directIdpost = location.href.split("=")[1].split("&")[0];
    } catch (ex) {}
  }
  if (!isValidFbVideoId(directIdpost)) {
    restoreDownloadButton(this);
    return;
  }
  var directRoot = getFbMediaRoot(this.__ephVideoElement || this);
  var directFilename = buildFbFileBase(directRoot, directIdpost, 1, "video");
  var directPageUrl = getFastFbVideoUrl(this, directIdpost);
  try {
    console.log(
      "[Ephemera] FB video direct URL:",
      directPageUrl,
      "| id:",
      directIdpost,
      "| noOpen:",
      true,
    );
  } catch (e) {}
  if (directPageUrl) {
    if (
      sendFbVideoDownload(
        directPageUrl,
        directIdpost || "facebook_video",
        directRoot,
        directIdpost,
        directFilename,
      )
    )
      return;
  }

  var noOpenVideoUrl = await waitForFbVideoUrlWithoutPlayback(
    this,
    directIdpost,
    900,
  );
  try {
    console.log(
      "[Ephemera] FB video no-open URL:",
      noOpenVideoUrl,
      "| id:",
      directIdpost,
    );
  } catch (e) {}
  if (noOpenVideoUrl) {
    if (
      sendFbVideoDownload(
        noOpenVideoUrl,
        directIdpost || "facebook_video",
        directRoot,
        directIdpost,
        directFilename,
      )
    )
      return;
  }

  if (uid != "") {
    setTimeout(() => {
      (state.dataelement!.getElementsByClassName(
        "eph_toolkit_icon",
      )[0] as HTMLElement).style.backgroundImage =
        ICON_LOADING;
    }, 1);

    var idpost = this.getAttribute("data-video-id") || this.id || "";
    if (!idpost && this.__ephVideoElement) {
      idpost = getFbVideoIdNearElement(this.__ephVideoElement);
    }

    if (
      location.href.includes("watch/?v=") ||
      location.href.includes("watch?v=")
    ) {
      try {
        idpost = location.href.split("=")[1].split("&")[0];
      } catch (ex) {}
    }
    if (!isValidFbVideoId(idpost)) {
      restoreDownloadButton(this);
      return;
    }
    // Phương án chính: lấy URL video từ dữ liệu nhúng trong trang theo video_id
    var fallbackRoot = getFbMediaRoot(this.__ephVideoElement || this);
    var _pageUrl = getFastFbVideoUrl(this, idpost);
    try {
      console.log("[Ephemera] FB video URL:", _pageUrl, "| id:", idpost);
    } catch (e) {}
    if (_pageUrl) {
      if (
        sendFbVideoDownload(
          _pageUrl,
          idpost || "facebook_video",
          fallbackRoot,
          idpost,
          buildFbFileBase(fallbackRoot, idpost, 1, "video"),
        )
      )
        return;
    }
    var fallbackWarmUrl = await waitForFbVideoUrlWithoutPlayback(
      this,
      idpost,
      900,
    );
    if (fallbackWarmUrl) {
      if (
        sendFbVideoDownload(
          fallbackWarmUrl,
          idpost || "facebook_video",
          fallbackRoot,
          idpost,
          buildFbFileBase(fallbackRoot, idpost, 1, "video"),
        )
      )
        return;
    }
    if (!isValidFbVideoId(idpost)) {
      restoreDownloadButton(this);
      return;
    }
    // Dự phòng: endpoint cũ (có thể đã bị FB ngừng)
    fetch(
      "https://www.facebook.com/video/video_data_async/?video_id=" +
        idpost +
        "&fb_dtsg_ag=" +
        fbag +
        "&__user=" +
        uid +
        "&__a=1",
      {
        headers: {
          accept: "*/*",
          "accept-language":
            "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
          priority: "u=1, i",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "none",
        },
        referrerPolicy: "strict-origin-when-cross-origin",
        body: null,
        method: "GET",
        mode: "cors",
        credentials: "include",
      },
    )
      .then((response) => response.text())
      .then((json) => {
        const results = []; // Mảng để chứa kết quả

        var json = json.replace("for (;;);", "");
        var urlvideo = JSON.parse(json).payload.hd_src;

        if (urlvideo == null) {
          urlvideo = JSON.parse(json).payload.sd_src;
        }
        if (!urlvideo) {
          restoreDownloadButton(state.dataelement);
          return;
        }
        sendFbVideoDownload(
          urlvideo,
          idpost || "facebook_video",
          fallbackRoot,
          idpost,
          buildFbFileBase(fallbackRoot, idpost, 1, "video"),
        );
      })
      .catch((err) => {
        restoreDownloadButton(state.dataelement);
        console.error(err);
      });
  } else {
    restoreDownloadButton(this);
  }
}

export function addbtn() {
  repositionAllFbVideoButtons();
  addFacebookAlbumButtons();
  if (addButtonsToVisibleFbVideos() > 0) return;
  var maxadd = 0;
  var max1 = document.querySelectorAll<FbNode>(
    'div[data-instancekey^="id-vpuid"]',
  );

  for (var i in max1) {
    var panent = true;
    var max = max1[i];
    var dataele = max1[i];
    if (!dataele.getAttribute("toolin")) {
      var idpost = "";
      var reelpost = location.pathname.includes("/reel/");
      var videourl = location.pathname.includes("/videos/");
      if (!reelpost && !videourl) {
        while (panent) {
          maxadd += 1;
          max = max.parentElement as FbNode;

          var query = max.querySelectorAll<FbNode>(
            'a[href^="/reel/"], a[href^="/watch/?v="], a[href*="/videos/"]',
          );
          if (query.length != 0) {
            if (query[0].href.includes("/reel/")) {
              idpost = query[0].href.split("/")[4];
            }
            if (query[0].href.includes("pagechienca/")) {
              idpost = query[0].href.split("/")[5];
            } else {
              idpost = query[0].href.split("=")[1].split("&")[0];
              if (isNumericString(idpost) == false) {
                idpost = query[0].href.split("/")[5];
                if (isNumericString(idpost) == false) {
                  idpost = query[0].href.split("/")[6].split("?")[0];
                }
              }
            }
            break;
          }
          if (maxadd > 100) {
            break;
          }
        }
      } else if (reelpost) {
        idpost = location.href.split("/")[4];
      } else if (videourl) {
        idpost = location.href.split("/")[5];
      }
      if (isValidFbVideoId(idpost)) {
        var legacyVideo = null;
        try {
          legacyVideo =
            (dataele.querySelector && dataele.querySelector<FbNode>("video")) ||
            (max && max.querySelector && max.querySelector<FbNode>("video")) ||
            getPrimaryVisibleFbVideo();
          if (
            legacyVideo &&
            !getFbVideoIdNearElement(legacyVideo) &&
            legacyVideo.parentElement
          ) {
            legacyVideo.parentElement.setAttribute("data-video-id", idpost);
          }
        } catch (e) {}
        if (legacyVideo && placeFbDownloadButtonOnVideo(legacyVideo)) {
          dataele.setAttribute("toolin", "1");
        }
      }
    }
  }
}

export function addbuttontostory() {
  try {
    if (location.href.toString().indexOf("stories") != -1) {
      ensureFbStoryMetadataReady();

      let video = getPrimaryVisibleFbVideo();

      if (video !== null) {
        if (!video.parentElement!.querySelector<FbNode>(".download-btn")) {
          // Tạo nút
          let btn = document.createElement("div");
          btn.className = "eph_toolkit_dl_btn download-btn";
          btn.innerHTML =
            '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';
          btn.style.cssText = "top:auto;bottom:28px;left:auto;right:12px;";
          guardDownloadButtonEvents(btn);

          // Xử lý sự kiện khi bấm nút
          btn.addEventListener("click", (e) => {
            if (e) {
              try {
                e.preventDefault();
                e.stopPropagation();
              } catch (_) {}
            }
            markDownloadButtonBusy(btn);
            var username;
            try {
              if (downloadActiveFbStoryVideo() == false) {
                state.command = true;
                ensureFbStoryMetadataReady();
                addnew();
                setTimeout(function () {
                  try {
                    if (downloadActiveFbStoryVideo() == false) {
                      ensureFbStoryMetadataReady();
                      restoreDownloadButton(btn);
                    }
                  } catch (ex) {
                    restoreDownloadButton(btn);
                  }
                }, 700);
              }
            } catch (ex) {
              username = "none";
              restoreDownloadButton(btn);
            }

            try {
              const viewer = document.getElementById("viewer_dialog");
              if (!viewer) {
                state.command = true;
                if (location.href.includes("stories")) {
                  var url = location.href;
                  const match = url.match(/facebook\.com\/stories\/(\d+)/);

                  if (match) {
                    const id = match[1];

                    parserVideoid(id);
                  }
                }
              }
            } catch (ex) {}
          });

          // Style theo class eph_toolkit_dl_btn (đồng bộ icon tròn)

          // Đảm bảo video và thẻ chứa nó có vị trí relative để căn chỉnh chính xác
          video.style.position = "relative";
          video.parentElement!.style.position = "relative";

          // Gắn nút vào video
          video.parentElement!.appendChild(btn);
        }
      } else {
        // Story ẢNH: thêm nút tải ảnh đang hiển thị (giống nút video)
        try {
          var pimg = null as FbNode | null,
            parea = 0;
          document.querySelectorAll<FbNode>("img").forEach(function (im) {
            if (im.offsetHeight < 200) return;
            var a = im.offsetWidth * im.offsetHeight;
            if (a > parea) {
              parea = a;
              pimg = im;
            }
          });
          if (pimg && !pimg!.parentElement!.querySelector<FbNode>(".download-btn")) {
            var pbtn = document.createElement("div");
            pbtn.className = "eph_toolkit_dl_btn download-btn";
            pbtn.innerHTML =
              '<span class="eph_toolkit_dl_pregress_loader"></span><span class="eph_toolkit_icon"></span>';
            pbtn.style.cssText = "top:auto;bottom:28px;left:auto;right:12px;";
            guardDownloadButtonEvents(pbtn);
            pbtn.addEventListener("click", function (e) {
              if (e) {
                try {
                  e.preventDefault();
                  e.stopPropagation();
                } catch (_) {}
              }
              markDownloadButtonBusy(pbtn);
              try {
                var purl = pimg!.srcset
                  ? pimg!.srcset.split(",").pop()!.trim().split(" ")[0]
                  : pimg!.src;
                if (!purl) {
                  restoreDownloadButton(pbtn);
                  return;
                }
                chrome.runtime.sendMessage({
                  downloadv1: purl,
                  idx: "facebook_story",
                  url: location.href,
                  platform: "fb",
                  channel: "story",
                  postId: "facebook_story",
                  order: 1,
                  mediaType: "image",
                  filename: "fb_story_facebook_story_001_image",
                });
              } catch (ex) {
                restoreDownloadButton(pbtn);
              }
            });
            // Style theo class eph_toolkit_dl_btn (đồng bộ icon tròn)
            if (getComputedStyle(pimg!.parentElement!).position === "static")
              pimg!.parentElement!.style.position = "relative";
            pimg!.parentElement!.appendChild(pbtn);
          }
        } catch (ex) {}
      }
    } else {
      chrome.runtime.sendMessage(null, { noStories: true });
    }
  } catch (ex) {
    console.log(ex);
  }
}

export function ephScheduleFbScan() {
  if (state.ephFbScanTimer) return;
  state.ephFbScanTimer = setTimeout(function () {
    state.ephFbScanTimer = null;
    if (document.hidden) return;
    try {
      addbuttontostory();
    } catch (e) {}
    try {
      addbtn();
    } catch (e) {}
  }, 350);
}

// Callback function to execute when mutations are observed
