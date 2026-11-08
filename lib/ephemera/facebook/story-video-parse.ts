import type { FbStoriesResponse, FbWalkNode } from './types';
import { Getvideo } from './story-viewer';

export function extractVideoUrlsByStoryId(jsonInput: unknown, storyId: string) {
  // Nếu là chuỗi thì parse
  const data: FbStoriesResponse =
    typeof jsonInput === "string" ? JSON.parse(jsonInput) : (jsonInput as FbStoriesResponse);

  const urls: string[] = [];

  if (!data?.data?.nodes) return urls;

  data.data.nodes.forEach((node) => {
    const edges = node.unified_stories?.edges;
    if (!Array.isArray(edges)) return;

    edges.forEach((edge) => {
      const storyNode = edge.node;
      if (!storyNode || storyNode.id !== storyId) return; // chỉ lấy story khớp ID

      // ───────────────────────────────── attachments ─────────────────────────────────
      storyNode.attachments?.forEach((att) => {
        const media = att.media;
        const videoData =
          media?.videoDeliveryResponseFragment?.videoDeliveryResponseResult;

        const progressive = videoData?.progressive_urls;
        if (!Array.isArray(progressive)) return;

        // Phân nhóm HD và fallback
        const hd = progressive.filter(
          (p) => p.progressive_url && p.metadata?.quality === "HD",
        );
        const fallback = progressive.filter((p) => p.progressive_url);

        (hd.length ? hd : fallback).forEach((p) =>
          urls.push(p.progressive_url as string),
        );
      });
    });
  });

  return urls;
}

/* ==== Cách dùng ====
const storyId = "UzpfSVNDOjk4MzM4MTQyMzI3NzE1NQ==";
const hdOrSdUrls = extractVideoUrlsByStoryId(jsonObject, storyId);
console.log(hdOrSdUrls);
*/

export function extractHDVideos(jsonString: unknown) {
  try {
    // Parse JSON data if provided as string
    const jsonData: FbStoriesResponse =
      typeof jsonString === "string" ? JSON.parse(jsonString) : (jsonString as FbStoriesResponse);

    // Array to store HD video URLs
    let hdVideoUrls: string[] = [];

    // Process the data.nodes structure
    if (jsonData.data && jsonData.data.nodes) {
      jsonData.data.nodes.forEach((node) => {
        // Check for unified_stories
        if (node.unified_stories && node.unified_stories.edges) {
          node.unified_stories.edges.forEach((edge) => {
            // Check for attachments in each story
            if (edge.node && edge.node.attachments) {
              edge.node.attachments.forEach((attachment) => {
                // Look for media with videoDeliveryResponseFragment
                if (
                  attachment.media &&
                  attachment.media.videoDeliveryResponseFragment &&
                  attachment.media.videoDeliveryResponseFragment
                    .videoDeliveryResponseResult
                ) {
                  const videoData =
                    attachment.media.videoDeliveryResponseFragment
                      .videoDeliveryResponseResult;

                  // Check for progressive_urls
                  if (videoData.progressive_urls) {
                    videoData.progressive_urls.forEach((urlObj) => {
                      // Only push URLs where quality is HD
                      if (
                        urlObj.progressive_url &&
                        urlObj.metadata &&
                        urlObj.metadata.quality === "HD"
                      ) {
                        hdVideoUrls.push(urlObj.progressive_url);
                      }
                    });
                  }
                }
              });
            }
          });
        }
      });
    }

    return hdVideoUrls;
  } catch (error) {
    console.error("Error extracting HD videos:", error);
    return [];
  }
}

export function extractProgressiveUrls(jsonData: FbStoriesResponse) {
  try {
    let progressiveUrls: string[] = [];

    jsonData.data!.nodes!.forEach((node) => {
      if (node.unified_stories && node.unified_stories.edges) {
        node.unified_stories.edges.forEach((edge) => {
          if (edge.node && edge.node.attachments) {
            edge.node.attachments.forEach((attachment) => {
              const media = attachment.media;
              const videoData =
                media?.videoDeliveryResponseFragment
                  ?.videoDeliveryResponseResult;
              const urls = videoData?.progressive_urls;

              if (Array.isArray(urls)) {
                const hdUrls = urls.filter(
                  (urlObj) =>
                    urlObj.progressive_url && urlObj.metadata?.quality === "HD",
                );
                const fallbackUrls = urls.filter(
                  (urlObj) => urlObj.progressive_url,
                );

                if (hdUrls.length > 0) {
                  hdUrls.forEach((urlObj) =>
                    progressiveUrls.push(urlObj.progressive_url as string),
                  );
                } else {
                  fallbackUrls.forEach((urlObj) =>
                    progressiveUrls.push(urlObj.progressive_url as string),
                  );
                }
              }
            });
          }
        });
      }
    });

    return progressiveUrls;
  } catch (error) {
    console.error("Error extracting progressive URLs:", error);
    return [];
  }
}

/**
 * Trả về mảng <div> bên trong #viewer_dialog có thuộc tính id
 * @returns {HTMLDivElement[]}
 */

export function getHdVideoUrls(root: unknown, nodeid: string = "") {
  const results: string[] = [];

  /** Duyệt sâu không giới hạn */
  function walk(nodeArg: unknown): void {
    const node = nodeArg as FbWalkNode;
    if (!node || typeof node !== "object") return;
    if (nodeid !== "" && node.id !== nodeid) return;

    if (node.attachments) {
      node.attachments.forEach((att) => {
        const media = att.media;

        const isVideo =
          media?.__isMedia === "Video" || media?.__typename === "Video";

        if (!isVideo) return;

        const progressive =
          media.progressive_urls ||
          media.videoDeliveryResponseFragment?.videoDeliveryResponseResult
            ?.progressive_urls;

        if (!Array.isArray(progressive)) return;

        // Tách HD và non-HD
        const hdUrls = progressive.filter(
          (p) => p?.metadata?.quality === "HD" && p.progressive_url,
        );
        const fallbackUrls = progressive.filter((p) => p?.progressive_url); // lấy tất cả

        if (hdUrls.length > 0) {
          hdUrls.forEach((p) => results.push(p.progressive_url as string));
        } else {
          fallbackUrls.forEach((p) => results.push(p.progressive_url as string));
        }
      });
    }

    Object.values(node).forEach(walk);
  }

  walk(root);
  return results;
}

/* ✨ Ví dụ dùng:
   const json = JSON.parse(fs.readFileSync('tsconfig.json','utf8'));
   const hdUrls = getHdVideoUrls(json);
   console.log(hdUrls.join('\n'));
*/
//Getvideo(706365595295960)
