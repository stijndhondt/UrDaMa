import { Injectable, computed, inject } from '@angular/core';
import { resolveOpening } from '@lakudemis/core';
import { ProjectService } from '../project/project.service';
import { ContextMenuService } from './context-menu.service';
import { EditorActionsService } from './editor-actions.service';
import { SelectionService } from './selection.service';

export interface ContextMenuItem {
  /** Translation key of the action */
  readonly labelKey: string;
  readonly shortcut: string;
  readonly enabled: boolean;
  readonly danger?: boolean;
  /** A line above this item */
  readonly separated?: boolean;
  readonly run: () => void;
}

/**
 * What the open right-click menu shows (slice 2, ticket 04): a heading and the actions for the
 * element under the cursor and the current selection. Kept apart from the component so any menu
 * widget can show it.
 */
@Injectable({ providedIn: 'root' })
export class ContextMenuItemsService {
  private readonly menus = inject(ContextMenuService);
  private readonly actions = inject(EditorActionsService);
  private readonly selection = inject(SelectionService);
  private readonly project = inject(ProjectService);

  readonly view = computed(() => {
    const menu = this.menus.menu();
    if (!menu) return null;
    const { target } = menu;
    const model = this.project.store.model();
    const del: ContextMenuItem = {
      labelKey: 'contextMenu.delete',
      shortcut: 'Del',
      enabled: true,
      danger: true,
      separated: true,
      run: () => this.actions.deleteSelection(),
    };
    /** A Room's own name, else a translated heading */
    let name: string | null = null;
    let headingKey = '';
    let items: ContextMenuItem[];
    switch (target.kind) {
      case 'empty':
        headingKey = 'contextMenu.emptyArea';
        items = [
          {
            labelKey: 'contextMenu.createRoom',
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
            labelKey: 'contextMenu.mergeRooms',
            shortcut: 'M',
            enabled: twoRooms.length === 2 && twoRooms.some((r) => r.id === target.id),
            run: () => this.actions.merge(),
          },
          {
            labelKey: 'contextMenu.resetHeights',
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
            labelKey: 'contextMenu.resetThickness',
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
            labelKey: 'contextMenu.flipHinge',
            shortcut: 'F',
            enabled: door,
            run: () => this.actions.flipOpening('hinge'),
          },
          {
            labelKey: 'contextMenu.flipSwing',
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
}
