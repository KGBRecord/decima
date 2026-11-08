import { useState } from 'react';
import { Settings as Cog, Upload, Info } from 'lucide-react';
import clsx from 'clsx';
import { useSettings } from '@/lib/hooks';
import { UploadPanel } from './UploadPanel';
import { SettingsForm } from './SettingsForm';
import { Card } from './ui';

type Tab = 'upload' | 'settings' | 'about';

export function SidePanelApp() {
  const [tab, setTab] = useState<Tab>('upload');
  const [settings, update] = useSettings();
  const tabs: { id: Tab; label: string; icon: typeof Upload }[] = [
    { id: 'upload', label: 'Upload', icon: Upload }, { id: 'settings', label: 'Settings', icon: Cog }, { id: 'about', label: 'About', icon: Info },
  ];
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-ink-900 bg-ink-800 px-3 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blurple text-white"><Upload className="h-4 w-4" /></div>
        <div><div className="font-bold leading-tight text-white">Dissend</div><div className="text-[11px] leading-tight text-zinc-400">Send files to Discord, 10 per message</div></div>
      </header>
      <nav className="flex border-b border-ink-900 bg-ink-800">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-[12px] font-medium', tab === t.id ? 'border-blurple text-white' : 'border-transparent text-zinc-400 hover:text-white')}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-auto p-3">
        {tab === 'upload' && <UploadPanel settings={settings} />}
        {tab === 'settings' && <Card><SettingsForm settings={settings} update={update} /></Card>}
        {tab === 'about' && (
          <div className="space-y-3">
            <Card className="space-y-2 text-zinc-300">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blurple text-white"><Upload className="h-5 w-5" /></div>
                <div>
                  <div className="text-base font-bold text-white">Dissend</div>
                  <div className="text-[11px] text-zinc-400">Version {chrome.runtime.getManifest().version}</div>
                </div>
              </div>
              <p>Batch-upload files to Discord, up to 10 per message.</p>
            </Card>
            <Card className="space-y-1.5 text-zinc-300">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Author</div>
              <div className="font-semibold text-white">KGB Record</div>
              <div className="text-[11px] italic text-zinc-500">code is our music</div>
              <div className="flex flex-col gap-1 pt-1 text-[12px]">
                <a className="text-blurple hover:underline" href="https://github.com/KGBRecord" target="_blank" rel="noreferrer">github.com/KGBRecord</a>
                <a className="text-blurple hover:underline" href="https://github.com/KGBRecord/dissend" target="_blank" rel="noreferrer">Source code &amp; issues</a>
              </div>
            </Card>
            <Card className="space-y-2 text-zinc-300">
              <div className="font-semibold text-white">How Dissend uploads</div>
              <p>The extension detects the active Discord server and channel, splits your files into groups of up to 10, and posts each group as one message using Discord's own composer (paste, then Enter).</p>
              <p>Files travel from the side panel to the Discord tab in 3 MB chunks. Keep the panel open until the run finishes; switching channels mid-run aborts for safety.</p>
            </Card>
            <div className="pb-2 text-center text-[11px] text-zinc-500">Unofficial. Not affiliated with Discord. © 2026 KGB Record · MIT</div>
          </div>
        )}
      </main>
    </div>
  );
}
