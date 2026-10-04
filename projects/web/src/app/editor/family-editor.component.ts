import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { openingFamilySolids, openingShape } from '@urdama/core';
import { FAMILY_SIDES, FamilyView, type FamilySide } from '@urdama/editor2d';
import { ManifoldKernel, View3D } from '@urdama/render3d';
import { ButtonModule } from '@openng/optimus-ui/button';
import { SelectModule } from '@openng/optimus-ui/select';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { ThemeService } from '../shell/theme.service';
import { FamilyEditService } from './family-edit.service';
import { PlanColorsService } from './plan-colors.service';

/** One side's view of the family (ticket 20): its parts projected, with handles to drag. */
@Component({
  selector: 'lk-family-side',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas></canvas>`,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
    }
  `,
})
export class FamilySideComponent {
  readonly side = input.required<FamilySide>();

  private readonly edit = inject(FamilyEditService);
  private readonly format = inject(FormatService);
  private readonly planColors = inject(PlanColorsService);
  private readonly theme = inject(ThemeService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private view: FamilyView | null = null;

  constructor() {
    afterNextRender(() => {
      this.view = new FamilyView(this.canvas().nativeElement, this.side(), {
        colors: () => this.planColors.colors(),
        changed: (design, done) => this.edit.change(design, done),
        cancelled: () => this.edit.cancel(),
        millimetres: (mm) => this.format.millimetres(mm),
      });
      const preview = this.edit.preview();
      if (preview) this.view.set(preview);
    });
    effect(() => {
      const preview = this.edit.preview();
      untracked(() => preview && this.view?.set(preview));
    });
    effect(() => {
      const side = this.side();
      untracked(() => this.view?.setSide(side));
    });
    effect(() => {
      this.theme.dark();
      untracked(() => this.view?.redraw());
    });
    inject(DestroyRef).onDestroy(() => this.view?.destroy());
  }
}

/** The family in 3D (ticket 20), built from the same parts as the six views. */
@Component({
  selector: 'lk-family-3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #view class="view" role="img" [attr.aria-label]="label()"></div>`,
  styles: `
    :host,
    .view {
      display: block;
      height: 100%;
      overflow: hidden;
    }
  `,
})
export class Family3dComponent {
  readonly label = input('');

  private readonly edit = inject(FamilyEditService);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('view');
  private view: View3D | null = null;
  private kernel: ManifoldKernel | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      this.view = new View3D(this.container().nativeElement, () => undefined);
      this.kernel = new ManifoldKernel(
        new Worker(new URL('./manifold.worker', import.meta.url), { type: 'module' }),
      );
      this.schedule();
    });
    // Follows every change, a drag included: the 3D view always shows what the others do.
    effect(() => {
      this.edit.preview();
      untracked(() => this.schedule());
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
      this.kernel?.dispose();
      this.view?.dispose();
    });
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.build(), 40);
  }

  private async build(): Promise<void> {
    this.timer = null;
    const preview = this.edit.preview();
    if (!this.kernel || !this.view || !preview) return;
    const parts = openingShape(preview.design, preview.placement, preview.depth).parts;
    try {
      const meshes = await this.kernel.build(openingFamilySolids(parts));
      if (meshes !== 'superseded') this.view.setMeshes(meshes);
    } catch (error) {
      console.error('Family 3D view:', error);
    }
  }
}

/**
 * The Opening family editor (ticket 20): over the panels while a family is edited, the family
 * from the top, front, left, bottom, back and right, and in 3D. The project's own panels stay
 * mounted underneath, so leaving finds them as they were.
 */
@Component({
  selector: 'lk-family-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    SelectModule,
    FamilySideComponent,
    Family3dComponent,
  ],
  template: `
    <header>
      <span class="title"
        >{{ 'family.editing' | translate }} · <b>{{ edit.name() }}</b></span
      >
      <span class="spacer"></span>
      <span class="shown">
        {{ 'family.shownAt' | translate }}
        <p-select
          size="small"
          appendTo="body"
          [options]="typeChoices()"
          optionLabel="label"
          optionValue="value"
          [ngModel]="edit.editing()?.type ?? typeChoices()[0]?.value"
          (ngModelChange)="edit.showType($event)"
          [ariaLabel]="'family.shownAt' | translate"
        />
      </span>
      <p-button size="small" [label]="'family.done' | translate" (onClick)="edit.leave()" />
    </header>
    <div class="grid">
      @for (side of sides; track side) {
        <section class="view">
          <h4>{{ 'family.sides.' + side | translate }}</h4>
          <lk-family-side [side]="side" />
        </section>
      }
      <section class="view v3d">
        <h4>3D</h4>
        @defer {
          <lk-family-3d [label]="('family.editing' | translate) + ' · 3D'" />
        }
      </section>
    </div>
    <p class="hint">{{ 'family.hint' | translate }}</p>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      min-height: 0;
      padding: 4px;
      background: var(--paper);
    }
    header {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 34px;
      padding: 0 6px 0 10px;
      border: 1px solid var(--accent);
      border-radius: 6px;
      background: var(--panel);
      font-size: 12px;
    }
    .title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .spacer {
      flex: 1;
    }
    .shown {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
    }
    .grid {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 1.4fr);
      grid-template-rows: repeat(2, minmax(0, 1fr));
      gap: 4px;
      min-height: 0;
    }
    .view {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      overflow: hidden;
      background: var(--panel);
    }
    .view > :last-child {
      flex: 1;
      min-height: 0;
    }
    .v3d {
      grid-column: 4;
      grid-row: 1 / span 2;
    }
    h4 {
      margin: 0;
      padding: 5px 10px;
      border-bottom: 1px solid var(--line);
      font-size: 12px;
      font-weight: 600;
    }
    .hint {
      margin: 0 6px 2px;
      font-size: 11px;
      color: var(--muted);
    }
  `,
})
export class FamilyEditorComponent {
  protected readonly edit = inject(FamilyEditService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);
  protected readonly sides = FAMILY_SIDES;

  protected readonly typeChoices = computed(() =>
    this.edit.types().map((t) => ({
      value: t.id,
      label: t.name
        ? `${t.name} · ${this.format.openingSize(t.width, t.height)}`
        : this.format.openingSize(t.width, t.height),
    })),
  );
}
