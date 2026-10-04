import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  deleteLevel,
  familyTypes,
  hasSill,
  netWallArea,
  openingsOfType,
  presetSize,
  setOpeningType,
  updateOpeningType,
  resizeRoom,
  setPresets,
  setWallThickness,
  updateLevel,
  updateOpening,
  updateRoom,
  updateSlab,
  updateWall,
  wallLength,
  wallThickness,
  type Command,
  type OpeningId,
  type OpeningTypeId,
  type Presets,
} from '@urdama/core';
import { parseLength } from '@urdama/editor2d';
import { ButtonModule } from '@openng/optimus-ui/button';
import { SelectModule } from '@openng/optimus-ui/select';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { MeasurementService } from '../quantities/measurement.service';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { IconComponent } from '../shell/icon.component';
import { OPENING_ICONS } from '../shell/opening-icons';
import { EditorActionsService } from './editor-actions.service';
import { FamilyEditService } from './family-edit.service';
import { FamilyPropertiesComponent } from './family-properties.component';
import { LengthEditorComponent } from './length-editor.component';
import { OpeningTypesDialogComponent } from './opening-types-dialog.component';
import { PropRowComponent, type PropChoice } from './prop-row.component';
import { SelectionService } from './selection.service';

const PRESET_FIELDS: readonly (keyof Presets)[] = [
  'wallThickness',
  'slabThickness',
  'floorBuildUp',
  'roomHeight',
  'ceilingThickness',
  'doorWidth',
  'doorHeight',
  'windowWidth',
  'windowHeight',
  'windowSill',
];

interface Figure {
  readonly value: string;
  readonly label: string;
  /** More detail, shown as a tooltip */
  readonly hint?: string;
}

/**
 * The properties panel (ticket 24, design C): what is selected, a summary of its key figures,
 * then its properties as text; a click edits one in place, and each committed edit is one
 * command and one undo step. Values that follow a Preset are grey; own values have a reset
 * button. With nothing selected it shows the Level, the Presets and the Measurement rule.
 */
@Component({
  selector: 'lk-properties-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    SelectModule,
    IconComponent,
    LengthEditorComponent,
    OpeningTypesDialogComponent,
    PropRowComponent,
    FamilyPropertiesComponent,
  ],
  template: `
    @if (familyEdit.editing()) {
      <lk-family-properties />
    } @else if (selection.room(); as room) {
      <header>
        <span class="badge"><lk-icon name="square" /></span>
        <div>
          <h2>{{ room.name }}</h2>
          <span class="kind">{{ 'panel.room.title' | translate }} · {{ levelName() }}</span>
        </div>
      </header>
      <div class="summary">
        @for (f of roomSummary(); track f.label) {
          <div class="tile">
            <b>{{ f.value }}</b
            ><span>{{ f.label | translate }}</span>
          </div>
        }
      </div>
      <section>
        <h3>{{ 'panel.room.title' | translate }}</h3>
        <lk-prop
          [label]="'panel.room.name' | translate"
          [value]="room.name"
          (commit)="run(updateRoom, { room: room.id, name: $event })"
        />
        <lk-prop
          [label]="'panel.room.floorFinish' | translate"
          [value]="room.floorFinish ?? ''"
          [hint]="'panel.room.floorFinishPlaceholder' | translate"
          (commit)="run(updateRoom, { room: room.id, floorFinish: $event.trim() || null })"
        />
      </section>
      @if (roomSize(); as size) {
        <section>
          <h3>{{ 'panel.room.insideSize' | translate }}</h3>
          <lk-prop
            [label]="'panel.room.width' | translate"
            [value]="metres(size.width)"
            unit="m"
            (commit)="resize('x', $event)"
          />
          <lk-prop
            [label]="'panel.room.depth' | translate"
            [value]="metres(size.depth)"
            unit="m"
            (commit)="resize('y', $event)"
          />
          <lk-prop
            [label]="'panel.room.moves' | translate"
            [value]="sidesText()"
            [choices]="sideChoices()"
            [choice]="widthSide() + depthSide()"
            (commit)="setSides($event)"
          />
        </section>
      }
      <section>
        <h3>{{ 'panel.heights' | translate }}</h3>
        <lk-prop
          [label]="'panel.room.height' | translate"
          [value]="mm(room.height ?? presets().roomHeight)"
          unit="mm"
          [preset]="room.height === undefined"
          [resetLabel]="room.height === undefined ? null : resetText(presets().roomHeight)"
          (commit)="commitMm($event, updateRoom, { room: room.id }, 'height')"
          (restore)="run(updateRoom, { room: room.id, height: null })"
        />
        <lk-prop
          [label]="'panel.room.floorBuildUp' | translate"
          [value]="mm(room.floorBuildUp ?? presets().floorBuildUp)"
          unit="mm"
          [preset]="room.floorBuildUp === undefined"
          [resetLabel]="room.floorBuildUp === undefined ? null : resetText(presets().floorBuildUp)"
          (commit)="commitMm($event, updateRoom, { room: room.id }, 'floorBuildUp')"
          (restore)="run(updateRoom, { room: room.id, floorBuildUp: null })"
        />
        @if (roomLevels(); as v) {
          <lk-prop
            [label]="'panel.room.floorLevel' | translate"
            [value]="v.floor"
            [editable]="false"
          />
          <lk-prop
            [label]="'panel.room.ceilingLevel' | translate"
            [value]="v.ceiling"
            [editable]="false"
          />
          <lk-prop
            [label]="'panel.room.ceilingVoid' | translate"
            [value]="v.void ?? ('panel.room.voidUnknown' | translate)"
            [editable]="false"
            [class.bad]="v.clash"
          />
        }
      </section>
      <section>
        <h3>{{ 'panel.surfaces' | translate }}</h3>
        @for (f of roomFigures(); track f.label) {
          <lk-prop [label]="f.label | translate" [value]="f.value" [editable]="false" />
        }
      </section>
    } @else if (selection.opening(); as opening) {
      <header>
        <span class="badge">
          <lk-icon [name]="openingIcons[opening.kind]" />
        </span>
        <div>
          <h2>{{ 'panel.opening.' + opening.kind | translate }} {{ typeName() }}</h2>
          <span class="kind">{{ 'panel.opening.type' | translate }} · {{ levelName() }}</span>
        </div>
      </header>
      <div class="summary">
        @for (f of openingSummary(); track f.label) {
          <div class="tile">
            <b>{{ f.value }}</b
            ><span>{{ f.label | translate }}</span>
          </div>
        }
      </div>
      <section>
        <h3>{{ 'panel.placement' | translate }}</h3>
        <lk-prop
          [label]="'panel.opening.offset' | translate"
          [value]="mm(opening.offset)"
          unit="mm"
          (commit)="commitMm($event, updateOpening, { opening: opening.id }, 'offset')"
        />
        @if (hasSill(opening.kind)) {
          <lk-prop
            [label]="'panel.opening.sill' | translate"
            [value]="mm(opening.sill)"
            unit="mm"
            [preset]="opening.sill === openingPreset().sill"
            [resetLabel]="
              opening.sill === openingPreset().sill ? null : resetText(openingPreset().sill)
            "
            (restore)="run(updateOpening, { opening: opening.id, sill: openingPreset().sill })"
            (commit)="commitMm($event, updateOpening, { opening: opening.id }, 'sill')"
          />
        } @else if (opening.kind === 'door') {
          <div class="actions">
            <p-button
              size="small"
              severity="secondary"
              [label]="('panel.opening.flipHinge' | translate) + ' (F)'"
              (onClick)="run(updateOpening, { opening: opening.id, flipHinge: true })"
            />
            <p-button
              size="small"
              severity="secondary"
              [label]="('panel.opening.flipSwing' | translate) + ' (Shift+F)'"
              (onClick)="run(updateOpening, { opening: opening.id, flipSwing: true })"
            />
          </div>
        }
      </section>
      <section>
        <h3>{{ 'panel.opening.typeSection' | translate }}</h3>
        <div class="type-row">
          <p-select
            size="small"
            [options]="typeChoices()"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            [ngModel]="opening.type"
            (ngModelChange)="run(setOpeningType, { opening: opening.id, type: $event })"
            [ariaLabel]="'panel.opening.typeSection' | translate"
          />
          <p-button
            size="small"
            severity="secondary"
            [text]="true"
            [label]="'panel.opening.manageTypes' | translate"
            (onClick)="openTypes(opening.type)"
          />
        </div>
        <div class="actions">
          <p-button
            size="small"
            severity="secondary"
            [outlined]="true"
            [label]="'family.edit' | translate"
            (onClick)="editFamily(opening.type)"
          />
        </div>
        <lk-prop
          [label]="'panel.opening.width' | translate"
          [value]="mm(opening.width)"
          unit="mm"
          [preset]="opening.width === openingPreset().width"
          [resetLabel]="
            opening.width === openingPreset().width ? null : resetText(openingPreset().width)
          "
          (restore)="resizeOpening(opening.id, 'width', openingPreset().width)"
          (commit)="resizeOpeningText(opening.id, 'width', $event)"
        />
        <lk-prop
          [label]="'panel.opening.height' | translate"
          [value]="mm(opening.height)"
          unit="mm"
          [preset]="opening.height === openingPreset().height"
          [resetLabel]="
            opening.height === openingPreset().height ? null : resetText(openingPreset().height)
          "
          (restore)="resizeOpening(opening.id, 'height', openingPreset().height)"
          (commit)="resizeOpeningText(opening.id, 'height', $event)"
        />
        @if (pendingSize(); as p) {
          <div class="ask" role="group">
            <p>
              {{
                'panel.opening.scopeQuestion' | translate: { count: p.count, value: mm(p.value) }
              }}
            </p>
            <div class="actions">
              <p-button
                size="small"
                [label]="'panel.opening.scopeAll' | translate: { count: p.count }"
                (onClick)="applySize('type')"
              />
              <p-button
                size="small"
                severity="secondary"
                [label]="'panel.opening.scopeOne' | translate"
                (onClick)="applySize('opening')"
              />
              <p-button
                size="small"
                severity="secondary"
                [text]="true"
                [label]="'common.cancel' | translate"
                (onClick)="pendingSize.set(null)"
              />
            </div>
          </div>
        }
      </section>
      <lk-opening-types-dialog />
    } @else if (selection.wall(); as wall) {
      <header>
        <span class="badge"><lk-icon name="brick-wall" /></span>
        <div>
          <h2>{{ 'panel.wall.title' | translate }}</h2>
          <span class="kind"
            >{{ 'editor.wall.side.' + wall.side | translate }} · {{ levelName() }}</span
          >
        </div>
      </header>
      @if (wallSummary(); as figures) {
        <div class="summary">
          @for (f of figures; track f.label) {
            <div class="tile">
              <b>{{ f.value }}</b
              ><span>{{ f.label | translate }}</span>
            </div>
          }
        </div>
      }
      <section>
        <h3>{{ 'panel.sizes' | translate }}</h3>
        @if (editingLength()) {
          <lk-length-editor [wall]="wall" (closed)="editingLength.set(false)" />
        } @else {
          <lk-prop
            [label]="'panel.wall.length' | translate"
            [value]="metres(wallLength(wall))"
            unit="m"
            [hint]="'panel.wall.lengthHint' | translate"
            [opens]="true"
            (open)="editingLength.set(true)"
          />
        }
        <lk-prop
          [label]="'panel.wall.thickness' | translate"
          [value]="mm(thickness(wall))"
          unit="mm"
          [preset]="wall.thickness === undefined"
          [resetLabel]="wall.thickness === undefined ? null : resetText(presets().wallThickness)"
          (commit)="commitMm($event, setWallThickness, { wall: wall.id }, 'thickness')"
          (restore)="run(setWallThickness, { wall: wall.id, thickness: null })"
        />
        <lk-prop
          [label]="'panel.wall.height' | translate"
          [value]="mm(wall.height ?? storeyHeight(wall.level))"
          unit="mm"
          [preset]="wall.height === undefined"
          [resetLabel]="wall.height === undefined ? null : ('panel.followsStoreyAgain' | translate)"
          (commit)="commitMm($event, updateWall, { wall: wall.id }, 'height')"
          (restore)="run(updateWall, { wall: wall.id, height: null })"
        />
        <lk-prop
          [label]="'panel.wall.roomBounding' | translate"
          [value]="(wall.roomBounding ? 'common.yes' : 'common.no') | translate"
          [choices]="yesNo()"
          [choice]="wall.roomBounding ? 'yes' : 'no'"
          (commit)="run(updateWall, { wall: wall.id, roomBounding: $event === 'yes' })"
        />
      </section>
      @if (wallFaces(); as faces) {
        <section>
          <h3>{{ 'panel.wall.faces' | translate }}</h3>
          @for (f of faces; track f.label) {
            <lk-prop
              [label]="f.label | translate"
              [value]="f.value"
              [hint]="f.hint ?? ''"
              [editable]="false"
            />
          }
        </section>
      }
    } @else if (selection.rooms().length === 2) {
      <header>
        <span class="badge"><lk-icon name="merge" /></span>
        <div>
          <h2>{{ 'panel.twoRooms' | translate }}</h2>
          <span class="kind"
            >{{ selection.rooms()[0]!.name }} + {{ selection.rooms()[1]!.name }}</span
          >
        </div>
      </header>
      <div class="actions">
        <p-button
          size="small"
          [label]="('panel.merge' | translate) + ' (M)'"
          (onClick)="actions.merge()"
        />
      </div>
    } @else {
      <header>
        <span class="badge"><lk-icon name="layers" /></span>
        <div>
          <h2>{{ project.name() }}</h2>
          <span class="kind">{{ 'panel.nothingSelected' | translate }}</span>
        </div>
      </header>
      @if (level(); as l) {
        <div class="summary">
          <div class="tile">
            <b>{{ l.gross }}</b
            ><span>{{ 'panel.level.grossShort' | translate }}</span>
          </div>
          <div class="tile">
            <b>{{ l.net }}</b
            ><span>{{ 'panel.level.netShort' | translate }}</span>
          </div>
          <div class="tile">
            <b>{{ l.count }}</b
            ><span>{{ 'panel.level.countShort' | translate }}</span>
          </div>
        </div>
        <section>
          <h3>{{ 'panel.level.title' | translate }} · {{ l.level.name }}</h3>
          <lk-prop
            [label]="'panel.level.name' | translate"
            [value]="l.level.name"
            (commit)="run(updateLevel, { level: l.level.id, name: $event })"
          />
          <lk-prop
            [label]="'panel.level.elevation' | translate"
            [value]="mm(l.heights.elevation)"
            unit="mm"
            [editable]="l.lowest"
            [hint]="
              (l.lowest ? 'panel.level.elevationLowest' : 'panel.level.elevationDerived')
                | translate
            "
            (commit)="commitMm($event, updateLevel, { level: l.level.id }, 'elevation')"
          />
          <lk-prop
            [label]="'panel.level.storeyHeight' | translate"
            [value]="mm(l.level.storeyHeight)"
            unit="mm"
            [hint]="'panel.level.storeyHint' | translate"
            (commit)="commitMm($event, updateLevel, { level: l.level.id }, 'storeyHeight')"
          />
          <lk-prop
            [label]="'panel.level.slabThickness' | translate"
            [value]="mm(l.heights.slabThickness)"
            unit="mm"
            [preset]="!l.slabOwn"
            [resetLabel]="l.slabOwn ? resetText(presets().slabThickness) : null"
            (commit)="commitMm($event, updateSlab, { level: l.level.id }, 'thickness')"
            (restore)="run(updateSlab, { level: l.level.id, thickness: null })"
          />
          @if (l.count > 1) {
            <div class="actions">
              <p-button
                size="small"
                severity="danger"
                [text]="true"
                [label]="'panel.level.delete' | translate"
                (onClick)="removeLevel()"
              />
            </div>
          }
        </section>
      }
      <section>
        <h3>{{ 'presets.title' | translate }}</h3>
        <p class="note">{{ 'presets.hint' | translate }}</p>
        @for (f of presetFields; track f) {
          <lk-prop
            [label]="'presets.' + f | translate"
            [value]="mm(presets()[f])"
            unit="mm"
            (commit)="commitMm($event, setPresets, {}, f)"
          />
        }
      </section>
      <section>
        <h3>{{ 'quantities.rule' | translate }}</h3>
        <lk-prop
          [label]="'quantities.rule' | translate"
          [value]="'quantities.rules.' + measurement.rule() | translate"
          [choices]="measurement.options()"
          [choice]="measurement.rule()"
          (commit)="measurement.rule.set($any($event))"
        />
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      padding-bottom: 12px;
      font-size: 13px;
    }
    header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 14px 10px;
    }
    header > div {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .badge {
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--accent-soft);
      color: var(--accent);
    }
    h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kind {
      font-size: 12px;
      color: var(--muted);
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      padding: 0 14px 12px;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px;
      border-radius: 8px;
      background: var(--inset);
    }
    .tile b {
      font-family: var(--mono);
      font-size: 13px;
      font-weight: 500;
    }
    .tile span {
      font-size: 11px;
      color: var(--muted);
    }
    section {
      padding: 4px 0 8px;
      border-top: 1px solid var(--line);
    }
    h3 {
      margin: 8px 14px 4px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .note {
      margin: 0 14px 6px;
      font-size: 11px;
      line-height: 1.45;
      color: var(--muted);
    }
    .type-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px 6px 14px;
    }
    .type-row p-select {
      flex: 1;
      min-width: 0;
    }
    .ask {
      margin: 6px 8px 4px;
      border: 1px solid var(--accent);
      border-radius: 8px;
      background: var(--inset);
    }
    .ask p {
      margin: 8px 12px 2px;
      font-size: 12.5px;
    }
    .ask .actions {
      padding: 6px 10px 8px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 4px 14px;
    }
    lk-prop.bad {
      color: var(--bad);
    }
  `,
})
export class PropertiesPanelComponent {
  protected readonly selection = inject(SelectionService);
  protected readonly project = inject(ProjectService);
  protected readonly measurement = inject(MeasurementService);
  protected readonly actions = inject(EditorActionsService);
  protected readonly familyEdit = inject(FamilyEditService);
  private readonly format = inject(FormatService);
  private readonly messages = inject(MessagesService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  protected readonly updateRoom = updateRoom;
  protected readonly hasSill = hasSill;
  protected readonly updateWall = updateWall;
  protected readonly updateOpening = updateOpening;
  protected readonly setOpeningType = setOpeningType;
  protected readonly typesDialog = viewChild.required(OpeningTypesDialogComponent);
  /** A type size typed while other Openings share the type: waits for "all" or "only this one" */
  protected readonly pendingSize = signal<{
    readonly opening: OpeningId;
    readonly field: 'width' | 'height';
    readonly value: number;
    readonly count: number;
  } | null>(null);
  protected readonly updateLevel = updateLevel;
  protected readonly updateSlab = updateSlab;
  protected readonly setWallThickness = setWallThickness;
  protected readonly setPresets = setPresets;
  protected readonly wallLength = wallLength;
  protected readonly presetFields = PRESET_FIELDS;
  protected readonly openingIcons = OPENING_ICONS;

  protected readonly presets = computed(() => this.project.store.model().project.presets);
  protected readonly editingLength = signal(false);
  protected readonly widthSide = signal<'min' | 'max'>('max');
  protected readonly depthSide = signal<'min' | 'max'>('max');

  constructor() {
    // Another selection closes the length editor and drops an unanswered size question.
    effect(() => {
      this.selection.current();
      untracked(() => {
        this.editingLength.set(false);
        this.pendingSize.set(null);
      });
    });
  }

  protected readonly levelName = this.project.levelName;

  /** Choices built in code, read again when a language's texts have loaded. */
  private readonly t = (key: string, params?: object): string => this.language.text(key, params);
  protected readonly yesNo = computed<PropChoice[]>(() => [
    { value: 'yes', label: this.t('common.yes') },
    { value: 'no', label: this.t('common.no') },
  ]);
  protected readonly sideChoices = computed<PropChoice[]>(() =>
    (['maxmax', 'minmax', 'maxmin', 'minmin'] as const).map((v) => ({
      value: v,
      label: this.sideLabel(v.slice(0, 3) as 'min' | 'max', v.slice(3) as 'min' | 'max'),
    })),
  );
  protected readonly sidesText = computed(() => this.sideLabel(this.widthSide(), this.depthSide()));

  private sideLabel(width: 'min' | 'max', depth: 'min' | 'max'): string {
    return `${this.t(width === 'max' ? 'panel.room.right' : 'panel.room.left')} · ${this.t(
      depth === 'max' ? 'panel.room.bottom' : 'panel.room.top',
    )}`;
  }

  /** Up to one decimal, no thousands separator, in the user's language: "2600", "884,6". */
  private readonly plain = computed(
    () =>
      new Intl.NumberFormat(this.language.current() === 'nl' ? 'nl-BE' : 'en-GB', {
        maximumFractionDigits: 1,
        useGrouping: false,
      }),
  );

  /** mm as the user types it back. */
  protected mm(value: number): string {
    return this.plain().format(value);
  }

  /** m with 2 decimals in the user's language, as typed back ("2,67"). */
  protected metres(value: number): string {
    return this.format.decimal(value / 1000);
  }

  protected resetText(preset: number): string {
    return this.t('panel.resetTo', { value: `${this.mm(preset)} mm` });
  }

  protected thickness(wall: Parameters<typeof wallThickness>[0]): number {
    return wallThickness(wall, this.presets().wallThickness);
  }

  protected storeyHeight(level: string): number {
    return this.project.store.model().levels[level]?.storeyHeight ?? 0;
  }

  protected readonly typeName = computed(() => {
    const o = this.selection.opening();
    const type = o && this.project.store.model().openingTypes[o.type];
    if (!type) return '';
    // An unnamed type is shown by its sizes in cm, like "93 × 211,5".
    return (
      type.name ??
      `${this.plain().format(type.width / 10)} × ${this.plain().format(type.height / 10)}`
    );
  });

  /** The types of the selected Opening's family, by size, named or shown by their sizes. */
  protected readonly typeChoices = computed<PropChoice[]>(() => {
    const o = this.selection.opening();
    const model = this.project.store.model();
    const family = o && model.openingTypes[o.type]?.family;
    return familyTypes(model, family ?? undefined).map((t) => ({
      value: t.id,
      label: t.name
        ? `${t.name} · ${this.format.openingSize(t.width, t.height)}`
        : this.format.openingSize(t.width, t.height),
    }));
  });

  protected openTypes(type: OpeningTypeId): void {
    const family = this.project.store.model().openingTypes[type]?.family;
    if (family) this.typesDialog().open(family);
  }

  /** The Opening family editor (ticket 20), shown at this type's size. */
  protected editFamily(type: OpeningTypeId): void {
    const family = this.project.store.model().openingTypes[type]?.family;
    if (family) this.familyEdit.enter(family, type);
  }

  protected resizeOpeningText(opening: OpeningId, field: 'width' | 'height', text: string): void {
    const value = parseLength(text);
    if (value !== null) this.resizeOpening(opening, field, value);
  }

  /**
   * A new type size (ticket 18): with the type's only Opening the type itself changes; when other
   * Openings share it the panel asks first, all of this type or only this one.
   */
  protected resizeOpening(opening: OpeningId, field: 'width' | 'height', value: number): void {
    const model = this.project.store.model();
    const o = model.openings[opening];
    if (!o) return;
    const count = openingsOfType(model, o.type);
    if (count <= 1) this.run(updateOpeningType, { type: o.type, [field]: value });
    else this.pendingSize.set({ opening, field, value, count });
  }

  protected applySize(scope: 'type' | 'opening'): void {
    const p = this.pendingSize();
    const o = p && this.project.store.model().openings[p.opening];
    this.pendingSize.set(null);
    if (!p || !o) return;
    if (scope === 'type') this.run(updateOpeningType, { type: o.type, [p.field]: p.value });
    else this.run(updateOpening, { opening: p.opening, [p.field]: p.value });
  }

  /** The Presets for the selected Opening's kind: its sizes when it has its own. */
  protected readonly openingPreset = computed(() =>
    presetSize(this.presets(), this.selection.opening()?.kind ?? 'door'),
  );

  protected readonly openingSummary = computed<Figure[]>(() => {
    const o = this.selection.opening();
    if (!o) return [];
    const glass = this.project.store.values.opening(o.id).glassArea();
    return [
      { value: this.format.decimal(o.width / 1000), label: 'panel.summary.width' },
      { value: this.format.decimal(o.height / 1000), label: 'panel.summary.height' },
      {
        value: this.format.decimal((o.width * o.height) / 1e6),
        label: 'panel.summary.openingArea',
      },
      // From the family's parts (ticket 19): only Openings with glass show it.
      ...(glass > 0
        ? [{ value: this.format.decimal(glass / 1e6), label: 'panel.summary.glassArea' }]
        : []),
    ];
  });

  protected readonly roomSummary = computed<Figure[]>(() => {
    const room = this.selection.room();
    if (!room) return [];
    const v = this.project.store.values.room(room.id);
    const s = v.surfaces();
    const area = (mm2: number | null) => (mm2 === null ? '—' : this.format.decimal(mm2 / 1e6));
    const volume = v.volume();
    return [
      { value: area(v.netFloorArea()), label: 'panel.summary.floor' },
      {
        value: area(s ? netWallArea(s, this.measurement.rule()) : null),
        label: 'panel.summary.walls',
      },
      {
        value: volume === null ? '—' : this.format.decimal(volume / 1e9),
        label: 'panel.summary.volume',
      },
    ];
  });

  /** The Room's other figures, under the chosen Measurement rule. */
  protected readonly roomFigures = computed<Figure[]>(() => {
    const room = this.selection.room();
    if (!room) return [];
    const v = this.project.store.values.room(room.id);
    const s = v.surfaces();
    const area = (mm2: number | null) => (mm2 === null ? '—' : this.format.area(mm2));
    return [
      { value: area(v.floorFinishArea()), label: 'panel.room.floorFinishArea' },
      { value: area(v.ceilingArea()), label: 'panel.room.ceilingArea' },
      { value: area(s ? s.revealArea : null), label: 'panel.room.revealArea' },
    ];
  });

  protected readonly roomLevels = computed(() => {
    const room = this.selection.room();
    if (!room) return null;
    const v = this.project.store.values.room(room.id);
    const gap = v.ceilingVoid();
    return {
      floor: this.format.length(v.floorTop()),
      ceiling: this.format.length(v.ceilingUnderside()),
      void: gap === null ? null : this.format.millimetres(Math.round(gap)),
      clash: gap !== null && gap < -0.5,
    };
  });

  /** Inside width and depth of a rectangular Room (null for other shapes). */
  protected readonly roomSize = computed(() => {
    const room = this.selection.room();
    const d = room ? this.project.store.values.room(room.id).detection() : undefined;
    if (!d || d.status !== 'enclosed' || d.area.islands.length) return null;
    const xs = d.area.outline.map((p) => p.x);
    const ys = d.area.outline.map((p) => p.y);
    const [minX, maxX, minY, maxY] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ];
    const rectangular = d.area.outline.every(
      (p) =>
        (Math.abs(p.x - minX) < 0.5 || Math.abs(p.x - maxX) < 0.5) &&
        (Math.abs(p.y - minY) < 0.5 || Math.abs(p.y - maxY) < 0.5),
    );
    return rectangular ? { width: maxX - minX, depth: maxY - minY } : null;
  });

  protected readonly wallSummary = computed<Figure[] | null>(() => {
    const wall = this.selection.wall();
    const faces = wall ? this.project.store.values.wall(wall.id).faces() : undefined;
    if (!wall || !faces) return null;
    return [
      { value: this.format.decimal(wallLength(wall) / 1000), label: 'panel.summary.length' },
      { value: this.format.decimal(faces.drawn.net / 1e6), label: 'panel.summary.drawnFace' },
      { value: this.format.decimal(faces.other.net / 1e6), label: 'panel.summary.otherFace' },
    ];
  });

  /** Both faces of the selected Wall: length, gross and net area (Openings subtracted). */
  protected readonly wallFaces = computed<Figure[] | null>(() => {
    const wall = this.selection.wall();
    const faces = wall ? this.project.store.values.wall(wall.id).faces() : undefined;
    if (!faces) return null;
    // Length and net area (Openings subtracted); the Quantities show the gross area too.
    const text = (f: typeof faces.drawn) =>
      `${this.format.length(f.length)} · ${this.format.area(f.net)}`;
    return [
      { value: text(faces.drawn), label: 'panel.wall.drawnFace' },
      { value: text(faces.other), label: 'panel.wall.otherFace' },
    ];
  });

  /** The edited Level: its place in the stack, Slab and floor areas. */
  protected readonly level = computed(() => {
    const id = this.project.level();
    const model = this.project.store.model();
    const level = model.levels[id];
    const heights = this.project.store.values.levelHeights().get(id);
    if (!level || !heights) return null;
    const levels = this.project.levels();
    const values = this.project.store.values.level(id);
    return {
      level,
      heights,
      lowest: levels[0]?.id === id,
      count: levels.length,
      slabOwn: Object.values(model.slabs).some((s) => s.level === id && s.thickness !== undefined),
      gross: this.format.decimal(values.grossArea() / 1e6),
      net: this.format.decimal(values.netFloorArea() / 1e6),
    };
  });

  protected setSides(value: string): void {
    this.widthSide.set(value.slice(0, 3) as 'min' | 'max');
    this.depthSide.set(value.slice(3) as 'min' | 'max');
  }

  protected resize(axis: 'x' | 'y', text: string): void {
    const room = this.selection.room();
    const size = parseLength(text);
    if (!room || size === null) return;
    const side = axis === 'x' ? this.widthSide() : this.depthSide();
    this.run(resizeRoom, { room: room.id, axis, size, side });
  }

  /**
   * A typed length (mm) as one field of a command's arguments; text that isn't a length is
   * ignored and the row shows the value again.
   */
  protected commitMm<A>(text: string, command: Command<A>, base: object, field: string): void {
    const value = parseLength(text);
    if (value !== null) this.run(command, { ...base, [field]: value } as A);
  }

  protected removeLevel(): void {
    const l = this.level();
    if (!l) return;
    const text = this.translate.instant('panel.level.confirmDelete', { name: l.level.name });
    if (!window.confirm(text)) return;
    this.run(deleteLevel, { level: l.level.id });
  }

  protected run<A>(command: Command<A>, args: A): void {
    const result = this.project.store.run(command, args);
    if (!result.ok) this.messages.refused(result.reason);
  }
}
