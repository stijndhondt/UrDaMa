import { Injectable, signal } from '@angular/core';
import type { Message } from '@urdama/core';

export interface ShownMessage {
  readonly message: Message;
  /** Where it happened on the plan (CSS px), for the note near the cursor. */
  readonly at: { readonly x: number; readonly y: number } | null;
  readonly kind: 'refused' | 'info';
}

/**
 * Feedback for the user (Slice 1 spec): a refused command shows its reason near the cursor and
 * stays in the message bar until the next action. No dialogs.
 */
@Injectable({ providedIn: 'root' })
export class MessagesService {
  readonly current = signal<ShownMessage | null>(null);

  refused(message: Message, at: { x: number; y: number } | null = null): void {
    this.current.set({ message, at, kind: 'refused' });
  }

  info(message: Message): void {
    this.current.set({ message, at: null, kind: 'info' });
  }

  /**
   * Runs an action (such as a right-click menu item); a refusal it shows without a position is
   * shown at `at` instead, next to what it is about.
   */
  showRefusalsAt(at: { x: number; y: number } | undefined, action: () => void): void {
    const before = this.current();
    action();
    const now = this.current();
    if (at && now && now !== before && now.kind === 'refused' && !now.at)
      this.current.set({ ...now, at });
  }

  /** The next action clears the previous message. */
  clear(): void {
    if (this.current()) this.current.set(null);
  }
}
