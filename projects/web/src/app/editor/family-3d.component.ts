import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { openingFamilySolids, openingShape } from '@urdama/core';
import { ManifoldKernel, View3D } from '@urdama/render3d';
import { FamilyEditService } from './family-edit.service';

/**
 * The family in 3D (ticket 20), built from the same parts as the six views. In its own file so the
 * family editor's @defer loads it, and three.js with it, only when the editor opens; otherwise
 * three.js lands in the app's first download (ADR 0008 budget).
 */
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
