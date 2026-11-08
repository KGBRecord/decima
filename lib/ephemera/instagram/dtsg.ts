

export function getIGDtsg() {
  try {
    var html = document.documentElement.outerHTML;
    var m = html.match(/"dtsg":\{"token":"([^"]+)"/);
    if (m && m[1]) return m[1];
    m = html.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/);
    if (m && m[1]) return m[1];
    m = html.match(/name="fb_dtsg" value="([^"]+)"/);
    if (m && m[1]) return m[1];
  } catch (e) {}
  return "";
}
