import { Injectable, inject } from '@angular/core';
import {
  addRoom,
  deleteElements,
  mergeRooms,
  setWallThickness,
  updateOpening,
  updateRoom,
  type Command,
  type RoomId,
  type Vec,
  type WallId,
} from '@lakudemis/core';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { SelectionService } from './selection.service';

/**
 * The element actions, shared by the keyboard shortcuts and the right-click menu (slice 2,
 * ticket 04). Each is one command and one undo step; a refusal shows its reason.
 */
@Injectable({ providedIn: 'root' })
export class EditorActionsService {
  private readonly project = inject(ProjectService);
  private readonly selection = inject(SelectionService);
  private readonly messages = inject(MessagesService);

  /** Delete (Del): everything selected. */
  deleteSelection(): void {
    const s = this.selection.current();
    if (!s.length) return;
    const ok = this.run(deleteElements, {
      walls: s.flatMap((x) => (x.kind === 'wall' ? [x.id] : [])),
      rooms: s.flatMap((x) => (x.kind === 'room' ? [x.id] : [])),
      separators: s.flatMap((x) => (x.kind === 'separator' ? [x.id] : [])),
      openings: s.flatMap((x) => (x.kind === 'opening' ? [x.id] : [])),
    });
    if (ok) this.selection.clear();
  }

  /** Merge Rooms (M): the two selected Rooms; the first keeps its name. */
  merge(): void {
    const rooms = this.selection.rooms();
    if (rooms.length !== 2) {
      this.messages.refused({ key: 'commands.merge.twoRooms' });
      return;
    }
    if (this.run(mergeRooms, { keep: rooms[0]!.id, other: rooms[1]!.id }))
      this.selection.current.set([{ kind: 'room', id: rooms[0]!.id }]);
  }

  /** Flip a selected door (F: hinge side, Shift+F: swing). False when no single Opening is selected. */
  flipOpening(which: 'hinge' | 'swing'): boolean {
    const selected = this.selection.current();
    const only = selected.length === 1 ? selected[0]! : null;
    if (only?.kind !== 'opening') return false;
    this.run(updateOpening, {
      opening: only.id,
      ...(which === 'swing' ? { flipSwing: true } : { flipHinge: true }),
    });
    return true;
  }

  /** Create Room here: an enclosed area without a Room becomes a Room, selected. */
  createRoom(seed: Vec): void {
    const level = this.project.level();
    const before = new Set(Object.keys(this.project.store.committedModel().rooms));
    if (!this.run(addRoom, { level, seed, name: this.project.nextRoomName() })) return;
    const added = Object.values(this.project.store.committedModel().rooms).find(
      (r) => !before.has(r.id),
    );
    if (added) this.selection.current.set([{ kind: 'room', id: added.id }]);
  }

  /** Room height and Floor build-up follow their Presets again. */
  resetRoomHeights(room: RoomId): void {
    this.run(updateRoom, { room, height: null, floorBuildUp: null });
  }

  /** The Wall's thickness follows the Preset again. */
  resetWallThickness(wall: WallId): void {
    this.run(setWallThickness, { wall, thickness: null });
  }

  private run<A>(command: Command<A>, args: A): boolean {
    const result = this.project.store.run(command, args);
    if (!result.ok) this.messages.refused(result.reason);
    return result.ok;
  }
}
