import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { JourneyMapStore } from '../../../../core/services/journey-map.store';
import { EditableCell } from '../../../../shared/components/editable-cell/editable-cell';

@Component({
  selector: 'app-header-section',
  imports: [EditableCell, MatIconModule, MatButtonModule, MatChipsModule, MatTooltipModule],
  templateUrl: './header-section.html',
  styleUrl: './header-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderSection {
  private store = inject(JourneyMapStore);

  protected readonly map = this.store.journeyMap;

  protected updateTitle(title: string): void {
    this.store.updateTitle(title);
  }

  protected updateActorName(name: string): void {
    this.store.updateActorName(name);
  }

  protected updateActorDescription(description: string): void {
    this.store.updateActorDescription(description);
  }

  protected updateScenario(scenario: string): void {
    this.store.updateScenario(scenario);
  }

  protected updateExpectations(expectations: string): void {
    this.store.updateExpectations(expectations);
  }

  protected updateGoal(index: number, value: string): void {
    const goals = [...this.map().actor.goals];
    if (value.trim()) {
      goals[index] = value;
    } else {
      goals.splice(index, 1);
    }
    this.store.updateActorGoals(goals);
  }

  protected addGoal(): void {
    this.store.addActorGoal('');
  }

  protected removeGoal(index: number): void {
    this.store.removeActorGoal(index);
  }
}
