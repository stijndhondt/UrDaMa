import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import {
  addOpeningType,
  deleteOpeningType,
  familyTypes,
  openingsOfType,
  renameOpeningType,
  updateOpeningType,
  type Command,
  type OpeningFamilyId,
  type OpeningTypeId,
} from '@urdama/core';
import { parseLength } from '@urdama/editor2d';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { TableModule } from '@openng/optimus-ui/table';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { IconComponent } from '../shell/icon.component';

/**
 * The Opening types of one family (ticket 18): rename a type, change its sizes for every Opening
 * of it, delete one no Opening uses, add a new one. Each change is one undo step.
 */
@Component({
  selector: 'lk-opening-types-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TableModule,
    TooltipModule,
    IconComponent,
  ],
  template: `
    <p-dialog
      [header]="'openingTypes.title' | translate: { family: familyName() }"
      [visible]="family() !== null"
      (visibleChange)="$event || family.set(null)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '520px' }"
    >
      @if (family(); as f) {
        <p-table [value]="types()" size="small" dataKey="id">
          <ng-template #header>
            <tr>
              <th>{{ 'openingTypes.name' | translate }}</th>
              <th class="num">{{ 'openingTypes.width' | translate }}</th>
              <th class="num">{{ 'openingTypes.height' | translate }}</th>
              <th class="num">{{ 'openingTypes.used' | translate }}</th>
              <th></th>
            </tr>
          </ng-template>
          <ng-template #body let-t>
            <tr>
              <td>
                <input
                  pInputText
                  pSize="small"
                  class="name"
                  [value]="t.name ?? ''"
                  [placeholder]="t.sizes"
                  [attr.aria-label]="'openingTypes.name' | translate"
                  (change)="run(renameOpeningType, { type: t.id, name: $any($event.target).value })"
                />
              </td>
              <td class="num">
                <input
                  pInputText
                  pSize="small"
                  class="mm"
                  [value]="t.width"
                  [attr.aria-label]="'openingTypes.width' | translate"
                  (change)="resize(t.id, 'width', $any($event.target).value)"
                />
              </td>
              <td class="num">
                <input
                  pInputText
                  pSize="small"
                  class="mm"
                  [value]="t.height"
                  [attr.aria-label]="'openingTypes.height' | translate"
                  (change)="resize(t.id, 'height', $any($event.target).value)"
                />
              </td>
              <td class="num">{{ t.used }}</td>
              <td>
                <!-- A disabled button shows no tooltip, so the reason sits on its wrapper. -->
                <span
                  [pTooltip]="
                    t.used > 0
                      ? ('commands.openingType.inUse' | translate: { count: t.used })
                      : ('openingTypes.delete' | translate)
                  "
                  tooltipPosition="left"
                >
                  <p-button
                    size="small"
                    severity="secondary"
                    [text]="true"
                    [disabled]="t.used > 0"
                    [ariaLabel]="'openingTypes.delete' | translate"
                    (onClick)="run(deleteOpeningType, { type: t.id })"
                  >
                    <lk-icon name="trash-2" />
                  </p-button>
                </span>
              </td>
            </tr>
          </ng-template>
        </p-table>
        <div class="add">
          <input
            pInputText
            pSize="small"
            class="name"
            [ngModel]="newName()"
            (ngModelChange)="newName.set($event)"
            [placeholder]="'openingTypes.newName' | translate"
            [attr.aria-label]="'openingTypes.newName' | translate"
          />
          <input
            pInputText
            pSize="small"
            class="mm"
            [ngModel]="newWidth()"
            (ngModelChange)="newWidth.set($event)"
            [attr.aria-label]="'openingTypes.width' | translate"
          />
          <input
            pInputText
            pSize="small"
            class="mm"
            [ngModel]="newHeight()"
            (ngModelChange)="newHeight.set($event)"
            [attr.aria-label]="'openingTypes.height' | translate"
          />
          <p-button
            size="small"
            severity="secondary"
            [label]="'openingTypes.add' | translate"
            (onClick)="add(f)"
          />
        </div>
        <p class="note">{{ 'openingTypes.note' | translate }}</p>
      }
      <ng-template #footer>
        <p-button [label]="'common.close' | translate" (onClick)="family.set(null)" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    input.name {
      width: 100%;
    }
    input.mm {
      width: 72px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .add {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-top: 10px;
    }
    .add .name {
      flex: 1;
      min-width: 0;
    }
    .note {
      font-size: 12px;
      color: var(--muted);
      margin: 12px 0 0;
    }
  `,
})
export class OpeningTypesDialogComponent {
  private readonly project = inject(ProjectService);
  private readonly messages = inject(MessagesService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);

  protected readonly family = signal<OpeningFamilyId | null>(null);
  protected readonly renameOpeningType = renameOpeningType;
  protected readonly deleteOpeningType = deleteOpeningType;
  protected readonly newName = signal('');
  protected readonly newWidth = signal('');
  protected readonly newHeight = signal('');

  protected readonly familyName = computed(() => {
    const f = this.family();
    const family = f ? this.project.store.model().openingFamilies[f] : undefined;
    if (!family) return '';
    return family.name ?? this.language.text('panel.opening.' + family.kind);
  });

  /** The family's types, smallest first, with how many Openings use each. */
  protected readonly types = computed(() => {
    const f = this.family();
    const model = this.project.store.model();
    return familyTypes(model, f ?? undefined).map((t) => ({
      ...t,
      sizes: this.format.openingSize(t.width, t.height),
      used: openingsOfType(model, t.id),
    }));
  });

  open(family: OpeningFamilyId): void {
    this.family.set(family);
    const first = this.types()[0];
    this.newName.set('');
    this.newWidth.set(first ? String(first.width) : '');
    this.newHeight.set(first ? String(first.height) : '');
  }

  protected resize(type: OpeningTypeId, field: 'width' | 'height', text: string): void {
    const value = parseLength(text);
    if (value !== null) this.run(updateOpeningType, { type, [field]: value });
  }

  protected add(family: OpeningFamilyId): void {
    const width = parseLength(this.newWidth());
    const height = parseLength(this.newHeight());
    if (width === null || height === null) return;
    if (this.run(addOpeningType, { family, name: this.newName(), width, height }))
      this.newName.set('');
  }

  protected run<A>(command: Command<A>, args: A): boolean {
    const result = this.project.store.run(command, args);
    if (!result.ok) this.messages.refused(result.reason);
    return result.ok;
  }
}
