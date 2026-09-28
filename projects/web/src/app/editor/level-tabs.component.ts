import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addLevel, defaultStoreyHeight, type LevelId } from '@lakudemis/core';
import { FormatService } from '../format.service';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { SelectionService } from './selection.service';

/**
 * Level tabs (Slice 1 spec, "Levels"): one tab per Level, lowest first, keys 1–9; "Add Level"
 * above or below the current one. Levels are stacked, so a new Level's elevation follows.
 */
@Component({
  selector: 'lk-level-tabs',
  imports: [FormsModule, TranslatePipe],
  template: `
    <nav class="tabs" [attr.aria-label]="'levels.tabs' | translate">
      @for (l of project.levels(); track l.id; let i = $index) {
        <button
          type="button"
          role="tab"
          [class.on]="l.id === project.level()"
          [attr.aria-selected]="l.id === project.level()"
          [title]="i < 9 ? l.name + ' (' + (i + 1) + ')' : l.name"
          (click)="choose(l.id)"
        >
          {{ l.name }}
          @if (i < 9) {
            <kbd>{{ i + 1 }}</kbd>
          }
        </button>
      }
      <button type="button" class="add" (click)="openAdd('above')">
        + {{ 'levels.addAbove' | translate }}
      </button>
      <button type="button" class="add" (click)="openAdd('below')">
        + {{ 'levels.addBelow' | translate }}
      </button>
    </nav>
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
    .tabs {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      align-items: center;
    }
    button {
      font-size: 12px;
      padding: 3px 9px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
      color: var(--ink);
    }
    /* The Level being edited: the same blue "selected" look as the icon bar, light and dark. */
    button.on {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 600;
    }
    button.add {
      color: var(--muted);
      border-style: dashed;
    }
    kbd {
      font-size: 10px;
      opacity: 0.6;
      margin-left: 3px;
    }
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
export class LevelTabsComponent {
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

  /** Keys 1–9 switch Level. */
  chooseByNumber(n: number): boolean {
    const level = this.project.levels()[n - 1];
    if (!level) return false;
    this.choose(level.id);
    return true;
  }

  protected choose(id: LevelId): void {
    if (id === this.project.level()) return;
    this.selection.clear();
    this.project.selectLevel(id);
  }

  protected openAdd(position: 'above' | 'below'): void {
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
