import type { FbNode, FbStoryItem } from './types';
import { state } from './state';
import { restoreDownloadButton } from './button-state';
import { fbNamePart } from './filenames';
import { buildFbStoryBody } from './session';
import { extractHDVideos, extractProgressiveUrls, extractVideoUrlsByStoryId } from './story-video-parse';

export function SoNumIndex() {
  // Find all styled divs
  const divs = Array.from(document.querySelectorAll<FbNode>("div[style]"));

  // Filter divs that have transition-duration and width in their style
  const matchedDivs = divs.filter((div) => {
    const style = div.getAttribute("style")!;
    return style.includes("transition-duration") && style.includes("width");
  });

  // Count divs with width not equal to 0%
  let count = 0;

  matchedDivs.forEach((div) => {
    const style = div.getAttribute("style")!;

    // Extract width value using regex
    const widthMatch = style.match(/width:\s*([^;]+)/);
    if (widthMatch && widthMatch[1]) {
      const widthValue = widthMatch[1].trim();
      if (widthValue !== "0%") {
        count++;
      }
    }
  });

  return count;
}

/**
 * Trả về tất cả progressive_url của video trong storyId.
 * Ưu tiên HD, fallback sang SD nếu HD không tồn tại.
 *
 * @param {object|string} jsonInput – object JSON hoặc chuỗi JSON
 * @param {string} storyId          – id story cần lấy (ví dụ: "UzpfSVNDOjk4MzM4MTQyMzI3NzE1NQ==")
 * @returns {string[]}              – mảng URL (HD hoặc SD)
 */

export function getDivsWithIdInsideViewerDialog() {
  const viewer = document.getElementById("viewer_dialog");
  if (!viewer) return [];
  return Array.from(viewer.querySelectorAll<FbNode>("div[id]"));
}

/**
 * Quan sát #viewer_dialog; mỗi khi xuất hiện <div id="..."> mới
 * (kể cả khi div đã tồn tại rồi mới gắn id) sẽ gọi callback
 *
 * @param {(el: HTMLDivElement) => void} onFound
 * @returns {() => void} – hàm ngắt quan sát
 */

export function observeViewerDialog(onFound: (el: FbNode) => void = console.log) {
  const viewer = document.getElementById("viewer_dialog");
  if (!viewer) {
    console.debug(
      "#viewer_dialog chua ton tai (binh thuong khi chua mo story).",
    );
    return () => {};
  }

  // 1) Gửi các div có id hiện có
  getDivsWithIdInsideViewerDialog().forEach(onFound);

  // 2) Theo dõi các thay đổi mới
  const obs = new MutationObserver((muts) => {
    muts.forEach((m) => {
      // Các node mới được thêm
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return; // Không phải Element
        const el = node as FbNode;

        // a) Chính nó là <div id="...">
        if (el.tagName === "DIV" && el.id) onFound(el);

        // b) Hoặc có con <div id="...">
        el.querySelectorAll?.<FbNode>("div[id]").forEach((div) => onFound(div));
      });

      // 3) Nếu thuộc tính id của phần tử hiện hữu vừa được gắn
      if (m.type === "attributes" && m.attributeName === "id") {
        const el = m.target as FbNode;
        if (el.tagName === "DIV" && el.id) onFound(el);
      }
    });
  });

  // childList: để bắt node mới; subtree: lồng sâu; attributes: theo dõi id gắn thêm
  obs.observe(viewer, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["id"],
  });

  // Hàm ngắt
  return () => obs.disconnect();
}

/* ---------- Cách sử dụng ---------- */

export function getActiveFbStoryItem(): FbStoryItem | null {
  var best = null as FbStoryItem | null;
  var bestScore = -1;
  state.Arrarystory.forEach(function (item) {
    var el = document.querySelector<FbNode>('div[data-id="' + item.id + '"]');
    if (!el) return;
    var rect = el.getBoundingClientRect();
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.bottom <= 0 ||
      rect.top >= innerHeight
    )
      return;
    var centerPenalty = Math.abs(rect.top + rect.height / 2 - innerHeight / 2);
    var score = rect.width * rect.height - centerPenalty;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  });
  return best;
}

export function downloadActiveFbStoryVideo() {
  var active = getActiveFbStoryItem();
  if (active) {
    Getvideo(active.VIDEOID, active.id);
    return true;
  }
  return false;
}

export function ensureFbStoryMetadataReady() {
  if (location.href.toString().indexOf("stories") === -1) return;
  if (state.Arrarystory.length > 0) return;
  try {
    var urlMatch = location.href.match(/facebook\.com\/stories\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
      parserVideoid(urlMatch[1]);
      return;
    }
    var viewer = document.getElementById("viewer_dialog");
    var firstIdDiv = viewer && viewer.querySelector<FbNode>("div[id]");
    if (firstIdDiv && firstIdDiv.id) parserVideoid(firstIdDiv.id);
  } catch (e) {}
}

// Bắt đầu quan sát

export function addnew() {
  state.Arrarystory = [];
  state.stop();
  state.stop = observeViewerDialog((div) => {
    parserVideoid(div.id);
  });
}

// Khi không cần nữa:
// state.stop();

export function parserVideoid(VIDEOID: string) {
  var username = "";
  var uid = "";
  var fbag = "";
  try {
    uid = document.cookie.match(/c_user.*?(?=;)/g)![0].split("=")[1];
    fbag = document.documentElement.innerHTML
      .match(/"token":".*?(?=")/g)![0]
      .split('"')[3];
  } catch (ex) {}

  fetch("https://www.facebook.com/api/graphql/", {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9,vi;q=0.8",
      "content-type": "application/x-www-form-urlencoded",
      priority: "u=1, i",
      "sec-ch-prefers-color-scheme": "dark",
      "sec-ch-ua":
        '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
      "sec-ch-ua-full-version-list":
        '"Not(A:Brand";v="99.0.0.0", "Google Chrome";v="133.0.6943.127", "Chromium";v="133.0.6943.127"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": '""',
      "sec-ch-ua-platform": '"macOS"',
      "sec-ch-ua-platform-version": '"15.3.1"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-asbd-id": "359341",
      "x-fb-friendly-name": "StoriesViewerBucketPrefetcherMultiBucketsQuery",
    },
    referrerPolicy: "strict-origin-when-cross-origin",
    body: buildFbStoryBody(VIDEOID),
    method: "POST",
    mode: "cors",
    credentials: "include",
  })
    .then((response) => response.text())
    .then((json) => {
      var jsonx = json.split("\n")[0];
      console.log(jsonx);

      var jsonparser = JSON.parse(jsonx);

      const edges = jsonparser.data.nodes[0].unified_stories.edges;

      edges.forEach((edge: { node?: { id?: string } }, index: number) => {
        if (edge?.node?.id) {
          var id = edge.node.id;
          state.Arrarystory.push({ VIDEOID, id });
          console.log(`Edge ${index}: ID =`, edge.node.id);
        }
      });

      console.log(state.Arrarystory);
      var x = state.Arrarystory;
      const seen = new Set();
      const filtered = x.filter((item) => {
        const key = `${item.VIDEOID}__${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      state.Arrarystory = filtered;

      if (state.command == true) {
        state.command = false;
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
    })
    .catch((err) => console.error(err));
}

/**
 * Đi sâu vào mọi nút (node) của GraphQL response,
 * tìm attachments → media là Video, sau đó lấy progressive_urls
 * có metadata.quality === "HD".
 * @param {object} root – object đã parse từ tsconfig.json
 * @returns {string[]} – mảng các URL video HD
 */

export function Getvideo(VIDEOID: string, storyid: string = "") {
  var uid = "";
  var fbag = "";
  try {
    uid = document.cookie.match(/c_user.*?(?=;)/g)![0].split("=")[1];
    fbag = document.documentElement.innerHTML
      .match(/"token":".*?(?=")/g)![0]
      .split('"')[3];
  } catch (ex) {}

  fetch("https://www.facebook.com/api/graphql/", {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9,vi;q=0.8",
      "content-type": "application/x-www-form-urlencoded",
      priority: "u=1, i",
      "sec-ch-prefers-color-scheme": "dark",
      "sec-ch-ua":
        '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
      "sec-ch-ua-full-version-list":
        '"Not(A:Brand";v="99.0.0.0", "Google Chrome";v="133.0.6943.127", "Chromium";v="133.0.6943.127"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": '""',
      "sec-ch-ua-platform": '"macOS"',
      "sec-ch-ua-platform-version": '"15.3.1"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-asbd-id": "359341",
      "x-fb-friendly-name": "StoriesViewerBucketPrefetcherMultiBucketsQuery",
    },
    referrerPolicy: "strict-origin-when-cross-origin",
    body: buildFbStoryBody(VIDEOID),
    method: "POST",
    mode: "cors",
    credentials: "include",
  })
    .then((response) => response.text())
    .then((json) => {
      var jsonx = json.split("\n")[0];
      console.log(jsonx);
      var jsonparser = JSON.parse(jsonx);
      var DATa = extractVideoUrlsByStoryId(jsonparser, storyid);
      console.log(DATa);

      var ex = extractHDVideos(jsonparser);
      if (DATa.length != 0) {
        ex = DATa;
      }
      if (ex.length == 0) {
        ex = extractVideoUrlsByStoryId(jsonparser, storyid);
      }

      var soluongindex = SoNumIndex();
      var indexnew = ex[0];
      var videox = extractProgressiveUrls(jsonparser)[0];
      if (!indexnew) indexnew = videox;
      if (!indexnew) {
        restoreDownloadButton(state.dataelement);
        return;
      }

      chrome.runtime.sendMessage(
        {
          downloadv1: indexnew,
          idx: VIDEOID,
          url: location.href,
          platform: "fb",
          channel: "story",
          postId: VIDEOID,
          order: 1,
          mediaType: "video",
          filename: ["fb", "story", VIDEOID, "001", "video"]
            .map(function (x) {
              return fbNamePart(x);
            })
            .join("_"),
        },
        (response) => {
          console.log("dow:");
        },
      );
    })
    .catch((err) => {
      restoreDownloadButton(state.dataelement);
      console.error(err);
    });
}

//Getvideo("123992256015312")

export function extractFacebookStoryId(url: string) {
  const match = url.match(/facebook\.com\/stories\/(\d+)\//);
  return match ? match[1] : null;
}
