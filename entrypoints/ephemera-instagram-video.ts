import type { ReactFiberLike } from "../lib/ephemera/standalone/react-fiber";

export default defineUnlistedScript(() => {
// Extracts the story video URL by walking the React fiber (memoizedProps) of the player.
// Contract with ephemera-instagram.ts: the result goes into <head ephVideoUrl>, "null" = not found.
if (location.pathname.includes("stories") == true) {
  (() => {
    var KEYS = ["hdSrc", "hd_src", "playbackUrl", "progressiveUrl", "sdSrc", "sd_src", "video_url"];
    function isVideoUrl(u: unknown): u is string {
      return (
        typeof u === "string" &&
        u.indexOf("https://") === 0 &&
        (u.indexOf(".mp4") !== -1 || u.indexOf("/o1/v/") !== -1)
      );
    }
    function walk(input: unknown, depth: number, seen: WeakSet<object>): string | null {
      if (!input || typeof input !== "object" || depth > 6 || seen.has(input)) return null;
      const obj = input as Record<string, unknown>;
      seen.add(obj);
      for (var i = 0; i < KEYS.length; i++) {
        const kv = obj[KEYS[i]];
        if (isVideoUrl(kv)) return kv;
      }
      var ks = Object.keys(obj);
      for (var j = 0; j < ks.length; j++) {
        var v: unknown;
        try {
          v = obj[ks[j]];
        } catch (e) {
          continue;
        }
        if (isVideoUrl(v)) return v;
        if (v && typeof v === "object") {
          var r: string | null = walk(v, depth + 1, seen);
          if (r) return r;
        }
      }
      return null;
    }
    function fromFiber(el: Element): string | null {
      var key = Object.keys(el).filter(function (k) {
        return k.indexOf("__reactFiber") === 0;
      })[0];
      if (!key) return null;
      var seen = new WeakSet<object>();
      var host = el as unknown as Record<string, ReactFiberLike | null | undefined>;
      for (var f = host[key], n = 0; f && n < 30; n++, f = f.return) {
        var r = walk(f.memoizedProps, 0, seen);
        if (r) return r;
      }
      return null;
    }
    var found: string | null = null;
    var videos = Array.prototype.filter.call(document.querySelectorAll<HTMLVideoElement>("video"), function (v: HTMLVideoElement) {
      return v.offsetHeight > 0;
    });
    for (var i = videos.length - 1; i >= 0 && !found; i--) found = fromFiber(videos[i]);
    console.log("[Ephemera] story video url:", found);
    document.head.setAttribute("ephVideoUrl", found || "null");
  })();
}

});
