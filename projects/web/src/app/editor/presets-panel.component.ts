import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { setPresets, type Presets } from '@lakudemis/core';
import { parseLength } from '@lakudemis/editor2d';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';

const FIELDS: readonly (keyof Presets)[] = [
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

/** The project Presets (shown when nothing is selected). Each committed field is one step. */
@Component({
  selector: 'lk-presets-panel',
  imports: [TranslatePipe],
  template: `
    <h2>{{ 'presets.title' | translate }}</h2>
    <p class="hint">{{ 'presets.hint' | translate }}</p>
    @for (field of fields; track field) {
      <label>
        {{ 'presets.' + field | translate }}
        <span class="field">
          <input
            [value]="presets()[field]"
            (change)="set(field, $any($event.target))"
            (keydown.enter)="$any($event.target).blur()"
          />
          mm
        </span>
      </label>
    }
  `,
  styles: `
    h2 {
      font-size: 14px;
      margin: 0 0 6px;
    }
    .hint {
      color: var(--muted);
      margin: 0 0 10px;
      font-size: 12px;
    }
    label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      color: var(--muted);
    }
    .field {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--ink);
    }
    input {
      width: 72px;
      padding: 3px 6px;
      border: 1px solid var(--line);
      border-radius: 6px;
      text-align: right;
    }
  `,
})
export class PresetsPanelComponent {
  private readonly project = inject(ProjectService);
  private readonly messages = inject(MessagesService);
  protected readonly fields = FIELDS;
  protected readonly presets = computed(() => this.project.store.model().project.presets);

  protected set(field: keyof Presets, input: HTMLInputElement): void {
    const value = parseLength(input.value);
    if (value === null || value === this.presets()[field]) {
      input.value = String(this.presets()[field]);
      return;
    }
    const result = this.project.store.run(setPresets, { [field]: value });
    if (!result.ok) {
      this.messages.refused(result.reason);
      input.value = String(this.presets()[field]);
    }
  }
}
