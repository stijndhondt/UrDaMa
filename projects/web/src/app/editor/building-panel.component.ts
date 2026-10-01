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
import { SharedModule, type MenuItem, type TreeNode } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { Menu, MenuModule } from '@openng/optimus-ui/menu';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { TreeModule } from '@openng/optimus-ui/tree';
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

/** What a tree node holds, by its type (Optimus picks the template by type). */
type NodeData =
  | { readonly level: LevelNode }
  | { readonly group: Group; readonly count: number }
  | { readonly row: ElementRow; readonly level: LevelId }
  | Record<string, never>;

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
  imports: [
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    MenuModule,
    SharedModule,
    TooltipModule,
    TreeModule,
    IconComponent,
    AddLevelDialogComponent,
  ],
  template: `
    <div class="actions">
      <p-button
        size="small"
        severity="secondary"
        [text]="true"
        (onClick)="addDialog().open('above')"
      >
        <lk-icon name="plus" /> {{ 'levels.addAbove' | translate }}
      </p-button>
      <p-button
        size="small"
        severity="secondary"
        [text]="true"
        (onClick)="addDialog().open('below')"
      >
        <lk-icon name="plus" /> {{ 'levels.addBelow' | translate }}
      </p-button>
    </div>
    <p-tree
      [value]="nodes()"
      selectionMode="multiple"
      [metaKeySelection]="true"
      [selection]="selectedNodes()"
      [ariaLabel]="'shell.building' | translate"
      [indentation]="0.75"
      (onNodeSelect)="picked($event.node, $event.originalEvent, true)"
      (onNodeUnselect)="picked($event.node, $event.originalEvent, false)"
      (onNodeExpand)="setOpen($event.node, true)"
      (onNodeCollapse)="setOpen($event.node, false)"
    >
      <ng-template pTemplate="level" let-node>
        @let level = node.data.level;
        @let current = level.id === project.level();
        @let hidden = visibility.isHidden(level.id);
        <span class="level" [class.current]="current" [class.hidden]="hidden">
          @if (renaming() === level.id) {
            <input
              #rename
              pInputText
              pSize="small"
              class="rename"
              [value]="level.name"
              [attr.aria-label]="'panel.level.name' | translate"
              (click)="$event.stopPropagation()"
              (keydown)="$event.stopPropagation()"
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
              <span class="text">{{ level.name }}</span>
              @if (level.key) {
                <kbd>{{ level.key }}</kbd>
              }
            </button>
          }
          <p-button
            size="small"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            [disabled]="current"
            [ariaLabel]="(hidden ? 'building.show' : 'building.hide') | translate"
            [pTooltip]="
              (current ? 'building.currentShown' : hidden ? 'building.show' : 'building.hide')
                | translate
            "
            tooltipPosition="left"
            (onClick)="visibility.toggle(level.id); $event.stopPropagation()"
          >
            <lk-icon [name]="hidden ? 'eye-off' : 'eye'" />
          </p-button>
          <p-button
            size="small"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            [ariaLabel]="'building.levelActions' | translate"
            [pTooltip]="'building.levelActions' | translate"
            tooltipPosition="left"
            (onClick)="openMenu($event, level.id)"
          >
            <lk-icon name="ellipsis" />
          </p-button>
        </span>
      </ng-template>
      <ng-template pTemplate="group" let-node>
        <span class="group">
          <span class="text">{{ 'building.' + node.data.group | translate }}</span>
          <small>{{ node.data.count }}</small>
        </span>
      </ng-template>
      <ng-template pTemplate="element" let-node>
        <span class="element" [attr.data-id]="node.data.row.select.id">
          <lk-icon [name]="node.data.row.icon" />
          <span class="text">{{ node.data.row.label }}</span>
        </span>
      </ng-template>
      <ng-template pTemplate="empty" let-node>
        <span class="empty">{{ 'building.empty' | translate }}</span>
      </ng-template>
      <ng-template pTemplate="togglericon" let-expanded>
        <lk-icon [name]="expanded ? 'chevron-down' : 'chevron-right'" />
      </ng-template>
    </p-tree>
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
      gap: 2px;
      padding: 0 6px 6px;
    }
    .actions lk-icon {
      font-size: 12px;
    }
    p-tree {
      --p-tree-padding: 0 4px;
      --p-tree-node-padding: 1px 4px;
      --p-tree-gap: 1px;
      --p-tree-node-toggle-button-size: 1.375rem;
    }
    /* The node's label takes the row, so a Level's buttons sit at its right edge. */
    :host ::ng-deep .p-tree-node-label {
      flex: 1;
      min-width: 0;
    }
    .level,
    .group,
    .element {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    /* A button that reads as the Level's name: none of the browser's own button look. */
    .name {
      flex: 1;
      min-width: 0;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .text {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .level lk-icon,
    .element lk-icon {
      font-size: 14px;
      color: var(--muted);
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
    .level p-button lk-icon {
      font-size: 14px;
    }
    .group {
      color: var(--muted);
      font-size: 12px;
    }
    kbd,
    small {
      font-size: 11px;
      color: var(--muted);
    }
    .rename {
      flex: 1;
      min-width: 0;
    }
    .empty {
      color: var(--muted);
      font-size: 12px;
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

  /** The tree for Optimus: Levels → Rooms / Walls / Openings → elements. */
  protected readonly nodes = computed<TreeNode<NodeData>[]>(() =>
    this.tree().map((level) => ({
      key: level.id,
      type: 'level',
      data: { level },
      selectable: false,
      expanded: this.isOpen(level.id),
      children: level.groups.map((g) => {
        const key = `${level.id}/${g.group}`;
        return {
          key,
          type: 'group',
          data: { group: g.group, count: g.rows.length },
          selectable: false,
          expanded: this.isOpen(key),
          leaf: false,
          children: g.rows.length
            ? g.rows.map((row) => ({
                key: row.select.id,
                type: 'element',
                data: { row, level: level.id },
              }))
            : [{ key: `${key}/empty`, type: 'empty', data: {}, selectable: false, leaf: true }],
        };
      }),
    })),
  );

  /** The tree's selected element nodes: what is selected everywhere. */
  protected readonly selectedNodes = computed(() => {
    const chosen = new Set(this.selection.current().map((s) => s.id as string));
    return this.nodes()
      .flatMap((l) => l.children ?? [])
      .flatMap((g) => g.children ?? [])
      .filter((n) => n.type === 'element' && chosen.has(n.key!));
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

  /** The tree's own toggler opened or closed a Level or group. */
  protected setOpen(node: TreeNode | undefined, open: boolean): void {
    if (node?.key && this.isOpen(node.key) !== open) this.toggleOpen(node.key);
  }

  /**
   * A click on an element: it alone is selected, or with Shift, Ctrl or Cmd it is added to (or
   * taken from) the selection.
   */
  protected picked(node: TreeNode<NodeData> | undefined, e: Event | undefined, on: boolean): void {
    const data = node?.data;
    if (!data || !('row' in data)) return;
    const mouse = e as MouseEvent | undefined;
    const add = !!(mouse?.shiftKey || mouse?.ctrlKey || mouse?.metaKey);
    if (!on && !add) return;
    this.select(data.level, data.row.select, add);
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
