import '@/assets/ephemera.css';
import { initInstagram } from '@/lib/ephemera/instagram/init';

export default defineContentScript({
  matches: ["*://*.instagram.com/*"],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    initInstagram();
  },
});
