import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import {
  quantityTree,
  toCsv,
  type LevelId,
  type QuantityFace,
  type QuantityLevel,
  type QuantityRoom,
} from '@lakudemis/core';
import type { Selection } from '@lakudemis/editor2d';
import type { TreeNode } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { SelectModule } from '@openng/optimus-ui/select';
import { TreeTableModule } from '@openng/optimus-ui/treetable';
import { SelectionService } from '../editor/selection.service';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { ProjectService } from '../project/project.service';
import { IconComponent } from '../shell/icon.component';
import { MeasurementService } from './measurement.service';

type SurfaceKind = 'netFloor' | 'floorFinish' | 'ceiling';
type Column = 'length' | 'height' | 'gross' | 'openings' | 'net' | 'reveals' | 'volume';

const COLUMNS: readonly { readonly key: Column; readonly unit: 'm' | 'm²' | 'm³' }[] = [
  { key: 'length', unit: 'm' },
  { key: 'height', unit: 'm' },
  { key: 'gross', unit: 'm²' },
  { key: 'openings', unit: 'm²' },
  { key: 'net', unit: 'm²' },
  { key: 'reveals', unit: 'm²' },
  { key: 'volume', unit: 'm³' },
];

/** One row of the tree: its name and its figures (mm, mm², mm³; absent = not applicable). */
interface Row {
  readonly key: string;
  readonly kind: 'level' | 'room' | SurfaceKind | 'face';
  readonly name: string;
  readonly level: string;
  readonly room: string;
  readonly figures: Partial<Record<Column, number | null>>;
  /** What a click selects */
  readonly select?: Selection;
  readonly levelId: LevelId;
}

/**
 * The Quantities (ticket 12) in the bottom panel: a tree of Level → Room (its totals) → its floor,
 * its ceiling and each of its Wall faces, under the chosen Measurement rule. A click selects the
 * surface's Room or Wall everywhere; the CSV export writes the same tree in the UI language.
 */
@Component({
  selector: 'lk-quantities-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, ButtonModule, SelectModule, TreeTableModule, IconComponent],
  template: `
    <div class="head">
      <div class="rule">
        <label for="quantities-rule">{{ 'quantities.rule' | translate }}</label>
        <p-select
          inputId="quantities-rule"
          size="small"
          appendTo="body"
          [options]="measurement.options()"
          optionLabel="label"
          optionValue="value"
          [ngModel]="measurement.rule()"
          (ngModelChange)="measurement.rule.set($event)"
        />
      </div>
      <span class="spacer"></span>
      <p-button size="small" severity="secondary" (onClick)="exportCsv()">
        <lk-icon name="file-down" /> {{ 'quantities.export' | translate }}
      </p-button>
    </div>
    <p-treetable
      [value]="nodes()"
      size="small"
      [scrollable]="true"
      scrollHeight="flex"
      selectionMode="single"
      (onNodeSelect)="choose($event.node)"
      (onNodeExpand)="setOpen($event.node, true)"
      (onNodeCollapse)="setOpen($event.node, false)"
    >
      <ng-template #header>
        <tr>
          <th>{{ 'quantities.name' | translate }}</th>
          @for (c of columns; track c.key) {
            <th class="num">{{ 'quantities.tree.' + c.key | translate }} ({{ c.unit }})</th>
          }
        </tr>
      </ng-template>
      <ng-template #body let-rowNode let-row="rowData">
        <tr [ttRow]="rowNode" [ttSelectableRow]="rowNode" [class]="'kind-' + row.kind">
          <td class="name">
            <p-treetable-toggler [rowNode]="rowNode" />
            {{ row.name }}
          </td>
          @for (c of columns; track c.key) {
            <td class="num">{{ cell(row, c.key) }}</td>
          }
        </tr>
      </ng-template>
    </p-treetable>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      font-size: 13px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px;
    }
    .spacer {
      flex: 1;
    }
    .rule {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      color: var(--muted);
    }
    .rule p-select {
      width: 260px;
      max-width: 40vw;
    }
    p-treetable {
      flex: 1;
      min-height: 0;
    }
    th {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .name {
      white-space: nowrap;
    }
    .kind-level td {
      font-weight: 600;
    }
    .kind-room td.name {
      font-weight: 600;
    }
  `,
})
export class QuantitiesPanelComponent {
  protected readonly measurement = inject(MeasurementService);
  private readonly project = inject(ProjectService);
  private readonly selection = inject(SelectionService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);

  protected readonly columns = COLUMNS;
  /** Rows the user opened or closed; Levels start open. */
  private readonly open = signal<ReadonlyMap<string, boolean>>(new Map());

  private readonly tree = computed(() =>
    quantityTree(this.project.store.model(), this.project.store.values, this.measurement.rule()),
  );

  /** The tree as rows, with its names in the user's language. */
  private readonly rows = computed(() => {
    const t = (key: string, params?: object) => this.language.text(key, params);
    return this.tree().map((level) => ({
      row: this.levelRow(level),
      rooms: level.rooms.map((room) => ({
        row: this.roomRow(level, room),
        children: [
          this.surfaceRow(
            level,
            room,
            'netFloor',
            t('quantities.tree.netFloor'),
            room.netFloorArea,
          ),
          this.surfaceRow(
            level,
            room,
            'floorFinish',
            t('quantities.tree.floorFinish'),
            room.floorFinishArea,
          ),
          this.surfaceRow(level, room, 'ceiling', t('quantities.tree.ceiling'), room.ceilingArea),
          ...room.faces.map((f) => this.faceRow(level, room, f, t)),
        ],
      })),
    }));
  });

  protected readonly nodes = computed<TreeNode[]>(() => {
    const open = this.open();
    const node = (row: Row, children?: TreeNode[], byDefault = false): TreeNode => ({
      key: row.key,
      data: row,
      expanded: open.get(row.key) ?? byDefault,
      children,
      leaf: !children?.length,
    });
    return this.rows().map((level) =>
      node(
        level.row,
        level.rooms.map((room) =>
          node(
            room.row,
            room.children.map((c) => node(c)),
          ),
        ),
        true,
      ),
    );
  });

  private levelRow(level: QuantityLevel): Row {
    return {
      key: level.level,
      kind: 'level',
      name: level.name,
      level: level.name,
      room: '',
      levelId: level.level,
      figures: { gross: level.grossFloorArea, net: level.netFloorArea, volume: level.volume },
    };
  }

  private roomRow(level: QuantityLevel, room: QuantityRoom): Row {
    return {
      key: room.room,
      kind: 'room',
      name: room.name,
      level: level.name,
      room: room.name,
      levelId: level.level,
      select: { kind: 'room', id: room.room },
      // The Room's totals over its Wall faces; its floor and ceiling are rows below it.
      figures: {
        length: room.wallLength,
        gross: room.grossWallArea,
        openings: room.openingArea,
        net: room.netWallArea,
        reveals: room.revealArea,
        volume: room.volume,
      },
    };
  }

  private surfaceRow(
    level: QuantityLevel,
    room: QuantityRoom,
    kind: SurfaceKind,
    name: string,
    area: number | null,
  ): Row {
    return {
      key: `${room.room}/${kind}`,
      kind,
      name,
      level: level.name,
      room: room.name,
      levelId: level.level,
      select: { kind: 'room', id: room.room },
      figures: { net: area },
    };
  }

  private faceRow(
    level: QuantityLevel,
    room: QuantityRoom,
    f: QuantityFace,
    t: (key: string, params?: object) => string,
  ): Row {
    return {
      key: `${room.room}/${f.wall}/${f.face}`,
      kind: 'face',
      name: t('quantities.tree.face', {
        n: f.wallNumber,
        face: t(f.face === 'drawn' ? 'quantities.tree.drawn' : 'quantities.tree.other'),
      }),
      level: level.name,
      room: room.name,
      levelId: level.level,
      select: { kind: 'wall', id: f.wall },
      figures: {
        length: f.length,
        height: f.height,
        gross: f.gross,
        openings: f.openings,
        net: f.net,
        reveals: f.revealArea,
      },
    };
  }

  /** A figure in m, m² or m³, null where the row has none. */
  private value(row: Row, key: Column): number | null {
    const v = row.figures[key];
    if (v === undefined || v === null) return null;
    return key === 'length' || key === 'height' ? v / 1000 : key === 'volume' ? v / 1e9 : v / 1e6;
  }

  protected cell(row: Row, key: Column): string {
    const v = this.value(row, key);
    return v === null ? '' : this.format.decimal(v);
  }

  protected setOpen(node: TreeNode | undefined, open: boolean): void {
    const key = node?.key;
    if (!key) return;
    this.open.set(new Map(this.open()).set(key, open));
  }

  protected choose(node: TreeNode | undefined): void {
    const row = node?.data as Row | undefined;
    if (!row?.select) return;
    if (row.levelId !== this.project.level()) this.project.selectLevel(row.levelId);
    this.selection.current.set([row.select]);
  }

  /** The CSV: the same tree, one line per row, with its Level, Room and surface named. */
  protected exportCsv(): void {
    const t = (key: string) => this.language.text(key);
    const header = [
      t('quantities.tree.level'),
      t('quantities.tree.room'),
      t('quantities.tree.surface'),
      ...COLUMNS.map((c) => `${t('quantities.tree.' + c.key)} (${c.unit})`),
    ];
    const line = (row: Row, surface: string) => [
      row.level,
      row.room,
      surface,
      ...COLUMNS.map((c) => this.value(row, c.key)),
    ];
    const lines = this.rows().flatMap((level) => [
      line(level.row, ''),
      ...level.rooms.flatMap((room) => [
        line(room.row, ''),
        ...room.children.map((c) => line(c, c.name)),
      ]),
    ]);
    const dutch = this.language.current() === 'nl';
    const csv = toCsv(header, lines, { separator: dutch ? ';' : ',', decimalComma: dutch });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.project.name()} - ${t('quantities.fileName')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
