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
} from '@urdama/core';
import { ElevationView } from '@urdama/editor2d';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { ProjectService } from '../project/project.service';
import { settled } from '../project/settled';
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
  private readonly format = inject(FormatService);
  private readonly planColors = inject(PlanColorsService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private view: ElevationView | null = null;

  /**
   * Follows every edit, and holds still while a drag is previewed (ticket 33): working out the
   * whole building's Elevation on every pointer move of a 200-Wall plan took up to 240 ms a move.
   */
  private readonly drawing = settled(this.project.store, () =>
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
        metres: (mm) => this.format.metres(mm / 1000),
        text: (key) => this.language.text(key),
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
      this.language.current();
      untracked(() => this.view?.redraw());
    });
    inject(DestroyRef).onDestroy(() => this.view?.destroy());
  }

  private readonly selected = computed(() => {
    const walls = new Set<WallId>();
    const openings = new Set<OpeningId>();
    // A Façade picked in the Quantities shows as its faces, in the Elevation of its side only
    // (not as its whole Walls, whose ends other sides see).
    const facade = this.selection.facade();
    if (facade)
      return {
        walls,
        openings,
        faces: facade.side === this.side() ? facade.faces : new Set<string>(),
      };
    const faces = new Set<string>();
    for (const s of this.selection.current()) {
      if (s.kind === 'wall') walls.add(s.id);
      else if (s.kind === 'opening') openings.add(s.id);
    }
    return { walls, openings, faces };
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
