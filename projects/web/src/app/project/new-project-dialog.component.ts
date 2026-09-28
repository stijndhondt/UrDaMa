import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DEFAULT_PRESETS } from '@lakudemis/core';
import { ProjectService } from './project.service';

/**
 * The new-project dialog (Slice 1 spec): name, wall-thickness Preset and Room-height Preset.
 * The project opens with one Level, "Ground floor", at elevation 0.
 */
@Component({
  selector: 'lk-new-project-dialog',
  imports: [FormsModule, TranslatePipe],
  template: `
    <dialog #dialog (close)="closed.emit()" (cancel)="closed.emit()">
      <form method="dialog" (submit)="create($event)">
        <h2>{{ 'project.new.title' | translate }}</h2>
        @if (project.unsaved()) {
          <p class="warn">{{ 'project.new.unsavedWarning' | translate }}</p>
        }
        <label>
          {{ 'project.new.name' | translate }}
          <input
            name="name"
            [(ngModel)]="name"
            [placeholder]="'project.untitled' | translate"
            autocomplete="off"
          />
        </label>
        <label>
          {{ 'project.new.wallThickness' | translate }}
          <span class="unit"
            ><input
              name="wall"
              type="number"
              min="50"
              max="1000"
              step="10"
              [(ngModel)]="wallThickness"
              required
            />
            mm</span
          >
        </label>
        <label>
          {{ 'project.new.roomHeight' | translate }}
          <span class="unit"
            ><input
              name="height"
              type="number"
              min="1500"
              max="6000"
              step="10"
              [(ngModel)]="roomHeight"
              required
            />
            mm</span
          >
        </label>
        <div class="buttons">
          <button type="button" (click)="dialog.close()">{{ 'common.cancel' | translate }}</button>
          <button type="submit" class="primary">{{ 'project.new.create' | translate }}</button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    dialog {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 18px 20px;
      min-width: 320px;
    }
    h2 {
      font-size: 17px;
      margin: 0 0 12px;
    }
    form {
      display: grid;
      gap: 10px;
    }
    label {
      display: grid;
      gap: 4px;
      color: var(--muted);
    }
    input {
      padding: 5px 7px;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--ink);
    }
    .unit {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--ink);
    }
    .unit input {
      width: 110px;
    }
    .warn {
      margin: 0;
      color: var(--warn);
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 6px;
    }
    button {
      padding: 5px 12px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
      cursor: pointer;
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-ink);
    }
  `,
})
export class NewProjectDialogComponent {
  protected readonly project = inject(ProjectService);
  protected readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  readonly closed = output<void>();

  protected name = '';
  protected wallThickness = DEFAULT_PRESETS.wallThickness;
  protected roomHeight = DEFAULT_PRESETS.roomHeight;
  readonly isOpen = signal(false);

  open(): void {
    this.name = '';
    this.wallThickness = DEFAULT_PRESETS.wallThickness;
    this.roomHeight = DEFAULT_PRESETS.roomHeight;
    this.dialog().nativeElement.showModal();
    this.isOpen.set(true);
  }

  protected create(event: Event): void {
    event.preventDefault();
    this.project.newProject({
      name: this.name,
      wallThickness: this.wallThickness,
      roomHeight: this.roomHeight,
    });
    this.dialog().nativeElement.close();
  }
}
