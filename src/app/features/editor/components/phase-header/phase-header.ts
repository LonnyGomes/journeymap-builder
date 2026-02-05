import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { JourneyPhase } from '../../../../models/journey-map.model';

@Component({
  selector: 'app-phase-header',
  templateUrl: './phase-header.html',
  styleUrl: './phase-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhaseHeader {
  readonly phase = input.required<JourneyPhase>();
  readonly canRemove = input<boolean>(true);
  readonly isLast = input<boolean>(false);

  readonly nameChange = output<string>();
  readonly remove = output<void>();
}
