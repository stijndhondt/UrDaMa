import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import {
  addOpeningType,
  deleteOpeningType,
  openingsOfType,
  renameOpeningType,
  updateOpeningType,
  type Command,
  type OpeningFamilyId,
  type OpeningTypeId,
} from '@lakudemis/core';
import { parseLength } from '@lakudemis/editor2d';
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
  imports: [FormsModule, TranslatePipe, TooltipModule, IconComponent],
  template: `
    <dialog #dialog (close)="family.set(null)">
      @if (family(); as f) {
        <h2>{{ 'openingTypes.title' | translate: { family: familyName() } }}</h2>
        <table>
          <thead>
            <tr>
              <th>{{ 'openingTypes.name' | translate }}</th>
              <th class="num">{{ 'openingTypes.width' | translate }}</th>
              <th class="num">{{ 'openingTypes.height' | translate }}</th>
              <th class="num">{{ 'openingTypes.used' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (t of types(); track t.id) {
              <tr>
                <td>
                  <input
                    [value]="t.name ?? ''"
                    [placeholder]="t.sizes"
                    [attr.aria-label]="'openingTypes.name' | translate"
                    (change)="
                      run(renameOpeningType, { type: t.id, name: $any($event.target).value })
                    "
                  />
                </td>
                <td class="num">
                  <input
                    class="mm"
                    [value]="t.width"
                    [attr.aria-label]="'openingTypes.width' | translate"
                    (change)="resize(t.id, 'width', $any($event.target).value)"
                  />
                </td>
                <td class="num">
                  <input
                    class="mm"
                    [value]="t.height"
                    [attr.aria-label]="'openingTypes.height' | translate"
                    (change)="resize(t.id, 'height', $any($event.target).value)"
                  />
                </td>
                <td class="num">{{ t.used }}</td>
                <td>
                  <button
                    type="button"
                    class="icon"
                    [disabled]="t.used > 0"
                    [attr.aria-label]="'openingTypes.delete' | translate"
                    [pTooltip]="
                      t.used > 0
                        ? ('commands.openingType.inUse' | translate: { count: t.used })
                        : ('openingTypes.delete' | translate)
                    "
                    tooltipPosition="left"
                    (click)="run(deleteOpeningType, { type: t.id })"
                  >
                    <lk-icon name="trash-2" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td>
                <input
                  [ngModel]="newName()"
                  (ngModelChange)="newName.set($event)"
                  [placeholder]="'openingTypes.newName' | translate"
                  [attr.aria-label]="'openingTypes.newName' | translate"
                />
              </td>
              <td class="num">
                <input
                  class="mm"
                  [ngModel]="newWidth()"
                  (ngModelChange)="newWidth.set($event)"
                  [attr.aria-label]="'openingTypes.width' | translate"
                />
              </td>
              <td class="num">
                <input
                  class="mm"
                  [ngModel]="newHeight()"
                  (ngModelChange)="newHeight.set($event)"
                  [attr.aria-label]="'openingTypes.height' | translate"
                />
              </td>
              <td colspan="2">
                <button type="button" (click)="add(f)">{{ 'openingTypes.add' | translate }}</button>
              </td>
            </tr>
          </tfoot>
        </table>
        <p class="note">{{ 'openingTypes.note' | translate }}</p>
        <div class="buttons">
          <button type="button" class="primary" (click)="dialog.close()">
            {{ 'common.close' | translate }}
          </button>
        </div>
      }
    </dialog>
  `,
  styles: `
    dialog {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 18px 20px;
      background: var(--panel);
      color: var(--ink);
      min-width: 440px;
    }
    h2 {
      font-size: 17px;
      margin: 0 0 12px;
    }
    table {
      border-collapse: collapse;
      font-size: 13px;
      width: 100%;
    }
    th {
      text-align: left;
      font-weight: 500;
      color: var(--muted);
      padding: 0 4px 6px;
    }
    td {
      padding: 2px 4px;
    }
    .num {
      text-align: right;
    }
    tfoot td {
      padding-top: 10px;
      border-top: 1px solid var(--line);
    }
    input {
      width: 100%;
      box-sizing: border-box;
      padding: 4px 6px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--inset);
      color: var(--ink);
      font-size: 13px;
    }
    input.mm {
      width: 70px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    button {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
      color: var(--ink);
      font-size: 13px;
      padding: 4px 10px;
      cursor: pointer;
    }
    button.icon {
      border: 0;
      background: transparent;
      padding: 4px;
      display: flex;
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-ink);
    }
    .note {
      font-size: 12px;
      color: var(--muted);
      margin: 12px 0;
      max-width: 440px;
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class OpeningTypesDialogComponent {
  private readonly project = inject(ProjectService);
  private readonly messages = inject(MessagesService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

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
    return Object.values(model.openingTypes)
      .filter((t) => t.family === f)
      .sort((a, b) => a.width - b.width || a.height - b.height || (a.id < b.id ? -1 : 1))
      .map((t) => ({
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
    this.dialog().nativeElement.showModal();
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
