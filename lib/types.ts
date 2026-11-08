export interface DiscordContext {
  guildId: string;            // "@me" for DMs
  channelId: string;
  guildName: string;
  channelName: string;
  isDM: boolean;
  canSend: boolean;           // message box present
}

export interface Settings {
  perMessage: number;         // 1..10
  delaySec: number;           // pause between batches
  maxFileMB: number;          // per-file limit (free = 10)
  caption: string;
  captionMode: 'first' | 'all' | 'none';
  skipOversize: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  perMessage: 10,
  delaySec: 3,
  maxFileMB: 10,
  caption: '',
  captionMode: 'first',
  skipOversize: true,
};

export type RunStatus = 'idle' | 'running' | 'paused' | 'done' | 'stopped' | 'error';

export interface RunState {
  status: RunStatus;
  totalBatches: number;
  doneBatches: number;
  totalFiles: number;
  sentFiles: number;
  target?: string;
  message?: string;
  updatedAt: number;
}

export const IDLE_RUN: RunState = {
  status: 'idle', totalBatches: 0, doneBatches: 0, totalFiles: 0, sentFiles: 0, updatedAt: 0,
};

/** content-script <-> UI port protocol (chunked, JSON-safe) */
export type UiToContent =
  | { t: 'begin'; batchId: string; channelId: string; caption?: string; files: { name: string; type: string; size: number }[] }
  | { t: 'chunk'; batchId: string; fileIndex: number; data: string }
  | { t: 'commit'; batchId: string };

export type ContentToUi =
  | { t: 'stage'; batchId: string; stage: 'received' | 'pasted' | 'submitted' }
  | { t: 'done'; batchId: string }
  | { t: 'error'; batchId: string; error: string };

export const PORT_NAME = 'dbu-upload';
export const MAX_PER_MESSAGE = 10;
