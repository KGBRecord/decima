
export function fbVal(re: RegExp): string {
  try {
    var m = document.documentElement.innerHTML.match(re);
    return m && m[1] ? m[1] : "";
  } catch (e) {
    return "";
  }
}

export function buildFbStoryBody(VIDEOID: string) {
  var html = document.documentElement.innerHTML;
  var dtsg = "";
  var m =
    html.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/) ||
    html.match(/"dtsg":\{"token":"([^"]+)"/) ||
    html.match(/name="fb_dtsg" value="([^"]+)"/);
  if (m && m[1]) dtsg = m[1];
  var uid = "";
  try {
    uid = document.cookie.match(/c_user=(\d+)/)![1];
  } catch (e) {
    uid = fbVal(/"USER_ID":"(\d+)"/);
  }
  var lsd = fbVal(/"LSD",\[\],\{"token":"([^"]+)"/);
  var rev =
    fbVal(/"__spin_r":(\d+)/) ||
    fbVal(/"client_revision":(\d+)/) ||
    fbVal(/"rev":(\d+)/);
  var hs = fbVal(/"haste_session":"([^"]+)"/);
  var spinT = fbVal(/"__spin_t":(\d+)/);
  var spinB = fbVal(/"__spin_b":"([^"]+)"/) || "trunk";
  var jaz = 0;
  for (var i = 0; i < dtsg.length; i++) jaz += dtsg.charCodeAt(i);
  var jazoest = "2" + jaz;
  var variables = {
    bucketIDs: [String(VIDEOID)],
    scale: 2,
    blur: 20,
    shouldEnableArmadilloStoryReply: true,
    shouldEnableLiveInStories: true,
    feedbackSource: 65,
    useDefaultActor: false,
    feedLocation: "COMET_MEDIA_VIEWER",
    focusCommentID: null,
    shouldDeferLoad: false,
    isStoriesArchive: false,
    __relay_internal__pv__IsWorkUserrelayprovider: false,
  };
  var params: Record<string, string> = {
    av: uid,
    __user: uid,
    __a: "1",
    __req: "t",
    dpr: "1",
    __ccg: "EXCELLENT",
    __comet_req: "15",
    fb_dtsg: dtsg,
    jazoest: jazoest,
    lsd: lsd,
    __spin_b: spinB,
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "StoriesViewerBucketPrefetcherMultiBucketsQuery",
    variables: JSON.stringify(variables),
    server_timestamps: "true",
    doc_id: "9340191609394579",
  };
  if (rev) {
    params.__rev = rev;
    params.__spin_r = rev;
  }
  if (hs) {
    params.__hs = hs;
  }
  if (spinT) {
    params.__spin_t = spinT;
  }
  return new URLSearchParams(params).toString();
}

// Chạy khi trang web load
