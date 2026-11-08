import { getIGDtsg } from './dtsg';
import { state } from './state';
import { registerListeners } from './listeners';
import { injectStyles } from './styles';
import { startObserver } from './observer';
import { checkForProfilePage } from './profile-ui';
import { addbutton, addExploreDownloadButtons, addSingleImageDownloadButtons, cleanupIgDownloadButtons } from './grid';
import { addVideoDownloadButton } from './video';

export function initInstagram(): void {
  state.tokendsg = getIGDtsg();

  chrome.runtime.sendMessage({ openig: true }, () => {
    console.log("Download handler initialized");
  });

  registerListeners();
  injectStyles();
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

  // Add profile specific button when on profile pages
  setTimeout(checkForProfilePage, 1000);
  // Check periodically for profile page changes (Instagram uses client-side routing)
  setInterval(function () {
    if (!document.hidden) checkForProfilePage();
  }, 3000);
}
