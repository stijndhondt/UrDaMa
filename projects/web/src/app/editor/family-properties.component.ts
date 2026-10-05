import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DESIGN_LIMITS, type OpeningDesign, type OpeningInfill } from '@urdama/core';
import { parseLength } from '@urdama/editor2d';
import { ButtonModule } from '@openng/optimus-ui/button';
import { LanguageService } from '../language';
import { IconComponent } from '../shell/icon.component';
import { OPENING_ICONS } from '../shell/opening-icons';
import { FamilyEditService } from './family-edit.service';
import { PanelSectionComponent } from './panel-section.component';
import { PropRowComponent, type PropChoice } from './prop-row.component';

/**
 * The properties panel while an Opening family is edited (ticket 20): its name, frame and infill.
 * Every change reaches all its types and placed Openings, as one undo step.
 */
@Component({
  selector: 'lk-family-properties',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ButtonModule, IconComponent, PanelSectionComponent, PropRowComponent],
  template: `
    @if (edit.family(); as family) {
      @if (edit.preview(); as preview) {
        <header>
          <span class="badge"><lk-icon [name]="icons[family.kind]" /></span>
          <div>
            <h2>{{ edit.name() }}</h2>
            <span class="kind"
              >{{ 'family.title' | translate }} ·
              {{ 'panel.opening.' + family.kind | translate }}</span
            >
          </div>
        </header>
        <lk-panel-section key="family.title" [heading]="'family.title' | translate">
          <lk-prop
            [label]="'family.name' | translate"
            [value]="family.name ?? ''"
            (commit)="edit.rename($event)"
          />
        </lk-panel-section>
        @if (preview.design.frame; as frame) {
          <lk-panel-section key="family.frame" [heading]="'family.frame' | translate">
            <lk-prop
              [label]="'family.frameWidth' | translate"
              [value]="'' + frame.width"
              unit="mm"
              [hint]="range(limits.frameWidth)"
              (commit)="setFrame(preview.design, 'width', $event)"
            />
            <lk-prop
              [label]="'family.frameDepth' | translate"
              [value]="'' + frame.depth"
              unit="mm"
              [hint]="range(limits.frameDepth)"
              (commit)="setFrame(preview.design, 'depth', $event)"
            />
            <lk-prop
              [label]="'family.bottomRail' | translate"
              [value]="(preview.design.bottomRail ? 'common.yes' : 'common.no') | translate"
              [choices]="yesNo()"
              [choice]="preview.design.bottomRail ? 'yes' : 'no'"
              (commit)="change({ ...preview.design, bottomRail: $event === 'yes' })"
            />
          </lk-panel-section>
        }
        @if (preview.design.infill; as infill) {
          @if (infill.kind !== 'none') {
            <lk-panel-section
              [key]="'family.infill.' + infill.kind"
              [heading]="'family.infill.' + infill.kind | translate"
            >
              @switch (infill.kind) {
                @case ('leaves') {
                  <lk-prop
                    [label]="'family.leafCount' | translate"
                    [value]="'' + infill.count"
                    [choices]="leafCounts"
                    [choice]="'' + infill.count"
                    (commit)="setInfill(preview.design, { count: $event === '2' ? 2 : 1 })"
                  />
                  <lk-prop
                    [label]="'family.operation' | translate"
                    [value]="'family.operations.' + (infill.operation ?? 'hinged') | translate"
                    [choices]="operations()"
                    [choice]="infill.operation ?? 'hinged'"
                    (commit)="setInfill(preview.design, { operation: $any($event) })"
                  />
                  <lk-prop
                    [label]="'family.glazed' | translate"
                    [value]="(infill.glazed ? 'common.yes' : 'common.no') | translate"
                    [choices]="yesNo()"
                    [choice]="infill.glazed ? 'yes' : 'no'"
                    (commit)="setInfill(preview.design, { glazed: $event === 'yes' })"
                  />
                }
                @case ('glazing') {
                  <lk-prop
                    [label]="'family.panes' | translate"
                    [value]="
                      infill.panes === 'auto' ? ('family.auto' | translate) : '' + infill.panes
                    "
                    [hint]="'family.panesHint' | translate"
                    (commit)="setPanes(preview.design, $event)"
                  />
                }
                @case ('panels') {
                  <lk-prop
                    [label]="'family.style' | translate"
                    [value]="'family.styles.' + (infill.style ?? 'sectional') | translate"
                    [choices]="styles()"
                    [choice]="infill.style ?? 'sectional'"
                    (commit)="setInfill(preview.design, { style: $any($event) })"
                  />
                  @if ((infill.style ?? 'sectional') === 'sectional') {
                    <lk-prop
                      [label]="'family.sections' | translate"
                      [value]="'' + infill.count"
                      [hint]="range(limits.panels)"
                      (commit)="setCount(preview.design, $event)"
                    />
                  }
                }
              }
              <lk-prop
                [label]="'family.thickness' | translate"
                [value]="'' + infill.thickness"
                unit="mm"
                [hint]="range(limits.thickness)"
                (commit)="setThickness(preview.design, $event)"
              />
            </lk-panel-section>
          }
        }
        <p class="note">{{ 'family.reach' | translate }}</p>
        <div class="actions">
          <p-button size="small" [label]="'family.done' | translate" (onClick)="edit.leave()" />
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    header {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 12px 14px 10px;
    }
    .badge {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: var(--inset);
      color: var(--accent);
    }
    h2 {
      margin: 0;
      font-size: 14px;
    }
    .kind {
      font-size: 11px;
      color: var(--muted);
    }
    .note {
      margin: 8px 14px 6px;
      font-size: 11px;
      line-height: 1.45;
      color: var(--muted);
    }
    .actions {
      padding: 4px 14px;
    }
  `,
})
export class FamilyPropertiesComponent {
  protected readonly edit = inject(FamilyEditService);
  private readonly language = inject(LanguageService);
  protected readonly icons = OPENING_ICONS;
  protected readonly limits = DESIGN_LIMITS;

  private readonly t = (key: string): string => this.language.text(key);
  protected readonly yesNo = computed<PropChoice[]>(() => [
    { value: 'yes', label: this.t('common.yes') },
    { value: 'no', label: this.t('common.no') },
  ]);
  protected readonly leafCounts: PropChoice[] = [
    { value: '1', label: '1' },
    { value: '2', label: '2' },
  ];
  protected readonly operations = computed<PropChoice[]>(() =>
    (['hinged', 'sliding'] as const).map((value) => ({
      value,
      label: this.t('family.operations.' + value),
    })),
  );
  protected readonly styles = computed<PropChoice[]>(() =>
    (['sectional', 'upAndOver', 'roller'] as const).map((value) => ({
      value,
      label: this.t('family.styles.' + value),
    })),
  );

  protected range([lo, hi]: readonly [number, number]): string {
    return `${lo}–${hi}`;
  }

  protected change(design: OpeningDesign): void {
    this.edit.change(design);
  }

  protected setFrame(design: OpeningDesign, field: 'width' | 'depth', text: string): void {
    const value = parseLength(text);
    if (value === null || !design.frame) return;
    this.change({ ...design, frame: { ...design.frame, [field]: value } });
  }

  protected setInfill(design: OpeningDesign, patch: Partial<OpeningInfill>): void {
    this.change({ ...design, infill: { ...design.infill, ...patch } as OpeningInfill });
  }

  protected setThickness(design: OpeningDesign, text: string): void {
    const value = parseLength(text);
    if (value !== null) this.setInfill(design, { thickness: value });
  }

  /** A number of panes, or empty for auto. */
  protected setPanes(design: OpeningDesign, text: string): void {
    const t = text.trim();
    if (!t) this.setInfill(design, { panes: 'auto' });
    else if (Number.isFinite(Number(t))) this.setInfill(design, { panes: Number(t) });
  }

  protected setCount(design: OpeningDesign, text: string): void {
    const value = Number(text.trim());
    if (Number.isFinite(value)) this.setInfill(design, { count: value });
  }
}
