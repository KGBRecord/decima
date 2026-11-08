import { Hash, MessageCircle, Server, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { DiscordInfo } from '@/lib/hooks';
import { Badge, Card } from './ui';

export function ContextCard({ info }: { info: DiscordInfo }) {
  if (!info.onDiscord)
    return (
      <Card className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-warn" />
        <div><div className="font-semibold text-white">Discord tab not active</div>
          <div className="text-zinc-400">Switch to a discord.com tab to detect the server and channel.</div></div>
      </Card>
    );
  if (!info.ctx)
    return (
      <Card className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-warn" />
        <div><div className="font-semibold text-white">No channel detected</div>
          <div className="text-zinc-400">Open a channel or DM. If the tab was opened before install, reload it.</div></div>
      </Card>
    );
  const c = info.ctx;
  return (
    <Card className="space-y-1.5">
      <div className="flex items-center justify-between" title={`guild ${c.guildId} · channel ${c.channelId}`}>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Active target</span>
        {c.canSend ? <Badge tone="ok"><CheckCircle2 className="h-3 w-3" />Can send</Badge> : <Badge tone="bad">No message box</Badge>}
      </div>
      <div className="flex items-center gap-2 text-white"><Server className="h-4 w-4 text-zinc-400" /><span className="truncate font-semibold">{c.guildName}</span></div>
      <div className="flex items-center gap-2 text-white">
        {c.isDM ? <MessageCircle className="h-4 w-4 text-zinc-400" /> : <Hash className="h-4 w-4 text-zinc-400" />}
        <span className="truncate">{c.channelName}</span>
      </div>
    </Card>
  );
}
