import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import {
  facadeTree,
  quantityTree,
  toCsv,
  type FacadeSide,
  type LevelId,
  type QuantityFace,
  type QuantityFacade,
  type QuantityFacadeFace,
  type QuantityFacadeLevel,
  type QuantityLevel,
  type QuantityRoom,
  type WallFaceName,
} from '@urdama/core';
import { wallFaceKey, type Selection } from '@urdama/editor2d';
import type { TreeNode } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { SelectModule } from '@openng/optimus-ui/select';
import { TreeTableModule } from '@openng/optimus-ui/treetable';
import { SelectionService, type FacadePick } from '../editor/selection.service';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { ProjectService } from '../project/project.service';
import { settled } from '../project/settled';
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
  readonly kind:
    | 'level'
    | 'room'
    | SurfaceKind
    | 'face'
    | 'floorOpening'
    | 'exterior'
    | 'facade'
    | 'facadePart'
    | 'facadeLevel';
  readonly name: string;
  /** For the CSV: its Level, and its Room or Façade */
  readonly level: string;
  readonly room: string;
  readonly figures: Partial<Record<Column, number | null>>;
  /** What a click selects */
  readonly select: readonly Selection[];
  /** A Façade row: its side and Wall faces, highlighted in that side's Elevation */
  readonly facade?: FacadePick;
  /** The Level a click shows in the plan, if it is about one */
  readonly levelId: LevelId | null;
}

/** A row and the rows under it. */
interface Branch {
  readonly row: Row;
  readonly children: readonly Branch[];
  /** Open until the user closes it */
  readonly open?: boolean;
}

const leaf = (row: Row): Branch => ({ row, children: [] });

/**
 * The Quantities (tickets 12, 13) in the bottom panel: a tree of Level → Room (its totals) → its
 * floor, its ceiling and each of its Wall faces, then the Exterior: each Façade → its Façade parts
 * → its outside Wall faces, with totals per Level. All under the chosen Measurement rule. A click
 * selects the surface's Room or Walls everywhere; the CSV export writes the same tree in the UI
 * language.
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
      [tableStyle]="{ 'min-width': '880px' }"
      selectionMode="single"
      (onNodeSelect)="choose($event.node)"
      (onNodeExpand)="setOpen($event.node, true)"
      (onNodeCollapse)="setOpen($event.node, false)"
    >
      <ng-template #header>
        <tr>
          <th class="name">{{ 'quantities.name' | translate }}</th>
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
    /* The names get their own room; a narrow panel scrolls the table sideways rather than
       squeezing the columns into each other. */
    .name {
      width: 240px;
      min-width: 240px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kind-level td {
      font-weight: 600;
    }
    .kind-room td.name,
    .kind-exterior td,
    .kind-facade td.name {
      font-weight: 600;
    }
    .kind-facadeLevel td {
      color: var(--muted);
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

  /**
   * The Rooms' and Façades' figures, holding still during a drag and following when it ends
   * (ticket 33): rebuilding them on every pointer move of a 200-Wall plan took 190 ms a move.
   */
  private readonly tree = settled(this.project.store, () =>
    quantityTree(this.project.store.model(), this.project.store.values, this.measurement.rule()),
  );

  private readonly exterior = settled(this.project.store, () =>
    facadeTree(this.project.store.model(), this.project.store.values, this.measurement.rule()),
  );

  private readonly t = (key: string, params?: object) => this.language.text(key, params);

  /** The tree as rows, with its names in the user's language. */
  private readonly rows = computed((): Branch[] => {
    const t = this.t;
    const levels = this.tree().map((level): Branch => ({
      row: this.levelRow(level),
      open: true,
      children: level.rooms.map((room) => ({
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
          ...room.faces.map((f) => this.faceRow(level, room, f)),
        ].map(leaf),
      })),
    }));
    // The Floor openings through each Level's floor, after its Rooms.
    for (const [i, level] of this.tree().entries()) {
      const holes = level.floorOpenings.map((f): Branch =>
        leaf({
          key: f.floorOpening,
          kind: 'floorOpening',
          name: t('quantities.tree.floorOpening', { below: f.below, above: f.above }),
          level: level.name,
          room: '',
          levelId: level.level,
          select: [{ kind: 'floorOpening', id: f.floorOpening }],
          figures: { openings: f.area },
        }),
      );
      if (holes.length) levels[i] = { ...levels[i]!, children: [...levels[i]!.children, ...holes] };
    }
    const facades = this.exterior();
    if (!facades.length) return levels;
    const all = facades.flatMap((f) => f.parts.flatMap((p) => p.faces));
    const exterior: Branch = {
      row: {
        key: 'exterior',
        kind: 'exterior',
        name: t('quantities.tree.exterior'),
        level: '',
        room: t('quantities.tree.exterior'),
        levelId: null,
        select: this.walls(all),
        figures: {},
      },
      open: true,
      children: facades.map((f) => this.facadeBranch(f)),
    };
    return [...levels, exterior];
  });

  protected readonly nodes = computed<TreeNode[]>(() => {
    const open = this.open();
    const node = (b: Branch): TreeNode => ({
      key: b.row.key,
      data: b.row,
      expanded: open.get(b.row.key) ?? b.open ?? false,
      children: b.children.map(node),
      leaf: !b.children.length,
    });
    return this.rows().map(node);
  });

  /** A Façade: its totals per Level, then its parts (when it isn't flat) or its faces. */
  private facadeBranch(f: QuantityFacade): Branch {
    const name = this.t('quantities.facades.' + f.side);
    const key = `exterior/${f.side}`;
    const perLevel = (
      levels: readonly QuantityFacadeLevel[],
      at: string,
      faces: readonly QuantityFacadeFace[],
    ) =>
      levels.length > 1
        ? levels.map((l) => {
            const here = faces.filter((x) => x.level === l.level);
            return leaf({
              key: `${at}/${l.level}`,
              kind: 'facadeLevel',
              name: l.name,
              level: l.name,
              room: name,
              levelId: l.level,
              select: this.walls(here),
              facade: this.facadeOf(f.side, here),
              figures: { gross: l.gross, openings: l.openings, net: l.net },
            });
          })
        : [];
    const faceRows = (faces: readonly QuantityFacadeFace[], at: string) =>
      faces.map((x) => leaf(this.facadeFaceRow(x, at, name)));
    const parts =
      f.parts.length > 1
        ? f.parts.map((p): Branch => ({
            row: {
              key: `${key}/${p.number}`,
              kind: 'facadePart',
              name: this.t('quantities.tree.part', { n: p.number }),
              level: '',
              room: name,
              levelId: null,
              select: this.walls(p.faces),
              facade: this.facadeOf(f.side, p.faces),
              figures: { gross: p.gross, openings: p.openings, net: p.net },
            },
            children: [
              ...perLevel(p.levels, `${key}/${p.number}`, p.faces),
              ...faceRows(p.faces, `${key}/${p.number}`),
            ],
          }))
        : faceRows(f.parts[0]?.faces ?? [], key);
    const faces = f.parts.flatMap((p) => p.faces);
    return {
      row: {
        key,
        kind: 'facade',
        name,
        level: '',
        room: name,
        levelId: null,
        select: this.walls(faces),
        facade: this.facadeOf(f.side, faces),
        figures: { gross: f.gross, openings: f.openings, net: f.net },
      },
      children: [...perLevel(f.levels, key, faces), ...parts],
    };
  }

  private facadeFaceRow(f: QuantityFacadeFace, at: string, facade: string): Row {
    const level = this.project.store.committedModel().levels[f.level]?.name ?? '';
    return {
      key: `${at}/${f.level}/${f.wall}/${f.face}`,
      kind: 'face',
      name: `${level} · ${this.faceName(f.wallNumber, f.face)}`,
      level,
      room: facade,
      levelId: f.level,
      select: [{ kind: 'wall', id: f.wall }],
      figures: {
        length: f.length,
        height: f.height,
        gross: f.gross,
        openings: f.openings,
        net: f.net,
      },
    };
  }

  private facadeOf(side: FacadeSide, faces: readonly QuantityFacadeFace[]): FacadePick {
    return { side, faces: new Set(faces.map((f) => wallFaceKey(f.level, f.wall, f.face))) };
  }

  /** Each Wall of these faces once. */
  private walls(faces: readonly QuantityFacadeFace[]): Selection[] {
    return [...new Set(faces.map((f) => f.wall))].map((id) => ({ kind: 'wall', id }));
  }

  private faceName(n: number, face: WallFaceName): string {
    return this.t('quantities.tree.face', { n, face: this.t('quantities.tree.' + face) });
  }

  private levelRow(level: QuantityLevel): Row {
    return {
      key: level.level,
      kind: 'level',
      name: level.name,
      level: level.name,
      room: '',
      levelId: level.level,
      select: [],
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
      select: [{ kind: 'room', id: room.room }],
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
      select: [{ kind: 'room', id: room.room }],
      figures: { net: area },
    };
  }

  private faceRow(level: QuantityLevel, room: QuantityRoom, f: QuantityFace): Row {
    return {
      key: `${room.room}/${f.wall}/${f.face}`,
      kind: 'face',
      name: this.faceName(f.wallNumber, f.face),
      level: level.name,
      room: room.name,
      levelId: level.level,
      select: [{ kind: 'wall', id: f.wall }],
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
    if (v === null) return '';
    return key === 'length' || key === 'height' ? this.format.metres(v) : this.format.decimal(v);
  }

  protected setOpen(node: TreeNode | undefined, open: boolean): void {
    const key = node?.key;
    if (!key) return;
    this.open.set(new Map(this.open()).set(key, open));
  }

  protected choose(node: TreeNode | undefined): void {
    const row = node?.data as Row | undefined;
    if (!row?.select.length) return;
    if (row.levelId && row.levelId !== this.project.level()) this.project.selectLevel(row.levelId);
    if (row.facade) this.selection.selectFacade(row.facade, row.select);
    else this.selection.current.set(row.select);
  }

  /** The CSV: the same tree, one line per row, with its Level, Room and surface named. */
  protected exportCsv(): void {
    const t = (key: string) => this.language.text(key);
    const header = [
      t('quantities.tree.level'),
      t('quantities.tree.roomOrFacade'),
      t('quantities.tree.surface'),
      ...COLUMNS.map((c) => `${t('quantities.tree.' + c.key)} (${c.unit})`),
    ];
    const dutch = this.language.current() === 'nl';
    // Lengths to the mm (3 decimals); areas and volumes keep the CSV's 2 decimals.
    const metres = (v: number) => (dutch ? v.toFixed(3).replace('.', ',') : v.toFixed(3));
    const line = (row: Row, surface: string) => [
      row.level,
      row.room,
      surface,
      ...COLUMNS.map((c) => {
        const v = this.value(row, c.key);
        return v !== null && (c.key === 'length' || c.key === 'height') ? metres(v) : v;
      }),
    ];
    // Levels, Rooms and Façades name themselves in their own columns; the rest are surfaces.
    const named = new Set<Row['kind']>(['level', 'room', 'exterior', 'facade', 'facadeLevel']);
    const flat = (b: Branch): (string | number | null)[][] => [
      line(b.row, named.has(b.row.kind) ? '' : b.row.name),
      ...b.children.flatMap(flat),
    ];
    const lines = this.rows().flatMap(flat);
    const csv = toCsv(header, lines, { separator: dutch ? ';' : ',', decimalComma: dutch });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.project.name()} - ${t('quantities.fileName')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
