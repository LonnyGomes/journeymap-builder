import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { JourneyPhase, EmotionEmoji, getEmotionLabel } from '../../../../models/journey-map.model';
import { EditableCell } from '../../../../shared/components/editable-cell/editable-cell';
import { PhaseHeader } from '../phase-header/phase-header';

@Component({
  selector: 'app-phase-column',
  imports: [EditableCell, PhaseHeader],
  templateUrl: './phase-column.html',
  styleUrl: './phase-column.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style: 'display: grid; grid-row: 1 / -1; grid-template-rows: subgrid;',
  },
})
export class PhaseColumn {
  readonly phase = input.required<JourneyPhase>();
  readonly canRemove = input<boolean>(true);
  readonly isLast = input<boolean>(false);
  readonly phaseColor = input<string>('var(--color-primary)');

  readonly nameChange = output<string>();
  readonly actionsChange = output<string>();
  readonly mindsetsChange = output<string>();
  readonly emotionChange = output<EmotionEmoji | null>();
  readonly opportunitiesChange = output<string>();
  readonly remove = output<void>();
  readonly showEmotionPicker = output<void>();

  protected getEmotionLabel(emoji: EmotionEmoji | null): string {
    return getEmotionLabel(emoji);
  }
}
