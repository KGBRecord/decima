/** Toolbar feedback via badge (the Decima icon is never replaced). */
export function flashBadge(tabId: number | undefined, text: string, color: string): void {
  if (!tabId) return;
  chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: color });
  chrome.action.setBadgeText({ tabId: tabId, text: text });
  setTimeout(function () {
    chrome.action.setBadgeText({ tabId: tabId, text: "" }).catch(function () {});
  }, 2500);
}

export function animateIconArrowDown(tabId: number | undefined): void {
  flashBadge(tabId, "\u2193", "#23a55a");
}

export function animateIconFailed(tabId: number | undefined): void {
  flashBadge(tabId, "\u2715", "#f23f43");
}
