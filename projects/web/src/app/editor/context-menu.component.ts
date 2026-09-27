import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { resolveOpening } from '@lakudemis/core';
import { ContextMenuService } from './context-menu.service';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { EditorActionsService } from './editor-actions.service';
import { SelectionService } from './selection.service';

interface MenuItem {
  readonly label: string;
  readonly shortcut: string;
  readonly enabled: boolean;
  readonly danger?: boolean;
  /** A line above this item */
  readonly separated?: boolean;
  readonly run: () => void;
}

/**
 * The right-click menu on the plan (slice 2, ticket 04): the actions for the element under the
 * cursor and the current selection, each with its shortcut. It is one list of the same commands
 * as the buttons and keys.
 */
@Component({
  selector: 'lk-context-menu',
  imports: [TranslatePipe],
  template: `
    @if (view(); as v) {
      <button
        type="button"
        class="backdrop"
        [attr.aria-label]="'contextMenu.close' | translate"
        (click)="menus.close()"
        (contextmenu)="$event.preventDefault(); menus.close()"
      ></button>
      <div
        #list
        class="menu"
        role="menu"
        [attr.aria-label]="v.name ?? (v.headingKey | translate)"
        [style.left.px]="v.at.x"
        [style.top.px]="v.at.y"
      >
        <div class="heading">{{ v.name ?? (v.headingKey | translate) }}</div>
        @for (item of v.items; track $index) {
          @if (item.separated) {
            <div class="line" role="separator"></div>
          }
          <button
            type="button"
            role="menuitem"
            [disabled]="!item.enabled"
            [class.danger]="item.danger"
            (click)="choose(item)"
          >
            <span>{{ item.label | translate }}</span>
            <kbd>{{ item.shortcut }}</kbd>
          </button>
        }
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: absolute;
      inset: 0;
      border: 0;
      background: transparent;
      z-index: 20;
      cursor: default;
    }
    .menu {
      position: absolute;
      z-index: 21;
      min-width: 220px;
      padding: 4px;
      display: flex;
      flex-direction: column;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
      font-size: 13px;
    }
    .heading {
      padding: 6px 10px 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .line {
      height: 1px;
      margin: 4px 6px;
      background: var(--line);
    }
    button[role='menuitem'] {
      display: flex;
      align-items: center;
      gap: 16px;
      height: 30px;
      padding: 0 10px;
      border: 0;
      border-radius: 5px;
      background: transparent;
      color: var(--ink);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    button[role='menuitem'] span {
      flex-grow: 1;
    }
    button[role='menuitem']:hover:not(:disabled),
    button[role='menuitem']:focus-visible {
      background: #eef3fd;
      outline: none;
    }
    button[role='menuitem']:disabled {
      color: var(--muted);
      cursor: default;
    }
    button.danger:not(:disabled) {
      color: #b42318;
    }
    kbd {
      font:
        12px system-ui,
        sans-serif;
      color: var(--muted);
    }
  `,
})
export class ContextMenuComponent {
  protected readonly menus = inject(ContextMenuService);
  private readonly actions = inject(EditorActionsService);
  private readonly selection = inject(SelectionService);
  private readonly project = inject(ProjectService);
  private readonly messages = inject(MessagesService);
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  constructor() {
    // Keep the menu inside the plan area, and put keyboard users on the first action.
    effect(() => {
      const el = this.list()?.nativeElement;
      if (!el) return;
      const area = el.offsetParent as HTMLElement | null;
      if (area) {
        const maxTop = area.clientHeight - el.offsetHeight - 4;
        const maxLeft = area.clientWidth - el.offsetWidth - 4;
        if (el.offsetTop > maxTop) el.style.top = `${Math.max(4, maxTop)}px`;
        if (el.offsetLeft > maxLeft) el.style.left = `${Math.max(4, maxLeft)}px`;
      }
      el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    });
  }

  protected readonly view = computed(() => {
    const menu = this.menus.menu();
    if (!menu) return null;
    const { target } = menu;
    const model = this.project.store.model();
    const del: MenuItem = {
      label: 'contextMenu.delete',
      shortcut: 'Del',
      enabled: true,
      danger: true,
      separated: true,
      run: () => this.actions.deleteSelection(),
    };
    /** A Room's own name, else a translated heading */
    let name: string | null = null;
    let headingKey = '';
    let items: MenuItem[];
    switch (target.kind) {
      case 'empty':
        headingKey = 'contextMenu.emptyArea';
        items = [
          {
            label: 'contextMenu.createRoom',
            shortcut: '',
            enabled: true,
            run: () => this.actions.createRoom(target.seed),
          },
        ];
        break;
      case 'room': {
        const room = model.rooms[target.id];
        const twoRooms = this.selection.rooms();
        name = room?.name ?? null;
        headingKey = 'contextMenu.room';
        items = [
          {
            label: 'contextMenu.mergeRooms',
            shortcut: 'M',
            enabled: twoRooms.length === 2 && twoRooms.some((r) => r.id === target.id),
            run: () => this.actions.merge(),
          },
          {
            label: 'contextMenu.resetHeights',
            shortcut: '',
            enabled: room?.height !== undefined || room?.floorBuildUp !== undefined,
            run: () => this.actions.resetRoomHeights(target.id),
          },
          del,
        ];
        break;
      }
      case 'wall': {
        const wall = model.walls[target.id];
        headingKey = 'contextMenu.wall';
        items = [
          {
            label: 'contextMenu.resetThickness',
            shortcut: '',
            enabled: wall?.thickness !== undefined,
            run: () => this.actions.resetWallThickness(target.id),
          },
          del,
        ];
        break;
      }
      case 'opening': {
        const opening = model.openings[target.id];
        const door = !!opening && resolveOpening(model, opening)?.kind === 'door';
        headingKey = door ? 'contextMenu.door' : 'contextMenu.window';
        items = [
          {
            label: 'contextMenu.flipHinge',
            shortcut: 'F',
            enabled: door,
            run: () => this.actions.flipOpening('hinge'),
          },
          {
            label: 'contextMenu.flipSwing',
            shortcut: 'Shift+F',
            enabled: door,
            run: () => this.actions.flipOpening('swing'),
          },
          del,
        ];
        break;
      }
      case 'separator':
        headingKey = 'contextMenu.separator';
        items = [{ ...del, separated: false }];
        break;
    }
    return { at: menu.at, name, headingKey, items };
  });

  protected choose(item: MenuItem): void {
    const at = this.menus.menu()?.at;
    this.menus.close();
    // A refusal shows where the menu was, next to the element it is about.
    this.messages.showRefusalsAt(at, () => item.run());
  }
}
