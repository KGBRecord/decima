import { useCallback, useEffect, useState } from 'react';
import { runItem, settingsItem } from './storage';
import { activeDiscordTab, fetchContext, useTabHooks } from './tabs';
import { DEFAULT_SETTINGS, IDLE_RUN, type DiscordContext, type RunState, type Settings } from './types';

export function useSettings() {
  const [settings, setLocal] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    settingsItem.getValue().then(setLocal);
    return settingsItem.watch((v) => setLocal(v ?? DEFAULT_SETTINGS));
  }, []);
  const update = useCallback((patch: Partial<Settings>) => {
    setLocal((s) => { const n = { ...s, ...patch }; settingsItem.setValue(n); return n; });
  }, []);
  return [settings, update] as const;
}

export function useRun(): RunState {
  const [run, setRun] = useState<RunState>(IDLE_RUN);
  useEffect(() => {
    runItem.getValue().then(setRun);
    return runItem.watch((v) => setRun(v ?? IDLE_RUN));
  }, []);
  return run;
}

export interface DiscordInfo { tabId: number | null; onDiscord: boolean; ctx: DiscordContext | null }

export function useDiscord(): DiscordInfo & { refresh: () => void } {
  const [info, setInfo] = useState<DiscordInfo>({ tabId: null, onDiscord: false, ctx: null });
  const refresh = useCallback(async () => {
    const tab = await activeDiscordTab();
    if (!tab?.id) return setInfo({ tabId: null, onDiscord: false, ctx: null });
    setInfo({ tabId: tab.id, onDiscord: true, ctx: await fetchContext(tab.id) });
  }, []);
  useEffect(() => {
    refresh();
    const off = useTabHooks(refresh);
    const iv = setInterval(refresh, 2000);
    return () => { off(); clearInterval(iv); };
  }, [refresh]);
  return { ...info, refresh };
}

import { activeEphemeraTab, type EphemeraTab } from './ephemera-tabs';

export function useEphemeraTab(): EphemeraTab | null {
  const [tab, setTab] = useState<EphemeraTab | null>(null);
  const refresh = useCallback(async () => setTab(await activeEphemeraTab()), []);
  useEffect(() => {
    refresh();
    const off = useTabHooks(refresh);
    const iv = setInterval(refresh, 1500);
    return () => { off(); clearInterval(iv); };
  }, [refresh]);
  return tab;
}
