import { Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  MEASUREMENT_RULES,
  quantityRows,
  toCsv,
  type MeasurementRule,
  type QuantityRow,
} from '@lakudemis/core';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { ProjectService } from '../project/project.service';
import { MeasurementService } from './measurement.service';

type Column = keyof Pick<
  QuantityRow,
  | 'grossFloorArea'
  | 'netFloorArea'
  | 'volume'
  | 'floorFinishArea'
  | 'ceilingArea'
  | 'netWallArea'
  | 'revealArea'
>;

const COLUMNS: readonly { readonly key: Column; readonly unit: 'm²' | 'm³' }[] = [
  { key: 'grossFloorArea', unit: 'm²' },
  { key: 'netFloorArea', unit: 'm²' },
  { key: 'volume', unit: 'm³' },
  { key: 'floorFinishArea', unit: 'm²' },
  { key: 'ceilingArea', unit: 'm²' },
  { key: 'netWallArea', unit: 'm²' },
  { key: 'revealArea', unit: 'm²' },
];

/** The Quantities table (Slice 1 spec): every Room and Level, with CSV export in the UI language. */
@Component({
  selector: 'lk-quantities-dialog',
  imports: [TranslatePipe],
  template: `
    <dialog #dialog>
      <header>
        <h2>{{ 'quantities.title' | translate }}</h2>
        <label>
          {{ 'quantities.rule' | translate }}
          <select
            [value]="measurement.rule()"
            (change)="measurement.rule.set($any($event.target).value)"
          >
            @for (r of rules; track r) {
              <option [value]="r">{{ 'quantities.rules.' + r | translate }}</option>
            }
          </select>
        </label>
      </header>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>{{ 'quantities.name' | translate }}</th>
              @for (c of columns; track c.key) {
                <th class="num">{{ 'quantities.columns.' + c.key | translate }} ({{ c.unit }})</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.room ?? row.level) {
              <tr [class.level]="row.kind === 'level'">
                <td>
                  {{
                    row.kind === 'level'
                      ? ('quantities.levelTotal' | translate: { level: row.name })
                      : row.name
                  }}
                </td>
                @for (c of columns; track c.key) {
                  <td class="num">{{ cell(row, c.key) }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="buttons">
        <button type="button" (click)="exportCsv()">{{ 'quantities.export' | translate }}</button>
        <button type="button" class="primary" (click)="dialog.close()">
          {{ 'common.close' | translate }}
        </button>
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 16px 18px;
      max-width: min(1100px, calc(100vw - 32px));
    }
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.25);
    }
    header {
      display: flex;
      align-items: baseline;
      gap: 16px;
      justify-content: space-between;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    h2 {
      font-size: 17px;
      margin: 0;
    }
    label {
      font-size: 13px;
      color: var(--muted);
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .scroll {
      max-height: 60vh;
      overflow: auto;
    }
    table {
      border-collapse: collapse;
      font-size: 13px;
    }
    th,
    td {
      padding: 4px 10px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      white-space: nowrap;
    }
    th {
      font-weight: 600;
      color: var(--muted);
      font-size: 12px;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    tr.level td {
      font-weight: 600;
      background: #f4f6f9;
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
    }
    button,
    select {
      font-size: 13px;
      padding: 4px 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
  `,
})
export class QuantitiesDialogComponent {
  protected readonly measurement = inject(MeasurementService);
  private readonly project = inject(ProjectService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly rules = Object.keys(MEASUREMENT_RULES) as MeasurementRule[];
  protected readonly columns = COLUMNS;
  protected readonly rows = computed(() =>
    quantityRows(this.project.store.model(), this.project.store.values, this.measurement.rule()),
  );

  open(): void {
    this.dialog().nativeElement.showModal();
  }

  protected cell(row: QuantityRow, key: Column): string {
    const value = row[key];
    return value === null ? '—' : this.format.decimal(value / (key === 'volume' ? 1e9 : 1e6));
  }

  protected exportCsv(): void {
    const t = (key: string, params?: Record<string, string>) => this.translate.instant(key, params);
    const header = [
      t('quantities.name'),
      ...COLUMNS.map((c) => `${t('quantities.columns.' + c.key)} (${c.unit})`),
    ];
    const rows = this.rows().map((row) => [
      row.kind === 'level' ? t('quantities.levelTotal', { level: row.name }) : row.name,
      ...COLUMNS.map((c) => {
        const value = row[c.key];
        return value === null ? null : value / (c.key === 'volume' ? 1e9 : 1e6);
      }),
    ]);
    const dutch = this.language.current() === 'nl';
    const csv = toCsv(header, rows, { separator: dutch ? ';' : ',', decimalComma: dutch });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.project.name()} - ${t('quantities.fileName')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
