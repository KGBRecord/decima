/** Folder scanning: turn dropped items / a directory <input> into a flat file list with relative paths. */

export interface ScannedFile { file: File; path: string }

const isHidden = (name: string) => name.startsWith('.');

const readFile = (e: FileSystemFileEntry) => new Promise<File>((res, rej) => e.file(res, rej));

async function readAllEntries(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = dir.createReader();
  const out: FileSystemEntry[] = [];
  // readEntries returns results in pages; loop until it returns an empty page
  for (;;) {
    const page = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
    if (!page.length) return out;
    out.push(...page);
  }
}

async function walk(entry: FileSystemEntry, out: ScannedFile[]): Promise<void> {
  if (isHidden(entry.name)) return;
  if (entry.isFile) {
    try {
      const file = await readFile(entry as FileSystemFileEntry);
      out.push({ file, path: entry.fullPath.replace(/^\//, '') });
    } catch { /* unreadable file: skip */ }
  } else if (entry.isDirectory) {
    for (const child of await readAllEntries(entry as FileSystemDirectoryEntry)) await walk(child, out);
  }
}

/** Scan a drop event's items (files and any number of folders, recursively). Must be called synchronously from the drop handler. */
export async function scanDataTransfer(dt: DataTransfer): Promise<ScannedFile[]> {
  // Entries must be grabbed synchronously — DataTransferItemList is cleared after the event handler yields.
  const entries: FileSystemEntry[] = [];
  const loose: File[] = [];
  for (const item of [...dt.items]) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
    else { const f = item.getAsFile(); if (f) loose.push(f); }
  }
  const out: ScannedFile[] = loose.map((file) => ({ file, path: file.name }));
  for (const entry of entries) await walk(entry, out);
  return out;
}

/** Convert the result of an <input webkitdirectory> pick (recursive, flat FileList) into scanned files. */
export function scanDirectoryInput(list: FileList): ScannedFile[] {
  return [...list]
    .map((file) => ({ file, path: file.webkitRelativePath || file.name }))
    .filter((s) => !s.path.split('/').some(isHidden));
}
