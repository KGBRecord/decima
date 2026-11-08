import { Download, Camera, Users, MessageCircle, AlertTriangle } from 'lucide-react';
import { runEphemera, type StoryPlatform } from '@/lib/ephemera-tabs';
import { useEphemeraTab } from '@/lib/hooks';
import { Button, Card } from './ui';

const META: Record<StoryPlatform, { label: string; Icon: typeof Camera; hint: string }> = {
  instagram: { label: 'Instagram', Icon: Camera, hint: 'Open a story or a profile, then download. Story/post buttons also appear on the page.' },
  facebook: { label: 'Facebook', Icon: Users, hint: 'Open a story, video or album, then download. Download buttons also appear on the page.' },
  whatsapp: { label: 'WhatsApp Web', Icon: MessageCircle, hint: 'Open a status, then download it.' },
};

export function EphemeraPanel() {
  const tab = useEphemeraTab();
  if (!tab)
    return (
      <Card className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-warn" />
        <div>
          <div className="font-semibold text-white">No supported tab</div>
          <div className="text-zinc-400">Switch to an Instagram, Facebook or WhatsApp Web tab to save stories. Reload the tab if it was open before installing.</div>
        </div>
      </Card>
    );
  const { label, Icon, hint } = META[tab.platform];
  return (
    <div className="space-y-3">
      <Card className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Active page</div>
        <div className="flex items-center gap-2 text-white"><Icon className="h-4 w-4 text-zinc-400" /><span className="font-semibold">{label}</span></div>
        <div className="truncate text-zinc-400" title={tab.title}>{tab.title || tab.url}</div>
        <div className="text-[11px] text-zinc-500">{hint}</div>
      </Card>
      <Button className="w-full" onClick={() => runEphemera(tab.tabId)}><Download className="h-4 w-4" />Download from this page</Button>
      <div className="text-[11px] text-zinc-500">Files are saved through Chrome's downloads. Everything runs locally, with no telemetry.</div>
    </div>
  );
}
