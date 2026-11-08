import { storage } from 'wxt/utils/storage';
import { DEFAULT_SETTINGS, IDLE_RUN, type RunState, type Settings } from './types';

export const settingsItem = storage.defineItem<Settings>('sync:settings', { fallback: DEFAULT_SETTINGS });
export const runItem = storage.defineItem<RunState>('session:run', { fallback: IDLE_RUN });
