import { setupEphemera } from '@/lib/ephemera/background';

export default defineBackground(() => {
  setupEphemera();

  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: 'dissend-open', title: 'Open Dissend side panel', contexts: ['page'], documentUrlPatterns: ['https://discord.com/*'] });
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'dissend-open' && tab?.windowId) chrome.sidePanel.open({ windowId: tab.windowId });
  });

  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg?.type === 'OPEN_SIDEPANEL') {
      chrome.windows.getCurrent().then((w) => { if (w.id) chrome.sidePanel.open({ windowId: w.id }); });
    }
    return false;
  });
});
