import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  outDir: 'dist',
  outDirTemplate: '.',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Dissend',
    description: 'Batch-upload files to Discord (10 per message) and save stories from Instagram, Facebook and WhatsApp Web.',
    permissions: ['sidePanel', 'storage', 'activeTab', 'tabs', 'contextMenus', 'downloads', 'scripting'],
    host_permissions: [
      'https://discord.com/*', 'https://*.discord.com/*',
      '*://*.instagram.com/*', '*://*.cdninstagram.com/*',
      '*://*.facebook.com/*', '*://*.fbcdn.net/*', '*://*.whatsapp.com/*',
    ],
    action: { default_title: 'Dissend' },
    side_panel: { default_path: 'sidepanel.html' },
    minimum_chrome_version: '116',
  },
});
