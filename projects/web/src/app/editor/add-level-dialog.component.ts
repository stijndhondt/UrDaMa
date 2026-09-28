import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addLevel, defaultStoreyHeight, type LevelId } from '@lakudemis/core';
import { FormatService } from '../format.service';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { SelectionService } from './selection.service';

/**
 * Adding a Level above or below the current one (Slice 1 spec, "Levels"; opened from the Building
 * panel, ticket 10). Levels are stacked, so the new Level's elevation follows; it becomes the
 * Level being drawn on.
 */
@Component({
  selector: 'lk-add-level-dialog',
  imports: [FormsModule, TranslatePipe],
  template: `
    <dialog #dialog>
      <form method="dialog" (submit)="add($event)">
        <h2>
          {{
            (position() === 'above' ? 'levels.addAboveTitle' : 'levels.addBelowTitle') | translate
          }}
        </h2>
        <label>
          {{ 'levels.name' | translate }}
          <input name="name" [(ngModel)]="name" autocomplete="off" required />
        </label>
        <label>
          {{ 'levels.storeyHeight' | translate }}
          <span class="unit"
            ><input
              name="storey"
              type="number"
              min="1000"
              max="10000"
              step="5"
              [(ngModel)]="storeyHeight"
              (ngModelChange)="storey.set(+$event)"
              required
            />
            mm</span
          >
        </label>
        <p class="note">
          {{ 'levels.elevationNote' | translate: { elevation: newElevation() } }}
        </p>
        <div class="buttons">
          <button type="button" (click)="dialog.close()">{{ 'common.cancel' | translate }}</button>
          <button type="submit" class="primary">{{ 'levels.add' | translate }}</button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    dialog {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 18px 20px;
      min-width: 320px;
    }
    h2 {
      font-size: 17px;
      margin: 0 0 12px;
    }
    label {
      display: grid;
      gap: 4px;
      margin-bottom: 10px;
      font-size: 13px;
      color: var(--muted);
    }
    input {
      padding: 5px 7px;
      border: 1px solid var(--line);
      border-radius: 6px;
      font-size: 14px;
    }
    .unit {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--ink);
    }
    .unit input {
      width: 110px;
    }
    .note {
      font-size: 12px;
      color: var(--muted);
      margin: 0 0 12px;
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .buttons button {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
      color: var(--ink);
      font-size: 13px;
      padding: 5px 12px;
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-ink);
    }
  `,
})
export class AddLevelDialogComponent {
  protected readonly project = inject(ProjectService);
  private readonly selection = inject(SelectionService);
  private readonly messages = inject(MessagesService);
  private readonly format = inject(FormatService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly position = signal<'above' | 'below'>('above');
  protected name = '';
  protected storeyHeight = 0;
  protected readonly storey = signal(0);

  /** Where the new Level's finished floor will be, shown before adding it. */
  protected readonly newElevation = computed(() => {
    const heights = this.project.store.values.levelHeights();
    const current = heights.get(this.project.level());
    if (!current) return '';
    const mm =
      this.position() === 'above'
        ? current.elevation + current.storeyHeight
        : current.order === this.project.levels()[0]!.order
          ? current.elevation - this.storey()
          : current.elevation;
    return this.format.length(mm);
  });

  protected choose(id: LevelId): void {
    if (id === this.project.level()) return;
    this.selection.clear();
    this.project.selectLevel(id);
  }

  open(position: 'above' | 'below'): void {
    this.position.set(position);
    this.name = this.translate.instant('levels.defaultName', {
      n: this.project.levels().length + 1,
    });
    this.storeyHeight = defaultStoreyHeight(this.project.store.model().project.presets);
    this.storey.set(this.storeyHeight);
    this.dialog().nativeElement.showModal();
  }

  protected add(event: Event): void {
    event.preventDefault();
    const before = new Set(this.project.levels().map((l) => l.id as string));
    const result = this.project.store.run(addLevel, {
      relativeTo: this.project.level(),
      position: this.position(),
      name: this.name,
      storeyHeight: Number(this.storeyHeight),
    });
    if (!result.ok) {
      this.messages.refused(result.reason);
      return;
    }
    this.dialog().nativeElement.close();
    const added = this.project.levels().find((l) => !before.has(l.id));
    if (added) this.choose(added.id);
  }
}
