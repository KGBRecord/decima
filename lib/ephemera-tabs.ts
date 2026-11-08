export type StoryPlatform = 'instagram' | 'facebook' | 'whatsapp';

export interface EphemeraTab { tabId: number; platform: StoryPlatform; url: string; title: string }

const HOSTS: { re: RegExp; platform: StoryPlatform }[] = [
  { re: /^https?:\/\/([a-z0-9-]+\.)?instagram\.com\//i, platform: 'instagram' },
  { re: /^https?:\/\/([a-z0-9-]+\.)?facebook\.com\//i, platform: 'facebook' },
  { re: /^https?:\/\/web\.whatsapp\.com\//i, platform: 'whatsapp' },
];

export async function activeEphemeraTab(): Promise<EphemeraTab | null> {
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!t?.id || !t.url) return null;
  const hit = HOSTS.find((h) => h.re.test(t.url!));
  return hit ? { tabId: t.id, platform: hit.platform, url: t.url, title: t.title ?? '' } : null;
}

export function runEphemera(tabId: number) {
  return chrome.runtime.sendMessage({ ephemeraRun: true, tabId });
}
