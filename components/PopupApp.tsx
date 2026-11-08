import { Download, ExternalLink, PanelRight, Settings as Cog } from 'lucide-react';
import { Logo } from './Logo';
import { useDiscord, useRun, useSettings, useEphemeraTab } from '@/lib/hooks';
import { runEphemera } from '@/lib/ephemera-tabs';
import { ContextCard } from './ContextCard';
import { Badge, Button, Card, Field, inputCls, Progress } from './ui';

export function PopupApp() {
  const info = useDiscord();
  const ephemera = useEphemeraTab();
  const run = useRun();
  const [settings, update] = useSettings();
  const openPanel = async () => {
    const w = await chrome.windows.getCurrent();
    if (w.id) await chrome.sidePanel.open({ windowId: w.id });
    window.close();
  };
  const active = run.status === 'running' || run.status === 'paused';
  return (
    <div className="w-[340px] space-y-3 p-3">
      <header className="flex items-center gap-2">
        <Logo size={32} />
        <div className="flex-1"><div className="font-bold text-white">Decima</div><div className="text-[11px] text-zinc-400">Many files → Discord, 10 per message</div></div>
        <button title="Options" onClick={() => chrome.runtime.openOptionsPage()} className="text-zinc-400 hover:text-white"><Cog className="h-4 w-4" /></button>
      </header>
      <ContextCard info={info} />
      {(active || run.status === 'done') && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Current run</span><Badge tone={run.status === 'done' ? 'ok' : 'warn'}>{run.status}</Badge></div>
          <Progress value={run.totalFiles ? run.sentFiles / run.totalFiles : 0} />
          <div className="text-[11px] text-zinc-400">{run.sentFiles}/{run.totalFiles} files · {run.target}</div>
        </Card>
      )}
      <Card className="grid grid-cols-2 gap-3">
        <Field label="Per message"><input type="number" min={1} max={10} className={inputCls} value={settings.perMessage} onChange={(e) => update({ perMessage: Math.min(10, Math.max(1, Number(e.target.value) || 10)) })} /></Field>
        <Field label="Delay (s)"><input type="number" min={1} max={120} className={inputCls} value={settings.delaySec} onChange={(e) => update({ delaySec: Math.min(120, Math.max(1, Number(e.target.value) || 3)) })} /></Field>
      </Card>
      {ephemera && <Button className="w-full" variant="success" onClick={() => { runEphemera(ephemera.tabId); window.close(); }}><Download className="h-4 w-4" />Save story from this {ephemera.platform} page</Button>}
      <Button className="w-full" onClick={openPanel}><PanelRight className="h-4 w-4" />Open uploader side panel</Button>
      {!info.onDiscord && <Button className="w-full" variant="ghost" onClick={() => chrome.tabs.create({ url: 'https://discord.com/channels/@me' })}><ExternalLink className="h-4 w-4" />Open Discord</Button>}
    </div>
  );
}
