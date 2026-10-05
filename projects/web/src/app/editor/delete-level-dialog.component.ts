import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { deleteLevel, levelContents } from '@urdama/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { DeleteLevelService } from './delete-level.service';

/**
 * Deleting a Level asks first (ticket 32), in the app's language, naming the Level and what goes
 * with it. Cancel leaves the model unchanged; Delete is one command and one undo step.
 */
@Component({
  selector: 'lk-delete-level-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ButtonModule, DialogModule],
  template: `
    <p-dialog
      [header]="'panel.level.delete' | translate"
      [visible]="!!asked()"
      (visibleChange)="$event || cancel()"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closeAriaLabel]="'common.close' | translate"
      [style]="{ width: '380px' }"
    >
      @if (asked(); as a) {
        <p class="text">{{ 'panel.level.confirmDelete' | translate: a }}</p>
      }
      <ng-template #footer>
        <p-button
          [label]="'common.cancel' | translate"
          severity="secondary"
          [text]="true"
          (onClick)="cancel()"
        />
        <p-button
          [label]="'panel.level.delete' | translate"
          severity="danger"
          (onClick)="confirm()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .text {
      margin: 0;
    }
  `,
})
export class DeleteLevelDialogComponent {
  private readonly project = inject(ProjectService);
  private readonly messages = inject(MessagesService);
  private readonly asking = inject(DeleteLevelService).asking;

  /** The Level's name and how many Rooms, Walls, Openings and Floor openings go with it. */
  protected readonly asked = computed(() => {
    const id = this.asking();
    const model = this.project.store.model();
    const level = id ? model.levels[id] : undefined;
    if (!level) return null;
    const goes = levelContents(model, level.id);
    return {
      name: level.name,
      rooms: goes.rooms.size,
      walls: goes.walls.size,
      openings: goes.openings.size,
      floorOpenings: goes.floorOpenings.size,
    };
  });

  protected cancel(): void {
    this.asking.set(null);
  }

  protected confirm(): void {
    const level = this.asking();
    this.asking.set(null);
    if (!level) return;
    const result = this.project.store.run(deleteLevel, { level });
    if (!result.ok) this.messages.refused(result.reason);
  }
}
