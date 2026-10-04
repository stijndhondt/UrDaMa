import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { familyTypes, type OpeningFamily, type OpeningKind, type OpeningType } from '@urdama/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { ProjectService } from '../project/project.service';
import { IconComponent } from '../shell/icon.component';
import { OPENING_ICONS } from '../shell/opening-icons';
import { LibraryService } from './library.service';

/**
 * The Library panel (ticket 21): this project's Opening families with their types, and the
 * personal library in this browser. A project family is saved to the library; a library family
 * is imported into the project as a copy. A project type is dragged onto a Wall to place it.
 */
@Component({
  selector: 'lk-library-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ButtonModule, TooltipModule, IconComponent],
  template: `
    <h3>{{ 'library.project' | translate }}</h3>
    <p class="note">{{ 'library.dragHint' | translate }}</p>
    @for (f of projectFamilies(); track f.family.id) {
      <section>
        <div class="family">
          <lk-icon [name]="icons[f.family.kind]" />
          <span class="name">{{ f.name }}</span>
          <p-button
            size="small"
            severity="secondary"
            [text]="true"
            [label]="'library.save' | translate"
            [pTooltip]="'library.saveHint' | translate"
            tooltipPosition="right"
            (onClick)="library.save(f.family.id)"
          />
        </div>
        <ul>
          @for (t of f.types; track t.id) {
            <li
              class="type"
              draggable="true"
              [attr.aria-label]="('library.dragType' | translate) + ' ' + typeName(t)"
              (dragstart)="dragStart($event, f.family.kind, t)"
              (dragend)="library.endDrag()"
            >
              {{ typeName(t) }}
            </li>
          }
        </ul>
      </section>
    }
    <h3>{{ 'library.mine' | translate }}</h3>
    @for (f of library.families(); track f.id) {
      <section>
        <div class="family">
          <lk-icon [name]="icons[f.kind]" />
          <span class="name">{{ f.name ?? kindName(f.kind) }}</span>
          <p-button
            size="small"
            severity="secondary"
            [text]="true"
            [label]="'library.import' | translate"
            [pTooltip]="'library.importHint' | translate"
            tooltipPosition="right"
            (onClick)="library.import(f.id)"
          />
          <p-button
            size="small"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            [ariaLabel]="'library.remove' | translate"
            [pTooltip]="'library.remove' | translate"
            tooltipPosition="right"
            (onClick)="library.remove(f.id)"
          >
            <lk-icon name="trash-2" />
          </p-button>
        </div>
        <ul>
          @for (t of f.types; track $index) {
            <li>{{ typeName(t) }}</li>
          }
        </ul>
      </section>
    } @empty {
      <p class="note">{{ 'library.empty' | translate }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      padding-bottom: 12px;
      font-size: 12.5px;
    }
    h3 {
      margin: 12px 12px 4px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .note {
      margin: 0 12px 6px;
      font-size: 11px;
      line-height: 1.45;
      color: var(--muted);
    }
    section {
      padding: 2px 0 4px;
    }
    .family {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 4px 0 12px;
      min-height: 30px;
    }
    .family lk-icon {
      color: var(--muted);
    }
    .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }
    ul {
      margin: 0;
      padding: 0 8px 0 30px;
      list-style: none;
    }
    li {
      padding: 3px 8px;
      border-radius: 4px;
      color: var(--muted);
    }
    li.type {
      color: var(--ink);
      cursor: grab;
    }
    li.type:hover {
      background: var(--inset);
    }
  `,
})
export class LibraryPanelComponent {
  protected readonly library = inject(LibraryService);
  private readonly project = inject(ProjectService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);
  protected readonly icons = OPENING_ICONS;

  /** The project's families that have types, by kind, each with its types narrowest first. */
  protected readonly projectFamilies = computed(() => {
    const model = this.project.store.model();
    return Object.values(model.openingFamilies)
      .map((family: OpeningFamily) => ({
        family,
        name: family.name ?? this.kindName(family.kind),
        types: familyTypes(model, family.id),
      }))
      .filter((f) => f.types.length > 0);
  });

  protected kindName(kind: OpeningKind): string {
    return this.language.text('panel.opening.' + kind);
  }

  /** A type's name with its sizes, or its sizes alone. */
  protected typeName(t: Pick<OpeningType, 'name' | 'width' | 'height'>): string {
    const size = this.format.openingSize(t.width, t.height);
    return t.name ? `${t.name} · ${size}` : size;
  }

  protected dragStart(e: DragEvent, kind: OpeningKind, t: OpeningType): void {
    this.library.startDrag({ kind, type: t.id });
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', this.typeName(t));
    }
  }
}
