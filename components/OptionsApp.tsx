import { RotateCcw } from 'lucide-react';
import { useSettings } from '@/lib/hooks';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { SettingsForm } from './SettingsForm';
import { Button, Card } from './ui';

export function OptionsApp() {
  const [settings, update] = useSettings();
  return (
    <div className="mx-auto max-w-xl space-y-4 p-8">
      <h1 className="text-xl font-bold text-white">Decima — Options</h1>
      <Card><SettingsForm settings={settings} update={update} /></Card>
      <Button variant="ghost" onClick={() => update(DEFAULT_SETTINGS)}><RotateCcw className="h-4 w-4" />Reset to defaults</Button>
      <div className="pt-4 text-[12px] text-zinc-500">Decima v{chrome.runtime.getManifest().version} · by <a className="text-acc hover:underline" href="https://github.com/KGBRecord" target="_blank" rel="noreferrer">KGB Record</a></div>
    </div>
  );
}
