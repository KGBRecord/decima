import type { EphButton } from './types';

export function getDownloadButtonIcon(btn: EphButton | null): HTMLElement | null | undefined {
  try {
    return btn && (btn.getElementsByClassName("eph_toolkit_icon")[0] as HTMLElement | undefined);
  } catch (e) {
    return null;
  }
}

export function markDownloadButtonBusy(btn: EphButton) {
  var icon = getDownloadButtonIcon(btn);
  if (!icon) return;
  if (!icon.hasAttribute("data-eph-original-bg")) {
    icon.setAttribute(
      "data-eph-original-bg",
      icon.style.backgroundImage || "",
    );
  }
  icon.classList.add("eph_toolkit_loader");
  try {
    clearTimeout(btn.__ephRestoreTimer);
    btn.__ephRestoreTimer = setTimeout(function () {
      restoreDownloadButton(btn);
    }, 8000);
  } catch (e) {}
}

export function restoreDownloadButton(btn: EphButton | null) {
  var icon = getDownloadButtonIcon(btn);
  if (!icon) return;
  icon.classList.remove("eph_toolkit_loader");
  if (icon.hasAttribute("data-eph-original-bg")) {
    icon.style.backgroundImage = icon.getAttribute("data-eph-original-bg") as string;
    icon.removeAttribute("data-eph-original-bg");
  } else {
    icon.style.backgroundImage = "";
  }
  try {
    clearTimeout(btn!.__ephRestoreTimer);
  } catch (e) {}
}

export function guardDownloadButtonEvents(btn: EphButton) {
  if (!btn || btn.__ephGuarded) return;
  btn.__ephGuarded = true;
  [
    "pointerdown",
    "mousedown",
    "mouseup",
    "touchstart",
    "touchend",
    "dblclick",
  ].forEach(function (type) {
    btn.addEventListener(
      type,
      function (e) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (_) {}
      },
      true,
    );
  });
}

export function ephFindMostVisibleFbDownloadButton() {
  var best: EphButton | null = null,
    bestArea = 0;
  var vh = window.innerHeight || document.documentElement.clientHeight;
  var vw = window.innerWidth || document.documentElement.clientWidth;
  document.querySelectorAll<EphButton>(".eph_toolkit_dl_btn").forEach(function (btn) {
    var anchor =
      btn.__ephVideoElement && document.contains(btn.__ephVideoElement)
        ? btn.__ephVideoElement
        : btn.parentElement || btn;
    var r: DOMRect;
    try {
      r = anchor.getBoundingClientRect();
    } catch (e) {
      return;
    }
    var w = Math.min(r.right, vw) - Math.max(r.left, 0);
    var h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (w <= 0 || h <= 0) return;
    var area = w * h;
    if (area > bestArea) {
      bestArea = area;
      best = btn;
    }
  });
  return best;
}
