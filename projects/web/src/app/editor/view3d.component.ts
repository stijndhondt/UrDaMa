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
import { TranslatePipe } from '@ngx-translate/core';
import { buildingSolids, type LevelId, type SolidRef } from '@lakudemis/core';
import {
  CAMERA_PRESETS,
  ManifoldKernel,
  View3D,
  type CameraPreset,
  type Picked,
} from '@lakudemis/render3d';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { SelectionService } from './selection.service';

/**
 * The 3D view (Slice 1 spec): read-only, all Levels stacked. It follows the committed model with
 * a short delay; the solids are built in a Web Worker, so the plan editor never waits for it.
 */
@Component({
  selector: 'lk-view3d',
  imports: [TranslatePipe],
  template: `
    <div class="bar">
      <span class="group" role="group" [attr.aria-label]="'view3d.camera' | translate">
        @for (p of presets; track p) {
          <button type="button" [class.on]="preset() === p" (click)="setPreset(p)">
            {{ 'view3d.presets.' + p | translate }}
          </button>
        }
      </span>
      <span class="group" role="group" [attr.aria-label]="'view3d.levels' | translate">
        @for (l of project.levels(); track l.id) {
          <label>
            <input
              type="checkbox"
              [checked]="!hidden().has(l.id)"
              (change)="toggleLevel(l.id, $any($event.target).checked)"
            />
            {{ l.name }}
          </label>
        }
      </span>
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
    .group {
      display: flex;
      gap: 3px;
      flex-wrap: wrap;
      align-items: center;
    }
    button {
      font-size: 11px;
      padding: 2px 7px;
      border: 1px solid var(--line);
      border-radius: 5px;
      background: var(--panel);
    }
    button.on {
      background: var(--ink);
      border-color: var(--ink);
      color: #fff;
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

  protected readonly presets = CAMERA_PRESETS;
  protected readonly preset = signal<CameraPreset>('orbit');
  protected readonly hidden = signal<ReadonlySet<LevelId>>(new Set());
  protected readonly building = signal(false);

  private view: View3D | null = null;
  private kernel: ManifoldKernel | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      this.view = new View3D(this.container().nativeElement, (picked) => this.picked(picked));
      this.kernel = new ManifoldKernel();
      this.schedule();
      this.view.setSelection(this.selectedIds());
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
      const hidden = this.hidden();
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

  protected toggleLevel(level: LevelId, visible: boolean): void {
    const next = new Set(this.hidden());
    if (visible) next.delete(level);
    else next.add(level);
    this.hidden.set(next);
  }

  /** The selected Walls, and the selected Rooms (shown by their Floor build-up). */
  private selectedIds(): ReadonlySet<SolidRef['id']> {
    return new Set(
      this.selection
        .current()
        .flatMap((s) => (s.kind === 'wall' || s.kind === 'room' ? [s.id] : [])),
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
    else if (picked.kind === 'floorBuildUp')
      this.selection.current.set([{ kind: 'room', id: picked.id }]);
    else this.selection.clear();
  }
}
