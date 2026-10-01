import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DEFAULT_PRESETS } from '@lakudemis/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { InputNumberModule } from '@openng/optimus-ui/inputnumber';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { LayoutService } from '../shell/layout.service';
import { ProjectService } from './project.service';

/**
 * The new-project dialog (Slice 1 spec): name, wall-thickness Preset and Room-height Preset.
 * The project opens with one Level, "Ground floor", at elevation 0. Optimus's dialog and fields
 * (ADR 0008).
 */
@Component({
  selector: 'lk-new-project-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
  ],
  template: `
    <p-dialog
      [header]="'project.new.title' | translate"
      [visible]="isOpen()"
      (visibleChange)="isOpen.set($event)"
      (onHide)="closed.emit()"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '360px' }"
    >
      <form class="form" (submit)="create($event)">
        <!-- Enter in a field creates the project. -->
        <button type="submit" hidden></button>
        @if (project.unsaved()) {
          <p class="warn">{{ 'project.new.unsavedWarning' | translate }}</p>
        }
        <label for="new-project-name">{{ 'project.new.name' | translate }}</label>
        <input
          pInputText
          id="new-project-name"
          name="name"
          [ngModel]="name()"
          (ngModelChange)="name.set($event)"
          [placeholder]="'project.untitled' | translate"
          autocomplete="off"
        />
        <label for="new-project-wall">{{ 'project.new.wallThickness' | translate }}</label>
        <p-inputnumber
          inputId="new-project-wall"
          name="wall"
          [ngModel]="wallThickness()"
          (ngModelChange)="wallThickness.set($event)"
          [min]="50"
          [max]="1000"
          [step]="10"
          [useGrouping]="false"
          suffix=" mm"
          [showButtons]="true"
        />
        <label for="new-project-height">{{ 'project.new.roomHeight' | translate }}</label>
        <p-inputnumber
          inputId="new-project-height"
          name="height"
          [ngModel]="roomHeight()"
          (ngModelChange)="roomHeight.set($event)"
          [min]="1500"
          [max]="6000"
          [step]="10"
          [useGrouping]="false"
          suffix=" mm"
          [showButtons]="true"
        />
      </form>
      <ng-template #footer>
        <p-button
          [label]="'common.cancel' | translate"
          severity="secondary"
          [text]="true"
          (onClick)="isOpen.set(false)"
        />
        <p-button [label]="'project.new.create' | translate" (onClick)="create()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .form {
      display: grid;
      gap: 6px;
    }
    label {
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
    }
    .warn {
      margin: 0;
      color: var(--warn);
    }
  `,
})
export class NewProjectDialogComponent {
  protected readonly project = inject(ProjectService);
  private readonly layout = inject(LayoutService);
  readonly closed = output<void>();

  protected readonly name = signal('');
  protected readonly wallThickness = signal(DEFAULT_PRESETS.wallThickness);
  protected readonly roomHeight = signal(DEFAULT_PRESETS.roomHeight);
  protected readonly isOpen = signal(false);

  open(): void {
    this.name.set('');
    this.wallThickness.set(DEFAULT_PRESETS.wallThickness);
    this.roomHeight.set(DEFAULT_PRESETS.roomHeight);
    this.isOpen.set(true);
  }

  protected create(event?: Event): void {
    event?.preventDefault();
    this.project.newProject({
      name: this.name(),
      wallThickness: this.wallThickness(),
      roomHeight: this.roomHeight(),
    });
    this.layout.reset();
    this.isOpen.set(false);
  }
}
