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
import { TranslatePipe } from '@ngx-translate/core';
import {
  elevation,
  type ElevationShape,
  type FacadeSide,
  type OpeningId,
  type WallId,
} from '@lakudemis/core';
import { ElevationView } from '@lakudemis/editor2d';
import { LanguageService } from '../language';
import { ProjectService } from '../project/project.service';
import { ThemeService } from '../shell/theme.service';
import { LevelVisibilityService } from './level-visibility.service';
import { PlanColorsService } from './plan-colors.service';
import { SelectionService } from './selection.service';

/**
 * An Elevation panel's drawing (ticket 14): the whole building from one side, all shown Levels
 * stacked. Clicking a Wall face or Opening selects it everywhere; what is selected elsewhere is
 * highlighted. It follows every edit, and hidden Levels stay hidden.
 */
@Component({
  selector: 'lk-elevation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <canvas
      #canvas
      [attr.aria-label]="'layout.elevationLabel' | translate: { side: sideName() }"
    ></canvas>
    @if (empty()) {
      <p class="empty">{{ 'layout.elevationEmpty' | translate: { side: sideName() } }}</p>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      height: 100%;
      background: var(--paper);
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    .empty {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      margin: 0;
      padding: 12px;
      color: var(--muted);
      font-size: 12px;
      text-align: center;
      pointer-events: none;
    }
  `,
})
export class ElevationComponent {
  readonly side = input.required<FacadeSide>();

  private readonly project = inject(ProjectService);
  private readonly selection = inject(SelectionService);
  private readonly visibility = inject(LevelVisibilityService);
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
  private readonly planColors = inject(PlanColorsService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private view: ElevationView | null = null;

  /** Follows the model live, as the Derived values it reads do (a drag shows as it happens). */
  private readonly drawing = computed(() =>
    elevation(this.project.store.model(), this.project.store.values, this.side()),
  );

  protected readonly empty = computed(() => {
    const hidden = this.visibility.hidden();
    return !this.drawing().shapes.some((s) => !hidden.has(s.level));
  });

  protected readonly sideName = computed(() => this.language.text('layout.sides.' + this.side()));

  constructor() {
    afterNextRender(() => {
      this.view = new ElevationView(this.canvas().nativeElement, {
        colors: () => this.planColors.colors(),
        picked: (shape) => this.pick(shape),
      });
      this.view.set(this.drawing(), this.visibility.hidden());
      this.view.setSelection(this.selected());
    });
    effect(() => {
      const drawing = this.drawing();
      const hidden = this.visibility.hidden();
      untracked(() => this.view?.set(drawing, hidden));
    });
    effect(() => {
      const selected = this.selected();
      untracked(() => this.view?.setSelection(selected));
    });
    effect(() => {
      this.theme.dark();
      untracked(() => this.view?.redraw());
    });
    inject(DestroyRef).onDestroy(() => this.view?.destroy());
  }

  private readonly selected = computed(() => {
    const walls = new Set<WallId>();
    const openings = new Set<OpeningId>();
    for (const s of this.selection.current()) {
      if (s.kind === 'wall') walls.add(s.id);
      else if (s.kind === 'opening') openings.add(s.id);
    }
    return { walls, openings };
  });

  /** A click selects the Wall or Opening on its Level, everywhere; empty space clears. */
  private pick(shape: ElevationShape | null): void {
    if (!shape || shape.kind === 'slabEdge') {
      this.selection.clear();
      return;
    }
    if (shape.level !== this.project.level()) this.project.selectLevel(shape.level);
    this.selection.current.set(
      shape.kind === 'opening'
        ? [{ kind: 'opening', id: shape.opening }]
        : [{ kind: 'wall', id: shape.wall }],
    );
  }
}
