import { getIGDtsg } from './dtsg';
import { state } from './state';
import { registerListeners } from './listeners';
import { startObserver } from './observer';
import { registerProfileBridge } from './profile-bridge';
import { addbutton, addExploreDownloadButtons, addSingleImageDownloadButtons, cleanupIgDownloadButtons } from './grid';
import { addVideoDownloadButton } from './video';

export function initInstagram(): void {
  state.tokendsg = getIGDtsg();

  chrome.runtime.sendMessage({ openig: true }, () => {
    console.log("Download handler initialized");
  });

  registerListeners();
  registerProfileBridge();
  startObserver();

  // Initialize
  addbutton();
  try {
    addVideoDownloadButton();
  } catch (e) {}
  try {
    addExploreDownloadButtons();
  } catch (e) {}
  try {
    addSingleImageDownloadButtons();
  } catch (e) {}
  try {
    cleanupIgDownloadButtons();
  } catch (e) {}
  setInterval(function () {
    if (document.hidden) return; // Không quét khi tab chạy nền -> tiết kiệm CPU, tránh giật khi quay lại
    try {
      addVideoDownloadButton();
    } catch (e) {}
    try {
      addExploreDownloadButtons();
    } catch (e) {}
    try {
      addSingleImageDownloadButtons();
    } catch (e) {}
    try {
      cleanupIgDownloadButtons();
    } catch (e) {}
  }, 2000);

}
