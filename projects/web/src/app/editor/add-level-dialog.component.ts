import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addLevel, defaultStoreyHeight, type LevelId } from '@urdama/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { InputNumberModule } from '@openng/optimus-ui/inputnumber';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
  ],
  template: `
    <p-dialog
      [header]="
        (position() === 'above' ? 'levels.addAboveTitle' : 'levels.addBelowTitle') | translate
      "
      [visible]="isOpen()"
      (visibleChange)="isOpen.set($event)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '360px' }"
    >
      <form class="form" (submit)="add($event)">
        <!-- Enter in a field adds the Level. -->
        <button type="submit" hidden></button>
        <label for="add-level-name">{{ 'levels.name' | translate }}</label>
        <input
          pInputText
          id="add-level-name"
          name="name"
          [ngModel]="name()"
          (ngModelChange)="name.set($event)"
          autocomplete="off"
          required
        />
        <label for="add-level-storey">{{ 'levels.storeyHeight' | translate }}</label>
        <p-inputnumber
          inputId="add-level-storey"
          name="storey"
          [ngModel]="storey()"
          (ngModelChange)="storey.set($event ?? 0)"
          [min]="1000"
          [max]="10000"
          [step]="5"
          [useGrouping]="false"
          suffix=" mm"
          [showButtons]="true"
        />
        <p class="note">
          {{ 'levels.elevationNote' | translate: { elevation: newElevation() } }}
        </p>
      </form>
      <ng-template #footer>
        <p-button
          [label]="'common.cancel' | translate"
          severity="secondary"
          [text]="true"
          (onClick)="isOpen.set(false)"
        />
        <p-button [label]="'levels.add' | translate" (onClick)="add()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .form {
      display: grid;
      gap: 6px;
    }
    label {
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
    }
    .note {
      margin: 6px 0 0;
      font-size: 12px;
      color: var(--muted);
    }
  `,
})
export class AddLevelDialogComponent {
  protected readonly project = inject(ProjectService);
  private readonly selection = inject(SelectionService);
  private readonly messages = inject(MessagesService);
  private readonly format = inject(FormatService);
  private readonly translate = inject(TranslateService);

  protected readonly position = signal<'above' | 'below'>('above');
  protected readonly name = signal('');
  protected readonly storey = signal(0);
  protected readonly isOpen = signal(false);

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
    this.name.set(
      this.translate.instant('levels.defaultName', { n: this.project.levels().length + 1 }),
    );
    this.storey.set(defaultStoreyHeight(this.project.store.model().project.presets));
    this.isOpen.set(true);
  }

  protected add(event?: Event): void {
    event?.preventDefault();
    const before = new Set(this.project.levels().map((l) => l.id as string));
    const result = this.project.store.run(addLevel, {
      relativeTo: this.project.level(),
      position: this.position(),
      name: this.name(),
      storeyHeight: this.storey(),
    });
    if (!result.ok) {
      this.messages.refused(result.reason);
      return;
    }
    this.isOpen.set(false);
    const added = this.project.levels().find((l) => !before.has(l.id));
    if (added) this.choose(added.id);
  }
}
