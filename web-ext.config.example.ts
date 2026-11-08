import { defineWebExtConfig } from 'wxt';

// `pnpm dev` opens this Chrome with the extension loaded. The profile is kept
// in .wxt/chrome-profile so the Discord / Instagram logins survive restarts.
export default defineWebExtConfig({
  binaries: {
    chrome: 'path/to/your/chrome/or/chromium/binary', // Update this path to your Chrome or Chromium binary
  },
  chromiumProfile: new URL('./.wxt/chrome-profile', import.meta.url).pathname,
  keepProfileChanges: true,
  startUrls: ['https://discord.com/channels/@me'],
});
