import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  updateRoom,
  updateWall,
  wallLength,
  wallThickness,
  type Command,
  type LevelId,
  type WallId,
} from '@lakudemis/core';
import { parseLength } from '@lakudemis/editor2d';
import { FormatService } from '../format.service';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { SelectionService } from './selection.service';

/**
 * Properties of the selected Wall or Room. Each committed field (Enter or leaving the field) is
 * one command and one undo step.
 */
@Component({
  selector: 'lk-properties-panel',
  imports: [TranslatePipe],
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
    } @else if (selection.wall(); as wall) {
      <h2>{{ 'panel.wall.title' | translate }}</h2>
      <dl>
        <dt>{{ 'panel.wall.length' | translate }}</dt>
        <dd>{{ format.length(wallLength(wall)) }}</dd>
        <dt>{{ 'panel.wall.thickness' | translate }}</dt>
        <dd>
          {{ format.millimetres(thickness(wall)) }}
          <small>{{
            (wall.thickness === undefined ? 'panel.preset' : 'panel.custom') | translate
          }}</small>
        </dd>
        <dt>{{ 'panel.wall.side' | translate }}</dt>
        <dd>{{ 'editor.wall.side.' + wall.side | translate }}</dd>
      </dl>
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
    } @else {
      <p class="empty">{{ 'panel.nothingSelected' | translate }}</p>
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
