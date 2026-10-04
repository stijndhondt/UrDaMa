import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SelectButtonModule } from '@openng/optimus-ui/selectbutton';
import { buildingSolids, type SolidRef } from '@urdama/core';
import {
  CAMERA_PRESETS,
  ManifoldKernel,
  View3D,
  type CameraPreset,
  type Picked,
} from '@urdama/render3d';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { LevelVisibilityService } from './level-visibility.service';
import { SelectionService } from './selection.service';

/**
 * The 3D view (Slice 1 spec): read-only, all Levels stacked. It follows the committed model with
 * a short delay; the solids are built in a Web Worker, so the plan editor never waits for it.
 */
@Component({
  selector: 'lk-view3d',
  imports: [FormsModule, TranslatePipe, SelectButtonModule],
  template: `
    <div class="bar">
      <p-selectbutton
        size="small"
        [options]="presetOptions"
        optionValue="value"
        [allowEmpty]="false"
        [ngModel]="preset()"
        (ngModelChange)="setPreset($event)"
        [ariaLabel]="'view3d.camera' | translate"
      >
        <ng-template #item let-o>{{ 'view3d.presets.' + o.value | translate }}</ng-template>
      </p-selectbutton>
      @if (building()) {
        <span class="busy">{{ 'view3d.updating' | translate }}</span>
      }
    </div>
    <div class="view" #view [attr.aria-label]="'view3d.label' | translate" role="img"></div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-rows: auto 1fr;
      min-height: 0;
      min-width: 0;
      border-left: 1px solid var(--line);
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 12px;
      align-items: center;
      padding: 6px 8px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
      font-size: 12px;
    }
    /* Compact camera choices: Optimus's small toggle size, with less padding. */
    p-selectbutton {
      flex-wrap: wrap;
      --p-togglebutton-sm-padding: 0.2rem;
      --p-togglebutton-content-sm-padding: 0.15rem 0.45rem;
      --p-togglebutton-sm-font-size: 0.75rem;
    }
    label {
      display: flex;
      gap: 3px;
      align-items: center;
      color: var(--ink);
    }
    .busy {
      color: var(--muted);
      font-style: italic;
    }
    .view {
      position: relative;
      min-height: 0;
      overflow: hidden;
    }
  `,
})
export class View3dComponent {
  protected readonly project = inject(ProjectService);
  private readonly selection = inject(SelectionService);
  private readonly messages = inject(MessagesService);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('view');

  protected readonly presetOptions = CAMERA_PRESETS.map((value) => ({ value }));
  protected readonly preset = signal<CameraPreset>('orbit');
  /** Hidden Levels come from the Building panel (ticket 10). */
  private readonly visibility = inject(LevelVisibilityService);
  protected readonly building = signal(false);

  private view: View3D | null = null;
  private kernel: ManifoldKernel | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      this.view = new View3D(this.container().nativeElement, (picked) => this.picked(picked));
      this.kernel = new ManifoldKernel(
        new Worker(new URL('./manifold.worker', import.meta.url), { type: 'module' }),
      );
      this.schedule();
      this.view.setSelection(this.selectedIds());
      this.view.setHiddenLevels(this.visibility.hidden());
    });
    // Rebuild after committed edits (not on every preview frame of a drag).
    effect(() => {
      this.project.store.committedModel();
      this.schedule();
    });
    // Read the signals first: an effect only tracks what it actually reads.
    effect(() => {
      const ids = this.selectedIds();
      this.view?.setSelection(ids);
    });
    effect(() => {
      const hidden = this.visibility.hidden();
      this.view?.setHiddenLevels(hidden);
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
      this.kernel?.dispose();
      this.view?.dispose();
    });
  }

  protected setPreset(preset: CameraPreset): void {
    this.preset.set(preset);
    this.view?.setPreset(preset);
  }

  /** The selected Walls, and the selected Rooms (shown by their Floor build-up). */
  private selectedIds(): ReadonlySet<SolidRef['id']> {
    return new Set(
      this.selection
        .current()
        .flatMap((s) =>
          s.kind === 'wall' || s.kind === 'room' || s.kind === 'opening' ? [s.id] : [],
        ),
    );
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.build(), 80);
  }

  private async build(): Promise<void> {
    this.timer = null;
    if (!this.kernel || !this.view) return;
    const solids = buildingSolids(this.project.store.committedModel(), this.project.store.values);
    this.building.set(true);
    try {
      const meshes = await this.kernel.build(solids);
      if (meshes !== 'superseded') {
        this.view.setMeshes(meshes);
        this.building.set(false);
      }
    } catch (error) {
      this.building.set(false);
      console.error('3D view:', error);
      this.messages.refused({ key: 'view3d.failed' });
    }
  }

  /** Clicking in 3D selects the same element in 2D and in the panel. */
  private picked(picked: Picked | null): void {
    if (!picked) {
      this.selection.clear();
      return;
    }
    if (picked.level !== this.project.level()) this.project.selectLevel(picked.level);
    if (picked.kind === 'wall') this.selection.current.set([{ kind: 'wall', id: picked.id }]);
    else if (picked.kind === 'openingPart')
      this.selection.current.set([{ kind: 'opening', id: picked.id }]);
    else if (picked.kind === 'floorBuildUp')
      this.selection.current.set([{ kind: 'room', id: picked.id }]);
    else this.selection.clear();
  }
}
