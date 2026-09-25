/**
 * Commands (ticket 11): pure functions from the current Source data to a changed version.
 * One user action is one command and one undo step; a command either fully succeeds or
 * changes nothing and says why.
 */
import type { IdGenerator } from '../model/ids';
import type { Message } from '../model/message';
import type { Model } from '../model/types';

export interface CommandContext {
  readonly ids: IdGenerator;
}

export type CommandOutcome =
  | { readonly ok: true; readonly model: Model; readonly label: Message }
  | { readonly ok: false; readonly reason: Message };

export type Command<A> = (model: Model, args: A, context: CommandContext) => CommandOutcome;

export const refuse = (reason: Message): CommandOutcome => ({ ok: false, reason });
