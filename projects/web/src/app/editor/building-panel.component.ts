import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  deleteLevel,
  resolveOpening,
  updateLevel,
  wallLength,
  wallNumbers,
  type LevelId,
} from '@lakudemis/core';
import type { Selection } from '@lakudemis/editor2d';
import type { MenuItem } from '@openng/optimus-ui/api';
import { Menu, MenuModule } from '@openng/optimus-ui/menu';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { IconComponent } from '../shell/icon.component';
import { OPENING_ICONS } from '../shell/opening-icons';
import type { IconName } from '../shell/icons.generated';
import { AddLevelDialogComponent } from './add-level-dialog.component';
import { LevelVisibilityService } from './level-visibility.service';
import { SelectionService } from './selection.service';

type Group = 'rooms' | 'walls' | 'openings';

interface ElementRow {
  readonly select: Selection;
  readonly label: string;
  readonly icon: IconName;
}

interface LevelNode {
  readonly id: LevelId;
  readonly name: string;
  /** Key 1–9 chooses it (lowest Level = 1) */
  readonly key: number | null;
  readonly groups: readonly { readonly group: Group; readonly rows: readonly ElementRow[] }[];
}

/**
 * The Building panel (ticket 10): every Level, highest first, with show/hide and its Rooms,
 * Walls and Openings. Clicking a Level draws on it; clicking an element selects it everywhere,
 * and an element selected elsewhere is revealed here. Levels are added, renamed and deleted from
 * the panel (it replaces the Level tabs).
 */
@Component({
  selector: 'lk-building-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MenuModule, TooltipModule, IconComponent, AddLevelDialogComponent],
  template: `
    <div class="actions">
      <button type="button" (click)="addDialog().open('above')">
        <lk-icon name="plus" /> {{ 'levels.addAbove' | translate }}
      </button>
      <button type="button" (click)="addDialog().open('below')">
        <lk-icon name="plus" /> {{ 'levels.addBelow' | translate }}
      </button>
    </div>
    <ul class="tree" role="tree" [attr.aria-label]="'shell.building' | translate">
      @for (level of tree(); track level.id) {
        @let current = level.id === project.level();
        @let hidden = visibility.isHidden(level.id);
        <li role="treeitem" [attr.aria-expanded]="isOpen(level.id)" [attr.aria-selected]="current">
          <div class="row level" [class.current]="current" [class.hidden]="hidden">
            <button
              type="button"
              class="chevron"
              [attr.aria-label]="
                (isOpen(level.id) ? 'building.collapse' : 'building.expand') | translate
              "
              (click)="toggleOpen(level.id)"
            >
              <lk-icon [name]="isOpen(level.id) ? 'chevron-down' : 'chevron-right'" />
            </button>
            @if (renaming() === level.id) {
              <input
                #rename
                class="rename"
                [value]="level.name"
                [attr.aria-label]="'panel.level.name' | translate"
                (keydown.enter)="finishRename(level.id, rename.value)"
                (keydown.escape)="renaming.set(null)"
                (blur)="finishRename(level.id, rename.value)"
              />
            } @else {
              <button
                type="button"
                class="name"
                [pTooltip]="'building.drawOn' | translate"
                tooltipPosition="right"
                [tooltipOptions]="{ showDelay: 600 }"
                (click)="choose(level.id)"
                (dblclick)="startRename(level.id)"
              >
                <lk-icon name="layers" />
                <span>{{ level.name }}</span>
                @if (level.key) {
                  <kbd>{{ level.key }}</kbd>
                }
              </button>
            }
            <button
              type="button"
              class="tool"
              [disabled]="current"
              [attr.aria-pressed]="!hidden"
              [attr.aria-label]="(hidden ? 'building.show' : 'building.hide') | translate"
              [pTooltip]="
                (current ? 'building.currentShown' : hidden ? 'building.show' : 'building.hide')
                  | translate
              "
              tooltipPosition="left"
              (click)="visibility.toggle(level.id)"
            >
              <lk-icon [name]="hidden ? 'eye-off' : 'eye'" />
            </button>
            <button
              type="button"
              class="tool"
              [attr.aria-label]="'building.levelActions' | translate"
              [pTooltip]="'building.levelActions' | translate"
              tooltipPosition="left"
              (click)="openMenu($event, level.id)"
            >
              <lk-icon name="ellipsis" />
            </button>
          </div>
          @if (isOpen(level.id)) {
            <ul role="group">
              @for (g of level.groups; track g.group) {
                @let key = level.id + '/' + g.group;
                <li role="treeitem" aria-selected="false" [attr.aria-expanded]="isOpen(key)">
                  <div class="row group">
                    <button
                      type="button"
                      class="chevron"
                      (click)="toggleOpen(key)"
                      [attr.aria-label]="'building.' + g.group | translate"
                    >
                      <lk-icon [name]="isOpen(key) ? 'chevron-down' : 'chevron-right'" />
                    </button>
                    <button type="button" class="name" (click)="toggleOpen(key)">
                      <span>{{ 'building.' + g.group | translate }}</span>
                      <small>{{ g.rows.length }}</small>
                    </button>
                  </div>
                  @if (isOpen(key)) {
                    <ul role="group">
                      @for (r of g.rows; track r.select.id) {
                        <li role="treeitem" [attr.aria-selected]="isSelected(r.select)">
                          <button
                            type="button"
                            class="row element"
                            [attr.data-id]="r.select.id"
                            [class.on]="isSelected(r.select)"
                            (click)="select(level.id, r.select, $event.shiftKey)"
                          >
                            <lk-icon [name]="r.icon" />
                            <span>{{ r.label }}</span>
                          </button>
                        </li>
                      } @empty {
                        <li class="empty">{{ 'building.empty' | translate }}</li>
                      }
                    </ul>
                  }
                </li>
              }
            </ul>
          }
        </li>
      }
    </ul>
    <p-menu #menu [model]="menuItems()" [popup]="true" appendTo="body" />
    <lk-add-level-dialog />
  `,
  styles: `
    :host {
      display: block;
      font-size: 13px;
    }
    .actions {
      display: flex;
      gap: 4px;
      padding: 0 8px 8px;
    }
    .actions button {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border: 1px dashed var(--line);
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      cursor: pointer;
    }
    .actions button:hover {
      color: var(--ink);
      border-color: var(--accent);
    }
    .actions lk-icon {
      font-size: 12px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    ul ul {
      padding-left: 14px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 2px;
      min-height: 26px;
      padding-right: 4px;
      border-radius: 5px;
    }
    .row button {
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .chevron,
    .tool {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      color: var(--muted) !important;
    }
    .chevron lk-icon,
    .tool lk-icon {
      font-size: 14px;
    }
    .tool:hover:not(:disabled),
    .chevron:hover {
      background: var(--hover) !important;
      color: var(--ink) !important;
    }
    .tool:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .name {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      height: 24px;
      padding: 0 4px;
      text-align: left;
    }
    .name span {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .name lk-icon {
      font-size: 14px;
      color: var(--muted);
    }
    .level.current {
      background: var(--accent-soft);
    }
    .level.current .name {
      color: var(--accent);
      font-weight: 600;
    }
    .level.current .name lk-icon {
      color: var(--accent);
    }
    .level.hidden .name {
      color: var(--muted);
      text-decoration: line-through;
    }
    kbd,
    small {
      font-size: 11px;
      color: var(--muted);
    }
    .rename {
      flex: 1;
      min-width: 0;
      height: 24px;
      padding: 0 6px;
      border: 1px solid var(--accent);
      border-radius: 4px;
      background: var(--inset);
      color: var(--ink);
    }
    .group .name {
      color: var(--muted);
      font-size: 12px;
    }
    .element {
      width: 100%;
      gap: 6px !important;
      padding: 0 6px !important;
      text-align: left;
    }
    .element lk-icon {
      font-size: 13px;
      color: var(--muted);
    }
    .element:hover {
      background: var(--hover) !important;
    }
    .element.on {
      background: var(--accent-soft) !important;
      color: var(--accent) !important;
    }
    .element.on lk-icon {
      color: var(--accent);
    }
    .empty {
      padding: 2px 8px;
      font-size: 12px;
      color: var(--muted);
    }
  `,
})
export class BuildingPanelComponent {
  protected readonly project = inject(ProjectService);
  protected readonly visibility = inject(LevelVisibilityService);
  private readonly selection = inject(SelectionService);
  private readonly messages = inject(MessagesService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly addDialog = viewChild.required(AddLevelDialogComponent);
  private readonly menu = viewChild.required<Menu>('menu');
  private readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('rename');

  /** Expanded Levels and groups (`level` or `level/rooms`); the current Level starts open. */
  private readonly open = signal<ReadonlySet<string>>(new Set());
  private readonly closed = signal<ReadonlySet<string>>(new Set());
  protected readonly renaming = signal<LevelId | null>(null);
  protected readonly menuItems = signal<MenuItem[]>([]);

  protected readonly tree = computed<LevelNode[]>(() => {
    const model = this.project.store.model();
    const levels = this.project.levels();
    const t = (key: string, params?: object) => this.language.text(key, params);
    return [...levels].reverse().map((level): LevelNode => {
      const order = levels.indexOf(level);
      const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
      const rooms = Object.values(model.rooms)
        .filter((r) => r.level === level.id)
        .sort(byName)
        .map((r): ElementRow => ({
          select: { kind: 'room', id: r.id },
          label: r.name,
          icon: 'square',
        }));
      const numbers = wallNumbers(model, level.id);
      const walls = [...numbers].map(([id, n]): ElementRow => ({
        select: { kind: 'wall', id },
        label: t('building.wallLabel', {
          n,
          length: this.format.length(wallLength(model.walls[id]!)),
        }),
        icon: 'brick-wall',
      }));
      const onLevel = new Set<string>(numbers.keys());
      const openings = Object.values(model.openings)
        .filter((o) => onLevel.has(o.wall))
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .flatMap((o): ElementRow[] => {
          const r = resolveOpening(model, o);
          if (!r) return [];
          const size = this.format.openingSize(r.width, r.height);
          return [
            {
              select: { kind: 'opening', id: o.id },
              label: `${t('panel.opening.' + r.kind)} ${size}`,
              icon: OPENING_ICONS[r.kind],
            },
          ];
        });
      return {
        id: level.id,
        name: level.name,
        key: order < 9 ? order + 1 : null,
        groups: [
          { group: 'rooms', rows: rooms },
          { group: 'walls', rows: walls },
          { group: 'openings', rows: openings },
        ],
      };
    });
  });

  constructor() {
    // An element selected elsewhere is revealed here: its Level and group open, its row in view.
    effect(() => {
      const [first] = this.selection.current();
      const level = this.project.level();
      if (!first) return;
      const group: Group =
        first.kind === 'room' ? 'rooms' : first.kind === 'opening' ? 'openings' : 'walls';
      if (first.kind === 'separator') return;
      untracked(() => {
        this.expand(level);
        this.expand(`${level}/${group}`);
        afterNextRender(
          () =>
            this.host.nativeElement
              .querySelector(`[data-id="${first.id}"]`)
              ?.scrollIntoView({ block: 'nearest' }),
          { injector: this.injector },
        );
      });
    });
  }

  /** The current Level is open unless the user closed it; others when the user opened them. */
  protected isOpen(key: string): boolean {
    if (this.closed().has(key)) return false;
    return this.open().has(key) || key === this.project.level();
  }

  protected toggleOpen(key: string): void {
    const open = this.isOpen(key);
    const add = (s: ReadonlySet<string>) => new Set([...s, key]);
    const remove = (s: ReadonlySet<string>) => new Set([...s].filter((k) => k !== key));
    this.open.set(open ? remove(this.open()) : add(this.open()));
    this.closed.set(open ? add(this.closed()) : remove(this.closed()));
  }

  private expand(key: string): void {
    if (!this.isOpen(key)) this.toggleOpen(key);
  }

  protected isSelected(s: Selection): boolean {
    return this.selection.current().some((x) => x.kind === s.kind && x.id === s.id);
  }

  /** Draw on a Level (keys 1–9 do the same). */
  protected choose(level: LevelId): void {
    if (level === this.project.level()) return;
    this.selection.clear();
    this.project.selectLevel(level);
  }

  protected select(level: LevelId, s: Selection, add: boolean): void {
    if (level !== this.project.level()) {
      this.selection.clear();
      this.project.selectLevel(level);
    }
    const current = this.selection.current();
    if (add && current.length) {
      const has = this.isSelected(s);
      this.selection.current.set(
        has ? current.filter((x) => !(x.kind === s.kind && x.id === s.id)) : [...current, s],
      );
    } else this.selection.current.set([s]);
  }

  protected startRename(level: LevelId): void {
    this.renaming.set(level);
    afterNextRender(
      () => {
        const input = this.renameInput()?.nativeElement;
        input?.focus();
        input?.select();
      },
      { injector: this.injector },
    );
  }

  protected finishRename(level: LevelId, name: string): void {
    if (this.renaming() !== level) return;
    this.renaming.set(null);
    const old = this.project.store.model().levels[level]?.name;
    if (!name.trim() || name.trim() === old) return;
    const result = this.project.store.run(updateLevel, { level, name });
    if (!result.ok) this.messages.refused(result.reason);
  }

  protected openMenu(e: Event, level: LevelId): void {
    const t = (key: string, params?: object) => this.language.text(key, params);
    const name = this.project.store.model().levels[level]?.name ?? '';
    this.menuItems.set([
      { label: t('building.drawOn'), command: () => this.choose(level) },
      {
        label: t('levels.addAboveTitle'),
        command: () => {
          this.choose(level);
          this.addDialog().open('above');
        },
      },
      {
        label: t('levels.addBelowTitle'),
        command: () => {
          this.choose(level);
          this.addDialog().open('below');
        },
      },
      { label: t('building.rename'), command: () => this.startRename(level) },
      { separator: true },
      {
        label: t('panel.level.delete'),
        disabled: this.project.levels().length < 2,
        command: () => this.remove(level, name),
      },
    ]);
    this.menu().toggle(e);
  }

  private remove(level: LevelId, name: string): void {
    if (!window.confirm(this.language.text('panel.level.confirmDelete', { name }))) return;
    const result = this.project.store.run(deleteLevel, { level });
    if (!result.ok) this.messages.refused(result.reason);
  }
}
