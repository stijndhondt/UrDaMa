import { Injectable, inject } from '@angular/core';
import { FILE_EXTENSION, message, parseProject, type Message } from '@lakudemis/core';
import { ProjectService } from './project.service';

/** The File System Access API (Chromium): not yet in TypeScript's DOM types. */
interface FilePickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
  excludeAcceptAllOption?: boolean;
}
interface FilePickerWindow {
  showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (
    options?: FilePickerOptions & { multiple?: boolean },
  ) => Promise<FileSystemFileHandle[]>;
}
/** Permission checks on a remembered handle (Chromium; not yet in TypeScript's DOM types). */
type WritableHandle = FileSystemFileHandle & {
  queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
};

const PICKER_TYPES = [
  { description: 'Lakudemis project', accept: { 'application/json': [FILE_EXTENSION] } },
];

export type FileResult =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly reason: Message | null };

/**
 * Saving and opening `.lakudemis.json` files (ticket 11 decisions): Save writes back to the same
 * file where the browser allows it, otherwise it downloads; Open imports a file into the app.
 */
@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly project = inject(ProjectService);
  private readonly picker = window as unknown as FilePickerWindow;

  /** Saves to the file the project came from, or asks where (Save as). */
  async save(): Promise<FileResult> {
    const handle = this.project.fileHandle as WritableHandle | null;
    if (handle && (await this.canWrite(handle))) return this.writeTo(handle);
    return this.saveAs();
  }

  async saveAs(): Promise<FileResult> {
    const suggestedName = `${fileSafe(this.project.name())}${FILE_EXTENSION}`;
    if (this.picker.showSaveFilePicker) {
      try {
        const handle = await this.picker.showSaveFilePicker({ suggestedName, types: PICKER_TYPES });
        return await this.writeTo(handle as WritableHandle);
      } catch (error) {
        return cancelled(error);
      }
    }
    // No file system access: download instead.
    const text = this.project.text();
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    this.project.markSaved(suggestedName, null, text);
    return { ok: true, name: suggestedName };
  }

  async open(): Promise<FileResult> {
    let file: File;
    let handle: FileSystemFileHandle | null = null;
    try {
      if (this.picker.showOpenFilePicker) {
        [handle] = (await this.picker.showOpenFilePicker({
          types: PICKER_TYPES,
          multiple: false,
        })) as [FileSystemFileHandle];
        file = await handle.getFile();
      } else {
        file = await pickWithInput();
      }
    } catch (error) {
      return cancelled(error);
    }
    const parsed = parseProject(await file.text());
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    this.project.load(parsed.model, { name: file.name, handle, saved: true });
    return { ok: true, name: file.name };
  }

  private async writeTo(handle: WritableHandle): Promise<FileResult> {
    const text = this.project.text();
    try {
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
    } catch {
      return { ok: false, reason: message('file.writeFailed') };
    }
    this.project.markSaved(handle.name, handle, text);
    return { ok: true, name: handle.name };
  }

  private async canWrite(handle: WritableHandle): Promise<boolean> {
    if (!handle.queryPermission) return true;
    if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
    return (await handle.requestPermission?.({ mode: 'readwrite' })) === 'granted';
  }
}

/** The user closing a picker is not an error. */
function cancelled(error: unknown): FileResult {
  if (error instanceof DOMException && error.name === 'AbortError')
    return { ok: false, reason: null };
  return { ok: false, reason: message('file.accessFailed') };
}

function fileSafe(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'project';
}

function pickWithInput(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${FILE_EXTENSION},application/json`;
    input.onchange = () =>
      input.files?.[0] ? resolve(input.files[0]) : reject(new DOMException('', 'AbortError'));
    input.click();
  });
}
