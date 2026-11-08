import JSZip from 'jszip';
import type {
  IgCandidate,
  IgCaption,
  IgMediaLike,
  IgPost,
  NormalizedMedia,
} from './types';
import { ephSendTabMessage } from './messaging';

// ===== Helpers =====
const sanitize = (s: unknown): string =>
  String(s || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

const formatDateYMD = (val: unknown): string => {
  if (!val && val !== 0) return "";
  const ms =
    typeof val === "number"
      ? val > 1e12
        ? val
        : val * 1000
      : new Date(val as string).getTime();
  if (!isFinite(ms)) return "";
  return new Date(ms).toISOString().slice(0, 10);
};

const getCreatedAt = (post: IgPost | null | undefined): string | number | null => {
  // `caption` may be a plain string at runtime; property reads on it yield undefined.
  const cap = (post?.caption || post?.caption_json) as IgCaption | null | undefined;
  return cap && cap.created_at
    ? cap.created_at
    : post?.taken_at || post?.created_at || null;
};

// Lấy ext từ URL hoặc type
const guessExt = (url: unknown, type?: string): string => {
  try {
    const u = String(url || "");
    const m = u.match(
      /\.(mp4|jpg|jpeg|png|webp|gif|bmp|m4v|mov|heic|heif)(\?|#|$)/i,
    );
    if (m) return "." + (m[1] as string).toLowerCase();
  } catch (_) {}
  if (!type) return ".jpg";
  if (/video/i.test(type)) return ".mp4";
  if (/audio/i.test(type)) return ".mp3";
  return ".jpg";
};

// Chọn ảnh lớn nhất trong candidates (Instagram)
const pickBestCandidate = (cands: IgCandidate[] = []): IgCandidate | null => {
  if (!Array.isArray(cands) || !cands.length) return null;
  return (
    cands.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0] ||
    cands[0] ||
    null
  );
};

const cryptoRandomId = (): string =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

// Chuẩn hóa media từ nhiều dạng post khác nhau
const normalizeMedia = (post: IgPost): NormalizedMedia[] => {
  const list: NormalizedMedia[] = [];

  // Trường hợp đã có sẵn media chuẩn
  if (Array.isArray(post?.media) && post.media.length) {
    for (const [idx, m] of post.media.entries()) {
      const url = m.url || m.src || m.display_url || m.image || m.link;
      if (url)
        list.push({
          id: m.id || m.pk || cryptoRandomId(),
          type: m.type || (/.mp4/i.test(url) ? "video" : "image"),
          url,
          ext: guessExt(url, m.type),
          media_order: m.media_order || idx + 1,
        });
    }
  }

  // Instagram kiểu edge_sidecar_to_children (carousel)
  if (post?.edge_sidecar_to_children?.edges?.length) {
    for (const ed of post.edge_sidecar_to_children.edges) {
      const node = ed.node || {};
      const v = node.video_url || null;
      const i = node.display_url || node.thumbnail_src || null;
      const url = v || i;
      if (url)
        list.push({
          id: node.id || cryptoRandomId(),
          type: v ? "video" : "image",
          url,
          ext: guessExt(url, v ? "video" : "image"),
        });
    }
  }

  // Instagram single image/video
  if (!list.length) {
    const v = post?.video_url || post?.video?.url;
    const i =
      post?.display_url ||
      post?.image_url ||
      post?.thumbnail_url ||
      post?.picture;
    if (v)
      list.push({
        id: post.id || cryptoRandomId(),
        type: "video",
        url: v,
        ext: guessExt(v, "video"),
      });
    else if (i)
      list.push({
        id: post.id || cryptoRandomId(),
        type: "image",
        url: i,
        ext: guessExt(i, "image"),
      });
  }

  // image_versions2 / video_versions (IG API)
  if (!list.length && post?.image_versions2?.candidates?.length) {
    const best = pickBestCandidate(post.image_versions2.candidates);
    if (best?.url)
      list.push({
        id: post.id || cryptoRandomId(),
        type: "image",
        url: best.url,
        ext: guessExt(best.url, "image"),
      });
  }
  if (
    !list.length &&
    Array.isArray(post?.video_versions) &&
    post.video_versions.length
  ) {
    const v0 = post.video_versions[0];
    if (v0?.url)
      list.push({
        id: post.id || cryptoRandomId(),
        type: "video",
        url: v0.url,
        ext: guessExt(v0.url, "video"),
      });
  }

  // resources / medias / items / urls (phòng khi đổi key)
  const altArrays = ["resources", "medias", "items", "urls"] as const;
  for (const key of altArrays) {
    const arr = post?.[key];
    if (!list.length && Array.isArray(arr) && arr.length) {
      for (const m of arr) {
        // A bare string entry is itself the URL; property reads on it yield undefined.
        const mo: IgMediaLike | null | undefined =
          typeof m === "string" ? undefined : m;
        const url =
          mo?.url ||
          mo?.src ||
          mo?.display_url ||
          mo?.image ||
          (typeof m === "string" ? m : null);
        if (url) {
          list.push({
            id: mo?.id || mo?.pk || cryptoRandomId(),
            type: mo?.type || (/.mp4/i.test(url) ? "video" : "image"),
            url,
            ext: guessExt(url, mo?.type),
          });
        }
      }
    }
  }

  // Loại trùng
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = x.url;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export async function handleProfileDownload(
  username: string | undefined,
  posts: IgPost[],
  idtab: number | undefined,
): Promise<void> {
  // ===== Main =====
  try {
    const islog = true;
    if (!islog) return;

    const zip = new JSZip();
    let totalFiles = 0;
    let processedFiles = 0;

    // Đếm media trước (sau khi normalize) để hiển thị progress sát thực tế
    for (const post of posts) {
      totalFiles += normalizeMedia(post).length;
    }

    ephSendTabMessage(idtab, {
      downloadProgress: { total: totalFiles, current: 0 },
    });

    for (const [postIndex, post] of posts.entries()) {
      const postOrder = String(
        post.wall_order || post.profile_order || postIndex + 1,
      ).padStart(3, "0");
      const shortcode = sanitize(
        post.shortcode || post.code || post.id || "post",
      );
      const createdAtRaw = getCreatedAt(post);
      const ymd = formatDateYMD(createdAtRaw);
      const postFolderName = sanitize(
        `ig_${username}_${postOrder}_${shortcode}`,
      );
      const folder = zip.folder(postFolderName) as JSZip;

      // Ghi caption.txt
      const captionObj = post.caption || post.caption_json || null;
      const captionText =
        captionObj &&
        typeof captionObj === "object" &&
        typeof captionObj.text === "string"
          ? captionObj.text
          : typeof post.caption === "string"
            ? post.caption
            : "";
      // property reads below on a string caption yield undefined
      const captionRead = captionObj as IgCaption | null;
      const captionContent = `Caption:
${captionText || ""}

--------
Meta:
\tdate(YYYY-MM-DD): ${ymd || ""}
\tshortcode: ${post.shortcode || ""}
\tprofile_order: ${postOrder}
\tpk: ${captionRead && captionRead.pk ? captionRead.pk : ""}
\tcreated_at_raw: ${captionRead && captionRead.created_at ? captionRead.created_at : post.taken_at || post.created_at || ""}
\t`;
      folder.file("caption.txt", captionContent);

      // Chuẩn hóa media
      const medias = normalizeMedia(post);

      if (!medias.length) {
        // Tạo file mô tả lý do để bạn dễ lần nguồn
        const debugInfo = {
          note: "No media found for this post. Check original post object keys.",
          availableKeys: Object.keys(post || {}),
          triedPaths: [
            "media[]",
            "edge_sidecar_to_children.edges[].node.(video_url|display_url)",
            "display_url|image_url|thumbnail_url|picture",
            "image_versions2.candidates[]",
            "video_versions[]",
            "resources|medias|items|urls",
          ],
        };
        folder.file("NO_MEDIA_FOUND.txt", JSON.stringify(debugInfo, null, 2));
        continue;
      }

      // Tải & thêm media
      for (const [mediaIndex, m] of medias.entries()) {
        try {
          processedFiles++;
          ephSendTabMessage(idtab, {
            downloadProgress: { total: totalFiles, current: processedFiles },
          });

          const res = await fetch(m.url, {
            method: "GET",
            mode: "cors",
            cache: "no-cache",
            referrerPolicy: "no-referrer", // một số CDN khắt khe referrer
          });
          if (!res.ok) {
            console.error(`Failed to fetch ${m.url}: ${res.status}`);
            // Ghi log vào file txt để bạn nắm link nào fail
            folder.file(
              `fetch_failed_${sanitize(m.id)}.txt`,
              `GET ${m.url}\nHTTP ${res.status}`,
            );
            continue;
          }
          const blob = await res.blob();

          const mediaOrder = String(m.media_order || mediaIndex + 1).padStart(
            3,
            "0",
          );
          const mediaKind =
            /video/i.test(m.type || "") || /\.mp4/i.test(m.url || "")
              ? "video"
              : "image";
          const namePart = sanitize(
            `ig_${username}_${postOrder}_${shortcode}_${mediaOrder}_${mediaKind}`,
          );
          const fileName = `${namePart}${m.ext || guessExt(m.url, m.type)}`;
          folder.file(fileName, blob, { binary: true });
        } catch (err) {
          console.error(`Error processing media ${m && m.id}:`, err);
          folder.file(
            `error_${sanitize(m.id)}.txt`,
            String((err as Error | undefined)?.stack || err),
          );
        }
      }
    }

    // Xuất ZIP
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const downloadTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
      chrome.downloads.download({
        url: base64Data,
        filename: `ig_${sanitize(username)}_profile_download_all_${downloadTimestamp}.zip`,
        saveAs: false,
      });
      ephSendTabMessage(idtab, { downloadComplete: true });
    };
    reader.readAsDataURL(zipBlob);
  } catch (error) {
    console.error("Profile download error:", error);
    ephSendTabMessage(idtab, { downloadError: (error as Error).message });
  }
}
