/**
 * The project store: the one place the building model lives while the app runs.
 *
 * Commands go in (`run`), Derived values come out (`values`). Every command becomes a patch on
 * the undo stack (ticket 11: last 200 steps, per session). A drag runs as a preview: a temporary,
 * uncommitted model that Derived values follow live; releasing commits it as one command.
 */
import type { Command, CommandOutcome } from '../commands/command';
import type { IdGenerator } from '../model/ids';
import { checkInvariants } from '../model/invariants';
import { message, type Message } from '../model/message';
import { applyPatch, diffModels, type Patch } from '../model/patch';
import type { Model, RoomId } from '../model/types';
import { derived, source, type Derived } from '../reactive';
import { BuildingValues } from '../values/building-values';

export const UNDO_LIMIT = 200;

/** A Room whose Net floor area an edit changed; `undefined` = the Room did not exist, `null` = not enclosed. */
export interface RoomChange {
  readonly room: RoomId;
  readonly name: string;
  /** mm² before the edit */
  readonly before: number | null | undefined;
  /** mm² after the edit */
  readonly after: number | null | undefined;
}

/** What the last edit changed: shown to the user as old → new values (ADR 0003, amended). */
export interface ChangeSummary {
  readonly kind: 'do' | 'undo' | 'redo';
  readonly label: Message;
  readonly rooms: readonly RoomChange[];
}

/** Areas closer than this (mm²) count as unchanged: well below the 0.01 m² shown. */
const AREA_TOLERANCE = 1;

type AreaSnapshot = ReadonlyMap<RoomId, { readonly name: string; readonly area: number | null }>;

export type RunResult =
  { readonly ok: true; readonly patch: Patch } | { readonly ok: false; readonly reason: Message };

export class ProjectStore {
  private readonly committed: ReturnType<typeof source<Model>>;
  private readonly previewModel = source<{ model: Model; label: Message } | null>(
    'Project · preview',
    null,
  );
  private readonly undoStack = source<readonly Patch[]>('Project · undo history', []);
  private readonly redoStack = source<readonly Patch[]>('Project · redo history', []);

  /** The current model: the preview while dragging, otherwise the committed model. */
  readonly model: Derived<Model> = derived(
    'Project · current model',
    () => this.previewModel()?.model ?? this.committed(),
  );
  readonly values = new BuildingValues(() => this.model());
  /** The committed model, ignoring any preview in progress. */
  readonly committedModel: Derived<Model> = derived('Project · committed model', () =>
    this.committed(),
  );

  readonly canUndo = derived('Project · can undo', () => this.undoStack().length > 0);
  readonly canRedo = derived('Project · can redo', () => this.redoStack().length > 0);
  /** Label of the step Undo would reverse, e.g. "Draw room (Keuken)". */
  readonly undoLabel = derived(
    'Project · undo label',
    () => this.undoStack().at(-1)?.label ?? null,
  );
  readonly redoLabel = derived(
    'Project · redo label',
    () => this.redoStack().at(-1)?.label ?? null,
  );
  readonly isPreviewing = derived('Project · is previewing', () => this.previewModel() !== null);
  private readonly change = source<ChangeSummary | null>('Project · last change', null);
  /** What the last command, undo or redo changed (null after opening a project). */
  readonly lastChange = derived('Project · last change', () => this.change());

  constructor(
    initial: Model,
    private readonly ids: IdGenerator,
  ) {
    this.committed = source<Model>('Project · Source data', initial);
  }

  /** Runs a command on the committed model: all or nothing. */
  run<A>(command: Command<A>, args: A): RunResult {
    this.previewModel.set(null);
    const before = this.committed();
    const outcome = this.execute(command, args, before);
    if (!outcome.ok) return outcome;
    const patch = diffModels(before, outcome.model, outcome.label);
    if (!patch.ops.length) return { ok: true, patch };
    this.track('do', patch.label, () => this.committed.set(outcome.model));
    this.pushUndo(patch);
    return { ok: true, patch };
  }

  /** Shows what a command would do, without committing (a drag in progress). */
  preview<A>(command: Command<A>, args: A): CommandOutcome {
    const outcome = this.execute(command, args, this.committed());
    if (outcome.ok) this.previewModel.set({ model: outcome.model, label: outcome.label });
    return outcome;
  }

  /**
   * A drag goes on, showing nothing changed (back where it started, or at a refused position):
   * still previewing, the committed model shown (ticket 33). Views that hold still during a drag
   * then don't rebuild on the way, and committing it changes nothing.
   */
  holdPreview(): void {
    this.previewModel.set({ model: this.committed(), label: message('commands.moveWall.nothing') });
  }

  cancelPreview(): void {
    this.previewModel.set(null);
  }

  /** Commits the current preview as one command (the drag was released). */
  commitPreview(): RunResult | null {
    const p = this.previewModel();
    if (!p) return null;
    this.previewModel.set(null);
    const before = this.committed();
    const patch = diffModels(before, p.model, p.label);
    if (!patch.ops.length) return { ok: true, patch };
    this.track('do', patch.label, () => this.committed.set(p.model));
    this.pushUndo(patch);
    return { ok: true, patch };
  }

  undo(): Patch | null {
    this.previewModel.set(null);
    const patch = this.undoStack().at(-1);
    if (!patch) return null;
    this.track('undo', patch.label, () =>
      this.committed.set(applyPatch(this.committed(), patch, 'reverse')),
    );
    this.undoStack.set(this.undoStack().slice(0, -1));
    this.redoStack.set([...this.redoStack(), patch]);
    return patch;
  }

  redo(): Patch | null {
    this.previewModel.set(null);
    const patch = this.redoStack().at(-1);
    if (!patch) return null;
    this.track('redo', patch.label, () =>
      this.committed.set(applyPatch(this.committed(), patch, 'forward')),
    );
    this.redoStack.set(this.redoStack().slice(0, -1));
    this.undoStack.set([...this.undoStack(), patch]);
    return patch;
  }

  /** Replaces the whole model (opening a project); clears undo history. */
  replace(model: Model): void {
    this.previewModel.set(null);
    this.committed.set(model);
    this.undoStack.set([]);
    this.redoStack.set([]);
    this.change.set(null);
  }

  /** Applies a change and records which Rooms' areas it changed. */
  private track(kind: ChangeSummary['kind'], label: Message, apply: () => void): void {
    const before = this.areas();
    apply();
    const after = this.areas();
    const rooms: RoomChange[] = [];
    for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
      const b = before.get(id);
      const a = after.get(id);
      const same =
        b !== undefined &&
        a !== undefined &&
        (b.area === a.area ||
          (b.area !== null && a.area !== null && Math.abs(b.area - a.area) < AREA_TOLERANCE));
      if (!same) rooms.push({ room: id, name: (a ?? b)!.name, before: b?.area, after: a?.area });
    }
    this.change.set({ kind, label, rooms });
  }

  private areas(): AreaSnapshot {
    const snapshot = new Map<RoomId, { name: string; area: number | null }>();
    for (const room of Object.values(this.committed().rooms)) {
      snapshot.set(room.id, { name: room.name, area: this.values.room(room.id).netFloorArea() });
    }
    return snapshot;
  }

  private execute<A>(command: Command<A>, args: A, model: Model): CommandOutcome {
    const outcome = command(model, args, { ids: this.ids });
    if (!outcome.ok) return outcome;
    const broken = checkInvariants(outcome.model, model);
    return broken ? { ok: false, reason: broken } : outcome;
  }

  private pushUndo(patch: Patch): void {
    const stack = [...this.undoStack(), patch];
    this.undoStack.set(stack.length > UNDO_LIMIT ? stack.slice(stack.length - UNDO_LIMIT) : stack);
    this.redoStack.set([]);
  }
}
