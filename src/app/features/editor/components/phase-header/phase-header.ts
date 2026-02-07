import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { JourneyPhase } from '../../../../models/journey-map.model';

@Component({
  selector: 'app-phase-header',
  imports: [MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './phase-header.html',
  styleUrl: './phase-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhaseHeader {
  readonly phase = input.required<JourneyPhase>();
  readonly canRemove = input<boolean>(true);
  readonly isLast = input<boolean>(false);
  readonly phaseColor = input<string>('var(--color-primary)');

  readonly nameChange = output<string>();
  readonly remove = output<void>();
}
