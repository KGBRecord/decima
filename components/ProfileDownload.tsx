import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarRange, CircleCheck, CircleUserRound, Download, Heart, Images, Layers, ListFilter, Loader2, MessageCircle, RotateCcw, ShieldCheck, TriangleAlert, GalleryHorizontalEnd } from 'lucide-react';
import clsx from 'clsx';
import type { HighlightSummary, ProfileFilterInput, ProfileInfo, ProfileProgress, ProfileStartResult } from '@/lib/ephemera/profile-protocol';
import { Button, Card, Progress, inputCls } from './ui';

/** inputCls carries w-full, which beats a width class; the small count boxes need their own width. */
const countCls = inputCls.replace('w-full ', '');

type Phase = 'idle' | 'loading' | 'ready' | 'running' | 'done' | 'error';

const numOrNull = (v: string): number | null => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Math.max(0, Math.floor(Number(v))));
const clampInt = (v: string, lo: number, hi: number, fallback: number): number => {
  if (v.trim() === '') return fallback;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : fallback;
};

function Section({ icon: Icon, title, hint, children }: { icon: typeof Layers; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400"><Icon className="h-3.5 w-3.5" />{title}</div>
      {children}
      {hint && <div className="text-[11px] text-zinc-500">{hint}</div>}
    </section>
  );
}

function Pair({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

export function ProfileDownload({ tabId, username }: { tabId: number; username: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [total, setTotal] = useState<number | null>(null);
  const [highlightList, setHighlightList] = useState<HighlightSummary[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [wantPosts, setWantPosts] = useState(true);
  const [wantHighlights, setWantHighlights] = useState(false);
  const [wantAvatar, setWantAvatar] = useState(false);
  const [message, setMessage] = useState('');
  const [percent, setPercent] = useState(0);

  // Boxes start empty with a hint; empty means the default (first post, up to 20 posts, top 3).
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [topLike, setTopLike] = useState(false);
  const [topLikeN, setTopLikeN] = useState('');
  const [topCmt, setTopCmt] = useState(false);
  const [topCmtN, setTopCmtN] = useState('');
  const [likesMin, setLikesMin] = useState('');
  const [likesMax, setLikesMax] = useState('');
  const [cmtMin, setCmtMin] = useState('');
  const [cmtMax, setCmtMax] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const tab = useRef(tabId);
  tab.current = tabId;

  /** Ask the page how many posts this profile has. Re-runs when the profile or tab changes. */
  const load = useCallback(async () => {
    setPhase('loading'); setMessage(''); setPercent(0);
    try {
      const info = (await chrome.tabs.sendMessage(tabId, { type: 'EPH_PROFILE_INFO' })) as ProfileInfo | undefined;
      if (!info?.ok) throw new Error(info?.error || 'The page did not answer.');
      setTotal(info.totalPosts ?? null);
      setHighlightList(info.highlights ?? null);
      setPicked(new Set((info.highlights ?? []).map((h) => h.id)));
      setPhase('ready');
    } catch (e) {
      setMessage(e instanceof Error && /Receiving end/.test(e.message) ? 'The Instagram tab has not loaded Ephemera yet. Reload the tab and try again.' : e instanceof Error ? e.message : 'Could not read this profile.');
      setPhase('error');
    }
  }, [tabId]);

  useEffect(() => { void load(); }, [load, username]);

  // progress while a run is going
  useEffect(() => {
    const onMsg = (m: unknown) => {
      const p = m as Partial<ProfileProgress> | null;
      if (!p || p.type !== 'EPH_PROFILE_PROGRESS') return;
      setPercent(p.percent ?? 0);
      setMessage(p.text ?? '');
      if (p.phase === 'done') setPhase('done');
      else if (p.phase === 'error') setPhase('error');
      else setPhase('running');
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, []);

  const max = total ?? 9999;
  const defaultTo = Math.min(max, 20);
  const fromN = clampInt(from, 1, max, 1);
  const toN = Math.max(fromN, to.trim() === '' ? Math.min(max, fromN + 19) : clampInt(to, 1, max, defaultTo));
  const inRange = toN - fromN + 1;
  // Top-N picks and min/max filters can only shrink the range, so say "up to" unless the number is exact.
  const topOnly = topLike !== topCmt ? clampInt(topLike ? topLikeN : topCmtN, 1, 999, 3) : null; // empty box = 3
  const narrowed = [likesMin, likesMax, cmtMin, cmtMax, dateFrom, dateTo].some((v) => v.trim() !== '') || (topLike && topCmt);
  const count = topOnly !== null ? Math.min(topOnly, inRange) : inRange;
  const upTo = narrowed || topOnly !== null;
  const total_hl = highlightList?.length ?? 0;
  const pickedCount = highlightList ? [...picked].filter((id) => highlightList.some((h) => h.id === id)).length : 0;
  const allPicked = highlightList !== null && pickedCount === total_hl;
  const hlOn = wantHighlights && (highlightList === null || pickedCount > 0);
  const nothing = !wantPosts && !hlOn && !wantAvatar;
  const hlWord = hlOn ? (highlightList && !allPicked ? `${pickedCount} highlight${pickedCount === 1 ? '' : 's'}` : 'highlights') : null;
  const extras = [hlWord, wantAvatar && (wantPosts || hlOn ? 'picture' : 'profile picture')].filter(Boolean) as string[];
  const label = wantPosts
    ? `Download ${upTo ? 'up to ' : ''}${count} post${count === 1 ? '' : 's'}${extras.length ? ` + ${extras.join(' + ')}` : ''}`
    : extras.length ? `Download ${extras.join(' + ')}` : 'Choose what to download';

  const start = async () => {
    const filters: ProfileFilterInput = {
      postsRange: { from: fromN, to: toN },
      likes: { min: numOrNull(likesMin), max: numOrNull(likesMax) },
      comments: { min: numOrNull(cmtMin), max: numOrNull(cmtMax) },
      date: { from: dateFrom || null, to: dateTo || null },
      sorting: { mostLikes: topLike ? clampInt(topLikeN, 1, 999, 3) : null, mostComments: topCmt ? clampInt(topCmtN, 1, 999, 3) : null },
    };
    setPhase('running'); setPercent(0); setMessage('Starting');
    try {
      const res = (await chrome.tabs.sendMessage(tab.current, { type: 'EPH_PROFILE_START', filters, include: { posts: wantPosts, highlights: wantHighlights && pickedCount > 0, avatar: wantAvatar, highlightIds: allPicked ? null : [...picked] } })) as ProfileStartResult | undefined;
      if (!res?.ok) { setMessage(res?.error || 'The page refused to start.'); setPhase('error'); }
    } catch {
      setMessage('Lost contact with the Instagram tab. Reload it and try again.'); setPhase('error');
    }
  };

  const busy = phase === 'running';

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Download from profile</div>
          <div className="mt-1 truncate font-semibold text-white">@{username}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-bold leading-none text-white tabular-nums">{phase === 'loading' ? '…' : total ?? '?'}</div>
          <div className="mt-1 text-[11px] text-zinc-500">posts</div>
        </div>
      </div>

      {phase === 'loading' && (
        <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" />Reading the profile</div>
      )}

      {(phase === 'ready' || phase === 'running' || phase === 'done' || (phase === 'error' && total !== null)) && (
        <fieldset disabled={busy} className="m-0 min-w-0 space-y-4 border-0 p-0 disabled:opacity-60">
          <Section icon={Images} title="What to download">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-zinc-300"><input type="checkbox" className="eph-chk" checked={wantPosts} onChange={(e) => setWantPosts(e.target.checked)} /><GalleryHorizontalEnd className="h-3.5 w-3.5 shrink-0 text-zinc-400" /><span className="flex-1">Posts</span><span className="text-[11px] text-zinc-500">{total ?? '?'}</span></label>
              <label className="flex items-center gap-2 text-zinc-300"><input type="checkbox" className="eph-chk" checked={wantHighlights} onChange={(e) => setWantHighlights(e.target.checked)} /><Layers className="h-3.5 w-3.5 shrink-0 text-zinc-400" /><span className="flex-1">Highlights</span><span className="text-[11px] text-zinc-500">{highlightList === null ? '?' : total_hl === 0 ? 'none' : wantHighlights ? `${pickedCount} of ${total_hl}` : `${total_hl} ${total_hl === 1 ? 'reel' : 'reels'}`}</span></label>
              {wantHighlights && highlightList && total_hl > 0 && (
                <div className="ml-6 space-y-1.5 rounded-md border border-ink-600 bg-ink-900/60 p-2">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Pick the ones to download</span>
                    <span className="flex gap-2">
                      <button type="button" className="cursor-pointer text-acc hover:underline disabled:cursor-default disabled:text-zinc-600 disabled:no-underline" disabled={allPicked} onClick={() => setPicked(new Set(highlightList.map((h) => h.id)))}>All</button>
                      <span aria-hidden className="text-zinc-700">|</span><button type="button" className="cursor-pointer text-acc hover:underline disabled:cursor-default disabled:text-zinc-600 disabled:no-underline" disabled={pickedCount === 0} onClick={() => setPicked(new Set())}>None</button>
                    </span>
                  </div>
                  <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
                    {highlightList.map((h) => (
                      <li key={h.id}>
                        <label className={clsx('flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-ink-800', picked.has(h.id) ? 'text-white' : 'text-zinc-400 hover:text-white [&_img]:opacity-65 hover:[&_img]:opacity-100')}>
                          <input type="checkbox" className="eph-chk" checked={picked.has(h.id)} onChange={(e) => setPicked((prev) => { const n = new Set(prev); if (e.target.checked) n.add(h.id); else n.delete(h.id); return n; })} />
                          {h.cover ? <img src={h.cover} alt="" width={28} height={28} loading="lazy" className="h-7 w-7 shrink-0 rounded-full border border-ink-600 object-cover" /> : <span className="h-7 w-7 shrink-0 rounded-full border border-ink-600 bg-ink-800" />}
                          <span className="min-w-0 flex-1 truncate" title={h.title || 'Untitled'}>{h.title || 'Untitled'}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  {pickedCount === 0 && <div className="text-[11px] text-warn">Pick at least one, or untick Highlights.</div>}
                </div>
              )}
              <label className="flex items-center gap-2 text-zinc-300"><input type="checkbox" className="eph-chk" checked={wantAvatar} onChange={(e) => setWantAvatar(e.target.checked)} /><CircleUserRound className="h-3.5 w-3.5 shrink-0 text-zinc-400" /><span className="flex-1">Profile picture</span><span className="text-[11px] text-zinc-500">full size</span></label>
            </div>
          </Section>

          {wantPosts && (<>
          <Section icon={Layers} title="Range" hint={`${inRange} post${inRange === 1 ? '' : 's'} in range, newest first`}>
            <Pair>
              <input aria-label="First post" className={clsx(inputCls, 'text-center')} type="number" min={1} max={total ?? undefined} placeholder="1" value={from} onChange={(e) => setFrom(e.target.value)} onBlur={() => { if (from.trim() !== '') setFrom(String(fromN)); }} />
              <span className="text-zinc-500">to</span>
              <input aria-label="Last post" className={clsx(inputCls, 'text-center')} type="number" min={1} max={total ?? undefined} placeholder={String(defaultTo === 9999 ? 20 : defaultTo)} value={to} onChange={(e) => setTo(e.target.value)} onBlur={() => { if (to.trim() !== '') setTo(String(toN)); }} />
            </Pair>
          </Section>

          <Section icon={ListFilter} title="Only the best (optional)">
            <label className="flex items-center gap-2 text-zinc-300">
              <input type="checkbox" className="eph-chk" checked={topLike} onChange={(e) => setTopLike(e.target.checked)} />
              <Heart className="h-3.5 w-3.5 shrink-0 text-zinc-400" /><span className="flex-1 whitespace-nowrap">Most liked</span>
              <input aria-label="How many most liked" className={clsx(countCls, 'w-16 shrink-0 text-center disabled:opacity-40')} type="number" min={1} placeholder="3" value={topLikeN} disabled={!topLike} onChange={(e) => setTopLikeN(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-zinc-300">
              <input type="checkbox" className="eph-chk" checked={topCmt} onChange={(e) => setTopCmt(e.target.checked)} />
              <MessageCircle className="h-3.5 w-3.5 shrink-0 text-zinc-400" /><span className="flex-1 whitespace-nowrap">Most commented</span>
              <input aria-label="How many most commented" className={clsx(countCls, 'w-16 shrink-0 text-center disabled:opacity-40')} type="number" min={1} placeholder="3" value={topCmtN} disabled={!topCmt} onChange={(e) => setTopCmtN(e.target.value)} />
            </label>
          </Section>

          <Section icon={CalendarRange} title="Filters (optional)" hint="Leave a field empty to include everything.">
            <div className="space-y-2">
              <Pair>
                <span className="w-20 shrink-0 text-zinc-400">Likes</span>
                <input aria-label="Minimum likes" className={clsx(inputCls, 'min-w-0 text-center')} type="number" min={0} placeholder="min" value={likesMin} onChange={(e) => setLikesMin(e.target.value)} />
                <input aria-label="Maximum likes" className={clsx(inputCls, 'min-w-0 text-center')} type="number" min={0} placeholder="max" value={likesMax} onChange={(e) => setLikesMax(e.target.value)} />
              </Pair>
              <Pair>
                <span className="w-20 shrink-0 text-zinc-400">Comments</span>
                <input aria-label="Minimum comments" className={clsx(inputCls, 'min-w-0 text-center')} type="number" min={0} placeholder="min" value={cmtMin} onChange={(e) => setCmtMin(e.target.value)} />
                <input aria-label="Maximum comments" className={clsx(inputCls, 'min-w-0 text-center')} type="number" min={0} placeholder="max" value={cmtMax} onChange={(e) => setCmtMax(e.target.value)} />
              </Pair>
              <Pair>
                <span className="w-20 shrink-0 text-zinc-400">Date</span>
                <input aria-label="From date" title="From" className={clsx(inputCls, 'min-w-0 text-[12px] [color-scheme:dark]')} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <input aria-label="To date" title="To" className={clsx(inputCls, 'min-w-0 text-[12px] [color-scheme:dark]')} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </Pair>
            </div>
          </Section>
          </>)}
        </fieldset>
      )}

      {(busy || phase === 'done') && (
        <div className="space-y-1.5">
          <Progress value={percent / 100} />
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            {phase === 'done' ? <CircleCheck className="h-3.5 w-3.5 text-ok" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span className="truncate" title={message}>{message}</span>
            <span className="ml-auto tabular-nums">{percent}%</span>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="flex items-start gap-2 rounded-md border border-bad/40 bg-bad/10 p-2.5 text-[12px] text-zinc-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-bad" /><span className="min-w-0 break-words">{message}</span>
        </div>
      )}

      <div className="flex min-w-0 gap-2 pt-2">
        {(phase === 'ready' || phase === 'done' || (phase === 'error' && total !== null)) && (
          <Button className="min-w-0 flex-1" onClick={start} disabled={nothing} title={label}><Download className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span></Button>
        )}
        {busy && <Button className="flex-1" disabled><Loader2 className="h-4 w-4 animate-spin" />Working</Button>}
        {(phase === 'error' && total === null) && <Button className="flex-1" variant="ghost" onClick={() => void load()}><RotateCcw className="h-4 w-4" />Try again</Button>}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500"><ShieldCheck className="h-3.5 w-3.5 shrink-0" />Posts are read with your own Instagram session and zipped in the browser. Nothing is sent anywhere else.</div>
    </Card>
  );
}
