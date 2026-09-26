import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  mergeRooms,
  resizeRoom,
  setWallThickness,
  updateOpening,
  updateRoom,
  updateWall,
  wallLength,
  wallThickness,
  type Command,
  type LevelId,
  type OpeningId,
  type WallId,
} from '@lakudemis/core';
import { parseLength } from '@lakudemis/editor2d';
import { FormatService } from '../format.service';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { PresetsPanelComponent } from './presets-panel.component';
import { SelectionService } from './selection.service';

/**
 * Properties of the selected Wall or Room. Each committed field (Enter or leaving the field) is
 * one command and one undo step.
 */
@Component({
  selector: 'lk-properties-panel',
  imports: [TranslatePipe, PresetsPanelComponent],
  template: `
    @if (selection.room(); as room) {
      <h2>{{ 'panel.room.title' | translate }}</h2>
      <label>
        {{ 'panel.room.name' | translate }}
        <input
          [value]="room.name"
          (change)="rename($any($event.target))"
          (keydown.enter)="$any($event.target).blur()"
        />
      </label>
      <label>
        {{ 'panel.room.height' | translate }}
        <span class="field">
          <input
            [value]="room.height ?? presets().roomHeight"
            [class.preset]="room.height === undefined"
            (change)="setRoomHeight($any($event.target))"
            (keydown.enter)="$any($event.target).blur()"
          />
          mm
        </span>
        <small>{{
          (room.height === undefined ? 'panel.preset' : 'panel.custom') | translate
        }}</small>
      </label>
      <dl>
        <dt>{{ 'panel.room.netFloorArea' | translate }}</dt>
        <dd>{{ roomArea() }}</dd>
      </dl>
      @if (roomSize(); as size) {
        <h3>{{ 'panel.room.insideSize' | translate }}</h3>
        <label>
          {{ 'panel.room.width' | translate }}
          <span class="field">
            <input
              [value]="(size.width / 1000).toFixed(2)"
              (change)="resize('x', $any($event.target))"
              (keydown.enter)="$any($event.target).blur()"
            />
            m
            <select
              [value]="widthSide"
              (change)="widthSide = $any($event.target).value"
              [attr.aria-label]="'panel.room.moves' | translate"
            >
              <option value="max">{{ 'panel.room.movesRight' | translate }}</option>
              <option value="min">{{ 'panel.room.movesLeft' | translate }}</option>
            </select>
          </span>
        </label>
        <label>
          {{ 'panel.room.depth' | translate }}
          <span class="field">
            <input
              [value]="(size.depth / 1000).toFixed(2)"
              (change)="resize('y', $any($event.target))"
              (keydown.enter)="$any($event.target).blur()"
            />
            m
            <select
              [value]="depthSide"
              (change)="depthSide = $any($event.target).value"
              [attr.aria-label]="'panel.room.moves' | translate"
            >
              <option value="max">{{ 'panel.room.movesBottom' | translate }}</option>
              <option value="min">{{ 'panel.room.movesTop' | translate }}</option>
            </select>
          </span>
        </label>
      }
    } @else if (selection.opening(); as opening) {
      <h2>{{ 'panel.opening.' + opening.kind | translate }}</h2>
      <label>
        {{ 'panel.opening.offset' | translate }}
        <span class="field">
          <input
            [value]="round(opening.offset)"
            (change)="setOpening(opening.id, 'offset', $any($event.target))"
            (keydown.enter)="$any($event.target).blur()"
          />
          mm
        </span>
      </label>
      <label>
        {{ 'panel.opening.width' | translate }}
        <span class="field">
          <input
            [value]="round(opening.width)"
            (change)="setOpening(opening.id, 'width', $any($event.target))"
            (keydown.enter)="$any($event.target).blur()"
          />
          mm
        </span>
      </label>
      <label>
        {{ 'panel.opening.height' | translate }}
        <span class="field">
          <input
            [value]="round(opening.height)"
            (change)="setOpening(opening.id, 'height', $any($event.target))"
            (keydown.enter)="$any($event.target).blur()"
          />
          mm
        </span>
      </label>
      @if (opening.kind === 'window') {
        <label>
          {{ 'panel.opening.sill' | translate }}
          <span class="field">
            <input
              [value]="round(opening.sill)"
              (change)="setOpening(opening.id, 'sill', $any($event.target))"
              (keydown.enter)="$any($event.target).blur()"
            />
            mm
          </span>
        </label>
      } @else {
        <p class="buttons">
          <button type="button" (click)="flip(opening.id, 'flipHinge')">
            {{ 'panel.opening.flipHinge' | translate }} (F)
          </button>
          <button type="button" (click)="flip(opening.id, 'flipSwing')">
            {{ 'panel.opening.flipSwing' | translate }} (Shift+F)
          </button>
        </p>
      }
    } @else if (selection.wall(); as wall) {
      <h2>{{ 'panel.wall.title' | translate }}</h2>
      <dl>
        <dt>{{ 'panel.wall.length' | translate }}</dt>
        <dd>{{ format.length(wallLength(wall)) }}</dd>

        <dt>{{ 'panel.wall.side' | translate }}</dt>
        <dd>{{ 'editor.wall.side.' + wall.side | translate }}</dd>
      </dl>
      <label>
        {{ 'panel.wall.thickness' | translate }}
        <span class="field">
          <input
            [value]="thickness(wall)"
            [class.preset]="wall.thickness === undefined"
            (change)="setThickness(wall.id, $any($event.target))"
            (keydown.enter)="$any($event.target).blur()"
          />
          mm
          @if (wall.thickness !== undefined) {
            <button type="button" (click)="resetThickness(wall.id)">
              {{ 'panel.resetToPreset' | translate }}
            </button>
          }
        </span>
        <small>{{
          (wall.thickness === undefined ? 'panel.preset' : 'panel.custom') | translate
        }}</small>
      </label>
      <label>
        {{ 'panel.wall.height' | translate }}
        <span class="field">
          <input
            [value]="wall.height ?? storeyHeight(wall.level)"
            [class.preset]="wall.height === undefined"
            (change)="setWallHeight(wall.id, $any($event.target))"
            (keydown.enter)="$any($event.target).blur()"
          />
          mm
        </span>
        <small>{{
          (wall.height === undefined ? 'panel.followsStorey' : 'panel.custom') | translate
        }}</small>
      </label>
      <label class="check">
        <input
          type="checkbox"
          [checked]="wall.roomBounding"
          (change)="setRoomBounding(wall.id, $any($event.target).checked)"
        />
        {{ 'panel.wall.roomBounding' | translate }}
      </label>
      @if (wallFaces(); as faces) {
        <h3>{{ 'panel.wall.faces' | translate }}</h3>
        <dl>
          @for (f of faces; track f.key) {
            <dt>{{ f.key | translate }}</dt>
            <dd>
              {{ format.length(f.face.length) }} · {{ 'panel.wall.gross' | translate }}
              {{ format.area(f.face.gross) }} · {{ 'panel.wall.net' | translate }}
              {{ format.area(f.face.net) }}
            </dd>
          }
        </dl>
      }
    } @else if (selection.rooms().length === 2) {
      <h2>{{ 'panel.twoRooms' | translate }}</h2>
      <p>{{ selection.rooms()[0]!.name }} + {{ selection.rooms()[1]!.name }}</p>
      <button type="button" class="primary" (click)="merge()">
        {{ 'panel.merge' | translate }} (M)
      </button>
    } @else {
      <p class="empty">{{ 'panel.nothingSelected' | translate }}</p>
      @if (warnings().length) {
        <h3>{{ 'panel.warnings' | translate }}</h3>
        <ul class="warnings">
          @for (w of warnings(); track $index) {
            <li>{{ w.key | translate: w.params }}</li>
          }
        </ul>
      }
      <lk-presets-panel />
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 12px 14px;
      font-size: 13px;
    }
    h2 {
      font-size: 14px;
      margin: 0 0 10px;
    }
    h3 {
      font-size: 12px;
      margin: 12px 0 6px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .warnings {
      margin: 0 0 12px;
      padding-left: 18px;
      color: var(--warn);
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
      padding: 5px 12px;
      font-size: 13px;
    }
    select,
    button {
      font-size: 12px;
      padding: 2px 6px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
    }
    label {
      display: grid;
      gap: 3px;
      margin-bottom: 10px;
      color: var(--muted);
    }
    label.check {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--ink);
    }
    input:not([type='checkbox']) {
      padding: 4px 6px;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--ink);
      min-width: 0;
    }
    input.preset {
      color: var(--muted);
    }
    .field {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--ink);
    }
    .field input {
      width: 90px;
    }
    small {
      color: var(--muted);
      font-size: 11px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 10px;
      margin: 0 0 10px;
    }
    dt {
      color: var(--muted);
    }
    dd {
      margin: 0;
    }
    .buttons {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .empty {
      color: var(--muted);
    }
  `,
})
export class PropertiesPanelComponent {
  protected readonly selection = inject(SelectionService);
  protected readonly format = inject(FormatService);
  private readonly project = inject(ProjectService);
  private readonly messages = inject(MessagesService);
  protected readonly wallLength = wallLength;
  protected readonly presets = computed(() => this.project.store.model().project.presets);
  protected readonly roomArea = computed(() => {
    const room = this.selection.room();
    const area = room ? this.project.store.values.room(room.id).netFloorArea() : null;
    return area === null ? '—' : this.format.area(area);
  });

  protected readonly warnings = computed(() =>
    this.project.store.values.level(this.project.level()).warnings(),
  );

  /** Both faces of the selected Wall: length, gross and net area (Openings subtracted). */
  protected readonly wallFaces = computed(() => {
    const wall = this.selection.wall();
    const faces = wall ? this.project.store.values.wall(wall.id).faces() : undefined;
    return faces
      ? [
          { key: 'panel.wall.drawnFace', face: faces.drawn },
          { key: 'panel.wall.otherFace', face: faces.other },
        ]
      : null;
  });

  protected round(mm: number): string {
    return String(Math.round(mm * 10) / 10);
  }

  protected setOpening(
    opening: OpeningId,
    field: 'offset' | 'width' | 'height' | 'sill',
    input: HTMLInputElement,
  ): void {
    const value = parseLength(input.value);
    const current = this.selection.opening();
    if (value === null || !current) return;
    this.run(updateOpening, { opening, [field]: value }, input, this.round(current[field]));
  }

  protected flip(opening: OpeningId, which: 'flipHinge' | 'flipSwing'): void {
    this.run(updateOpening, { opening, [which]: true }, null, '');
  }

  protected merge(): void {
    const rooms = this.selection.rooms();
    if (rooms.length !== 2) return;
    this.run(mergeRooms, { keep: rooms[0]!.id, other: rooms[1]!.id }, null, '');
    this.selection.current.set([{ kind: 'room', id: rooms[0]!.id }]);
  }

  protected widthSide: 'min' | 'max' = 'max';
  protected depthSide: 'min' | 'max' = 'max';

  /** Inside width and depth of a rectangular Room (null for other shapes). */
  protected readonly roomSize = computed(() => {
    const room = this.selection.room();
    const d = room ? this.project.store.values.room(room.id).detection() : undefined;
    if (!d || d.status !== 'enclosed' || d.area.islands.length) return null;
    const xs = d.area.outline.map((p) => p.x);
    const ys = d.area.outline.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rectangular = d.area.outline.every(
      (p) =>
        (Math.abs(p.x - minX) < 0.5 || Math.abs(p.x - maxX) < 0.5) &&
        (Math.abs(p.y - minY) < 0.5 || Math.abs(p.y - maxY) < 0.5),
    );
    return rectangular ? { width: maxX - minX, depth: maxY - minY } : null;
  });

  protected resize(axis: 'x' | 'y', input: HTMLInputElement): void {
    const room = this.selection.room();
    const size = parseLength(input.value);
    const current = this.roomSize();
    if (!room || !current || size === null) return;
    const side = axis === 'x' ? this.widthSide : this.depthSide;
    const previous = ((axis === 'x' ? current.width : current.depth) / 1000).toFixed(2);
    this.run(resizeRoom, { room: room.id, axis, size, side }, input, previous);
  }

  protected setThickness(wall: WallId, input: HTMLInputElement): void {
    const thickness = parseLength(input.value);
    if (thickness === null) return;
    this.run(setWallThickness, { wall, thickness }, input, '');
  }

  protected resetThickness(wall: WallId): void {
    this.run(setWallThickness, { wall, thickness: null }, null, '');
  }

  protected thickness(wall: Parameters<typeof wallThickness>[0]): number {
    return wallThickness(wall, this.presets().wallThickness);
  }

  protected storeyHeight(level: LevelId): number {
    return this.project.store.model().levels[level]?.storeyHeight ?? 0;
  }

  protected rename(input: HTMLInputElement): void {
    const room = this.selection.room();
    if (room && input.value.trim() !== room.name)
      this.run(updateRoom, { room: room.id, name: input.value }, input, room.name);
  }

  protected setRoomHeight(input: HTMLInputElement): void {
    const room = this.selection.room();
    if (!room) return;
    const height = input.value.trim() === '' ? null : parseLength(input.value);
    if (height === undefined || (height !== null && height === room.height)) return;
    this.run(
      updateRoom,
      { room: room.id, height },
      input,
      String(room.height ?? this.presets().roomHeight),
    );
  }

  protected setWallHeight(wall: WallId, input: HTMLInputElement): void {
    const height = input.value.trim() === '' ? null : parseLength(input.value);
    this.run(updateWall, { wall, height }, input, '');
  }

  protected setRoomBounding(wall: WallId, roomBounding: boolean): void {
    this.run(updateWall, { wall, roomBounding }, null, '');
  }

  private run<A>(
    command: Command<A>,
    args: A,
    input: HTMLInputElement | null,
    previous: string,
  ): void {
    const result = this.project.store.run(command, args);
    if (!result.ok) {
      this.messages.refused(result.reason);
      if (input && previous) input.value = previous;
    }
  }
}
