import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { MenuItem } from '@openng/optimus-ui/api';
import { ContextMenu, ContextMenuModule } from '@openng/optimus-ui/contextmenu';
import { MessagesService } from '../messages.service';
import { ContextMenuItemsService } from './context-menu-items.service';
import { ContextMenuService } from './context-menu.service';

/**
 * The right-click menu on the plan (ticket 04), shown with Optimus UI (ticket 09): the actions
 * for the element under the cursor and the current selection, each with its shortcut. The editor
 * decides the target on the right mouse button; the plan's `contextmenu` event then opens this at
 * the cursor.
 */
@Component({
  selector: 'lk-context-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ContextMenuModule],
  template: `
    <p-contextmenu #menu [model]="items()" appendTo="body">
      <ng-template #item let-item>
        <a
          class="item"
          [class.head]="item.styleClass === 'head'"
          [class.danger]="item.styleClass === 'danger'"
        >
          <span>{{ item.label }}</span>
          @if (item.shortcut) {
            <kbd>{{ item.shortcut }}</kbd>
          }
        </a>
      </ng-template>
    </p-contextmenu>
  `,
  styles: `
    .item {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 220px;
      padding: 6px 12px;
      cursor: pointer;
    }
    .item span {
      flex: 1;
    }
    .item.head {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
      cursor: default;
    }
    .item.danger {
      color: var(--bad);
    }
    kbd {
      font: 11px var(--sans);
      color: var(--muted);
    }
  `,
})
export class ContextMenuComponent {
  private readonly menus = inject(ContextMenuService);
  private readonly view = inject(ContextMenuItemsService).view;
  private readonly messages = inject(MessagesService);
  private readonly translate = inject(TranslateService);
  private readonly menu = viewChild.required<ContextMenu>('menu');
  /** The items as they were when the menu opened. */
  protected readonly items = signal<MenuItem[]>([]);

  /** The plan's `contextmenu` event: shows the menu the editor prepared, at the cursor. */
  openAt(e: MouseEvent): void {
    const view = this.view();
    if (!this.menus.menu() || !view) return;
    this.menus.close();
    const at = view.at;
    const t = (key: string) => this.translate.instant(key);
    this.items.set([
      { label: view.name ?? t(view.headingKey), styleClass: 'head', disabled: true },
      ...view.items.flatMap((item): MenuItem[] => [
        ...(item.separated ? [{ separator: true }] : []),
        {
          label: t(item.labelKey),
          shortcut: item.shortcut,
          disabled: !item.enabled,
          styleClass: item.danger ? 'danger' : undefined,
          // A refusal shows where the menu was, next to the element it is about.
          command: () => this.messages.showRefusalsAt(at, () => item.run()),
        },
      ]),
    ]);
    this.menu().show(e);
  }
}
