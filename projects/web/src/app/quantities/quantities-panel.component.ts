import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@openng/optimus-ui/button';
import { SelectModule } from '@openng/optimus-ui/select';
import { IconComponent } from '../shell/icon.component';
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

/**
 * The Quantities table (Slice 1 spec) in the bottom panel (ticket 09): every Room and Level under
 * the chosen Measurement rule, with CSV export in the UI language. Ticket 12 makes it a tree.
 */
@Component({
  selector: 'lk-quantities-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, ButtonModule, SelectModule, IconComponent],
  template: `
    <div class="head">
      <div class="rule">
        <label for="quantities-rule">{{ 'quantities.rule' | translate }}</label>
        <p-select
          inputId="quantities-rule"
          size="small"
          appendTo="body"
          [options]="ruleOptions()"
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
    .scroll {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 0 12px 8px;
    }
    table {
      border-collapse: collapse;
    }
    th,
    td {
      padding: 4px 10px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      white-space: nowrap;
    }
    th {
      position: sticky;
      top: 0;
      background: var(--panel);
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
      background: var(--inset);
    }
  `,
})
export class QuantitiesPanelComponent {
  protected readonly measurement = inject(MeasurementService);
  private readonly project = inject(ProjectService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  protected readonly ruleOptions = computed(() => {
    this.language.loaded();
    return (Object.keys(MEASUREMENT_RULES) as MeasurementRule[]).map((value) => ({
      value,
      label: this.translate.instant('quantities.rules.' + value),
    }));
  });
  protected readonly columns = COLUMNS;
  protected readonly rows = computed(() =>
    quantityRows(this.project.store.model(), this.project.store.values, this.measurement.rule()),
  );

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
