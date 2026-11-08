import '@/assets/ephemera.css';
import {
  installCopyListener,
  installHistoryInterceptor,
  installMessageListener,
  installResizeListener,
  installRuntimeListener,
  installViewerObserver,
  startScanning,
} from '@/lib/ephemera/facebook/listeners';
import { installFbVideoResourceObserver } from '@/lib/ephemera/facebook/url-harvest';

export default defineContentScript({
  matches: ["*://*.facebook.com/*"],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    chrome.runtime.sendMessage({ openfacebook: true }, () => {
      console.log("dow:");
    });
    installMessageListener();
    installRuntimeListener();
    installViewerObserver();
    installHistoryInterceptor();
    installCopyListener();
    installResizeListener();
    installFbVideoResourceObserver();
    startScanning();
  },
});
