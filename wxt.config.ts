import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  outDir: 'dist',
  outDirTemplate: '.',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Dissend',
    description: 'Pick many files and send them to the active Discord channel, 10 per message.',
    permissions: ['sidePanel', 'storage', 'activeTab', 'tabs', 'contextMenus'],
    host_permissions: [
      'https://discord.com/*', 'https://*.discord.com/*',
    ],
    action: { default_title: 'Dissend' },
    side_panel: { default_path: 'sidepanel.html' },
    minimum_chrome_version: '116',
  },
});
