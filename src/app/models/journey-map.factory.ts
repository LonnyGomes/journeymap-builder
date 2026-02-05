import { Actor, JourneyMap, JourneyPhase } from './journey-map.model';

export function generateId(): string {
  return crypto.randomUUID();
}

export function createEmptyActor(): Actor {
  return {
    name: '',
    description: '',
    goals: [],
  };
}

export function createEmptyPhase(order: number): JourneyPhase {
  return {
    id: generateId(),
    name: `Phase ${order + 1}`,
    order,
    actions: '',
    mindsets: '',
    emotion: null,
    opportunities: '',
  };
}

export function createEmptyJourneyMap(): JourneyMap {
  const now = new Date();
  return {
    id: generateId(),
    title: 'Untitled Journey Map',
    createdAt: now,
    updatedAt: now,
    actor: createEmptyActor(),
    scenario: '',
    expectations: '',
    phases: [createEmptyPhase(0), createEmptyPhase(1), createEmptyPhase(2)],
  };
}

export function cloneJourneyMap(map: JourneyMap): JourneyMap {
  return {
    ...map,
    createdAt: new Date(map.createdAt),
    updatedAt: new Date(map.updatedAt),
    actor: { ...map.actor, goals: [...map.actor.goals] },
    phases: map.phases.map((phase) => ({ ...phase })),
  };
}

export function reorderPhases(phases: JourneyPhase[]): JourneyPhase[] {
  return phases.map((phase, index) => ({
    ...phase,
    order: index,
  }));
}
